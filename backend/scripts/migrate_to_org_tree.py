#!/usr/bin/env python3
"""
TASK-007: one-time migration copying Firestore data from the old flat
top-level collections into the new `EdCube` / `Users/{org}` tree.

See tasks/firestore-reorg-spec.md -- "Target tree", "Old -> new mapping",
"TASK-007", and "Round 2" (especially sections C and F; Round 2 overrides
Round 1 wherever they conflict) -- for the full spec this script implements.

Every destination path is built with backend/firebase/paths.py helpers (the
same ones services/firebase_service.py uses), so this script and the running
app can never disagree about where something lives. Org membership checks
reuse backend/firebase/org_registry.py's posture: 'icc' is the only valid
destination org -- 'test-org' is dropped (Round 2, rule 5) and there is no
default org for anything else (Round 2, rule 2).

Behaviour
---------
- Dry run is the default: reads only, writes nothing. Prints a
  source -> destination plan with per-mapping counts, plus any
  skipped/unresolvable docs, listed by id.
- `--apply`: performs the copy. Copy-only (it never deletes from the old
  collections) and idempotent -- every write is `.set()` on the same
  document id as the source, so running it twice just overwrites in place.
- `--delete-old`: for TASK-010 only, not exercised by this task. Refuses to
  run unless every destination collection already has at least as many docs
  as are eligible to be migrated into it (i.e. a prior --apply succeeded),
  and requires the explicit `--yes-really` flag on top of that. Deletes the
  fixed list of old top-level collections (including their subcollections);
  never touches anything under `Users/` or `EdCube/`.

Run from backend/, with the project's venv, using Application Default
Credentials exactly as scripts/seed_knowledge_base.py does:
    .venv/bin/python scripts/migrate_to_org_tree.py            # dry run (default)
    .venv/bin/python scripts/migrate_to_org_tree.py --apply
    .venv/bin/python scripts/migrate_to_org_tree.py --delete-old --yes-really   # TASK-010 only
"""

import argparse
import os
import sys
from dataclasses import dataclass, field
from typing import Dict, List, Optional

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import firebase_admin
from firebase_admin import firestore

from firebase.paths import (
    ORGS_ROOT,
    PLATFORM_ROOT,
    kb_doc,
    kb_col,
    org_doc,
    org_col,
    afterschool_doc,
    summer_camps_doc,
    afterschool_entries_col,
)

# Only 'icc' is a valid destination org for this migration. 'test-org' is
# dropped per tasks/firestore-reorg-spec.md Round 2, rule 5 ("test-org is
# dropped... not migrated"), and there is no default org to fall back to for
# anything else (Round 2, rule 2: "Unregistered emails get nothing").
VALID_ORGS = {"icc"}

# Users/icc's registry fields (tasks/firestore-reorg-spec.md, Round 2, section A).
ICC_ORG_DOC = {
    "name": "India Community Center",
    "domains": ["indiacc.org"],
    "allowed_emails": ["manaswini.ayala@gmail.com"],
}

# Old top-level KB collection name -> new EdCube/knowledge_base/{category}.
KB_MAPPING = {
    "kb_objectives": "pedagogy",
    "kb_age_bands": "age",
    "kb_content_formats": "content",
    "kb_worksheet_formats": "worksheets",
    "kb_activity_formats": "activities",
}

# Not migrated anywhere -- listed only so the report can say so explicitly.
NOT_COPIED = [
    "leads",
    "synopsis_weeks", "synopsis_camps", "synopsis_entries", "synopsis_food",
    "worksheet_pdfs",
]

# Old top-level collections --delete-old removes (TASK-010 only). Never
# includes anything under Users/ or EdCube/ -- those are the new roots this
# script writes to, not old collections to clean up.
OLD_TOP_LEVEL_FOR_DELETE = [
    "curricula", "teacher_profiles", "teachers", "notifications",
    "synopsis", "afterschool_synopsis_months", "afterschool_synopsis",
    "kb_objectives", "kb_age_bands", "kb_content_formats",
    "kb_worksheet_formats", "kb_activity_formats",
    "leads", "synopsis_weeks", "synopsis_camps", "synopsis_entries", "synopsis_food",
    "worksheet_pdfs",
]


