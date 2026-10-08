#!/usr/bin/env python3
"""
TASK-011: one-time migration moving pre-reorg Cloud Storage files under the
`Users/{org}/...` prefix and repointing the download links stored in Firestore.

See tasks/firestore-reorg-spec.md -- "Round 2", section E. Same safety posture
as scripts/migrate_to_org_tree.py: dry run by default, `--apply` is
idempotent, nothing is deleted unless a separate guarded flag is given.

Old prefix                    -> New prefix (org is always `icc`)
  synopsis/                   -> Users/icc/synopsis/summer_camps/
  afterschool_synopsis/       -> Users/icc/synopsis/afterschool/
  course_attachments/         -> Users/icc/course_attachments/
  profile_pictures/           -> Users/icc/profile_pictures/
(the rest of each object name is unchanged). `worksheet_images/` and
`worksheet_pdfs/` are OUT of scope: never copied, never rewritten, only
reported if a document links to them.

How links stay valid: a Firebase download URL is the URL-encoded object path
plus the blob's `firebaseStorageDownloadTokens` metadata value. The copy keeps
that metadata, so the same token works at the new path and the new URL is the
old URL with only the encoded path swapped.

Modes (mutually exclusive where noted)
--------------------------------------
- (default) DRY RUN: reads only. WRITE GUARANTEE: every mutating call
  (Storage rewrite / delete / metadata patch, Firestore update, backup file)
  lives in a function that first calls `Gate.require()`; the Gate is closed
  unless the mode is --apply / --delete-old --yes-really / --revert --apply.
  The dry-run path never calls those functions at all, and `Gate.require()`
  raises if it somehow did.
- `--apply`: (1) server-side copy each old blob, verify (size, crc32c, md5,
  content type, ALL metadata incl. token), never overwriting a differing
  destination; (2) walk every doc under Users/{org} and rewrite links whose
  destination blob is verified; a JSON backup of every before/after link is
  written (and fsynced) BEFORE the first Firestore write. Doc writes carry a
  last_update_time precondition, so a doc edited mid-run is skipped, not
  clobbered. Re-running is a no-op for anything already done.
- `--delete-old --yes-really`: deletes an old blob only if its destination
  exists with matching checksum AND no doc under Users/{org} still links to
  (or names by path) the old path. Cannot be combined with --apply.
- `--revert BACKUP.json [--apply]`: restores the old URLs recorded in a
  backup file. Without --apply it only reports what it would restore.
  (Does not touch Storage; the copies stay.)

Run from backend/, with the project's venv, using Application Default
Credentials exactly as scripts/migrate_to_org_tree.py does:
    ./.venv/bin/python scripts/migrate_storage_to_org_tree.py                 # dry run
    ./.venv/bin/python scripts/migrate_storage_to_org_tree.py --apply
    ./.venv/bin/python scripts/migrate_storage_to_org_tree.py --delete-old --yes-really
    ./.venv/bin/python scripts/migrate_storage_to_org_tree.py --revert ~/edcube_backups/<file>.json --apply

Download tokens are never printed (masked as token=***). The backup file
does contain full URLs (needed to revert), so it is created with mode 0600.
"""

import argparse
import json
import os
import re
import sys
import urllib.parse
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import firebase_admin
from firebase_admin import firestore, storage as fb_storage
from google.cloud.firestore_v1.field_path import FieldPath

from firebase.paths import ORGS_ROOT, storage_path

BUCKET_NAME = "edcube-8fe7d.firebasestorage.app"  # == services.firebase_service.STORAGE_BUCKET
VALID_ORGS = {"icc"}  # only org; test-org was dropped (spec Round 2, rule 5)
TOKEN_KEY = "firebaseStorageDownloadTokens"
DEFAULT_BACKUP_DIR = os.path.expanduser("~/edcube_backups")

# Out-of-scope prefixes: reported only.
OUT_OF_SCOPE_PREFIXES = ["worksheet_images", "worksheet_pdfs"]


