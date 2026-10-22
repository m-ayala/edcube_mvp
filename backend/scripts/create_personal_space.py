#!/usr/bin/env python3
"""
TASK-028 (renamed TASK-031): one-time setup (scripts/setup_launch_accounts.py does this and more) for the reserved personal workspace `Users/personal`.

Idempotent: creates the `Users/personal` doc ONLY if it is missing (an existing
doc is
never overwritten). Run by the person, never automatically.

Usage (from backend/, Application Default Credentials, like seed_knowledge_base.py):
    python scripts/create_personal_space.py --dry-run
    python scripts/create_personal_space.py
    python scripts/create_personal_space.py --backfill-claims --dry-run
    python scripts/create_personal_space.py --backfill-claims     # set `org` claim for existing org users

--backfill-claims: for every org (non-personal) doc under Users/, sets the custom
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
    PERSONAL_SPACE_ID,
    ORG_CLAIM,
    default_personal_space_doc,
)


def create_personal_space(db, dry_run: bool) -> None:
    ref = org_doc(db, PERSONAL_SPACE_ID)
    if ref.get().exists:
        print(f"Users/{PERSONAL_SPACE_ID} already exists -- leaving it untouched.")
        return
    body = default_personal_space_doc()
    print(f"{'[dry-run] would create' if dry_run else 'Creating'} Users/{PERSONAL_SPACE_ID}:")
    print(f"  {body}")
    if not dry_run:
        ref.set(body)
        print("Created.")


def backfill_claims(db, dry_run: bool) -> None:
    total = changed = failed = 0
    for org in db.collection(ORGS_ROOT).stream():
        if org.id == PERSONAL_SPACE_ID:
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
    ap.add_argument("--dry-run", action="store_true", help="print what would happen; write nothing")
    ap.add_argument("--backfill-claims", action="store_true", help="also set the `org` claim for existing org users")
    args = ap.parse_args()

    if not firebase_admin._apps:
        firebase_admin.initialize_app()
    db = firestore_client()

    create_personal_space(db, args.dry_run)
    if args.backfill_claims:
        backfill_claims(db, args.dry_run)


if __name__ == "__main__":
    main()
