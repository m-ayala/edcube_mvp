"""
Course Builder Stage 2 (backend): plan one day as one-hour lessons of four 15-minute blocks.

A day is `hours_per_day` (a whole number) named one-hour lessons; each hour holds at most four
15-minute blocks, threaded so each builds on the previous. Hours are what the saved course calls
subsections (see course_builder_handoff.py). Code decides the shape, the model fills it
(Prompt 2 in course_day_prompts.py):
  1. parse + clamp the inputs from the frontend (nothing is persisted server-side)
  2. build the format universe from the knowledge base, ranking by age band / class size
  3. one LLM call per day, retried on malformed output
  4. validate / repair every id against the knowledge base, stamp stable ids,
     remap goes_with, make multi-part blocks consistent
  5. fill each hour (partners together, parts whole, never over 4 blocks an hour or `slots`
     a day) and put everything else in a library list, each block tied to its home hour

Nothing here touches Firestore. The knowledge base is read through
services.knowledge_base_service only.
"""

import logging
import math
import os
import re
import uuid
from typing import Callable, Dict, List, Optional, Tuple

from outliner.course_day_prompts import build_day_prompt, build_fix_prompt, build_more_ideas_prompt
from utils.llm_handler import call_openai

logger = logging.getLogger(__name__)

# ----------------------------------------------------------------------- constants

BLOCK_MINUTES = 15
CONTENT, WORKSHEET, ACTIVITY = "content", "worksheet", "activity"
BLOCK_TYPES = (CONTENT, WORKSHEET, ACTIVITY)
PRIORITIES = ("essential", "supporting", "extension")
PRIORITY_RANK = {p: i for i, p in enumerate(PRIORITIES)}
PART_LIMITS = {CONTENT: 2, WORKSHEET: 2, ACTIVITY: 4}
MAX_TOPICS = 6
HOUR_MINUTES = 60
BLOCKS_PER_HOUR = HOUR_MINUTES // BLOCK_MINUTES
MAX_HOURS = 12
EXTRA_HOURS_READ = 3  # hours read beyond the requested count (their blocks go to the library)
MAX_BLOCKS_PER_TOPIC = 14
MAX_RESOURCES = 12
MAX_TITLE = 120
MAX_DESC = 240
MAX_ATTEMPTS = 2  # first try + one repair retry
DEFAULT_ICONS = ["📘", "🧩", "🔧", "🎯", "🧠", "🔍", "🎨", "🧪", "💡", "🚀"]

# Class size / age handling for formats. "rank" (default): every knowledge-base format is
# offered, marked good fit or limited fit, best first. "strict": only formats that pass
# the knowledge base's own age + class-size filters are offered (the original behaviour
# in tasks/course-builder-spec.md). Flip with COURSE_BUILDER_FORMAT_FIT=strict.
FORMAT_FIT_MODE_DEFAULT = "rank"


def format_fit_mode() -> str:
    m = (os.getenv("COURSE_BUILDER_FORMAT_FIT") or FORMAT_FIT_MODE_DEFAULT).strip().lower()
    return m if m in ("rank", "strict") else FORMAT_FIT_MODE_DEFAULT


# Library top-up: after a day is planned, one extra ideas call fills its library so the teacher
# does not start from an empty one. Turn off with COURSE_BUILDER_LIBRARY_TOPUP=off (saves one
# AI call per day). Skipped when the plan already has LIBRARY_TOPUP_MIN_SPARE or more usable
# (not flagged for review) spare blocks.
LIBRARY_TOPUP_DEFAULT = "on"
LIBRARY_TOPUP_MIN_SPARE = 4
LIBRARY_TOPUP_COUNT = 6
# How long the plan-days stream waits for one day's top-up before treating it as failed (the day
# is kept as planned; its day_library goes out with topped_up:false). Override in seconds with
# COURSE_BUILDER_LIBRARY_TOPUP_TIMEOUT. The abandoned model call is not killed: it finishes in
# its worker thread and its result is discarded.
LIBRARY_TOPUP_TIMEOUT_DEFAULT = 60.0


def library_topup_enabled() -> bool:
    v = (os.getenv("COURSE_BUILDER_LIBRARY_TOPUP") or LIBRARY_TOPUP_DEFAULT).strip().lower()
    return v not in ("off", "0", "false", "no")


def library_topup_timeout() -> float:
    try:
        v = float(os.getenv("COURSE_BUILDER_LIBRARY_TOPUP_TIMEOUT") or LIBRARY_TOPUP_TIMEOUT_DEFAULT)
    except ValueError:
        return LIBRARY_TOPUP_TIMEOUT_DEFAULT
    return v if v > 0 else LIBRARY_TOPUP_TIMEOUT_DEFAULT


class DayPlanningError(Exception):
    """The model could not produce a valid day plan after retries."""


def _default_group_size() -> str:
    from services import knowledge_base_service as kb
    return kb.get_default_group_size()


def _id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


# ---------------------------------------------------------------------- input parsing

def slots_for_hours(hours) -> int:
    """Teaching time is solid: hours x 4 quarter-hours, half hours handled, rounded down."""
    h = float(hours)
    if not math.isfinite(h) or h <= 0:
        raise ValueError("hours_per_day must be greater than 0")
    return int(math.floor(h * 4 + 1e-9))


def whole_hours(hours) -> int:
    """Course Builder teaching time is whole hours only. Raises ValueError with a plain message."""
    try:
        h = float(hours)
    except (TypeError, ValueError):
        raise ValueError("hours_per_day must be a number")
    if not math.isfinite(h) or h <= 0:
        raise ValueError("hours_per_day must be greater than 0")
    if h != int(h):
        raise ValueError("Teaching time per day must be a whole number of hours (for example 1, 2 or 3) "
                         f"in the Course Builder; {hours} is not a whole number of hours.")
    if h > MAX_HOURS:
        raise ValueError(f"hours_per_day must be between 1 and {MAX_HOURS}")
    return int(h)


def parse_context(ctx: Dict) -> Dict:
    """Validate the course_context the frontend echoes back. Raises ValueError."""
    if not isinstance(ctx, dict):
        raise ValueError("course_context must be an object")
    try:
        age_min = int(ctx.get("age_range_start"))
        age_max = int(ctx.get("age_range_end"))
        n = int(ctx.get("num_students"))
        hours = float(ctx.get("hours_per_day"))
    except (TypeError, ValueError):
        raise ValueError("course_context needs numeric age_range_start, age_range_end, num_students, hours_per_day")
    if not (2 <= age_min <= 25 and 2 <= age_max <= 25):
        raise ValueError("ages must be between 2 and 25")
    if age_max < age_min:
        age_min, age_max = age_max, age_min
    if not 1 <= n <= 500:
        raise ValueError("num_students must be between 1 and 500")
    n_hours = whole_hours(hours)
    return {
        "course_name": str(ctx.get("course_name") or "")[:300],
        "age_min": age_min, "age_max": age_max, "num_students": n,
        "hours_per_day": n_hours, "hours": n_hours, "slots": n_hours * BLOCKS_PER_HOUR,
    }


def _clean_titles(titles) -> List[str]:
    if not isinstance(titles, list):
        return []
    return [t.strip()[:150] for t in titles[:200] if isinstance(t, str) and t.strip()]


def _find_day(outline: Dict, day_id: str) -> Tuple[int, Dict]:
    from outliner.course_outline_generator import check_outline_limits, check_day_shape
    check_outline_limits(outline)
    days = outline["days"]
    if not days:
        raise ValueError("outline has no days")
    for d in days:
        check_day_shape(d)
    for i, d in enumerate(days):
        if d["id"] == day_id:
            return i, d
    raise ValueError(f"day '{day_id}' is not in the outline")


# ------------------------------------------------------------------ knowledge base view

