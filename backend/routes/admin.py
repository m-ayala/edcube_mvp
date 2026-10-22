# backend/routes/admin.py
"""
Admin routes (TASK-031). Every route requires the custom claim `admin: true`
(routes.teachers.require_admin). Every change is logged to `AdminAudit/{autoId}`.

GET   /api/admin/accounts?email=            look an account up by email
GET   /api/admin/accounts/{uid}             one Accounts doc + effective plan/limits
PATCH /api/admin/accounts/{uid}/plan        {plan, started_at?} sets plan_source "admin", recomputes dates
GET   /api/admin/accounts/{uid}/usage       credit counters per kind (personal plan + each org pool)
POST  /api/admin/accounts/{uid}/credits     {courses?, generates?, edo_messages?} adds to bonus_credits
POST  /api/admin/accounts/{uid}/deactivate  deactivate (starts the grace period)
POST  /api/admin/accounts/{uid}/reactivate  reactivate (admins are not bound by the grace period)

There is no payment flow: plans change only through these routes.
"""

import logging
from datetime import datetime
from typing import Optional

import firebase_admin
from fastapi import APIRouter, Depends, HTTPException, Query
from firebase_admin import auth
from pydantic import BaseModel, Field

from firebase.paths import PERSONAL_SPACE_ID, accounts_col
from firebase.public_space import PLANS
from routes.teachers import require_admin
from services import accounts_service as accts
from services import platform_config as pc

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["admin"])


def get_db():
    if not firebase_admin._apps:
        firebase_admin.initialize_app()
    from firebase.project import firestore_client
    return firestore_client()


class PlanUpdate(BaseModel):
    plan: str
    started_at: Optional[datetime] = None


class CreditGrant(BaseModel):
    courses: int = Field(default=0, ge=0)
    generates: int = Field(default=0, ge=0)
    edo_messages: int = Field(default=0, ge=0)


def _load(uid: str, db) -> dict:
    acct = accts.get_account(uid, db, fresh=True)
    if acct is None:
        raise HTTPException(status_code=404, detail="No account for that uid")
    return acct


def _view(uid: str, acct: dict) -> dict:
    plan = accts.personal_plan(acct)
    return {
        "uid": uid,
        "account": accts.public_view(acct),
        "summary": accts.summary(acct),
        "limits": pc.plan_limits(plan),
    }


@router.get("/accounts")
async def find_account(email: str = Query(...), admin: dict = Depends(require_admin), db=Depends(get_db)):
    email_l = email.strip().lower()
    hits = list(accounts_col(db).where("email", "==", email_l).limit(5).stream())
    if hits:
        return {"accounts": [_view(h.id, h.to_dict() or {}) for h in hits]}
    # No Accounts doc yet (user not backfilled): report the uid if the auth user exists.
    try:
        u = auth.get_user_by_email(email_l)
        return {"accounts": [], "auth_user": {"uid": u.uid, "email": u.email}}
    except Exception:  # noqa: BLE001
        return {"accounts": []}


@router.get("/accounts/{uid}")
async def get_account(uid: str, admin: dict = Depends(require_admin), db=Depends(get_db)):
    return _view(uid, _load(uid, db))


@router.get("/accounts/{uid}/usage")
async def get_usage(uid: str, admin: dict = Depends(require_admin), db=Depends(get_db)):
    """Credit counters per kind for the account's PERSONAL workspace (limit/used/reserved/remaining/
    bonus_remaining) and, for each org membership, the org pool they draw from."""
    from services import usage_service as us
    acct = _load(uid, db)
    pools = {}
    for m in acct.get("memberships") or []:
        ws = m.get("workspace")
        if ws and ws != PERSONAL_SPACE_ID:
            pools[ws] = us.usage_overview(ws, uid, db)
    return {"uid": uid, "personal": us.usage_overview(PERSONAL_SPACE_ID, uid, db), "pools": pools,
            "bonus_credits_granted": acct.get("bonus_credits") or {}}


@router.patch("/accounts/{uid}/plan")
async def set_plan(uid: str, body: PlanUpdate, admin: dict = Depends(require_admin), db=Depends(get_db)):
    if body.plan not in PLANS:
        raise HTTPException(status_code=400, detail=f"plan must be one of {list(PLANS)}")
    before = _load(uid, db)
    patch = accts.set_plan(uid, body.plan, body.started_at, db)
    accts.log_admin_action(admin, "set_plan", uid,
                           {k: before.get(k) for k in ("plan", "plan_started_at", "trial_ends_at", "plan_source")},
                           patch, db)
    return _view(uid, _load(uid, db))


@router.post("/accounts/{uid}/credits")
async def grant_credits(uid: str, body: CreditGrant, admin: dict = Depends(require_admin), db=Depends(get_db)):
    before = _load(uid, db)
    new = accts.add_bonus_credits(uid, body.courses, body.generates, body.edo_messages, db)
    accts.log_admin_action(admin, "grant_credits", uid, before.get("bonus_credits"),
                           {"added": body.model_dump(), "bonus_credits": new}, db)
    return _view(uid, _load(uid, db))


@router.post("/accounts/{uid}/deactivate")
async def admin_deactivate(uid: str, admin: dict = Depends(require_admin), db=Depends(get_db)):
    before = _load(uid, db)
    patch = accts.deactivate(uid, db)
    accts.log_admin_action(admin, "deactivate", uid, {"status": before.get("status")}, patch, db)
    return _view(uid, _load(uid, db))


@router.post("/accounts/{uid}/reactivate")
async def admin_reactivate(uid: str, admin: dict = Depends(require_admin), db=Depends(get_db)):
    before = _load(uid, db)
    result = accts.reactivate(uid, db, enforce_grace=False)
    accts.log_admin_action(admin, "reactivate", uid, {"status": before.get("status")}, {"result": result}, db)
    return _view(uid, _load(uid, db))
