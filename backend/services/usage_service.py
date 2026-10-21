# backend/services/usage_service.py
"""
Per-user monthly usage + quota enforcement (TASK-029).

Usage docs: `Users/{org}/usage/{uid}/months/{YYYY-MM}` (UTC month)
    {courses, generates, edo_tokens, updated_at}
Written for every user (org users too, so AI cost is visible per user), but only
the public space is ever limited:
    org user      -> all limits None (unlimited)
    public user   -> plan from Users/public/teachers/{uid}.plan, limits from the
                     `plans` map on the Users/public doc (falls back to
                     public_space.DEFAULT_PLANS). null = unlimited.

Route integration:
    @router.post("/x", dependencies=[Depends(enforce_quota("generates"))])
Runs after require_org and before any streaming starts. QuotaExceeded is turned
into HTTP 402 by the handler in main.py.
"""

import logging
import time
from collections import deque
from datetime import datetime, timezone
from typing import Deque, Dict, Optional, Tuple

import firebase_admin
from fastapi import Depends, HTTPException
from firebase_admin import firestore

from firebase.paths import PUBLIC_SPACE_ID, org_doc, org_col, usage_month_doc
from firebase.public_space import (
    DEFAULT_PLANS,
    PLAN_FREE,
    SPACE_PLANS,
    TEACHER_PLAN,
)
from routes.teachers import require_org

logger = logging.getLogger(__name__)

COURSES = "courses"
GENERATES = "generates"
EDO_TOKENS = "edo_tokens"
KINDS = (COURSES, GENERATES, EDO_TOKENS)

_PLANS_TTL_SECONDS = 300   # plans config, like org_registry
_USER_PLAN_TTL_SECONDS = 60

_plans_cache: Optional[Tuple[dict, float]] = None
_user_plan_cache: Dict[str, Tuple[str, float]] = {}


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
    global _plans_cache
    _plans_cache = None
    _user_plan_cache.clear()


def _plans_config(db=None) -> dict:
    global _plans_cache
    now = time.time()
    if _plans_cache is not None and (now - _plans_cache[1]) < _PLANS_TTL_SECONDS:
        return _plans_cache[0]
    snap = org_doc(db or _db(), PUBLIC_SPACE_ID).get()
    plans = ((snap.to_dict() or {}).get(SPACE_PLANS) if snap.exists else None)
    if not isinstance(plans, dict) or not plans:
        plans = DEFAULT_PLANS
    _plans_cache = (plans, now)
    return plans


def get_plan(org: str, uid: str, db=None) -> Optional[str]:
    """'free' | 'pro' for public users, None for org users."""
    if org != PUBLIC_SPACE_ID:
        return None
    now = time.time()
    cached = _user_plan_cache.get(uid)
    if cached is not None and (now - cached[1]) < _USER_PLAN_TTL_SECONDS:
        return cached[0]
    snap = org_col(db or _db(), PUBLIC_SPACE_ID, "teachers").document(uid).get()
    plan = ((snap.to_dict() or {}).get(TEACHER_PLAN) if snap.exists else None) or PLAN_FREE
    _user_plan_cache[uid] = (plan, now)
    return plan


def get_limits(org: str, uid: str, db=None) -> Dict[str, Optional[int]]:
    """{'courses','generates','edo_tokens'} -> int or None (unlimited)."""
    if org != PUBLIC_SPACE_ID:
        return {k: None for k in KINDS}
    db = db or _db()
    plan = get_plan(org, uid, db)
    plans = _plans_config(db)
    defaults = DEFAULT_PLANS.get(plan) or DEFAULT_PLANS[PLAN_FREE]
    cfg = plans.get(plan)
    if not isinstance(cfg, dict):
        cfg = defaults
    out = {}
    for k in KINDS:
        key = f"{k}_per_month"
        out[k] = cfg[key] if key in cfg else defaults.get(key)  # explicit null stays unlimited
    return out


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
        charged = False
        try:
            if kind == EDO_TOKENS:
                if org == PUBLIC_SPACE_ID:
                    check_remaining(org, uid, kind)
            else:
                check_and_increment(org, uid, kind, 1)
                charged = True
                current_user.setdefault("_quota_charges", {})[kind] = 1
        except QuotaExceeded:
            raise
        except Exception as e:  # noqa: BLE001
            # Fail open on infrastructure errors (org users: recording must never break
            # the request; public users: see report) -- logged, nothing was charged.
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
    uid, now = current_user["uid"], time.time()
    q = _chip_hits.setdefault(uid, deque())
    while q and now - q[0] > 60:
        q.popleft()
    if len(q) >= _CHIPS_PER_MIN:
        raise HTTPException(status_code=429, detail={"code": "rate_limited"},
                            headers={"Retry-After": str(max(1, int(60 - (now - q[0]))))})
    q.append(now)
    return current_user
