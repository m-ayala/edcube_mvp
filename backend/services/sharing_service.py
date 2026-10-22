# backend/services/sharing_service.py
"""
Sharing and collaboration (TASK-036): view-only links, invites, collaborator bookkeeping and the
lapse rules. Plain functions over a Firestore client (`db`); the HTTP layer is routes/sharing.py.

Data model (both collections are backend-only; firestore.rules deny every client access)

  ShareLinks/{token}   token = secrets.token_urlsafe(32) (256 bits) and is also the doc id
      course_id, workspace ("personal" | orgId), owner_uid, created_at, revoked_at (null = live),
      last_viewed_at, view_count

  Invites/{id}         id = Firestore auto id; `token` (256 bits) is what the emailed link carries
      course_id, workspace, owner_uid, email (lowercased), access_type ("collaborate" | "view"),
      status (pending | accepted | cancelled | expired), token, created_at, expires_at,
      accepted_uid, accepted_at, cancelled_at, cancel_reason, email_sent_at

  Users/{ws}/curricula/{id}.sharedWith / .sharedWithUids   unchanged. sharedWith is the source of
      truth for who is a collaborator; both fields are written in ONE update so the Firestore rules'
      sharedWithUids can never drift. There is no per-collaborator ownership: everything a
      collaborator writes lands on the same document, owned by `teacherUid` (the owner).

Core rule: the course OWNER's plan decides what is possible. Nothing about a collaborator's own
plan is consulted here. Co-edit permission is computed live from the owner's plan on every write
(entitlements.enforce_collaborator_write) and never stored, so a lapse drops every collaborator to
view-only and a re-subscribe restores them with no data change. A lapse also cancels pending invites
(eagerly in the admin plan-change / deactivation paths, lazily on every invite read or accept).
"""

import logging
import os
import re
import secrets
import threading
import time
from collections import deque
from datetime import datetime, timedelta, timezone
from typing import Any, Deque, Dict, List, Optional, Tuple

from fastapi import HTTPException
from firebase_admin import auth as fb_auth
from firebase_admin import firestore

from firebase.org_registry import get_org_from_email, get_org_info
from firebase.paths import PERSONAL_SPACE_ID, invites_col, org_col, share_links_col
from services import accounts_service as accts
from services import entitlements

logger = logging.getLogger(__name__)

TOKEN_BYTES = 32                    # 256 bits; the spec asks for >= 128
INVITE_TTL_DAYS = 14
MAX_ACTIVE_LINKS_PER_COURSE = 20

ACCESS_COLLABORATE = "collaborate"
ACCESS_VIEW = "view"
ACCESS_TYPES = (ACCESS_COLLABORATE, ACCESS_VIEW)

PENDING, ACCEPTED, CANCELLED, EXPIRED = "pending", "accepted", "cancelled", "expired"

LINK_UNAVAILABLE = {"code": "link_unavailable", "message": "This link isn't available."}

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

# Public-view fields (whitelist). Anything not listed never leaves the server through a link.
PUBLIC_COURSE_FIELDS = (
    "courseName", "subject", "topic", "class", "ageRangeStart", "ageRangeEnd", "numDays",
    "hoursPerDay", "timeDuration", "objectives", "courseDescription", "synopsis",
    "sections", "outline", "generatedTopics", "handsOnResources", "lastModified",
)
# Keys removed at any depth inside those fields.
_PRIVATE_KEY_RE = re.compile(r"(email|uid$|^uid|shared|organizationid|storagepath|storage_path|extractedtext|interpret|requirement|^_)", re.I)


# ── rate limiting (in-memory sliding window, per process, like the other throttles) ──────────────

class RateLimiter:
    def __init__(self, limit: int, window_seconds: int):
        self.limit, self.window = limit, window_seconds
        self._log: Dict[str, Deque[float]] = {}
        self._lock = threading.Lock()

    def hit(self, key: str, now: Optional[float] = None) -> Optional[int]:
        """Record one hit. None = allowed; else seconds until the caller may retry (hit not recorded)."""
        now = time.monotonic() if now is None else now
        with self._lock:
            q = self._log.setdefault(key, deque())
            while q and now - q[0] > self.window:
                q.popleft()
            if len(q) >= self.limit:
                return int(self.window - (now - q[0])) + 1
            q.append(now)
            if len(self._log) > 5000:   # opportunistic cleanup of idle keys
                for k in [k for k, v in self._log.items() if not v or now - v[-1] > self.window]:
                    self._log.pop(k, None)
            return None

    def reset(self) -> None:
        with self._lock:
            self._log.clear()


