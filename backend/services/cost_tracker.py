# backend/services/cost_tracker.py
"""
Per-request cost collector (TASK-034).

One `CostTracker` is started at the beginning of each AI request (by the `enforce_quota` /
`throttle_chips` / `track_ai` dependencies in services/usage_service.py). It accumulates what the
request cost us: Browserbase search / fetch / render-session usage and every LLM call's model and
token usage. When the request settles, usage_service.log_usage_event turns it into a `UsageLog` row.

How counts reach the right request
    * The tracker lives in a `ContextVar` and is a MUTABLE object, so any copy of the context
      (asyncio tasks, anyio threadpool, StreamingResponse iteration) shares the same instance.
    * `concurrent.futures.ThreadPoolExecutor.submit` does NOT copy the context by itself, so
      `loop.run_in_executor(None, ...)` and the ThreadPoolExecutors in the populator would lose it.
      `install_context_propagation()` (run once, at import) wraps `submit` so every submitted job
      runs in a copy of the SUBMITTER's context. `asyncio.to_thread` and anyio already do this.
    * The Browserbase browser pool keeps its own explicit reference to the tracker as well.
    * Two concurrent requests have two trackers (each request task has its own context), so counts
      never mix; counters are guarded by a lock because several threads write to one tracker.

Never raises: every public function is wrapped; instrumentation must not break the caller.
No prices live here. Rates come from platform_config["cost_rates"] (placeholders until filled in).
"""

import contextvars
import functools
import logging
import threading
import time
from concurrent.futures import Future, ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Set

logger = logging.getLogger(__name__)

_current: "contextvars.ContextVar[Optional[CostTracker]]" = contextvars.ContextVar("edcube_cost_tracker", default=None)


class CostTracker:
    def __init__(self, action: Optional[str] = None, uid: Optional[str] = None, email: Optional[str] = None,
                 workspace: Optional[str] = None, credit_kind: Optional[str] = None,
                 course_id: Optional[str] = None):
        self.action = action
        self.uid = uid
        self.email_domain = (email.split("@", 1)[1].lower() if isinstance(email, str) and "@" in email else None)
        self.workspace = workspace
        self.credit_kind = credit_kind
        self.course_id = course_id
        self.started = time.monotonic()
        self.started_at = datetime.now(timezone.utc)
        self.lock = threading.Lock()
        self.search = 0
        self.fetch = 0
        self.render_pages = 0
        self.sessions = 0
        self.session_seconds = 0.0
        self.llm_calls = 0
        self.by_model: Dict[str, Dict[str, int]] = {}
        self.logged = False        # exactly-once guard for the UsageLog write
        self.deferred = False      # a streaming route will finish this tracker itself

    # -- recording (thread-safe) --
    def add_llm(self, model: str, prompt: int, completion: int, total: int) -> None:
        with self.lock:
            self.llm_calls += 1
            m = self.by_model.setdefault(model or "unknown", {"prompt": 0, "completion": 0, "total": 0})
            m["prompt"] += prompt
            m["completion"] += completion
            m["total"] += total

    def bump(self, field: str, n: float = 1) -> None:
        with self.lock:
            setattr(self, field, getattr(self, field) + n)

    def has_activity(self) -> bool:
        return bool(self.search or self.fetch or self.render_pages or self.sessions or self.llm_calls)

    def claim_log(self) -> bool:
        """True exactly once."""
        with self.lock:
            if self.logged:
                return False
            self.logged = True
            return True

    # -- views --
    def browserbase(self) -> Dict[str, Any]:
        with self.lock:
            return {"search": self.search, "fetch": self.fetch, "render_pages": self.render_pages,
                    "sessions": self.sessions, "session_seconds": round(self.session_seconds, 1)}

    def llm(self) -> Dict[str, Any]:
        with self.lock:
            by_model = {k: dict(v) for k, v in self.by_model.items()}
            return {"calls": self.llm_calls, "by_model": by_model,
                    "total_tokens": sum(v["total"] for v in by_model.values())}

    def duration_ms(self) -> int:
        return int((time.monotonic() - self.started) * 1000)


