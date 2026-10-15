"""
Course Builder Stage 2 prompts (see tasks/course-builder-spec.md, Prompt 2).

Everything in braces is filled in by code from the knowledge base or the approved
outline. No pedagogy is typed here. Formats carry a fit note ("good fit" /
"limited fit") instead of being silently removed, so the model can see why a
format is a poorer choice for this class.
"""

from typing import Dict, List, Optional


def _course_lines(outline_days: List[Dict]) -> str:
    out = []
    for i, d in enumerate(outline_days, start=1):
        out.append(f"Day {i}: {d.get('title', '')}")
        for b in d.get("bullets", []):
            out.append(f"  - {b}")
        out.append(f"  Leads to: {d.get('leads_to', '')}")
    return "\n".join(out)


def _objective_lines(categories: List[Dict]) -> str:
    return "\n".join(f"- {c['id']} — {c.get('label', c['id'])} — {c.get('description', '')}" for c in categories)


def _fit_suffix(f: Dict) -> str:
    return " — good fit" if f.get("fit") == "good" else f" — LIMITED FIT ({f.get('fit_note', '')})"


def _format_lines(fx: Dict) -> str:
    lines = ["Content types (format_id for content blocks):"]
    for c in fx["content_types"]:
        lines.append(f"- {c['id']} — {c['label']}")
    lines.append("Worksheet formats (format_id for worksheet blocks):")
    for f in fx["worksheet_formats"]:
        lines.append(f"- {f['id']} — {f['label']} — thinking level: {f.get('thinking_level', 'n/a')}{_fit_suffix(f)}")
    lines.append("Activity formats (format_id for activity blocks):")
    for f in fx["activity_formats"]:
        gs = "/".join(f.get("group_sizes") or []) or "any"
        lines.append(
            f"- {f['id']} — {f['label']} — group size: {gs} — teacher attention: "
            f"{f.get('teacher_attention', 'n/a')}{_fit_suffix(f)}"
        )
    return "\n".join(lines)


def _pairing_lines(fx: Dict) -> str:
    lines = []
    for p in fx["pairing"]:
        lines.append(
            f"- {p['content_type_id']} → worksheets: {', '.join(p['worksheet_format_ids']) or 'none'}"
            f" → activities: {', '.join(p['activity_format_ids']) or 'none'}"
        )
    return "\n".join(lines)


_BLOCK_SHAPE = (
    '{"ref": "b1", "type": "content|worksheet|activity", "format_id": "...", "title": "...", '
    '"description": "...", "part": 1, "part_count": 1, "goes_with": null, "objective_id": "...", '
    '"group_size": null, "revision": false, "resources": [{"name": "...", "quantity": 12}]}'
)

_FIELD_RULES = """For each block give:
- ref: a short label unique within today's answer ("b1", "b2", ...) so other blocks can point at it
- type: content, worksheet or activity
- format_id: for content the content type id; for worksheet or activity the format id (only ids listed above)
- title: the same title on every part of a split block; do NOT write "part 1" in the title.
  A worksheet and an activity each get their OWN title that names what students do in it
  ("Label the parts of a sensor", "Build a light-sensing alarm"). Never reuse the title of the content
  block they go with, and never give a worksheet and an activity the same title.
- description: one line saying exactly what students do or learn
- part and part_count: 1 and 1 unless the block is split into parts
- goes_with: for a worksheet or activity, the ref of the content block it belongs with, in the same hour; null for content
- objective_id: exactly one objective category id from the list above
- group_size: for an activity, one of the group sizes its format allows; null for content and worksheets
- revision: true only if the block deliberately revisits something from an earlier day
- resources: for worksheets and activities, what is needed, with quantities worked out for the whole class; [] for content"""


