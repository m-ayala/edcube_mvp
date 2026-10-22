# backend/services/org_domains.py
"""
DATA MODEL ONLY (TASK-039) for a future "organization verifies a domain and invites existing users
on it into the org workspace" flow. Nothing here is called by a route yet, and org membership is
still resolved exactly as before (Users/{org}.domains / allowed_emails via firebase/org_registry.py).

Users/{orgId}.verified_domains: [ {domain, status, method, token, verified_at} ]
    status       "pending" | "verified"
    method       "dns_txt" | "email"
    token        dns_txt: the value the org publishes as a TXT record (public by nature). For the
                 "email" method keep the secret token ONLY in OrgDomainClaims (org docs are
                 readable by org members).
    verified_at  datetime or None
    Only a "verified" entry may later be used to invite users; `domains` (membership) is unchanged.

OrgDomainClaims/{id}  (backend-only; rules deny clients)
    org_id, domain (Domains stats key), status ("pending"|"verified"|"revoked"), created_at, verified_at,
    invited_uids [uid],
    course_moves [ {uid, course_ids [str], status} ]   one entry per invited user; the TEACHER chooses
                                                      which personal courses move into the org
    course_move status: "invited" | "accepted" | "declined" | "moved"
The claim stores uids and course ids, never emails.
"""

import secrets
from datetime import datetime, timezone
from typing import List, Optional

VERIFY_PENDING, VERIFY_VERIFIED = "pending", "verified"
CLAIM_PENDING, CLAIM_VERIFIED, CLAIM_REVOKED = "pending", "verified", "revoked"
METHOD_DNS_TXT, METHOD_EMAIL = "dns_txt", "email"
MOVE_INVITED, MOVE_ACCEPTED, MOVE_DECLINED, MOVE_MOVED = "invited", "accepted", "declined", "moved"
VERIFICATION_METHODS = (METHOD_DNS_TXT, METHOD_EMAIL)


def new_verified_domain_entry(domain: str, method: str = METHOD_DNS_TXT) -> dict:
    if method not in VERIFICATION_METHODS:
        raise ValueError(f"unknown verification method: {method}")
    return {"domain": domain.strip().lower(), "status": VERIFY_PENDING, "method": method,
            "token": "edcube-verify=" + secrets.token_urlsafe(16), "verified_at": None}


def new_claim_doc(org_id: str, domain: str, now: Optional[datetime] = None) -> dict:
    return {"org_id": org_id, "domain": domain.strip().lower(), "status": CLAIM_PENDING,
            "created_at": now or datetime.now(timezone.utc), "verified_at": None,
            "invited_uids": [], "course_moves": []}


def new_course_move(uid: str, course_ids: Optional[List[str]] = None) -> dict:
    return {"uid": uid, "course_ids": list(course_ids or []), "status": MOVE_INVITED}
