"""
Course Builder Stage 1 (backend): three outlines to choose from, conversion of a
chosen outline to the legacy sections shape, and pure-function Edo outline editing.

Nothing here touches Firestore or any server-side state.

Builder outline shape:
  {id, name, description, days: [{id, title, bullets[3], leads_to, objective_ids[]}]}
"""

import copy
import json
import re
import logging
import uuid
from typing import Dict, List, Optional

from outliner.course_outline_prompts import (
    build_three_outlines_prompt,
    build_single_outline_prompt,
    build_edit_outline_prompt,
)
from utils.llm_handler import call_openai

logger = logging.getLogger(__name__)

NUM_OUTLINES = 3
MAX_ATTEMPTS = 2  # first try + one repair retry
MAX_REQUIREMENTS_CHARS = 6000
DAY_FIELDS = ("title", "bullets", "leads_to", "objective_ids")


class OutlineGenerationError(Exception):
    """Model could not produce a valid structure after retries."""


# ---------------------------------------------------------------- knowledge base

def _kb_context(age_min, age_max):
    from services import knowledge_base_service as kb
    band = kb.get_primary_age_band(age_min, age_max) or {}
    categories = kb.get_objective_categories()
    return band, categories


def _build_course(course_inputs: Dict) -> Dict:
    reqs = (course_inputs.get("requirements") or "").strip() or "None"
    if len(reqs) > MAX_REQUIREMENTS_CHARS:
        reqs = reqs[:MAX_REQUIREMENTS_CHARS] + "\n[...truncated]"
    return {
        "course_name": course_inputs.get("course_name", ""),
        "age_min": course_inputs.get("age_min", ""),
        "age_max": course_inputs.get("age_max", ""),
        "num_students": course_inputs.get("num_students", ""),
        "num_days": int(course_inputs.get("num_days") or 1),
        "hours_per_day": course_inputs.get("hours_per_day", ""),
        "requirements": reqs,
    }


# ------------------------------------------------------------------- validation

def _clean_day(raw, valid_ids: set) -> Optional[Dict]:
    """Return a normalised day (without id) or None if it is not valid."""
    if not isinstance(raw, dict):
        return None
    title = raw.get("title")
    leads_to = raw.get("leads_to")
    bullets = raw.get("bullets")
    if not isinstance(title, str) or not title.strip():
        return None
    if not isinstance(leads_to, str) or not leads_to.strip():
        return None
    if not isinstance(bullets, list) or len(bullets) != 3:
        return None
    if not all(isinstance(b, str) and b.strip() for b in bullets):
        return None
    ids = raw.get("objective_ids")
    ids = ids if isinstance(ids, list) else []
    kept, seen = [], set()
    for i in ids:
        if isinstance(i, str) and i in valid_ids and i not in seen:
            kept.append(i)
            seen.add(i)
    return {
        "title": title.strip(),
        "bullets": [b.strip() for b in bullets],
        "leads_to": leads_to.strip(),
        "objective_ids": kept,
    }


def _clean_outline(raw, num_days: int, valid_ids: set) -> Optional[Dict]:
    """Normalised outline (no ids) or None. Never returns a half-valid structure."""
    if not isinstance(raw, dict):
        return None
    name, desc = raw.get("name"), raw.get("description")
    if not isinstance(name, str) or not name.strip() or not isinstance(desc, str) or not desc.strip():
        return None
    days = raw.get("days")
    if not isinstance(days, list) or len(days) != num_days:
        return None
    cleaned = [_clean_day(d, valid_ids) for d in days]
    if any(d is None for d in cleaned):
        return None
    return {"name": name.strip(), "description": desc.strip(), "days": cleaned}


def _stamp_ids(outline: Dict) -> Dict:
    return {
        "id": f"outline_{uuid.uuid4().hex[:8]}",
        "name": outline["name"],
        "description": outline["description"],
        "days": [{"id": f"day_{uuid.uuid4().hex[:8]}", **d} for d in outline["days"]],
    }


def validate_outlines(raw, num_days: int, expected: int, valid_ids: set) -> Optional[List[Dict]]:
    """Return `expected` validated, id-stamped outlines or None."""
    items = raw.get("outlines") if isinstance(raw, dict) else None
    if not isinstance(items, list) or len(items) != expected:
        return None
    cleaned = [_clean_outline(o, num_days, valid_ids) for o in items]
    if any(o is None for o in cleaned):
        return None
    return [_stamp_ids(o) for o in cleaned]


# ------------------------------------------------------------------- generation

