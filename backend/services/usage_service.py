# backend/services/usage_service.py
"""
Credits (TASK-033): three separate counters, reserve -> confirm -> refund in Firestore
transactions, period-based, workspace-aware. Replaces the TASK-029 monthly token counters.

Kinds (platform_config limits, null = unlimited)
    courses       Generate Course (/generate-curriculum)
    generates     every Generate-button action
    edo_messages  Edo chat replies, one per MESSAGE (no longer tokens)

Who pays: the person pressing the button, in the workspace they are acting in.
    org workspace (caller is a member)  -> the org POOL   (shared by every member)
    personal workspace                  -> the caller's own plan (trial | teacher)
The course owner never pays for someone else's click: the key is always the caller's uid
(personal) or the org (pool). A collaborator therefore draws from their own plan.

Counter docs (backend-only, under the existing usage collection)
    Users/personal/usage/{uid}/periods/{period_id}     personal plan counters
    Users/{org}/usage/_pool/periods/{period_id}         org pool counters
    Users/personal/usage/{uid}/periods/bonus            lifetime bonus-credit ledger (personal only)
  period doc: {period_id, period_start, period_end, plan, used: {kind: n},
               reservations: {rid: {kind, amount, expires_at, created_at}},
               by_user: {uid: {kind: n}} (pool only), updated_at}
  bonus doc:  {used: {kind: n}, reservations: {rid: {...}}, updated_at}

Periods (all numbers come from platform_config / the org doc)
    trial    period_id "trial": a ONE-TIME allowance, never resets. resets_at is null; the UI
             date is trial_ends_at (also period_end).
    teacher  monthly on the ANNIVERSARY of Accounts.plan_started_at, 00:00 UTC, id = the period
             start date. Days 29-31 clamp to the month's last day (31 Jan -> 28/29 Feb -> 31 Mar).
             No rollover: each period is a fresh doc. reset_rule "calendar" (config) or a missing
             plan_started_at falls back to calendar months.
    org      pool, monthly on Users/{org}.plan_started_at (calendar month if none).
             Users/{org}.pool = {courses, generates, edo_messages}; null/absent = unlimited (ICC).

Bonus credits (Accounts.bonus_credits, admin grants): add to the PERSONAL allowance only, are
consumed AFTER the plan allowance of the current period is used up, never expire and never reset.
bonus_remaining = granted - consumed (consumed is tracked in the lifetime "bonus" ledger).

Lifecycle (one `hold` dict per request, kept on current_user["_credit_holds"][kind])
    reserve  (transaction) check remaining, then park `amount` in `reservations` with an expiry
    confirm  (transaction) move it to `used` (success)
    refund   (transaction) drop it (failure / error / unusable result)
  Two simultaneous requests at remaining=1 cannot both reserve: each transaction reads the doc
  and writes it back, and Firestore serialises conflicting transactions (the loser is retried by
  the client library and then sees remaining=0 -> QuotaExceeded). Reserved units count against
  remaining, so in-flight work is never double-booked.
  A reservation never confirmed/refunded (crash) expires after credit_reservation_ttl_minutes;
  expired reservations are ignored when computing availability and physically removed by the next
  transaction that touches the doc. A confirm that arrives after its reservation was pruned is
  applied unconditionally (the work was done); a refund after pruning is a no-op.

Route integration (unchanged contract)
    @router.post("/x", dependencies=[Depends(enforce_quota("generates"))])
  reserves before the route, confirms when the route returns, refunds on any HTTP error /
  exception. Streaming routes call defer_settlement() before returning the StreamingResponse
  and settle_charge(success=...) when the stream ends (refund_charge() = settle failure).
  entitlements.can() runs FIRST (expired trial -> 402 plan_inactive before any credit logic).
  Manual editing never goes through here, so it never pauses.

TASK-034 hooks: log_usage_event(event) -- one event per settled hold (success or not) with the
plan, workspace, kind, outcome and whatever the route attached via note_usage() (Edo tokens, partial
course summary...). Today it writes one structured logger line "usage_event {...}"; TASK-034 replaces
the body with the UsageLog write.
"""

import calendar
import json
import logging
import time
import uuid
from collections import deque
from datetime import datetime, timedelta, timezone
from typing import Any, Deque, Dict, Optional, Tuple