PUBLIC_VIEW_LIMITER = RateLimiter(60, 60)       # public share/invite lookups: 60 / minute / IP
INVITE_LIMITER = RateLimiter(30, 3600)          # invites sent: 30 / hour / owner


def throttle(limiter: RateLimiter, key: str) -> None:
    retry = limiter.hit(key)
    if retry is not None:
        raise HTTPException(status_code=429, detail={"code": "rate_limited", "message": "Too many requests. Try again shortly."},
                            headers={"Retry-After": str(max(retry, 1))})


def reset_limiters() -> None:
    PUBLIC_VIEW_LIMITER.reset()
    INVITE_LIMITER.reset()


# ── small helpers ───────────────────────────────────────────────────────────────────────────────

def _now() -> datetime:
    return datetime.now(timezone.utc)


def new_token() -> str:
    return secrets.token_urlsafe(TOKEN_BYTES)


def frontend_url() -> str:
    """Base URL for emailed links. Env FRONTEND_URL; default is the production site."""
    return (os.getenv("FRONTEND_URL") or "https://edcube.org").rstrip("/")


def normalize_email(email: str) -> str:
    e = (email or "").strip().lower()
    if len(e) > 254 or not _EMAIL_RE.match(e):
        raise HTTPException(status_code=400, detail={"code": "invalid_email", "message": "Enter a valid email address."})
    return e


def mask_email(email: str) -> str:
    local, _, domain = (email or "").partition("@")
    return (local[:1] + "***@" + domain) if local and domain else ""


def clean_text(s: Optional[str], limit: int = 120) -> str:
    """Names that go into an email header/body: no control characters."""
    return re.sub(r"[\x00-\x1f\x7f]", " ", s or "").strip()[:limit]


def course_ref(db, workspace: str, course_id: str):
    return org_col(db, workspace, "curricula").document(course_id)


def load_course(db, workspace: str, course_id: str) -> Optional[dict]:
    snap = course_ref(db, workspace, course_id).get()
    if not snap.exists:
        return None
    d = snap.to_dict() or {}
    d["id"] = snap.id
    return d


def display_name(db, workspace: str, uid: str, default: str = "An EdCube teacher") -> str:
    try:
        snap = org_col(db, workspace, "teacher_profiles").document(uid).get()
        if snap.exists:
            return clean_text((snap.to_dict() or {}).get("display_name")) or default
    except Exception as e:  # noqa: BLE001
        logger.warning("display name lookup failed (%s): %s", uid, e)
    return default


def shared_entries(course: dict) -> List[dict]:
    return list((course or {}).get("sharedWith") or [])


def entry_for(course: dict, uid: str) -> Optional[dict]:
    return next((s for s in shared_entries(course) if s.get("uid") == uid), None)


def is_owner(course: dict, uid: str) -> bool:
    return bool(course) and course.get("teacherUid") == uid


# ── access (computed live, used by get_curriculum / the access route) ───────────────────────────

def access_info(db, course: dict, uid: str, workspace: str) -> dict:
    """{role, can_edit, reason} for `uid` on `course`, from the OWNER's current plan. Never stored."""
    owner_uid = course.get("teacherUid")
    if owner_uid == uid:
        return {"role": "owner", "can_edit": True, "reason": None}
    entry = entry_for(course, uid)
    if not entry:
        return {"role": "org_viewer" if workspace != PERSONAL_SPACE_ID else None, "can_edit": False,
                "reason": "access_view_only"}
    if entry.get("accessType") != ACCESS_COLLABORATE:
        return {"role": "view", "can_edit": False, "reason": "access_view_only"}
    if workspace != PERSONAL_SPACE_ID:
        return {"role": "collaborate", "can_edit": True, "reason": None}   # org: unchanged from before TASK-036
    if not entitlements.owner_allows_access(owner_uid, workspace, db):
        return {"role": "collaborate", "can_edit": False, "reason": "owner_deactivated"}
    d = entitlements.can({"uid": None, "org": workspace}, entitlements.COEDIT, {"teacherUid": owner_uid}, db=db)
    return {"role": "collaborate", "can_edit": d.allowed, "reason": None if d.allowed else (d.reason or "owner_plan_no_coediting")}


