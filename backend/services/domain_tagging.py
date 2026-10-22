# backend/services/domain_tagging.py
"""
Email-domain tagging (TASK-039). No domain is ever blocked: this only LABELS domains so the admin
can see which school/district domains are signing up (the outreach list for Org plans).

    classify_domain(domain) -> {tag, reason, confidence, domain, key, org_id?}
        tag        "education" | "personal" | "org_registered" | "other"
        confidence "high" | "medium" | "low"
        key        the stats key (subdomains stripped): mail.lausd.net -> lausd.net,
                   cs.ox.ac.uk -> ox.ac.uk, x.district.k12.ca.us -> district.k12.ca.us

All rules and lists come from platform_config.domain_rules (code defaults live there only).
Precedence: registered org > personal provider > education rules (strongest hit wins) > keyword hint > other.

Aggregate `Domains/{key}` (backend-only, COUNTS ONLY, no emails):
    domain, tag, confidence, reason, tag_source ("auto"|"admin"), user_count, first_seen_at, last_seen_at,
    seen_domains (full domains seen under the key, capped), sample_orgs (org ids, for org_registered)
`user_count` is incremented in the same transaction that creates a NEW Accounts doc (idempotent: a
repeat login creates nothing). A manual admin tag (`tag_source: "admin"`) is never overwritten by
reclassification.
"""

import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import firebase_admin

from firebase.paths import accounts_col, domains_col
from services import platform_config as pc

logger = logging.getLogger(__name__)

TAG_EDUCATION, TAG_PERSONAL, TAG_ORG, TAG_OTHER = "education", "personal", "org_registered", "other"
TAGS = (TAG_EDUCATION, TAG_PERSONAL, TAG_ORG, TAG_OTHER)
SOURCE_AUTO, SOURCE_ADMIN = "auto", "admin"
CONF_ORDER = {"high": 3, "medium": 2, "low": 1}
MAX_SEEN_DOMAINS = 20
MAX_SAMPLE_ORGS = 10


def _db():
    if not firebase_admin._apps:
        firebase_admin.initialize_app()
    from firebase.project import firestore_client
    return firestore_client()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def normalize(domain: str) -> str:
    d = (domain or "").strip().lower()
    if "@" in d:
        d = d.rsplit("@", 1)[-1]
    return d.strip(".")


def stats_key(domain: str, rules: Optional[dict] = None) -> str:
    """Strip subdomains sensibly. Keeps the registrable part, taking one more label for
    <name>.<second-level>.<cc> (ox.ac.uk, school.edu.au) and <district>.k12.<st>.us."""
    d = normalize(domain)
    labels = d.split(".")
    if len(labels) <= 2:
        return d
    rules = rules if rules is not None else pc.domain_rules()
    if len(labels) >= 4 and labels[-1] == "us" and labels[-3] == "k12" and len(labels[-2]) == 2:
        return ".".join(labels[-4:])
    seconds = set(rules.get("second_level_labels") or [])
    if len(labels[-1]) == 2 and labels[-2] in seconds:
        return ".".join(labels[-3:])
    return ".".join(labels[-2:])


def _registry(db=None) -> Dict[str, dict]:
    try:
        from firebase.org_registry import _get_registry
        return _get_registry(db) or {}
    except Exception as e:  # noqa: BLE001
        logger.warning("domain tagging: org registry unavailable: %s", e)
        return {}


def _match_org(domain: str, key: str, registry: Dict[str, dict]) -> Optional[str]:
    from firebase.org_registry import match_org
    return match_org("x@" + domain, registry) or match_org("x@" + key, registry)


