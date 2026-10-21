# backend/routes/account.py
"""
Account bootstrap + identity (TASK-028, reworked in TASK-031).

POST /api/account/bootstrap   -- called by the client after signup/login. Idempotent.
    Every user gets a PERSONAL workspace (Users/personal) and an Accounts/{uid} doc
    (plan `trial` starting now on first creation; existing users are backfilled on their
    next login without touching their plan). Org members (email matches an org) also get
    their org membership; their default workspace stays the org. Sets the `org` custom
    claim. Uses verify_firebase_token (NOT require_org): a brand-new user has no
    workspace yet.
GET  /api/account/me          -- workspace, memberships, account summary, entitlements.
GET  /api/account/usage       -- plan, limits (null = unlimited), this month's usage.
POST /api/account/deactivate  -- self: deactivate now, restorable for the grace period.
POST /api/account/reactivate  -- self: restore within the grace period.
"""

import logging
from typing import Optional

import firebase_admin
from fastapi import APIRouter, Depends, HTTPException, status
from firebase_admin import auth, firestore
from pydantic import BaseModel

from firebase.org_registry import resolve_space, get_org_info
from firebase.paths import (
    PERSONAL_SPACE_ID,
    ORG_CLAIM,
    WAITLIST_COLLECTION,
    org_doc,
    org_col,
    invalidate_uid_caches,
)
from firebase.public_space import (
    PERSONAL_SPACE_NAME,
    SPACE_USER_COUNT,
    SPACE_MAX_USERS,
    DEFAULT_MAX_USERS,
    ADMIN_CLAIM,
    PLAN_ORG,
)
from routes.teachers import verify_firebase_token, require_org, require_workspace_lenient
from schemas.teacher_schema import (
    TEACHER_PROFILES_COLLECTION,
    TEACHERS_COLLECTION,
    create_default_profile,
)
from services import accounts_service as accts
from services import entitlements
from services import platform_config as pc

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


def _teacher_doc_body(email: str, display_name: str, org_id: str) -> dict:
    """Same shape the frontend signupTeacher used to write. Plans live on Accounts/{uid} now."""
    return {
        "email": email,
        "displayName": display_name,
        "organization": org_id,
        "createdAt": firestore.SERVER_TIMESTAMP,
        "lastLogin": firestore.SERVER_TIMESTAMP,
    }


def _set_org_claim(uid: str, org_id: str) -> None:
    """Merge {org: org_id} into the user's existing custom claims (skip if unchanged).
    Other claims (e.g. admin) are preserved."""
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


def _signup_cap(data: dict) -> Optional[int]:
    """Signup cap on the personal space doc. DISABLED by default: a missing or null
    max_users means no cap (spec: anyone can sign up). Kept, not deleted, pending the
    person's approval to remove the cap/waitlist code."""
    cap = data.get(SPACE_MAX_USERS)
    cap = DEFAULT_MAX_USERS if cap is None else cap
    return None if cap is None else int(cap)


def _personal_txn(transaction, space_ref, teacher_ref, waitlist_ref, user, display_name):
    """Runs inside a Firestore transaction; returns 'exists' | 'created' | 'waitlisted' | 'no_space'."""
    space = space_ref.get(transaction=transaction)
    if not space.exists:
        return "no_space"
    teacher = teacher_ref.get(transaction=transaction)
    if teacher.exists:
        return "exists"
    data = space.to_dict() or {}
    count = int(data.get(SPACE_USER_COUNT) or 0)
    cap = _signup_cap(data)
    if cap is not None and count >= cap:
        transaction.set(waitlist_ref, {
            "email": user["email"].lower(),
            "uid": user["uid"],
            "created_at": firestore.SERVER_TIMESTAMP,
        })
        return "waitlisted"
    transaction.update(space_ref, {SPACE_USER_COUNT: count + 1})
    transaction.set(teacher_ref, _teacher_doc_body(user["email"], display_name, PERSONAL_SPACE_ID))
    return "created"


def _memberships_view(account: Optional[dict]) -> list:
    out = []
    for m in (account or {}).get("memberships") or []:
        ws = m.get("workspace")
        if ws == PERSONAL_SPACE_ID:
            out.append({"workspace": ws, "type": "personal", "name": "Personal"})
        else:
            info = get_org_info(ws) or {}
            out.append({"workspace": ws, "type": "org", "name": info.get("name", ws), "role": m.get("role")})
    return out


