# backend/routes/teachers.py
"""
API routes for teacher profiles and discovery
Handles profile management, course visibility, and teacher discovery
"""

from fastapi import APIRouter, Depends, HTTPException, status, Header, Query
from typing import List, Optional
from datetime import datetime
import base64
import json
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
    PERSONAL_SPACE_ID,
    ORG_CLAIM,
    PROFILE_NAME_LOWER,
)
from firebase.public_space import PERSONAL_SPACE_IDS, ADMIN_CLAIM
from services import accounts_service
from schemas.curriculum_schema import CurriculumFields as CF
import firebase_admin
from firebase_admin import auth, firestore
from firebase.paths import org_col, resolve_org, is_personal_member
from firebase.project import firestore_client

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


WORKSPACE_HEADER = "X-EdCube-Workspace"


def _resolve_workspace(current_user: dict, requested: Optional[str], allow_deactivated: bool = False) -> dict:
    """
    Resolve which workspace this request acts in (TASK-031) and return the decoded
    token plus:
        org             the resolved workspace id: "personal" or an orgId (existing
                        routes keep reading current_user["org"])
        workspace_type  "personal" | "org"
        home_org        the caller's org (from the registry) or None
        is_admin        the `admin` custom claim

    Rules
    - header `X-EdCube-Workspace: personal|<orgId>` (client's choice): the caller must be
      a member -- "personal" needs a bootstrapped personal workspace, an orgId must be the
      org their email matches. Otherwise 403.
    - no header: org members default to their org (exactly the pre-TASK-031 behaviour),
      everyone else to personal (must be bootstrapped, else 403 as before).
    - a deactivated account is rejected (403 account_deactivated) unless allow_deactivated.
    """
    if current_user.get("email_verified") is not True:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email address before using EdCube",
        )
    uid = current_user["uid"]
    home_org = get_org_from_email(current_user.get("email") or "")
    req = (requested or "").strip()
    if req.lower() in PERSONAL_SPACE_IDS:   # also accepts the pre-rename "public"
        req = PERSONAL_SPACE_ID

    if req:
        if req == PERSONAL_SPACE_ID:
            if not is_personal_member(uid, current_user):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                                    detail="Your personal workspace isn't set up yet")
            workspace = PERSONAL_SPACE_ID
        elif home_org and req == home_org:
            workspace = home_org
        else:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                                detail="You are not a member of that workspace")
    elif home_org:
        workspace = home_org
    elif is_personal_member(uid, current_user):
        # Bootstrapped personal user (claim, or teachers doc for tokens issued
        # before the claim refreshed). An org match above always wins.
        workspace = PERSONAL_SPACE_ID
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your organization is not registered with EdCube",
        )

    if not allow_deactivated:
        try:
            account = accounts_service.get_account(uid)
        except Exception as e:  # noqa: BLE001 -- infra trouble must not lock everyone out
            logger.warning("account status check failed open (%s): %s", uid, e)
            account = None
        if accounts_service.is_deactivated(account):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "account_deactivated",
                    "message": "This account is deactivated. Reactivate it to continue.",
                    "delete_after": accounts_service.public_view(account).get("delete_after"),
                },
            )

    return {
        **current_user,
        "org": workspace,
        "workspace_type": "personal" if workspace == PERSONAL_SPACE_ID else "org",
        "home_org": home_org,
        "is_admin": current_user.get(ADMIN_CLAIM) is True,
    }


async def require_workspace(
    current_user: dict = Depends(verify_firebase_token),
    x_edcube_workspace: Optional[str] = Header(default=None),
) -> dict:
    """Workspace-aware dependency (see _resolve_workspace). Honors X-EdCube-Workspace."""
    return _resolve_workspace(current_user, x_edcube_workspace)


async def require_workspace_lenient(
    current_user: dict = Depends(verify_firebase_token),
    x_edcube_workspace: Optional[str] = Header(default=None),
) -> dict:
    """Like require_workspace but lets a deactivated account through (account/me, reactivate)."""
    return _resolve_workspace(current_user, x_edcube_workspace, allow_deactivated=True)