def classify_domain(domain: str, db=None, registry: Optional[Dict[str, dict]] = None,
                    rules: Optional[dict] = None) -> Dict[str, Any]:
    """See module docstring. Never raises on odd input; an empty/invalid domain is `other`/low."""
    d = normalize(domain)
    rules = rules if rules is not None else pc.domain_rules(db)
    key = stats_key(d, rules)
    out = lambda tag, reason, conf, **extra: {"tag": tag, "reason": reason, "confidence": conf,  # noqa: E731
                                             "domain": d, "key": key, **extra}
    if not d or "." not in d:
        return out(TAG_OTHER, "empty or invalid domain", "low")

    reg = registry if registry is not None else _registry(db)
    org_id = _match_org(d, key, reg)
    if org_id:
        return out(TAG_ORG, "domain belongs to a registered organization", "high", org_id=org_id)

    labels = d.split(".")
    brands = set(rules.get("personal_brand_labels") or [])
    seconds = set(rules.get("second_level_labels") or [])
    brand_at = [labels[-2]] if len(labels) >= 2 else []
    if len(labels) >= 3 and len(labels[-1]) == 2 and labels[-2] in seconds:
        brand_at.append(labels[-3])          # yahoo.co.uk
    for b in brand_at:
        if b in brands:
            return out(TAG_PERSONAL, f"personal email provider ({b})", "high")
    for p in rules.get("personal_domains") or []:
        p = p.lower()
        if d == p or d.endswith("." + p):
            return out(TAG_PERSONAL, f"personal email provider ({p})", "high")

    best = None
    for rule in rules.get("education_rules") or []:
        try:
            if re.search(rule["pattern"], d):
                conf = rule.get("confidence", "low")
                if best is None or CONF_ORDER.get(conf, 0) > CONF_ORDER.get(best[1], 0):
                    best = (rule.get("reason") or rule["pattern"], conf)
        except (re.error, KeyError):
            logger.warning("domain tagging: bad education rule skipped: %r", rule)
    if best:
        return out(TAG_EDUCATION, best[0], best[1])

    for kw in rules.get("keyword_hints") or []:
        if kw and kw.lower() in d:
            return out(TAG_EDUCATION, f"domain contains '{kw}'", "low")
    return out(TAG_OTHER, "no education or personal-provider rule matched", "low")


def account_fields(cls: Dict[str, Any], now: datetime) -> Dict[str, Any]:
    """The fields written on the Accounts doc."""
    return {"domain_key": cls["key"], "domain_tag": cls["tag"], "domain_tag_confidence": cls["confidence"],
            "domain_tagged_at": now}


# ── Domains/{key} aggregate ─────────────────────────────────────────────────

def _apply_to_domain_doc(existing: Optional[dict], cls: Dict[str, Any], created_at: datetime,
                         now: datetime) -> Dict[str, Any]:
    """The Domains doc after counting one more user. Pure. A manual (admin) tag is kept."""
    cur = dict(existing or {})
    manual = cur.get("tag_source") == SOURCE_ADMIN
    seen = list(cur.get("seen_domains") or [])
    if cls["domain"] not in seen and len(seen) < MAX_SEEN_DOMAINS:
        seen.append(cls["domain"])
    orgs = list(cur.get("sample_orgs") or [])
    if cls.get("org_id") and cls["org_id"] not in orgs and len(orgs) < MAX_SAMPLE_ORGS:
        orgs.append(cls["org_id"])
    first = cur.get("first_seen_at")
    if first is None or (created_at and created_at < first):
        first = created_at
    last = cur.get("last_seen_at")
    if last is None or (created_at and created_at > last):
        last = created_at
    doc = {
        "domain": cls["key"],
        "tag": cur["tag"] if manual else cls["tag"],
        "confidence": cur.get("confidence") if manual else cls["confidence"],
        "reason": cur.get("reason") if manual else cls["reason"],
        "tag_source": SOURCE_ADMIN if manual else SOURCE_AUTO,
        "user_count": int(cur.get("user_count") or 0) + 1,
        "first_seen_at": first,
        "last_seen_at": last,
        "seen_domains": seen,
        "sample_orgs": orgs,
    }
    for k in ("tag_set_by", "tag_set_at"):
        if k in cur:
            doc[k] = cur[k]
    return doc


