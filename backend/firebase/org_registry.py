"""
Org registry: the single source of truth for which org (if any) an email
belongs to.

Replaces the old hardcoded `DOMAIN_ORG_MAP` (tasks/firestore-reorg-spec.md,
Round 2, overrides Round 1 decision 3). Backed by `Users/{org}` documents
shaped `{ name, domains: [...], allowed_emails: [...] }`, cached in-process
with a short TTL so we don't hit Firestore on every request.

`match_org()` is a pure function with no Firestore dependency, so the
matching rule itself can be unit-tested against a stubbed registry dict
without touching the database.
"""

import time
from typing import Dict, List, Optional

from firebase.public_space import (
    PERSONAL_SPACE_ID,
    PERSONAL_SPACE_IDS,
    PERSONAL_SPACE_TYPE,
    SPACE_TYPE,
)

# "A few minutes is fine" per tasks/firestore-reorg-spec.md Round 2 section A.
CACHE_TTL_SECONDS = 300

_cache: Dict[str, object] = {"data": None, "fetched_at": 0.0}


def match_org(email: str, registry: Dict[str, dict]) -> Optional[str]:
    """
    Pure matching rule -- no Firestore access.

    An email belongs to an org if its lowercased domain is listed in that
    org's `domains`, OR the full lowercased email is listed in that org's
    `allowed_emails`. Returns the org_id, or None if nothing matches -- there
    is no default org.

    `registry` shape: { org_id: {"domains": [...], "allowed_emails": [...]} }
    """
    email = (email or "").strip().lower()
    if not email or "@" not in email:
        return None
    domain = email.rsplit("@", 1)[-1]

    for org_id, org_data in (registry or {}).items():
        # The reserved personal workspace is never domain/allow-list matched: it is
        # reached only by the "no org matched" fallback in resolve_space().
        if org_id in PERSONAL_SPACE_IDS or (org_data or {}).get(SPACE_TYPE) in (PERSONAL_SPACE_TYPE, "public"):
            continue
        domains: List[str] = [d.lower() for d in (org_data or {}).get("domains", []) or []]
        allowed: List[str] = [a.lower() for a in (org_data or {}).get("allowed_emails", []) or []]
        if domain in domains or email in allowed:
            return org_id
    return None


def _get_db(db=None):
    if db is not None:
        return db
    import firebase_admin
    from firebase_admin import firestore

    if not firebase_admin._apps:
        firebase_admin.initialize_app()
    from firebase.project import firestore_client
    return firestore_client()


def _fetch_registry(db) -> Dict[str, dict]:
    """Read every `Users/{org}` doc's registry fields. This is a direct read
    of the small `Users` collection itself (not a collection_group query, and
    not per-user data) -- it's the org directory, required to resolve org
    membership at all."""
    registry: Dict[str, dict] = {}
    for doc in db.collection("Users").stream():
        data = doc.to_dict() or {}
        registry[doc.id] = {
            "name": data.get("name", doc.id),
            "type": data.get(SPACE_TYPE),
            "domains": data.get("domains", []) or [],
            "allowed_emails": data.get("allowed_emails", []) or [],
            # Org plan fields (TASK-031). Missing -> plan "org", unlimited pool/cap/seats.
            "plan": data.get("plan"),
            "pool": data.get("pool"),
            "plan_started_at": data.get("plan_started_at"),   # anchors the org pool's monthly period (TASK-033)
            "collaborator_cap": data.get("collaborator_cap"),
            "seats": data.get("seats"),
        }
    return registry


def _get_registry(db=None) -> Dict[str, dict]:
    now = time.time()
    if _cache["data"] is None or (now - _cache["fetched_at"]) > CACHE_TTL_SECONDS:
        _cache["data"] = _fetch_registry(_get_db(db))
        _cache["fetched_at"] = now
    return _cache["data"]


def get_org_from_email(email: str, db=None) -> Optional[str]:
    """
    Resolve an email to its org_id via the Users/{org} registry.

    Returns None if the email isn't registered with any org -- callers must
    treat that as "not allowed", never fall back to a default org
    (tasks/firestore-reorg-spec.md Round 2, decision 2).
    """
    registry = _get_registry(db)
    return match_org(email, registry)


def resolve_space(email: str, email_verified: bool, db=None) -> Optional[str]:
    """
    Resolve an email to the space it belongs in.

    - matches an org (domain or allowed_emails) -> that orgId (the org always wins)
    - otherwise a verified email -> "personal"
    - otherwise -> None
    """
    org_id = get_org_from_email(email, db)
    if org_id:
        return org_id
    if email_verified is True and (email or "").strip():
        return PERSONAL_SPACE_ID
    return None


def get_org_info(org_id: str, db=None) -> Optional[dict]:
    """Return {name, domains, allowed_emails} for one org, or None if unknown."""
    registry = _get_registry(db)
    return registry.get(org_id)


def invalidate_cache() -> None:
    """Force the next lookup to re-fetch from Firestore. Used by tests and by
    the migration script after writing the Users/{org} registry docs."""
    _cache["data"] = None
    _cache["fetched_at"] = 0.0
