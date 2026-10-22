# backend/services/usage_report.py
"""
Read side of the cost log (TASK-034): query `UsageLog` and aggregate it for the admin routes.

Bounded on purpose: at most MAX_SCAN of the NEWEST rows inside the date window are read (one
single-field range query ordered by `at`, which needs no composite index); uid / action filters
and every aggregate are computed in Python over that set. `truncated: true` in the response means
the window held more rows than were scanned. Fine at current scale; move to a scheduled rollup
(or BigQuery export) before the log grows past a few thousand rows per window.
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from firebase.paths import usage_log_col

MAX_SCAN = 5000
DEFAULT_WINDOW_DAYS = 30


def parse_bound(value: Optional[str], end_of_day: bool = False) -> Optional[datetime]:
    """ISO date or datetime -> aware UTC datetime. A date-only upper bound is inclusive (end of that day)."""
    if not value:
        return None
    v = value.strip()
    date_only = len(v) <= 10
    d = datetime.fromisoformat(v.replace("Z", "+00:00"))
    if d.tzinfo is None:
        d = d.replace(tzinfo=timezone.utc)
    d = d.astimezone(timezone.utc)
    if date_only and end_of_day:
        d = d + timedelta(days=1)       # exclusive upper bound = next midnight
    return d


def window(frm: Optional[str], to: Optional[str], now: Optional[datetime] = None) -> Tuple[datetime, datetime]:
    now = now or datetime.now(timezone.utc)
    end = parse_bound(to, end_of_day=True) or (now + timedelta(seconds=1))
    start = parse_bound(frm) or (end - timedelta(days=DEFAULT_WINDOW_DAYS))
    return start, end


def _iso(v: Any) -> Any:
    return v.isoformat() if isinstance(v, datetime) else v


def fetch_rows(db, start: datetime, end: datetime, uid: Optional[str] = None, action: Optional[str] = None,
               scan_limit: int = MAX_SCAN) -> Tuple[List[Dict[str, Any]], bool]:
    """Newest-first rows in [start, end), filtered in Python. Returns (rows, truncated)."""
    q = usage_log_col(db).where("at", ">=", start).where("at", "<", end).order_by("at", direction="DESCENDING")
    snaps = list(q.limit(scan_limit + 1).stream())
    truncated = len(snaps) > scan_limit
    rows = []
    for s in snaps[:scan_limit]:
        d = s.to_dict() or {}
        if uid and d.get("uid") != uid:
            continue
        if action and d.get("action") != action:
            continue
        d["id"] = s.id
        rows.append(d)
    return rows, truncated


def serialize(row: Dict[str, Any]) -> Dict[str, Any]:
    out = dict(row)
    out["at"] = _iso(out.get("at"))
    return out


CSV_FIELDS = ["at", "uid", "email_domain", "plan", "workspace", "pool", "action", "credit_kind", "charged",
              "course_id", "success", "error_code", "duration_ms", "bb_search", "bb_fetch", "bb_render_pages",
              "bb_sessions", "bb_session_seconds", "llm_calls", "prompt_tokens", "completion_tokens",
              "total_tokens", "models", "est_cost_llm", "est_cost_browserbase", "est_cost_total", "partial"]


def flatten(row: Dict[str, Any]) -> Dict[str, Any]:
    bb, llm, est = row.get("browserbase") or {}, row.get("llm") or {}, row.get("est_cost_usd") or {}
    by_model = llm.get("by_model") or {}
    return {
        "at": _iso(row.get("at")), "uid": row.get("uid"), "email_domain": row.get("email_domain"),
        "plan": row.get("plan"), "workspace": row.get("workspace"), "pool": row.get("pool"),
        "action": row.get("action"), "credit_kind": row.get("credit_kind"), "charged": row.get("charged"),
        "course_id": row.get("course_id"), "success": row.get("success"), "error_code": row.get("error_code"),
        "duration_ms": row.get("duration_ms"),
        "bb_search": bb.get("search", 0), "bb_fetch": bb.get("fetch", 0),
        "bb_render_pages": bb.get("render_pages", 0), "bb_sessions": bb.get("sessions", 0),
        "bb_session_seconds": bb.get("session_seconds", 0),
        "llm_calls": llm.get("calls", 0),
        "prompt_tokens": sum(int(m.get("prompt") or 0) for m in by_model.values()),
        "completion_tokens": sum(int(m.get("completion") or 0) for m in by_model.values()),
        "total_tokens": llm.get("total_tokens", 0),
        "models": ";".join(sorted(by_model)),
        "est_cost_llm": est.get("llm", 0), "est_cost_browserbase": est.get("browserbase", 0),
        "est_cost_total": est.get("total", 0),
        "partial": "" if not row.get("partial") else str(row.get("partial")),
    }


# ── aggregation ─────────────────────────────────────────────────────────────

def _num(v: Any) -> float:
    try:
        return float(v or 0)
    except (TypeError, ValueError):
        return 0.0


class _Agg:
    def __init__(self):
        self.count = self.ok = self.charged = 0
        self.tokens = self.prompt = self.completion = 0
        self.search = self.fetch = self.render = self.sessions = self.llm_calls = 0
        self.cost = self.cost_llm = self.cost_bb = self.cost_failed = 0.0
        self.with_bb = 0
        self.meta: Dict[str, Any] = {}

    def add(self, r: Dict[str, Any]) -> None:
        bb, llm, est = r.get("browserbase") or {}, r.get("llm") or {}, r.get("est_cost_usd") or {}
        self.count += 1
        self.ok += 1 if r.get("success") else 0
        self.charged += 1 if r.get("charged") else 0
        self.tokens += int(_num(llm.get("total_tokens")))
        for m in (llm.get("by_model") or {}).values():
            self.prompt += int(_num(m.get("prompt")))
            self.completion += int(_num(m.get("completion")))
        self.llm_calls += int(_num(llm.get("calls")))
        self.search += int(_num(bb.get("search")))
        self.fetch += int(_num(bb.get("fetch")))
        self.render += int(_num(bb.get("render_pages")))
        self.sessions += int(_num(bb.get("sessions")))
        self.with_bb += 1 if r.get("used_browserbase") else 0
        total = _num(est.get("total"))
        self.cost += total
        self.cost_llm += _num(est.get("llm"))
        self.cost_bb += _num(est.get("browserbase"))
        if not r.get("success"):
            self.cost_failed += total

    def out(self) -> Dict[str, Any]:
        n = max(self.count, 1)

        def pair(total):
            return {"sum": round(total, 6), "avg": round(total / n, 6)}
        return {
            **self.meta,
            "count": self.count,
            "success_count": self.ok,
            "success_rate": round(self.ok / n, 4) if self.count else None,
            "charged_count": self.charged,
            "tokens": {"sum": self.tokens, "avg": round(self.tokens / n, 1),
                       "prompt_sum": self.prompt, "completion_sum": self.completion},
            "llm_calls": pair(self.llm_calls),
            "bb_search": pair(self.search),
            "bb_fetch": pair(self.fetch),
            "bb_render_pages": pair(self.render),
            "bb_sessions": pair(self.sessions),
            "requests_using_browserbase": self.with_bb,
            "est_cost_usd": {**pair(self.cost), "llm_sum": round(self.cost_llm, 6),
                             "browserbase_sum": round(self.cost_bb, 6),
                             "failed_sum": round(self.cost_failed, 6)},
        }


def _group(rows: List[Dict[str, Any]], key, meta) -> List[Dict[str, Any]]:
    groups: Dict[Any, _Agg] = {}
    for r in rows:
        k = key(r)
        a = groups.get(k)
        if a is None:
            a = groups[k] = _Agg()
            a.meta = meta(r)
        a.add(r)
    out = [a.out() for a in groups.values()]
    out.sort(key=lambda g: g["est_cost_usd"]["sum"], reverse=True)
    return out


def summarize(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    by_action = _group(rows, lambda r: (r.get("action"), r.get("credit_kind")),
                       lambda r: {"action": r.get("action"), "credit_kind": r.get("credit_kind")})
    by_user = _group(rows, lambda r: r.get("uid"),
                     lambda r: {"uid": r.get("uid"), "email_domain": r.get("email_domain"), "plan": r.get("plan")})
    by_kind = _group(rows, lambda r: r.get("credit_kind"), lambda r: {"credit_kind": r.get("credit_kind")})
    for g in by_kind:
        # what one CREDIT of this kind costs us: all spend on the kind (failures included, since they are
        # refunded and so absorbed by us) divided by the credits actually charged
        charged = g["charged_count"]
        g["est_cost_per_charged_credit_usd"] = round(g["est_cost_usd"]["sum"] / charged, 6) if charged else None
    total = _Agg()
    for r in rows:
        total.add(r)
    return {"totals": total.out(), "by_action": by_action, "by_user": by_user, "by_credit_kind": by_kind}
