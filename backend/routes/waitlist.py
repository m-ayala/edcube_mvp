# backend/routes/waitlist.py
"""
Paid / enterprise waitlist (TASK-032). There is no payment flow: this only records interest.

POST /api/waitlist        open (no auth needed, so the signup page can use it before an account
                          exists). If a valid Firebase token is sent, the uid is attached.
    body: {name, email, interest: "teacher"|"organization", org_name?, staff_size?, role?,
           note?, source?}
    -> 200 {"success": true}; 422 invalid fields; 429 {"code": "rate_limited"} (per IP and per email).
GET  /api/admin/waitlist  require_admin. Newest first. ?interest=teacher|organization, ?limit=,
                          ?format=csv for a CSV download.

Storage: top-level `PaidWaitlist/{autoId}` (backend-only; the Firestore rules deny all client access).
The person is emailed through the shared sender in routes/contact.py.
"""

import csv
import io
import logging
import re
import threading
import time
from collections import deque
from datetime import datetime, timezone
from typing import Deque, Dict, Literal, Optional, Union

import firebase_admin
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response
from firebase_admin import auth
from pydantic import BaseModel, Field, field_validator

from firebase.paths import paid_waitlist_col
from routes import contact
from routes.teachers import require_admin

logger = logging.getLogger(__name__)

router = APIRouter(tags=["waitlist"])

INTERESTS = ("teacher", "organization")
SOURCES = ("signup_org", "upgrade", "signup_teacher", "landing", "other")

# In-memory sliding windows (per process), same posture as the other throttles.
IP_LIMIT, IP_WINDOW = 10, 600          # 10 submissions / 10 min per IP
EMAIL_LIMIT, EMAIL_WINDOW = 3, 3600    # 3 submissions / hour per email
_log: Dict[str, Deque[float]] = {}
_lock = threading.Lock()

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class WaitlistEntry(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: str = Field(max_length=254)
    interest: Literal["teacher", "organization"]
    org_name: Optional[str] = Field(default=None, max_length=200)
    staff_size: Optional[Union[int, str]] = None
    role: Optional[str] = Field(default=None, max_length=100)
    note: Optional[str] = Field(default=None, max_length=2000)
    source: Optional[str] = Field(default=None, max_length=50)

    @field_validator("name")
    @classmethod
    def _name(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("name is required")
        return v

    @field_validator("email")
    @classmethod
    def _email(cls, v):
        v = v.strip().lower()
        if not _EMAIL_RE.match(v):
            raise ValueError("a valid email is required")
        return v

    @field_validator("staff_size")
    @classmethod
    def _staff(cls, v):
        if v is None:
            return None
        if isinstance(v, bool):
            raise ValueError("staff_size must be a number or short text")
        if isinstance(v, int):
            if v < 0 or v > 10_000_000:
                raise ValueError("staff_size out of range")
            return str(v)
        v = v.strip()
        if len(v) > 40:
            raise ValueError("staff_size too long")
        return v or None


def get_db():
    if not firebase_admin._apps:
        firebase_admin.initialize_app()
    from firebase.project import firestore_client
    return firestore_client()


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _charge(key: str, limit: int, window: int, now: float) -> Optional[int]:
    """Record one hit; return None if allowed, else seconds to wait. Rejected hits are not recorded."""
    q = _log.setdefault(key, deque())
    while q and now - q[0] > window:
        q.popleft()
    if len(q) >= limit:
        return int(window - (now - q[0])) + 1
    q.append(now)
    return None


def _throttle(ip: str, email: str) -> None:
    now = time.monotonic()
    with _lock:
        retry = _charge(f"ip:{ip}", IP_LIMIT, IP_WINDOW, now)
        if retry is None:
            retry = _charge(f"email:{email}", EMAIL_LIMIT, EMAIL_WINDOW, now)
        if len(_log) > 5000:   # opportunistic cleanup of idle keys
            for k in [k for k, v in _log.items() if not v or now - v[-1] > max(IP_WINDOW, EMAIL_WINDOW)]:
                _log.pop(k, None)
    if retry is not None:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"code": "rate_limited"},
            headers={"Retry-After": str(max(retry, 1))},
        )