@dataclass
class MigrationResult:
    label: str
    source_count: int
    # Docs copied (--apply) or eligible-to-copy (dry run), subcollections
    # included where the mapping has them.
    dest_count: int
    skipped: List[str] = field(default_factory=list)
    notes: List[str] = field(default_factory=list)


def _normalize_org(raw: Optional[str]) -> Optional[str]:
    org = (raw or "").strip().lower()
    return org or None


# ── Generic recursive copy / count (read-only when apply=False) ────────────

def copy_doc_recursive(src_ref, dst_ref, apply: bool, transform=None) -> int:
    """
    Copy one document (after an optional `transform(data) -> data`, applied
    only to this doc, never to its descendants) and recursively copy every
    document in every one of its subcollections, preserving collection
    names, doc ids and nesting. When `apply` is False this only reads and
    counts -- no writes happen. Returns the total number of documents
    copied/counted, including the doc itself.
    """
    snap = src_ref.get()
    data = snap.to_dict() or {}
    if transform:
        data = transform(data)
    if apply:
        dst_ref.set(data)
    total = 1
    for sub_col in src_ref.collections():
        dst_col = dst_ref.collection(sub_col.id)
        for sub_doc in list(sub_col.stream()):
            total += copy_doc_recursive(sub_doc.reference, dst_col.document(sub_doc.id), apply)
    return total


def count_docs_recursive(ref) -> int:
    """Read-only: count a doc and every doc in every subcollection beneath
    it. Used by --delete-old to read the *actual* current destination state
    (as opposed to what a dry run says *would* be written)."""
    total = 1
    for sub_col in ref.collections():
        for sub_doc in list(sub_col.stream()):
            total += count_docs_recursive(sub_doc.reference)
    return total


# ── Mappings ─────────────────────────────────────────────────────────────────

def migrate_curricula(db, apply: bool) -> MigrationResult:
    """curricula (23 docs, by organizationId) -> Users/{organizationId}/curricula.
    Skips test-org (dropped) and any doc with a missing/unknown org. Backfills
    sharedWithUids from sharedWith (Round 2, section F)."""
    skipped = []
    copied = 0
    source_count = 0
    for doc in list(db.collection("curricula").stream()):
        source_count += 1
        data = doc.to_dict() or {}
        raw_org = data.get("organizationId")
        org = _normalize_org(raw_org)
        if org == "test-org":
            skipped.append(f"{doc.id} (org=test-org, dropped per Round 2 rule 5)")
            continue
        if org not in VALID_ORGS:
            skipped.append(f"{doc.id} (missing/unknown org: {raw_org!r})")
            continue
        shared = data.get("sharedWith", []) or []
        shared_uids = sorted({
            s.get("uid") for s in shared
            if isinstance(s, dict) and s.get("uid")
        })
        data["sharedWithUids"] = shared_uids
        if apply:
            org_col(db, org, "curricula").document(doc.id).set(data)
        copied += 1
    return MigrationResult(
        label="curricula -> Users/{org}/curricula",
        source_count=source_count,
        dest_count=copied,
        skipped=skipped,
    )


def migrate_teacher_profiles(db, apply: bool) -> MigrationResult:
    """teacher_profiles (11 docs, by org_id) -> Users/{org_id}/teacher_profiles."""
    skipped = []
    copied = 0
    source_count = 0
    for doc in list(db.collection("teacher_profiles").stream()):
        source_count += 1
        data = doc.to_dict() or {}
        org = _normalize_org(data.get("org_id"))
        if org not in VALID_ORGS:
            skipped.append(f"{doc.id} (missing/unknown org_id: {data.get('org_id')!r})")
            continue
        if apply:
            org_col(db, org, "teacher_profiles").document(doc.id).set(data)
        copied += 1
    return MigrationResult(
        label="teacher_profiles -> Users/{org_id}/teacher_profiles",
        source_count=source_count,
        dest_count=copied,
        skipped=skipped,
    )


