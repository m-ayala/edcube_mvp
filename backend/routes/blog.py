# backend/routes/blog.py
"""
Front-page blog. Posts live in `BlogPosts/{autoId}`; clients never touch Firestore directly.

Public (no token):
GET    /api/blog/posts?limit=20          published posts, newest first (limit 1-50)
GET    /api/blog/posts/{post_id}         one published post (404 for drafts and unknown ids)

Admin only (custom claim `admin: true`, routes.teachers.require_admin), every change logged to AdminAudit:
GET    /api/admin/blog/posts             every post including drafts, newest first
POST   /api/admin/blog/posts             {title, body, summary?, published?}
PATCH  /api/admin/blog/posts/{post_id}   any of {title, body, summary, published}
DELETE /api/admin/blog/posts/{post_id}

Post doc: title, summary, body (plain text; blank lines separate paragraphs), published (bool),
author_uid, author_name, created_at, updated_at, published_at (set the first time it is published).
"""

import logging
from datetime import datetime, timezone
from typing import Optional

import firebase_admin
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from firebase.paths import blog_posts_col
from routes.teachers import require_admin
from services import accounts_service as accts

logger = logging.getLogger(__name__)

router = APIRouter(tags=["blog"])

TITLE_MAX = 200
SUMMARY_MAX = 500
BODY_MAX = 50_000


def get_db():
    if not firebase_admin._apps:
        firebase_admin.initialize_app()
    from firebase.project import firestore_client
    return firestore_client()


def _now():
    return datetime.now(timezone.utc)


def _iso(v):
    return v.isoformat() if isinstance(v, datetime) else v


class PostCreate(BaseModel):
    title: str = Field(..., max_length=TITLE_MAX)
    body: str = Field(..., max_length=BODY_MAX)
    summary: Optional[str] = Field(default=None, max_length=SUMMARY_MAX)
    published: bool = False


class PostUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=TITLE_MAX)
    body: Optional[str] = Field(default=None, max_length=BODY_MAX)
    summary: Optional[str] = Field(default=None, max_length=SUMMARY_MAX)
    published: Optional[bool] = None


def _view(post_id: str, d: dict, admin: bool = False) -> dict:
    out = {
        "id": post_id,
        "title": d.get("title") or "",
        "summary": d.get("summary") or "",
        "body": d.get("body") or "",
        "author_name": d.get("author_name") or "",
        "published_at": _iso(d.get("published_at")),
        "updated_at": _iso(d.get("updated_at")),
    }
    if admin:
        out["published"] = bool(d.get("published"))
        out["created_at"] = _iso(d.get("created_at"))
    return out


def _sort_key(d: dict):
    # Newest first; published_at for published posts, created_at for drafts.
    v = d.get("published_at") or d.get("created_at")
    return v.timestamp() if isinstance(v, datetime) else 0


def _require_text(value: Optional[str], field: str) -> str:
    v = (value or "").strip()
    if not v:
        raise HTTPException(status_code=400, detail=f"{field} cannot be empty")
    return v


def _audit_view(d: Optional[dict]):
    """Audit snapshot without the full body (kept small): title, published, body length."""
    if d is None:
        return None
    return {"title": d.get("title"), "published": bool(d.get("published")), "body_chars": len(d.get("body") or "")}


# ---- public ------------------------------------------------------------------------------------
@router.get("/api/blog/posts")
async def list_published(limit: int = Query(default=20, ge=1, le=50), db=Depends(get_db)):
    # Equality filter only (sorted here), so no composite index is needed.
    docs = [(s.id, s.to_dict() or {}) for s in blog_posts_col(db).where("published", "==", True).stream()]
    docs.sort(key=lambda p: _sort_key(p[1]), reverse=True)
    return {"posts": [_view(i, d) for i, d in docs[:limit]]}


@router.get("/api/blog/posts/{post_id}")
async def get_published(post_id: str, db=Depends(get_db)):
    snap = blog_posts_col(db).document(post_id).get()
    d = snap.to_dict() if snap.exists else None
    if not d or not d.get("published"):
        raise HTTPException(status_code=404, detail="Post not found")
    return _view(post_id, d)


# ---- admin -------------------------------------------------------------------------------------
@router.get("/api/admin/blog/posts")
async def admin_list(admin: dict = Depends(require_admin), db=Depends(get_db)):
    docs = [(s.id, s.to_dict() or {}) for s in blog_posts_col(db).stream()]
    docs.sort(key=lambda p: _sort_key(p[1]), reverse=True)
    return {"posts": [_view(i, d, admin=True) for i, d in docs]}


@router.post("/api/admin/blog/posts")
async def admin_create(body: PostCreate, admin: dict = Depends(require_admin), db=Depends(get_db)):
    now = _now()
    doc = {
        "title": _require_text(body.title, "Title"),
        "body": _require_text(body.body, "Body"),
        "summary": (body.summary or "").strip(),
        "published": bool(body.published),
        "author_uid": admin.get("uid"),
        "author_name": admin.get("name") or "EdCube",
        "created_at": now,
        "updated_at": now,
        "published_at": now if body.published else None,
    }
    ref = blog_posts_col(db).document()
    ref.set(doc)
    accts.log_admin_action(admin, "blog_create", ref.id, None, _audit_view(doc), db=db)
    return _view(ref.id, doc, admin=True)


@router.patch("/api/admin/blog/posts/{post_id}")
async def admin_update(post_id: str, body: PostUpdate, admin: dict = Depends(require_admin), db=Depends(get_db)):
    ref = blog_posts_col(db).document(post_id)
    snap = ref.get()
    if not snap.exists:
        raise HTTPException(status_code=404, detail="Post not found")
    before = snap.to_dict() or {}
    patch = {}
    if body.title is not None:
        patch["title"] = _require_text(body.title, "Title")
    if body.body is not None:
        patch["body"] = _require_text(body.body, "Body")
    if body.summary is not None:
        patch["summary"] = body.summary.strip()
    if body.published is not None:
        patch["published"] = body.published
        if body.published and not before.get("published_at"):
            patch["published_at"] = _now()
    if not patch:
        return _view(post_id, before, admin=True)
    patch["updated_at"] = _now()
    ref.update(patch)
    after = {**before, **patch}
    accts.log_admin_action(admin, "blog_update", post_id, _audit_view(before), _audit_view(after), db=db)
    return _view(post_id, after, admin=True)


@router.delete("/api/admin/blog/posts/{post_id}")
async def admin_delete(post_id: str, admin: dict = Depends(require_admin), db=Depends(get_db)):
    ref = blog_posts_col(db).document(post_id)
    snap = ref.get()
    if not snap.exists:
        raise HTTPException(status_code=404, detail="Post not found")
    before = snap.to_dict() or {}
    ref.delete()
    accts.log_admin_action(admin, "blog_delete", post_id, _audit_view(before), None, db=db)
    return {"deleted": post_id}