def prefix_map(org: str) -> List[Tuple[str, str, str]]:
    """(label, old_prefix, new_prefix) for the four in-scope prefixes. New
    prefixes mirror where the upload routes put NEW files today:
      routes/synopsis.py            Users/{org}/synopsis/summer_camps/{camp}/{day}/{id}.{ext}
      routes/afterschool_synopsis   Users/{org}/synopsis/afterschool/{grade}/{type}/{month}/{idx}/{id}.{ext}
      routes/curriculum.py          Users/{org}/course_attachments/{cur}/{att}/{filename}
      routes/uploads.py             Users/{org}/profile_pictures/{uid}/{name}
    """
    return [
        ("synopsis (summer camps)", "synopsis", storage_path(org, "synopsis", "summer_camps")),
        ("afterschool_synopsis", "afterschool_synopsis", storage_path(org, "synopsis", "afterschool")),
        ("course_attachments", "course_attachments", storage_path(org, "course_attachments")),
        ("profile_pictures", "profile_pictures", storage_path(org, "profile_pictures")),
    ]


def old_to_new(path: str, pmap) -> Optional[Tuple[str, str]]:
    """(label, new_path) if `path` is under an in-scope old prefix, else None.
    Matches on whole path segments ('synopsis/' does not match
    'afterschool_synopsis/')."""
    for label, old, new in pmap:
        if path.startswith(old + "/"):
            return label, new + path[len(old):]
    return None


# ── Write gate ───────────────────────────────────────────────────────────────

class Gate:
    """Single choke point for every mutation. Closed in dry run."""

    def __init__(self, enabled: bool):
        self.enabled = enabled

    def require(self, what: str):
        if not self.enabled:
            raise RuntimeError(f"BUG: write attempted while write gate is closed: {what}")


# ── URL handling ─────────────────────────────────────────────────────────────

URL_RE = re.compile(
    r"https://(?:"
    r"firebasestorage\.googleapis\.com/v0/b/(?P<fb_bucket>[^/\s\"'<>]+)/o/(?P<fb_path>[^?\s\"'<>#]+)"
    r"|(?P<gcs_host>storage\.googleapis\.com|storage\.cloud\.google\.com)/(?P<gcs_bucket>[^/\s\"'<>]+)/(?P<gcs_path>[^?\s\"'<>#]+)"
    r")(?P<query>\?[^\s\"'<>)\]#]*)?"
)
STORAGE_HINT_RE = re.compile(r"firebasestorage|storage\.googleapis|storage\.cloud\.google")
TOKEN_MASK_RE = re.compile(r"(token=)[^&\s\"'<>]+")


def mask(url: str) -> str:
    return TOKEN_MASK_RE.sub(r"\1***", url)


def build_new_url(m: "re.Match", new_path: str) -> str:
    q = m.group("query") or ""
    if m.group("fb_path") is not None:
        return (f"https://firebasestorage.googleapis.com/v0/b/{m.group('fb_bucket')}"
                f"/o/{urllib.parse.quote(new_path, safe='')}{q}")
    return (f"https://{m.group('gcs_host')}/{m.group('gcs_bucket')}"
            f"/{urllib.parse.quote(new_path, safe='/')}{q}")


@dataclass
class Hit:
    doc_path: str
    tokens: List[Any]          # field path as JSON-able tokens (str keys, int indexes)
    old_url: str
    bucket: str
    old_path: str              # decoded object path
    category: str              # in_scope | out_of_scope | already_new | other_path | other_bucket
    label: str = ""
    new_path: str = ""
    new_url: str = ""
    host_form: str = ""        # firebase | gcs
    status: str = ""           # in_scope only: rewritable | blocked | dangling


def fmt_tokens(tokens: List[Any]) -> str:
    out = ""
    for t in tokens:
        out += f"[{t}]" if isinstance(t, int) else (("." if out else "") + str(t))
    return out