import firebase_admin
from fastapi import Depends, HTTPException
from firebase_admin import firestore

from firebase.org_registry import get_org_info
from firebase.paths import BONUS_LEDGER_ID, POOL_OWNER_ID, PERSONAL_SPACE_ID, accounts_col, credit_period_doc
from firebase.public_space import PLAN_ORG
from routes.teachers import require_org
from services import accounts_service, entitlements
from services import platform_config as pc

logger = logging.getLogger(__name__)

COURSES = "courses"
GENERATES = "generates"
EDO_MESSAGES = "edo_messages"
KINDS = (COURSES, GENERATES, EDO_MESSAGES)

TRIAL_PERIOD_ID = "trial"


class QuotaExceeded(Exception):
    def __init__(self, kind: str, limit: Optional[int], used: int, resets_at: Optional[str], plan: Optional[str],
                 remaining: int = 0, pool: bool = False, workspace: Optional[str] = None,
                 trial_ends_at: Optional[str] = None):
        super().__init__(f"quota exceeded for {kind}: {used}/{limit}")
        self.kind, self.limit, self.used, self.resets_at, self.plan = kind, limit, used, resets_at, plan
        self.remaining, self.pool, self.workspace, self.trial_ends_at = remaining, pool, workspace, trial_ends_at

    def to_detail(self) -> dict:
        return {"code": "quota_exceeded", "kind": self.kind, "limit": self.limit,
                "used": self.used, "remaining": self.remaining, "resets_at": self.resets_at,
                "plan": self.plan, "pool": self.pool, "workspace": self.workspace,
                "trial_ends_at": self.trial_ends_at}


# ── helpers ─────────────────────────────────────────────────────────────────

def _db():
    if not firebase_admin._apps:
        firebase_admin.initialize_app()
    from firebase.project import firestore_client
    return firestore_client()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(d: Optional[datetime]) -> Optional[str]:
    return d.isoformat() if d is not None else None


def clear_caches() -> None:
    pc.clear_cache()
    accounts_service.clear_cache()


# ── periods ─────────────────────────────────────────────────────────────────

def anniversary(anchor: datetime, n: int) -> datetime:
    """The n-th monthly anniversary of `anchor` at 00:00 UTC. The day is clamped to the target
    month's last day, always computed from the ORIGINAL day (31 Jan, 28 Feb, 31 Mar, 30 Apr...)."""
    total = anchor.year * 12 + (anchor.month - 1) + n
    y, m0 = divmod(total, 12)
    m = m0 + 1
    day = min(anchor.day, calendar.monthrange(y, m)[1])
    return datetime(y, m, day, tzinfo=timezone.utc)


def monthly_period(anchor: Optional[datetime], now: datetime) -> Tuple[datetime, datetime]:
    """(start, end) of the monthly period containing `now`; end is exclusive = the reset instant.
    anchor None -> calendar month."""
    if anchor is None:
        anchor = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
    anchor = accounts_service.as_utc(anchor)
    n = (now.year - anchor.year) * 12 + (now.month - anchor.month)
    n = max(n, 0)
    while n > 0 and anniversary(anchor, n) > now:
        n -= 1
    while anniversary(anchor, n + 1) <= now:
        n += 1
    return anniversary(anchor, n), anniversary(anchor, n + 1)


def _period_id(start: datetime) -> str:
    return start.strftime("%Y-%m-%d")