def write_denial(db, course: dict, uid: str, workspace: str) -> Optional[Tuple[int, dict]]:
    """None if `uid` may write to `course`, else (status, detail) with a code the client can act on:
    coediting_not_in_plan (owner lapsed), account_deactivated (owner), access_view_only (no edit right)."""
    info = access_info(db, course, uid, workspace)
    if info["can_edit"]:
        return None
    if info["role"] == "collaborate":
        if info["reason"] == "owner_deactivated":
            return 403, {"code": "account_deactivated", "reason": "owner_deactivated",
                         "message": "This course's owner has deactivated their account."}
        return 403, {"code": "coediting_not_in_plan", "reason": info["reason"],
                     "message": "Co-editing isn't available on this course right now because of the owner's plan. Your unsaved changes are still on your screen; copy them if you need to keep them."}
    return 403, {"code": "access_view_only", "reason": info["reason"],
                 "message": "You have view-only access to this course."}


# ── shared-with bookkeeping (sharedWith + sharedWithUids in ONE write) ───────────────────────────

def _write_shared(db, workspace: str, course_id: str, shared: List[dict]) -> None:
    uids = sorted({s.get("uid") for s in shared if s.get("uid")})
    course_ref(db, workspace, course_id).update({"sharedWith": shared, "sharedWithUids": uids})


def add_shared(db, workspace: str, course: dict, uid: str, access_type: str) -> None:
    shared = [s for s in shared_entries(course) if s.get("uid") != uid]
    shared.append({"uid": uid, "accessType": access_type})
    _write_shared(db, workspace, course["id"], shared)
    course["sharedWith"] = shared


def remove_shared(db, workspace: str, course: dict, uid: str) -> bool:
    before = shared_entries(course)
    shared = [s for s in before if s.get("uid") != uid]
    if len(shared) == len(before):
        return False
    _write_shared(db, workspace, course["id"], shared)
    course["sharedWith"] = shared
    return True


def notify(db, workspace: str, to_uid: str, from_uid: str, from_name: str, notif_type: str,
           course_id: str, course_name: str, access_type: Optional[str] = None) -> None:
    """Same document shape as FirebaseService.create_notification (the existing notification inbox)."""
    import uuid
    nid = str(uuid.uuid4())
    doc = {"id": nid, "toUid": to_uid, "fromUid": from_uid, "fromName": from_name, "type": notif_type,
           "courseId": course_id, "courseName": course_name, "createdAt": datetime.utcnow().isoformat()}
    if access_type:
        doc["accessType"] = access_type
    org_col(db, workspace, "notifications").document(nid).set(doc)


# ── invites: queries and lazy lapse handling ─────────────────────────────────────────────────────

def _invite_docs_for_course(db, workspace: str, course_id: str) -> List[Any]:
    return [s for s in invites_col(db).where("course_id", "==", course_id).stream()
            if (s.to_dict() or {}).get("workspace") == workspace]


def _set_invite(db, invite_id: str, patch: dict) -> None:
    invites_col(db).document(invite_id).update(patch)


def cancel_invite(db, invite_id: str, reason: str, status: str = CANCELLED, now: Optional[datetime] = None) -> None:
    _set_invite(db, invite_id, {"status": status, "cancel_reason": reason, "cancelled_at": now or _now()})


def pending_problem(db, inv: dict, course: Optional[dict], now: Optional[datetime] = None) -> Optional[Tuple[str, str]]:
    """Why a PENDING invite is no longer valid: (new_status, reason), or None if it still is.
    Lazy lapse rules: expired trials have no event, so this runs on every invite read and accept."""
    now = now or _now()
    ws, owner = inv.get("workspace"), inv.get("owner_uid")
    if course is None:
        return CANCELLED, "course_deleted"
    if course.get("teacherUid") != owner:
        return CANCELLED, "ownership_changed"
    exp = accts.as_utc(inv.get("expires_at"))
    if exp is not None and now >= exp:
        return EXPIRED, "expired"
    if not entitlements.owner_allows_access(owner, ws, db):
        return CANCELLED, "owner_deactivated"
    if inv.get("access_type") == ACCESS_COLLABORATE and not entitlements.owner_allows_coedit(owner, ws, db):
        return CANCELLED, "owner_plan_no_coediting"
    return None


def reconcile_course_invites(db, workspace: str, course: Optional[dict], course_id: str,
                             now: Optional[datetime] = None) -> List[Tuple[str, dict]]:
    """Cancel/expire pending invites on this course that are no longer valid; return the live pending
    ones as [(invite_id, data)]."""
    live = []
    for snap in _invite_docs_for_course(db, workspace, course_id):
        inv = snap.to_dict() or {}
        if inv.get("status") != PENDING:
            continue
        problem = pending_problem(db, inv, course, now)
        if problem:
            cancel_invite(db, snap.id, problem[1], problem[0], now)
        else:
            live.append((snap.id, inv))
    return live


