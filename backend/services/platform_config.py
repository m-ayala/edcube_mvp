# backend/services/platform_config.py
"""
Central platform config (TASK-031): the ONE place plan limits, trial length,
collaborator caps, the reset rule and per-plan feature flags are defined.

Source of truth at runtime: the Firestore doc `EdCube/platform_config`
(sibling of `EdCube/knowledge_base`; written by the setup script / admin only,
never by clients). DEFAULT_PLATFORM_CONFIG below is used ONLY when that doc, or
a key inside it, is missing. No limit number may appear anywhere else in the code.

Merge rule: the Firestore doc is merged over the defaults key by key (per plan,
per limit). A key present in the doc wins, including an explicit null (which
means "unlimited" for limits and "no cap" for collaborator_cap).

The loaded config is cached in-process for ~5 minutes (CACHE_TTL_SECONDS).
"""

import copy
import logging
import time
from typing import Any, Dict, Optional

import firebase_admin

from firebase.paths import platform_config_doc
from firebase.public_space import PLAN_ORG, PLAN_TEACHER, PLAN_TRIAL, PLANS

logger = logging.getLogger(__name__)

CACHE_TTL_SECONDS = 300

# Credit kinds used in plan limits (null = unlimited). "courses" = Generate Course,
# "generates" = Generate button, "edo_messages" = Edo chat messages.
LIMIT_KINDS = ("courses", "generates", "edo_messages")

DEFAULT_PLATFORM_CONFIG: Dict[str, Any] = {
    # PLACEHOLDER: the 30-day trial length is not final. Change it in
    # EdCube/platform_config (no deploy needed), not here.
    "trial_length_days": 30,
    "trial_length_is_placeholder": True,
    # How paid-plan credits reset: on the anniversary of plan_started_at (days 29-31
    # clamp to month end). The trial allowance is a one-time grant and never resets.
    # "calendar" resets on the 1st of the month instead. Enforced by usage_service (TASK-033).
    "reset_rule": "anniversary",
    # A credit reservation that is never confirmed or refunded (e.g. a crashed process) is
    # released lazily after this many minutes (TASK-033).
    "credit_reservation_ttl_minutes": 15,
    # Days a deactivated account stays restorable before permanent deletion.
    "deactivation_grace_days": 30,
    # PLACEHOLDER PRICES (TASK-034). Every rate is 0 until the person fills in real vendor prices in
    # EdCube/platform_config -> cost_rates (no deploy needed). They only drive the est_cost_usd fields
    # of UsageLog rows; they never affect credits or limits. Token prices are USD per 1,000,000 tokens;
    # a model not listed (or a dated variant) uses the longest matching prefix, else "default".
    "cost_rates": {
        "is_placeholder": True,
        "currency": "USD",
        "llm_per_1m_tokens": {
            "default": {"input": 0, "output": 0},
            "gpt-4o": {"input": 0, "output": 0},
            "gpt-4o-mini": {"input": 0, "output": 0},
        },
        "browserbase": {
            "per_search": 0,
            "per_fetch": 0,
            "per_session": 0,
            "per_session_minute": 0,
            "per_render_page": 0,
        },
    },
    # Email-domain tagging rules (TASK-039), read by services/domain_tagging.py; nothing is hardcoded there.
    # A rule is {pattern: regex matched (re.search) on the lowercased full domain, confidence, reason}.
    # Lists (not dicts) are REPLACED wholesale by an override in EdCube/platform_config -> domain_rules.
    "domain_rules": {
        # A label equal to one of these (gmail.com, yahoo.co.uk, hotmail.fr, gmx.de ...) is a personal provider.
        "personal_brand_labels": ["gmail", "googlemail", "outlook", "hotmail", "live", "msn", "yahoo", "ymail",
                                  "icloud", "aol", "proton", "protonmail", "gmx", "zoho", "yandex", "rocketmail",
                                  "fastmail", "hey", "tutanota", "tuta", "qq", "163", "126", "naver", "rediffmail"],
        # Exact domains (and their subdomains) that are personal providers.
        "personal_domains": ["me.com", "mac.com", "mail.com", "pm.me", "proton.me", "comcast.net", "att.net",
                             "verizon.net", "sbcglobal.net", "bellsouth.net", "cox.net", "charter.net", "mail.ru",
                             "web.de"],
        "education_rules": [
            {"pattern": r"\.edu$", "confidence": "high", "reason": "US .edu domain"},
            {"pattern": r"\.k12\.[a-z]{2}\.us$", "confidence": "high", "reason": "US K-12 (.k12.<state>.us)"},
            {"pattern": r"(^|\.)k12\.", "confidence": "high", "reason": "k12 label"},
            {"pattern": r"\.(ac|edu)\.[a-z]{2}$", "confidence": "high", "reason": "academic second-level domain (.ac.<cc> / .edu.<cc>)"},
            {"pattern": r"\.(sch|school)\.(uk|nz|za|ie|ng|ke)$", "confidence": "high", "reason": "school second-level domain"},
            {"pattern": r"\.(schule|school|schools)$", "confidence": "medium", "reason": "school top-level domain"},
            {"pattern": r"(^|\.)[a-z0-9-]*isd\.[a-z.]+$", "confidence": "low", "reason": "US independent school district pattern (*isd.*)"},
            {"pattern": r"(^|\.)[a-z0-9-]*schools\.org$", "confidence": "low", "reason": "US public school pattern (*schools.org)"},
            {"pattern": r"(^|\.)[a-z0-9-]*sd\.org$", "confidence": "low", "reason": "US school district pattern (*sd.org)"},
            {"pattern": r"usd[0-9]*\.org$", "confidence": "low", "reason": "US unified school district pattern (*usd*.org)"},
            {"pattern": r"^[a-z]{2,}usd\.[a-z.]+$", "confidence": "low", "reason": "name ending in usd (unified school district)"},
        ],
        # Whole-or-partial words in the domain that suggest a school; lowest-confidence hints.
        "keyword_hints": ["school", "academy", "university", "college", "district"],
        # Second-level labels under a 2-letter ccTLD that make a 3-label stats key (cs.ox.ac.uk -> ox.ac.uk).
        "second_level_labels": ["ac", "co", "edu", "org", "gov", "com", "net", "sch", "school", "or", "ne", "go"],
    },
    "plans": {
        PLAN_TRIAL: {
            "limits": {"courses": 5, "generates": 50, "edo_messages": 75},
            "limit_period": "one_time",
            "collaborator_cap": 0,
            "can_share_links": True,     # view-only links
            "can_coedit": False,
            "org_library": False,
        },
        PLAN_TEACHER: {
            "limits": {"courses": 10, "generates": 150, "edo_messages": 500},
            "limit_period": "monthly",
            "collaborator_cap": 3,
            "can_share_links": True,
            "can_coedit": True,
            "org_library": False,
        },
        PLAN_ORG: {
            # Pooled across the org; the pool itself lives on the org doc (Users/{orgId}.pool).
            "limits": {"courses": None, "generates": None, "edo_messages": None},
            "limit_period": "pooled",
            "collaborator_cap": None,    # org-defined (Users/{orgId}.collaborator_cap); null = unlimited
            "can_share_links": True,
            "can_coedit": True,
            "org_library": True,
        },
    },
}

