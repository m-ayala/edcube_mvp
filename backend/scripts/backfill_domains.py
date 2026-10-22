#!/usr/bin/env python3
"""
TASK-039: tag the email domain of existing accounts and build the Domains/{key} aggregate.
Person-run. DRY-RUN by default. Idempotent: an account that already has `domain_tagged_at` is skipped
and counted nothing, so re-running never double counts (each account is tagged + counted in one
transaction). Nothing is blocked, deleted or re-planned; no emails are copied into Domains.

Usage (from backend/):
    python scripts/backfill_domains.py            # dry run: per-domain counts it would add
    python scripts/backfill_domains.py --apply
"""

import argparse
import os
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import firebase_admin

from firebase.paths import accounts_col
from services import accounts_service as accts
from services import domain_tagging


def run(db, apply: bool, out=print) -> dict:
    """Returns {"accounts": n, "to_tag": n, "tagged": n, "skipped": n, "domains": {key: count}}."""
    stats = {"accounts": 0, "to_tag": 0, "tagged": 0, "skipped": 0}
    per = Counter()
    tags = {}
    for sn in accounts_col(db).stream():
        a = sn.to_dict() or {}
        stats["accounts"] += 1
        if a.get("domain_tagged_at"):
            stats["skipped"] += 1
            continue
        cls = domain_tagging.classify_domain(a.get("email_domain") or accts.email_domain(a.get("email") or ""), db)
        if not cls["key"]:
            stats["skipped"] += 1
            continue
        stats["to_tag"] += 1
        per[cls["key"]] += 1
        tags[cls["key"]] = (cls["tag"], cls["confidence"])
        if apply and domain_tagging.tag_existing_account(db, sn.id, a):
            stats["tagged"] += 1
    for key, n in per.most_common():
        out(f"  {key:40s} +{n:<5d} {tags[key][0]} ({tags[key][1]})")
    stats["domains"] = dict(per)
    out(f"{'APPLIED' if apply else 'DRY RUN'}: {stats['accounts']} accounts, {stats['to_tag']} to tag, "
        f"{stats['tagged']} tagged, {stats['skipped']} already tagged/skipped")
    return stats


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="write (default is a dry run)")
    args = ap.parse_args()
    if not firebase_admin._apps:
        firebase_admin.initialize_app()
    from firebase.project import firestore_client
    run(firestore_client(), args.apply)


if __name__ == "__main__":
    main()