def reconcile_owner_invites(db, owner_uid: str, now: Optional[datetime] = None) -> int:
    """EAGER lapse handling, called from the admin plan-change and deactivation paths (and safe to
    call any time): cancel every pending invite of this owner that is no longer valid. Returns how
    many were cancelled. Collaborators' sharedWith entries are untouched, so a re-subscribe restores edit."""
    n = 0
    for snap in invites_col(db).where("owner_uid", "==", owner_uid).stream():
        inv = snap.to_dict() or {}
        if inv.get("status") != PENDING:
            continue
        course = load_course(db, inv.get("workspace"), inv.get("course_id"))
        problem = pending_problem(db, inv, course, now)
        if problem:
            cancel_invite(db, snap.id, problem[1], problem[0], now)
            n += 1
    return n


def safe_reconcile_owner(owner_uid: str, db=None) -> int:
    """reconcile_owner_invites that never raises (a plan change must not fail because of this)."""
    try:
        if db is None:
            from firebase.project import firestore_client
            db = firestore_client()
        return reconcile_owner_invites(db, owner_uid)
    except Exception as e:  # noqa: BLE001
        logger.error("invite reconcile failed for %s: %s", owner_uid, e)
        return 0


# ── slots / plan gates ──────────────────────────────────────────────────────────────────────────

def slot_counts(course: dict, live_pending: List[Tuple[str, dict]]) -> Tuple[int, int]:
    """(active collaborate collaborators, pending collaborate invites)."""
    active = sum(1 for s in shared_entries(course) if s.get("accessType") == ACCESS_COLLABORATE)
    pending = sum(1 for _, i in live_pending if i.get("access_type") == ACCESS_COLLABORATE)
    return active, pending


def course_with_pending(course: dict, live_pending: List[Tuple[str, dict]]) -> dict:
    """Copy of the course whose sharedWith also carries one synthetic collaborate entry per pending
    collaborate invite, so entitlements.can(INVITE_COLLABORATOR) counts pending invites against the cap."""
    c = dict(course)
    c["sharedWith"] = shared_entries(course) + [
        {"uid": None, "accessType": ACCESS_COLLABORATE} for _, i in live_pending if i.get("access_type") == ACCESS_COLLABORATE]
    return c


def cap_error(user: dict, plan: Optional[str], cap: Optional[int], current: int, db=None) -> HTTPException:
    personal = user.get("org") == PERSONAL_SPACE_ID
    msg = (f"This course already has {current} of {cap} collaborators (pending invites count). "
           "Remove a collaborator or cancel a pending invite to add someone else."
           if personal else
           f"Your organization's limit of {cap} collaborators per course has been reached (pending invites count).")
    return HTTPException(status_code=402, detail={
        "code": "plan_upgrade_required", "reason": "collaborator_cap_reached", "message": msg,
        "plan": plan, "cap": cap, "current": current})


def gate_invite(db, user: dict, course: dict, access_type: str, live_pending: List[Tuple[str, dict]],
                exclude_invite_id: Optional[str] = None) -> None:
    """Raise the 402/403 the owner should see, or return. 'view' needs only link-sharing rights;
    'collaborate' needs owner_allows_coedit (plan flag) and room under the cap, pending counted.
    `exclude_invite_id`: re-sending an existing pending invite does not take a second slot."""
    if access_type == ACCESS_VIEW:
        entitlements.enforce(user, entitlements.SHARE_LINK_CREATE, course)
        return
    pending = [(i, d) for i, d in live_pending if i != exclude_invite_id]
    d = entitlements.can(user, entitlements.INVITE_COLLABORATOR, course_with_pending(course, pending), db=db)
    if d.allowed:
        return
    if d.reason == "collaborator_cap_reached":
        active, pend = slot_counts(course, pending)
        raise cap_error(user, d.plan, entitlements.collaborator_cap(user, db), active + pend, db)
    raise HTTPException(status_code=d.http_status(), detail=d.to_detail())


# ── inviting ────────────────────────────────────────────────────────────────────────────────────