def _head(*, day_number: int, num_days: int, day: Dict, outline_days: List[Dict], earlier_topics: List[str],
          age_min, age_max, band: Dict, num_students: int, time_lines: str, formats: Dict,
          categories: List[Dict]) -> str:
    """Everything before the TASK section; shared by the day plan and the more-ideas prompt."""
    earlier = "\n".join(f"- {t}" for t in earlier_topics) if earlier_topics else "(nothing yet — this is the first day)"
    bullets = "\n".join(f"- {b}" for b in day.get("bullets", []))
    day_obj = ", ".join(day.get("objective_ids") or []) or "none marked"
    return f"""Plan Day {day_number} of {num_days} of a course: "{day.get('title', '')}".

THE WHOLE COURSE (approved by the teacher; do not change it)
{_course_lines(outline_days)}

TODAY MUST COVER
{bullets}

ALREADY TAUGHT ON EARLIER DAYS (the one-hour lessons taught so far, in order)
{earlier}

THE CLASS
- Ages {age_min}–{age_max} ({band.get('label', 'unknown')}): {band.get('developmental_notes', '')} {band.get('pedagogy_notes', '')}
- {num_students} students

THE TIME
{time_lines}

FORMATS YOU MAY USE
Use only these ids. Formats marked "good fit" suit this age group and class size: prefer
them. A "LIMITED FIT" format may be used only when no good-fit format in the pairing table
fits the content; if you use one, say in the description how you adapt it.
{_format_lines(formats)}

WHAT GOES WITH WHAT
For each content type, the worksheet formats that test it and the activity formats that put it to use. A worksheet or activity must use a format listed on its content block's line.
{_pairing_lines(formats)}

LEARNING OBJECTIVE CATEGORIES (the outline marked these for today: {day_obj})
{_objective_lines(categories)}"""


def build_day_prompt(*, day_number: int, num_days: int, day: Dict, outline_days: List[Dict],
                     earlier_topics: List[str], age_min, age_max, band: Dict, num_students: int,
                     hours_per_day: int, spare: int, formats: Dict, categories: List[Dict]) -> str:
    """Plan a day as exactly `hours_per_day` named one-hour lessons of four 15-minute blocks."""
    n = hours_per_day
    slots = n * 4
    time_lines = f"""- The day is {n} {'hour' if n == 1 else 'hours'} of teaching: {n} one-hour {'lesson' if n == 1 else 'lessons'}, {slots} blocks of 15 minutes in all.
  Every block is exactly 15 minutes and every hour holds exactly four blocks.
- Anything that needs longer is split into parts ("part 1 of 2"), each a full block that makes
  sense on its own and written as its own block entry. All parts of one block stay in the same hour."""
    head = _head(day_number=day_number, num_days=num_days, day=day, outline_days=outline_days,
                 earlier_topics=earlier_topics, age_min=age_min, age_max=age_max, band=band,
                 num_students=num_students, time_lines=time_lines, formats=formats, categories=categories)
    if n == 1:
        thread = 'The one lesson covers everything under "TODAY MUST COVER" and builds on the earlier days.'
    else:
        thread = ("""Thread the hours the way the days of the course are threaded: each hour builds on the one
   before it, uses what that hour taught, and prepares the next. Do not teach the same thing in
   two hours. Together the """ + f'{n} lessons cover everything under "TODAY MUST COVER".')
    return f"""{head}

TASK
1. Plan today as exactly {n} {'lesson' if n == 1 else 'lessons'}, one per hour, in teaching order. Each hour is ONE named lesson with
   one clear idea. For each hour give:
   - a specific lesson title, the kind a teacher would write on the board ("What is a
     microcontroller?", "Wiring your first LED"). Never "Hour 1", "Introduction" or "Part 2".
   - one emoji that pictures the lesson
   - its blocks: all of them teach that lesson, and together they are exactly 4 blocks of
     15 minutes (every part counts as one block)
2. {thread}
3. Inside an hour, choose the blocks that fit the lesson:
   - content: 1 or 2 parts (every hour has at least one content block)
   - a worksheet that tests exactly what that hour's content taught, in a format the pairing
     table allows for that content type
   - an activity that puts it to use, 1 to 4 parts
   For example content (1) + worksheet (1) + activity (2 parts) is 4 blocks; content (2 parts) +
   activity (2 parts) is also 4. A worksheet or activity goes with a content block of the SAME hour.
4. Also give at least {spare} spare blocks in all, as "spare_blocks" on the hour each one belongs to
   (spread over the hours; an hour may have none, one or two). They are options for the teacher's
   library, not part of the {slots}: a different angle, extra practice, or a harder or easier
   version for that hour's lesson. Do not leave "spare_blocks" empty on every hour. A spare worksheet or activity goes with a content block of the same hour (one
   of its planned blocks, or a spare content block you add there).

{_FIELD_RULES}

RULES
- Titles say exactly what happens: "Label the Arduino board", not "Practice worksheet".
- Three blocks about one idea must have three different titles: content "What is a Sensor?", worksheet
  "Match each sensor to its job", activity "Build a sensor that sounds an alarm". Pick the title to
  match the format you chose.
- A worksheet never asks about something its content block did not teach.
- Do not re-teach what earlier days covered unless the block is marked as revision.
- Touch every objective category today where it fits naturally; do not force one.
- Exactly {n} {'hour' if n == 1 else 'hours'}, each with at least one content block, each with its planned blocks adding up to exactly 4.

Return JSON: {{"hours": [{{"title": "...", "icon": "<one emoji>", "blocks": [{_BLOCK_SHAPE}], "spare_blocks": [{_BLOCK_SHAPE}]}}]}}"""


