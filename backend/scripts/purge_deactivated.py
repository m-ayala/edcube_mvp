#!/usr/bin/env python3
"""
TASK-031: permanent deletion of accounts deactivated more than the grace period ago
(Accounts.delete_after has passed). Person-run, no scheduler. DRY-RUN by default.

For each such account it lists / deletes:
  - the user's courses in the PERSONAL workspace (Users/personal/curricula where teacherUid == uid)
  - Users/personal/teacher_profiles/{uid}, Users/personal/teachers/{uid} (+ its subcollections),
    Users/personal/usage/{uid} (+ months)
  - the Firebase Auth user (skip with --keep-auth)
  - finally Accounts/{uid}
Org-workspace content (Users/<org>/...) is NEVER touched: it belongs to the org.
Cloud Storage objects are NOT deleted by this script (list them separately before --apply).
Every deletion is logged to AdminAudit.

Usage (from backend/):
    python scripts/purge_deactivated.py                 # dry run: list what would be deleted
    python scripts/purge_deactivated.py --apply
    python scripts/purge_deactivated.py --apply --uid <uid>   # one account only
"""

import argparse
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import firebase_admin
from firebase_admin import auth

from firebase.paths import PERSONAL_SPACE_ID, accounts_col, org_col
from firebase.project import firestore_client
from services import accounts_service as accts

SCRIPT_ADMIN = {"uid": "script:purge_deactivated", "email": None}


def delete_doc_tree(doc_ref, apply):
    """Delete a doc and everything under it. Returns the number of docs (counted either way)."""
    n = 0
    for sub in doc_ref.collections():
        for d in sub.list_documents():
            n += delete_doc_tree(d, apply)
    if doc_ref.get().exists:
        n += 1
        if apply:
            doc_ref.delete()
    return n


def due_accounts(db, now, only_uid=None):
    if only_uid:
        snap = accounts_col(db).document(only_uid).get()
        docs = [snap] if snap.exists else []
    else:
        docs = list(accounts_col(db).where("status", "==", accts.STATUS_DEACTIVATED).stream())
    for d in docs:
        data = d.to_dict() or {}
        end = accts.as_utc(data.get("delete_after"))
        if data.get("status") == accts.STATUS_DEACTIVATED and end is not None and end <= now:
            yield d.id, data


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--apply", action="store_true", help="actually delete (default is a dry run)")
    ap.add_argument("--uid", help="only this uid")
    ap.add_argument("--keep-auth", action="store_true", help="do not delete the Firebase Auth user")
    args = ap.parse_args()
    apply = args.apply

    if not firebase_admin._apps:
        firebase_admin.initialize_app()
    db = firestore_client()
    now = datetime.now(timezone.utc)
    print(f"== purge_deactivated ({'APPLY' if apply else 'DRY RUN -- pass --apply to delete'}) ==")

    total = 0
    for uid, data in due_accounts(db, now, args.uid):
        total += 1
        print(f"\n{uid} <{data.get('email')}> deactivated {data.get('deactivated_at')}, delete_after {data.get('delete_after')}")
        courses = list(org_col(db, PERSONAL_SPACE_ID, "curricula").where("teacherUid", "==", uid).stream())
        print(f"  personal courses: {len(courses)}")
        counts = {"courses": 0}
        for c in courses:
            counts["courses"] += delete_doc_tree(c.reference, apply)
        for name in ("teacher_profiles", "teachers", "usage"):
            counts[name] = delete_doc_tree(org_col(db, PERSONAL_SPACE_ID, name).document(uid), apply)
        print(f"  {'deleted' if apply else 'would delete'} docs: {counts}")
        print(f"  Firebase Auth user: {'kept (--keep-auth)' if args.keep_auth else ('deleted' if apply else 'would delete')}")
        print(f"  Accounts/{uid}: {'deleted' if apply else 'would delete'}")
        if apply:
            accts.log_admin_action(SCRIPT_ADMIN, "purge_deactivated", uid, {"email": data.get("email")}, counts, db)
            if not args.keep_auth:
                try:
                    auth.delete_user(uid)
                except Exception as e:
                    print(f"  auth delete failed: {e}")
            accounts_col(db).document(uid).delete()
            accts.invalidate(uid)
    print(f"\n{total} account(s) past their grace period." + ("" if apply else " Dry run: nothing was deleted."))


if __name__ == "__main__":
    main()