def find_existing_account(db, email: str, workspace: str) -> Optional[str]:
    """uid of an EdCube account for `email` that can be placed in `workspace`, else None. Personal
    workspace: a bootstrapped account (Accounts doc or personal teachers doc). Org workspace: the
    account has a profile in that org."""
    try:
        uid = fb_auth.get_user_by_email(email).uid
    except (fb_auth.UserNotFoundError, ValueError):
        return None
    if workspace == PERSONAL_SPACE_ID:
        if accts.get_account(uid, db) is not None:
            return uid
        return uid if org_col(db, PERSONAL_SPACE_ID, "teachers").document(uid).get().exists else None
    return uid if org_col(db, workspace, "teacher_profiles").document(uid).get().exists else None


def invite_by_email(db, user: dict, course: dict, email: str, access_type: str,
                    now: Optional[datetime] = None) -> dict:
    """Owner invites `email` to `course`. Returns a result dict (the route turns it into the response):
        {"status": "added", "uid", ...}           existing account in this workspace: added to sharedWith, notified
        {"status": "invited", "invite", ...}      no account yet: pending invite (the route emails the link)
        {"status": "already_shared", ...}         already has this access
    Raises HTTPException for validation, plan and cap failures."""
    now = now or _now()
    ws, owner_uid = user["org"], user["uid"]
    if access_type not in ACCESS_TYPES:
        raise HTTPException(status_code=400, detail={"code": "invalid_access_type", "message": "access_type must be 'collaborate' or 'view'."})
    email = normalize_email(email)
    if email == (user.get("email") or "").strip().lower():
        raise HTTPException(status_code=400, detail={"code": "cannot_invite_self", "message": "You can't invite yourself."})
    if ws != PERSONAL_SPACE_ID and get_org_from_email(email) != ws:
        raise HTTPException(status_code=400, detail={"code": "not_in_org", "message": "In an organization workspace you can only invite people from your organization."})

    live = reconcile_course_invites(db, ws, course, course["id"], now)
    existing_uid = find_existing_account(db, email, ws)
    if existing_uid == owner_uid:
        raise HTTPException(status_code=400, detail={"code": "cannot_invite_self", "message": "You can't invite yourself."})

    entry = entry_for(course, existing_uid) if existing_uid else None
    same_pending = next(((i, d) for i, d in live if d.get("email") == email and d.get("access_type") == access_type), None)

    if entry and entry.get("accessType") == access_type:
        return {"status": "already_shared", "email": email, "access_type": access_type, "uid": existing_uid}

    gate_invite(db, user, course, access_type, live, exclude_invite_id=same_pending[0] if same_pending else None)

    if existing_uid:
        previous = dict(entry) if entry else None
        add_shared(db, ws, course, existing_uid, access_type)
        if access_type == ACCESS_COLLABORATE:   # concurrent-request guard: recount after the write
            _guard_after_write(db, user, course, live, rollback=lambda: (
                add_shared(db, ws, course, existing_uid, previous["accessType"]) if previous
                else remove_shared(db, ws, course, existing_uid)))
        for iid, d in live:                      # a pending invite for this email is now moot
            if d.get("email") == email:
                cancel_invite(db, iid, "added_directly", now=now)
        name = display_name(db, ws, owner_uid, "Someone")
        notify(db, ws, existing_uid, owner_uid, name,
               "course_share_collaborate" if access_type == ACCESS_COLLABORATE else "course_share_view",
               course["id"], course.get("courseName", ""), access_type)
        return {"status": "added", "email": email, "access_type": access_type, "uid": existing_uid}

    # no account yet: pending invite
    for iid, d in live:                          # same email, other access type: replace
        if d.get("email") == email and d.get("access_type") != access_type:
            cancel_invite(db, iid, "replaced", now=now)
    if same_pending:
        iid, inv = same_pending
        patch = {"expires_at": now + timedelta(days=INVITE_TTL_DAYS)}
        _set_invite(db, iid, patch)
        inv = {**inv, **patch}
        return {"status": "invited", "email": email, "access_type": access_type, "invite_id": iid, "invite": inv, "resent": True}
    ref = invites_col(db).document()
    inv = {"course_id": course["id"], "workspace": ws, "owner_uid": owner_uid, "email": email,
           "access_type": access_type, "status": PENDING, "token": new_token(), "created_at": now,
           "expires_at": now + timedelta(days=INVITE_TTL_DAYS), "accepted_uid": None}
    ref.set(inv)
    if access_type == ACCESS_COLLABORATE:
        _guard_after_write(db, user, course, live, rollback=lambda: cancel_invite(db, ref.id, "cap_race", now=now),
                           new_invite_id=ref.id)
    return {"status": "invited", "email": email, "access_type": access_type, "invite_id": ref.id, "invite": inv, "resent": False}