def scan_string(s: str, doc_path: str, tokens: List[Any], pmap, report: "ScanReport"):
    hits: List[Hit] = []
    matched_any = False
    for m in URL_RE.finditer(s):
        matched_any = True
        if m.group("fb_path") is not None:
            bucket, raw, form = m.group("fb_bucket"), m.group("fb_path"), "firebase"
        else:
            bucket, raw, form = m.group("gcs_bucket"), m.group("gcs_path"), "gcs"
        path = urllib.parse.unquote(raw)
        h = Hit(doc_path, list(tokens), m.group(0), bucket, path, "other_path", host_form=form)
        report.host_forms[form] += 1
        report.buckets[bucket] += 1
        if bucket != BUCKET_NAME:
            h.category = "other_bucket"
        else:
            mapped = old_to_new(path, pmap)
            top = path.split("/", 1)[0]
            if mapped:
                h.category = "in_scope"
                h.label, h.new_path = mapped
                h.new_url = build_new_url(m, h.new_path)
            elif top in OUT_OF_SCOPE_PREFIXES:
                h.category = "out_of_scope"
            elif top == ORGS_ROOT:
                h.category = "already_new"
        hits.append(h)
    if not matched_any and STORAGE_HINT_RE.search(s):
        report.unparsed.append((doc_path, fmt_tokens(tokens), mask(s)[:120]))
    # By-path / gs:// references (not rewritten; reported, and they block --delete-old).
    stripped = s.strip()
    if stripped.startswith("gs://"):
        report.by_path.append((doc_path, fmt_tokens(tokens), mask(stripped)[:120], None))
    else:
        for _, old, _ in pmap:
            if stripped.startswith(old + "/"):
                report.by_path.append((doc_path, fmt_tokens(tokens), stripped[:120], stripped))
                break
    return hits


def scan_value(v: Any, doc_path: str, tokens: List[Any], pmap, report) -> List[Hit]:
    if isinstance(v, str):
        return scan_string(v, doc_path, tokens, pmap, report)
    hits: List[Hit] = []
    if isinstance(v, dict):
        for k, sub in v.items():
            hits += scan_value(sub, doc_path, tokens + [k], pmap, report)
    elif isinstance(v, (list, tuple)):
        for i, sub in enumerate(v):
            hits += scan_value(sub, doc_path, tokens + [i], pmap, report)
    return hits


def _clone(v: Any) -> Any:
    """Rebuild only dicts/lists; share every leaf (timestamps, refs, GeoPoints,
    bytes ...) untouched, so nothing is round-tripped through JSON or deepcopy."""
    if isinstance(v, dict):
        return {k: _clone(x) for k, x in v.items()}
    if isinstance(v, list):
        return [_clone(x) for x in v]
    return v


def _navigate(root: Any, tokens: List[Any]):
    """(container, key) for the leaf at `tokens`, or None if the path is gone."""
    cur = root
    for t in tokens[:-1]:
        try:
            cur = cur[t]
        except (KeyError, IndexError, TypeError):
            return None
    return cur, tokens[-1]


def apply_replacements(data: Dict[str, Any], repls: List[Tuple[List[Any], str, str]]):
    """Clone the top-level fields touched by `repls` and substitute old->new
    inside the string at each token path. Returns (new_top_level_fields, skipped)
    where skipped lists replacements whose old text was not found."""
    tops = {r[0][0] for r in repls}
    new_fields = {t: _clone(data[t]) for t in tops if t in data}
    skipped = []
    for tokens, old, new in repls:
        if tokens[0] not in new_fields:
            skipped.append((tokens, old))
            continue
        nav = _navigate(new_fields, tokens) if len(tokens) > 0 else None
        if not nav:
            skipped.append((tokens, old))
            continue
        cont, key = nav
        try:
            cur = cont[key]
        except (KeyError, IndexError, TypeError):
            skipped.append((tokens, old))
            continue
        if not isinstance(cur, str) or old not in cur:
            skipped.append((tokens, old))
            continue
        cont[key] = cur.replace(old, new, 1)
    return new_fields, skipped


# ── Firestore walk ───────────────────────────────────────────────────────────

@dataclass
class DocInfo:
    path: str
    data: Dict[str, Any]
    update_time: Any


def collection_label(path: str) -> str:
    """Generic label for a doc path, e.g.
    Users/icc/synopsis/summer_camps/weeks/W/camps/C/entries/E
      -> synopsis/summer_camps/weeks/*/camps/*/entries"""
    parts = path.split("/")[2:]  # drop Users/{org}
    out = []
    for i, p in enumerate(parts[:-1] if len(parts) % 2 == 0 else parts):
        if i % 2 == 0:
            out.append(p)
        else:
            out.append(p if (out[-1] == "synopsis" and p in ("afterschool", "summer_camps")) else "*")
    return "/".join(out) if out else "(org doc)"