def _entitlements_view(plan: str, workspace: str) -> dict:
    feats = pc.plan_features(plan)
    cap = pc.collaborator_cap(plan)
    if workspace != PERSONAL_SPACE_ID:
        cap = (get_org_info(workspace) or {}).get("collaborator_cap")
    return {**feats, "collaborator_cap": cap}


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
    is_org = space != PERSONAL_SPACE_ID
    created = False

    try:
        if is_org:
            teacher_ref = org_col(db, space, TEACHERS_COLLECTION).document(uid)
            created = not teacher_ref.get().exists
            if created:
                teacher_ref.set(_teacher_doc_body(email, display_name, space))
            _ensure_profile(db, space, user, display_name)
            _set_org_claim(uid, space)
            # Org members also get a personal workspace (never cap-blocked, no waitlist).
            personal_teacher = org_col(db, PERSONAL_SPACE_ID, TEACHERS_COLLECTION).document(uid)
            if not personal_teacher.get().exists:
                personal_teacher.set(_teacher_doc_body(email, display_name, PERSONAL_SPACE_ID))
            _ensure_profile(db, PERSONAL_SPACE_ID, user, display_name)
        else:
            space_ref = org_doc(db, PERSONAL_SPACE_ID)
            teacher_ref = org_col(db, PERSONAL_SPACE_ID, TEACHERS_COLLECTION).document(uid)
            waitlist_ref = org_col(db, PERSONAL_SPACE_ID, WAITLIST_COLLECTION).document(email.lower())
            txn_fn = firestore.transactional(_personal_txn)
            outcome = txn_fn(db.transaction(), space_ref, teacher_ref, waitlist_ref, user, display_name)
            if outcome == "no_space":
                raise HTTPException(status_code=503, detail="Public signups are not open yet")
            if outcome == "waitlisted":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={"code": "waitlisted", "message": WAITLISTED_MESSAGE},
                )
            created = outcome == "created"
            _ensure_profile(db, PERSONAL_SPACE_ID, user, display_name)
            _set_org_claim(uid, PERSONAL_SPACE_ID)

        account = accts.ensure_account(
            uid, email, org_id=space if is_org else None,
            is_admin=current_user.get(ADMIN_CLAIM) is True, db=db,
        )
        invalidate_uid_caches(uid)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Bootstrap failed for {uid}: {e}")
        raise HTTPException(status_code=500, detail="Could not set up your account. Please try again.")

    if is_org:
        info = get_org_info(space) or {}
        org_name, plan = info.get("name", space), info.get("plan") or PLAN_ORG
    else:
        org_name, plan = PERSONAL_SPACE_NAME, accts.personal_plan(account)
    return {
        "space": "org" if is_org else "personal",
        "org_id": space,
        "org_name": org_name,
        "plan": plan,
        "created": created,
        "default_workspace": space,
        "memberships": _memberships_view(account),
        "account": accts.summary(account),
    }


@router.get("/me")
async def me(current_user: dict = Depends(require_workspace_lenient), db=Depends(get_db)):
    """The caller's resolved workspace (honors X-EdCube-Workspace) plus memberships, the
    account summary and the entitlements in effect. Works for deactivated accounts."""
    org, uid = current_user["org"], current_user["uid"]
    account = accts.get_account(uid, db)
    if org == PERSONAL_SPACE_ID:
        org_name, plan, space = PERSONAL_SPACE_NAME, accts.personal_plan(account), "personal"
    else:
        info = get_org_info(org) or {}
        org_name, plan, space = info.get("name", org), info.get("plan") or PLAN_ORG, "org"
    return {
        "space": space,
        "org_id": org,
        "org_name": org_name,
        "plan": plan,
        "workspace": org,
        "home_org": current_user.get("home_org"),
        "memberships": _memberships_view(account),
        "account": accts.summary(account),
        "entitlements": _entitlements_view(plan, org),
    }


@router.get("/usage")
async def usage(current_user: dict = Depends(require_org), db=Depends(get_db)):
    """Plan, limits (null = unlimited) and this UTC month's usage for the caller."""
    from services import usage_service as us
    org, uid = current_user["org"], current_user["uid"]
    return {
        "plan": us.get_plan(org, uid, db),
        "space": "personal" if org == PERSONAL_SPACE_ID else "org",
        "limits": us.get_limits(org, uid, db),
        "usage": us.get_usage(org, uid, db),
        "resets_at": us.resets_at(),
    }


def _verified(current_user: dict) -> str:
    if current_user.get("email_verified") is not True:
        raise HTTPException(status_code=403, detail="Please verify your email address before using EdCube")
    return current_user["uid"]


@router.post("/deactivate")
async def deactivate(current_user: dict = Depends(verify_firebase_token), db=Depends(get_db)):
    """Deactivate the caller's account now. Their personal-workspace content stays but nothing
    of theirs is reachable (own access, view links, collaborator access) until reactivated;
    permanently deleted after the grace period. Org-workspace courses are unaffected."""
    uid = _verified(current_user)
    acct = accts.get_account(uid, db, fresh=True)
    if acct is None:
        acct = accts.ensure_account(uid, current_user.get("email") or "", db=db)
    if accts.is_deactivated(acct):
        return {"status": "deactivated", **_dates(acct)}
    patch = accts.deactivate(uid, db)
    accts.log_admin_action({"uid": uid, "email": current_user.get("email")}, "self_deactivate", uid,
                           {"status": "active"}, {"status": "deactivated", "delete_after": patch["delete_after"]}, db)
    return {"status": "deactivated", **_dates(patch)}


@router.post("/reactivate")
async def reactivate(current_user: dict = Depends(verify_firebase_token), db=Depends(get_db)):
    """Restore a deactivated account within the grace period."""
    uid = _verified(current_user)
    result = accts.reactivate(uid, db)
    if result == "grace_expired":
        raise HTTPException(status_code=410, detail={
            "code": "grace_period_over",
            "message": "The restore window has passed, so this account can no longer be reactivated."})
    if result == "reactivated":
        accts.log_admin_action({"uid": uid, "email": current_user.get("email")}, "self_reactivate", uid,
                               {"status": "deactivated"}, {"status": "active"}, db)
    return {"status": "active", "result": result}


def _dates(d: dict) -> dict:
    pv = accts.public_view(d) or {}
    return {"deactivated_at": pv.get("deactivated_at"), "delete_after": pv.get("delete_after")}
