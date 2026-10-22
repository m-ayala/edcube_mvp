# backend/services/accounts_service.py
"""
Accounts (TASK-031): `Accounts/{uid}`, written by the backend only.

    email, email_domain
    plan ("trial"|"teacher"|"org"), plan_started_at, trial_ends_at,
    plan_source ("trial_default"|"admin"|"org_member")
    bonus_credits {courses, generates, edo_messages}
    is_admin (mirror of the `admin` custom claim)
    memberships [{workspace: "personal"}, {workspace: "<orgId>", role}]
    status ("active"|"deactivated"), deactivated_at, delete_after
    created_at

`plan` is the user's PERSONAL-workspace plan. In an org workspace the org's own
plan applies (see entitlements.py). Datetimes are timezone-aware UTC.

Reads are cached ~60s per uid (invalidated on every write made through this module).
"""

import logging
import math
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import firebase_admin

from firebase.paths import accounts_col, admin_audit_col
from firebase.public_space import (
    LEGACY_PLAN_MAP,
    PERSONAL_SPACE_ID,
    PERSONAL_SPACE_IDS,
    PLAN_ORG,
    PLAN_TEACHER,
    PLAN_TRIAL,
    PLANS,
)
from services import platform_config as pc

logger = logging.getLogger(__name__)

PLAN_SOURCE_TRIAL_DEFAULT = "trial_default"
PLAN_SOURCE_ADMIN = "admin"
# TASK-032: org staff get the Teacher plan free in their PERSONAL workspace. If they later
# leave the org (membership gone) the plan is deliberately left as is: no silent downgrade;
# an admin can change it (set_plan -> plan_source "admin").
PLAN_SOURCE_ORG_MEMBER = "org_member"
STATUS_ACTIVE = "active"
STATUS_DEACTIVATED = "deactivated"
ROLE_MEMBER = "member"

_TTL = 60
_cache: Dict[str, tuple] = {}   # uid -> (account dict | None, fetched_at)


def _db():
    if not firebase_admin._apps:
        firebase_admin.initialize_app()
    from firebase.project import firestore_client
    return firestore_client()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def invalidate(uid: str) -> None:
    _cache.pop(uid, None)


def clear_cache() -> None:
    _cache.clear()


def normalize_plan(plan: Optional[str]) -> str:
    """Map legacy names (free->trial, pro->teacher); unknown/None -> trial."""
    plan = LEGACY_PLAN_MAP.get(plan, plan)
    return plan if plan in PLANS else PLAN_TRIAL


def as_utc(v: Any) -> Optional[datetime]:
    """Firestore returns tz-aware datetimes; tolerate naive ones and ISO strings."""
    if v is None:
        return None
    if isinstance(v, str):
        v = datetime.fromisoformat(v.replace("Z", "+00:00"))
    if isinstance(v, datetime):
        return v if v.tzinfo else v.replace(tzinfo=timezone.utc)
    return None


def email_domain(email: str) -> str:
    email = (email or "").strip().lower()
    return email.rsplit("@", 1)[-1] if "@" in email else ""


def trial_end(started: datetime, db=None) -> datetime:
    return started + timedelta(days=pc.trial_length_days(db))


# ── reads ───────────────────────────────────────────────────────────────────

def get_account(uid: str, db=None, fresh: bool = False) -> Optional[Dict[str, Any]]:
    """The Accounts doc as a dict, or None if the user has none yet (pre-backfill)."""
    now = time.time()
    if not fresh:
        hit = _cache.get(uid)
        if hit is not None and (now - hit[1]) < _TTL:
            return hit[0]
    snap = accounts_col(db or _db()).document(uid).get()
    acct = (snap.to_dict() or {}) if snap.exists else None
    _cache[uid] = (acct, now)
    return acct


def is_deactivated(account: Optional[dict]) -> bool:
    return bool(account) and account.get("status") == STATUS_DEACTIVATED


def personal_plan(account: Optional[dict]) -> str:
    return normalize_plan((account or {}).get("plan"))