def walk_org_docs(db, org: str) -> List[DocInfo]:
    """Every existing document at or below Users/{org}. Lists are materialised
    before any nested work (no open .stream() while recursing), and
    list_documents() is used so phantom parents (no fields, only
    subcollections) are traversed too."""
    docs: List[DocInfo] = []

    def visit(ref):
        for col in list(ref.collections()):
            refs = list(col.list_documents(page_size=300))
            for i in range(0, len(refs), 100):
                chunk = refs[i:i + 100]
                for snap in list(db.get_all(chunk)):
                    if snap.exists:
                        docs.append(DocInfo(snap.reference.path, snap.to_dict() or {}, snap.update_time))
            for r in refs:
                visit(r)

    root = db.collection(ORGS_ROOT).document(org)
    snap = root.get()
    if snap.exists:
        docs.append(DocInfo(root.path, snap.to_dict() or {}, snap.update_time))
    visit(root)
    return docs


@dataclass
class ScanReport:
    host_forms: Counter = field(default_factory=Counter)
    buckets: Counter = field(default_factory=Counter)
    unparsed: List[Tuple[str, str, str]] = field(default_factory=list)
    by_path: List[Tuple[str, str, str, Optional[str]]] = field(default_factory=list)


def scan_docs(docs: List[DocInfo], pmap) -> Tuple[List[Hit], ScanReport]:
    report = ScanReport()
    hits: List[Hit] = []
    for d in docs:
        for k, v in d.data.items():
            hits += scan_value(v, d.path, [k], pmap, report)
    return hits, report


# ── Storage listing / copy / verify ──────────────────────────────────────────

def _same_content(a, b) -> bool:
    return (a.size == b.size and a.crc32c == b.crc32c and a.md5_hash == b.md5_hash)


def _same_meta(a, b) -> bool:
    return (_same_content(a, b)
            and a.content_type == b.content_type
            and a.cache_control == b.cache_control
            and a.content_disposition == b.content_disposition
            and a.content_encoding == b.content_encoding
            and a.content_language == b.content_language
            and (a.metadata or {}) == (b.metadata or {}))


@dataclass
class BlobPlan:
    label: str
    old: Any           # source blob
    new_path: str
    status: str        # copy | exists_match | conflict | skip_placeholder
    verified: bool = False   # destination verified to exist with matching content+metadata
    error: str = ""


def list_prefix(bucket, prefix: str) -> Dict[str, Any]:
    return {b.name: b for b in bucket.list_blobs(prefix=prefix)}


def build_blob_plan(bucket, pmap, org: str) -> Tuple[List[BlobPlan], Dict[str, Any]]:
    dest_listing = list_prefix(bucket, storage_path(org) + "/")
    plans: List[BlobPlan] = []
    for label, old, new in pmap:
        for name, blob in sorted(list_prefix(bucket, old + "/").items()):
            new_path = new + name[len(old):]
            if name.endswith("/"):
                plans.append(BlobPlan(label, blob, new_path, "skip_placeholder"))
                continue
            dest = dest_listing.get(new_path)
            if dest is None:
                plans.append(BlobPlan(label, blob, new_path, "copy"))
            elif _same_meta(blob, dest):
                plans.append(BlobPlan(label, blob, new_path, "exists_match", verified=True))
            else:
                plans.append(BlobPlan(label, blob, new_path, "conflict",
                                      error="destination exists but differs from source (not overwritten)"))
    return plans, dest_listing


