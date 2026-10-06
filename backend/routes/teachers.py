# backend/routes/teachers.py
"""
API routes for teacher profiles and discovery
Handles profile management, course visibility, and teacher discovery
"""

from fastapi import APIRouter, Depends, HTTPException, status, Header
from typing import List, Optional
from datetime import datetime
import logging

from schemas.teacher_schema import (
    TeacherProfileCreate,
    TeacherProfileUpdate,
    TeacherProfileResponse,
    TeacherProfilePublic,
    TeacherProfileFields as TPF,
    CourseSharingFields as CSF,
    TEACHER_PROFILES_COLLECTION,
    COURSES_COLLECTION,
    create_default_profile,
    get_org_from_email,
)
from schemas.curriculum_schema import CurriculumFields as CF
import firebase_admin
from firebase_admin import auth, firestore
from firebase.paths import org_col, resolve_org

# Initialize logger
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/teachers", tags=["teachers"])


# ============================================================================
# DEPENDENCY: Firebase Auth Verification
# ============================================================================

async def verify_firebase_token(authorization: Optional[str] = Header(default=None)) -> dict:
    """
    Verify Firebase ID token from Authorization header

    Args:
        authorization: Bearer token from request header

    Returns:
        dict: Decoded token with user info (uid, email, name, etc.)

    Raises:
        HTTPException: 401 if the token is invalid, malformed, or missing
            entirely. `authorization` is intentionally Optional with no
            required header, so a fully-absent header 401s here instead of
            FastAPI auto-raising a 422 for a missing required param -- a
            caller with no credentials and a caller with a bad token should
            get the same, correct status code.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format. Expected 'Bearer <token>'"
        )

    try:
        token = authorization.split("Bearer ")[1]

        # Verify token with Firebase Admin SDK
        decoded_token = auth.verify_id_token(token)
        return decoded_token

    except Exception as e:
        logger.error(f"Token verification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication credentials: {str(e)}"
        )


async def require_org(current_user: dict = Depends(verify_firebase_token)) -> dict:
    """
    Shared org-scoping dependency (tasks/firestore-reorg-spec.md Round 2,
    section A): verifies the Firebase token, then resolves the caller's org
    from their token email via the Users/{org} registry. 403s with a fixed
    message if the email isn't registered with any org -- there is no default
    org to fall back to.

    Returns the decoded token with an added "org" key, so routes get both in
    one dependency: `current_user = Depends(require_org); org = current_user["org"]`.
    """
    org = get_org_from_email(current_user.get("email") or "")
    if not org:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your organization is not registered with EdCube",
        )
    return {**current_user, "org": org}


def require_org_for_uid(uid: str) -> str:
    """
    Non-token variant of require_org, for routes that still take a raw
    `teacherUid` instead of an Authorization header (see the TASK-008 list in
    this task's report -- those routes should move to `require_org` once the
    frontend sends a token). Same 403 contract and registry lookup, just
    resolved via the Admin SDK (uid -> email) instead of a decoded token.
    """
    org = resolve_org(uid)
    if not org:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your organization is not registered with EdCube",
        )
    return org


def get_firestore_client():
    """Get Firestore client instance"""
    return firestore.client()


# ============================================================================
# PROFILE MANAGEMENT ENDPOINTS
# ============================================================================

@router.get("/profile", response_model=TeacherProfileResponse)
async def get_own_profile(
    current_user: dict = Depends(require_org),
    db = Depends(get_firestore_client)
):
    """
    Get the authenticated teacher's own profile.
    Creates a default profile if one doesn't exist.

    Returns:
        TeacherProfileResponse: Complete profile data
    """
    teacher_uid = current_user["uid"]
    org = current_user["org"]

    try:
        # Try to get existing profile
        profile_ref = org_col(db, org, TEACHER_PROFILES_COLLECTION).document(teacher_uid)
        profile_doc = profile_ref.get()

        if profile_doc.exists:
            profile_data = profile_doc.to_dict()
            return TeacherProfileResponse(**profile_data)
        
        # Create default profile if doesn't exist
        default_profile = create_default_profile(current_user)
        profile_ref.set(default_profile)
        
        return TeacherProfileResponse(**default_profile)
        
    except Exception as e:
        logger.error(f"Error fetching profile for {teacher_uid}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch profile: {str(e)}"
        )


@router.put("/profile", response_model=TeacherProfileResponse)
async def update_own_profile(
    profile_update: TeacherProfileUpdate,
    current_user: dict = Depends(require_org),
    db = Depends(get_firestore_client)
):
    """
    Update the authenticated teacher's profile.
    Only updates fields that are provided (partial update).

    Args:
        profile_update: TeacherProfileUpdate with optional fields

    Returns:
        TeacherProfileResponse: Updated profile data
    """
    teacher_uid = current_user["uid"]
    org = current_user["org"]

    try:
        profile_ref = org_col(db, org, TEACHER_PROFILES_COLLECTION).document(teacher_uid)

        # Check if profile exists
        profile_doc = profile_ref.get()
        if not profile_doc.exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Profile not found. Please create a profile first by calling GET /profile."
            )
        
        # Prepare update data (only include non-None fields)
        update_data = profile_update.model_dump(exclude_unset=True, exclude_none=True)
        update_data[TPF.UPDATED_AT] = datetime.utcnow()
        
        # Update profile in Firestore
        profile_ref.update(update_data)
        
        # Return updated profile
        updated_doc = profile_ref.get()
        return TeacherProfileResponse(**updated_doc.to_dict())
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating profile for {teacher_uid}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update profile: {str(e)}"
        )


# ============================================================================
# PUBLIC PROFILE VIEWING
# ============================================================================

@router.get("/{teacher_uid}", response_model=TeacherProfilePublic)
async def get_teacher_profile(
    teacher_uid: str,
    current_user: dict = Depends(require_org),
    db = Depends(get_firestore_client)
):
    """
    Get any teacher's public profile by their UID.
    Includes count of their public courses.

    Args:
        teacher_uid: Firebase UID of the teacher to view

    Returns:
        TeacherProfilePublic: Public profile data with course count
    """
    try:
        # Sharing/public courses are same-org only (tasks/firestore-reorg-spec.md,
        # decision 3), so the caller's org is always the target teacher's org.
        org = current_user["org"]

        # Get teacher profile
        profile_ref = org_col(db, org, TEACHER_PROFILES_COLLECTION).document(teacher_uid)
        profile_doc = profile_ref.get()

        if not profile_doc.exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Teacher profile not found for UID: {teacher_uid}"
            )

        profile_data = profile_doc.to_dict()

        # Count public courses for this teacher
        courses_query = (
            org_col(db, org, COURSES_COLLECTION)
            .where(CF.TEACHER_UID, "==", teacher_uid)
            .where(CF.IS_PUBLIC, "==", True)
        )
        public_courses = list(courses_query.stream())
        
        # Build public response
        response_data = {
            "teacher_uid": profile_data[TPF.TEACHER_UID],
            "display_name": profile_data[TPF.DISPLAY_NAME],
            "subjects_taught": profile_data.get(TPF.SUBJECTS_TAUGHT, []),
            "grades_taught": profile_data.get(TPF.GRADES_TAUGHT, []),
            "bio": profile_data.get(TPF.BIO, ""),
            "profile_picture_url": profile_data.get(TPF.PROFILE_PICTURE_URL),
            "public_course_count": len(public_courses),
        }
        
        return TeacherProfilePublic(**response_data)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching public profile for {teacher_uid}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch teacher profile: {str(e)}"
        )


# ============================================================================
# DISCOVERY ENDPOINT
# ============================================================================

@router.get("/", response_model=List[TeacherProfilePublic])
async def list_all_teachers(
    current_user: dict = Depends(require_org),
    db = Depends(get_firestore_client)
):
    """
    Get all teacher profiles in the organization.
    Used for the discovery page to browse other teachers.

    Returns:
        List[TeacherProfilePublic]: List of all teacher profiles with public course counts
    """
    try:
        # Resolve the caller's org_id from their email domain
        caller_org_id = current_user["org"]
        profiles_query = org_col(db, caller_org_id, TEACHER_PROFILES_COLLECTION).where(TPF.ORG_ID, "==", caller_org_id)
        profiles = profiles_query.stream()

        result = []
        for profile_doc in profiles:
            profile_data = profile_doc.to_dict()
            teacher_uid = profile_data[TPF.TEACHER_UID]

            # Count public courses for each teacher
            courses_query = (
                org_col(db, caller_org_id, COURSES_COLLECTION)
                .where(CF.TEACHER_UID, "==", teacher_uid)
                .where(CF.IS_PUBLIC, "==", True)
            )
            public_courses = list(courses_query.stream())
            
            # Build public profile
            result.append(TeacherProfilePublic(
                teacher_uid=teacher_uid,
                display_name=profile_data[TPF.DISPLAY_NAME],
                subjects_taught=profile_data.get(TPF.SUBJECTS_TAUGHT, []),
                grades_taught=profile_data.get(TPF.GRADES_TAUGHT, []),
                bio=profile_data.get(TPF.BIO, ""),
                profile_picture_url=profile_data.get(TPF.PROFILE_PICTURE_URL),
                public_course_count=len(public_courses),
            ))
        
        return result
        
    except Exception as e:
        logger.error(f"Error listing teachers: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list teachers: {str(e)}"
        )


# ============================================================================
# PUBLIC COURSES FOR A TEACHER
# ============================================================================

@router.get("/{teacher_uid}/courses")
async def get_teacher_public_courses(
    teacher_uid: str,
    current_user: dict = Depends(require_org),
    db = Depends(get_firestore_client)
):
    """
    Get a teacher's public courses. Returns summary data for profile display,
    plus full sections/outline for viewing in the workspace.
    """
    try:
        org = current_user["org"]
        courses_query = (
            org_col(db, org, COURSES_COLLECTION)
            .where(CF.TEACHER_UID, "==", teacher_uid)
            .where(CF.IS_PUBLIC, "==", True)
        )
        docs = courses_query.stream()

        courses = []
        for doc in docs:
            data = doc.to_dict()
            courses.append({
                "id": doc.id,
                CF.COURSE_ID: data.get(CF.COURSE_ID),
                CF.COURSE_NAME: data.get(CF.COURSE_NAME),
                CF.SUBJECT: data.get(CF.SUBJECT),
                CF.TOPIC: data.get(CF.TOPIC),
                CF.CLASS: data.get(CF.CLASS),
                CF.TIME_DURATION: data.get(CF.TIME_DURATION),
                CF.OBJECTIVES: data.get(CF.OBJECTIVES, ''),
                CF.SECTIONS: data.get(CF.SECTIONS, []),
                CF.OUTLINE: data.get(CF.OUTLINE, {}),
                CF.CREATED_AT: data.get(CF.CREATED_AT),
                CF.LAST_MODIFIED: data.get(CF.LAST_MODIFIED),
            })

        # Sort by lastModified descending (avoids needing a composite index)
        courses.sort(key=lambda c: c.get(CF.LAST_MODIFIED) or "", reverse=True)

        return {"success": True, "courses": courses}

    except Exception as e:
        logger.error(f"Error fetching public courses for {teacher_uid}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch public courses: {str(e)}"
        )