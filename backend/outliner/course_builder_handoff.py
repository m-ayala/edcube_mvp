"""
Course Builder hand-off: the teacher's finalized day plans -> the existing block-content
generation + save pipeline (POST /api/generate-blocks logic), without changing its shape.

Mapping onto the existing hierarchy (no fifth level):
  day            -> Section   (id = the day id from the outline; bullets/leads_to/objective_ids
                               ride along; plus day_schedule = the teacher's exact block order)
  hour           -> Subsection (id = hour id, title = the lesson's title, plus hour_number,
                               start_minute, end_minute, duration_minutes 60 and the emoji as `icon`;
                               one per hour the teacher sent, empty hours included so the day keeps
                               its length)
  block          -> Block     (id = block id; 15 minutes; in the hour the teacher placed it in; new
                               fields kept on the block)

Hours are subsections because block-content generation expands one subsection per LLM call and a
worksheet must be generated alongside the content it tests. The day order is the hours in order,
each hour's blocks in the teacher's order; it lives in section.day_schedule (and block.day_position).
A request without `hours` (older frontend) is accepted: blocks are cut into hours four at a time in
the placed order.

Pure functions only; no Firestore.
"""

import logging
import re
from typing import Dict, List, Optional, Tuple

from outliner.course_day_planner import (
    ACTIVITY, BLOCK_MINUTES, BLOCK_TYPES, CONTENT, MAX_DESC, MAX_TITLE, PART_LIMITS, PRIORITIES,
    WORKSHEET, _clean_resources, _int, is_single_emoji, slots_for_hours, whole_hours, DEFAULT_ICONS,
    BLOCKS_PER_HOUR, HOUR_MINUTES,
)

logger = logging.getLogger(__name__)

MAX_DAYS = 60
MAX_BLOCKS_PER_DAY = 100  # sanity cap before the hard cap is even computed
MAX_ID = 80
MAX_REVIEW_NOTE = 400


class PlanRejected(Exception):
    """The submitted plan is invalid. `.problems` = [{day_id, code, message}]."""

    def __init__(self, problems: List[Dict]):
        self.problems = problems
        super().__init__("; ".join(p["message"] for p in problems[:3]))


def _kb_maps() -> Dict:
    from services import knowledge_base_service as kb
    ws = kb.get_worksheet_formats_for()
    act = kb.get_activity_formats_for()
    ct = kb.get_content_types()

    def subtype(f):  # keep the legacy subtype string where one exists, so old UIs still render it
        legacy = f.get("legacy_labels") or []
        return legacy[0] if legacy else f.get("label", f["id"])

    return {
        "ids": {CONTENT: {c["id"]: c.get("label", c["id"]) for c in ct},
                WORKSHEET: {f["id"]: subtype(f) for f in ws},
                ACTIVITY: {f["id"]: subtype(f) for f in act}},
        "labels": {CONTENT: {c["id"]: c.get("label", c["id"]) for c in ct},
                   WORKSHEET: {f["id"]: f.get("label", f["id"]) for f in ws},
                   ACTIVITY: {f["id"]: f.get("label", f["id"]) for f in act}},
        "objectives": {c["id"]: c for c in kb.get_objective_categories()},
    }


def _str(v, limit) -> Optional[str]:
    return v.strip()[:limit] if isinstance(v, str) and v.strip() else None


# ------------------------------------------------------------------------ validation

def _clock(minute: int) -> str:
    return f"{minute // 60}:{minute % 60:02d}"


def hour_label(number: int, start_minute: int, end_minute: int) -> str:
    """"Hour 2 · 1:00–2:00": how the classic workspace shows an hour's time window. The frontend
    (utils/builderCourse.js withHourTime) writes this same label at the start of the subsection's
    description at load; saving it here from the start keeps the first autosave identical."""
    return f"Hour {number} · {_clock(start_minute)}–{_clock(end_minute)}"


def _hour_entry(number: int, hid: str, topic: Dict, ids: List[str]) -> Dict:
    return {"id": hid, "number": number, "title": topic["title"], "icon": topic["icon"],
            "priority": topic["priority"], "block_ids": list(ids),
            "start_minute": (number - 1) * HOUR_MINUTES, "end_minute": number * HOUR_MINUTES}