# ── context access ──────────────────────────────────────────────────────────

def start(action: Optional[str] = None, current_user: Optional[dict] = None, credit_kind: Optional[str] = None,
          course_id: Optional[str] = None) -> Optional[CostTracker]:
    """Begin tracking the current request. Also stores the tracker on current_user["_cost"] so
    code that only holds the user dict (stream generators) can reach it. Never raises."""
    try:
        cu = current_user or {}
        t = CostTracker(action=action, uid=cu.get("uid"), email=cu.get("email"), workspace=cu.get("org"),
                        credit_kind=credit_kind, course_id=course_id)
        _current.set(t)
        if current_user is not None:
            current_user["_cost"] = t
        return t
    except Exception as e:  # noqa: BLE001
        logger.warning("cost tracker start failed: %s", e)
        return None


def current() -> Optional[CostTracker]:
    try:
        return _current.get()
    except Exception:  # noqa: BLE001
        return None


def for_user(current_user: Optional[dict]) -> Optional[CostTracker]:
    """The tracker for this request: the one on current_user, else the context's."""
    try:
        return (current_user or {}).get("_cost") or current()
    except Exception:  # noqa: BLE001
        return None


def set_course(course_id: Optional[str], tracker: Optional[CostTracker] = None) -> None:
    try:
        t = tracker or current()
        if t is not None and course_id and not t.course_id:
            t.course_id = str(course_id)
    except Exception:  # noqa: BLE001
        pass


def _target(tracker: Optional[CostTracker]) -> Optional[CostTracker]:
    return tracker if tracker is not None else current()


# ── recorders (all defensive) ───────────────────────────────────────────────

def record_search(tracker: Optional[CostTracker] = None) -> None:
    try:
        t = _target(tracker)
        if t is not None:
            t.bump("search")
    except Exception:  # noqa: BLE001
        pass


def record_fetch(tracker: Optional[CostTracker] = None) -> None:
    try:
        t = _target(tracker)
        if t is not None:
            t.bump("fetch")
    except Exception:  # noqa: BLE001
        pass


def record_render_page(tracker: Optional[CostTracker] = None) -> None:
    try:
        t = _target(tracker)
        if t is not None:
            t.bump("render_pages")
    except Exception:  # noqa: BLE001
        pass


def record_session(tracker: Optional[CostTracker] = None) -> None:
    try:
        t = _target(tracker)
        if t is not None:
            t.bump("sessions")
    except Exception:  # noqa: BLE001
        pass


def record_session_seconds(seconds: float, tracker: Optional[CostTracker] = None) -> None:
    try:
        t = _target(tracker)
        if t is not None and seconds and seconds > 0:
            t.bump("session_seconds", float(seconds))
    except Exception:  # noqa: BLE001
        pass


def record_llm(response: Any, model: Optional[str] = None, tracker: Optional[CostTracker] = None) -> None:
    """Read `response.usage` from an OpenAI chat completion (or dict) and add it to the tracker.
    `model` (the requested model) is preferred as the key; falls back to response.model."""
    try:
        t = _target(tracker)
        if t is None:
            return
        usage = getattr(response, "usage", None)
        if usage is None and isinstance(response, dict):
            usage = response.get("usage")

        def _n(name: str) -> int:
            v = usage.get(name) if isinstance(usage, dict) else getattr(usage, name, None)
            return int(v or 0)

        prompt, completion = _n("prompt_tokens"), _n("completion_tokens")
        total = _n("total_tokens") or (prompt + completion)
        name = model or (response.get("model") if isinstance(response, dict) else getattr(response, "model", None))
        t.add_llm(str(name or "unknown"), prompt, completion, total)
    except Exception as e:  # noqa: BLE001
        logger.debug("record_llm failed: %s", e)


# ── thread propagation ──────────────────────────────────────────────────────

_PATCHED = False


