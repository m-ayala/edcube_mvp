# backend/schemas/teacher_schema.py
"""
Teacher Profile Schema - Firebase Collections and Pydantic Models
Defines data structures for teacher profiles and sharing features
"""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime


# ============================================================================
# DOMAIN → ORG MAPPING
# Keep in sync with frontend/src/firebase/authService.js DOMAIN_ORG_MAP.
# Add a new entry here to onboard a new organization.
#
# 'gmail.com': 'icc'  ← temporary for local testing; remove before production
# ============================================================================

DOMAIN_ORG_MAP: dict[str, str] = {
    'indiacc.org': 'icc',
    'gmail.com':   'icc',  # TODO: remove after testing
}


def get_org_from_email(email: str) -> str:
    """Return the org_id for a given email, defaulting to 'icc' if domain unknown."""
    domain = email.split('@')[-1].lower()
    return DOMAIN_ORG_MAP.get(domain, 'icc')


# ============================================================================
# FIREBASE COLLECTION NAMES
# ============================================================================

TEACHER_PROFILES_COLLECTION = "teacher_profiles"
COURSES_COLLECTION = "curricula"  # Firestore collection for courses
COURSE_FOLDERS_COLLECTION = "course_folders"


# ============================================================================
# TEACHER PROFILE FIELDS (for Firebase documents)
# ============================================================================

class TeacherProfileFields:
    """Field names for teacher_profiles collection"""
    
    TEACHER_UID = "teacher_uid"
    DISPLAY_NAME = "display_name"
    EMAIL = "email"
    SUBJECTS_TAUGHT = "subjects_taught"  # Array of strings
    GRADES_TAUGHT = "grades_taught"      # Array of strings  
    BIO = "bio"
    PROFILE_PICTURE_URL = "profile_picture_url"
    ORG_ID = "org_id"
    CREATED_AT = "created_at"
    UPDATED_AT = "updated_at"


# ============================================================================
# COURSE SHARING FIELDS (add to existing courses collection)
# ============================================================================

class CourseSharingFields:
    """New fields to add to courses collection for sharing"""
    
    VISIBILITY = "visibility"  # "private" | "public"
    FOLDER_ID = "folder_id"    # Reference to course_folders collection


# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class TeacherProfileBase(BaseModel):
    """Base fields for teacher profile"""
    display_name: str = Field(..., min_length=1, max_length=100, description="Teacher's full name")
    subjects_taught: List[str] = Field(default_factory=list, max_items=20, description="Subjects like Math, Science")
    grades_taught: List[str] = Field(default_factory=list, max_items=10, description="Grades like 5th Grade, 6th Grade")
    bio: str = Field(default="", max_length=1000, description="Teacher bio/introduction")
    profile_picture_url: Optional[str] = Field(None, description="URL to profile picture")


class TeacherProfileCreate(TeacherProfileBase):
    """Model for creating a new teacher profile"""
    pass


class TeacherProfileUpdate(BaseModel):
    """Model for updating teacher profile - all fields optional"""
    display_name: Optional[str] = Field(None, min_length=1, max_length=100)
    subjects_taught: Optional[List[str]] = Field(None, max_items=20)
    grades_taught: Optional[List[str]] = Field(None, max_items=10)
    bio: Optional[str] = Field(None, max_length=1000)
    profile_picture_url: Optional[str] = None


class TeacherProfileResponse(TeacherProfileBase):
    """Model for returning complete teacher profile data"""
    teacher_uid: str
    email: str
    org_id: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class TeacherProfilePublic(BaseModel):
    """Simplified public view of teacher profile (for discovery page)"""
    teacher_uid: str
    display_name: str
    subjects_taught: List[str]
    grades_taught: List[str]
    bio: str
    profile_picture_url: Optional[str]
    public_course_count: int = Field(default=0, description="Number of public courses")
    
    class Config:
        from_attributes = True


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def create_default_profile(user_data: dict) -> dict:
    """
    Create default profile data from Firebase Auth user
    
    Args:
        user_data: Firebase Auth user dict with uid, email, name, picture
        
    Returns:
        dict: Default profile data ready for Firestore
    """
    return {
        TeacherProfileFields.TEACHER_UID: user_data["uid"],
        TeacherProfileFields.EMAIL: user_data["email"],
        TeacherProfileFields.DISPLAY_NAME: user_data.get("name", user_data.get("email", "").split("@")[0]),
        TeacherProfileFields.SUBJECTS_TAUGHT: [],
        TeacherProfileFields.GRADES_TAUGHT: [],
        TeacherProfileFields.BIO: "",
        TeacherProfileFields.PROFILE_PICTURE_URL: user_data.get("picture"),
        TeacherProfileFields.ORG_ID: get_org_from_email(user_data["email"]),
        TeacherProfileFields.CREATED_AT: datetime.utcnow(),
        TeacherProfileFields.UPDATED_AT: datetime.utcnow(),
    }