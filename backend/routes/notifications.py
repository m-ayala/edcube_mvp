# backend/routes/notifications.py
"""
Notification routes — GET, POST (share), POST (delete-seen), DELETE
All endpoints require a valid Firebase ID token.

Notifications are delete-on-seen (tasks/firestore-reorg-spec.md, decision 6):
there's no `status` field and no `/read` endpoint anymore. The frontend bell
loads the list via GET / and then calls POST /seen with the ids it just
displayed, which deletes them server-side.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List
from .teachers import require_org
from services.firebase_service import FirebaseService
from firebase.paths import org_col
from schemas.teacher_schema import TEACHER_PROFILES_COLLECTION

router = APIRouter(prefix="/api/notifications", tags=["notifications"])
firebase = FirebaseService()


class ShareRecipient(BaseModel):
    uid: str
    access_type: str  # "view" or "collaborate"


class ShareCourseRequest(BaseModel):
    course_id: str
    course_name: str
    recipients: List[ShareRecipient]


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

    # Get sender display name from their profile
    profile_doc = org_col(firebase.db, org, TEACHER_PROFILES_COLLECTION).document(from_uid).get()
    from_name = profile_doc.to_dict().get("display_name", "Someone") if profile_doc.exists else "Someone"

    for recipient in body.recipients:
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

    return {"success": True, "shared_with": len(body.recipients)}


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