def _assemble_hours(did: str, hours_in, topics: Dict, day_blocks: List[Dict], blocks_in: List[Dict],
                    taken_ids: set, problems: List[Dict], notes: List[Dict],
                    n_hours: Optional[int] = None, day_number: Optional[int] = None) -> Optional[List[Dict]]:
    """
    The day's hours: from the teacher's `hours` arrangement (checked: ids belong to the day, every
    placed block appears in exactly one hour) or, for a request without it, derived by cutting the
    placed order into hours of four. Reorders `day_blocks` in place into hour order, points each block's
    topic_id/icon at the hour it sits in and renumbers day_position. Returns None (with problems
    recorded) when the arrangement is invalid; nothing is ever trimmed.
    """
    by_id = {b["id"]: b for b in day_blocks}
    if hours_in is None:
        out = []
        for k, start in enumerate(range(0, len(day_blocks), BLOCKS_PER_HOUR), start=1):
            chunk = day_blocks[start:start + BLOCKS_PER_HOUR]
            counts: Dict[str, int] = {}
            for b in chunk:
                counts[b["topic_id"]] = counts.get(b["topic_id"], 0) + 1
            home = max(counts, key=lambda t: (counts[t], -next(i for i, b in enumerate(chunk) if b["topic_id"] == t)))
            hid = f"{did}_hour_{k}"
            while hid in taken_ids or hid in topics:
                hid += "_x"
            taken_ids.add(hid)
            topics[hid] = {**topics[home], "id": hid}
            out.append(_hour_entry(k, hid, topics[hid], [b["id"] for b in chunk]))
        if out:
            notes.append({"day_id": did, "code": "hours_derived",
                          "message": "This plan did not say which hour each block is in, so the blocks were grouped "
                                     f"{BLOCKS_PER_HOUR} at a time in their order."})
    else:
        before = len(problems)
        out, used, seen_h = [], set(), set()
        if n_hours is not None and len(hours_in) < n_hours:
            who = f"Day {day_number}" if day_number else f"Day '{did}'"
            problems.append({"day_id": did, "code": "hour_missing",
                             "message": f"{who} should have {n_hours} {'hour' if n_hours == 1 else 'hours'} "
                                        f"but only {len(hours_in)} {'was' if len(hours_in) == 1 else 'were'} sent."})
        for k, h in enumerate(hours_in, start=1):
            hid = _str(h.get("id") if isinstance(h, dict) else None, MAX_ID)
            ids = h.get("block_ids") if isinstance(h, dict) else None
            if not hid or not isinstance(ids, list) or not all(isinstance(i, str) for i in ids):
                problems.append({"day_id": did, "code": "bad_hour", "message": f"Hour {k} needs an id and a list of block ids"})
                continue
            if hid not in topics:
                problems.append({"day_id": did, "code": "unknown_hour", "message": f"Hour {k} ('{hid}') is not one of this day's hours"})
                continue
            if hid in seen_h:
                problems.append({"day_id": did, "code": "duplicate_hour", "message": f"hour '{hid}' appears twice"})
                continue
            seen_h.add(hid)
            for i in ids:
                if i not in by_id:
                    problems.append({"day_id": did, "code": "hour_unknown_block",
                                     "message": f"Hour {k} lists a block ('{i}') that is not among this day's blocks"})
                elif i in used:
                    problems.append({"day_id": did, "code": "hour_block_duplicate",
                                     "message": f"'{by_id[i]['title']}' is in more than one hour"})
                else:
                    used.add(i)
            out.append(_hour_entry(k, hid, topics[hid], ids))
        for b in day_blocks:
            if b["id"] not in used:
                problems.append({"day_id": did, "code": "hour_block_missing",
                                 "message": f"'{b['title']}' is on the day but not in any hour"})
        if len(problems) > before:
            return None
    order = [i for h in out for i in h["block_ids"]]
    hour_of = {i: h for h in out for i in h["block_ids"]}
    day_blocks[:] = [by_id[i] for i in order]
    for pos, b in enumerate(day_blocks):
        h = hour_of[b["id"]]
        b["topic_id"], b["icon"], b["day_position"] = h["id"], h["icon"], pos
    return out