def _guard_after_write(db, user: dict, course: dict, live_before: List[Tuple[str, dict]], rollback,
                       new_invite_id: Optional[str] = None) -> None:
    """Two simultaneous invites could both pass the pre-check. Recount after writing; if the cap is
    exceeded, undo this write and report the cap error."""
    cap = entitlements.collaborator_cap(user, db)
    if cap is None:
        return
    fresh = load_course(db, user["org"], course["id"]) or course
    live = [(i, d) for i, d in reconcile_course_invites(db, user["org"], fresh, course["id"])]
    active, pend = slot_counts(fresh, live)
    if active + pend > cap:
        rollback()
        raise cap_error(user, None, cap, active + pend - 1, db)


def invite_email_content(db, inv: dict, course: dict, inviter_name: str) -> Tuple[str, str]:
    link = f"{frontend_url()}/invite/{inv['token']}"
    title = clean_text(course.get("courseName"), 150) or "a course"
    who = clean_text(inviter_name) or "A teacher"
    what = "edit" if inv.get("access_type") == ACCESS_COLLABORATE else "view"
    subject = f"{who} invited you to {what} \"{title}\" on EdCube"
    body = (f"{who} invited you to {what} the course \"{title}\" on EdCube.\n\n"
            f"Open this link to accept (it's free to sign up):\n{link}\n\n"
            f"Use the account with this email address ({inv['email']}). The invitation expires in {INVITE_TTL_DAYS} days.\n\n"
            "If you weren't expecting this, you can ignore this email.\n")
    return subject, body


# ── collaborator views / removal / leave ────────────────────────────────────────────────────────

def remove_collaborator(db, workspace: str, course: dict, owner_uid: str, uid: str) -> bool:
    """Owner removes a collaborator (or any sharedWith entry): sharedWith and sharedWithUids change in
    one write, so the person loses read AND write at once, including any open session (every read and
    write re-checks). The removed person is notified through the existing inbox."""
    removed = remove_shared(db, workspace, course, uid)
    if removed:
        try:
            notify(db, workspace, uid, owner_uid, display_name(db, workspace, owner_uid, "Someone"),
                   "course_share_remove", course["id"], course.get("courseName", ""))
        except Exception as e:  # noqa: BLE001
            logger.warning("remove notification failed: %s", e)
    return removed


def list_collaborators(db, workspace: str, course: dict, now: Optional[datetime] = None) -> dict:
    live = reconcile_course_invites(db, workspace, course, course["id"], now)
    collabs = [{"uid": s.get("uid"), "display_name": display_name(db, workspace, s.get("uid"), s.get("uid")),
                "accessType": s.get("accessType", ACCESS_VIEW), "status": "active"}
               for s in shared_entries(course) if s.get("uid")]
    pend = []
    for iid, d in live:
        pend.append({"id": iid, "email": d.get("email"), "access_type": d.get("access_type"), "status": PENDING,
                     "created_at": _iso(d.get("created_at")), "expires_at": _iso(d.get("expires_at"))})
    owner = {"uid": course.get("teacherUid"), "org": workspace}
    active, pending = slot_counts(course, live)
    allows = entitlements.owner_allows_coedit(course.get("teacherUid"), workspace, db)
    return {"collaborators": collabs, "pending_invites": pend, "cap": entitlements.collaborator_cap(owner, db),
            "used": active + pending, "active_collaborators": active, "pending_collaborate_invites": pending,
            "coediting_allowed": allows}


def _iso(v: Any) -> Optional[str]:
    v = accts.as_utc(v)
    return v.isoformat() if v else None


def delete_impact(db, workspace: str, course: dict) -> dict:
    live = reconcile_course_invites(db, workspace, course, course["id"])
    links = [s for s in share_links_col(db).where("course_id", "==", course["id"]).stream()
             if (s.to_dict() or {}).get("workspace") == workspace and not (s.to_dict() or {}).get("revoked_at")]
    return {"collaborators": len(shared_entries(course)), "pending_invites": len(live), "active_links": len(links)}


def on_course_deleted(db, workspace: str, course_id: str, now: Optional[datetime] = None) -> dict:
    """After the course doc is gone: cancel its pending invites and revoke its links. (Links and
    invites also re-check the course on every use, so a client-side delete is covered lazily.)"""
    now = now or _now()
    n_inv = n_links = 0
    for snap in _invite_docs_for_course(db, workspace, course_id):
        if (snap.to_dict() or {}).get("status") == PENDING:
            cancel_invite(db, snap.id, "course_deleted", now=now)
            n_inv += 1
    for snap in share_links_col(db).where("course_id", "==", course_id).stream():
        d = snap.to_dict() or {}
        if d.get("workspace") == workspace and not d.get("revoked_at"):
            share_links_col(db).document(snap.id).update({"revoked_at": now})
            n_links += 1
    return {"pending_invites_cancelled": n_inv, "links_revoked": n_links}


