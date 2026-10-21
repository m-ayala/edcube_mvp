# backend/services/usage_service.py
"""
Per-user monthly usage + quota enforcement (TASK-029, plan names reworked in TASK-031).

Usage docs: `Users/{workspace}/usage/{uid}/months/{YYYY-MM}` (UTC month)
    {courses, generates, edo_tokens, updated_at}
Written for every user so AI cost is visible per user. Limits come from the plan:
    org workspace   -> plan "org": unlimited for now (the org pool is TASK-033)
    personal        -> the user's Accounts plan (trial | teacher), limits from the central
                       config (services/platform_config.py). Legacy free/pro map to
                       trial/teacher. null = unlimited.
TRANSITIONAL (TASK-033 reworks this): counters are still monthly, Edo is still counted in
tokens (config key legacy_edo_tokens_per_month), and there is no one-time trial grant or
anniversary reset yet.

Route integration:
    @router.post("/x", dependencies=[Depends(enforce_quota("generates"))])
Runs after require_org and before any streaming starts. The entitlement check
(entitlements.can) runs FIRST: an expired trial gets 402 {"code": "plan_inactive"} before
any credit logic. QuotaExceeded is turned into HTTP 402 by the handler in main.py.
"""

import logging
import time
from collections import deque
from datetime import datetime, timezone
from typing import Deque, Dict, Optional, Tuple

import firebase_admin
from fastapi import Depends, HTTPException
from firebase_admin import firestore

from firebase.paths import PERSONAL_SPACE_ID, usage_month_doc
from firebase.public_space import PLAN_ORG
from routes.teachers import require_org
from services import accounts_service, entitlements
from services import platform_config as pc

logger = logging.getLogger(__name__)

COURSES = "courses"
GENERATES = "generates"
EDO_TOKENS = "edo_tokens"
KINDS = (COURSES, GENERATES, EDO_TOKENS)

class QuotaExceeded(Exception):
    def __init__(self, kind: str, limit: int, used: int, resets_at: str, plan: Optional[str]):
        super().__init__(f"quota exceeded for {kind}: {used}/{limit}")
        self.kind, self.limit, self.used, self.resets_at, self.plan = kind, limit, used, resets_at, plan

    def to_detail(self) -> dict:
        return {"code": "quota_exceeded", "kind": self.kind, "limit": self.limit,
                "used": self.used, "resets_at": self.resets_at, "plan": self.plan}


# ── helpers ─────────────────────────────────────────────────────────────────

def _db():
    if not firebase_admin._apps:
        firebase_admin.initialize_app()
    from firebase.project import firestore_client
    return firestore_client()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def month_key(now: Optional[datetime] = None) -> str:
    return (now or _now()).strftime("%Y-%m")


def resets_at(now: Optional[datetime] = None) -> str:
    """First instant of the next UTC month (ISO 8601)."""
    n = now or _now()
    y, m = (n.year + 1, 1) if n.month == 12 else (n.year, n.month + 1)
    return datetime(y, m, 1, tzinfo=timezone.utc).isoformat()


def clear_caches() -> None:
    pc.clear_cache()
    accounts_service.clear_cache()


def get_plan(org: str, uid: str, db=None) -> Optional[str]:
    """'trial' | 'teacher' for the personal workspace (the user's Accounts plan; legacy
    free/pro mapped), 'org' in an org workspace."""
    if org != PERSONAL_SPACE_ID:
        return PLAN_ORG
    return accounts_service.personal_plan(accounts_service.get_account(uid, db))


def get_limits(org: str, uid: str, db=None) -> Dict[str, Optional[int]]:
    """{'courses','generates','edo_tokens'} -> int or None (unlimited). All numbers come
    from the central config; org workspaces are unlimited until the pool lands (TASK-033)."""
    if org != PERSONAL_SPACE_ID:
        return {k: None for k in KINDS}   # org pool counters come with TASK-033
    db = db or _db()
    cfg = pc.plan_config(get_plan(org, uid, db), db)
    limits = cfg.get("limits") or {}
    return {
        COURSES: limits.get("courses"),
        GENERATES: limits.get("generates"),
        EDO_TOKENS: cfg.get("legacy_edo_tokens_per_month"),
    }


def get_usage(org: str, uid: str, db=None, now: Optional[datetime] = None) -> Dict[str, int]:
    snap = usage_month_doc(db or _db(), org, uid, month_key(now)).get()
    d = (snap.to_dict() or {}) if snap.exists else {}
    return {k: int(d.get(k) or 0) for k in KINDS}


def _txn_apply(transaction, ref, kind, amount, limit, plan, reset_iso, enforce):
    snap = ref.get(transaction=transaction)
    d = (snap.to_dict() or {}) if snap.exists else {}
    cur = {k: int(d.get(k) or 0) for k in KINDS}
    if enforce and limit is not None and cur[kind] + amount > limit:
        raise QuotaExceeded(kind, limit, cur[kind], reset_iso, plan)
    cur[kind] = max(0, cur[kind] + amount)
    transaction.set(ref, {**cur, "updated_at": firestore.SERVER_TIMESTAMP})
    return cur[kind]