def install_context_propagation() -> None:
    """Make ThreadPoolExecutor.submit run each job in a copy of the submitter's context (what
    asyncio.to_thread and anyio already do). Covers loop.run_in_executor and the populator's own
    thread pools. Idempotent."""
    global _PATCHED
    if _PATCHED:
        return
    _PATCHED = True
    original = ThreadPoolExecutor.submit

    @functools.wraps(original)
    def submit(self, fn, /, *args, **kwargs):
        try:
            ctx = contextvars.copy_context()
        except Exception:  # noqa: BLE001
            return original(self, fn, *args, **kwargs)
        return original(self, ctx.run, fn, *args, **kwargs)

    ThreadPoolExecutor.submit = submit


install_context_propagation()


# ── event fields / finishing ────────────────────────────────────────────────

def event_fields(tracker: Optional[CostTracker]) -> Dict[str, Any]:
    """What the tracker adds to a usage event."""
    if tracker is None:
        return {}
    try:
        out = {"browserbase": tracker.browserbase(), "llm": tracker.llm(), "duration_ms": tracker.duration_ms(),
               "email_domain": tracker.email_domain}
        if tracker.action:
            out["action"] = tracker.action
        if tracker.course_id:
            out["course_id"] = tracker.course_id
        if tracker.credit_kind:
            out["credit_kind"] = tracker.credit_kind
        return out
    except Exception:  # noqa: BLE001
        return {}


def defer(current_user: Optional[dict]) -> None:
    """Streaming route without a credit hold: it will call finish_stream() when the stream ends."""
    try:
        t = for_user(current_user)
        if t is not None:
            t.deferred = True
    except Exception:  # noqa: BLE001
        pass


# ── cost estimate ───────────────────────────────────────────────────────────

def _num(v: Any) -> float:
    try:
        return float(v or 0)
    except (TypeError, ValueError):
        return 0.0


def _model_rate(models: Dict[str, Any], model: str) -> Dict[str, Any]:
    m = (model or "").lower()
    lowered = {str(k).lower(): v for k, v in (models or {}).items()}
    if m in lowered:
        return lowered[m]
    best = None
    for k in lowered:   # dated variants ("gpt-4o-2024-08-06") use the longest matching prefix
        if k != "default" and m.startswith(k) and (best is None or len(k) > len(best)):
            best = k
    return lowered[best] if best else (lowered.get("default") or {})


def estimate_cost(browserbase: Dict[str, Any], llm: Dict[str, Any], rates: Optional[Dict[str, Any]]) -> Dict[str, float]:
    """USD estimate from platform_config["cost_rates"]. Returns {llm, browserbase, total}; zero when
    the rates are unset. Pure function."""
    rates = rates or {}
    llm_cost = 0.0
    for model, u in ((llm or {}).get("by_model") or {}).items():
        r = _model_rate(rates.get("llm_per_1m_tokens") or {}, model)
        llm_cost += (_num(u.get("prompt")) * _num(r.get("input")) + _num(u.get("completion")) * _num(r.get("output"))) / 1_000_000
    bb = rates.get("browserbase") or {}
    b = browserbase or {}
    bb_cost = (_num(b.get("search")) * _num(bb.get("per_search")) + _num(b.get("fetch")) * _num(bb.get("per_fetch"))
               + _num(b.get("render_pages")) * _num(bb.get("per_render_page"))
               + _num(b.get("sessions")) * _num(bb.get("per_session"))
               + (_num(b.get("session_seconds")) / 60.0) * _num(bb.get("per_session_minute")))
    return {"llm": round(llm_cost, 6), "browserbase": round(bb_cost, 6), "total": round(llm_cost + bb_cost, 6)}


# ── UsageLog record + write ─────────────────────────────────────────────────

