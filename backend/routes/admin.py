# backend/routes/admin.py
"""
Admin routes (TASK-031). Every route requires the custom claim `admin: true`
(routes.teachers.require_admin). Every change is logged to `AdminAudit/{autoId}`.

GET   /api/admin/accounts?email=            look an account up by email
GET   /api/admin/accounts/recent?limit=50   newest Accounts first (limit 1-200)
GET   /api/admin/accounts/{uid}             one Accounts doc + effective plan/limits
PATCH /api/admin/accounts/{uid}/plan        {plan, started_at?} sets plan_source "admin", recomputes dates
GET   /api/admin/accounts/{uid}/usage       credit counters per kind (personal plan + each org pool)
POST  /api/admin/accounts/{uid}/credits     {courses?, generates?, edo_messages?} adds to bonus_credits
POST  /api/admin/accounts/{uid}/deactivate  deactivate (starts the grace period)
POST  /api/admin/accounts/{uid}/reactivate  reactivate (admins are not bound by the grace period)
GET   /api/admin/usage-log                  cost log rows, newest first (?from=&to=&uid=&action=&limit=&format=csv|json)
GET   /api/admin/cost-summary               per action / per user / per credit kind aggregates (?from=&to=)

There is no payment flow: plans change only through these routes.
"""

import csv
import io
import logging
from datetime import datetime
from typing import Literal, Optional

import firebase_admin
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from firebase_admin import auth
from pydantic import BaseModel, Field

from firebase.paths import PERSONAL_SPACE_ID, accounts_col
from firebase.public_space import PLANS
from routes.teachers import require_admin
from services import accounts_service as accts
from services import platform_config as pc
from services import usage_report

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


@router.get("/accounts/recent")
async def recent_accounts(limit: int = Query(default=50, ge=1, le=200),
                          admin: dict = Depends(require_admin), db=Depends(get_db)):
    """Newest Accounts first. Declared before /accounts/{uid} so "recent" is not read as a uid."""
    from google.cloud.firestore import Query as FsQuery
    snaps = accounts_col(db).order_by("created_at", direction=FsQuery.DESCENDING).limit(limit).stream()
    rows = []
    for sn in snaps:
        a = sn.to_dict() or {}
        pv = accts.public_view(a) or {}
        rows.append({"uid": sn.id, "email": a.get("email"), "plan": accts.personal_plan(a),
                     "plan_source": a.get("plan_source"), "created_at": pv.get("created_at"),
                     "status": a.get("status") or accts.STATUS_ACTIVE, "email_domain": a.get("email_domain")})
    return {"accounts": rows, "count": len(rows)}


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


# ── Cost log (TASK-034) ─────────────────────────────────────────────────────

def _csv_cell(v) -> str:
    s = "" if v is None else str(v)
    return "'" + s if s[:1] in ("=", "+", "-", "@", "\t", "\r") else s   # spreadsheet formula guard (as the waitlist export)


def _window(frm: Optional[str], to: Optional[str]):
    try:
        return usage_report.window(frm, to)
    except ValueError:
        raise HTTPException(status_code=422, detail="from/to must be an ISO date or datetime")


@router.get("/usage-log")
async def usage_log(
    frm: Optional[str] = Query(default=None, alias="from"),
    to: Optional[str] = Query(default=None),
    uid: Optional[str] = Query(default=None),
    action: Optional[str] = Query(default=None),
    limit: int = Query(default=1000, ge=1, le=5000),
    format: Literal["json", "csv"] = Query(default="json"),
    admin: dict = Depends(require_admin),
    db=Depends(get_db),
):
    """UsageLog rows, newest first. Reads at most the newest usage_report.MAX_SCAN rows of the window."""
    start, end = _window(frm, to)
    rows, truncated = usage_report.fetch_rows(db, start, end, uid=uid, action=action)
    rows = rows[:limit]
    if format == "csv":
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(usage_report.CSV_FIELDS)
        for r in rows:
            flat = usage_report.flatten(r)
            w.writerow([_csv_cell(flat.get(f)) for f in usage_report.CSV_FIELDS])
        return Response(buf.getvalue(), media_type="text/csv",
                        headers={"Content-Disposition": 'attachment; filename="edcube-usage-log.csv"'})
    return {"rows": [usage_report.serialize(r) for r in rows], "count": len(rows), "truncated": truncated,
            "window": {"from": start.isoformat(), "to": end.isoformat()}, "scan_limit": usage_report.MAX_SCAN}


@router.get("/cost-summary")
async def cost_summary(
    frm: Optional[str] = Query(default=None, alias="from"),
    to: Optional[str] = Query(default=None),
    admin: dict = Depends(require_admin),
    db=Depends(get_db),
):
    """Per action, per user and per credit kind: count, success rate, tokens, Browserbase calls and
    estimated cost (sum / avg). Estimated cost is 0 until platform_config.cost_rates is filled in."""
    start, end = _window(frm, to)
    rows, truncated = usage_report.fetch_rows(db, start, end)
    rates = (pc.get_config(db).get("cost_rates") or {})
    return {"window": {"from": start.isoformat(), "to": end.isoformat()}, "scanned": len(rows),
            "truncated": truncated, "scan_limit": usage_report.MAX_SCAN,
            "rates_are_placeholder": bool(rates.get("is_placeholder", True)),
            **usage_report.summarize(rows)}