_cache: Optional[tuple] = None  # (config, fetched_at)


def _db():
    if not firebase_admin._apps:
        firebase_admin.initialize_app()
    from firebase.project import firestore_client
    return firestore_client()


def _merge(base: Any, override: Any) -> Any:
    """Recursively merge `override` onto `base`; override wins (None included) for non-dicts."""
    if isinstance(base, dict) and isinstance(override, dict):
        out = copy.deepcopy(base)
        for k, v in override.items():
            out[k] = _merge(base[k], v) if k in base else copy.deepcopy(v)
        return out
    return copy.deepcopy(override)


def clear_cache() -> None:
    global _cache
    _cache = None


def get_config(db=None) -> Dict[str, Any]:
    """The effective config: defaults overlaid with EdCube/platform_config. Cached ~5 min.
    Any read failure falls back to defaults (and is logged)."""
    global _cache
    now = time.time()
    if _cache is not None and (now - _cache[1]) < CACHE_TTL_SECONDS:
        return _cache[0]
    stored: dict = {}
    try:
        snap = platform_config_doc(db or _db()).get()
        if snap.exists:
            stored = snap.to_dict() or {}
    except Exception as e:  # noqa: BLE001
        logger.warning("platform_config read failed, using code defaults: %s", e)
    cfg = _merge(DEFAULT_PLATFORM_CONFIG, stored)
    _cache = (cfg, now)
    return cfg


def plan_config(plan: str, db=None) -> Dict[str, Any]:
    cfg = get_config(db)
    return cfg["plans"].get(plan) or cfg["plans"][PLAN_TRIAL]


def plan_limits(plan: str, db=None) -> Dict[str, Optional[int]]:
    """{'courses','generates','edo_messages'} -> int or None (unlimited)."""
    limits = plan_config(plan, db).get("limits") or {}
    return {k: limits.get(k) for k in LIMIT_KINDS}


def collaborator_cap(plan: str, db=None) -> Optional[int]:
    """Max collaborators per course for the plan; None = unlimited/org-defined."""
    return plan_config(plan, db).get("collaborator_cap")


def plan_features(plan: str, db=None) -> Dict[str, bool]:
    c = plan_config(plan, db)
    return {
        "can_share_links": bool(c.get("can_share_links")),
        "can_coedit": bool(c.get("can_coedit")),
        "org_library": bool(c.get("org_library")),
    }


def trial_length_days(db=None) -> int:
    return int(get_config(db).get("trial_length_days") or 0)


def deactivation_grace_days(db=None) -> int:
    return int(get_config(db).get("deactivation_grace_days") or 0)


def domain_rules(db=None) -> Dict[str, Any]:
    return get_config(db).get("domain_rules") or {}


def config_document_body() -> Dict[str, Any]:
    """What the setup script writes when EdCube/platform_config is missing."""
    return copy.deepcopy(DEFAULT_PLATFORM_CONFIG)


__all__ = [
    "DEFAULT_PLATFORM_CONFIG", "get_config", "clear_cache", "plan_config", "plan_limits",
    "collaborator_cap", "plan_features", "trial_length_days", "deactivation_grace_days",
    "domain_rules", "config_document_body", "PLANS", "LIMIT_KINDS",
]