async def require_org(current_user: dict = Depends(require_workspace)) -> dict:
    """
    Compatibility wrapper kept under its original name: every existing route uses
    `current_user = Depends(require_org); org = current_user["org"]`. It is now
    workspace-aware (header `X-EdCube-Workspace`), and with no header behaves exactly as
    before (org members -> their org, bootstrapped others -> the personal workspace).
    """
    return current_user


async def require_admin(current_user: dict = Depends(verify_firebase_token)) -> dict:
    """Platform admin: verified token carrying the custom claim `admin: true`. 403 otherwise."""
    if current_user.get(ADMIN_CLAIM) is not True or current_user.get("email_verified") is not True:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


def resolve_caller_uid(current_user: dict, claimed_uid: Optional[str] = None) -> str:
    """
    Backward-compat helper for routes whose clients still send a raw
    `teacherUid` / `teacher_uid`. The token is the source of truth: a claimed
    uid is optional, but if present it must equal the token uid (else 403).
    Returns the token uid.
    """
    uid = current_user["uid"]
    if claimed_uid and claimed_uid != uid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="teacherUid does not match the authenticated user",
        )
    return uid


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
    return firestore_client()


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
            if org == PERSONAL_SPACE_ID:
                profile_data.pop(TPF.EMAIL, None)  # public profiles never expose email
            return TeacherProfileResponse(**profile_data)
        
        # Create default profile if doesn't exist
        default_profile = create_default_profile(current_user, org)
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
        if org == PERSONAL_SPACE_ID and TPF.DISPLAY_NAME in update_data:
            update_data[PROFILE_NAME_LOWER] = update_data[TPF.DISPLAY_NAME].lower()
        
        # Update profile in Firestore
        profile_ref.update(update_data)
        
        # Return updated profile
        updated_doc = profile_ref.get()
        updated_data = updated_doc.to_dict()
        if org == PERSONAL_SPACE_ID:
            updated_data.pop(TPF.EMAIL, None)
        return TeacherProfileResponse(**updated_data)
        
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
        if org == PERSONAL_SPACE_ID and teacher_uid != current_user["uid"]:
            # TASK-036: there is no teacher directory in the personal workspace any more, so another
            # person's profile is not browsable (people reach each other through links and invites).
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Teacher profile not found for UID: {teacher_uid}")

        # Get teacher profile
        profile_ref = org_col(db, org, TEACHER_PROFILES_COLLECTION).document(teacher_uid)
        profile_doc = profile_ref.get()

        if not profile_doc.exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Teacher profile not found for UID: {teacher_uid}"
            )

        profile_data = profile_doc.to_dict()

        # Count public courses for this teacher (always 0 in the personal workspace: retired in TASK-036)
        if org == PERSONAL_SPACE_ID:
            public_courses = []
        else:
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

PUBLIC_LIST_DEFAULT_LIMIT = 20
PUBLIC_LIST_MAX_LIMIT = 50


@router.get("/", response_model=None)
async def list_all_teachers(
    q: Optional[str] = Query(default=None, description="public space only: name prefix"),
    limit: int = Query(default=PUBLIC_LIST_DEFAULT_LIMIT, description="public space only; clamped to 1..50"),
    cursor: Optional[str] = Query(default=None, description="public space only: opaque next_cursor"),
    current_user: dict = Depends(require_org),
    db = Depends(get_firestore_client)
):
    """
    Org callers: unchanged -- a bare List[TeacherProfilePublic] of every teacher
    in the org (q / limit / cursor are ignored).

    Personal-workspace callers (TASK-036): the public teacher directory/search is RETIRED. The response
    keeps its old shape, {"teachers": [], "next_cursor": null}, and exposes nobody: people share through
    view-only links and invites instead.
    """
    try:
        # Resolve the caller's org_id from their email domain
        caller_org_id = current_user["org"]
        if caller_org_id == PERSONAL_SPACE_ID:
            return {"teachers": [], "next_cursor": None}

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

    except HTTPException:
        raise
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
        if org == PERSONAL_SPACE_ID:
            # TASK-036: no public courses in the personal workspace; nothing is browsable by others.
            return {"success": True, "courses": []}
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