"""
Constants for the reserved personal workspace `Users/personal` (TASK-028, renamed
from `Users/public` in TASK-031).

Dependency-free on purpose: org_registry, paths and teacher_schema all import
from here, so this module must not import any of them.

`Users/personal` is a pseudo-org doc holding every user's PERSONAL workspace
(content owned by the teacher, not an org). Everyone has one, including org
members. It is never domain-matched (see org_registry.match_org); membership is
carried by the `org` custom claim (non-org users), by the
`Users/personal/teachers/{uid}` doc that POST /api/account/bootstrap creates,
and by the memberships list on `Accounts/{uid}`.

The module keeps its filename (`public_space.py`) so existing imports keep
working; the old PUBLIC_* names are kept as aliases.
"""

PERSONAL_SPACE_ID = "personal"
PERSONAL_SPACE_TYPE = "personal"
PERSONAL_SPACE_NAME = "EdCube"

# Old value of the space id / claim. The public space was never deployed, so no live
# data uses it; it is only still ACCEPTED when reading an `org` claim (safety).
LEGACY_PUBLIC_SPACE_ID = "public"
PERSONAL_SPACE_IDS = (PERSONAL_SPACE_ID, LEGACY_PUBLIC_SPACE_ID)

# Aliases (pre-TASK-031 names)
PUBLIC_SPACE_ID = PERSONAL_SPACE_ID
PUBLIC_SPACE_TYPE = PERSONAL_SPACE_TYPE
PUBLIC_SPACE_NAME = PERSONAL_SPACE_NAME

# Custom auth claim set by the backend at bootstrap: {"org": "<orgId>|personal"}
ORG_CLAIM = "org"
# Custom auth claim for platform admins: {"admin": true}
ADMIN_CLAIM = "admin"

# Space doc fields (Users/personal)
SPACE_TYPE = "type"
SPACE_NAME = "name"
SPACE_MAX_USERS = "max_users"
SPACE_USER_COUNT = "user_count"
# Signup cap: DISABLED by default (spec: anyone can sign up). A missing or null
# max_users means no cap; the cap/waitlist code is kept until the person approves
# its removal (TASK-031 report).
DEFAULT_MAX_USERS = None

# Plan names (limits and feature flags live in the central config, never here:
# see services/platform_config.py)
PLAN_TRIAL = "trial"
PLAN_TEACHER = "teacher"
PLAN_ORG = "org"
PLANS = (PLAN_TRIAL, PLAN_TEACHER, PLAN_ORG)
# Pre-TASK-031 names -> current plan (public-release's free/pro)
LEGACY_PLAN_MAP = {"free": PLAN_TRIAL, "pro": PLAN_TEACHER}

# Per-user teacher doc fields (Users/personal/teachers/{uid}); clients may not write these.
# (Plans now live on Accounts/{uid}; these stay protected by the rules for old docs.)
TEACHER_PLAN = "plan"
TEACHER_PLAN_UPDATED_AT = "plan_updated_at"

# Subcollections under Users/personal (backend-only)
WAITLIST_COLLECTION = "waitlist"
USAGE_COLLECTION = "usage"

# Profile field added for personal-workspace name search
PROFILE_NAME_LOWER = "name_lower"


def default_personal_space_doc(max_users=DEFAULT_MAX_USERS) -> dict:
    """The `Users/personal` doc body used by the setup scripts. max_users None = no cap."""
    return {
        SPACE_NAME: PERSONAL_SPACE_NAME,
        SPACE_TYPE: PERSONAL_SPACE_TYPE,
        "domains": [],
        "allowed_emails": [],
        SPACE_MAX_USERS: max_users,
        SPACE_USER_COUNT: 0,
    }


default_public_space_doc = default_personal_space_doc  # alias