def trial_expired(account: Optional[dict], now: Optional[datetime] = None) -> bool:
    """True when the account is on trial and trial_ends_at has passed. A trial with no
    trial_ends_at recorded is treated as not expired."""
    if personal_plan(account) != PLAN_TRIAL:
        return False
    end = as_utc((account or {}).get("trial_ends_at"))
    return end is not None and (now or _now()) >= end


def public_view(account: Optional[dict]) -> Optional[dict]:
    """JSON-safe copy (ISO datetimes) for API responses."""
    if account is None:
        return None
    out = {}
    for k, v in account.items():
        out[k] = v.isoformat() if isinstance(v, datetime) else v
    return out


# ── writes ──────────────────────────────────────────────────────────────────

def _memberships(org_id: Optional[str]) -> List[dict]:
    m = [{"workspace": PERSONAL_SPACE_ID}]
    if org_id and org_id != PERSONAL_SPACE_ID:
        m.append({"workspace": org_id, "role": ROLE_MEMBER})
    return m


def ensure_account(uid: str, email: str, org_id: Optional[str] = None,
                   is_admin: bool = False, db=None, now: Optional[datetime] = None) -> Dict[str, Any]:
    """Idempotent create-or-backfill. A new account gets plan `trial` starting now (ends
    now + trial_length_days from config); if `org_id` is a real org the personal plan is
    `teacher` with plan_source `org_member` instead (TASK-032, free for org staff).
    An existing account keeps its plan/dates, except that an org member whose plan_source is
    not `admin` (and not already `org_member`) is moved to teacher / org_member. An admin-set
    plan is never overwritten, and losing org membership never downgrades. Other missing
    memberships, email fields and the admin mirror are filled in. Returns the doc."""
    db = db or _db()
    now = now or _now()
    ref = accounts_col(db).document(uid)
    snap = ref.get()
    email_l = (email or "").strip().lower()
    is_org_member = bool(org_id) and org_id not in PERSONAL_SPACE_IDS
    if not snap.exists:
        doc = {
            "email": email_l,
            "email_domain": email_domain(email_l),
            "plan": PLAN_TEACHER if is_org_member else PLAN_TRIAL,
            "plan_started_at": now,
            "trial_ends_at": None if is_org_member else trial_end(now, db),
            "plan_source": PLAN_SOURCE_ORG_MEMBER if is_org_member else PLAN_SOURCE_TRIAL_DEFAULT,
            "bonus_credits": {"courses": 0, "generates": 0, "edo_messages": 0},
            "is_admin": bool(is_admin),
            "memberships": _memberships(org_id),
            "status": STATUS_ACTIVE,
            "deactivated_at": None,
            "delete_after": None,
            "created_at": now,
        }
        ref.set(doc)
        invalidate(uid)
        return doc

    doc = snap.to_dict() or {}
    patch: Dict[str, Any] = {}
    if email_l and doc.get("email") != email_l:
        patch["email"], patch["email_domain"] = email_l, email_domain(email_l)
    if bool(doc.get("is_admin")) != bool(is_admin):
        patch["is_admin"] = bool(is_admin)
    if is_org_member and doc.get("plan_source") not in (PLAN_SOURCE_ADMIN, PLAN_SOURCE_ORG_MEMBER):
        patch.update({"plan": PLAN_TEACHER, "plan_started_at": now, "trial_ends_at": None,
                      "plan_source": PLAN_SOURCE_ORG_MEMBER})
    have = {m.get("workspace") for m in doc.get("memberships") or []}
    missing = [m for m in _memberships(org_id) if m["workspace"] not in have]
    if missing:
        patch["memberships"] = list(doc.get("memberships") or []) + missing
    for key, default in (("status", STATUS_ACTIVE), ("bonus_credits", {"courses": 0, "generates": 0, "edo_messages": 0})):
        if key not in doc:
            patch[key] = default
    if patch:
        ref.update(patch)
        doc.update(patch)
    invalidate(uid)
    return doc