def validate_plan(hours_per_day, outline: Dict, plan_days: List[Dict]) -> Tuple[List[Dict], List[str]]:
    """Same as validate_plan_with_notes, but the notes are plain strings (unchanged contract)."""
    days, notes = validate_plan_with_notes(hours_per_day, outline, plan_days)
    return days, [n["message"] for n in notes]


def validate_plan_with_notes(hours_per_day, outline: Dict, plan_days: List[Dict]) -> Tuple[List[Dict], List[Dict]]:
    """
    Validate the finalized plan. Returns (normalised days, notes). Raises PlanRejected with
    every problem found. Nothing the teacher placed is ever dropped: a bad plan is rejected,
    never trimmed. The hard caps are enforced here: blocks <= hours_per_day x 4 per day and, when the
    day sends its `hours` arrangement, <= 4 blocks per hour (code `hour_over_capacity`).
    Raises ValueError for a non-whole hours_per_day (Course Builder time is whole hours only).

    Each returned day has `hours`: [{id, number, title, icon, priority, block_ids, start_minute,
    end_minute}] and `blocks` in the order of those hours, each with topic_id = the hour it sits in.
    """
    n_hours = whole_hours(hours_per_day)
    slots = n_hours * BLOCKS_PER_HOUR
    kbm = _kb_maps()
    problems, notes = [], []  # notes: [{day_id, code, message}], non-fatal
    outline_ids = [d["id"] for d in outline["days"]]
    if not isinstance(plan_days, list) or len(plan_days) > MAX_DAYS:
        raise PlanRejected([{"day_id": None, "code": "bad_plan", "message": "days must be a list"}])

    seen_days, seen_blocks, seen_topics = set(), set(), set()
    out_days = []
    for pd in plan_days:
        did = pd.get("day_id") if isinstance(pd, dict) else None
        if did not in outline_ids:
            problems.append({"day_id": did, "code": "unknown_day", "message": f"day '{did}' is not in the outline"})
            continue
        if did in seen_days:
            problems.append({"day_id": did, "code": "duplicate_day", "message": f"day '{did}' appears twice"})
            continue
        seen_days.add(did)
        blocks_in = pd.get("blocks") if isinstance(pd.get("blocks"), list) else None
        topics_in = pd.get("topics") if isinstance(pd.get("topics"), list) else None
        hours_in = pd.get("hours")
        if blocks_in is None or topics_in is None or (hours_in is not None and not isinstance(hours_in, list)):
            problems.append({"day_id": did, "code": "bad_day", "message": f"day '{did}' needs 'topics' and 'blocks' lists"})
            continue
        if len(blocks_in) > MAX_BLOCKS_PER_DAY or len(topics_in) > 20 or (hours_in is not None and len(hours_in) > 40):
            problems.append({"day_id": did, "code": "too_large", "message": f"day '{did}' is too large"})
            continue
        # ---- hard caps: each hour, then the day
        cap_problems = len(problems)
        if hours_in is not None:
            for k, h in enumerate(hours_in, start=1):
                ids = h.get("block_ids") if isinstance(h, dict) else None
                if isinstance(ids, list) and len(ids) > BLOCKS_PER_HOUR:
                    problems.append({
                        "day_id": did, "code": "hour_over_capacity", "hour_id": h.get("id"), "hour_number": k,
                        "message": f"Hour {k} holds {len(ids)} blocks ({len(ids) * BLOCK_MINUTES} min) but an hour "
                                   f"fits {BLOCKS_PER_HOUR} ({HOUR_MINUTES} min). Move {len(ids) - BLOCKS_PER_HOUR} "
                                   "block(s) to another hour.",
                        "blocks": len(ids), "capacity_blocks": BLOCKS_PER_HOUR,
                    })
            if len(hours_in) > n_hours:
                problems.append({
                    "day_id": did, "code": "too_many_hours",
                    "message": f"day has {len(hours_in)} hours but only {n_hours} fit in {n_hours} hours of teaching time.",
                    "hours": len(hours_in), "capacity_hours": n_hours,
                })
        if len(blocks_in) > slots:
            problems.append({
                "day_id": did, "code": "over_capacity",
                "message": f"day has {len(blocks_in)} blocks ({len(blocks_in) * BLOCK_MINUTES} min) but only "
                           f"{slots} fit in {n_hours} hours of teaching time. Remove "
                           f"{len(blocks_in) - slots} block(s).",
                "blocks": len(blocks_in), "slots": slots,
            })
        if len(problems) > cap_problems:
            continue

        topics = {}
        for t in topics_in:
            tid = _str(t.get("id") if isinstance(t, dict) else None, MAX_ID)
            title = _str(t.get("title") if isinstance(t, dict) else None, MAX_TITLE)
            if not tid or not title:
                problems.append({"day_id": did, "code": "bad_topic", "message": "every topic needs an id and a title"})
                continue
            if tid in seen_topics or tid in topics:
                problems.append({"day_id": did, "code": "duplicate_topic", "message": f"topic id '{tid}' is used twice"})
                continue
            topics[tid] = {"id": tid, "title": title,
                           "icon": t["icon"].strip() if is_single_emoji(t.get("icon")) else DEFAULT_ICONS[0],
                           "priority": t.get("priority") if t.get("priority") in PRIORITIES else "supporting"}
        seen_topics.update(topics)

        day_blocks = []
        for pos, b in enumerate(blocks_in):
            where = f"block {pos + 1}"
            if not isinstance(b, dict):
                problems.append({"day_id": did, "code": "bad_block", "message": f"{where} is not an object"})
                continue
            bid, btype = _str(b.get("id"), MAX_ID), b.get("type")
            title = _str(b.get("title"), MAX_TITLE)
            if not bid or btype not in BLOCK_TYPES or not title:
                problems.append({"day_id": did, "code": "bad_block", "message": f"{where} needs id, type and title"})
                continue
            if bid in seen_blocks:
                problems.append({"day_id": did, "code": "duplicate_block_id", "message": f"block id '{bid}' is used twice"})
                continue
            seen_blocks.add(bid)
            if b.get("topic_id") not in topics:
                problems.append({"day_id": did, "code": "unknown_topic", "message": f"'{title}' belongs to a topic that is not in this day's topics"})
                continue
            fid = b.get("format_id")
            if fid not in kbm["ids"][btype]:
                problems.append({"day_id": did, "code": "unknown_format", "message": f"'{title}': unknown {btype} format {fid!r}"})
                continue
            if b.get("objective_id") not in kbm["objectives"]:
                problems.append({"day_id": did, "code": "unknown_objective", "message": f"'{title}': unknown objective category {b.get('objective_id')!r}"})
                continue
            gs = b.get("group_size")
            day_blocks.append({
                "id": bid, "topic_id": b["topic_id"], "type": btype, "format_id": fid,
                "format_label": kbm["labels"][btype][fid], "subtype": kbm["ids"][btype][fid],
                "title": title, "description": _str(b.get("description"), MAX_DESC) or title,
                "part": _int(b.get("part")), "part_count": _int(b.get("part_count")),
                "part_group_id": _str(b.get("part_group_id"), MAX_ID) or f"grp_{bid}",
                "goes_with": _str(b.get("goes_with"), MAX_ID), "objective_id": b["objective_id"],
                "group_size": gs if (btype == ACTIVITY and isinstance(gs, str)) else None,
                "resources": _clean_resources(b.get("resources")) if btype != CONTENT else [],
                "is_revision": b.get("is_revision") is True,
                # a flag the teacher left on a block they placed stays; a resolved flag (false / empty) stays cleared
                "needs_review": b.get("needs_review") is True,
                "review_note": (_str(b.get("review_note"), MAX_REVIEW_NOTE) or "") if b.get("needs_review") is True else "",
                "icon": topics[b["topic_id"]]["icon"],
                "duration_minutes": BLOCK_MINUTES, "day_position": pos,
            })
        hours_out = _assemble_hours(did, hours_in, topics, day_blocks, blocks_in, seen_topics, problems, notes,
                                   n_hours=n_hours, day_number=outline_ids.index(did) + 1)
        if hours_out is None:
            continue
        out_days.append({"day_id": did, "topics": topics, "blocks": day_blocks, "hours": hours_out})

    if problems:
        raise PlanRejected(problems)

    # ---- consistency fixes that never remove a block
    for d in out_days:
        ids = {b["id"] for b in d["blocks"]}
        by_id = {b["id"]: b for b in d["blocks"]}
        groups: Dict[str, List[Dict]] = {}
        for b in d["blocks"]:
            groups.setdefault(b["part_group_id"], []).append(b)
        for gid, parts in groups.items():
            parts.sort(key=lambda b: (b["part"], b["day_position"]))
            before = [(b["part"], b["part_count"]) for b in parts]
            for i, b in enumerate(parts):
                b["part"], b["part_count"] = i + 1, len(parts)
            if before != [(b["part"], b["part_count"]) for b in parts]:
                notes.append({"day_id": d["day_id"], "code": "parts_renumbered",
                              "message": f"Only {len(parts)} part(s) of '{parts[0]['title']}' are on this day, so the "
                                         f"part numbers were updated to 1 of {len(parts)}."})
            if len(parts) > PART_LIMITS[parts[0]["type"]]:
                notes.append({"day_id": d["day_id"], "code": "too_many_parts",
                              "message": f"'{parts[0]['title']}' has {len(parts)} parts"})
        for b in d["blocks"]:
            if b["type"] == CONTENT:
                b["goes_with"] = None
            elif b["goes_with"] is not None and (b["goes_with"] not in ids or b["goes_with"] == b["id"]):
                notes.append({"day_id": d["day_id"], "code": "goes_with_cleared",
                              "message": f"'{b['title']}' no longer has the block it went with, so it now stands on its own."})
                b["goes_with"] = None
        # source blocks for worksheets = every placed part of the content block they go with
        for b in d["blocks"]:
            b["source_block_ids"] = []
            if b["type"] == WORKSHEET and b["goes_with"]:
                tgt = by_id[b["goes_with"]]
                if tgt["type"] == CONTENT:
                    b["source_block_ids"] = [p["id"] for p in groups[tgt["part_group_id"]]]
    return out_days, notes


