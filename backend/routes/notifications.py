# backend/routes/notifications.py
"""
Notification routes — GET, POST (share), PATCH (mark read), DELETE
All endpoints require a valid Firebase ID token.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List
from .teachers import verify_firebase_token
from services.firebase_service import FirebaseService

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
async def get_notifications(current_user: dict = Depends(verify_firebase_token)):
    """Return all notifications for the authenticated user, newest first."""
    uid = current_user["uid"]
    notifs = await firebase.get_notifications(uid)
    return {"notifications": notifs}


@router.post("/share")
async def share_course(
    body: ShareCourseRequest,
    current_user: dict = Depends(verify_firebase_token)
):
    """Share a course with multiple users (view or collaborate access)."""
    from_uid = current_user["uid"]

    # Get sender display name from their profile
    profile_doc = firebase.db.collection("teacher_profiles").document(from_uid).get()
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
            access_type=recipient.access_type,
        )
        # Add recipient to sharedWith array in the curriculum document
        await firebase.add_shared_with(body.course_id, recipient.uid, recipient.access_type)

    return {"success": True, "shared_with": len(body.recipients)}


@router.patch("/{notif_id}/read")
async def mark_read(notif_id: str, current_user: dict = Depends(verify_firebase_token)):
    """Mark a single notification as read."""
    uid = current_user["uid"]
    ok = await firebase.mark_notification_read(notif_id, uid)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    return {"success": True}


@router.delete("/{notif_id}")
async def delete_notification(notif_id: str, current_user: dict = Depends(verify_firebase_token)):
    """Delete a notification."""
    uid = current_user["uid"]
    ok = await firebase.delete_notification(notif_id, uid)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    return {"success": True}
