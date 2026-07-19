"""
Prompts for Phase 1.5: Subsection Ideation & Selection.

Given one section (a theme/teaching day with a depth_ceiling), propose one or
more independent subsection chains (Basics -> Intermediate -> Advanced) for the
teacher to review and prune before any full block content is generated.
"""

from typing import Dict, List, Optional

from config import OutlinerConfig
from outliner.block_prompts import (
    CONTENT_SUBTYPES,
    WORKSHEET_SUBTYPES,
    ACTIVITY_SUBTYPES,
    WORKSHEET_SUBTYPE_COMPATIBILITY,
)

DEPTH_LEVELS = ["Basics", "Intermediate", "Advanced"]


def _format_recurring_and_day_context(day_slice: Optional[Dict], recurring_structure: Optional[Dict]) -> str:
    """
    Build the "must reflect" block for course-level recurring elements (e.g. "every
    day watch a 30-45 min inspiration video") and this day's explicit asks from the
    Requirements Interpreter, if either is available. Returns "" if neither is set —
    callers fall back to the raw requirements text only.
    """
    if not day_slice and not recurring_structure:
        return ""

    parts = []

    if recurring_structure:
        day_number = day_slice.get('day_number') if day_slice else None
        day_label = f"Day {day_number}" if day_number else "this section"
        track_lines = "\n".join(
            f"  - \"{track.get('name', key)}\" ({track.get('time_window', 'unspecified time')})"
            for key, track in recurring_structure.items()
            if isinstance(track, dict)
        )
        parts.append(
            "RECURRING DAILY ELEMENTS (the teacher described these as repeating EVERY day of the course "
            f"— {day_label} needs its OWN occurrence of each, not a reference back to an earlier day):\n"
            f"{track_lines}\n"
            "Give each recurring element a dedicated subsection (or, if it's short, a dedicated block inside "
            "an existing subsection) in THIS section. Do not skip a recurring element just because it isn't "
            "the section's main theme, and do not merge it silently into an unrelated subsection."
        )

    if day_slice:
        lines = []
        topics = day_slice.get('explicit_topics') or []
        if topics:
            lines.append("Topics the teacher named for this day:\n" + "\n".join(
                f"  - {t.get('topic', t) if isinstance(t, dict) else t}" for t in topics
            ))
        deliverables = day_slice.get('explicit_deliverables') or []
        if deliverables:
            lines.append("Deliverables the teacher described for this day (preserve their own wording/specificity, do NOT generalize it away):\n" + "\n".join(
                f"  - [{d.get('block_type', 'block')}] {d.get('description', d)}" if isinstance(d, dict) else f"  - {d}"
                for d in deliverables
            ))
        emphasis = day_slice.get('teacher_emphasis') or []
        if emphasis:
            lines.append("The teacher flagged these as priorities for this day:\n" + "\n".join(f"  - {e}" for e in emphasis))
        if lines:
            parts.append(
                "TEACHER'S EXPLICIT ASKS FOR THIS DAY (extracted from their own requirements text — every "
                "item below must be reflected in the subsections/blocks you propose for this section):\n"
                + "\n".join(lines)
            )

    return "\n\n" + "\n\n".join(parts) + "\n" if parts else ""


