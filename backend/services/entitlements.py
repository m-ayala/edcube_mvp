# backend/services/entitlements.py
"""
The one entitlement check (TASK-031): can(user, action, course=None) -> Decision.

`user` is the dict a workspace-aware dependency returns (uid, org = the resolved
workspace id, ...). Plan and account state are read live (short-cached), never
stored on a course.

Rules
- deactivated account            -> everything denied
- view, manual_edit              -> always allowed (a lapsed trial never locks content)
- trial ended                    -> AI actions and new sharing denied, with an upgrade message
- coedit                         -> governed by the COURSE OWNER's plan, computed live
- invite_collaborator            -> plan must allow co-editing and the per-course cap must have room
- credit counts                  -> NOT checked here: see CREDIT_HOOK (usage_service, TASK-033)

In an org workspace the org's entitlements apply (plan "org"); in the personal
workspace the user's own Accounts plan applies.

Wiring: usage_service.enforce_quota calls `require_entitlement(...)`'s logic before any
credit logic, and the share routes call it directly. Denials surface as HTTP 402:
    {"code": "plan_inactive", "reason": "trial_ended", "message": ..., "plan": ...}      trial over
    {"code": "plan_upgrade_required", "reason": ..., "message": ..., "plan": ...}         feature not in plan
"""

import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from fastapi import HTTPException

from firebase.org_registry import get_org_info
from firebase.public_space import PERSONAL_SPACE_ID, PLAN_ORG, PLAN_TRIAL
from services import accounts_service as accts
from services import platform_config as pc

logger = logging.getLogger(__name__)

AI_GENERATE_COURSE = "ai_generate_course"
AI_GENERATE = "ai_generate"
AI_EDO = "ai_edo"
SHARE_LINK_CREATE = "share_link_create"
INVITE_COLLABORATOR = "invite_collaborator"
COEDIT = "coedit"
MANUAL_EDIT = "manual_edit"
VIEW = "view"

AI_ACTIONS = (AI_GENERATE_COURSE, AI_GENERATE, AI_EDO)
SHARING_ACTIONS = (SHARE_LINK_CREATE, INVITE_COLLABORATOR)
ACTIONS = AI_ACTIONS + SHARING_ACTIONS + (COEDIT, MANUAL_EDIT, VIEW)

# usage_service quota kind -> action
QUOTA_KIND_ACTION = {"courses": AI_GENERATE_COURSE, "generates": AI_GENERATE, "edo_messages": AI_EDO}

UPGRADE_MESSAGE_TRIAL_ENDED = (
    "Your free trial has ended. AI generation and new sharing are paused; your courses are safe, "
    "and you can still view and edit them and your existing view-only links keep working. "
    "Join the waitlist to hear when paid plans open."
)
UPGRADE_MESSAGE_FEATURE = (
    "This isn't included in your current plan. Join the waitlist to hear when paid plans open."
)
DEACTIVATED_MESSAGE = "This account is deactivated. Reactivate it to continue."

# TASK-033: after the plan/state checks pass for an AI action, the credit
# reserve/confirm/refund (per-plan allowance, bonus_credits, org pool) runs. It is
# deliberately NOT part of can(); enforce_quota applies it right after can() allows.
CREDIT_HOOK = "usage_service.enforce_quota (credits are checked there, after can())"


@dataclass
class Decision:
    allowed: bool
    reason: Optional[str] = None            # machine code when denied (or an informational note)
    upgrade_message: Optional[str] = None
    plan: Optional[str] = None              # plan in effect for the workspace
    workspace: Optional[str] = None

    def http_status(self) -> int:
        return 403 if self.reason == "account_deactivated" else 402

    def to_detail(self) -> dict:
        code = {
            "trial_ended": "plan_inactive",
            "account_deactivated": "account_deactivated",
        }.get(self.reason, "plan_upgrade_required")
        return {"code": code, "reason": self.reason, "message": self.upgrade_message, "plan": self.plan}


def _workspace_plan(user: dict, account: Optional[dict], db=None) -> str:
    ws = user.get("org")
    if ws and ws != PERSONAL_SPACE_ID:
        return (get_org_info(ws, db) or {}).get("plan") or PLAN_ORG
    return accts.personal_plan(account)


def _collaborators(course: Optional[dict]) -> int:
    return sum(1 for s in ((course or {}).get("sharedWith") or []) if s.get("accessType") == "collaborate")


def _org_cap(ws: str, db=None) -> Optional[int]:
    info = get_org_info(ws, db) or {}
    return info.get("collaborator_cap")   # None = org-defined/unlimited