def migrate_teachers(db, apply: bool) -> MigrationResult:
    """teachers (13 docs, including courseFolders/libraryFolders subcollections)
    -> Users/{organization lowercased}/teachers. Normalizes the one doc with
    organization == 'ICC' to 'icc' in the copy."""
    skipped = []
    dest_total = 0
    source_count = 0
    for doc in list(db.collection("teachers").stream()):
        source_count += 1
        data = doc.to_dict() or {}
        raw_org = data.get("organization")
        org = _normalize_org(raw_org)
        if org not in VALID_ORGS:
            skipped.append(f"{doc.id} (missing/unknown organization: {raw_org!r})")
            continue

        def _transform(d, _org=org):
            d = dict(d)
            d["organization"] = _org
            return d

        dst_ref = org_col(db, org, "teachers").document(doc.id)
        dest_total += copy_doc_recursive(doc.reference, dst_ref, apply, transform=_transform)

    return MigrationResult(
        label="teachers (+courseFolders, +libraryFolders) -> Users/{organization}/teachers",
        source_count=source_count,
        dest_count=dest_total,
        skipped=skipped,
        notes=["dest count includes courseFolders/libraryFolders subcollection docs, not just the 13 teacher docs"],
    )


def _resolve_notification_org(db, to_uid: str) -> Optional[str]:
    """toUid's teacher_profile org_id, falling back to the teachers doc's
    organization field, per the TASK-007 spec."""
    profile = db.collection("teacher_profiles").document(to_uid).get()
    if profile.exists:
        org = _normalize_org((profile.to_dict() or {}).get("org_id"))
        if org:
            return org
    teacher = db.collection("teachers").document(to_uid).get()
    if teacher.exists:
        org = _normalize_org((teacher.to_dict() or {}).get("organization"))
        if org:
            return org
    return None


def migrate_notifications(db, apply: bool) -> MigrationResult:
    """notifications (4 docs) -> Users/{recipient org}/notifications. Org is
    resolved via toUid; unresolvable notifications are listed and skipped."""
    skipped = []
    copied = 0
    source_count = 0
    for doc in list(db.collection("notifications").stream()):
        source_count += 1
        data = doc.to_dict() or {}
        to_uid = data.get("toUid")
        org = _resolve_notification_org(db, to_uid) if to_uid else None
        if not org or org not in VALID_ORGS:
            skipped.append(f"{doc.id} (toUid={to_uid!r}, unresolvable/unknown org)")
            continue
        if apply:
            org_col(db, org, "notifications").document(doc.id).set(data)
        copied += 1
    return MigrationResult(
        label="notifications -> Users/{recipient org}/notifications",
        source_count=source_count,
        dest_count=copied,
        skipped=skipped,
    )


def migrate_summer_camps(db, apply: bool) -> MigrationResult:
    """synopsis/ICC/weeks/** (including camps -> entries, and the `food`
    field embedded on each week doc) -> Users/icc/synopsis/summer_camps/weeks/**,
    with the same nesting."""
    src_weeks = db.collection("synopsis").document("ICC").collection("weeks")
    dst_weeks = summer_camps_doc(db, "icc").collection("weeks")
    source_count = 0
    dest_total = 0
    for week_doc in list(src_weeks.stream()):
        source_count += 1
        dest_total += copy_doc_recursive(week_doc.reference, dst_weeks.document(week_doc.id), apply)
    return MigrationResult(
        label="synopsis/ICC/weeks/** -> Users/icc/synopsis/summer_camps/weeks/**",
        source_count=source_count,
        dest_count=dest_total,
        notes=["dest count includes camps/entries subcollection docs, not just the weeks themselves; "
               "`food` travels as a field on each week doc, not a separate copy step"],
    )


