"""
Constants for the reserved public space `Users/public` (TASK-028).

Dependency-free on purpose: org_registry, paths and teacher_schema all import
from here, so this module must not import any of them.

`Users/public` is a pseudo-org doc for self-serve users whose email matches no
org. It is never domain-matched (see org_registry.match_org); membership is
carried by the `org` custom claim and by the `teachers/{uid}` doc that
POST /api/account/bootstrap creates.
"""

PUBLIC_SPACE_ID = "public"
PUBLIC_SPACE_TYPE = "public"
PUBLIC_SPACE_NAME = "EdCube"

# Custom auth claim set by the backend at bootstrap: {"org": "<orgId>|public"}
ORG_CLAIM = "org"

# Space doc fields (Users/public)
SPACE_TYPE = "type"
SPACE_NAME = "name"
SPACE_MAX_USERS = "max_users"
SPACE_USER_COUNT = "user_count"
SPACE_PLANS = "plans"
DEFAULT_MAX_USERS = 500

# Plans
PLAN_FREE = "free"
PLAN_PRO = "pro"
DEFAULT_PLANS = {
    PLAN_FREE: {"courses_per_month": 5, "generates_per_month": 50, "edo_tokens_per_month": 100000},
    PLAN_PRO: {"courses_per_month": None, "generates_per_month": None, "edo_tokens_per_month": None},
}

# Per-user teacher doc fields (Users/public/teachers/{uid}); clients may not write these.
TEACHER_PLAN = "plan"
TEACHER_PLAN_UPDATED_AT = "plan_updated_at"

# Subcollections under Users/public (backend-only)
WAITLIST_COLLECTION = "waitlist"
USAGE_COLLECTION = "usage"

# Profile field added for public-space name search
PROFILE_NAME_LOWER = "name_lower"


def default_public_space_doc(max_users: int = DEFAULT_MAX_USERS) -> dict:
    """The `Users/public` doc body used by scripts/create_public_space.py."""
    import copy
    return {
        SPACE_NAME: PUBLIC_SPACE_NAME,
        SPACE_TYPE: PUBLIC_SPACE_TYPE,
        "domains": [],
        "allowed_emails": [],
        SPACE_MAX_USERS: max_users,
        SPACE_USER_COUNT: 0,
        SPACE_PLANS: copy.deepcopy(DEFAULT_PLANS),
    }