def build_format_context(age_min, age_max, class_size, mode: Optional[str] = None) -> Dict:
    """
    The format universe for one class, as plain dicts:
      content_types, worksheet_formats, activity_formats (each with fit/fit_note, best first),
      pairing (content type -> ordered option ids), band, categories, plus lookup maps.
    Never leaves a content type without a worksheet option and an activity option.
    """
    from services import knowledge_base_service as kb
    mode = mode or format_fit_mode()
    band = kb.get_primary_age_band(age_min, age_max) or {}
    band_ids = {b["id"] for b in kb.find_age_bands(age_min, age_max)}
    n = class_size

    full_ws, full_act = kb.get_worksheet_formats_for(), kb.get_activity_formats_for()
    full_pairing = kb.get_pairing_table()
    if mode == "strict":
        ws_all = kb.get_worksheet_formats_for(age_min, age_max, n)
        act_all = kb.get_activity_formats_for(age_min, age_max, n)
        pairing_src = kb.get_pairing_table(age_min, age_max, n)
    else:
        ws_all, act_all, pairing_src = full_ws, full_act, full_pairing

    def annotate(f: Dict, is_activity: bool) -> Dict:
        f = dict(f)
        suit = f.get("suitable_age_bands")
        age_ok = (not suit) or bool(band_ids & set(suit))
        size_ok, size_note, over = True, "", 0.0
        if is_activity:
            lo, hi = f.get("min_class_size"), f.get("max_class_size")
            if hi is not None and n > hi:
                size_ok, size_note, over = False, f"made for up to {hi} students, class has {n}", (n - hi) / max(hi, 1)
            elif lo is not None and n < lo:
                size_ok, size_note, over = False, f"needs at least {lo} students, class has {n}", (lo - n) / max(lo, 1)
        notes = []
        if not age_ok:
            notes.append(f"outside its usual age range for {band.get('label', 'this age group')}")
        if size_note:
            notes.append(size_note)
        f["fit"] = "good" if (age_ok and size_ok) else "limited"
        f["fit_note"] = "; ".join(notes)
        # best first; among limited ones, the closest to fitting comes first
        f["_rank"] = 0 if f["fit"] == "good" else (2 if not age_ok else 1) + min(over, 1000.0) / 1000.0
        return f

    ws = sorted((annotate(f, False) for f in ws_all), key=lambda f: f["_rank"])
    act = sorted((annotate(f, True) for f in act_all), key=lambda f: f["_rank"])
    # the whole knowledge base, annotated: only used to fill a gap when strict filtering empties a list
    ws_full = sorted((annotate(f, False) for f in full_ws), key=lambda f: f["_rank"])
    act_full = sorted((annotate(f, True) for f in full_act), key=lambda f: f["_rank"])
    full_by = {WORKSHEET: {f["id"]: f for f in ws_full}, ACTIVITY: {f["id"]: f for f in act_full}}
    full_pair_by = {p["content_type_id"]: p for p in full_pairing}
    ws_by, act_by = {f["id"]: f for f in ws}, {f["id"]: f for f in act}
    content_types = kb.get_content_types()
    shown = {WORKSHEET: (ws, ws_by), ACTIVITY: (act, act_by)}

    def _admit(btype: str, fid: str) -> bool:
        """Make sure a format the strict filter removed is available (marked limited fit)."""
        lst, by = shown[btype]
        if fid in by:
            return True
        f = full_by[btype].get(fid)
        if f is None:
            return False
        by[fid] = f
        lst.append(f)
        lst.sort(key=lambda x: x["_rank"])
        return True

    def options(btype, ids, ct_id):
        lst, by = shown[btype]
        opts = sorted((i for i in (ids or []) if i in by), key=lambda i: by[i]["_rank"])
        if not any(by[i]["fit"] == "good" for i in opts):
            # Nothing in the pairing suits this class: also offer the best good-fit formats overall.
            extra = [f["id"] for f in lst if f["fit"] == "good" and f["id"] not in opts][:2]
            opts = opts + extra
        if not opts:
            # strict filtering emptied it: the closest-fitting paired formats from the whole knowledge base
            key = "worksheet_format_ids" if btype == WORKSHEET else "activity_format_ids"
            cand = [i for i in (full_pair_by.get(ct_id, {}).get(key) or []) if i in full_by[btype]]
            cand.sort(key=lambda i: full_by[btype][i]["_rank"])
            opts = [i for i in cand[:2] if _admit(btype, i)]
        if not opts:
            full_lst = ws_full if btype == WORKSHEET else act_full
            opts = [f["id"] for f in full_lst[:2] if _admit(btype, f["id"])]
        return opts

    pairing, pairing_map = [], {}
    by_ct = {p["content_type_id"]: p for p in pairing_src}
    for ct in content_types:
        src = by_ct.get(ct["id"], {})
        w = options(WORKSHEET, src.get("worksheet_format_ids"), ct["id"])
        a = options(ACTIVITY, src.get("activity_format_ids"), ct["id"])
        pairing.append({"content_type_id": ct["id"], "label": ct.get("label", ct["id"]),
                        "worksheet_format_ids": w, "activity_format_ids": a})
        pairing_map[ct["id"]] = {WORKSHEET: w, ACTIVITY: a}

    legacy = kb.get_legacy_label_map()
    return {
        "mode": mode, "band": band, "categories": kb.get_objective_categories(),
        "content_types": content_types, "worksheet_formats": ws, "activity_formats": act,
        "pairing": pairing, "pairing_map": pairing_map,
        "ids": {CONTENT: {c["id"]: c.get("label", c["id"]) for c in content_types},
                WORKSHEET: {f["id"]: f.get("label", f["id"]) for f in ws},
                ACTIVITY: {f["id"]: f.get("label", f["id"]) for f in act}},
        "fmt": {WORKSHEET: ws_by, ACTIVITY: act_by},
        "legacy": legacy,
    }


# ------------------------------------------------------------------------- emoji

_BASE = ("[\U0001F300-\U0001FAFF☀-➿⬀-⯿⌀-⏿©®‼⁉™ℹ"
         "↔-↪Ⓜ▪-◾⤴⤵〰〽㊗㊙]")
_MOD = "(?:️|[\U0001F3FB-\U0001F3FF])?"
_EMOJI_RE = re.compile(
    rf"^(?:[\U0001F1E6-\U0001F1FF]{{2}}|[0-9#*]️?⃣|{_BASE}{_MOD}(?:‍{_BASE}{_MOD})*)$"
)


_LEADING_EMOJI = re.compile(rf"^(?:{_BASE}{_MOD}(?:\u200D{_BASE}{_MOD})*\s*)+")


def is_single_emoji(s) -> bool:
    return isinstance(s, str) and bool(_EMOJI_RE.match(s.strip())) and len(s.strip()) <= 16


# --------------------------------------------------------------- parsing model output

_PART_SUFFIX = re.compile(r"\s*[\(\[,:\-–—]?\s*part\s*\d+(?:\s*(?:of|/)\s*\d+)?\s*[\)\]]?\s*$", re.I)


def _base_title(t: str) -> str:
    prev = None
    while prev != t:
        prev, t = t, _PART_SUFFIX.sub("", t).strip()
    return t


def _int(v, default=1, lo=1, hi=99) -> int:
    if isinstance(v, bool):
        return default
    try:
        return max(lo, min(hi, int(float(v))))
    except (TypeError, ValueError, OverflowError):  # list/dict/None, "abc", NaN, Infinity
        return default


def _str(v) -> Optional[str]:
    """A model-supplied value as a stripped non-empty string, or None for anything else."""
    return v.strip() if isinstance(v, str) and v.strip() else None


def _norm_title(t) -> str:
    return " ".join(t.split()).casefold() if isinstance(t, str) else ""


def _resolve_format(btype: str, fid, fx: Dict) -> Optional[str]:
    table = fx["ids"][btype]
    if not isinstance(fid, str) or not fid.strip():
        return None
    f = fid.strip()
    if f in table:
        return f
    norm = re.sub(r"[^a-z0-9]+", "_", f.lower()).strip("_")
    for i, label in table.items():
        if i == norm or label.lower() == f.lower():
            return i
    mapped = fx["legacy"].get(btype, {}).get(f)
    return mapped if mapped in table else None


def _clean_resources(raw) -> List[Dict]:
    merged: Dict[str, Dict] = {}
    if isinstance(raw, list):
        for r in raw[:MAX_RESOURCES * 2]:
            if isinstance(r, str) and r.strip():
                r = {"name": r, "quantity": 1}
            if not isinstance(r, dict):
                continue
            name = r.get("name")
            if not isinstance(name, str) or not name.strip():
                continue
            name = name.strip()[:80]
            e = merged.setdefault(name.lower(), {"name": name, "quantity": 0})
            e["quantity"] += _int(r.get("quantity"), 1, 1, 10000)  # same item listed twice: add up
    return list(merged.values())[:MAX_RESOURCES]


