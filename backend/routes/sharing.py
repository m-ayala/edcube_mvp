# backend/routes/sharing.py
"""
Sharing and collaboration routes (TASK-036). Logic and data model: services/sharing_service.py.

Owner routes (auth + X-EdCube-Workspace, like every course route; the course must live in the
caller's current workspace)
  POST   /api/curricula/{id}/links                    create a view-only link        (can(share_link_create))
  GET    /api/curricula/{id}/links                    list links with view counts
  DELETE /api/curricula/{id}/links/{token}            revoke
  POST   /api/curricula/{id}/invites                  {email, access_type: collaborate|view}
  DELETE /api/curricula/{id}/invites/{invite_id}      cancel a pending invite
  GET    /api/curricula/{id}/collaborators            active collaborators + pending invites + cap
  DELETE /api/curricula/{id}/collaborators/{uid}      remove a collaborator
  GET    /api/curricula/{id}/delete-impact            {collaborators, pending_invites, active_links}
Any member
  POST   /api/curricula/{id}/leave                    a collaborator removes themself
  GET    /api/curricula/{id}/access                   {role, can_edit, reason}, computed live (poll for plan changes)
Public / invitee
  GET    /api/share/{token}                           NO auth, rate limited per IP, read-only payload
  GET    /api/invites/{token}                         NO auth, landing-page info (course title, inviter)
  POST   /api/invites/{token}/accept                  auth; the account email must match the invite
"""

import logging
from typing import Optional

import firebase_admin
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from routes import contact
from routes.teachers import _resolve_workspace, require_org, verify_firebase_token
from services import entitlements, sharing_service as ss

logger = logging.getLogger(__name__)

router = APIRouter(tags=["sharing"])

NO_STORE = {"Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer"}


def get_db():
    if not firebase_admin._apps:
        firebase_admin.initialize_app()
    from firebase.project import firestore_client
    return firestore_client()


def client_ip(request: Request) -> str:
    """Cloud Run appends the real client address as the LAST x-forwarded-for entry; earlier entries
    are client-supplied, so the last one is the only one that can't be spoofed to dodge the limit."""
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        parts = [p.strip() for p in fwd.split(",") if p.strip()]
        if parts:
            return parts[-1]
    return request.client.host if request.client else "unknown"


def _course_or_404(db, ws: str, course_id: str) -> dict:
    course = ss.load_course(db, ws, course_id)
    if course is None:
        raise HTTPException(status_code=404, detail={"code": "course_not_found", "message": "Course not found."})
    return course


def _owned_course(db, current_user: dict, course_id: str) -> dict:
    course = _course_or_404(db, current_user["org"], course_id)
    if course.get("teacherUid") != current_user["uid"]:
        raise HTTPException(status_code=403, detail={"code": "owner_only", "message": "Only the course owner can do this."})
    return course


# ── view-only links ─────────────────────────────────────────────────────────────────────────────

@router.post("/api/curricula/{course_id}/links")
async def create_link(course_id: str, current_user: dict = Depends(require_org), db=Depends(get_db)):
    course = _owned_course(db, current_user, course_id)
    entitlements.enforce(current_user, entitlements.SHARE_LINK_CREATE, course)   # trial active, or any paid plan
    link = ss.create_link(db, current_user["org"], course, current_user["uid"])
    return {"success": True, "token": link["token"], "url": f"{ss.frontend_url()}/share/{link['token']}",
            "created_at": ss._iso(link["created_at"])}


@router.get("/api/curricula/{course_id}/links")
async def list_links(course_id: str, current_user: dict = Depends(require_org), db=Depends(get_db)):
    _owned_course(db, current_user, course_id)
    links = ss.list_links(db, current_user["org"], course_id)
    for l in links:
        l["url"] = f"{ss.frontend_url()}/share/{l['token']}"
    return {"success": True, "links": links}


@router.delete("/api/curricula/{course_id}/links/{token}")
async def revoke_link(course_id: str, token: str, current_user: dict = Depends(require_org), db=Depends(get_db)):
    _owned_course(db, current_user, course_id)   # revoking is never plan-gated: an owner can always cut access
    if not ss.revoke_link(db, current_user["org"], course_id, token):
        raise HTTPException(status_code=404, detail={"code": "link_not_found", "message": "Link not found."})
    return {"success": True}