def resolve_scope(org: str, uid: str, db=None, now: Optional[datetime] = None) -> Dict[str, Any]:
    """Which counters pay for this caller right now, and the numbers around them."""
    db = db or _db()
    now = now or _now()
    cfg = pc.get_config(db)
    calendar_reset = cfg.get("reset_rule") == "calendar"

    if org != PERSONAL_SPACE_ID:
        info = get_org_info(org, db) or {}
        pool = info.get("pool")
        defaults = pc.plan_limits(PLAN_ORG, db)
        limits = {k: (pool.get(k) if isinstance(pool, dict) and k in pool else (None if pool is None else defaults[k]))
                  for k in KINDS}
        anchor = None if calendar_reset else accounts_service.as_utc(info.get("plan_started_at"))
        start, end = monthly_period(anchor, now)
        return {"pool": True, "plan": PLAN_ORG, "workspace": org, "uid": uid, "path_org": org,
                "owner_id": POOL_OWNER_ID, "period_id": _period_id(start), "period_start": start,
                "period_end": end, "resets_at": _iso(end), "trial_ends_at": None, "limits": limits,
                "use_bonus": False}

    account = accounts_service.get_account(uid, db)
    plan = accounts_service.personal_plan(account)
    pcfg = pc.plan_config(plan, db)
    limits = pc.plan_limits(plan, db)
    trial_end = accounts_service.as_utc((account or {}).get("trial_ends_at"))
    if pcfg.get("limit_period") == "one_time":
        start = accounts_service.as_utc((account or {}).get("plan_started_at"))
        return {"pool": False, "plan": plan, "workspace": org, "uid": uid, "path_org": PERSONAL_SPACE_ID,
                "owner_id": uid, "period_id": TRIAL_PERIOD_ID, "period_start": start, "period_end": trial_end,
                "resets_at": None, "trial_ends_at": _iso(trial_end), "limits": limits, "use_bonus": True}
    anchor = None if calendar_reset else accounts_service.as_utc((account or {}).get("plan_started_at"))
    start, end = monthly_period(anchor, now)
    return {"pool": False, "plan": plan, "workspace": org, "uid": uid, "path_org": PERSONAL_SPACE_ID,
            "owner_id": uid, "period_id": _period_id(start), "period_start": start, "period_end": end,
            "resets_at": _iso(end), "trial_ends_at": None, "limits": limits, "use_bonus": True}


def get_plan(org: str, uid: str, db=None) -> Optional[str]:
    """'trial' | 'teacher' for the personal workspace, 'org' in an org workspace."""
    if org != PERSONAL_SPACE_ID:
        return PLAN_ORG
    return accounts_service.personal_plan(accounts_service.get_account(uid, db))


def get_limits(org: str, uid: str, db=None) -> Dict[str, Optional[int]]:
    """{'courses','generates','edo_messages'} -> int or None (unlimited), for the workspace's counters."""
    return dict(resolve_scope(org, uid, db)["limits"])


# ── ledger docs ─────────────────────────────────────────────────────────────

def _ttl(db=None) -> timedelta:
    minutes = pc.get_config(db).get("credit_reservation_ttl_minutes")
    return timedelta(minutes=max(1, int(minutes or 1)))


def _doc(snap) -> Dict[str, Any]:
    d = (snap.to_dict() or {}) if snap.exists else {}
    d["used"] = {k: int(v or 0) for k, v in (d.get("used") or {}).items()}
    d["reservations"] = dict(d.get("reservations") or {})
    return d


def _expired(res: dict, now: datetime) -> bool:
    exp = accounts_service.as_utc(res.get("expires_at"))
    return exp is not None and exp <= now


def _prune(d: dict, now: datetime) -> None:
    """Lazy release: drop reservations past their expiry."""
    d["reservations"] = {rid: r for rid, r in d["reservations"].items() if not _expired(r, now)}


def _held(d: dict, kind: str, now: datetime) -> int:
    return sum(int(r.get("amount") or 0) for r in d["reservations"].values()
               if r.get("kind") == kind and not _expired(r, now))


def _refs(scope: dict, db) -> Dict[str, Any]:
    period = credit_period_doc(db, scope["path_org"], scope["owner_id"], scope["period_id"])
    if not scope["use_bonus"]:
        return {"period": period, "bonus": None, "acct": None}
    return {"period": period,
            "bonus": credit_period_doc(db, PERSONAL_SPACE_ID, scope["uid"], BONUS_LEDGER_ID),
            "acct": accounts_col(db).document(scope["uid"])}


def _granted(snap, kind: str) -> int:
    return int((((snap.to_dict() or {}) if snap.exists else {}).get("bonus_credits") or {}).get(kind) or 0)


# ── transactions ────────────────────────────────────────────────────────────