def _parse_block(rb, fx: Dict, valid_obj: set, default_obj: str, warnings: List[str]) -> Optional[Dict]:
    if not isinstance(rb, dict):
        return None
    btype = rb.get("type")
    if btype not in BLOCK_TYPES:
        warnings.append(f"dropped a block with unknown type {btype!r}")
        return None
    fid = _resolve_format(btype, rb.get("format_id"), fx)
    if fid is None:
        warnings.append(f"dropped '{rb.get('title')}': unknown {btype} format {rb.get('format_id')!r}")
        return None
    title = rb.get("title")
    if not isinstance(title, str) or not _base_title(title.strip()):
        warnings.append("dropped a block with no title")
        return None
    title = _base_title(title.strip())[:MAX_TITLE]
    desc = rb.get("description")
    desc = desc.strip()[:MAX_DESC] if isinstance(desc, str) and desc.strip() else title
    obj = rb.get("objective_id")
    if not isinstance(obj, str) or obj not in valid_obj:  # a list/dict here is unhashable
        obj = None  # repaired later from the group / day defaults
    ref = rb.get("ref")
    gw = rb.get("goes_with")
    return {
        "ref": ref.strip() if isinstance(ref, str) and ref.strip() else None,
        "type": btype, "format_id": fid, "title": title, "description": desc,
        "part": _int(rb.get("part")), "part_count": _int(rb.get("part_count")),
        "goes_ref": gw.strip() if isinstance(gw, str) and gw.strip() else None,
        "objective_id": obj, "group_size": rb.get("group_size") if isinstance(rb.get("group_size"), str) else None,
        "resources": _clean_resources(rb.get("resources")) if btype != CONTENT else [],
        "is_revision": rb.get("revision") is True,
    }


def _make_groups(blocks: List[Dict], warnings: List[str]) -> List[Dict]:
    """Collapse parts of one block into a group; renumber parts 1..n, part_count = n."""
    groups: Dict[Tuple, Dict] = {}
    for i, b in enumerate(blocks):
        key = (b["type"], b["format_id"], b["title"].lower(), bool(b.get("spare")))
        g = groups.setdefault(key, {"type": b["type"], "format_id": b["format_id"], "title": b["title"],
                                    "parts": [], "known": False, "spare": key[3]})
        g["parts"].append((b["part"], i, b))
    out = []
    for g in groups.values():
        g["parts"].sort(key=lambda t: (t[0], t[1]))
        parts = [p[2] for p in g["parts"]]
        limit = PART_LIMITS[g["type"]]
        if len(parts) > limit:
            warnings.append(f"'{g['title']}' had {len(parts)} parts; kept {limit}")
            parts = parts[:limit]
        first = parts[0]
        g["parts"] = parts
        g["refs"] = [p["ref"] for p in parts if p["ref"]]
        g["goes_ref"] = next((p["goes_ref"] for p in parts if p["goes_ref"]), None)
        g["objective_id"] = next((p["objective_id"] for p in parts if p["objective_id"]), None)
        g["group_size"] = first["group_size"]
        g["description"] = first["description"]
        g["is_revision"] = any(p["is_revision"] for p in parts)
        out.append(g)
    return out


def _icon_for(raw, used: set) -> str:
    icon = raw.strip() if isinstance(raw, str) else ""
    if not is_single_emoji(icon) or icon in used:
        icon = next((i for i in DEFAULT_ICONS if i not in used), DEFAULT_ICONS[0])
    used.add(icon)
    return icon


_NOTE_FORMAT = "does not pair with this content type"
_NOTE_TITLE = "is the same as its content block's title"


def _review_note(kinds, asked_format, used_format, fx: Dict, btype: str) -> str:
    labels = fx["ids"][btype]
    parts = []
    if "format" in kinds:
        parts.append(f"The format the AI picked ({labels.get(asked_format, asked_format)}) {_NOTE_FORMAT}, "
                     f"so it is shown as {labels.get(used_format, used_format)}. "
                     "The title may not match the format.")
    if "title" in kinds:
        parts.append(f"The title {_NOTE_TITLE}; rename it to say what students do.")
    return " ".join(parts)


def _merge_split_parts(parsed: List[Dict], warnings: List[str]) -> None:
    """Parts of one block stay in one hour: when the same block (type, format, title) with parts shows
    up in several hours, every part moves to the first hour it appears in."""
    where: Dict[Tuple, List[int]] = {}
    multipart: set = set()
    for ti, pt in enumerate(parsed):
        for b in pt["blocks"]:
            k = (b["type"], b["format_id"], b["title"].lower())
            if ti not in where.setdefault(k, []):
                where[k].append(ti)
            if b["part"] > 1 or b["part_count"] > 1:
                multipart.add(k)
    for k, tis in where.items():
        if len(tis) < 2 or k not in multipart:
            continue
        first = tis[0]
        moved = []
        for ti in tis[1:]:
            keep, go = [], []
            for b in parsed[ti]["blocks"]:
                (go if (b["type"], b["format_id"], b["title"].lower()) == k else keep).append(b)
            parsed[ti]["blocks"] = keep
            moved += go
        parsed[first]["blocks"] += moved
        spare = all(b.get("spare") for b in parsed[first]["blocks"]
                    if (b["type"], b["format_id"], b["title"].lower()) == k)
        for b in parsed[first]["blocks"]:
            if (b["type"], b["format_id"], b["title"].lower()) == k:
                b["spare"] = spare
        warnings.append(f"parts of '{moved[0]['title']}' were spread over several hours; kept together in one")


def _rehome_dependents(parsed: List[Dict], warnings: List[str]) -> None:
    """A worksheet or activity whose goes_with points at content in ANOTHER hour moves to that hour,
    so partners stay in the same hour. (Overflow there goes to the library, never past the cap.)"""
    content_home: Dict[str, Tuple[int, Dict]] = {}
    local: List[set] = []
    for ti, pt in enumerate(parsed):
        refs = set()
        for g in pt["groups"]:
            refs.update(g["refs"])
            if g["type"] == CONTENT:
                for r in g["refs"]:
                    content_home.setdefault(r, (ti, g))
        local.append(refs)
    for ti, pt in enumerate(parsed):
        for g in list(pt["groups"]):
            ref = g["goes_ref"]
            if g["type"] == CONTENT or not ref or ref in local[ti]:
                continue
            home = content_home.get(ref)
            if home and home[0] != ti:
                pt["groups"].remove(g)
                parsed[home[0]]["groups"].append(g)
                warnings.append(f"'{g['title']}' went with content in another hour; moved next to it")