# ── accepting an invite ─────────────────────────────────────────────────────────────────────────

def find_invite_by_token(db, token: str) -> Optional[Tuple[str, dict]]:
    if not token or len(token) > 200:
        return None
    for snap in invites_col(db).where("token", "==", token).limit(1).stream():
        return snap.id, (snap.to_dict() or {})
    return None


def unavailable_invite(status: str) -> HTTPException:
    return HTTPException(status_code=410, detail={
        "code": "invite_unavailable", "status": status,
        "message": "This invitation is no longer valid. Ask the course owner to send a new one."})


def refresh_invite(db, invite_id: str, inv: dict, now: Optional[datetime] = None) -> Tuple[dict, Optional[dict]]:
    """Apply the lazy lapse rules to a pending invite; returns (possibly updated invite, course)."""
    course = load_course(db, inv.get("workspace"), inv.get("course_id"))
    if inv.get("status") == PENDING:
        problem = pending_problem(db, inv, course, now)
        if problem:
            cancel_invite(db, invite_id, problem[1], problem[0], now)
            inv = {**inv, "status": problem[0], "cancel_reason": problem[1]}
    return inv, course


def assert_email_matches(inv: dict, email: str) -> None:
    if (email or "").strip().lower() != inv.get("email"):
        raise HTTPException(status_code=403, detail={
            "code": "invite_email_mismatch",
            "message": f"This invitation was sent to {mask_email(inv.get('email'))}. Sign in with that email address to accept it.",
            "invited_email_hint": mask_email(inv.get("email"))})


def accept_invite(db, invite_id: str, inv: dict, uid: str, email: str, now: Optional[datetime] = None) -> dict:
    """The signed-in, verified user `uid` / `email` accepts. 403 invite_email_mismatch if the account's
    email differs from the invited one (decision: strict, so a forwarded link can't be used by someone
    else); 410 if the invite is cancelled/expired/used. Returns {course_id, workspace, access_type}."""
    now = now or _now()
    inv, course = refresh_invite(db, invite_id, inv, now)
    status = inv.get("status")
    if status == ACCEPTED:
        # idempotent for the same person while they still have access (page reload)
        if inv.get("accepted_uid") == uid and course and entry_for(course, uid):
            return {"course_id": inv["course_id"], "workspace": inv["workspace"], "access_type": inv["access_type"], "already_accepted": True}
        raise unavailable_invite(ACCEPTED)
    if status != PENDING:
        raise unavailable_invite(status)
    assert_email_matches(inv, email)
    if uid == inv.get("owner_uid"):
        raise HTTPException(status_code=400, detail={"code": "cannot_invite_self", "message": "You own this course."})
    ws = inv["workspace"]
    cur = entry_for(course, uid)
    if not (cur and cur.get("accessType") == ACCESS_COLLABORATE and inv["access_type"] == ACCESS_VIEW):
        add_shared(db, ws, course, uid, inv["access_type"])   # never downgrade collaborate -> view
    _set_invite(db, invite_id, {"status": ACCEPTED, "accepted_uid": uid, "accepted_at": now})
    final = (entry_for(course, uid) or {}).get("accessType", inv["access_type"])
    return {"course_id": inv["course_id"], "workspace": ws, "access_type": final, "already_accepted": False}


# ── view-only links ─────────────────────────────────────────────────────────────────────────────

def org_forbids_links(workspace: str, db=None) -> bool:
    if workspace == PERSONAL_SPACE_ID:
        return False
    return (get_org_info(workspace, db) or {}).get("allow_public_links") is False