def _reserve_txn(transaction, ctx):
    """Reads first, then writes (Firestore requirement). Pure function of what it reads, so a
    retry by the transaction decorator is safe."""
    now, kind, amount, limit, scope, refs = ctx["now"], ctx["kind"], ctx["amount"], ctx["limit"], ctx["scope"], ctx["refs"]
    pd = _doc(refs["period"].get(transaction=transaction))
    used, held = pd["used"].get(kind, 0), _held(pd, kind, now)
    if limit is None:
        plan_part, bonus_part = amount, 0
    else:
        plan_part = min(amount, max(0, limit - used - held))
        bonus_part = amount - plan_part

    bd = None
    bonus_remaining = 0
    if refs["bonus"] is not None:
        granted = _granted(refs["acct"].get(transaction=transaction), kind)
        bd = _doc(refs["bonus"].get(transaction=transaction))
        bonus_remaining = max(0, granted - bd["used"].get(kind, 0) - _held(bd, kind, now))
    if bonus_part > bonus_remaining:
        raise QuotaExceeded(kind, limit, used, scope["resets_at"], scope["plan"], remaining=0,
                            pool=scope["pool"], workspace=scope["workspace"], trial_ends_at=scope["trial_ends_at"])

    rid, entry = ctx["rid"], {"kind": kind, "created_at": now, "expires_at": now + ctx["ttl"]}
    _prune(pd, now)
    if plan_part:
        pd["reservations"][rid] = {**entry, "amount": plan_part}
    pd.update({"period_id": scope["period_id"], "period_start": scope["period_start"],
               "period_end": scope["period_end"], "plan": scope["plan"], "updated_at": now})
    transaction.set(refs["period"], pd)
    if bonus_part:
        _prune(bd, now)
        bd["reservations"][rid] = {**entry, "amount": bonus_part}
        bd["updated_at"] = now
        transaction.set(refs["bonus"], bd)
    return plan_part, bonus_part


def _confirm_txn(transaction, ctx):
    now, hold, refs = ctx["now"], ctx["hold"], ctx["refs"]
    kind, rid = hold["kind"], hold["rid"]
    pd = _doc(refs["period"].get(transaction=transaction)) if hold["plan_part"] else None
    bd = _doc(refs["bonus"].get(transaction=transaction)) if hold["bonus_part"] else None
    if pd is not None:
        pd["reservations"].pop(rid, None)       # already pruned -> late confirm, still counted
        _prune(pd, now)
        pd["used"][kind] = pd["used"].get(kind, 0) + hold["plan_part"]
        if hold["pool"]:
            by_user = dict(pd.get("by_user") or {})
            u = dict(by_user.get(hold["uid"]) or {})
            u[kind] = int(u.get(kind) or 0) + hold["plan_part"]
            by_user[hold["uid"]] = u
            pd["by_user"] = by_user
        pd["updated_at"] = now
        transaction.set(refs["period"], pd)
    if bd is not None:
        bd["reservations"].pop(rid, None)
        _prune(bd, now)
        bd["used"][kind] = bd["used"].get(kind, 0) + hold["bonus_part"]
        bd["updated_at"] = now
        transaction.set(refs["bonus"], bd)


def _refund_txn(transaction, ctx):
    now, hold, refs = ctx["now"], ctx["hold"], ctx["refs"]
    rid = hold["rid"]
    pd = _doc(refs["period"].get(transaction=transaction)) if hold["plan_part"] else None
    bd = _doc(refs["bonus"].get(transaction=transaction)) if hold["bonus_part"] else None
    if pd is not None:
        pd["reservations"].pop(rid, None)
        _prune(pd, now)
        pd["updated_at"] = now
        transaction.set(refs["period"], pd)
    if bd is not None:
        bd["reservations"].pop(rid, None)
        _prune(bd, now)
        bd["updated_at"] = now
        transaction.set(refs["bonus"], bd)


def _run(fn, db, ctx):
    return firestore.transactional(fn)(db.transaction(), ctx)


# ── reserve / confirm / refund ──────────────────────────────────────────────