def normalise_plan(raw, fx: Dict, default_obj: str, *, known: Optional[Dict] = None,
                   hours: Optional[int] = None) -> Dict:
    """
    Validate and repair the model's answer. Returns
      {topics: [{id, title, icon, priority, is_new, blocks: [final block dicts]}], warnings, n_blocks}
    Every emitted topic is complete (has content; every worksheet/activity has a valid
    partner and a format its pairing allows). Never a half-valid structure.

    `known` (more-ideas mode): {"topics": {topic_id: topic}, "blocks": {block_id: block}} for
    blocks that already exist, so new blocks can attach to them.

    `hours` (a day plan): the model's answer is {"hours": [{title, icon, blocks, spare_blocks}]}. Each
    hour is a topic with a fixed home: exactly `hours` of them are returned (extra hours' blocks go to
    the last hour's library; missing or unusable hours become empty "Hour n" placeholders), blocks
    carry a transient `_spare` flag for fill_hours, and extra keys describe the shape:
    hour_shape_ok, padded (placeholder hour numbers), folded (blocks from extra hours).
    """
    hour_mode = hours is not None
    warnings: List[str] = []
    dropped_topics: List[str] = []  # titles of topics left out because they had no content block
    issues: List[Dict] = []  # worksheets/activities needing one more look from the model (see resolve_issues)
    valid_obj = {c["id"] for c in fx["categories"]}
    if not isinstance(default_obj, str) or default_obj not in valid_obj:
        default_obj = fx["categories"][0]["id"] if fx["categories"] else ""
    topics_raw = None
    if isinstance(raw, dict):
        topics_raw = raw.get("hours") if isinstance(raw.get("hours"), list) else raw.get("topics")
    if not isinstance(topics_raw, list) or not topics_raw:
        return {"topics": [], "warnings": ["model returned no topics"], "n_blocks": 0, "issues": [], "dropped_topics": [],
                "hour_shape_ok": False, "padded": [], "folded": 0}
    known = known or {"topics": {}, "blocks": {}}

    used_icons = {t.get("icon") for t in known["topics"].values()}
    parsed_topics = []
    for rt in topics_raw[:(hours + EXTRA_HOURS_READ) if hour_mode else MAX_TOPICS]:
        if not isinstance(rt, dict):
            continue
        tid_raw = rt.get("topic_id") if isinstance(rt.get("topic_id"), str) and rt.get("topic_id") else rt.get("hour_id")
        existing = known["topics"].get(tid_raw) if isinstance(tid_raw, str) and tid_raw else None
        title = rt.get("title") if isinstance(rt.get("title"), str) else (existing or {}).get("title")
        if not isinstance(title, str) or not title.strip():
            warnings.append("dropped a topic with no title")
            continue
        blocks = []
        lists = [(rt.get("blocks"), False)] + ([(rt.get("spare_blocks"), True)] if hour_mode else [])
        for lst, is_spare in lists:
            for rb in (lst if isinstance(lst, list) else [])[:MAX_BLOCKS_PER_TOPIC]:
                pb = _parse_block(rb, fx, valid_obj, default_obj, warnings)
                if pb:
                    if is_spare:
                        pb["spare"] = True
                    blocks.append(pb)
        title = _LEADING_EMOJI.sub("", title.strip()) or title.strip()  # the icon has its own field
        parsed_topics.append({"raw": rt, "existing": existing, "title": title[:MAX_TITLE], "blocks": blocks})

    if hour_mode:
        _merge_split_parts(parsed_topics, warnings)
    for pt in parsed_topics:
        pt["groups"] = _make_groups(pt.pop("blocks"), warnings)
    if hour_mode:
        _rehome_dependents(parsed_topics, warnings)

    # refs are only meaningful inside their own topic
    out_topics, all_blocks = [], 0
    for pt in parsed_topics:
        existing = pt["existing"]
        groups = pt["groups"]
        ref_map = {}
        for g in groups:
            for r in g["refs"]:
                ref_map.setdefault(r, g)
        known_content = []
        if existing:
            for kb_ in known["blocks"].values():
                if kb_.get("topic_id") == existing["id"] and kb_["type"] == CONTENT:
                    known_content.append(kb_)
            ref_known = {b["id"]: b for b in known["blocks"].values() if b.get("topic_id") == existing["id"]}
        else:
            ref_known = {}
        new_content = [g for g in groups if g["type"] == CONTENT]
        if not new_content and not known_content:
            warnings.append(f"dropped topic '{pt['title']}': it has no content block")
            dropped_topics.append(pt["title"])
            continue

        def content_target(g, idx):
            """The content group (or already-existing content block) this one goes with."""
            ref = g["goes_ref"]
            for _ in range(2):  # follow one hop if it points at a worksheet/activity
                t = (ref_map.get(ref) or ref_known.get(ref)) if ref else None
                if t is None:
                    break
                if t["type"] == CONTENT:
                    return t
                ref = t.get("goes_ref")
            before = [c for c in new_content if groups.index(c) < idx]
            if before:
                return before[-1]
            return new_content[0] if new_content else known_content[-1]

        kept = []  # groups that survive, in model order
        for idx, g in enumerate(groups):
            if g["type"] == CONTENT:
                g["target"] = None
                kept.append(g)
                continue
            tgt = content_target(g, idx)
            g["target"] = tgt
            ct = tgt["format_id"]
            opts = fx["pairing_map"].get(ct, {}).get(g["type"], [])
            g["issue"] = None
            if not opts:
                warnings.append(f"dropped '{g['title']}': no {g['type']} format available for {ct}")
                continue
            kinds = []
            if g["format_id"] not in opts:
                kinds.append("format")
            if _norm_title(g["title"]) == _norm_title(tgt.get("title")):
                kinds.append("title")
            if kinds:
                # Never silently swap: park it on the nearest allowed format, flagged for review.
                # resolve_issues() gives the model one chance to fix it before the flag stays.
                g["issue"] = {"kinds": kinds, "asked_format": g["format_id"], "orig_title": g["title"],
                              "content_title": tgt.get("title"), "content_format": ct, "allowed": list(opts)}
                if "format" in kinds:
                    g["format_id"] = opts[0]
            kept.append(g)

        # canonical order: content, then its worksheets, then its activities
        ordered = []
        for c in [g for g in kept if g["type"] == CONTENT]:
            ordered.append(c)
            ordered += [g for g in kept if g["type"] == WORKSHEET and g["target"] is c]
            ordered += [g for g in kept if g["type"] == ACTIVITY and g["target"] is c]
        in_ordered = {id(g) for g in ordered}
        for g in kept:  # groups targeting already-existing content (more-ideas mode)
            if id(g) not in in_ordered:
                ordered.append(g)

        # stamp ids
        topic_id = existing["id"] if existing else _id("hour" if hour_mode else "topic")
        icon = existing["icon"] if existing else _icon_for(pt["raw"].get("icon"), used_icons)
        prio = pt["raw"].get("priority")
        prio = existing["priority"] if existing else (prio if prio in PRIORITIES else "supporting")
        if hour_mode:
            prio = "essential"  # every hour of the day is part of the day
        final_blocks = []
        for g in ordered:
            g["gid"] = _id("grp")
            g["final_ids"] = [_id("blk") for _ in g["parts"]]
            g["last_id"] = g["final_ids"][-1]
        for g in ordered:
            tgt = g["target"]
            goes = (tgt.get("last_id") or tgt["id"]) if tgt is not None else None
            obj = g["objective_id"] or (known["blocks"].get(goes, {}).get("objective_id") if goes else None) or default_obj
            fmt = fx["fmt"].get(g["type"], {}).get(g["format_id"])
            gsz = None
            if g["type"] == ACTIVITY:
                allowed = (fmt or {}).get("group_sizes") or []
                gsz = g["group_size"] if g["group_size"] in allowed else (allowed[0] if allowed else _default_group_size())
            n = len(g["parts"])
            issue = g.get("issue")
            flag = bool(issue)
            note = _review_note(issue["kinds"], issue["asked_format"], g["format_id"], fx, g["type"]) if issue else ""
            for pi, p in enumerate(g["parts"]):
                final_blocks.append({
                    "id": g["final_ids"][pi], "topic_id": topic_id, "type": g["type"],
                    "format_id": g["format_id"], "format_label": fx["ids"][g["type"]].get(g["format_id"], g["format_id"]),
                    "title": g["title"], "description": p["description"],
                    "part": pi + 1, "part_count": n, "part_group_id": g["gid"],
                    "goes_with": goes, "objective_id": obj, "group_size": gsz,
                    "resources": p["resources"], "is_revision": g["is_revision"], "icon": icon,
                    "duration_minutes": BLOCK_MINUTES,
                    "fit": (fmt or {}).get("fit") if fmt else None,
                    "fit_note": (fmt or {}).get("fit_note", "") if fmt else "",
                    "needs_review": flag, "review_note": note,
                    **({"_spare": bool(g.get("spare"))} if hour_mode else {}),
                })
            if issue:
                issues.append({"block_ids": list(g["final_ids"]), "kinds": issue["kinds"],
                               "asked_format": issue["asked_format"], "orig_title": issue["orig_title"],
                               "content_title": issue["content_title"], "content_format": issue["content_format"],
                               "allowed": issue["allowed"], "type": g["type"], "topic_id": topic_id})
        out_topics.append({"id": topic_id, "title": existing["title"] if existing else pt["title"], "icon": icon,
                           "priority": prio, "is_new": existing is None, "blocks": final_blocks})
        all_blocks += len(final_blocks)

    if not hour_mode and not any(t["priority"] == "essential" for t in out_topics if t["is_new"]) and not known["topics"]:
        if out_topics:
            out_topics[0]["priority"] = "essential"
            warnings.append("no topic was marked essential; the first topic was")
    extra = {"hour_shape_ok": True, "padded": [], "folded": 0}
    if hour_mode:
        extra["hour_shape_ok"] = len(topics_raw) == hours and len(out_topics) == hours
        keep, over = out_topics[:hours], out_topics[hours:]
        for t in over:  # more hours than the day has: their blocks wait in the library of the last hour
            for b in t["blocks"]:
                b.update({"topic_id": keep[-1]["id"], "icon": keep[-1]["icon"], "_spare": True, "_fold": True})
                keep[-1]["blocks"].append(b)
                extra["folded"] += 1
        if extra["folded"]:
            warnings.append(f"the model planned more than {hours} hours; {extra['folded']} block(s) of the extra "
                            "hour(s) were put in the library")
        for k in range(len(keep), hours):  # fewer usable hours than the day has: empty placeholders
            keep.append({"id": _id("hour"), "title": f"Hour {k + 1}", "icon": _icon_for(None, used_icons),
                         "priority": "essential", "is_new": True, "blocks": [], "placeholder": True})
            extra["padded"].append(k + 1)
        if extra["padded"]:
            warnings.append(f"only {hours - len(extra['padded'])} of {hours} hours could be planned")
        out_topics = keep
        all_blocks = sum(len(t["blocks"]) for t in out_topics)
    return {"topics": out_topics, "warnings": warnings, "n_blocks": all_blocks, "issues": issues,
            "dropped_topics": dropped_topics, **extra}


