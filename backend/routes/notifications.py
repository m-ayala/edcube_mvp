# backend/routes/notifications.py
"""
Notification routes — GET, PATCH (mark read), DELETE
All endpoints require a valid Firebase ID token.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from .teachers import verify_firebase_token
from services.firebase_service import FirebaseService

router = APIRouter(prefix="/api/notifications", tags=["notifications"])
firebase = FirebaseService()


@router.get("/")
async def get_notifications(current_user: dict = Depends(verify_firebase_token)):
    """Return all notifications for the authenticated user, newest first."""
    uid = current_user["uid"]
    notifs = await firebase.get_notifications(uid)
    return {"notifications": notifs}


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