@router.get("/api/share/{token}")
async def public_share_view(token: str, request: Request, db=Depends(get_db)):
    """No authentication. One generic 404 for every kind of unavailable link."""
    ss.throttle(ss.PUBLIC_VIEW_LIMITER, f"share:{client_ip(request)}")
    payload = ss.public_view(db, token)
    if payload is None:
        return JSONResponse(status_code=404, content={"detail": ss.LINK_UNAVAILABLE}, headers=NO_STORE)
    return JSONResponse(content=_json_safe(payload), headers=NO_STORE)


def _json_safe(obj):
    from fastapi.encoders import jsonable_encoder
    return jsonable_encoder(obj)


# ── invites and collaborators ───────────────────────────────────────────────────────────────────

class InviteBody(BaseModel):
    email: str
    access_type: str = "collaborate"   # "collaborate" | "view"


@router.post("/api/curricula/{course_id}/invites")
async def create_invite(course_id: str, body: InviteBody, current_user: dict = Depends(require_org), db=Depends(get_db)):
    course = _owned_course(db, current_user, course_id)
    ss.throttle(ss.INVITE_LIMITER, f"invite:{current_user['uid']}")
    result = ss.invite_by_email(db, current_user, course, body.email, body.access_type)
    ws, uid = current_user["org"], current_user["uid"]
    fresh = ss.load_course(db, ws, course_id) or course
    live = ss.reconcile_course_invites(db, ws, fresh, course_id)
    active, pending = ss.slot_counts(fresh, live)
    out = {"success": True, "status": result["status"], "email": result["email"], "access_type": result["access_type"],
           "collaborators": active, "pending_collaborate_invites": pending,
           "cap": entitlements.collaborator_cap(current_user, db)}
    if result["status"] in ("added", "already_shared"):
        out["uid"] = result.get("uid")
    if result["status"] == "invited":
        inv = result["invite"]
        out["invite_id"] = result["invite_id"]
        out["resent"] = result["resent"]
        out["expires_at"] = ss._iso(inv.get("expires_at"))
        out["invite_url"] = f"{ss.frontend_url()}/invite/{inv['token']}"
        out.update(await _send_invite_email(db, ws, uid, course, result["invite_id"], inv, current_user))
    return out


async def _send_invite_email(db, ws: str, owner_uid: str, course: dict, invite_id: str, inv: dict, current_user: dict) -> dict:
    """Mail failure never fails the request: it is reported as email_sent false (+ email_error)."""
    try:
        name = ss.display_name(db, ws, owner_uid, "A teacher")
        subject, text = ss.invite_email_content(db, inv, course, name)
        sent = await run_in_threadpool(contact.send_notification_email, subject, text, current_user.get("email"), inv["email"])
    except Exception as e:  # noqa: BLE001
        logger.error("invite email failed (%s): %s", invite_id, e)
        return {"email_sent": False, "email_error": "send_failed"}
    if not sent:
        return {"email_sent": False, "email_error": "email_not_configured"}
    try:
        ss._set_invite(db, invite_id, {"email_sent_at": ss._now()})
    except Exception:  # noqa: BLE001
        pass
    return {"email_sent": True}


@router.get("/api/curricula/{course_id}/collaborators")
async def get_collaborators(course_id: str, current_user: dict = Depends(require_org), db=Depends(get_db)):
    course = _owned_course(db, current_user, course_id)
    return {"success": True, **ss.list_collaborators(db, current_user["org"], course)}


@router.delete("/api/curricula/{course_id}/invites/{invite_id}")
async def cancel_invite(course_id: str, invite_id: str, current_user: dict = Depends(require_org), db=Depends(get_db)):
    _owned_course(db, current_user, course_id)
    snap = ss.invites_col(db).document(invite_id).get()
    inv = snap.to_dict() if snap.exists else None
    if (not inv or inv.get("course_id") != course_id or inv.get("workspace") != current_user["org"]
            or inv.get("owner_uid") != current_user["uid"]):
        raise HTTPException(status_code=404, detail={"code": "invite_not_found", "message": "Invitation not found."})
    if inv.get("status") != ss.PENDING:
        raise HTTPException(status_code=409, detail={"code": "invite_not_pending", "status": inv.get("status"),
                                                     "message": "Only a pending invitation can be cancelled."})
    ss.cancel_invite(db, invite_id, "cancelled_by_owner")
    return {"success": True}


@router.delete("/api/curricula/{course_id}/collaborators/{uid}")
async def remove_collaborator(course_id: str, uid: str, current_user: dict = Depends(require_org), db=Depends(get_db)):
    course = _owned_course(db, current_user, course_id)
    if not ss.remove_collaborator(db, current_user["org"], course, current_user["uid"], uid):
        raise HTTPException(status_code=404, detail={"code": "collaborator_not_found", "message": "That person isn't shared on this course."})
    return {"success": True}