# -------------------------------------------------------------------- filling the day

def fill_day(topics: List[Dict], slots: int) -> Tuple[List[Dict], List[Dict]]:
    """
    Choose which blocks start on the day. Essential topics first, then supporting, then
    extension (each in teaching order). A block group (all parts of one block) is placed
    whole or not at all; a worksheet/activity is only placed if the content block it goes
    with is placed. The placed total can never exceed `slots`. Returns (placed in
    teaching order, library).
    """
    cands = []  # (priority rank, topic idx, canonical idx, group blocks)
    for ti, t in enumerate(topics):
        groups, order = {}, []
        for b in t["blocks"]:
            if b["part_group_id"] not in groups:
                groups[b["part_group_id"]] = []
                order.append(b["part_group_id"])
            groups[b["part_group_id"]].append(b)
        for ci, gid in enumerate(order):
            cands.append((PRIORITY_RANK.get(t["priority"], 1), ti, ci, groups[gid]))
    cands.sort(key=lambda c: c[:3])
    placed_ids, used = set(), 0
    for _, _, _, grp in cands:
        first = grp[0]
        if any(b.get("needs_review") for b in grp):
            continue  # flagged for review: never starts on the day, the teacher decides from the library
        dep = first["goes_with"]
        if dep is not None and dep not in placed_ids:
            continue
        if used + len(grp) > slots:
            continue
        for b in grp:
            placed_ids.add(b["id"])
        used += len(grp)
    placed, library = [], []
    for t in topics:
        for b in t["blocks"]:
            (placed if b["id"] in placed_ids else library).append(b)
    prio = {t["id"]: (PRIORITY_RANK.get(t["priority"], 1), i) for i, t in enumerate(topics)}
    library.sort(key=lambda b: prio[b["topic_id"]])  # stable: keeps canonical order within a topic
    assert len(placed) <= slots
    return placed, library


def _groups_of(t: Dict) -> List[List[Dict]]:
    groups, order = {}, []
    for b in t["blocks"]:
        gid = b["part_group_id"]
        if gid not in groups:
            groups[gid] = []
            order.append(gid)
        groups[gid].append(b)
    return [groups[g] for g in order]


def fill_hours(hours: List[Dict], *, ignore_review: bool = False) -> Tuple[List[Dict], List[Dict], List[List[Dict]]]:
    """
    Choose which blocks start on the day, hour by hour. In each hour the planned (non-spare) blocks go
    first, in the model's order, then spare blocks of that same hour fill any room left. A block group
    (all parts of one block) is placed whole or not at all, always inside ONE hour; a worksheet or
    activity is only placed if the content block it goes with is placed; a block flagged for review is
    never placed (unless `ignore_review`, used only to judge whether a model answer was good enough).
    No hour ever holds more than BLOCKS_PER_HOUR blocks, so the day never exceeds hours x 4.
    Returns (placed in teaching order, library in hour order, per-hour placed lists).
    """
    placed_ids: set = set()
    per_hour: List[List[Dict]] = []
    for t in hours:
        groups = _groups_of(t)
        used, chosen = 0, set()
        for want_spare in (False, True):
            for grp in groups:
                first = grp[0]
                if first["id"] in chosen or (not want_spare and first.get("_spare")):
                    continue
                if first.get("_fold") or (not ignore_review and any(b.get("needs_review") for b in grp)):
                    continue
                dep = first["goes_with"]
                if dep is not None and dep not in placed_ids:
                    continue
                if used + len(grp) > BLOCKS_PER_HOUR:
                    continue
                chosen.add(first["id"])
                placed_ids.update(b["id"] for b in grp)
                used += len(grp)
        per_hour.append([b for b in t["blocks"] if b["id"] in placed_ids])
    placed = [b for h in per_hour for b in h]
    library = [b for t in hours for b in t["blocks"] if b["id"] not in placed_ids]
    assert all(len(h) <= BLOCKS_PER_HOUR for h in per_hour)
    assert len(placed) <= len(hours) * BLOCKS_PER_HOUR
    return placed, library, per_hour


def strip_internal(hours: List[Dict]) -> None:
    for t in hours:
        for b in t["blocks"]:
            b.pop("_spare", None)
            b.pop("_fold", None)


def hour_windows(hours: List[Dict], per_hour: List[List[Dict]]) -> List[Dict]:
    """The contract's `hours` list: id, number, title, icon, time window, capacity, placed block ids."""
    return [{"id": t["id"], "number": i + 1, "title": t["title"], "icon": t["icon"],
             "start_minute": i * HOUR_MINUTES, "end_minute": (i + 1) * HOUR_MINUTES,
             "capacity_blocks": BLOCKS_PER_HOUR, "block_ids": [b["id"] for b in per_hour[i]]}
            for i, t in enumerate(hours)]


def resource_totals(placed: List[Dict]) -> List[Dict]:
    """Per resource name: parts of one block reuse the same items (max across parts), then
    blocks add up (each worksheet/activity needs its own)."""
    per_group: Dict[str, Dict[str, Dict]] = {}
    for b in placed:
        g = per_group.setdefault(b["part_group_id"], {})
        for r in b.get("resources") or []:
            k = r["name"].strip().lower()
            e = g.setdefault(k, {"name": r["name"], "quantity": 0, "blocks": 0})
            e["quantity"] = max(e["quantity"], r["quantity"])
            e["blocks"] += 1
    total: Dict[str, Dict] = {}
    for g in per_group.values():
        for k, e in g.items():
            t = total.setdefault(k, {"name": e["name"], "quantity": 0, "used_in_blocks": 0})
            t["quantity"] += e["quantity"]
            t["used_in_blocks"] += e["blocks"]
    return sorted(total.values(), key=lambda r: (-r["used_in_blocks"], r["name"].lower()))


def objective_coverage(placed: List[Dict], library: List[Dict], categories: List[Dict]) -> Dict:
    have = {b["objective_id"] for b in placed}
    lib = {b["objective_id"] for b in library}
    ids = [c["id"] for c in categories]
    missing = [i for i in ids if i not in have]
    return {"covered": [i for i in ids if i in have], "missing": missing,
            "missing_but_in_library": [i for i in missing if i in lib]}


def _topic_summary(t: Dict) -> Dict:
    return {"id": t["id"], "title": t["title"], "icon": t["icon"], "priority": t["priority"]}


# -------------------------------------------------------------------------- the LLM

def _call(call: Callable, prompt: str, attempt: int, system: str, hint: str = "", max_tokens: int = 7000) -> Dict:
    return call(
        prompt=prompt if attempt == 0 else prompt + (
            "\n\nYour previous answer was not usable. " + hint + "Return valid JSON in exactly the shape above: "
            "each hour with at least one content block, and every worksheet and activity "
            "pointing (goes_with) at the ref of a content block in the same hour, using only the listed ids "
            "and only the formats the pairing table lists for that content type."),
        system_message=system,
        temperature=0.7 if attempt == 0 else 0.3,
        max_tokens=max_tokens,
    )


def _run(call, prompt, fx, default_obj, accept: Callable[[Dict], bool], system, known=None,
         hint_for: Optional[Callable[[Dict], str]] = None, hours: Optional[int] = None,
         score: Optional[Callable[[Dict], tuple]] = None, max_tokens: int = 7000,
         prepare: Optional[Callable] = None) -> Dict:
    score = score or (lambda r: (r["n_blocks"],))
    best, last_err, hint = None, "unknown", ""
    for attempt in range(MAX_ATTEMPTS):
        try:
            raw = _call(call or call_openai, prompt, attempt, system, hint, max_tokens)
        except ValueError as e:  # includes json.JSONDecodeError
            last_err = f"unparseable response: {e}"
            continue
        try:
            if prepare:
                raw = prepare(raw)
            res = normalise_plan(raw, fx, default_obj, known=known, **({"hours": hours} if hours is not None else {}))
        except Exception as e:  # noqa: BLE001 - malformed model output must retry, never 500
            logger.warning("Day plan attempt %d could not be read: %s: %s", attempt + 1, type(e).__name__, e)
            last_err = "response could not be read"
            continue
        if res["topics"] and (best is None or score(res) > score(best)):
            best = res
        if res["topics"] and accept(res):
            return res
        last_err = "response failed structure validation: " + "; ".join(res["warnings"][:3])
        if res["topics"] and hint_for:
            hint = hint_for(res)
        logger.warning("Day plan attempt %d not good enough: %s", attempt + 1, last_err)
    if best is not None:
        best["warnings"].append("the plan is not an exact fit for the hours it was asked for" if hours is not None
                                else "the plan is shorter than the model was asked for")
        return best
    raise DayPlanningError(f"Could not plan this day: {last_err}")