def generate_course_outlines(course_inputs: Dict, images: Optional[List[str]] = None) -> List[Dict]:
    """
    course_inputs: course_name, age_min, age_max, num_students, num_days,
    hours_per_day, requirements. Returns 3 outlines (or 1 for a one-day course).
    Raises OutlineGenerationError if no valid structure after retries.
    """
    course = _build_course(course_inputs)
    band, categories = _kb_context(course["age_min"], course["age_max"])
    valid_ids = {c["id"] for c in categories}
    num_days = course["num_days"]
    expected = NUM_OUTLINES if num_days > 1 else 1
    prompt = (build_three_outlines_prompt if num_days > 1 else build_single_outline_prompt)(course, band, categories)

    last_err = "unknown"
    for attempt in range(MAX_ATTEMPTS):
        try:
            raw = call_openai(
                prompt=prompt if attempt == 0 else prompt + (
                    f"\n\nYour previous answer was invalid. Return exactly {expected} outline(s), each with "
                    f"exactly {num_days} day(s), each day with exactly 3 bullets, a title and a leads_to sentence."),
                system_message="You are an expert curriculum designer. Respond with valid JSON only.",
                temperature=0.8 if attempt == 0 else 0.4,
                images=images,
            )
        except (json.JSONDecodeError, ValueError) as e:
            last_err = f"unparseable response: {e}"
            continue
        outlines = validate_outlines(raw, num_days, expected, valid_ids)
        if outlines:
            return outlines
        last_err = "response failed structure validation"
        logger.warning("Outline attempt %d invalid", attempt + 1)
    raise OutlineGenerationError(f"Could not generate valid outlines: {last_err}")


# ------------------------------------------------------------ legacy conversion

def _depth_for(index: int, total: int) -> str:
    # Legacy sections require a depth_ceiling; derive from position in the course.
    third = (index * 3) // max(total, 1)
    return ("Basics", "Intermediate", "Advanced")[min(third, 2)]


def outline_to_legacy(outline: Dict, course_name: str = "", subject: str = "", topic: str = "",
                      age_min=None, age_max=None) -> Dict:
    """Builder outline -> existing outline shape. Each day = one section; the id is
    the day id. New fields (bullets, leads_to, objective_ids) ride along additively."""
    age_range = f"{age_min}–{age_max} years old" if age_min not in (None, "") else ""
    days = outline.get("days", [])
    return {
        "course_title": f"{course_name} - {age_range}" if course_name else age_range,
        "age_range": age_range,
        "subject": subject,
        "topic": topic,
        "sections": [
            {
                "id": d["id"],
                "title": d["title"],
                "description": " ".join(b.rstrip(".") + "." for b in d["bullets"]),
                "depth_ceiling": _depth_for(i, len(days)),
                "subsections": [],
                "bullets": list(d["bullets"]),
                "leads_to": d["leads_to"],
                "objective_ids": list(d["objective_ids"]),
            }
            for i, d in enumerate(days)
        ],
    }


# ------------------------------------------------------------------ Edo editing

def _day_content(d: Dict) -> Dict:
    return {k: d.get(k) for k in DAY_FIELDS}


def diff_changed_day_ids(original: Dict, revised: Dict) -> List[str]:
    """Day ids whose content differs. Days are matched by position (ids are equal)."""
    out = []
    for o, r in zip(original["days"], revised["days"]):
        if _day_content(o) != _day_content(r):
            out.append(o["id"])
    return out


def _validate_revision(raw_outline, original: Dict, valid_ids: set) -> Optional[Dict]:
    """Normalise the model's revised outline against the original. Returns the
    final outline (original ids; byte-identical original days where unchanged)."""
    if not isinstance(raw_outline, dict):
        return None
    days = raw_outline.get("days")
    if not isinstance(days, list) or len(days) != len(original["days"]):
        return None
    # Match the model's days to the originals BY ID, never by position, so content
    # can never land under the wrong day id when the model reorders. Ids must be a
    # permutation of the originals; anything else is rejected (and retried).
    by_id = {}
    for raw in days:
        rid = raw.get("id") if isinstance(raw, dict) else None
        if not isinstance(rid, str) or rid in by_id:
            return None
        by_id[rid] = raw
    if set(by_id) != {d["id"] for d in original["days"]}:
        return None
    final_days = []
    for orig in original["days"]:
        cleaned = _clean_day(by_id[orig["id"]], valid_ids)
        if cleaned is None:
            return None
        if cleaned == _day_content(_normalise_original(orig, valid_ids)):
            final_days.append(copy.deepcopy(orig))  # byte-identical
        else:
            final_days.append({"id": orig["id"], **cleaned})
    name = raw_outline.get("name")
    desc = raw_outline.get("description")
    result = copy.deepcopy(original)
    result["name"] = name.strip() if isinstance(name, str) and name.strip() else original.get("name", "")
    result["description"] = desc.strip() if isinstance(desc, str) and desc.strip() else original.get("description", "")
    result["days"] = final_days
    # keep name/description byte-identical if only whitespace differs
    if result["name"] == str(original.get("name", "")).strip():
        result["name"] = original.get("name", "")
    if result["description"] == str(original.get("description", "")).strip():
        result["description"] = original.get("description", "")
    return result


