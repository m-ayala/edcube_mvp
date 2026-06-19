#!/usr/bin/env python3
"""
One-time migration: flatten synopsis_* collections → synopsis/ICC/weeks/... hierarchy.

Run from the backend/ directory:
    python scripts/migrate_synopsis.py

The old collections are NOT deleted automatically. After verifying in Firebase Console,
delete synopsis_weeks, synopsis_camps, synopsis_entries, synopsis_food manually.
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import firebase_admin
from firebase_admin import credentials, firestore


def main():
    if not firebase_admin._apps:
        firebase_admin.initialize_app()
    db = firestore.client()

    icc_ref = db.collection('synopsis').document('ICC')
    weeks_col = icc_ref.collection('weeks')

    # ── 1. Migrate weeks ──────────────────────────────────────────────────────
    old_weeks = list(db.collection('synopsis_weeks').stream())
    print(f"Migrating {len(old_weeks)} week(s)...")
    week_ids = set()
    for doc in old_weeks:
        data = doc.to_dict()
        weeks_col.document(doc.id).set(data)
        week_ids.add(doc.id)
    print(f"  ✅ {len(old_weeks)} week(s) written to synopsis/ICC/weeks/")

    # ── 2. Embed food into week documents ────────────────────────────────────
    old_food = list(db.collection('synopsis_food').stream())
    print(f"Migrating {len(old_food)} food menu(s)...")
    food_count = 0
    for doc in old_food:
        week_id = doc.id  # synopsis_food uses week_id as doc ID
        weeks_col.document(week_id).set({'food': doc.to_dict()}, merge=True)
        food_count += 1
    print(f"  ✅ {food_count} food menu(s) embedded into week documents")

    # ── 3. Migrate camps ──────────────────────────────────────────────────────
    old_camps = list(db.collection('synopsis_camps').stream())
    print(f"Migrating {len(old_camps)} camp(s)...")
    camp_count = 0
    skipped_camps = 0
    for doc in old_camps:
        data = doc.to_dict()
        week_id = data.get('week_id')
        if not week_id:
            print(f"  ⚠️  Camp {doc.id} has no week_id — skipping")
            skipped_camps += 1
            continue
        weeks_col.document(week_id).collection('camps').document(doc.id).set(data)
        camp_count += 1
    print(f"  ✅ {camp_count} camp(s) written  |  {skipped_camps} skipped")

    # ── 4. Migrate entries ────────────────────────────────────────────────────
    old_entries = list(db.collection('synopsis_entries').stream())
    print(f"Migrating {len(old_entries)} entr(ies)...")
    entry_count = 0
    skipped_entries = 0
    for doc in old_entries:
        data = doc.to_dict()
        week_id = data.get('week_id')
        camp_id = data.get('camp_id')
        if not week_id or not camp_id:
            print(f"  ⚠️  Entry {doc.id} missing week_id or camp_id — skipping")
            skipped_entries += 1
            continue
        (weeks_col.document(week_id)
                  .collection('camps').document(camp_id)
                  .collection('entries').document(doc.id)
                  .set(data))
        entry_count += 1
    print(f"  ✅ {entry_count} entr(ies) written  |  {skipped_entries} skipped")

    print()
    print("Migration complete.")
    print("Verify in Firebase Console, then manually delete the old collections:")
    print("  synopsis_weeks, synopsis_camps, synopsis_entries, synopsis_food")


if __name__ == '__main__':
    main()