def set_plan(uid: str, plan: str, started_at: Optional[datetime] = None, db=None,
             source: str = PLAN_SOURCE_ADMIN) -> Dict[str, Any]:
    """Set the plan (admin override) and recompute the dates: plan_started_at = started_at or now;
    trial_ends_at = start + trial_length_days for trial, else None."""
    if plan not in PLANS:
        raise ValueError(f"unknown plan: {plan}")
    db = db or _db()
    started = as_utc(started_at) or _now()
    patch = {
        "plan": plan,
        "plan_started_at": started,
        "trial_ends_at": trial_end(started, db) if plan == PLAN_TRIAL else None,
        "plan_source": source,
    }
    accounts_col(db).document(uid).update(patch)
    invalidate(uid)
    return patch


def add_bonus_credits(uid: str, courses: int = 0, generates: int = 0, edo_messages: int = 0, db=None) -> Dict[str, int]:
    db = db or _db()
    ref = accounts_col(db).document(uid)
    cur = (ref.get().to_dict() or {}).get("bonus_credits") or {}
    new = {
        "courses": int(cur.get("courses") or 0) + int(courses or 0),
        "generates": int(cur.get("generates") or 0) + int(generates or 0),
        "edo_messages": int(cur.get("edo_messages") or 0) + int(edo_messages or 0),
    }
    ref.update({"bonus_credits": new})
    invalidate(uid)
    return new


def deactivate(uid: str, db=None, now: Optional[datetime] = None) -> Dict[str, Any]:
    """Immediately deactivate; restorable until delete_after (now + grace days from config)."""
    db = db or _db()
    now = now or _now()
    patch = {
        "status": STATUS_DEACTIVATED,
        "deactivated_at": now,
        "delete_after": now + timedelta(days=pc.deactivation_grace_days(db)),
    }
    accounts_col(db).document(uid).update(patch)
    invalidate(uid)
    return patch


def reactivate(uid: str, db=None, now: Optional[datetime] = None, enforce_grace: bool = True) -> str:
    """Returns 'reactivated' | 'already_active' | 'grace_expired'."""
    db = db or _db()
    now = now or _now()
    ref = accounts_col(db).document(uid)
    doc = ref.get().to_dict() or {}
    if doc.get("status") != STATUS_DEACTIVATED:
        return "already_active"
    end = as_utc(doc.get("delete_after"))
    if enforce_grace and end is not None and now > end:
        return "grace_expired"
    ref.update({"status": STATUS_ACTIVE, "deactivated_at": None, "delete_after": None})
    invalidate(uid)
    return "reactivated"


def log_admin_action(admin: dict, action: str, target_uid: str, before: Any, after: Any, db=None) -> str:
    """AdminAudit/{autoId}. `admin` is the decoded admin token (or {'uid': 'script'})."""
    db = db or _db()
    ref = admin_audit_col(db).document()
    ref.set({
        "admin_uid": admin.get("uid"),
        "admin_email": admin.get("email"),
        "action": action,
        "target_uid": target_uid,
        "before": before,
        "after": after,
        "at": _now(),
    })
    return ref.id


def summary(account: Optional[dict], now: Optional[datetime] = None) -> dict:
    """The account fields the client needs (JSON-safe). Safe for a missing account."""
    a = account or {}
    now = now or _now()
    end = as_utc(a.get("trial_ends_at"))
    plan = personal_plan(a)
    days_left = None
    if plan == PLAN_TRIAL and end is not None:
        days_left = max(0, math.ceil((end - now).total_seconds() / 86400))
    pv = public_view(a) or {}
    return {
        "plan": plan,
        "plan_source": a.get("plan_source"),
        "plan_started_at": pv.get("plan_started_at"),
        "trial_ends_at": pv.get("trial_ends_at"),
        "trial_expired": trial_expired(a, now),
        "trial_days_left": days_left,
        "status": a.get("status") or STATUS_ACTIVE,
        "deactivated_at": pv.get("deactivated_at"),
        "delete_after": pv.get("delete_after"),
        "bonus_credits": a.get("bonus_credits") or {"courses": 0, "generates": 0, "edo_messages": 0},
        "is_admin": bool(a.get("is_admin")),
    }