def _normalise_original(day: Dict, valid_ids: set) -> Dict:
    """Same normalisation applied to a day from the client, for fair comparison."""
    return {
        "title": str(day.get("title", "")).strip(),
        "bullets": [str(b).strip() for b in day.get("bullets", [])],
        "leads_to": str(day.get("leads_to", "")).strip(),
        "objective_ids": [i for i in day.get("objective_ids", []) if i in valid_ids],
    }


# Size caps for client-supplied outline text (routes are unauthenticated JSON bodies).
MAX_DAYS = 60
MAX_MESSAGE_CHARS = 2000
MAX_TEXT_CHARS = 600       # any single title / bullet / leads_to / name / description
MAX_OBJECTIVE_IDS = 20


def check_day_shape(d, require_ids: bool = True) -> None:
    """Raise ValueError unless d is a well-formed builder day (types, not content)."""
    if not isinstance(d, dict):
        raise ValueError("every day must be an object")
    if not isinstance(d.get("id"), str) or not d["id"].strip():
        raise ValueError("every day must have a string 'id'")
    for k in ("title", "leads_to"):
        if not isinstance(d.get(k), str):
            raise ValueError(f"day '{d['id']}': '{k}' must be a string")
    b = d.get("bullets")
    if not isinstance(b, list) or not all(isinstance(x, str) for x in b):
        raise ValueError(f"day '{d['id']}': 'bullets' must be a list of strings")
    o = d.get("objective_ids", [])
    if not isinstance(o, list) or not all(isinstance(x, str) for x in o):
        raise ValueError(f"day '{d['id']}': 'objective_ids' must be a list of strings")


def check_outline_limits(outline) -> None:
    """Raise ValueError if the outline is oversized (defensive cap on request size)."""
    days = outline.get("days") if isinstance(outline, dict) else None
    if not isinstance(days, list):
        raise ValueError("outline.days must be a list")
    if len(days) > MAX_DAYS:
        raise ValueError(f"outline has more than {MAX_DAYS} days")
    texts = [outline.get("name"), outline.get("description")]
    for d in days:
        if isinstance(d, dict):
            texts += [d.get("title"), d.get("leads_to")] + (d.get("bullets") if isinstance(d.get("bullets"), list) else [])
            if isinstance(d.get("objective_ids"), list) and len(d["objective_ids"]) > MAX_OBJECTIVE_IDS:
                raise ValueError("too many objective_ids on a day")
            if isinstance(d.get("bullets"), list) and len(d["bullets"]) > 10:
                raise ValueError("too many bullets on a day")
    if any(isinstance(t, str) and len(t) > MAX_TEXT_CHARS for t in texts):
        raise ValueError(f"outline text fields are limited to {MAX_TEXT_CHARS} characters")


def _check_input_outline(outline) -> None:
    if not isinstance(outline, dict) or not isinstance(outline.get("days"), list) or not outline["days"]:
        raise ValueError("outline must have a non-empty 'days' list")
    check_outline_limits(outline)
    for d in outline["days"]:
        check_day_shape(d)
    if len({d["id"] for d in outline["days"]}) != len(outline["days"]):
        raise ValueError("day ids must be unique")


_FIELD_LABELS = {"title": "new title", "bullets": "bullets", "leads_to": "the 'leads to' line",
                 "objective_ids": "learning goals"}
_FIELD_PLURAL = {"title": "new titles", "bullets": "bullets", "leads_to": "'leads to' lines",
                 "objective_ids": "learning goals"}
SUMMARY_MAX_CHARS = 120


def _changed_fields(o: Dict, r: Dict) -> List[str]:
    """Field keys that differ between two (already normalised) versions of a day."""
    return [k for k in DAY_FIELDS if o.get(k) != r.get(k)]


