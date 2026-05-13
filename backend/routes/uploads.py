"""
File upload routes — profile pictures and (later) block attachments.
All uploads go server-side to Firebase Storage to avoid browser CORS issues.
"""

import os
import time
import logging
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from routes.teachers import verify_firebase_token
from services.firebase_service import FirebaseService

router = APIRouter()
firebase = FirebaseService()
logger = logging.getLogger(__name__)

ALLOWED_IMAGE_TYPES = {'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'}
MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 5 MB


@router.post("/api/upload/profile-picture")
async def upload_profile_picture(
    file: UploadFile = File(...),
    current_user: dict = Depends(verify_firebase_token),
):
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Only JPG, PNG, WebP, or GIF images are allowed")

    data = await file.read()
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=400, detail="Image must be under 5 MB")

    uid = current_user["uid"]
    ext = os.path.splitext(file.filename or "")[1].lower() or ".jpg"
    safe_name = f"{int(time.time() * 1000)}{ext}"
    path = f"profile_pictures/{uid}/{safe_name}"

    try:
        url = await firebase.upload_file(data, path, file.content_type)
        logger.info(f"Profile picture uploaded for uid={uid}: {path}")
        return {"url": url}
    except Exception as e:
        logger.error(f"Profile picture upload failed for uid={uid}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Upload failed. Please try again.")
