# backend/routes/notifications.py
"""
Notification routes — GET, POST (share), POST (delete-seen), DELETE
All endpoints require a valid Firebase ID token.

Notifications are delete-on-seen (tasks/firestore-reorg-spec.md, decision 6):
there's no `status` field and no `/read` endpoint anymore. The frontend bell
loads the list via GET / and then calls POST /seen with the ids it just
displayed, which deletes them server-side.
"""

import threading
import time
from collections import deque
from typing import Deque, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from firebase_admin import auth as fb_auth
from .teachers import require_org
from services.firebase_service import FirebaseService
from firebase.paths import org_col
from services import entitlements
from schemas.teacher_schema import TEACHER_PROFILES_COLLECTION, TEACHERS_COLLECTION, PERSONAL_SPACE_ID

router = APIRouter(prefix="/api/notifications", tags=["notifications"])
firebase = FirebaseService()


class ShareRecipient(BaseModel):
    uid: str
    access_type: str  # "view" or "collaborate"


class ShareCourseRequest(BaseModel):
    course_id: str
    course_name: str
    recipients: List[ShareRecipient] = []
    # Public space only: invite by account email. `access_type` applies to these.
    recipient_emails: List[str] = []
    access_type: str = "view"  # "view" or "collaborate"; used for recipient_emails only


# ── Invite-by-email guards (public space) ────────────────────────────────────
MAX_EMAILS_PER_REQUEST = 20
LOOKUPS_PER_WINDOW = 30
LOOKUP_WINDOW_SECONDS = 60
_lookup_log: Dict[str, Deque[float]] = {}
_lookup_lock = threading.Lock()


def _charge_email_lookups(uid: str, n: int) -> None:
    """
    Per-uid sliding-window limit on email->account lookups (in-memory, per
    process): LOOKUPS_PER_WINDOW per LOOKUP_WINDOW_SECONDS, each email counts as
    one. Raises 429 {"detail": {"code": "rate_limited"}} without recording the
    rejected attempt.
    """
    now = time.monotonic()
    with _lookup_lock:
        log = _lookup_log.setdefault(uid, deque())
        while log and now - log[0] > LOOKUP_WINDOW_SECONDS:
            log.popleft()
        if len(log) + n > LOOKUPS_PER_WINDOW:
            retry = int(LOOKUP_WINDOW_SECONDS - (now - log[0])) + 1 if log else LOOKUP_WINDOW_SECONDS
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={"code": "rate_limited"},
                headers={"Retry-After": str(max(retry, 1))},
            )
        log.extend([now] * n)
        if len(_lookup_log) > 5000:  # opportunistic cleanup of idle uids
            for k in [k for k, v in _lookup_log.items() if not v or now - v[-1] > LOOKUP_WINDOW_SECONDS]:
                _lookup_log.pop(k, None)


def _resolve_public_email(email: str) -> Optional[str]:
    """
    Email -> uid of a member of the public space, else None. "No account" and
    "account exists but isn't in the public space" (e.g. an org user) are
    deliberately indistinguishable to the caller.
    """
    try:
        uid = fb_auth.get_user_by_email(email).uid
    except (fb_auth.UserNotFoundError, ValueError):
        return None
    except Exception as e:  # Auth backend trouble: don't report it as "not found"
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Could not look up that email right now")
    if org_col(firebase.db, PERSONAL_SPACE_ID, TEACHERS_COLLECTION).document(uid).get().exists:
        return uid
    return None


@router.get("/")
async def get_notifications(current_user: dict = Depends(require_org)):
    """Return all notifications for the authenticated user, newest first."""
    try:
        uid = current_user["uid"]
        org = current_user["org"]
        notifs = await firebase.get_notifications(uid, org)
        return {"notifications": notifs}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/share")