def reserve(org: str, uid: str, kind: str, amount: int = 1, db=None, now: Optional[datetime] = None) -> Dict[str, Any]:
    """Check + reserve `amount` credits of `kind` for the caller. Raises QuotaExceeded when the
    counters (plan allowance, then bonus credits) cannot cover it. Returns the hold."""
    if kind not in KINDS:
        raise ValueError(f"unknown credit kind: {kind}")
    db = db or _db()
    now = now or _now()
    scope = resolve_scope(org, uid, db, now)
    refs = _refs(scope, db)
    rid = uuid.uuid4().hex
    ctx = {"now": now, "kind": kind, "amount": int(amount), "limit": scope["limits"][kind], "scope": scope,
           "refs": refs, "rid": rid, "ttl": _ttl(db)}
    plan_part, bonus_part = _run(_reserve_txn, db, ctx)
    return {"rid": rid, "kind": kind, "amount": int(amount), "plan_part": plan_part, "bonus_part": bonus_part,
            "uid": uid, "org": org, "pool": scope["pool"], "plan": scope["plan"], "path_org": scope["path_org"],
            "owner_id": scope["owner_id"], "period_id": scope["period_id"], "use_bonus": scope["use_bonus"],
            "deferred": False, "detail": {}}


def _hold_ctx(hold: dict, db) -> dict:
    scope = {"path_org": hold["path_org"], "owner_id": hold["owner_id"], "period_id": hold["period_id"],
             "use_bonus": hold["use_bonus"], "uid": hold["uid"]}
    return {"now": _now(), "hold": hold, "refs": _refs(scope, db)}


def confirm(hold: dict, db=None) -> None:
    """Turn the reservation into usage (late confirms are still counted)."""
    db = db or _db()
    _run(_confirm_txn, db, _hold_ctx(hold, db))


def refund(hold: dict, db=None) -> None:
    """Release the reservation. Best effort: never raises (an unreleased one expires by itself)."""
    try:
        db = db or _db()
        _run(_refund_txn, db, _hold_ctx(hold, db))
    except Exception as e:  # noqa: BLE001
        logger.warning("credit refund failed (%s %s %s): %s", hold.get("org"), hold.get("uid"), hold.get("kind"), e)


# ── views ───────────────────────────────────────────────────────────────────

def usage_overview(org: str, uid: str, db=None, now: Optional[datetime] = None) -> Dict[str, Any]:
    """Counters per kind for the workspace's scope: {kind: {limit, used, reserved, remaining,
    bonus_remaining, resets_at}} plus plan/period/workspace/pool. remaining counts reservations
    in flight and bonus credits; None = unlimited."""
    db = db or _db()
    now = now or _now()
    scope = resolve_scope(org, uid, db, now)
    refs = _refs(scope, db)
    pd = _doc(refs["period"].get())
    bd = _doc(refs["bonus"].get()) if refs["bonus"] is not None else None
    acct = refs["acct"].get() if refs["acct"] is not None else None
    credits = {}
    for k in KINDS:
        limit = scope["limits"][k]
        used, reserved = pd["used"].get(k, 0), _held(pd, k, now)
        bonus_rem = 0
        if bd is not None:
            bonus_rem = max(0, _granted(acct, k) - bd["used"].get(k, 0) - _held(bd, k, now))
        remaining = None if limit is None else max(0, limit - used - reserved) + bonus_rem
        credits[k] = {"limit": limit, "used": used, "reserved": reserved, "remaining": remaining,
                      "bonus_remaining": bonus_rem, "resets_at": scope["resets_at"]}
    return {"plan": scope["plan"], "workspace": org, "pool": scope["pool"],
            "space": "org" if scope["pool"] else "personal",
            "period_start": _iso(scope["period_start"]), "period_end": _iso(scope["period_end"]),
            "resets_at": scope["resets_at"], "trial_ends_at": scope["trial_ends_at"], "credits": credits}


def get_usage(org: str, uid: str, db=None, now: Optional[datetime] = None) -> Dict[str, int]:
    """Plan-allowance units used in the current period, per kind."""
    ov = usage_overview(org, uid, db, now)
    return {k: ov["credits"][k]["used"] for k in KINDS}


# ── TASK-034 hooks ──────────────────────────────────────────────────────────

def log_usage_event(event: Dict[str, Any]) -> None:
    """TASK-034 HOOK. One event per settled credit hold. Today: a structured logger line.
    TASK-034 replaces the body with a write to UsageLog/{autoId} (user, plan, action, course id,
    Browserbase counts, model, tokens, success, timestamp). Never raises."""
    try:
        logger.info("usage_event %s", json.dumps(event, default=str, sort_keys=True))
    except Exception as e:  # noqa: BLE001
        logger.warning("usage event log failed: %s", e)