def create_link(db, workspace: str, course: dict, owner_uid: str, now: Optional[datetime] = None) -> dict:
    now = now or _now()
    if org_forbids_links(workspace, db):
        raise HTTPException(status_code=403, detail={"code": "links_disabled_by_org", "message": "Your organization doesn't allow view-only links."})
    active = [s for s in share_links_col(db).where("course_id", "==", course["id"]).stream()
              if (s.to_dict() or {}).get("workspace") == workspace and not (s.to_dict() or {}).get("revoked_at")]
    if len(active) >= MAX_ACTIVE_LINKS_PER_COURSE:
        raise HTTPException(status_code=409, detail={"code": "link_limit_reached",
                                                     "message": f"This course already has {MAX_ACTIVE_LINKS_PER_COURSE} active links. Revoke one first."})
    token = new_token()
    doc = {"course_id": course["id"], "workspace": workspace, "owner_uid": owner_uid, "created_at": now,
           "revoked_at": None, "last_viewed_at": None, "view_count": 0}
    share_links_col(db).document(token).set(doc)
    return {"token": token, **doc}


def list_links(db, workspace: str, course_id: str) -> List[dict]:
    out = []
    for s in share_links_col(db).where("course_id", "==", course_id).stream():
        d = s.to_dict() or {}
        if d.get("workspace") != workspace:
            continue
        out.append({"token": s.id, "created_at": _iso(d.get("created_at")), "revoked_at": _iso(d.get("revoked_at")),
                    "last_viewed_at": _iso(d.get("last_viewed_at")), "view_count": int(d.get("view_count") or 0),
                    "active": not d.get("revoked_at")})
    out.sort(key=lambda x: x["created_at"] or "", reverse=True)
    return out


def revoke_link(db, workspace: str, course_id: str, token: str, now: Optional[datetime] = None) -> bool:
    """True if a link of this course was found (idempotent: revoking a revoked link is fine)."""
    snap = share_links_col(db).document(token).get()
    d = snap.to_dict() if snap.exists else None
    if not d or d.get("course_id") != course_id or d.get("workspace") != workspace:
        return False
    if not d.get("revoked_at"):
        share_links_col(db).document(token).update({"revoked_at": now or _now()})
    return True


# Course creation appends uploaded-file text to `objectives` ("ATTACHED MATERIALS:" + per-file "--- File:" blocks),
# and that string is also copied into outline fields. Anything from these markers on is the owner's private upload.
_UPLOAD_MARKERS = ("ATTACHED MATERIALS:", "\n--- File:")


def strip_upload_text(s: str) -> str:
    cut = len(s)
    for m in _UPLOAD_MARKERS:
        i = s.find(m)
        if i != -1:
            cut = min(cut, i)
    return s[:cut].rstrip()


def sanitize(value: Any) -> Any:
    """Drop private keys (emails, uids, sharing lists, internal/underscore fields, storage paths,
    extracted text, interpreted requirements) at any depth, and cut uploaded-file text out of strings."""
    if isinstance(value, str):
        return strip_upload_text(value)
    if isinstance(value, dict):
        return {k: sanitize(v) for k, v in value.items() if not (isinstance(k, str) and _PRIVATE_KEY_RE.search(k))}
    if isinstance(value, list):
        return [sanitize(v) for v in value]
    return value


def public_course_payload(db, link: dict, course: dict) -> dict:
    out = {k: sanitize(course[k]) for k in PUBLIC_COURSE_FIELDS if k in course}
    atts = []
    for a in course.get("courseAttachments") or []:
        if isinstance(a, dict) and a.get("isActive", True):
            atts.append({"filename": a.get("filename"), "fileType": a.get("fileType"), "description": a.get("description", "")})
    out["courseAttachments"] = atts           # names only: no URLs, storage paths or extracted text
    return {
        "read_only": True,
        "title": course.get("courseName", ""),
        "owner_display_name": display_name(db, link["workspace"], link["owner_uid"]),
        "course": out,
    }


def public_view(db, token: str, now: Optional[datetime] = None) -> Optional[dict]:
    """The read-only payload for a live link, else None (revoked, course deleted, owner deactivated,
    org forbids links, ownership changed, or no such token: one indistinguishable answer)."""
    if not token or len(token) > 200:
        return None
    snap = share_links_col(db).document(token).get()
    link = snap.to_dict() if snap.exists else None
    if not link or link.get("revoked_at"):
        return None
    ws = link.get("workspace")
    course = load_course(db, ws, link.get("course_id"))
    if course is None or course.get("teacherUid") != link.get("owner_uid"):
        return None
    if not entitlements.owner_allows_access(link.get("owner_uid"), ws, db) or org_forbids_links(ws, db):
        return None
    try:
        share_links_col(db).document(token).update({"last_viewed_at": now or _now(), "view_count": firestore.Increment(1)})
    except Exception as e:  # noqa: BLE001 -- a counter failure must not break viewing
        logger.warning("share link view counter failed: %s", e)
    return public_course_payload(db, link, course)