def migrate_afterschool_months(db, apply: bool) -> MigrationResult:
    """afterschool_synopsis_months (4 docs) -> Users/icc/synopsis/afterschool/months/{id}."""
    copied = 0
    source_count = 0
    dst_col = afterschool_doc(db, "icc").collection("months")
    for doc in list(db.collection("afterschool_synopsis_months").stream()):
        source_count += 1
        data = doc.to_dict() or {}
        if apply:
            dst_col.document(doc.id).set(data)
        copied += 1
    return MigrationResult(
        label="afterschool_synopsis_months -> Users/icc/synopsis/afterschool/months",
        source_count=source_count,
        dest_count=copied,
    )


def migrate_afterschool_entries(db, apply: bool) -> MigrationResult:
    """afterschool_synopsis (30 docs) -> Users/icc/synopsis/afterschool/months/{month_id}/entries/{id}
    (Round 2, section C: entries nest inside their month). Docs without a
    month_id are listed and skipped."""
    skipped = []
    copied = 0
    source_count = 0
    for doc in list(db.collection("afterschool_synopsis").stream()):
        source_count += 1
        data = doc.to_dict() or {}
        month_id = data.get("month_id")
        if not month_id:
            skipped.append(f"{doc.id} (missing month_id)")
            continue
        if apply:
            afterschool_entries_col(db, "icc", month_id).document(doc.id).set(data)
        copied += 1
    return MigrationResult(
        label="afterschool_synopsis -> Users/icc/synopsis/afterschool/months/{month_id}/entries",
        source_count=source_count,
        dest_count=copied,
        skipped=skipped,
    )


def migrate_kb(db, apply: bool) -> List[MigrationResult]:
    """kb_objectives/kb_age_bands/kb_content_formats/kb_worksheet_formats/
    kb_activity_formats -> EdCube/knowledge_base/{pedagogy,age,content,worksheets,activities}."""
    results = []
    for old_name, category in KB_MAPPING.items():
        copied = 0
        source_count = 0
        for doc in list(db.collection(old_name).stream()):
            source_count += 1
            data = doc.to_dict() or {}
            if apply:
                kb_col(db, category).document(doc.id).set(data)
            copied += 1
        results.append(MigrationResult(
            label=f"{old_name} -> {PLATFORM_ROOT}/knowledge_base/{category}",
            source_count=source_count,
            dest_count=copied,
        ))
    return results


# ── Intermediate documents ───────────────────────────────────────────────────

def ensure_intermediate_docs(db, apply: bool) -> List[str]:
    """
    Every intermediate doc (Users/icc, Users/icc/synopsis/afterschool,
    Users/icc/synopsis/summer_camps, EdCube/knowledge_base) must be a real
    document with at least one field, not a phantom doc (tasks/firestore-reorg-spec.md,
    "Target tree" / "Intermediate docs"). Idempotent `.set(merge=True)`, same
    posture as scripts/seed_knowledge_base.py's own kb_doc().set(...).
    """
    targets = [
        (org_doc(db, "icc"), ICC_ORG_DOC, f"{ORGS_ROOT}/icc"),
        (afterschool_doc(db, "icc"), {"description": "After-school synopsis root"}, f"{ORGS_ROOT}/icc/synopsis/afterschool"),
        (summer_camps_doc(db, "icc"), {"description": "Summer camp synopsis root"}, f"{ORGS_ROOT}/icc/synopsis/summer_camps"),
        (kb_doc(db), {"description": "EdCube platform-wide knowledge base"}, f"{PLATFORM_ROOT}/knowledge_base"),
    ]
    labels = []
    for ref, data, label in targets:
        if apply:
            ref.set(data, merge=True)
        labels.append(label)
    return labels


# ── Reporting ────────────────────────────────────────────────────────────────