def _txn_create_account(transaction, acct_ref, dom_ref, doc, cls, now):
    """Firestore transaction body: create the Accounts doc and count the user, only if the
    Accounts doc does not exist yet. Returns the doc written, or None if it already existed."""
    if acct_ref.get(transaction=transaction).exists:
        return None
    dsnap = dom_ref.get(transaction=transaction)
    existing = dsnap.to_dict() if dsnap.exists else None
    new_dom = _apply_to_domain_doc(existing, cls, doc.get("created_at") or now, now)
    out = dict(doc)
    # A manual override on the domain also decides the tag stored on the account.
    out.update(account_fields({**cls, "tag": new_dom["tag"], "confidence": new_dom["confidence"]}, now))
    transaction.set(dom_ref, new_dom)
    transaction.set(acct_ref, out)
    return out


def create_account_with_domain(db, uid: str, doc: dict, now: Optional[datetime] = None) -> Optional[dict]:
    """Create Accounts/{uid} (= `doc` + domain fields) and bump Domains/{key}.user_count in ONE
    transaction. Returns the stored doc, or None if the account already existed (nothing counted).
    Raises on failure so the caller may fall back to a plain write (signup must never fail on tagging)."""
    from firebase_admin import firestore
    now = now or _now()
    cls = classify_domain(doc.get("email_domain") or "", db)
    acct_ref = accounts_col(db).document(uid)
    dom_ref = domains_col(db).document(cls["key"]) if cls["key"] else None
    if dom_ref is None:      # no usable domain: create the account, count nothing
        if acct_ref.get().exists:
            return None
        out = {**doc, **account_fields(cls, now)}
        acct_ref.set(out)
        return out
    return firestore.transactional(_txn_create_account)(db.transaction(), acct_ref, dom_ref, doc, cls, now)


def _txn_tag_existing(transaction, acct_ref, dom_ref, cls, now):
    snap = acct_ref.get(transaction=transaction)
    if not snap.exists:
        return None
    acct = snap.to_dict() or {}
    if acct.get("domain_tagged_at"):
        return None
    dsnap = dom_ref.get(transaction=transaction)
    new_dom = _apply_to_domain_doc(dsnap.to_dict() if dsnap.exists else None, cls, acct.get("created_at") or now, now)
    transaction.set(dom_ref, new_dom)
    transaction.update(acct_ref, account_fields({**cls, "tag": new_dom["tag"], "confidence": new_dom["confidence"]}, now))
    return new_dom


def tag_existing_account(db, uid: str, acct: dict, now: Optional[datetime] = None) -> Optional[dict]:
    """Backfill one pre-TASK-039 account (idempotent: accounts already carrying `domain_tagged_at` are
    skipped and counted nothing). Returns the Domains doc written, or None if skipped."""
    from services.accounts_service import email_domain
    from firebase_admin import firestore
    now = now or _now()
    dom = acct.get("email_domain") or email_domain(acct.get("email") or "")
    cls = classify_domain(dom, db)
    if not cls["key"]:
        return None
    return firestore.transactional(_txn_tag_existing)(
        db.transaction(), accounts_col(db).document(uid), domains_col(db).document(cls["key"]), cls, now)


# ── admin override ──────────────────────────────────────────────────────────

def set_manual_tag(db, key: str, tag: str, admin: dict, now: Optional[datetime] = None) -> Dict[str, Any]:
    """Pin a tag on Domains/{key} (tag_source "admin"; sticks across reclassification). tag "auto" clears
    the pin and reclassifies. Returns {"before": ..., "after": ...} (the doc fields changed)."""
    now = now or _now()
    ref = domains_col(db).document(key)
    snap = ref.get()
    if not snap.exists:
        raise KeyError(key)
    before = snap.to_dict() or {}
    if tag == SOURCE_AUTO:
        cls = classify_domain(key, db)
        patch = {"tag": cls["tag"], "confidence": cls["confidence"], "reason": cls["reason"],
                 "tag_source": SOURCE_AUTO, "tag_set_by": None, "tag_set_at": now}
    else:
        patch = {"tag": tag, "confidence": "high", "reason": "set by admin", "tag_source": SOURCE_ADMIN,
                 "tag_set_by": admin.get("email") or admin.get("uid"), "tag_set_at": now}
    ref.update(patch)
    keep = ("tag", "confidence", "reason", "tag_source")
    return {"before": {k: before.get(k) for k in keep}, "after": {k: patch[k] for k in keep}}