def resolve_issues(res: Dict, fx: Dict, *, day_title: str, age_min, age_max, num_students: int,
                   call: Optional[Callable], known: Optional[Dict] = None) -> Dict:
    """
    One extra model call (at most) covering every flagged worksheet/activity of this day: a
    format its content type does not pair with, or a title identical to its content block's.
    The model must pick an allowed format and write a title and description that fit it. An
    answer that is valid clears the flag; anything else leaves the block flagged
    (needs_review + review_note) on the nearest allowed format. Flagged blocks are never placed
    (fill_day). Mutates and returns `res`.
    """
    issues = res.get("issues") or []
    res["unresolved"] = []  # [{kinds, parts}] still flagged after this call; feeds the teacher notices
    if not issues:
        return res
    by_id = {b["id"]: b for t in res["topics"] for b in t["blocks"]}
    offenders = []
    for it in issues:
        first = by_id.get(it["block_ids"][0])
        if not first:
            continue
        offenders.append({
            "id": first["id"], "type": it["type"], "part_count": len(it["block_ids"]),
            "content_title": it["content_title"], "content_format": fx["ids"][CONTENT].get(it["content_format"], it["content_format"]),
            "title": it["orig_title"], "asked_format": it["asked_format"],
            "asked_label": fx["ids"][it["type"]].get(it["asked_format"], it["asked_format"]),
            "reasons": it["kinds"], "allowed": [
                {"id": i, "label": fx["ids"][it["type"]].get(i, i), "fit": fx["fmt"][it["type"]].get(i, {}).get("fit_note", "")}
                for i in it["allowed"]],
            "description": first["description"],
        })
    answer = {}
    try:
        prompt = build_fix_prompt(day_title=day_title, age_min=age_min, age_max=age_max, band=fx["band"],
                                  num_students=num_students, offenders=offenders)
        raw = (call or call_openai)(prompt=prompt, system_message=_SYSTEM, temperature=0.3, max_tokens=2500)
        items = raw.get("blocks") if isinstance(raw, dict) else None
        for r in (items if isinstance(items, list) else []):
            if isinstance(r, dict) and isinstance(r.get("id"), str):
                answer[r["id"]] = r
    except Exception as e:  # noqa: BLE001 - the flag stays; the day is still usable
        logger.warning("Fix call for flagged blocks failed: %s: %s", type(e).__name__, e)

    fixed = 0
    for it in issues:
        blocks = [by_id[i] for i in it["block_ids"] if i in by_id]
        if not blocks:
            continue
        r = answer.get(blocks[0]["id"])
        fid = _resolve_format(it["type"], r.get("format_id"), fx) if r else None
        new_title = _str(r.get("title")) if r else None
        new_title = _base_title(new_title)[:MAX_TITLE] if new_title else None
        ok = bool(r) and fid in it["allowed"] and bool(new_title)
        ok = ok and _norm_title(new_title) != _norm_title(it["content_title"])
        if ok and "format" in it["kinds"]:
            ok = _norm_title(new_title) != _norm_title(it["orig_title"])  # format moved: the title must move too
        if not ok:
            res["unresolved"].append({"kinds": list(it["kinds"]), "parts": len(blocks)})
            continue
        desc = _str(r.get("description"))
        desc = desc[:MAX_DESC] if desc else None
        f = fx["fmt"][it["type"]].get(fid, {})
        gsz = None
        if it["type"] == ACTIVITY:
            allowed_sizes = f.get("group_sizes") or []
            asked = r.get("group_size")
            old = blocks[0].get("group_size")
            gsz = asked if isinstance(asked, str) and asked in allowed_sizes else (
                old if old in allowed_sizes else (allowed_sizes[0] if allowed_sizes else _default_group_size()))
        for b in blocks:
            b.update({"format_id": fid, "format_label": fx["ids"][it["type"]].get(fid, fid), "title": new_title,
                      "fit": f.get("fit"), "fit_note": f.get("fit_note", ""),
                      "needs_review": False, "review_note": "", "group_size": gsz})
            if desc:
                b["description"] = desc
        fixed += 1
    left = len(issues) - fixed
    res["warnings"].append(f"{len(issues)} block(s) had a format or title problem; the model fixed {fixed}"
                           + (f", {left} left flagged in the library for review" if left else ""))
    res["issues"] = []
    return res


_SYSTEM = "You are an expert curriculum designer working with a teacher. Respond with valid JSON only."


def _outline_and_context(course_context, outline, day_id):
    ctx = parse_context(course_context)
    idx, day = _find_day(outline, day_id)
    return ctx, idx, day


# ------------------------------------------------------------- teacher-facing notices
#
# `warnings` are internal wording (kept, logged, never meant for teachers). `notices` are what a
# teacher can act on, in plain language. Stable codes:
#   library_blocks_need_review  attention  flagged ideas waiting in the library
#   topic_left_out              attention  (older plans) a topic could not be built and was left out
#   hour_left_out               attention  an hour could not be planned and is empty ("Hour n")
#   day_not_full                attention  the day / some hours could not be completely filled
#   library_ideas_unavailable   info       the automatic extra ideas could not be added
# Things that were repaired successfully produce no notice.

NOTICE_CODES = ("library_blocks_need_review", "topic_left_out", "hour_left_out", "day_not_full",
                "library_ideas_unavailable")


def _notice(code: str, severity: str, message: str) -> Dict:
    return {"code": code, "severity": severity, "message": message}


def _plural(n: int, one: str, many: str) -> str:
    return one if n == 1 else many


def _review_notice(n: int, fmt: bool, title: bool) -> Dict:
    """The library_blocks_need_review notice for n flagged ideas (fmt/title: which problems occur)."""
    if n == 1:
        reasons = ([("its format does not suit the lesson it goes with")] if fmt else []) + \
                  ([("its title repeats the lesson's title")] if title else [])
    elif fmt and title:
        reasons = ["some have a format that does not suit the lesson they go with",
                   "some have a title that repeats the lesson's title"]
    elif fmt:
        reasons = ["their formats do not suit the lessons they go with"]
    else:
        reasons = ["their titles repeat the lessons' titles"]
    return _notice(
        "library_blocks_need_review", "attention",
        f"{n} {_plural(n, 'idea in the library needs', 'ideas in the library need')} a quick look before "
        f"{_plural(n, 'you use it', 'you use them')}: " + " and ".join(reasons) + ". "
        f"{_plural(n, 'It is', 'They are')} marked in the library and "
        f"{_plural(n, 'was', 'were')} not added to the day.")


def review_notice_from_library(library: List[Dict]) -> Optional[Dict]:
    """Recompute the review notice from the day's actual library: every flagged idea in it, whichever
    call produced it. A multi-part idea counts once."""
    flagged = [b for b in library if b.get("needs_review")]
    if not flagged:
        return None
    ideas = {b.get("part_group_id") or b["id"] for b in flagged}
    notes = " ".join(b.get("review_note") or "" for b in flagged)
    fmt, title = _NOTE_FORMAT in notes, _NOTE_TITLE in notes
    if not fmt and not title:
        fmt = True  # flagged without a recognisable reason: still tell the teacher
    return _review_notice(len(ideas), fmt, title)


def refresh_count_notices(notices: List[Dict], library: List[Dict]) -> List[Dict]:
    """Return `notices` with the library review notice recomputed from `library` (replaced in place,
    added first when new, removed when nothing is flagged any more). Other notices are untouched."""
    fresh = review_notice_from_library(library)
    code = "library_blocks_need_review"
    out, done = [], False
    for n in notices:
        if n["code"] == code:
            if fresh and not done:
                out.append(fresh)
            done = True
        else:
            out.append(n)
    if fresh and not done:
        out.insert(0, fresh)
    return out