def print_report(results: List[MigrationResult], apply: bool, intermediate_docs: List[str]):
    verb_header = "Wrote" if apply else "Would write"
    print()
    print("Intermediate documents (created/ensured with >=1 real field):")
    for label in intermediate_docs:
        print(f"  - {label}")
    print()
    print(f"{'Mapping':<78} {'Source':>8} {verb_header:>14}")
    print("-" * 104)
    for r in results:
        print(f"{r.label:<78} {r.source_count:>8} {r.dest_count:>14}")
    print()
    any_skips_or_notes = False
    for r in results:
        if r.skipped:
            any_skips_or_notes = True
            print(f"Skipped under '{r.label}':")
            for s in r.skipped:
                print(f"  - {s}")
        for n in r.notes:
            any_skips_or_notes = True
            print(f"Note ({r.label}): {n}")
    if not any_skips_or_notes:
        print("No skipped/unresolvable docs.")
    print()
    print("Not copied anywhere (dropped, per spec):")
    for name in NOT_COPIED:
        print(f"  - {name}")


# ── --delete-old (TASK-010 only; this task does not run it) ────────────────

def count_existing_destinations(db) -> Dict[str, int]:
    """Read-only: the *actual* current doc count at each destination path,
    as opposed to a dry run's 'would write' count. Used only by --delete-old
    to verify a prior --apply actually landed before anything is deleted."""
    counts: Dict[str, int] = {}

    counts["curricula -> Users/{org}/curricula"] = sum(1 for _ in org_col(db, "icc", "curricula").stream())
    counts["teacher_profiles -> Users/{org_id}/teacher_profiles"] = sum(
        1 for _ in org_col(db, "icc", "teacher_profiles").stream()
    )

    teachers_total = 0
    for doc in list(org_col(db, "icc", "teachers").stream()):
        teachers_total += count_docs_recursive(doc.reference)
    counts["teachers (+courseFolders, +libraryFolders) -> Users/{organization}/teachers"] = teachers_total

    counts["notifications -> Users/{recipient org}/notifications"] = sum(
        1 for _ in org_col(db, "icc", "notifications").stream()
    )

    weeks_total = 0
    for doc in list(summer_camps_doc(db, "icc").collection("weeks").stream()):
        weeks_total += count_docs_recursive(doc.reference)
    counts["synopsis/ICC/weeks/** -> Users/icc/synopsis/summer_camps/weeks/**"] = weeks_total

    counts["afterschool_synopsis_months -> Users/icc/synopsis/afterschool/months"] = sum(
        1 for _ in afterschool_doc(db, "icc").collection("months").stream()
    )

    entries_total = 0
    for month_doc in list(afterschool_doc(db, "icc").collection("months").stream()):
        entries_total += sum(1 for _ in month_doc.reference.collection("entries").stream())
    counts["afterschool_synopsis -> Users/icc/synopsis/afterschool/months/{month_id}/entries"] = entries_total

    for old_name, category in KB_MAPPING.items():
        counts[f"{old_name} -> {PLATFORM_ROOT}/knowledge_base/{category}"] = sum(
            1 for _ in kb_col(db, category).stream()
        )

    return counts


def _delete_collection_recursive(col_ref, batch_size: int = 200) -> int:
    """Delete every doc in a collection, including each doc's subcollections
    (so courseFolders/libraryFolders etc. under old `teachers` docs, and
    camps/entries under old `synopsis/ICC/weeks` docs, are also removed)."""
    count = 0
    # list_documents() (not stream()) so "phantom" docs -- ones with no fields
    # that exist only as a parent of subcollections, like the old
    # `synopsis/ICC` -- are also visited and their subcollections removed.
    for doc_ref in list(col_ref.list_documents(page_size=batch_size)):
        for sub in doc_ref.collections():
            count += _delete_collection_recursive(sub, batch_size)
        doc_ref.delete()
        count += 1
    return count


