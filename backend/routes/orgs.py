# backend/routes/orgs.py
"""
Public org-lookup endpoint.

Used by the frontend signup flow to check whether an email is registered with
an org *before* the user has signed in (so there's no Firebase token yet --
this route is intentionally unauthenticated, same posture as POST /contact).
"""

from fastapi import APIRouter, Query

from firebase.org_registry import get_org_from_email, get_org_info

router = APIRouter(prefix="/api/orgs", tags=["orgs"])


@router.get("/check-email")
async def check_email(email: str = Query(...)):
    """Return whether `email` is registered with an org, and which one."""
    org_id = get_org_from_email(email)
    if not org_id:
        return {"allowed": False, "org_id": None, "org_name": None}

    info = get_org_info(org_id) or {}
    return {"allowed": True, "org_id": org_id, "org_name": info.get("name", org_id)}