def build_notices(res: Optional[Dict], *, placed: Optional[List[Dict]] = None, slots: Optional[int] = None,
                  hours: Optional[List[Dict]] = None) -> List[Dict]:
    """Teacher notices from a normalised/resolved model result (+ the day fill when known)."""
    out: List[Dict] = []
    res = res or {}
    left = res.get("unresolved") or []
    if left:
        out.append(_review_notice(len(left), any("format" in u["kinds"] for u in left),
                                  any("title" in u["kinds"] for u in left)))
    padded = res.get("padded") or []
    if padded:
        names = ", ".join(f"Hour {k}" for k in padded[:3])
        if len(padded) > 3:
            names += f" and {len(padded) - 3} more"
        out.append(_notice(
            "hour_left_out", "attention",
            f"{names} could not be planned and {_plural(len(padded), 'is', 'are')} empty. "
            "Move blocks in from the library or ask for more ideas."))
    dropped = [] if hours is not None else [t for t in (res.get("dropped_topics") or []) if t]
    if dropped:
        names = ", ".join(f"\u201c{t}\u201d" for t in dropped[:3])
        if len(dropped) > 3:
            names += f" and {len(dropped) - 3} more"
        out.append(_notice(
            "topic_left_out", "attention",
            f"{_plural(len(dropped), 'A topic', 'Some topics')} ({names}) could not be built and "
            f"{_plural(len(dropped), 'was', 'were')} left out. Ask for more ideas to try again."))
    if placed is not None and slots:
        if len(placed) < slots:
            short = ""
            if hours is not None:
                part = [h for h in hours if len(h["block_ids"]) < h["capacity_blocks"] and h["number"] not in padded]
                if part:
                    names = "; ".join(f"Hour {h['number']} has {len(h['block_ids'])} of {h['capacity_blocks']} blocks"
                                      for h in part[:3])
                    short = f" {names}{' and more' if len(part) > 3 else ''}."
            out.append(_notice(
                "day_not_full", "attention",
                f"This day is not completely filled: {len(placed)} of {slots} blocks "
                f"({len(placed) * BLOCK_MINUTES} of {slots * BLOCK_MINUTES} minutes).{short} "
                "Add blocks from the library or ask for more ideas."))
    return out


def _spare_count(library: List[Dict]) -> int:
    return sum(1 for b in library if not b.get("needs_review"))


def top_up_day_library(course_context: Dict, outline: Dict, plan: Dict, earlier_topics: Optional[List[str]] = None,
                       call: Optional[Callable] = None, *, force: bool = False) -> Optional[Dict]:
    """
    Fill a planned day's library with one extra ideas call (the existing more_ideas path, so the
    same validation, dedupe and review-flag rules apply). Returns the more_ideas result
    ({day_id, topics, blocks, warnings, notices}) or None when skipped (switched off, or the
    library already has LIBRARY_TOPUP_MIN_SPARE usable blocks). Never raises: a failed top-up is
    logged and returns {"failed": True, ...} with no blocks; the day stays as planned.
    Ideas are never placed on the day, so they never touch the cap.
    """
    if not force and not library_topup_enabled():
        return None
    if _spare_count(plan["library"]) >= LIBRARY_TOPUP_MIN_SPARE:
        return None
    # All of the day's topics with ALL their blocks (placed + library), as the frontend would send them
    by_topic: Dict[str, List[Dict]] = {t["id"]: [] for t in plan["topics"]}
    for b in list(plan["placed"]) + list(plan["library"]):
        by_topic.setdefault(b["topic_id"], []).append(b)
    current = [{**t, "blocks": by_topic.get(t["id"], [])} for t in plan["topics"]][:12]
    try:
        return more_ideas(course_context, outline, plan["day_id"], current, earlier_topics,
                          count=LIBRARY_TOPUP_COUNT, call=call)
    except Exception as e:  # noqa: BLE001 - the day is already usable; never fail it for spare ideas
        logger.warning("Library top-up for day %s failed (day kept as planned): %s: %s",
                       plan.get("day_id"), type(e).__name__, e)
        return {"day_id": plan["day_id"], "block_minutes": BLOCK_MINUTES, "topics": [], "blocks": [],
                "warnings": [f"library top-up failed: {type(e).__name__}"], "notices": [], "failed": True}


def apply_library_topup(plan: Dict, ideas: Optional[Dict], categories: Optional[List[Dict]] = None) -> Dict:
    """Merge a top-up result into a plan (returns a new dict; the input is not mutated).
    Ideas only ever land in the library."""
    if not ideas:
        return plan
    out = dict(plan)
    out["topics"] = list(plan["topics"]) + list(ideas.get("topics") or [])
    out["library"] = list(plan["library"]) + list(ideas.get("blocks") or [])
    # plan["warnings"] stays "the plan's own warnings"; the top-up's are logged (and are on the
    # stream's day_library event), not mixed in.
    for w in ideas.get("warnings") or []:
        logger.info("day %s library top-up warning: %s", plan.get("day_id"), w)
    notices = list(plan.get("notices") or [])
    if ideas.get("failed"):
        notices.append(_notice("library_ideas_unavailable", "info",
                               "We could not add extra ideas to the library automatically. "
                               "Use More ideas to fill it."))
    else:
        notices = _merge_review_notices(notices, ideas.get("notices") or [])
    out["notices"] = refresh_count_notices(notices, out["library"])
    if categories is not None:
        out["objective_coverage"] = objective_coverage(plan["placed"], out["library"], categories)
    return out


def _merge_review_notices(base: List[Dict], extra: List[Dict]) -> List[Dict]:
    """Same-code notices are not repeated: the extra one is added when its code is new."""
    have = {n["code"] for n in base}
    return base + [n for n in extra if n["code"] not in have]


def library_topup_event(course_context: Dict, outline: Dict, plan: Dict, earlier_topics: Optional[List[str]] = None,
                        call: Optional[Callable] = None) -> Optional[Dict]:
    """
    The payload of the stream's `day_library` event, or None when the top-up is skipped.
      {day_id, topped_up: bool, topics: [new topics], blocks: [new library blocks],
       notices: [full notice list for the day, replacing plan.notices],
       objective_coverage: <recomputed with the new library>, warnings}
    """
    ideas = top_up_day_library(course_context, outline, plan, earlier_topics, call)
    if ideas is None:
        return None
    return _topup_event(plan, ideas)


def library_topup_failed_event(plan: Dict, reason: str = "library top-up failed") -> Dict:
    """The day_library payload for a top-up that was abandoned (timed out / crashed): nothing added,
    the day keeps its plan, and the teacher gets the library_ideas_unavailable notice."""
    return _topup_event(plan, {"day_id": plan["day_id"], "topics": [], "blocks": [], "warnings": [reason],
                               "notices": [], "failed": True})


def _topup_event(plan: Dict, ideas: Dict) -> Dict:
    try:
        from services import knowledge_base_service as kb
        cats = kb.get_objective_categories()
    except Exception:  # noqa: BLE001
        cats = None
    merged = apply_library_topup(plan, ideas, cats)
    ev = {"day_id": plan["day_id"], "topped_up": not ideas.get("failed"),
          "topics": list(ideas.get("topics") or []), "blocks": list(ideas.get("blocks") or []),
          "notices": merged["notices"], "warnings": list(ideas.get("warnings") or [])}
    if cats is not None:
        ev["objective_coverage"] = merged["objective_coverage"]
    return ev


def taught_titles(plan: Dict) -> List[str]:
    """Titles of the topics (the day's hour lessons) that have at least one PLACED block. Library-only
    topics are not taught that day, so later days' 'earlier topics' context ignores them."""
    placed_topics = {b["topic_id"] for b in plan["placed"]}
    return [t["title"] for t in plan["topics"] if t["id"] in placed_topics]