def run_delete_old(db, results: List[MigrationResult], yes_really: bool,
                   allow_fewer_notifications: bool = False):
    """
    TASK-010 only. Refuses unless every destination already has at least as
    many docs as are eligible to be migrated there (i.e. a prior --apply
    succeeded), and requires --yes-really. Never touches anything under
    Users/ or EdCube/ -- it only deletes the fixed OLD_TOP_LEVEL_FOR_DELETE
    list of old top-level collections.
    """
    actual = count_existing_destinations(db)
    refused = False
    for r in results:
        actual_count = actual.get(r.label, 0)
        if (allow_fewer_notifications and r.label.startswith("notifications ")
                and actual_count < r.dest_count):
            # Notifications are a delete-on-seen inbox (spec decision 6), so the
            # live destination legitimately shrinks once the new app is in use.
            print(f"NOTE: '{r.label}' -- destination has {actual_count} < {r.dest_count}; "
                  f"accepted via --allow-fewer-notifications (delete-on-seen inbox).")
            continue
        if actual_count < r.dest_count:
            print(f"REFUSING: '{r.label}' -- existing destination count {actual_count} "
                  f"< eligible-to-migrate count {r.dest_count}.")
            refused = True
    if refused:
        print()
        print("Run --apply first (and re-run it to catch anything written since) before --delete-old.")
        sys.exit(1)

    print("Destination counts check out (>= eligible source counts for every mapping).")
    if not yes_really:
        print("Refusing to delete without --yes-really.")
        sys.exit(1)

    total_deleted = 0
    for name in OLD_TOP_LEVEL_FOR_DELETE:
        deleted = _delete_collection_recursive(db.collection(name))
        print(f"Deleted {deleted} doc(s) from top-level '{name}' (including subcollections)")
        total_deleted += deleted
    print(f"Total deleted: {total_deleted}")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--apply", action="store_true", help="Perform the writes (default: dry run, read-only)")
    parser.add_argument("--delete-old", action="store_true",
                         help="TASK-010 only: verify destination counts, then delete the old top-level collections")
    parser.add_argument("--yes-really", action="store_true", help="Required alongside --delete-old")
    parser.add_argument("--allow-fewer-notifications", action="store_true",
                         help="With --delete-old: don't refuse when the notifications destination has "
                              "fewer docs than the source (expected once delete-on-seen is live)")
    args = parser.parse_args()

    if args.delete_old and args.apply:
        print("Refusing: run --delete-old on its own, after a separate prior --apply run, "
              "not combined with --apply in the same invocation.")
        sys.exit(1)

    if not firebase_admin._apps:
        firebase_admin.initialize_app()
    db = firestore.client()

    # --delete-old never writes/copies in this invocation -- it only reads
    # (for the eligible-count plan, and for the actual-destination counts)
    # and then deletes, after the --yes-really check.
    apply = args.apply and not args.delete_old

    if args.delete_old:
        mode = "DELETE-OLD (read-only verification, then deletion of old collections)"
    elif apply:
        mode = "APPLY (writing copies)"
    else:
        mode = "DRY RUN (read-only, no writes)"
    print(f"Mode: {mode}")

    intermediate_docs = ensure_intermediate_docs(db, apply=apply)

    results: List[MigrationResult] = []
    results.append(migrate_curricula(db, apply))
    results.append(migrate_teacher_profiles(db, apply))
    results.append(migrate_teachers(db, apply))
    results.append(migrate_notifications(db, apply))
    results.append(migrate_summer_camps(db, apply))
    results.append(migrate_afterschool_months(db, apply))
    results.append(migrate_afterschool_entries(db, apply))
    results.extend(migrate_kb(db, apply))

    print_report(results, apply=apply, intermediate_docs=intermediate_docs)

    if args.delete_old:
        print()
        print("Verifying destination counts before --delete-old...")
        run_delete_old(db, results, args.yes_really, args.allow_fewer_notifications)


if __name__ == "__main__":
    main()