def _format_block_budget_rules(
    worksheet_budget: Optional[int], activity_budget: Optional[int], compatibility_lines: str = "",
) -> str:
    """
    Build the worksheet/activity guidance lines for the block-composition section,
    driven by this section's soft share of the teacher's course-wide numWorksheets/
    numActivities counts. None means "no budget signal available" (e.g. an older
    caller) — falls back to judgment-only guidance with no forced count.
    """
    worksheet_fit_clause = (
        f"\n  When you DO include a worksheet, its subtype MUST fit the subtype of the content block(s) "
        f"it tests (source_block_ids — list of this subsection's own content block ids). Valid "
        f"content-subtype -> worksheet-subtype pairings:\n{compatibility_lines}"
    )

    if worksheet_budget == 0:
        worksheet_line = (
            "The teacher requested 0 worksheets for this course. Do NOT include ANY worksheet blocks in "
            "ANY subsection of this section — no exceptions, even if a subtype would technically fit."
        )
    elif worksheet_budget is None:
        worksheet_line = (
            "Include a worksheet block only where a short written/paper exercise genuinely fits the "
            "subsection's content — do not force one into every subsection." + worksheet_fit_clause
        )
    else:
        worksheet_line = (
            f"This section should contain roughly {worksheet_budget} worksheet block(s) TOTAL, summed across "
            "ALL the subsections/chains you propose for this section — not one per subsection. Put them only "
            "where a written/paper exercise fits (e.g. a concept-learning subsection), and leave subsections "
            "built for physical practice, rehearsal, or building with zero worksheets." + worksheet_fit_clause
        )

    if activity_budget is None:
        activity_line = (
            "Include activity block(s) where hands-on practice, rehearsal, application, or performance "
            "genuinely fits the subsection — commonly at least one, but not mechanically exactly one."
        )
    elif activity_budget == 0:
        activity_line = (
            "The teacher requested 0 activities for this course. Do NOT include ANY activity blocks in ANY "
            "subsection of this section."
        )
    else:
        activity_line = (
            f"This section should contain roughly {activity_budget} activity block(s) TOTAL, summed across ALL "
            "the subsections/chains you propose for this section — not one per subsection. A subsection about "
            "physical practice, rehearsal, or building may reasonably carry 2-3 activity blocks and no content "
            "blocks at all; a purely conceptual subsection might carry 0-1."
        )

    return worksheet_line, activity_line