def copy_and_verify(gate: Gate, bucket, plan: BlobPlan):
    """Server-side copy via the rewrite API (loops on the continuation token, so
    large objects take several calls), preconditioned so it can neither
    overwrite an existing destination (if_generation_match=0) nor copy a source
    that changed mid-run. With no metadata supplied in the request GCS copies
    the source's content type and ALL custom metadata (incl. the download
    token). Then reload and verify; if only metadata differs, patch it from the
    source and verify again."""
    gate.require(f"copy {plan.old.name} -> {plan.new_path}")
    src = plan.old
    dest = bucket.blob(plan.new_path)
    token = None
    while True:
        token, _, _ = dest.rewrite(src, token=token,
                                   if_generation_match=0,
                                   if_source_generation_match=src.generation)
        if token is None:
            break
    dest.reload()
    if not _same_content(src, dest):
        raise RuntimeError("size/checksum mismatch after copy")
    if not _same_meta(src, dest):
        dest.content_type = src.content_type
        dest.cache_control = src.cache_control
        dest.content_disposition = src.content_disposition
        dest.content_encoding = src.content_encoding
        dest.content_language = src.content_language
        dest.metadata = dict(src.metadata or {})
        dest.patch()
        dest.reload()
        if not _same_meta(src, dest):
            raise RuntimeError("metadata mismatch after copy (token/content type)")


def run_copy_phase(gate: Gate, bucket, plans: List[BlobPlan], workers: int):
    todo = [p for p in plans if p.status == "copy"]
    done = 0

    def job(p: BlobPlan):
        try:
            copy_and_verify(gate, bucket, p)
            p.verified = True
        except Exception as e:  # noqa: BLE001 -- per-blob failure is reported, run continues
            p.error = f"{type(e).__name__}: {e}"
            p.verified = False

    with ThreadPoolExecutor(max_workers=workers) as ex:
        for _ in ex.map(job, todo):
            done += 1
            if done % 100 == 0:
                print(f"  copied+verified {done}/{len(todo)} ...", flush=True)
    print(f"  copy phase finished: {sum(1 for p in todo if p.verified)}/{len(todo)} verified, "
          f"{sum(1 for p in todo if not p.verified)} failed")


# ── Link classification & report ─────────────────────────────────────────────

def classify_links(hits: List[Hit], plans: List[BlobPlan], dest_listing, apply: bool):
    """Set each in-scope Hit's `.status`. Rewritable iff the destination blob is
    verified (apply) / would be verified (dry run: source exists and its copy
    isn't in conflict). Dangling iff neither a source blob nor a destination
    blob exists."""
    by_old = {p.old.name: p for p in plans}
    for h in hits:
        if h.category != "in_scope":
            continue
        p = by_old.get(h.old_path)
        if p is None:
            # no source blob; fine only if the destination already exists.
            h.status = "rewritable" if h.new_path in dest_listing else "dangling"
        elif apply:
            h.status = "rewritable" if p.verified else "blocked"
        else:
            h.status = "rewritable" if p.status != "conflict" else "blocked"