def _planned_lines(topics: List[Dict]) -> str:
    out = []
    for i, t in enumerate(topics, start=1):
        out.append(f"- Hour {i}, id {t['id']}: {t.get('icon', '')} {t['title']}")
        for b in t.get("blocks", []):
            part = f", part {b['part']} of {b['part_count']}" if b.get("part_count", 1) > 1 else ""
            out.append(f"    - id {b['id']}: {b['type']} / {b['format_id']}: {b['title']}{part}")
    return "\n".join(out) or "(nothing)"


def build_more_ideas_prompt(*, day_number: int, num_days: int, day: Dict, outline_days: List[Dict],
                            earlier_topics: List[str], age_min, age_max, band: Dict, num_students: int,
                            formats: Dict, categories: List[Dict], current_topics: List[Dict],
                            count: int) -> str:
    head = _head(day_number=day_number, num_days=num_days, day=day, outline_days=outline_days,
                 earlier_topics=earlier_topics, age_min=age_min, age_max=age_max, band=band,
                 num_students=num_students, time_lines="- Every block is exactly 15 minutes.",
                 formats=formats, categories=categories)
    return f"""{head}

TODAY'S HOURS, AND EVERYTHING ALREADY ON THE PLAN OR IN THE TEACHER'S LIBRARY (do not repeat any of these)
{_planned_lines(current_topics)}

TASK
The teacher wants more ideas for Day {day_number}. Propose about {count} NEW blocks, as spare options.
- Each must offer something different from the blocks above: a new angle, a harder or easier
  version, extra practice, or a different format.
- Every block belongs to one of the hours above: give that hour's id as "hour_id". Do NOT start
  new hours. Set "goes_with" to the id of an existing content block of that hour, or to the ref of
  a new content block you add in the same group.
- A worksheet or activity must use a format the pairing table allows for its content block.

{_FIELD_RULES}

Return JSON: {{"hours": [{{"hour_id": "<one of the hour ids above>", "blocks": [{_BLOCK_SHAPE}]}}]}}"""


def _group_size_words() -> str:
    """Group-size ids from the knowledge base as 'a, b or c'."""
    from services import knowledge_base_service as kb
    ids = kb.get_group_size_ids()
    return ", ".join(ids[:-1]) + " or " + ids[-1] if len(ids) > 1 else "".join(ids)


def build_fix_prompt(*, day_title: str, age_min, age_max, band: Dict, num_students: int,
                     offenders: List[Dict]) -> str:
    """The single repair call for a day: only the worksheet/activity blocks that need another look."""
    lines = []
    for o in offenders:
        why = []
        if "format" in o["reasons"]:
            why.append(f"the format you chose ({o['asked_label']}) is not allowed with this content block")
        if "title" in o["reasons"]:
            why.append("its title is the same as its content block's title")
        allowed = "; ".join(f"{a['id']} ({a['label']}{' - ' + a['fit'] if a.get('fit') else ''})" for a in o["allowed"])
        lines.append(
            f"- id {o['id']}: a {o['type']}, currently titled \"{o['title']}\" ({o['description']})\n"
            f"    goes with the content block \"{o['content_title']}\" ({o['content_format']})\n"
            f"    problem: {' and '.join(why)}\n"
            f"    allowed {o['type']} formats: {allowed}"
        )
    return f"""Day plan "{day_title}" for ages {age_min}-{age_max} ({band.get('label', 'unknown')}), {num_students} students.

Some worksheet or activity blocks you proposed need to be redone. For EACH block below:
- pick one of its allowed format ids (only those),
- write a NEW title that names what students do in that format, and is different from the content block's title,
- write a one-line description that matches the format you picked,
- for an activity, also give a group_size that the format allows ({_group_size_words()}).
The title and description must fit the format you pick. Do not reuse the old title.

{chr(10).join(lines)}

Return JSON: {{"blocks": [{{"id": "<id above>", "format_id": "<allowed format id>", "title": "...", "description": "...", "group_size": null}}]}}"""
