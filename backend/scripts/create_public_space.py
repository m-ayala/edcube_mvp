#!/usr/bin/env python3
"""
TASK-028: one-time setup for the reserved public space `Users/public`.

Idempotent: creates the `Users/public` doc ONLY if it is missing (an existing
doc -- including its live `user_count` and any plan limits you tuned -- is
never overwritten). Run by the person, never automatically.

Usage (from backend/, Application Default Credentials, like seed_knowledge_base.py):
    python scripts/create_public_space.py --dry-run
    python scripts/create_public_space.py                       # max_users=500
    python scripts/create_public_space.py --max-users 200
    python scripts/create_public_space.py --backfill-claims --dry-run
    python scripts/create_public_space.py --backfill-claims     # set `org` claim for existing org users

--backfill-claims: for every org (non-public) doc under Users/, sets the custom
claim {org: <orgId>} (merged with existing claims) on each uid in
Users/{org}/teachers. Optional: the rules/backends fall back to domain matching.
Claims take effect on the user's next token refresh.
"""

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import firebase_admin
from firebase_admin import auth, firestore

from firebase.project import firestore_client
from firebase.paths import ORGS_ROOT, org_doc, org_col
from firebase.public_space import (
    PUBLIC_SPACE_ID,
    ORG_CLAIM,
    default_public_space_doc,
)


def create_public_space(db, max_users: int, dry_run: bool) -> None:
    ref = org_doc(db, PUBLIC_SPACE_ID)
    if ref.get().exists:
        print(f"Users/{PUBLIC_SPACE_ID} already exists -- leaving it untouched.")
        return
    body = default_public_space_doc(max_users)
    print(f"{'[dry-run] would create' if dry_run else 'Creating'} Users/{PUBLIC_SPACE_ID}:")
    print(f"  {body}")
    if not dry_run:
        ref.set(body)
        print("Created.")


def backfill_claims(db, dry_run: bool) -> None:
    total = changed = failed = 0
    for org in db.collection(ORGS_ROOT).stream():
        if org.id == PUBLIC_SPACE_ID:
            continue
        for t in org_col(db, org.id, "teachers").stream():
            total += 1
            try:
                claims = dict(auth.get_user(t.id).custom_claims or {})
                if claims.get(ORG_CLAIM) == org.id:
                    continue
                claims[ORG_CLAIM] = org.id
                print(f"  {'[dry-run] would set' if dry_run else 'set'} org={org.id} on uid {t.id}")
                if not dry_run:
                    auth.set_custom_user_claims(t.id, claims)
                changed += 1
            except Exception as e:  # e.g. teachers doc whose auth user was deleted
                failed += 1
                print(f"  skipped uid {t.id}: {e}")
    print(f"Claims: {total} org teachers scanned, {changed} to set/set, {failed} skipped.")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--max-users", type=int, default=500, help="public signup cap (default 500)")
    ap.add_argument("--dry-run", action="store_true", help="print what would happen; write nothing")
    ap.add_argument("--backfill-claims", action="store_true", help="also set the `org` claim for existing org users")
    args = ap.parse_args()

    if not firebase_admin._apps:
        firebase_admin.initialize_app()
    db = firestore_client()

    create_public_space(db, args.max_users, args.dry_run)
    if args.backfill_claims:
        backfill_claims(db, args.dry_run)


if __name__ == "__main__":
    main()
