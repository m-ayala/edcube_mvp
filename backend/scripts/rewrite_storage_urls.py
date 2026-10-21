"""
Rewrite Storage links stored in Firestore after the project move from
edcube-8fe7d to edcubeai-fdba7.

Files were copied bucket-to-bucket with their download tokens intact, so a
stored link only needs its bucket name swapped. Walks every document in the
database (all root collections, all subcollections, including subcollections
under parent docs that don't exist) and replaces the old bucket name inside
any string, at any nesting depth.

Dry run by default; pass --apply to write. Re-runnable (already-rewritten
strings no longer match). Also reports, without changing, any other string
that still mentions the old project ID.

    python scripts/rewrite_storage_urls.py            # report only
    python scripts/rewrite_storage_urls.py --apply    # write
"""

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import firebase_admin
from google.cloud.firestore_v1.field_path import FieldPath
from firebase.project import firestore_client, STORAGE_BUCKET

OLD_PROJECT = "edcube-8fe7d"
OLD_BUCKETS = ["edcube-8fe7d.firebasestorage.app", "edcube-8fe7d.appspot.com"]


def rewrite(value, counts):
    """Return (new_value, changed) with old bucket names replaced in every string."""
    if isinstance(value, str):
        new = value
        for old in OLD_BUCKETS:
            new = new.replace(old, STORAGE_BUCKET)
        if new != value:
            counts["strings"] += 1
            return new, True
        if OLD_PROJECT in value:
            counts["other_mentions"] += 1
        return value, False
    if isinstance(value, list):
        out, changed = [], False
        for v in value:
            nv, c = rewrite(v, counts)
            out.append(nv)
            changed |= c
        return out, changed
    if isinstance(value, dict):
        out, changed = {}, False
        for k, v in value.items():
            nv, c = rewrite(v, counts)
            out[k] = nv
            changed |= c
        return out, changed
    return value, False


def walk(collection, apply, counts):
    for ref in collection.list_documents():
        snap = ref.get()
        if snap.exists:
            counts["docs"] += 1
            updates = {}
            for field, value in (snap.to_dict() or {}).items():
                new, changed = rewrite(value, counts)
                if changed:
                    updates[FieldPath(field).to_api_repr()] = new
            if updates:
                counts["docs_changed"] += 1
                print(f"{'UPDATE' if apply else 'would update'} {ref.path}: {', '.join(updates)}")
                if apply:
                    ref.update(updates)
        for sub in ref.collections():
            walk(sub, apply, counts)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--apply", action="store_true", help="write changes (default: dry run)")
    args = parser.parse_args()

    if not firebase_admin._apps:
        firebase_admin.initialize_app()
    db = firestore_client()
    print(f"Project {db.project}, database {db._database}, new bucket {STORAGE_BUCKET}"
          f"{'' if args.apply else ' [dry run]'}")

    counts = {"docs": 0, "docs_changed": 0, "strings": 0, "other_mentions": 0}
    for col in db.collections():
        walk(col, args.apply, counts)
    print(f"Scanned {counts['docs']} docs; {counts['docs_changed']} docs / {counts['strings']} strings "
          f"{'rewritten' if args.apply else 'to rewrite'}; "
          f"{counts['other_mentions']} other strings still mention {OLD_PROJECT} (not changed).")


if __name__ == "__main__":
    main()