def print_report(mode: str, plans, hits, report, docs, rewrites, backup_path, write_results, org):
    apply = mode == "APPLY"
    verb = "" if apply else "would be "
    print()
    print("=" * 100)
    print(f"Mode: {mode}   org: {org}   bucket: {BUCKET_NAME}")
    print("=" * 100)

    print("\n[1] Blobs per in-scope prefix")
    hdr = f"{'prefix':<26}{'blobs':>7}{'MB':>10}{'to copy':>9}{'copied' if apply else '':>8}{'existed':>9}{'conflict':>9}{'failed':>8}"
    print(hdr)
    tot = Counter()
    for label in dict.fromkeys(p.label for p in plans):
        ps = [p for p in plans if p.label == label]
        size = sum(p.old.size or 0 for p in ps)
        tocopy = [p for p in ps if p.status == "copy"]
        copied_ok = [p for p in tocopy if p.verified]
        failed = [p for p in tocopy if apply and not p.verified]
        existed = [p for p in ps if p.status == "exists_match"]
        conflict = [p for p in ps if p.status == "conflict"]
        print(f"{label:<26}{len(ps):>7}{size / 1e6:>10.1f}{len(tocopy):>9}{(len(copied_ok) if apply else ''):>8}"
              f"{len(existed):>9}{len(conflict):>9}{len(failed):>8}")
        tot.update(blobs=len(ps), tocopy=len(tocopy), existed=len(existed))
    print(f"(copy {verb.strip() or 'done'}: {tot['tocopy']} blob(s); already present with matching "
          f"checksum+metadata: {tot['existed']})")
    for p in plans:
        if p.status == "conflict" or (apply and p.status == "copy" and not p.verified):
            print(f"  PROBLEM {p.old.name} -> {p.new_path}: {p.error}")
    no_token = [p for p in plans if not (p.old.metadata or {}).get(TOKEN_KEY)]
    print(f"Source blobs without a download token: {len(no_token)}")

    in_scope = [h for h in hits if h.category == "in_scope"]
    rew = [h for h in in_scope if h.status == "rewritable"]
    print(f"\n[2] Firestore links ({len(docs)} docs scanned under {ORGS_ROOT}/{org}; {len(hits)} storage URLs found)")
    print(f"URL host forms seen: {dict(report.host_forms)}   buckets seen: {dict(report.buckets)}")
    cat = Counter(h.category for h in hits)
    print(f"By category: {dict(cat)}")
    print(f"In-scope links {verb}rewritten: {len(rew)} across "
          f"{len({h.doc_path for h in rew})} document(s)")
    byc: Dict[str, List[Hit]] = defaultdict(list)
    for h in rew:
        byc[collection_label(h.doc_path)].append(h)
    for c, hs in sorted(byc.items()):
        print(f"    {c:<60} docs={len({h.doc_path for h in hs}):>4}  links={len(hs):>4}")
    if apply:
        print(f"Firestore writes: {write_results}")
        print(f"Backup written to: {backup_path}")

    blocked = [h for h in in_scope if h.status == "blocked"]
    print(f"In-scope links left unrewritten because destination not verified/conflict: {len(blocked)}")
    for h in blocked[:5]:
        print(f"    {h.doc_path} {fmt_tokens(h.tokens)} -> {h.old_path}")
    dangling = [h for h in in_scope if h.status == "dangling"]
    print(f"DANGLING in-scope links (no blob at old or new path): {len(dangling)}")
    for h in dangling[:10]:
        print(f"    {h.doc_path} {fmt_tokens(h.tokens)} -> {h.old_path}")

    linked = {h.old_path for h in in_scope}
    print("\n[3] Orphan blobs (under in-scope prefixes, linked from no document by URL)")
    for label in dict.fromkeys(p.label for p in plans):
        orph = [p.old.name for p in plans if p.label == label and p.old.name not in linked]
        print(f"  {label:<26} {len(orph)} orphan(s)")
        for n in orph[:3]:
            print(f"      e.g. {n}")

    oos = [h for h in hits if h.category == "out_of_scope"]
    print(f"\n[4] Links to OUT-OF-SCOPE prefixes (worksheet_images/, worksheet_pdfs/): {len(oos)}")
    for h in oos[:10]:
        print(f"    {h.doc_path} {fmt_tokens(h.tokens)} -> {h.old_path}")
    other = [h for h in hits if h.category in ("other_path", "other_bucket")]
    print(f"Links to other paths/buckets (untouched): {len(other)}")
    for h in other[:5]:
        print(f"    {h.doc_path} {fmt_tokens(h.tokens)} -> bucket={h.bucket} path={h.old_path}")

    print(f"\n[5] Odd data: strings mentioning Storage that no URL pattern parsed: {len(report.unparsed)}")
    for x in report.unparsed[:5]:
        print(f"    {x}")
    print(f"References by bare path / gs:// (not rewritten): {len(report.by_path)}")
    for x in report.by_path[:5]:
        print(f"    {x[0]} {x[1]} -> {x[2]}")

    print("\n[6] Sample transformations (token masked)")
    seen = set()
    for h in in_scope:
        if h.label in seen:
            continue
        seen.add(h.label)
        print(f"  [{h.label}] {h.doc_path} :: {fmt_tokens(h.tokens)}  ({h.status})")
        print(f"      old path: {h.old_path}")
        print(f"      new path: {h.new_path}")
        print(f"      old url : {mask(h.old_url)}")
        print(f"      new url : {mask(h.new_url)}")
    missing = [x[0] for x in prefix_map(org) if x[0] not in seen]
    if missing:
        print(f"  (no links found for: {', '.join(missing)})")


# ── Rewrite phase ────────────────────────────────────────────────────────────

def group_rewrites(hits: List[Hit]) -> Dict[str, List[Hit]]:
    g: Dict[str, List[Hit]] = defaultdict(list)
    for h in hits:
        if h.category == "in_scope" and h.status == "rewritable":
            g[h.doc_path].append(h)
    return g