# ---------------------------------------------------------------- conversion

_SPEC_KEYS = ("id", "type", "subtype", "title", "description", "format_id", "format_label", "topic_id", "icon",
              "part", "part_count", "part_group_id", "goes_with", "objective_id", "group_size", "resources",
              "is_revision", "needs_review", "review_note", "duration_minutes", "day_position")


def to_generation_inputs(legacy_outline: Dict, days: List[Dict], plan_by_day_meta: Dict) -> Tuple[Dict, List[Dict]]:
    """
    legacy_outline: outline_to_legacy() output (sections = days, subsections empty).
    days: validate_plan() output. Returns (outline with day_schedule etc. on sections,
    selections as plain dicts shaped like SubsectionSelection).
    """
    sections = {s["id"]: s for s in legacy_outline["sections"]}
    selections = []
    for d in days:
        section = sections[d["day_id"]]
        section["day_schedule"] = [b["id"] for b in d["blocks"]]
        section["slots"] = plan_by_day_meta["slots"]
        section["block_minutes"] = BLOCK_MINUTES
        section["day_topics"] = [{"id": h["id"], "title": h["title"], "icon": h["icon"], "priority": h["priority"]}
                                 for h in d["hours"]]
        by_id = {b["id"]: b for b in d["blocks"]}
        prev = None
        for h in d["hours"]:
            blocks = [by_id[i] for i in h["block_ids"]]
            specs = []
            for b in blocks:
                spec = {k: b[k] for k in _SPEC_KEYS}
                if b["type"] == WORKSHEET:
                    spec["source_block_ids"] = list(b["source_block_ids"])
                specs.append(spec)
            titles = []
            for b in blocks:
                if b["title"] not in titles:
                    titles.append(b["title"])
            label = hour_label(h["number"], h["start_minute"], h["end_minute"])
            selections.append({
                "subsectionId": h["id"], "sectionId": d["day_id"], "sectionTitle": section["title"],
                "title": h["title"], "description": (f"{label}. {'; '.join(titles)}" if titles else label)[:400],
                "coreConcept": h["title"],
                "depthLevel": "Basics", "prerequisiteSubsectionId": prev, "chainId": d["day_id"],
                "durationMinutes": HOUR_MINUTES,
                "learningObjectives": list(section.get("bullets") or []),
                "blocks": specs, "included": True, "excludedBlockIds": [],
                "blockMinutes": BLOCK_MINUTES,
                "extra": {"icon": h["icon"], "priority": h["priority"], "topic_id": h["id"],
                          "source": "course_builder", "hour_number": h["number"],
                          "start_minute": h["start_minute"], "end_minute": h["end_minute"]},
            })
            prev = h["id"]
    return legacy_outline, selections


