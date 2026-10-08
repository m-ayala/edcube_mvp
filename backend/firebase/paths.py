"""
Firestore path helpers for the `EdCube` / `Users/{org}` tree.

This module is the *only* place in the backend that should know the shape of
that tree. Every other module reaches Firestore collections through the
helpers here instead of calling `db.collection('some_name')` directly, so the
tree shape can change in one place.

Target tree (see tasks/firestore-reorg-spec.md for the full picture):

    EdCube/knowledge_base/{category}/{doc}       -- platform-wide KB
        categories: curriculum, pedagogy, impact_partners, content,
                    worksheets, activities, age

    Users/{org}/curricula/{id}
    Users/{org}/teacher_profiles/{uid}
    Users/{org}/teachers/{uid}/courseFolders/**, libraryFolders/**
    Users/{org}/notifications/{id}                -- short-lived, delete-on-seen
    Users/{org}/synopsis/afterschool/months/**, entries/**
    Users/{org}/synopsis/summer_camps/weeks/{week}/camps/{camp}/entries/**

Org resolution: `resolve_org(uid)` looks up the caller's email via the Admin
SDK (`firebase_admin.auth.get_user`), then resolves that email to an org_id
via the `Users/{org}` registry (backend/firebase/org_registry.py) -- NOT a
hardcoded domain map (tasks/firestore-reorg-spec.md Round 2 overrides Round 1
decision 3 on this point). Where a route already holds a decoded ID token
(which carries the `email` claim), prefer calling `get_org_from_email(email)`
directly instead of `resolve_org(uid)` -- it avoids the extra Admin SDK round
trip. Both can return None for an email that isn't registered with any org --
there is no default org; callers must 403 rather than proceed.
"""

import time
from typing import Dict, Optional, Tuple

import firebase_admin
from firebase_admin import auth as fb_auth

from schemas.teacher_schema import get_org_from_email

# ── Roots ────────────────────────────────────────────────────────────────────

ORGS_ROOT = "Users"
PLATFORM_ROOT = "EdCube"
KNOWLEDGE_BASE_DOC = "knowledge_base"

# Synopsis / afterschool routes have no auth today and are ICC-specific.
# Multi-org synopsis is out of scope (tasks/firestore-reorg-spec.md, decision 4).
DEFAULT_SYNOPSIS_ORG = "icc"


# ── Org tree ─────────────────────────────────────────────────────────────────

def org_doc(db, org: str):
    """`Users/{org}` -- the per-organization root document."""
    return db.collection(ORGS_ROOT).document(org)


def org_col(db, org: str, name: str):
    """`Users/{org}/{name}` -- a subcollection scoped to one organization."""
    return org_doc(db, org).collection(name)


def afterschool_doc(db, org: str):
    """`Users/{org}/synopsis/afterschool`"""
    return org_col(db, org, "synopsis").document("afterschool")


def afterschool_month_doc(db, org: str, month_id: str):
    """`Users/{org}/synopsis/afterschool/months/{month_id}`"""
    return afterschool_doc(db, org).collection("months").document(month_id)


def afterschool_entries_col(db, org: str, month_id: str):
    """
    `Users/{org}/synopsis/afterschool/months/{month_id}/entries` -- entries
    live nested inside their month (tasks/firestore-reorg-spec.md Round 2,
    section C), not in a flat sibling `entries` collection. Deleting a month
    cascades to delete everything under this path.
    """
    return afterschool_month_doc(db, org, month_id).collection("entries")


def summer_camps_doc(db, org: str):
    """`Users/{org}/synopsis/summer_camps`"""
    return org_col(db, org, "synopsis").document("summer_camps")


# ── Platform (knowledge base) tree ──────────────────────────────────────────

def kb_doc(db):
    """`EdCube/knowledge_base`"""
    return db.collection(PLATFORM_ROOT).document(KNOWLEDGE_BASE_DOC)


def kb_col(db, category: str):
    """`EdCube/knowledge_base/{category}` e.g. 'pedagogy', 'age', 'worksheets'."""
    return kb_doc(db).collection(category)


# ── Storage (Cloud Storage object paths) ────────────────────────────────────

def storage_path(org: str, *parts: str) -> str:
    """
    `Users/{org}/{part}/{part}/...` -- the Cloud Storage object-name prefix for
    everything belonging to one org (tasks/firestore-reorg-spec.md, Round 2 E).
    Pure string helper; touches neither Storage nor Firestore.
    """
    return "/".join([ORGS_ROOT, org, *[p.strip("/") for p in parts if p]])


# ── Org resolution ───────────────────────────────────────────────────────────

# Short TTL, same posture as firebase/org_registry.py's own cache -- so an
# admin adding/removing an allowed_email or domain takes effect for
# uid-based lookups within a few minutes, not only on redeploy.
_ORG_CACHE_TTL_SECONDS = 300
_org_cache: Dict[str, Tuple[Optional[str], float]] = {}


def resolve_org(uid: str) -> Optional[str]:
    """
    Resolve a Firebase uid to its org_id: looks up the uid's email via the
    Admin SDK, then resolves that email through the `Users/{org}` registry
    (backend/firebase/org_registry.py). Cached in-process per uid with a short
    TTL. Returns None if the uid's email isn't registered with any org --
    there is no default; callers must 403 rather than proceed.
    """
    now = time.time()
    cached = _org_cache.get(uid)
    if cached is not None and (now - cached[1]) < _ORG_CACHE_TTL_SECONDS:
        return cached[0]

    if not firebase_admin._apps:
        firebase_admin.initialize_app()

    user = fb_auth.get_user(uid)
    org = get_org_from_email(user.email or "")
    _org_cache[uid] = (org, now)
    return org
