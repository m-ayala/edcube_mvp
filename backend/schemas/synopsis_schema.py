# backend/schemas/synopsis_schema.py
"""
Synopsis Schema - Single Source of Truth for Field Names
⚠️ CRITICAL: Keep in sync with frontend/src/constants/synopsisSchema.js
Any changes here MUST be reflected in the frontend constants file.
"""

from typing import Dict, List, Optional
from pydantic import BaseModel


class SynopsisWeekFields:
    """Field names for synopsis_weeks documents in Firestore"""
    WEEK_ID = 'week_id'
    LABEL = 'label'
    START_DATE = 'start_date'
    END_DATE = 'end_date'
    IS_ACTIVE = 'is_active'
    IS_VISIBLE = 'is_visible'
    DRIVE_LINK = 'drive_link'
    CREATED_BY = 'created_by'
    CREATED_AT = 'created_at'


class SynopsisCampFields:
    """Field names for synopsis_camps documents in Firestore"""
    CAMP_ID = 'camp_id'
    WEEK_ID = 'week_id'
    GROUP_NAME = 'group_name'   # e.g. "Junior Robotics, Art, & Sports Camp"
    CAMP_NAME = 'camp_name'     # e.g. "Junior Robotics"
    AGE_GROUP = 'age_group'     # e.g. "Ages 5–8" or "Grades 1–3"
    TEACHER_NAME = 'teacher_name'
    TIME_START = 'time_start'   # e.g. "9:00 AM"
    TIME_END = 'time_end'       # e.g. "12:00 PM"
    CREATED_AT = 'created_at'


class SynopsisEntryFields:
    """Field names for synopsis_entries documents in Firestore"""
    ENTRY_ID = 'entry_id'
    CAMP_ID = 'camp_id'
    WEEK_ID = 'week_id'
    DAY = 'day'
    DAY_TITLE = 'day_title'
    RAW_TEXT = 'raw_text'
    POLISHED_TEXT = 'polished_text'
    PHOTO_URLS = 'photo_urls'
    STATUS = 'status'
    UPDATED_AT = 'updated_at'


# Valid values
VALID_DAYS = ('mon', 'tue', 'wed', 'thu', 'fri')
ENTRY_STATUS_DRAFT = 'draft'
ENTRY_STATUS_SAVED = 'saved'
PHOTO_MIN = 3
PHOTO_MAX = 6

ICC_ADMIN_DOMAIN = 'indiacc.org'


# ── Pydantic request/response models ─────────────────────────────────────────

class WeekCreate(BaseModel):
    label: str
    start_date: str
    end_date: str
    is_active: bool = False
    is_visible: bool = False
    drive_link: Optional[str] = ""


class WeekUpdate(BaseModel):
    label: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    is_active: Optional[bool] = None
    is_visible: Optional[bool] = None
    drive_link: Optional[str] = None


class SubCampInput(BaseModel):
    """One time-slot within a camp group"""
    camp_name: str
    teacher_name: Optional[str] = ""
    time_start: Optional[str] = ""
    time_end: Optional[str] = ""


class CampGroupInput(BaseModel):
    """A named group of sub-camps (e.g. 'Junior Robotics, Art, & Sports Camp')"""
    group_name: str
    age_group: Optional[str] = ""
    camps: List[SubCampInput]


class WeekSetupRequest(BaseModel):
    """Create a week and all its camps in one call"""
    label: str
    start_date: str
    end_date: str
    is_active: bool = True
    is_visible: bool = False
    drive_link: Optional[str] = ""
    camp_groups: List[CampGroupInput] = []


class CampCreate(BaseModel):
    week_id: str
    group_name: Optional[str] = ""
    age_group: Optional[str] = ""
    camp_name: str
    teacher_name: Optional[str] = ""
    time_start: Optional[str] = ""
    time_end: Optional[str] = ""


class CampUpdate(BaseModel):
    group_name: Optional[str] = None
    age_group: Optional[str] = None
    camp_name: Optional[str] = None
    teacher_name: Optional[str] = None
    time_start: Optional[str] = None
    time_end: Optional[str] = None


class EntryDayInput(BaseModel):
    day: str  # one of VALID_DAYS
    day_title: str = ""
    raw_text: str
    photo_urls: List[str] = []


class EnhanceTextRequest(BaseModel):
    raw_text: str


class EntrySaveRequest(BaseModel):
    camp_id: str
    week_id: str
    entries: List[EntryDayInput]


class FoodDayData(BaseModel):
    morning_snack: str = ""
    lunch: str = ""
    afternoon_snack: str = ""


class FoodUpdateRequest(BaseModel):
    days: Dict[str, FoodDayData]
