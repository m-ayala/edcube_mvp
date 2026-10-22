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


# ── Invite-by-email (personal workspace) ────────────────────────────────────
# Folded into the invite flow in routes/sharing.py + services/sharing_service.py (TASK-036). The old
# existing-users-only email lookup (and its in-memory limiter) is gone: an email with no account now
# gets a pending invite, and invites are rate limited per owner (sharing_service.INVITE_LIMITER).
MAX_EMAILS_PER_REQUEST = 20


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

    if org == PERSONAL_SPACE_ID:
        return await _share_personal(body, current_user, course_doc.to_dict() or {})

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

    # Org workspace: unchanged from before TASK-036 (uid recipients only; emails are a personal-workspace feature).
    if body.recipient_emails:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inviting by email is not available for your organization",
        )

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

    return {"success": True, "shared_with": len(recipients)}


async def _share_personal(body: ShareCourseRequest, current_user: dict, course: dict) -> dict:
    """
    Thin alias onto the invite flow (TASK-036) so the current frontend keeps working until TASK-037.
    Personal workspace only; org sharing below is untouched.
      recipient_emails -> sharing_service.invite_by_email: an existing account is added directly (and
                          notified), anyone else gets a pending invite email. Capped per owner's plan,
                          pending invites counted.
      recipients (uids) -> gated one by one against the same cap, then added and notified.
    Response keeps the old keys (success, shared_with, shared, not_found) and adds `invited` and `results`.
    """
    from services import sharing_service as ss
    from routes.sharing import _send_invite_email
    db = firebase.db
    ws, from_uid = current_user["org"], current_user["uid"]
    course = {**course, "id": body.course_id}
    if any(r.uid == from_uid for r in body.recipients):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail={"code": "cannot_share_with_self", "message": "You can't share a course with yourself"})
    emails: List[str] = []
    if body.recipient_emails:
        if body.access_type not in ("view", "collaborate"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="access_type must be 'view' or 'collaborate'")
        if len(body.recipient_emails) > MAX_EMAILS_PER_REQUEST:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail={"code": "too_many_emails", "max": MAX_EMAILS_PER_REQUEST})
        emails = list(dict.fromkeys(e.strip().lower() for e in body.recipient_emails if e and e.strip()))

    unknown = [r.uid for r in body.recipients
               if not org_col(db, ws, TEACHER_PROFILES_COLLECTION).document(r.uid).get().exists]
    if unknown:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="One or more recipients don't have an EdCube account")

    results, shared, invited = [], [], []
    for r in body.recipients:                       # uid recipients: gate each one against the live cap
        if not ss.entry_for(course, r.uid) or ss.entry_for(course, r.uid).get("accessType") != r.access_type:
            live = ss.reconcile_course_invites(db, ws, course, body.course_id)
            ss.gate_invite(db, current_user, course, r.access_type, live)
        prev = ss.entry_for(course, r.uid)
        prev = dict(prev) if prev else None
        ss.add_shared(db, ws, course, r.uid, r.access_type)
        if r.access_type == "collaborate":   # same post-write cap recheck as the invite route
            ss._guard_after_write(db, current_user, course, [], rollback=lambda r=r, prev=prev: (
                ss.add_shared(db, ws, course, r.uid, prev["accessType"]) if prev else ss.remove_shared(db, ws, course, r.uid)))
        ss.notify(db, ws, r.uid, from_uid, ss.display_name(db, ws, from_uid, "Someone"),
                  "course_share_collaborate" if r.access_type == "collaborate" else "course_share_view",
                  body.course_id, body.course_name, r.access_type)
        shared.append(r.uid)
        results.append({"uid": r.uid, "status": "added", "access_type": r.access_type})
    for e in emails:
        ss.throttle(ss.INVITE_LIMITER, f"invite:{from_uid}")
        res = ss.invite_by_email(db, current_user, course, e, body.access_type)
        item = {"email": res["email"], "status": res["status"], "access_type": res["access_type"]}
        if res["status"] == "invited":
            item.update(await _send_invite_email(db, ws, from_uid, course, res["invite_id"], res["invite"], current_user))
            invited.append(res["email"])
        elif res.get("uid"):
            shared.append(res["uid"])
        results.append(item)
    return {"success": True, "shared_with": len(shared) + len(invited), "shared": shared,
            "not_found": [], "invited": invited, "results": results}


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