def reset_throttle() -> None:
    with _lock:
        _log.clear()


def _optional_uid(authorization: Optional[str]) -> Optional[str]:
    """uid from a valid bearer token, else None. A bad or missing token is not an error here."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    try:
        return auth.verify_id_token(authorization.split("Bearer ", 1)[1]).get("uid")
    except Exception:  # noqa: BLE001
        return None


def _mail_body(doc: dict) -> str:
    rows = [("Name", doc["name"]), ("Email", doc["email"]), ("Interest", doc["interest"]),
            ("Organization", doc.get("org_name")), ("Staff size", doc.get("staff_size")),
            ("Role", doc.get("role")), ("Source", doc["source"]), ("Signed in (uid)", doc.get("uid"))]
    text = "\n".join(f"{k}: {v or '—'}" for k, v in rows)
    return f"{text}\n\nNote:\n{doc.get('note') or '—'}"


@router.post("/api/waitlist")
async def join_waitlist(
    entry: WaitlistEntry,
    request: Request,
    authorization: Optional[str] = Header(default=None),
    db=Depends(get_db),
):
    _throttle(_client_ip(request), entry.email)
    source = entry.source if entry.source in SOURCES else "other"
    doc = {
        "name": entry.name,
        "email": entry.email,
        "interest": entry.interest,
        "org_name": (entry.org_name or "").strip() or None,
        "staff_size": entry.staff_size,
        "role": (entry.role or "").strip() or None,
        "note": (entry.note or "").strip() or None,
        "source": source,
        "uid": _optional_uid(authorization),
        "created_at": datetime.now(timezone.utc),
    }
    try:
        paid_waitlist_col(db).document().set(doc)
    except Exception as e:  # noqa: BLE001
        logger.error(f"Waitlist save failed: {e}")
        raise HTTPException(status_code=500, detail="Could not save your request. Please try again.")
    try:
        await run_in_threadpool(
            contact.send_notification_email,
            f"EdCube waitlist: {entry.interest} — {entry.name}", _mail_body(doc), entry.email)
    except Exception as e:  # noqa: BLE001  (the entry is saved; a mail failure must not fail the request)
        logger.error(f"Waitlist email failed: {e}")
    return {"success": True}


CSV_FIELDS = ["created_at", "interest", "name", "email", "org_name", "staff_size", "role", "note", "source", "uid"]


def _csv_cell(v) -> str:
    s = "" if v is None else str(v)
    return "'" + s if s[:1] in ("=", "+", "-", "@", "\t", "\r") else s   # spreadsheet formula guard


@router.get("/api/admin/waitlist")
async def list_waitlist(
    interest: Optional[Literal["teacher", "organization"]] = Query(default=None),
    format: Optional[Literal["json", "csv"]] = Query(default="json"),
    limit: int = Query(default=1000, ge=1, le=5000),
    admin: dict = Depends(require_admin),
    db=Depends(get_db),
):
    col = paid_waitlist_col(db)
    snaps = list((col.where("interest", "==", interest) if interest else col).stream())
    rows = []
    for s in snaps:
        d = s.to_dict() or {}
        created = d.get("created_at")
        d["created_at"] = created.isoformat() if isinstance(created, datetime) else created
        rows.append({"id": s.id, **d})
    rows.sort(key=lambda r: r.get("created_at") or "", reverse=True)   # ISO strings sort chronologically
    rows = rows[:limit]
    if format == "csv":
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(CSV_FIELDS)
        for r in rows:
            w.writerow([_csv_cell(r.get(f)) for f in CSV_FIELDS])
        return Response(buf.getvalue(), media_type="text/csv",
                        headers={"Content-Disposition": 'attachment; filename="edcube-waitlist.csv"'})
    return {"entries": rows, "count": len(rows)}