def build_record(event: Dict[str, Any], db=None) -> Dict[str, Any]:
    """Map a usage event to the UsageLog document (adds plan lookup + cost estimate)."""
    from services import platform_config as pc
    bb = {"search": 0, "fetch": 0, "render_pages": 0, "sessions": 0, "session_seconds": 0.0}
    bb.update(event.get("browserbase") or {})
    llm = event.get("llm") or {"calls": 0, "by_model": {}, "total_tokens": 0}
    llm = {"calls": llm.get("calls", 0), "by_model": llm.get("by_model") or {}, "total_tokens": llm.get("total_tokens", 0)}

    plan = event.get("plan")
    pool = event.get("pool")
    workspace = event.get("workspace")
    if plan is None and event.get("uid") and workspace:
        try:
            from services import usage_service as us
            plan = us.get_plan(workspace, event["uid"], db)
            pool = workspace != "personal"
        except Exception as e:  # noqa: BLE001
            logger.debug("usage log plan lookup failed: %s", e)

    rates = (pc.get_config(db) or {}).get("cost_rates") or {}
    est = estimate_cost(bb, llm, rates)
    at = event.get("at")
    if isinstance(at, str):
        try:
            at = datetime.fromisoformat(at)
        except ValueError:
            at = None
    detail_keys = {"model", "tokens", "prompt_tokens", "completion_tokens"}  # legacy Edo note; superseded by llm{}
    rec = {
        "uid": event.get("uid"),
        "email_domain": event.get("email_domain"),
        "plan": plan,
        "workspace": workspace,
        "pool": bool(pool),
        "action": event.get("action") or event.get("kind"),
        "credit_kind": event.get("credit_kind") or event.get("kind"),
        "charged": bool(event.get("charged")),
        "course_id": event.get("course_id"),
        "browserbase": bb,
        "used_browserbase": bool(bb["search"] or bb["fetch"] or bb["render_pages"] or bb["sessions"]),
        "llm": llm,
        "success": bool(event.get("success")),
        "error_code": event.get("error_code"),
        "partial": event.get("partial"),
        "duration_ms": event.get("duration_ms"),
        "at": at or datetime.now(timezone.utc),
        "est_cost_usd": est,
        "est_cost_is_placeholder": bool(rates.get("is_placeholder", True)),
    }
    extra = {k: v for k, v in event.items() if k in detail_keys and v is not None}
    if extra:
        rec["edo_note"] = extra
    return rec


_writer = ThreadPoolExecutor(max_workers=2, thread_name_prefix="usage-log")
_pending: Set[Future] = set()
_pending_lock = threading.Lock()


def _write_now(event: Dict[str, Any]) -> None:
    try:
        import firebase_admin
        if not firebase_admin._apps:
            firebase_admin.initialize_app()
        from firebase.paths import usage_log_col
        from firebase.project import firestore_client
        db = firestore_client()
        usage_log_col(db).add(build_record(event, db))
    except Exception as e:  # noqa: BLE001  (fail open: never breaks a request)
        logger.warning("UsageLog write failed: %s", e)


def write_async(event: Dict[str, Any]) -> None:
    """Best-effort background write: the request never waits for Firestore. Never raises."""
    try:
        fut = _writer.submit(_write_now, event)
        with _pending_lock:
            _pending.add(fut)
        fut.add_done_callback(lambda f: _pending.discard(f))
    except Exception as e:  # noqa: BLE001
        logger.warning("UsageLog enqueue failed: %s", e)


def flush(timeout: float = 10.0) -> None:
    """Wait for queued writes (tests, graceful shutdown)."""
    deadline = time.monotonic() + timeout
    while True:
        with _pending_lock:
            pending = list(_pending)
        if not pending or time.monotonic() > deadline:
            return
        for f in pending:
            try:
                f.result(timeout=max(0.01, deadline - time.monotonic()))
            except Exception:  # noqa: BLE001
                pass


def error_code_of(exc: BaseException) -> str:
    """Stable short code for a failure: HTTPException detail code / status, else the class name."""
    try:
        detail = getattr(exc, "detail", None)
        if isinstance(detail, dict) and detail.get("code"):
            return str(detail["code"])
        status = getattr(exc, "status_code", None)
        if status:
            return f"http_{status}"
        return type(exc).__name__
    except Exception:  # noqa: BLE001
        return "error"