def _field_changes(o: Dict, r: Dict) -> List[str]:
    """Teacher-facing phrases for the fields that differ between two versions of a day.
    Callers pass the NORMALISED original so this matches diff_changed_day_ids."""
    out = []
    for k in _changed_fields(o, r):
        if k == "bullets":
            ob, rb = list(o.get("bullets") or []), list(r.get("bullets") or [])
            nb = sum(1 for i in range(max(len(ob), len(rb)))
                     if (ob[i] if i < len(ob) else None) != (rb[i] if i < len(rb) else None))
            out.append("1 bullet" if nb == 1 else f"{nb} bullets")
        else:
            out.append(_FIELD_LABELS[k])
    return out


def _join(items: List[str]) -> str:
    return items[0] if len(items) == 1 else ", ".join(items[:-1]) + " and " + items[-1]


def _day_ranges(nums: List[int]) -> List[str]:
    """[1,2,3,5] -> ['1\u20133', '5'] (en dash for consecutive runs)."""
    out, i = [], 0
    while i < len(nums):
        j = i
        while j + 1 < len(nums) and nums[j + 1] == nums[j] + 1:
            j += 1
        out.append(str(nums[i]) if i == j else f"{nums[i]}\u2013{nums[j]}")
        i = j + 1
    return out


def build_change_summary(original: Dict, revised: Dict, changed_ids: List[str],
                         valid_ids: Optional[set] = None) -> str:
    """Code-built statement of what changed (days by position, fields by diff).
    Short: per-field detail for 1-2 days, ranges + common fields for 3+."""
    rows = []  # (position, normalised original, revised)
    for i, (o, r) in enumerate(zip(original["days"], revised["days"]), start=1):
        if o["id"] in changed_ids:
            no = _normalise_original(o, valid_ids) if valid_ids is not None else {
                **_day_content(o), "title": str(o.get("title", "")).strip(),
                "bullets": [str(x).strip() for x in o.get("bullets", [])],
                "leads_to": str(o.get("leads_to", "")).strip()}
            rows.append((i, no, _day_content(r)))
    if not rows:
        return "I did not change anything."
    nums = [i for i, _, _ in rows]
    label = "Day" if len(nums) == 1 else "Days"
    names = f"{label} {_join(_day_ranges(nums))}"
    candidates = []
    if len(rows) <= 2:
        parts = []
        for i, o, r in rows:
            f = _field_changes(o, r)
            parts.append(f"Day {i} ({_join(f)})" if f else f"Day {i}")
        candidates.append(f"I changed {_join(parts)}.")
    else:
        sets = [set(_changed_fields(o, r)) for _, o, r in rows]
        common = [k for k in DAY_FIELDS if all(k in st for st in sets)]
        if common:
            candidates.append(f"I changed {names}: {_join([_FIELD_PLURAL[k] for k in common])}.")
    candidates.append(f"I changed {names}.")
    for c in candidates:
        if len(c) <= SUMMARY_MAX_CHARS:
            return c
    return f"I changed {len(rows)} of {len(original['days'])} days; see the Changed by Edo badges."


# --- the model's sentence: an ALLOW-list. The code summary is the source of truth, so
# anything that could claim/describe a change, locate a day, or isn't plain English is dropped.
_CLAIM = re.compile(
    r"\b(chang|updat|adjust|revis|replac|swap|rewr|rewrot|renam|add|remov|reword|tweak|edit|modif|merg|"
    r"combin|shorten|lengthen|rework|redesign|reorder|reorgani|restructur|mov|split|trim|cut|drop|"
    r"extend|expand|reduc|increas|swapp|switch|shift|fix|improv|refin|polish|updat|creat|delet|"
    r"insert|appl|keep|kept|leav|left|unchang|touch|rebuil|rewrit|tighten|simplif|reduc|"
    r"instead|rather|previous|original|formerly|no longer|used to|now|already|also|have been|has been|"
    r"was|were|been)\w*", re.I)
_POSITION = re.compile(
    r"\b(days?|lessons?|sessions?|weeks?|weekdays?|weekends?|months?|today|tomorrow|yesterday|tonight|"
    r"mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday|"
    r"mornings?|afternoons?|evenings?|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|"
    r"last|final|next|later|earlier|other|remaining|every|each|all|both|throughout|"
    r"consisten\w*|one|two|three|four|five|six|seven|eight|nine|ten|begin\w*|start\w*|end\w*|"
    r"opening|closing|sections?|modules?|units?|blocks?|parts?|steps?|phases?|stages?|d\d+)\b", re.I)