# ---------------------------------------------------------- Phase 2 post-processing

def finalize_builder_blocks(blocks: List[Dict], specs: List[Dict], sub_id: str,
                            block_minutes: int = BLOCK_MINUTES) -> List[Dict]:
    """
    Called by the orchestrator after a Course Builder subsection is expanded:
    - every spec gets exactly one block, in the teacher's order (matched by id)
    - a block the model dropped or failed to write becomes a visible empty stub (never lost)
    - the plan's fields are re-attached to each block (the model only echoes a few)
    - duration is block_minutes for every block
    """
    by_id = {b.get("id"): b for b in blocks if isinstance(b, dict)}
    out = []
    for spec in specs:
        b = by_id.get(spec.get("id"))
        if b is None:
            b = {"id": spec.get("id"), "type": spec.get("type"), "subtype": spec.get("subtype"),
                 "title": spec.get("title"), "content": "", "generation_failed": True, "addedAt": None}
        for k in _SPEC_KEYS + ("source_block_ids",):
            if k in spec:
                b[k] = spec[k]  # the teacher's plan is authoritative, including id/type/subtype/title
        b["duration_minutes"] = block_minutes
        out.append(b)
    if len(out) > 1:
        for b in out:
            b["groupId"] = f"group-{sub_id}"
    return out