def get_subsection_ideation_prompt(
    section: Dict,
    course_context: Dict,
    other_subsections: Optional[List[Dict]] = None,
    hours_per_day: float = 1.0,
    num_days: int = 1,
    num_new_chains: Optional[int] = None,
    worksheet_budget: Optional[int] = None,
    activity_budget: Optional[int] = None,
    day_slice: Optional[Dict] = None,
    recurring_structure: Optional[Dict] = None,
) -> str:
    """
    Build the prompt that proposes candidate subsection chains for one section.

    Args:
        section: {'id'/'section_id', 'title', 'description', 'depth_ceiling'}
        course_context: {'course_name', 'age_range_start', 'age_range_end', 'requirements'}
        other_subsections: [{'section': title, 'subsection': title}, ...] — subsections
            already proposed elsewhere (other sections, or this same section on a
            "generate more" request), same shape block_prompts.py uses.
        hours_per_day / num_days: soft steering signal only, not a hard subsection count.
        num_new_chains: if set, propose exactly this many new chains (used for the initial
            batch, where we want several options, and for a single "generate one more" request).
            If None, the model chooses how many independent chains fit the section.
        worksheet_budget / activity_budget: this section's soft share of the teacher's
            course-wide numWorksheets/numActivities counts (None = no signal available).
        day_slice / recurring_structure: structured output from the Requirements
            Interpreter — this day's explicit asks, and any course-wide recurring
            element (e.g. "every day watch a 30-45 min inspiration video") that must
            show up in every section. Either or both may be None.

    Returns:
        str: Prompt for the LLM — expects JSON { "chains": [...] }
    """
    section_id = section.get('id') or section.get('section_id', '')
    section_title = section.get('title', '')
    section_description = section.get('description', '')
    depth_ceiling = section.get('depth_ceiling', 'Basics')

    age_range_start = course_context.get('age_range_start', '')
    age_range_end = course_context.get('age_range_end', '')
    age_range = f"{age_range_start}–{age_range_end} years old"
    course_name = course_context.get('course_name', '')
    subject = course_context.get('subject', '')
    topic = course_context.get('topic', '')
    requirements = course_context.get('requirements', 'None')
    subject_topic_line = f"- Subject / Topic: {subject} / {topic}\n" if (subject or topic) else ""

    already_covered_text = ""
    if other_subsections:
        lines = [f"  - {s['section']}: {s['subsection']}" for s in other_subsections]
        already_covered_text = (
            "\nALREADY PROPOSED (DO NOT REPEAT these concepts or titles — this includes both other "
            "sections and any chains already proposed for THIS section):\n"
            + "\n".join(lines)
            + "\nEvery subsection you propose must be DISTINCT from all of the above.\n"
        )

    depth_ceiling_index = DEPTH_LEVELS.index(depth_ceiling) if depth_ceiling in DEPTH_LEVELS else 0
    allowed_depths = DEPTH_LEVELS[: depth_ceiling_index + 1]

    if num_new_chains is not None:
        chain_count_instruction = (
            f"Propose EXACTLY {num_new_chains} new independent chain(s) — no more, no fewer."
        )
    else:
        chain_count_instruction = (
            "Propose SEVERAL independent chains, not just one — aim for at least 2, and up to 4 if "
            "the section's scope genuinely supports that many distinct root concepts. A teacher "
            "should have real options to choose from, not a single forced path."
        )

    compatibility_lines = "\n".join(
        f"  - {content_subtype} -> {', '.join(worksheet_subtypes)}"
        for content_subtype, worksheet_subtypes in WORKSHEET_SUBTYPE_COMPATIBILITY.items()
    )

    recurring_and_day_text = _format_recurring_and_day_context(day_slice, recurring_structure)
    worksheet_line, activity_line = _format_block_budget_rules(worksheet_budget, activity_budget, compatibility_lines)

    prompt = f"""
You are an expert curriculum designer. Propose candidate SUBSECTIONS for one section of a course,
so a teacher can review and select which ones to actually teach before content is written.

COURSE CONTEXT:
- Course Name: {course_name}
{subject_topic_line}- Student Age Range: {age_range}
- Special Requirements: {requirements}
- Overall course pacing (a rough signal only, NOT a hard count): {num_days} day(s), roughly {hours_per_day} teaching hour(s)/day
{already_covered_text}{recurring_and_day_text}
SECTION TO PROPOSE SUBSECTIONS FOR:
- Section: {section_title}
- Description: {section_description}
- depth_ceiling: {depth_ceiling} (you may propose subsections up to and including this depth: {', '.join(allowed_depths)})

PLA FRAMEWORK (every subsection must map to one or more of these pillars):
{OutlinerConfig.PLA_FRAMEWORK}

WHAT A SUBSECTION IS:
A subsection is a self-contained learning arc: the smallest unit that teaches one concept,
lets students practice it, and lets them apply it. Every subsection must declare:
- core_concept: one sentence, the single idea this subsection teaches
- depth_level: one of {allowed_depths}, relative to this section
- prerequisite_subsection_id: the id of the subsection (in this same chain) whose concept this
  one assumes and builds on, or null if this is a root (Basics) subsection
- blocks: an ordered list of block specs (titles/subtypes ONLY — do NOT write full block content,
  questions, or answers yet; that happens in a later generation step)

WHAT A CHAIN IS:
A chain is one independent line of subsections: it starts with exactly one Basics subsection
(prerequisite_subsection_id: null) and, only if depth_ceiling allows, an Intermediate subsection
naming that Basics subsection as its prerequisite, and an Advanced subsection naming that
Intermediate subsection as its prerequisite.

- {chain_count_instruction} Each chain's Basics subsection must cover a genuinely different root
  concept from every other chain (both the ones you're proposing now and any already proposed —
  see the "ALREADY PROPOSED" list above/below).
- Do NOT assume every subsection needs a prerequisite — only Intermediate/Advanced subsections do.
- Do NOT merge multiple chains into one — each chain is independently selectable by the teacher.

BLOCK COMPOSITION — flexible, driven by what THIS subsection actually needs:
There is NO fixed formula (e.g. "1 worksheet + 1 activity per subsection"). The number and mix of
blocks in each subsection must fit its own content and the teacher's requirements/objectives above
— never pad a subsection with a block type just to match a template. Two subsections in the same
course can legitimately look completely different: one might be 3 content blocks and a worksheet,
another might be 2 activity blocks and nothing else.

- Content blocks (0 to 4): use as many as it takes to establish this subsection's core_concept, no
  more. Most subsections that introduce a new idea should open with a "Definition" content block
  (subtype from: {CONTENT_SUBTYPES}), but a subsection whose purpose is primarily PRACTICE,
  REHEARSAL, BUILDING, or PERFORMING — rather than introducing a new idea — may use a single short
  framing content block, or skip content blocks entirely, when the teacher's requirements describe
  it that way (e.g. a "script read-through and practice" or "prop-building" session doesn't need a
  Definition block).
- Worksheet blocks (subtype from: {WORKSHEET_SUBTYPES} when used): {worksheet_line}
- Activity blocks: {activity_line}
  Activity subtype from: {ACTIVITY_SUBTYPES}. Activities reference the subsection's core_concept (or,
  for a practice/rehearsal/build subsection, its whole purpose) as a whole, NOT a single source
  block — do not include source_block_ids on activity blocks.

EVERY block (content, worksheet, and activity) also needs a `description`: ONE or TWO sentences,
written for the TEACHER (not the student), previewing what this specific block will contain once
fully generated — e.g. "Explains what evaporation is using the sun-and-puddle example, with a
memory device for the term." Be concrete about what's inside it, not just a restatement of the
title. This is what the teacher reads to decide whether to keep this block before it's written.

RULES:
- Never give a worksheet a subtype that doesn't fit its source content block's subtype.
- Never include a worksheet or activity block type the teacher's budget above forbids (0 means zero,
  no exceptions), and never force one in just to "complete" a subsection.
- Titles must be specific to "{course_name}" for students aged {age_range} — never generic filler.
- Every subsection across the whole course must be distinct — check against the
  "ALREADY PROPOSED" list above before finalizing.
- If RECURRING DAILY ELEMENTS or TEACHER'S EXPLICIT ASKS were listed above, every one of them must
  show up somewhere in this section's subsections/blocks before you finalize — treat missing one as
  a validation failure and go back and add it.
- BEFORE outputting JSON: for every subsection in every chain, confirm every block has a
  `description`, and confirm the section-wide worksheet/activity counts you actually used are
  consistent with the budget lines above (0 means literally 0, not "close to 0").

OUTPUT FORMAT (strict JSON, no other text). The single example block below is illustrative only —
each subsection's real `blocks` array should have however many entries (of whichever types) that
subsection actually needs per BLOCK COMPOSITION above; do not copy its length or type ordering:
{{
  "section_id": "{section_id}",
  "chains": [
    {{
      "chain_id": "string (e.g. '{section_id}_chain_1')",
      "subsections": [
        {{
          "subsection_id": "string (e.g. '{section_id}_chain_1_basics')",
          "title": "string — specific, descriptive phrase, no framework prefixes",
          "description": "string — 2-3 sentences, concrete details",
          "core_concept": "string — one sentence",
          "depth_level": "Basics",
          "prerequisite_subsection_id": null,
          "learning_objectives": ["string"],
          "content_keywords": ["string"],
          "pla_pillars": ["string"],
          "blocks": [
            {{"id": "string", "type": "content" | "worksheet" | "activity", "subtype": "string", "title": "string", "description": "string — 1-2 sentences previewing this block's content", "source_block_ids": ["string — worksheet blocks only, omit otherwise"]}}
          ]
        }}
      ]
    }}
  ]
}}

Only include Intermediate/Advanced subsections in a chain if the section's depth_ceiling allows it.
Generate the candidate subsections now as valid JSON only. No other text.
"""
    return prompt