def can(user: dict, action: str, course: Optional[dict] = None, *, db=None, now: Optional[datetime] = None) -> Decision:
    if action not in ACTIONS:
        raise ValueError(f"unknown action: {action}")
    uid, ws = user.get("uid"), user.get("org")
    account = accts.get_account(uid, db) if uid else None
    plan = _workspace_plan(user, account, db)

    def deny(reason, msg):
        return Decision(False, reason, msg, plan, ws)

    if accts.is_deactivated(account):
        return deny("account_deactivated", DEACTIVATED_MESSAGE)
    if action in (VIEW, MANUAL_EDIT):
        return Decision(True, None, None, plan, ws)

    in_personal = ws == PERSONAL_SPACE_ID
    # A trial only constrains the personal workspace (org workspaces run on the org plan).
    trial_over = in_personal and accts.trial_expired(account, now)

    if action == COEDIT:
        return _can_coedit(user, course, account, plan, db, deny)

    if trial_over:
        return deny("trial_ended", UPGRADE_MESSAGE_TRIAL_ENDED)

    if action in AI_ACTIONS:
        # CREDIT_HOOK: allowance/bonus credit checks happen after this, in usage_service.
        return Decision(True, None, None, plan, ws)

    feats = pc.plan_features(plan, db)
    if action == SHARE_LINK_CREATE:
        if not feats["can_share_links"]:
            return deny("sharing_not_in_plan", UPGRADE_MESSAGE_FEATURE)
        return Decision(True, None, None, plan, ws)

    # INVITE_COLLABORATOR
    if not feats["can_coedit"]:
        return deny("coediting_not_in_plan", UPGRADE_MESSAGE_FEATURE)
    cap = _org_cap(ws, db) if not in_personal else pc.collaborator_cap(plan, db)
    if cap is not None and _collaborators(course) >= cap:
        return deny("collaborator_cap_reached", UPGRADE_MESSAGE_FEATURE if in_personal else None)
    return Decision(True, None, None, plan, ws)


def _can_coedit(user, course, account, caller_plan, db, deny) -> Decision:
    """Co-editing is governed by the COURSE OWNER's plan (live), not the caller's.
    The owner themself editing is just manual_edit. Without a course, fall back to
    the caller's own plan flags."""
    uid, ws = user.get("uid"), user.get("org")
    owner_uid = (course or {}).get("teacherUid")
    if course is None or not owner_uid:
        owner_plan = caller_plan
    elif owner_uid == uid:
        return Decision(True, None, None, caller_plan, ws)
    elif ws != PERSONAL_SPACE_ID:
        owner_plan = _workspace_plan({"org": ws}, None, db)       # org-owned content
    else:
        owner_acct = accts.get_account(owner_uid, db)
        if accts.is_deactivated(owner_acct):
            return deny("owner_deactivated", None)
        owner_plan = accts.personal_plan(owner_acct)
        if accts.trial_expired(owner_acct):
            return Decision(False, "owner_trial_ended", None, owner_plan, ws)
    if not pc.plan_features(owner_plan, db)["can_coedit"]:
        return Decision(False, "owner_plan_no_coediting", None, owner_plan, ws)
    return Decision(True, None, None, owner_plan, ws)


def owner_allows_access(owner_uid: str, workspace: str, db=None) -> bool:
    """For personal-workspace courses: False once the OWNER is deactivated (their
    collaborator/view access stops). Org-workspace courses are unaffected."""
    if workspace != PERSONAL_SPACE_ID or not owner_uid:
        return True
    try:
        return not accts.is_deactivated(accts.get_account(owner_uid, db))
    except Exception as e:  # noqa: BLE001
        logger.warning("owner status check failed open (%s): %s", owner_uid, e)
        return True


def owner_allows_coedit(owner_uid: str, workspace: str, db=None) -> bool:
    """True if the course owner's plan (live) currently permits others to co-edit."""
    fake_caller = {"uid": None, "org": workspace}
    return can(fake_caller, COEDIT, {"teacherUid": owner_uid}, db=db).allowed


def enforce(user: dict, action: str, course: Optional[dict] = None, *, db=None) -> Decision:
    """can() that raises the HTTP error (402/403) on denial. Infrastructure errors fail
    open (logged), consistent with the quota path."""
    try:
        d = can(user, action, course, db=db)
    except Exception as e:  # noqa: BLE001
        logger.warning("entitlement check failed open (%s %s): %s", user.get("uid"), action, e)
        return Decision(True, "check_failed_open", None, None, user.get("org"))
    if not d.allowed:
        raise HTTPException(status_code=d.http_status(), detail=d.to_detail())
    return d


def enforce_collaborator_write(user: dict, owner_uid: Optional[str], db=None) -> None:
    """Gate for every NON-OWNER write to a personal-workspace course (TASK-031): the owner must
    be active (403 account_deactivated) and their plan must currently allow co-editing
    (403 coediting_not_in_plan). Owners are never blocked; org-workspace courses are unaffected."""
    ws = user.get("org")
    if ws != PERSONAL_SPACE_ID or not owner_uid or owner_uid == user.get("uid"):
        return
    if not owner_allows_access(owner_uid, ws, db):
        raise HTTPException(status_code=403, detail={
            "code": "account_deactivated", "reason": "owner_deactivated",
            "message": "This course's owner has deactivated their account."})
    if not owner_allows_coedit(owner_uid, ws, db):
        raise HTTPException(status_code=403, detail={
            "code": "coediting_not_in_plan", "reason": "owner_plan_no_coediting",
            "message": "Co-editing isn't available on this course right now because of the owner's plan.",
            "plan": None})