def embed_blocks_in_sections(sections: List[Dict], blocks_by_subsection: Dict[str, List[Dict]]) -> None:
    """
    Write each topic's generated blocks into the saved sections exactly as the workspace's first
    autosave would (frontend utils/builderCourse.js builderSectionForSave): per-topic content_blocks /
    worksheets / activities (whole block objects, ordered by the day's day_schedule) plus
    video_resources. This way a freshly built document is already "autosaved" and readers that
    only see the sections (a colleague opening a shared course) get every block. Mutates `sections`
    in place; only sections carrying a day_schedule (Course Builder days) are touched. The caller
    keeps writing top-level handsOnResources as before.
    """
    for section in sections:
        schedule = section.get("day_schedule")
        if not isinstance(schedule, list):
            continue
        pos = {bid: i for i, bid in enumerate(schedule)}
        for sub in section.get("subsections") or []:
            blocks = list(blocks_by_subsection.get(sub.get("id")) or [])
            # same stable sort as the frontend's sortBySchedule (unscheduled blocks keep order, after)
            ranked = sorted(enumerate(blocks), key=lambda ib: pos.get(ib[1].get("id"), len(schedule) + ib[0]))
            ordered = [b for _, b in ranked]
            sub["description"] = sub.get("description") or ""
            sub["learning_objectives"] = sub.get("learning_objectives") or []
            if sub.get("duration_minutes") is None:
                sub["duration_minutes"] = 20
            sub["content_blocks"] = [b for b in ordered if b.get("type") == "content"]
            sub["worksheets"] = [b for b in ordered if b.get("type") == "worksheet"]
            sub["activities"] = [b for b in ordered if b.get("type") == "activity"]
            sub["video_resources"] = sub.get("video_resources") or []