def plan_day(course_context: Dict, outline: Dict, day_id: str, earlier_topics: Optional[List[str]] = None,
             call: Optional[Callable] = None, *, library_topup: bool = False) -> Dict:
    """
    Plan one day as `hours_per_day` named one-hour lessons. With library_topup=True the day's library
    is topped up in the same response (single-day route); the plan-days stream leaves it False and
    sends the top-up afterwards.
    Raises ValueError (bad input, incl. a non-whole hours_per_day), DayPlanningError (no valid plan),
    OpenAIServiceError (model service down; propagates).

    The plan: day_id, day_number, title, slots (= hours x 4), block_minutes, hours_per_day,
    hour_minutes, hours [{id, number, title, icon, start_minute, end_minute, capacity_blocks,
    block_ids}], topics (the same hours: {id, title, icon, priority}), placed (all hours' blocks,
    in order), library (every block's topic_id is its home hour), plus coverage / resources / notices.
    """
    ctx, idx, day = _outline_and_context(course_context, outline, day_id)
    fx = build_format_context(ctx["age_min"], ctx["age_max"], ctx["num_students"])
    n, slots = ctx["hours"], ctx["slots"]
    spare = max(3, math.ceil(slots * 0.25))
    prompt = build_day_prompt(
        day_number=idx + 1, num_days=len(outline["days"]), day=day, outline_days=outline["days"],
        earlier_topics=_clean_titles(earlier_topics), age_min=ctx["age_min"], age_max=ctx["age_max"],
        band=fx["band"], num_students=ctx["num_students"], hours_per_day=n, spare=spare,
        formats=fx, categories=fx["categories"],
    )
    valid = {c["id"] for c in fx["categories"]}
    default_obj = next((o for o in day.get("objective_ids") or [] if isinstance(o, str) and o in valid), "")

    def fullness(res):  # blocks that would be placed if no block were flagged (flags are resolved later)
        return len(fill_hours(res["topics"], ignore_review=True)[0])

    def accept(res):
        return res["hour_shape_ok"] and fullness(res) == slots

    def hint_for(res):
        h = ""
        if not res["hour_shape_ok"]:
            h += (f"It must have exactly {n} hour{'s' if n != 1 else ''}, each with a title, an emoji and at least "
                  "one content block. ")
        if fullness(res) < slots:
            h += ("The blocks planned for each hour must add up to exactly 4 blocks of 15 minutes, counting "
                  "every part as a block (split content into 2 parts and activities into 2 to 4 parts). ")
        return h

    res = _run(call, prompt, fx, default_obj, accept, _SYSTEM, hint_for=hint_for, hours=n,
               score=lambda r: (r["hour_shape_ok"], fullness(r), r["n_blocks"]),
               max_tokens=min(12000, max(7000, 1500 + 1100 * n)))
    topics = res["topics"]
    resolve_issues(res, fx, day_title=day.get("title", ""), age_min=ctx["age_min"], age_max=ctx["age_max"],
                   num_students=ctx["num_students"], call=call)
    placed, library, per_hour = fill_hours(topics)
    strip_internal(topics)
    hours = hour_windows(topics, per_hour)
    for w in res["warnings"]:
        logger.info("day %s plan warning: %s", day_id, w)
    plan = {
        "day_id": day_id, "day_number": idx + 1, "title": day.get("title", ""), "slots": slots,
        "block_minutes": BLOCK_MINUTES, "hours_per_day": n, "hour_minutes": HOUR_MINUTES,
        "format_fit_mode": fx["mode"],
        "hours": hours,
        "topics": [_topic_summary(t) for t in topics],
        "placed": placed, "library": library,
        "objective_coverage": objective_coverage(placed, library, fx["categories"]),
        "resource_totals": resource_totals(placed),
        "warnings": res["warnings"],
        "notices": build_notices(res, placed=placed, slots=slots, hours=hours),
    }
    if library_topup:
        ideas = top_up_day_library(course_context, outline, plan, earlier_topics, call)
        plan = apply_library_topup(plan, ideas, fx["categories"])
    return plan


def _sanitise_current(current_topics, fx) -> Dict:
    """Client-sent current day state (placed + library) -> known registry. Raises ValueError."""
    if not isinstance(current_topics, list) or len(current_topics) > 12:
        raise ValueError("current_topics must be a list (max 12 topics)")
    topics, blocks = {}, {}
    for t in current_topics:
        if not isinstance(t, dict) or not isinstance(t.get("id"), str):
            raise ValueError("every current topic needs an id")
        bl = []
        for b in (t.get("blocks") if isinstance(t.get("blocks"), list) else [])[:60]:
            if not isinstance(b, dict) or not isinstance(b.get("id"), str) or b.get("type") not in BLOCK_TYPES:
                raise ValueError("every current block needs an id and a valid type")
            nb = {"id": b["id"][:60], "type": b["type"], "format_id": str(b.get("format_id", ""))[:60],
                  "title": str(b.get("title", ""))[:MAX_TITLE], "part": _int(b.get("part")),
                  "part_count": _int(b.get("part_count")), "topic_id": t["id"],
                  "objective_id": b.get("objective_id") if isinstance(b.get("objective_id"), str) else None}
            blocks[nb["id"]] = nb
            bl.append(nb)
        topics[t["id"]] = {"id": t["id"][:60], "title": str(t.get("title", ""))[:MAX_TITLE],
                           "icon": t.get("icon") if is_single_emoji(t.get("icon")) else DEFAULT_ICONS[0],
                           "priority": t.get("priority") if t.get("priority") in PRIORITIES else "supporting",
                           "blocks": bl}
    return {"topics": topics, "blocks": blocks}


def _assign_home_hours(raw, known: Dict):
    """Library ideas always belong to one of the day's existing hours (no new hours). An idea group
    without a valid hour_id goes to the hour of the block it goes with, else to the hour with the
    fewest blocks. Returns a copy of `raw` with every group's topic_id set to a real hour."""
    if not isinstance(raw, dict):
        return raw
    groups = raw.get("hours") if isinstance(raw.get("hours"), list) else raw.get("topics")
    if not isinstance(groups, list):
        return raw
    counts = {tid: len(t["blocks"]) for tid, t in known["topics"].items()}
    order = list(known["topics"])
    out = []
    for rt in groups:
        if not isinstance(rt, dict):
            out.append(rt)
            continue
        rt = dict(rt)
        given = rt.get("topic_id") if isinstance(rt.get("topic_id"), str) and rt.get("topic_id") else rt.get("hour_id")
        if not (isinstance(given, str) and given in known["topics"]):
            given = None
            for rb in (rt.get("blocks") if isinstance(rt.get("blocks"), list) else []):
                gw = rb.get("goes_with") if isinstance(rb, dict) else None
                if isinstance(gw, str) and gw in known["blocks"]:
                    given = known["blocks"][gw]["topic_id"]
                    break
            if given is None:
                given = min(order, key=lambda t: (counts[t], order.index(t)))
        rt["topic_id"] = given
        counts[given] += len(rt["blocks"]) if isinstance(rt.get("blocks"), list) else 0
        out.append(rt)
    return {**raw, "hours": out, "topics": out}


def more_ideas(course_context: Dict, outline: Dict, day_id: str, current_topics: List[Dict],
               earlier_topics: Optional[List[str]] = None, count: int = 6,
               call: Optional[Callable] = None) -> Dict:
    """
    Extra spare blocks for a day's library. Never placed on the day (the teacher decides).
    Returns {day_id, topics: [new topics], blocks: [new library blocks], warnings}.
    """
    ctx, idx, day = _outline_and_context(course_context, outline, day_id)
    count = max(2, min(int(count), 10))
    fx = build_format_context(ctx["age_min"], ctx["age_max"], ctx["num_students"])
    known = _sanitise_current(current_topics, fx)
    if not known["topics"]:
        raise ValueError("current_topics must list the day's hours so new ideas have an hour to belong to")
    prompt = build_more_ideas_prompt(
        day_number=idx + 1, num_days=len(outline["days"]), day=day, outline_days=outline["days"],
        earlier_topics=_clean_titles(earlier_topics), age_min=ctx["age_min"], age_max=ctx["age_max"],
        band=fx["band"], num_students=ctx["num_students"], formats=fx, categories=fx["categories"],
        current_topics=list(known["topics"].values()), count=count,
    )
    valid = {c["id"] for c in fx["categories"]}
    default_obj = next((o for o in day.get("objective_ids") or [] if isinstance(o, str) and o in valid), "")
    res = _run(call, prompt, fx, default_obj, lambda r: r["n_blocks"] >= 2, _SYSTEM, known=known,
               prepare=lambda raw: _assign_home_hours(raw, known))
    resolve_issues(res, fx, day_title=day.get("title", ""), age_min=ctx["age_min"], age_max=ctx["age_max"],
                   num_students=ctx["num_students"], call=call, known=known)
    blocks = [b for t in res["topics"] for b in t["blocks"]]
    return {
        "day_id": day_id, "block_minutes": BLOCK_MINUTES,
        "topics": [_topic_summary(t) for t in res["topics"] if t["is_new"]],
        "blocks": blocks, "warnings": res["warnings"],
        "notices": build_notices(res),
    }