def note_usage(current_user: dict, kind: str, **fields: Any) -> None:
    """Attach details (Edo tokens, model, partial-course summary, course id...) to the hold for
    `kind`; they ride along in the usage_event emitted when it settles. No-op without a hold."""
    hold = (current_user.get("_credit_holds") or {}).get(kind)
    if hold is not None:
        hold["detail"].update(fields)


# ── settle (route-facing) ───────────────────────────────────────────────────

def defer_settlement(current_user: dict, kind: str) -> None:
    """Streaming routes: call before returning the StreamingResponse. The dependency then does
    NOT confirm on return; the stream must call settle_charge()/refund_charge() when it ends
    (an unsettled hold expires after the reservation TTL)."""
    hold = (current_user.get("_credit_holds") or {}).get(kind)
    if hold is not None:
        hold["deferred"] = True


def settle_charge(current_user: dict, kind: str, success: bool, **detail: Any) -> None:
    """Confirm (success) or refund (failure) the hold for `kind`, once per request; then emit the
    usage event. Safe to call when nothing was reserved (fail-open / already settled)."""
    holds = current_user.get("_credit_holds") or {}
    hold = holds.pop(kind, None)
    if hold is None:
        return
    hold["detail"].update(detail)
    try:
        if success:
            confirm(hold)
        else:
            refund(hold)
    except Exception as e:  # noqa: BLE001  (the reservation will simply expire)
        logger.warning("credit settle failed (%s %s %s success=%s): %s", hold["org"], hold["uid"], kind, success, e)
    log_usage_event({"uid": hold["uid"], "workspace": hold["org"], "plan": hold["plan"], "pool": hold["pool"],
                     "kind": kind, "amount": hold["amount"], "success": bool(success),
                     "charged": bool(success), "at": _now().isoformat(), **hold["detail"]})


def refund_charge(current_user: dict, kind: str) -> None:
    """Refund the reservation this request made for `kind` (once)."""
    settle_charge(current_user, kind, False)


def confirm_charge(current_user: dict, kind: str, **detail: Any) -> None:
    settle_charge(current_user, kind, True, **detail)


# ── "usable course" (Generate Course billing rule) ──────────────────────────

def outline_is_usable(outline: Any) -> bool:
    """A usable outline has at least one section (legacy 'sections' or builder 'days') with a title."""
    if not isinstance(outline, dict):
        return False
    items = outline.get("sections") or outline.get("days") or []
    return any(isinstance(s, dict) and str(s.get("title") or "").strip() for s in items)


def outlines_are_usable(outlines: Any) -> bool:
    """Course Builder: at least one candidate outline is usable."""
    return isinstance(outlines, list) and any(outline_is_usable(o) for o in outlines)


# ── FastAPI dependencies ────────────────────────────────────────────────────

def enforce_quota(kind: str):
    """Dependency factory: reserve 1 credit of `kind` before the route runs; confirm when the
    route returns; refund if it raises (HTTP error or crash). Streaming routes call
    defer_settlement() and settle themselves. 402 quota_exceeded when nothing is left."""
    if kind not in KINDS:
        raise ValueError(f"unknown quota kind: {kind}")

    async def dep(current_user: dict = Depends(require_org)):
        org, uid = current_user["org"], current_user["uid"]
        # Plan/state gate BEFORE any credit logic (expired trial -> 402 plan_inactive).
        entitlements.enforce(current_user, entitlements.QUOTA_KIND_ACTION[kind])
        try:
            hold = reserve(org, uid, kind, 1)
            current_user.setdefault("_credit_holds", {})[kind] = hold
        except QuotaExceeded:
            raise
        except Exception as e:  # noqa: BLE001
            # Fail open on infrastructure errors (logged; nothing was reserved or charged).
            logger.warning("credit reserve failed open (%s %s %s): %s", org, uid, kind, e)
        try:
            yield current_user
        except BaseException:
            settle_charge(current_user, kind, False)   # route rejected/failed: no result delivered
            raise
        hold = (current_user.get("_credit_holds") or {}).get(kind)
        if hold is not None and not hold["deferred"]:
            settle_charge(current_user, kind, True)

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