@router.post("/api/curricula/{course_id}/leave")
async def leave_course(course_id: str, current_user: dict = Depends(require_org), db=Depends(get_db)):
    """A collaborator (or viewer) removes themself. Immediate, like an owner removal."""
    ws, uid = current_user["org"], current_user["uid"]
    course = _course_or_404(db, ws, course_id)
    if course.get("teacherUid") == uid:
        raise HTTPException(status_code=400, detail={"code": "owner_cannot_leave", "message": "You own this course. Delete it instead if you no longer want it."})
    if not ss.remove_shared(db, ws, course, uid):
        raise HTTPException(status_code=404, detail={"code": "not_shared", "message": "This course isn't shared with you."})
    return {"success": True}


@router.get("/api/curricula/{course_id}/delete-impact")
async def delete_impact(course_id: str, current_user: dict = Depends(require_org), db=Depends(get_db)):
    course = _owned_course(db, current_user, course_id)
    return {"success": True, **ss.delete_impact(db, current_user["org"], course)}


@router.get("/api/curricula/{course_id}/access")
async def course_access(course_id: str, current_user: dict = Depends(require_org), db=Depends(get_db)):
    """Live role / edit right for the caller. The frontend polls this (or reacts to a 403 code) so a plan
    change or removal reaches an open session without a reload."""
    ws = current_user["org"]
    course = _course_or_404(db, ws, course_id)
    info = ss.access_info(db, course, current_user["uid"], ws)
    if info["role"] is None:
        raise HTTPException(status_code=404, detail={"code": "course_not_found", "message": "Course not found."})
    if info["role"] != "owner" and not entitlements.owner_allows_access(course.get("teacherUid"), ws, db):
        raise HTTPException(status_code=404, detail={"code": "course_not_found", "message": "Course not found."})
    return {"success": True, **info}


# ── invite landing + accept ─────────────────────────────────────────────────────────────────────

@router.get("/api/invites/{token}")
async def invite_landing(token: str, request: Request, db=Depends(get_db)):
    """No authentication. Course title + inviter name only (plus the access type and a masked email hint)."""
    ss.throttle(ss.PUBLIC_VIEW_LIMITER, f"invite:{client_ip(request)}")
    found = ss.find_invite_by_token(db, token)
    if not found:
        return JSONResponse(status_code=404, headers=NO_STORE, content={"detail": {"code": "invite_unavailable", "message": "This invitation isn't available."}})
    invite_id, inv = found
    inv, course = ss.refresh_invite(db, invite_id, inv)
    if inv.get("status") != ss.PENDING or course is None:
        return JSONResponse(headers=NO_STORE, content={"available": False, "status": inv.get("status")})
    return JSONResponse(headers=NO_STORE, content={
        "available": True, "status": ss.PENDING,
        "course_title": course.get("courseName", ""),
        "inviter_name": ss.display_name(db, inv["workspace"], inv["owner_uid"], "A teacher"),
        "access_type": inv.get("access_type"), "email_hint": ss.mask_email(inv.get("email")),
        "expires_at": ss._iso(inv.get("expires_at"))})


@router.post("/api/invites/{token}/accept")
async def accept_invite(token: str, request: Request, current_user: dict = Depends(verify_firebase_token), db=Depends(get_db)):
    """Auth required. 403 invite_email_mismatch if the account's email isn't the invited one; 410
    invite_unavailable if it was cancelled / expired / already used. Returns where to land."""
    ss.throttle(ss.PUBLIC_VIEW_LIMITER, f"accept:{client_ip(request)}")
    if current_user.get("email_verified") is not True:
        raise HTTPException(status_code=403, detail="Please verify your email address before using EdCube")
    found = ss.find_invite_by_token(db, token)
    if not found:
        raise HTTPException(status_code=404, detail={"code": "invite_unavailable", "message": "This invitation isn't available."})
    invite_id, inv = found
    inv, course = ss.refresh_invite(db, invite_id, inv)
    if inv.get("status") == ss.PENDING:
        ss.assert_email_matches(inv, current_user.get("email"))
        # The invitee must be able to act in the course's workspace (personal needs a bootstrapped
        # account; an org course needs an org member). 403s from here are the standard workspace errors.
        _resolve_workspace(current_user, inv["workspace"])
    out = ss.accept_invite(db, invite_id, inv, current_user["uid"], current_user.get("email"))
    return {"success": True, **out}
