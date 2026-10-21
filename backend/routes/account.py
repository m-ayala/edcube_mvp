# backend/routes/account.py
"""
Account bootstrap + identity (TASK-028).

POST /api/account/bootstrap  -- called by the client after signup/login. Resolves the
    caller's space (org match wins, else public), creates their teacher + profile
    docs, enforces the public signup cap (waitlist), and sets the `org` custom
    claim. Uses verify_firebase_token (NOT require_org): a brand-new public user
    has no org yet.
GET  /api/account/me         -- {space, org_id, org_name, plan}.
"""

import logging
from typing import Optional

import firebase_admin
from fastapi import APIRouter, Depends, HTTPException, status
from firebase_admin import auth, firestore
from pydantic import BaseModel

from firebase.org_registry import resolve_space, get_org_info
from firebase.paths import (
    PUBLIC_SPACE_ID,
    ORG_CLAIM,
    WAITLIST_COLLECTION,
    org_doc,
    org_col,
    invalidate_uid_caches,
)
from firebase.public_space import (
    PUBLIC_SPACE_NAME,
    SPACE_USER_COUNT,
    SPACE_MAX_USERS,
    DEFAULT_MAX_USERS,
    PLAN_FREE,
    TEACHER_PLAN,
    TEACHER_PLAN_UPDATED_AT,
)
from routes.teachers import verify_firebase_token, require_org
from schemas.teacher_schema import (
    TEACHER_PROFILES_COLLECTION,
    TEACHERS_COLLECTION,
    create_default_profile,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/account", tags=["account"])

WAITLISTED_MESSAGE = (
    "EdCube is at capacity right now — you're on the waitlist and we'll email you."
)


class BootstrapRequest(BaseModel):
    # Optional: the signup form's name. Falls back to the token's `name`, then the
    # email prefix. (A freshly-created token may predate updateProfile.)
    display_name: Optional[str] = None


def get_db():
    if not firebase_admin._apps:
        firebase_admin.initialize_app()
    from firebase.project import firestore_client
    return firestore_client()


def _teacher_doc_body(email: str, display_name: str, org_id: str, plan: Optional[str]) -> dict:
    """Same shape the frontend signupTeacher used to write, plus plan for public."""
    body = {
        "email": email,
        "displayName": display_name,
        "organization": org_id,
        "createdAt": firestore.SERVER_TIMESTAMP,
        "lastLogin": firestore.SERVER_TIMESTAMP,
    }
    if plan is not None:
        body[TEACHER_PLAN] = plan
        body[TEACHER_PLAN_UPDATED_AT] = firestore.SERVER_TIMESTAMP
    return body


def _set_org_claim(uid: str, org_id: str) -> None:
    """Merge {org: org_id} into the user's existing custom claims (skip if unchanged)."""
    existing = dict(auth.get_user(uid).custom_claims or {})
    if existing.get(ORG_CLAIM) == org_id:
        return
    existing[ORG_CLAIM] = org_id
    auth.set_custom_user_claims(uid, existing)


def _ensure_profile(db, org_id: str, user: dict, display_name: str) -> None:
    ref = org_col(db, org_id, TEACHER_PROFILES_COLLECTION).document(user["uid"])
    if ref.get().exists:
        return
    ref.set(create_default_profile({**user, "name": display_name}, org_id))


def _public_txn(transaction, space_ref, teacher_ref, waitlist_ref, user, display_name):
    """Runs inside a Firestore transaction; returns 'exists' | 'created' | 'waitlisted'."""
    space = space_ref.get(transaction=transaction)
    if not space.exists:
        return "no_space"
    teacher = teacher_ref.get(transaction=transaction)
    if teacher.exists:
        return "exists"
    data = space.to_dict() or {}
    count = int(data.get(SPACE_USER_COUNT) or 0)
    cap = int(data.get(SPACE_MAX_USERS) if data.get(SPACE_MAX_USERS) is not None else DEFAULT_MAX_USERS)
    if count >= cap:
        transaction.set(waitlist_ref, {
            "email": user["email"].lower(),
            "uid": user["uid"],
            "created_at": firestore.SERVER_TIMESTAMP,
        })
        return "waitlisted"
    transaction.update(space_ref, {SPACE_USER_COUNT: count + 1})
    transaction.set(
        teacher_ref,
        _teacher_doc_body(user["email"], display_name, PUBLIC_SPACE_ID, PLAN_FREE),
    )
    return "created"


@router.post("/bootstrap")
async def bootstrap(
    body: Optional[BootstrapRequest] = None,
    current_user: dict = Depends(verify_firebase_token),
    db=Depends(get_db),
):
    if current_user.get("email_verified") is not True:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email address before using EdCube",
        )
    email = (current_user.get("email") or "").strip()
    uid = current_user["uid"]
    space = resolve_space(email, True)
    if not space:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Could not resolve your account")

    display_name = (
        (body.display_name if body else None)
        or current_user.get("name")
        or email.split("@")[0]
    ).strip()
    user = {"uid": uid, "email": email, "name": display_name, "picture": current_user.get("picture")}

    try:
        if space != PUBLIC_SPACE_ID:
            teacher_ref = org_col(db, space, TEACHERS_COLLECTION).document(uid)
            created = not teacher_ref.get().exists
            if created:
                teacher_ref.set(_teacher_doc_body(email, display_name, space, None))
            _ensure_profile(db, space, user, display_name)
            _set_org_claim(uid, space)
            invalidate_uid_caches(uid)
            info = get_org_info(space) or {}
            return {
                "space": "org",
                "org_id": space,
                "org_name": info.get("name", space),
                "plan": None,
                "created": created,
            }

        space_ref = org_doc(db, PUBLIC_SPACE_ID)
        teacher_ref = org_col(db, PUBLIC_SPACE_ID, TEACHERS_COLLECTION).document(uid)
        waitlist_ref = org_col(db, PUBLIC_SPACE_ID, WAITLIST_COLLECTION).document(email.lower())
        txn_fn = firestore.transactional(_public_txn)
        outcome = txn_fn(db.transaction(), space_ref, teacher_ref, waitlist_ref, user, display_name)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Bootstrap failed for {uid}: {e}")
        raise HTTPException(status_code=500, detail="Could not set up your account. Please try again.")

    if outcome == "no_space":
        raise HTTPException(status_code=503, detail="Public signups are not open yet")
    if outcome == "waitlisted":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "waitlisted", "message": WAITLISTED_MESSAGE},
        )

    _ensure_profile(db, PUBLIC_SPACE_ID, user, display_name)
    _set_org_claim(uid, PUBLIC_SPACE_ID)
    invalidate_uid_caches(uid)
    plan = (teacher_ref.get().to_dict() or {}).get(TEACHER_PLAN, PLAN_FREE)
    return {
        "space": "public",
        "org_id": PUBLIC_SPACE_ID,
        "org_name": PUBLIC_SPACE_NAME,
        "plan": plan,
        "created": outcome == "created",
    }


@router.get("/me")
async def me(current_user: dict = Depends(require_org), db=Depends(get_db)):
    org = current_user["org"]
    if org == PUBLIC_SPACE_ID:
        doc = org_col(db, org, TEACHERS_COLLECTION).document(current_user["uid"]).get()
        plan = ((doc.to_dict() or {}).get(TEACHER_PLAN) or PLAN_FREE) if doc.exists else PLAN_FREE
        return {"space": "public", "org_id": org, "org_name": PUBLIC_SPACE_NAME, "plan": plan}
    info = get_org_info(org) or {}
    return {"space": "org", "org_id": org, "org_name": info.get("name", org), "plan": None}


@router.get("/usage")
async def usage(current_user: dict = Depends(require_org), db=Depends(get_db)):
    """Plan, limits (null = unlimited) and this UTC month's usage for the caller."""
    from services import usage_service as us
    org, uid = current_user["org"], current_user["uid"]
    return {
        "plan": us.get_plan(org, uid, db),
        "space": "public" if org == PUBLIC_SPACE_ID else "org",
        "limits": us.get_limits(org, uid, db),
        "usage": us.get_usage(org, uid, db),
        "resets_at": us.resets_at(),
    }