async def share_course(
    body: ShareCourseRequest,
    current_user: dict = Depends(require_org)
):
    """Share a course with multiple users (view or collaborate access)."""
    from_uid = current_user["uid"]
    org = current_user["org"]

    # Ownership: only the course owner may share it.
    course_doc = firebase.curricula_col(org).document(body.course_id).get()
    if not course_doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    if (course_doc.to_dict() or {}).get("teacherUid") != from_uid:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the course owner can share this course")

    # Plan gate (TASK-031): view-only shares are `share_link_create`, collaborate shares are
    # `invite_collaborator` (plan flag + per-course cap). Expired trial -> 402 plan_inactive.
    course_data = course_doc.to_dict() or {}
    types = {r.access_type for r in body.recipients} | ({body.access_type} if body.recipient_emails else set())
    wants_collab = "collaborate" in types
    wants_view = any(t != "collaborate" for t in types)
    if wants_view:
        entitlements.enforce(current_user, entitlements.SHARE_LINK_CREATE, course_data)
    if wants_collab:
        entitlements.enforce(current_user, entitlements.INVITE_COLLABORATOR, course_data)

    is_public = org == PERSONAL_SPACE_ID
    emails: List[str] = []
    email_uids: List[str] = []
    not_found: List[str] = []

    if body.recipient_emails and not is_public:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inviting by email is not available for your organization",
        )

    if is_public:
        if any(r.uid == from_uid for r in body.recipients):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail={"code": "cannot_share_with_self", "message": "You can't share a course with yourself"})
        if body.recipient_emails:
            if body.access_type not in ("view", "collaborate"):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="access_type must be 'view' or 'collaborate'")
            if len(body.recipient_emails) > MAX_EMAILS_PER_REQUEST:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                    detail={"code": "too_many_emails", "max": MAX_EMAILS_PER_REQUEST})
            # normalise + de-dupe, preserving order
            emails = list(dict.fromkeys(e.strip().lower() for e in body.recipient_emails if e and e.strip()))
            own_email = (current_user.get("email") or "").strip().lower()
            if own_email and own_email in emails:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                    detail={"code": "cannot_share_with_self", "message": "You can't share a course with yourself"})
            _charge_email_lookups(from_uid, len(emails))
            for e in emails:
                uid = _resolve_public_email(e)
                if uid is None:
                    not_found.append(e)
                elif uid == from_uid:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                        detail={"code": "cannot_share_with_self", "message": "You can't share a course with yourself"})
                elif uid not in email_uids:
                    email_uids.append(uid)

    # Recipients must be teachers in the caller's own org (validated before any write).
    unknown = [
        r.uid for r in body.recipients
        if not org_col(firebase.db, org, TEACHER_PROFILES_COLLECTION).document(r.uid).get().exists
    ]
    if unknown:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more recipients are not teachers in your organization",
        )

    # Get sender display name from their profile
    profile_doc = org_col(firebase.db, org, TEACHER_PROFILES_COLLECTION).document(from_uid).get()
    from_name = profile_doc.to_dict().get("display_name", "Someone") if profile_doc.exists else "Someone"

    recipients = list(body.recipients)
    have = {r.uid for r in recipients}
    recipients += [ShareRecipient(uid=u, access_type=body.access_type) for u in email_uids if u not in have]

    for recipient in recipients:
        notif_type = (
            "course_share_collaborate" if recipient.access_type == "collaborate"
            else "course_share_view"
        )
        await firebase.create_notification(
            to_uid=recipient.uid,
            from_uid=from_uid,
            from_name=from_name,
            notif_type=notif_type,
            course_id=body.course_id,
            course_name=body.course_name,
            org=org,
            access_type=recipient.access_type,
        )
        # Add recipient to sharedWith array in the curriculum document
        await firebase.add_shared_with(body.course_id, recipient.uid, recipient.access_type, org=org)

    result = {"success": True, "shared_with": len(recipients)}
    if is_public:
        result["shared"] = [r.uid for r in recipients]
        result["not_found"] = not_found
    return result


class DeleteSeenRequest(BaseModel):
    notification_ids: List[str]


@router.post("/seen")
async def delete_seen_notifications(
    body: DeleteSeenRequest,
    current_user: dict = Depends(require_org)
):
    """
    Delete a batch of notifications after the bell has loaded and displayed
    them (delete-on-seen — replaces the old PATCH /{notif_id}/read).
    """
    uid = current_user["uid"]
    org = current_user["org"]
    deleted = await firebase.delete_seen_notifications(uid, org, body.notification_ids)
    return {"success": True, "deleted": deleted}


@router.delete("/{notif_id}")
async def delete_notification(notif_id: str, current_user: dict = Depends(require_org)):
    """Delete a single notification."""
    uid = current_user["uid"]
    org = current_user["org"]
    ok = await firebase.delete_notification(notif_id, uid, org)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    return {"success": True}
