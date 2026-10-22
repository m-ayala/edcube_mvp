# backend/routes/orgs.py
"""
Public org-lookup endpoint.

Used by the frontend signup flow to check whether an email is registered with
an org *before* the user has signed in (so there's no Firebase token yet --
this route is intentionally unauthenticated, same posture as POST /contact).

Non-org emails resolve to the reserved personal workspace (`Users/personal`) once that
doc exists (scripts/setup_launch_accounts.py). Until then the old
`allowed: false` response is returned unchanged.
"""

from fastapi import APIRouter, Query

from firebase.org_registry import get_org_from_email, get_org_info
from firebase.public_space import (
    PERSONAL_SPACE_ID,
    PERSONAL_SPACE_NAME,
)

router = APIRouter(prefix="/api/orgs", tags=["orgs"])


def _get_personal_space_doc() -> dict:
    """Return the Users/personal doc as a dict, or {} if it doesn't exist."""
    from firebase.org_registry import _get_db
    snap = _get_db().collection("Users").document(PERSONAL_SPACE_ID).get()
    return (snap.to_dict() or {}) if snap.exists else {}


@router.get("/check-email")
async def check_email(email: str = Query(...)):
    """Return whether `email` can sign up, and into which space."""
    org_id = get_org_from_email(email)
    if org_id:
        info = get_org_info(org_id) or {}
        return {"allowed": True, "org_id": org_id, "org_name": info.get("name", org_id), "space": "org"}

    space = _get_personal_space_doc()
    if not space:
        return {"allowed": False, "org_id": None, "org_name": None}

    return {
        "allowed": True,
        "space": "personal",
        "org_id": PERSONAL_SPACE_ID,
        "org_name": PERSONAL_SPACE_NAME,
    }