_REASON_OPENER = re.compile(r"^(because|to|since|so that|in order to|this (way|keeps|makes|helps|fits|suits|is)|"
                            r"it (is|keeps|makes|helps|fits|suits)|these|they)\b", re.I)
_ENGLISH_WORDS = {"the", "a", "an", "is", "are", "and", "for", "to", "of", "with", "this", "that", "it",
                  "in", "on", "at", "by", "more", "less", "easier", "cheaper", "simpler", "better",
                  "fits", "suits", "helps", "makes", "keeps", "they", "these", "because", "since", "so"}
MAX_REASON_CHARS = 140


def _is_plain_english(sent: str) -> bool:
    if not sent.isascii() or re.search(r"\d", sent):
        return False
    words = re.findall(r"[a-z']+", sent.lower())
    return len(words) >= 3 and any(w in _ENGLISH_WORDS for w in words)


def _model_sentence(reply, nothing_changed: bool = False) -> str:
    """At most one short sentence that only gives a reason/approach. When in doubt, drop it."""
    if not isinstance(reply, str):
        return ""
    seen = set()
    for sent in re.split(r"(?<=[.!?])\s+", re.sub(r"\s+", " ", reply).strip()):
        key = sent.lower().rstrip(".!?")
        if not sent or key in seen:
            continue
        seen.add(key)
        if (len(sent) > MAX_REASON_CHARS or sent.endswith("?") or re.search(r"\bI\b|\bI'|\bwe\b", sent, re.I)
                or _CLAIM.search(sent) or _POSITION.search(sent) or not _is_plain_english(sent)):
            continue
        return sent
    return ""


def build_reply(model_reply, original: Dict, revised: Dict, changed_ids: List[str],
                valid_ids: Optional[set] = None) -> str:
    summary = build_change_summary(original, revised, changed_ids, valid_ids)
    why = _model_sentence(model_reply, not changed_ids)
    return f"{summary} {why}".strip() if not changed_ids else f"{why} {summary}".strip()


def edit_outline(outline: Dict, message: str, course_inputs: Dict,
                 conversation_history: Optional[List[Dict]] = None) -> Dict:
    """
    Pure function: (outline, message, course) -> {reply, outline, changed_day_ids}.
    Raises ValueError for bad input, OutlineGenerationError if the model cannot
    produce a valid revision.
    """
    _check_input_outline(outline)
    if not (message or "").strip():
        raise ValueError("message is empty")
    if len(message) > MAX_MESSAGE_CHARS:
        raise ValueError(f"message is limited to {MAX_MESSAGE_CHARS} characters")
    course_inputs = dict(course_inputs or {})
    course_inputs["num_days"] = len(outline["days"])  # the days in hand are the truth
    course = _build_course(course_inputs)
    band, categories = _kb_context(course["age_min"], course["age_max"])
    valid_ids = {c["id"] for c in categories}

    history_text = ""
    if conversation_history:
        lines = [f"{(m.get('role') or 'user').upper()}: {m.get('content', '')}" for m in conversation_history[-8:]]
        history_text = "RECENT CONVERSATION\n" + "\n".join(lines) + "\n\n"

    prompt = build_edit_outline_prompt(
        course, band, categories,
        json.dumps({k: outline.get(k) for k in ("name", "description")} |
                   {"days": [{"id": d["id"], **_day_content(d)} for d in outline["days"]]}, indent=2),
        history_text, message.strip(),
    )

    last_err = "unknown"
    for attempt in range(MAX_ATTEMPTS):
        try:
            raw = call_openai(
                prompt=prompt if attempt == 0 else prompt + "\n\nYour previous answer was invalid. Keep the same "
                    "number of days and ids; every day needs exactly 3 bullets, a title and a leads_to.",
                system_message="You are Edo, a careful curriculum assistant. Respond with valid JSON only.",
                temperature=0.4,
            )
        except (json.JSONDecodeError, ValueError) as e:
            last_err = f"unparseable response: {e}"
            continue
        revised = _validate_revision((raw or {}).get("outline"), outline, valid_ids) if isinstance(raw, dict) else None
        if revised is None:
            last_err = "revision failed structure validation"
            continue
        reply = raw.get("reply")
        changed = diff_changed_day_ids(outline, revised)
        reply = build_reply(reply, outline, revised, changed, valid_ids)
        return {"reply": reply, "outline": revised, "changed_day_ids": changed}
    raise OutlineGenerationError(f"Could not revise the outline: {last_err}")
