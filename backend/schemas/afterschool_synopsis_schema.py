# backend/schemas/afterschool_synopsis_schema.py
"""
After-School / ECA Synopsis Schema — Single Source of Truth for Field Names.

Separate, additive feature from the existing camp-synopsis schema
(schemas/synopsis_schema.py) — different Firestore collections
(`afterschool_synopsis`, `afterschool_synopsis_months`), never nested under
the old `synopsis` collection. Only the ICC-admin-domain constant/verification
pattern is conceptually shared (imported directly from routes/synopsis.py,
not duplicated here).

⚠️ Keep in sync with frontend/src/constants/afterschoolSynopsisSchema.js if/when
that file is created by frontend-agent.
"""

import re
from typing import List, Optional
from pydantic import BaseModel, Field


# ── Month fields ───────────────────────────────────────────────────────────

class AfterschoolMonthFields:
    """Field names for afterschool_synopsis_months documents in Firestore."""
    MONTH_ID = 'month_id'          # "YYYY-MM"
    YEAR = 'year'
    MONTH = 'month'
    LABEL = 'label'                # e.g. "September 2026"
    IS_ACTIVE = 'is_active'
    IS_VISIBLE = 'is_visible'
    COLOR_THEME = 'color_theme'    # one of COLOR_THEME_PALETTE keys
    CREATED_BY = 'created_by'
    CREATED_AT = 'created_at'


# ── Entry fields ───────────────────────────────────────────────────────────

class AfterschoolEntryFields:
    """Field names for afterschool_synopsis documents in Firestore."""
    ENTRY_ID = 'entry_id'
    GRADE = 'grade'
    GRADE_SLUG = 'grade_slug'
    SYNOPSIS_TYPE = 'synopsis_type'
    TYPE_SLUG = 'type_slug'
    MONTH_ID = 'month_id'
    MONTH_LABEL = 'month_label'
    BLOCKS = 'blocks'
    DRIVE_LINK = 'drive_link'      # optional, one per entry (grade+type+month) — not per block
    CREATED_AT = 'created_at'
    UPDATED_AT = 'updated_at'


class AfterschoolBlockFields:
    """Field names for a single block within an entry's `blocks` array."""
    WEEK = 'week'            # "week1", "week2", ... or None for After School Class
    TITLE = 'title'
    RAW_TEXT = 'raw_text'
    PHOTO_URLS = 'photo_urls'


# ── Taxonomy constants ───────────────────────────────────────────────────────

GRADE_OPTIONS = [
    "Transitional Kindergarten (TK)",
    "Kindergarten",
    "First Grade",
    "Second & Third Grade",
    "Fourth/Fifth/Sixth Grade",
]

AFTER_SCHOOL_CLASS_TYPE = "After School Class"

ECA_TYPE_OPTIONS = [
    "Theater",
    "Art",
    "Spanish",
    "Music",
    "Sports",
    "Dance",
]

SYNOPSIS_TYPE_OPTIONS = [AFTER_SCHOOL_CLASS_TYPE] + ECA_TYPE_OPTIONS

# Fixed order the ECA newsletter doc walks sections in.
ECA_TYPE_ORDER = list(ECA_TYPE_OPTIONS)

# Every synopsis_type always has exactly 1 block with week=None — kept as a
# named set (rather than inlining `in SYNOPSIS_TYPE_OPTIONS` at call sites) so
# the "single block" rule stays a distinct, greppable concept from "valid type".
SINGLE_BLOCK_TYPES = set(SYNOPSIS_TYPE_OPTIONS)

# The 9 allowed (year, month) pairs — September 2026 through May 2027.
ALLOWED_MONTHS = [
    (2026, 9), (2026, 10), (2026, 11), (2026, 12),
    (2027, 1), (2027, 2), (2027, 3), (2027, 4), (2027, 5),
]

_MONTH_NAMES = {
    1: "January", 2: "February", 3: "March", 4: "April",
    5: "May", 6: "June", 7: "July", 8: "August",
    9: "September", 10: "October", 11: "November", 12: "December",
}

# Newsletter highlight color palette — hex values (no '#'), matching how
# _cell_bg()/paragraph-shading helpers in routes/synopsis.py already expect
# hex strings. Mirrors the frontend's color-swatch picker 1:1.
COLOR_THEME_PALETTE = {
    "yellow": "FFE599",
    "orange": "F9C89A",
    "beige": "E8DFC8",
    "red": "F6C6C6",
    "green": "C9E8C9",
    "blue": "C6DFF6",
}

# Auto-suggested default theme by calendar month when an admin creates a
# month doc — always overridable afterward via PATCH.
DEFAULT_THEME_BY_MONTH = {9: 'yellow', 10: 'orange', 11: 'beige', 12: 'red'}


def default_theme_for_month(month: int) -> str:
    return DEFAULT_THEME_BY_MONTH.get(month, 'yellow')


def month_id_for(year: int, month: int) -> str:
    return f"{year:04d}-{month:02d}"


def month_label_for(year: int, month: int) -> str:
    return f"{_MONTH_NAMES.get(month, str(month))} {year}"


def is_allowed_month(year: int, month: int) -> bool:
    return (year, month) in ALLOWED_MONTHS


_SLUG_RE = re.compile(r'[^a-z0-9]+')


def slugify(value: str) -> str:
    """Lowercase, hyphen-joined slug — e.g. 'Second & Third Grade' -> 'second-third-grade',
    'Transitional Kindergarten (TK)' -> 'transitional-kindergarten-tk'."""
    s = (value or '').strip().lower()
    s = _SLUG_RE.sub('-', s)
    return s.strip('-')


# Precomputed slug -> canonical label maps, used to validate/resolve
# {grade_slug} / {type_slug} path params without re-deriving from arbitrary input.
GRADE_SLUG_TO_LABEL = {slugify(g): g for g in GRADE_OPTIONS}
TYPE_SLUG_TO_LABEL = {slugify(t): t for t in SYNOPSIS_TYPE_OPTIONS}

PHOTO_MAX = 6  # matches the camp feature's PHOTO_MAX (frontend/src/constants/synopsisSchema.js)


# ── Pydantic request/response models ─────────────────────────────────────────

class MonthCreate(BaseModel):
    year: int
    month: int


class MonthUpdate(BaseModel):
    is_active: Optional[bool] = None
    is_visible: Optional[bool] = None
    color_theme: Optional[str] = None


class BlockInput(BaseModel):
    week: Optional[str] = None   # "week1", "week2", ... or None for After School Class
    title: str = ""
    raw_text: str = ""
    photo_urls: List[str] = []


class EntrySaveRequest(BaseModel):
    grade: str
    synopsis_type: str
    month_id: str
    blocks: List[BlockInput] = Field(default_factory=list)
    drive_link: Optional[str] = None


class EnhanceTextRequest(BaseModel):
    raw_text: str


class PortalLoginRequest(BaseModel):
    username: str
    password: str