def write_backup(gate: Gate, path: str, org: str, groups: Dict[str, List[Hit]]):
    gate.require("write backup file")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    entries = [{
        "doc_path": h.doc_path,
        "field_path": fmt_tokens(h.tokens),
        "tokens": h.tokens,
        "old_url": h.old_url,
        "new_url": h.new_url,
    } for hs in groups.values() for h in hs]
    payload = {
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "bucket": BUCKET_NAME,
        "org": org,
        "note": "Contains full download URLs (tokens). Keep private. Use --revert <this file> --apply to restore old URLs.",
        "entries": entries,
    }
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w") as f:
        json.dump(payload, f, indent=1)
        f.flush()
        os.fsync(f.fileno())


def write_docs(gate: Gate, db, docs_by_path: Dict[str, DocInfo], repls_by_doc: Dict[str, List[Tuple[List[Any], str, str]]]):
    """One update() per changed doc, touching only the changed top-level fields,
    with a last_update_time precondition."""
    ok = skipped = failed = 0
    problems = []
    for path, repls in repls_by_doc.items():
        gate.require(f"firestore update {path}")
        info = docs_by_path[path]
        new_fields, skip = apply_replacements(info.data, repls)
        if skip or not new_fields:
            skipped += 1
            problems.append(f"{path}: could not locate {len(skip)} link(s) in doc; skipped")
            continue
        update = {FieldPath(k).to_api_repr(): v for k, v in new_fields.items()}
        try:
            db.document(path).update(update, option=db.write_option(last_update_time=info.update_time))
            ok += 1
        except Exception as e:  # noqa: BLE001
            failed += 1
            problems.append(f"{path}: {type(e).__name__}: {e}")
    for p in problems:
        print("  PROBLEM", p)
    return {"updated": ok, "skipped": skipped, "failed": failed}


def do_revert(gate: Gate, db, backup_file: str, apply: bool):
    with open(os.path.expanduser(backup_file)) as f:
        payload = json.load(f)
    by_doc: Dict[str, List[dict]] = defaultdict(list)
    for e in payload["entries"]:
        by_doc[e["doc_path"]].append(e)
    print(f"Revert from {backup_file}: {len(payload['entries'])} link(s) in {len(by_doc)} doc(s). "
          f"{'APPLY' if apply else 'DRY RUN (no writes)'}")
    ok = skipped = failed = 0
    for path, entries in by_doc.items():
        snap = db.document(path).get()
        if not snap.exists:
            print(f"  skip {path}: document no longer exists")
            skipped += 1
            continue
        data = snap.to_dict() or {}
        repls = [(e["tokens"], e["new_url"], e["old_url"]) for e in entries]
        new_fields, skip = apply_replacements(data, repls)
        if skip:
            print(f"  skip {path}: {len(skip)} link(s) not found at recorded location (edited since?)")
            skipped += 1
            continue
        if not apply:
            ok += 1
            continue
        gate.require(f"revert {path}")
        try:
            db.document(path).update({FieldPath(k).to_api_repr(): v for k, v in new_fields.items()},
                                     option=db.write_option(last_update_time=snap.update_time))
            ok += 1
        except Exception as e:  # noqa: BLE001
            print(f"  FAILED {path}: {type(e).__name__}: {e}")
            failed += 1
    print(f"Revert {'restored' if apply else 'would restore'} {ok} doc(s); skipped {skipped}; failed {failed}")


def do_delete_old(gate: Gate, bucket, plans: List[BlobPlan], dest_listing, hits: List[Hit],
                  report: ScanReport, yes_really: bool):
    still_linked = {h.old_path for h in hits if h.category == "in_scope"}
    still_linked |= {x[3] for x in report.by_path if x[3]}
    eligible, blocked = [], Counter()
    for p in plans:
        dest = dest_listing.get(p.new_path)
        if p.status == "skip_placeholder":
            blocked["placeholder"] += 1
        elif dest is None or not _same_content(p.old, dest):
            blocked["no matching destination copy"] += 1
        elif p.old.name in still_linked:
            blocked["a document still links to old path"] += 1
        else:
            eligible.append(p)
    print(f"--delete-old: {len(eligible)} old blob(s) eligible; not eligible: {dict(blocked)}")
    if not yes_really:
        print("Refusing to delete without --yes-really.")
        sys.exit(1)
    n = 0
    for p in eligible:
        gate.require(f"delete {p.old.name}")
        p.old.delete(if_generation_match=p.old.generation)
        n += 1
    print(f"Deleted {n} old blob(s).")


