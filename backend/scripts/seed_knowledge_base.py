#!/usr/bin/env python3
"""
Seed the taxonomy knowledge base under EdCube/knowledge_base in Firestore, as
categorized subcollections (old kb_* name -> category; see kb_seed_data.KB_CATEGORY):
kb_age_bands -> age, kb_objectives -> pedagogy, kb_worksheet_formats -> worksheets,
kb_activity_formats -> activities, kb_content_formats -> content,
kb_content_types -> content_types, kb_thinking_levels -> thinking_levels,
kb_group_sizes -> group_sizes, kb_teacher_attention_levels -> teacher_attention.
Also ensures the EdCube/knowledge_base document itself exists (merge-only), so it
is a real document and not a phantom.

The data itself lives in services/kb_seed_data.py (edit it there).

Safe to re-run. Default mode is MERGE: a document that does not exist is created
in full; a document that exists only gets the fields that are missing or blank
("" / [] / {} / null) filled in. Values that someone edited by hand in Firestore
are never overwritten. Use --force to overwrite every seeded field with the
values in kb_seed_data.py (fields not in the seed data are left alone).
Use --dry-run to print what would change without writing anything.

Run from the backend/ directory:
    python scripts/seed_knowledge_base.py [--dry-run] [--force]
"""

import argparse
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import firebase_admin
from firebase_admin import firestore

from firebase.paths import kb_doc, kb_col
from firebase.project import firestore_client
from services.kb_seed_data import (  # noqa: F401  (re-exported for backward compatibility)
    AGE_BANDS,
    OBJECTIVES,
    WORKSHEET_FORMATS,
    ACTIVITY_FORMATS,
    CONTENT_FORMATS,
    CONTENT_TYPES,
    COLLECTIONS,
    KB_CATEGORY,
    is_blank,
)


def plan_write(existing, seed_data, force=False):
    """
    Decide what to write for one document. Pure function (no Firestore).
    existing: dict of the current doc, or None if it does not exist.
    Returns (action, fields) where action is 'create', 'update' or 'skip'.
    """
    if existing is None:
        return "create", dict(seed_data)
    if force:
        changed = {k: v for k, v in seed_data.items() if existing.get(k) != v}
        return ("update", changed) if changed else ("skip", {})
    fill = {k: v for k, v in seed_data.items() if k not in existing or is_blank(existing.get(k))}
    # Do not "fill" a blank with another blank.
    fill = {k: v for k, v in fill.items() if not is_blank(v)}
    return ("update", fill) if fill else ("skip", {})


def target_path(collection_name):
    """Firestore path a seed collection is written to (new layout only)."""
    return f"EdCube/knowledge_base/{KB_CATEGORY[collection_name]}"


def _seed_collection(db, collection_name, items, force=False, dry_run=False):
    col = kb_col(db, KB_CATEGORY[collection_name])
    path = target_path(collection_name)
    counts = {"create": 0, "update": 0, "skip": 0}
    for item in items:
        doc_id = item["id"]
        data = {k: v for k, v in item.items() if k != "id"}
        ref = col.document(doc_id)
        snap = ref.get()
        existing = snap.to_dict() if snap.exists else None
        action, fields = plan_write(existing, data, force=force)
        counts[action] += 1
        if action != "skip":
            print(f"    {action:6s} {doc_id}: {', '.join(sorted(fields))}")
            if not dry_run:
                if action == "create":
                    ref.set(fields)
                else:
                    ref.update(fields)
    verb = "would be" if dry_run else "were"
    print(f"  {path}: {counts['create']} created, {counts['update']} updated, "
          f"{counts['skip']} unchanged ({verb} applied)")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--force", action="store_true",
                        help="overwrite seeded fields even where Firestore already has a value")
    parser.add_argument("--dry-run", action="store_true", help="print changes, write nothing")
    args = parser.parse_args()

    if not firebase_admin._apps:
        firebase_admin.initialize_app()
    db = firestore_client()

    mode = "FORCE overwrite" if args.force else "merge (fill missing only)"
    print(f"Mode: {mode}{' [dry run]' if args.dry_run else ''}")
    print("Ensuring EdCube/knowledge_base doc exists (merge)...")
    if not args.dry_run:
        kb_doc(db).set({"description": "EdCube platform-wide knowledge base"}, merge=True)
    for name, items in COLLECTIONS.items():
        print(f"Seeding {target_path(name)}...")
        _seed_collection(db, name, items, force=args.force, dry_run=args.dry_run)

    print()
    print("Done.")


if __name__ == "__main__":
    main()