def _apply(org, uid, kind, amount, limit=None, plan=None, enforce=False, db=None):
    db = db or _db()
    now = _now()
    ref = usage_month_doc(db, org, uid, month_key(now))
    fn = firestore.transactional(_txn_apply)
    return fn(db.transaction(), ref, kind, amount, limit, plan, resets_at(now), enforce)


# ── public API ──────────────────────────────────────────────────────────────

def check_and_increment(org: str, uid: str, kind: str, amount: int = 1, db=None) -> int:
    """Atomically add `amount`; raises QuotaExceeded if it would pass the limit.
    Unlimited (org / pro) always increments. Returns the new used count."""
    db = db or _db()
    limit = get_limits(org, uid, db)[kind]
    return _apply(org, uid, kind, amount, limit, get_plan(org, uid, db), True, db)


def check_remaining(org: str, uid: str, kind: str, db=None) -> None:
    """Pre-check without incrementing: raises QuotaExceeded if used >= limit."""
    db = db or _db()
    limit = get_limits(org, uid, db)[kind]
    if limit is None:
        return
    used = get_usage(org, uid, db)[kind]
    if used >= limit:
        raise QuotaExceeded(kind, limit, used, resets_at(), get_plan(org, uid, db))


def add_usage(org: str, uid: str, kind: str, amount: int, db=None) -> int:
    """Unconditional increment (Edo tokens after the reply)."""
    return _apply(org, uid, kind, amount, db=db)


def refund(org: str, uid: str, kind: str, amount: int = 1, db=None) -> None:
    """Best-effort decrement, never below 0. Never raises."""
    try:
        _apply(org, uid, kind, -abs(amount), db=db)
    except Exception as e:  # noqa: BLE001
        logger.warning("usage refund failed (%s %s %s): %s", org, uid, kind, e)


def safe_add_usage(org, uid, kind, amount) -> None:
    """add_usage that never breaks the request."""
    try:
        if amount and amount > 0:
            add_usage(org, uid, kind, int(amount))
    except Exception as e:  # noqa: BLE001
        logger.warning("usage record failed (%s %s %s): %s", org, uid, kind, e)


def refund_charge(current_user: dict, kind: str) -> None:
    """Refund the unit enforce_quota charged on this request (once). For streaming
    routes that fail before producing a result."""
    charges = current_user.get("_quota_charges")
    if charges and charges.pop(kind, None):
        refund(current_user["org"], current_user["uid"], kind, 1)


# ── FastAPI dependencies ────────────────────────────────────────────────────

def enforce_quota(kind: str):
    """Dependency factory. courses/generates: charge 1 now (refunded if the route then
    fails with a 5xx / unhandled error). edo_tokens: pre-check only; the route records
    tokens after the reply with safe_add_usage."""
    if kind not in KINDS:
        raise ValueError(f"unknown quota kind: {kind}")

    async def dep(current_user: dict = Depends(require_org)):
        org, uid = current_user["org"], current_user["uid"]
        # Plan/state gate BEFORE any credit logic (expired trial -> 402 plan_inactive).
        entitlements.enforce(current_user, entitlements.QUOTA_KIND_ACTION[kind])
        charged = False
        try:
            if kind == EDO_TOKENS:
                if org == PERSONAL_SPACE_ID:
                    check_remaining(org, uid, kind)
            else:
                check_and_increment(org, uid, kind, 1)
                charged = True
                current_user.setdefault("_quota_charges", {})[kind] = 1
        except QuotaExceeded:
            raise
        except Exception as e:  # noqa: BLE001
            # Fail open on infrastructure errors (org users: recording must never break
            # the request; personal users: see report) -- logged, nothing was charged.
            logger.warning("quota check failed open (%s %s %s): %s", org, uid, kind, e)
        try:
            yield current_user
        except HTTPException as e:
            if charged:  # route rejected/failed with an HTTP error: no result delivered
                refund_charge(current_user, kind)
            raise
        except Exception:
            if charged:
                refund_charge(current_user, kind)
            raise

    return dep


_CHIPS_PER_MIN = 30
_chip_hits: Dict[str, Deque[float]] = {}


async def throttle_chips(current_user: dict = Depends(require_org)):
    """In-memory per-uid limiter (~30/min, per instance) for the uncounted chips route."""
    entitlements.enforce(current_user, entitlements.AI_EDO)  # LLM-backed: off once a trial has ended
    uid, now = current_user["uid"], time.time()
    q = _chip_hits.setdefault(uid, deque())
    while q and now - q[0] > 60:
        q.popleft()
    if len(q) >= _CHIPS_PER_MIN:
        raise HTTPException(status_code=429, detail={"code": "rate_limited"},
                            headers={"Retry-After": str(max(1, int(60 - (now - q[0]))))})
    q.append(now)
    return current_user