# ── main ─────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--apply", action="store_true", help="Copy blobs, then rewrite links (default: dry run, read-only)")
    ap.add_argument("--delete-old", action="store_true", help="Delete verified-copied, unlinked old blobs (needs --yes-really; not with --apply)")
    ap.add_argument("--yes-really", action="store_true", help="Required alongside --delete-old")
    ap.add_argument("--revert", metavar="BACKUP_FILE", help="Restore old URLs from a backup file (add --apply to actually write)")
    ap.add_argument("--backup-file", help=f"Backup path for --apply (default {DEFAULT_BACKUP_DIR}/storage_link_rewrite_<timestamp>.json)")
    ap.add_argument("--org", default="icc", help="Org to migrate (only 'icc' is valid)")
    ap.add_argument("--workers", type=int, default=8, help="Parallel copy workers for --apply")
    args = ap.parse_args()

    if args.org not in VALID_ORGS:
        sys.exit(f"Refusing: org must be one of {sorted(VALID_ORGS)}")
    if args.delete_old and args.apply:
        sys.exit("Refusing: --delete-old cannot be combined with --apply; run them separately.")
    if args.delete_old and args.revert:
        sys.exit("Refusing: --delete-old cannot be combined with --revert.")

    if not firebase_admin._apps:
        firebase_admin.initialize_app()
    db = firestore.client()
    bucket = fb_storage.bucket(BUCKET_NAME)
    org = args.org
    pmap = prefix_map(org)

    writes_enabled = bool((args.apply and not args.delete_old) or (args.delete_old and args.yes_really))
    gate = Gate(writes_enabled)

    if args.revert:
        gate = Gate(args.apply)
        print(f"Mode: REVERT ({'APPLY' if args.apply else 'DRY RUN, read-only'})")
        do_revert(gate, db, args.revert, args.apply)
        return

    apply = args.apply
    mode = "DELETE-OLD" if args.delete_old else ("APPLY" if apply else "DRY RUN (read-only: zero Storage/Firestore writes)")
    print(f"Mode: {mode}")

    print("Scanning Firestore documents ...", flush=True)
    docs = walk_org_docs(db, org)
    docs_by_path = {d.path: d for d in docs}
    hits, report = scan_docs(docs, pmap)

    print("Listing Storage blobs ...", flush=True)
    plans, dest_listing = build_blob_plan(bucket, pmap, org)

    if args.delete_old:
        do_delete_old(gate, bucket, plans, dest_listing, hits, report, args.yes_really)
        return

    if apply:
        print("Copy phase ...", flush=True)
        run_copy_phase(gate, bucket, plans, args.workers)
        # refresh destination view for classification of pre-existing dest-only links
        dest_listing = list_prefix(bucket, storage_path(org) + "/")

    classify_links(hits, plans, dest_listing, apply)

    backup_path = ""
    write_results = None
    if apply:
        groups = group_rewrites(hits)
        if groups:
            backup_path = args.backup_file or os.path.join(
                DEFAULT_BACKUP_DIR,
                f"storage_link_rewrite_{datetime.now().strftime('%Y%m%dT%H%M%S')}.json")
            backup_path = os.path.expanduser(backup_path)
            write_backup(gate, backup_path, org, groups)  # BEFORE any Firestore write
            print(f"Backup of before/after links written to: {backup_path}", flush=True)
            repls = {path: [(h.tokens, h.old_url, h.new_url) for h in hs] for path, hs in groups.items()}
            write_results = write_docs(gate, db, docs_by_path, repls)
        else:
            write_results = "nothing to rewrite"
            backup_path = "(none: nothing to rewrite)"

    print_report(mode if not apply else "APPLY", plans, hits, report, docs, None, backup_path, write_results, org)


if __name__ == "__main__":
    main()
