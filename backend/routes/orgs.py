# backend/routes/orgs.py
"""
Public org-lookup endpoint.

Used by the frontend signup flow to check whether an email is registered with
an org *before* the user has signed in (so there's no Firebase token yet --
this route is intentionally unauthenticated, same posture as POST /contact).

Non-org emails resolve to the reserved public space (`Users/public`) once that
doc exists (scripts/create_public_space.py). Until then the old
`allowed: false` response is returned unchanged.
"""

from fastapi import APIRouter, Query

from firebase.org_registry import get_org_from_email, get_org_info
from firebase.public_space import (
    PUBLIC_SPACE_ID,
    PUBLIC_SPACE_NAME,
    SPACE_MAX_USERS,
    SPACE_USER_COUNT,
    DEFAULT_MAX_USERS,
)

router = APIRouter(prefix="/api/orgs", tags=["orgs"])


def _get_public_space_doc() -> dict:
    """Return the Users/public doc as a dict, or {} if it doesn't exist."""
    from firebase.org_registry import _get_db
    snap = _get_db().collection("Users").document(PUBLIC_SPACE_ID).get()
    return (snap.to_dict() or {}) if snap.exists else {}


@router.get("/check-email")
async def check_email(email: str = Query(...)):
    """Return whether `email` can sign up, and into which space."""
    org_id = get_org_from_email(email)
    if org_id:
        info = get_org_info(org_id) or {}
        return {"allowed": True, "org_id": org_id, "org_name": info.get("name", org_id), "space": "org"}

    space = _get_public_space_doc()
    if not space:
        return {"allowed": False, "org_id": None, "org_name": None}

    cap = space.get(SPACE_MAX_USERS)
    cap = DEFAULT_MAX_USERS if cap is None else cap
    return {
        "allowed": True,
        "space": "public",
        "org_id": PUBLIC_SPACE_ID,
        "org_name": PUBLIC_SPACE_NAME,
        "waitlisted": int(space.get(SPACE_USER_COUNT) or 0) >= int(cap),
    }
