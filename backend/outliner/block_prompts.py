"""
Prompts for block generation within a subsection.
Blocks are 15/30-min content/worksheet/activity chunks. Composition (which blocks,
their type/subtype/title, and worksheet source_block_ids) is decided in Phase 1.5
(subsection_selection_prompts.py) and approved by the teacher — this module only
expands each approved block spec into full content.
"""

import logging
from typing import Dict, List, Optional


# ---------------------------------------------------------------------------
# Subtype taxonomy: ONE source of truth = the knowledge base
# (services/knowledge_base_service.py). Use the get_*() functions below.
#
# The literals in this block are the DOCUMENTED FALLBACK, kept in one place:
#  - used if the knowledge base is unavailable or returns something unusable
#    (logged once, never raises).
# The knowledge base fixes the old-flow list order with each format's `legacy_order`.
# Stored subtype strings on saved courses are the KB `legacy_labels`
# (get_legacy_label_map), so they stay valid either way.
# ---------------------------------------------------------------------------
_FALLBACK_CONTENT_SUBTYPES = [
    "Definition",
    "Categories/Types",
    "Examples",
    "Terminology",
    "Process",
    "Parts/Components",
    "Comparison",
    "Perspectives",
    "Context/History",
]

_FALLBACK_WORKSHEET_SUBTYPES = [
    "Fill-in-the-blank",
    "Matching",
    "Sequencing/ordering",
    "Labeling/diagramming",
    "Compare/contrast short answer",
    "Multiple choice",
]

_FALLBACK_ACTIVITY_SUBTYPES = [
    "Create-your-own/design challenge",
    "Roleplay/simulation",
    "Debate/discussion",
    "Presentation/teach-back",
    "Group project/build",
    "Reflection/journaling",
]

# Which worksheet subtypes are a valid fit for a given source content subtype.
# A worksheet can't test content that isn't in the subsection, and its format
# must fit what it's testing (e.g. Matching for Categories/Examples, Sequencing
# for Process, Labeling for Parts/Components).
_FALLBACK_WORKSHEET_SUBTYPE_COMPATIBILITY = {
    "Definition": ["Fill-in-the-blank", "Multiple choice"],
    "Categories/Types": ["Matching", "Multiple choice"],
    "Examples": ["Matching", "Fill-in-the-blank"],
    "Terminology": ["Fill-in-the-blank", "Matching"],
    "Process": ["Sequencing/ordering"],
    "Parts/Components": ["Labeling/diagramming"],
    "Comparison": ["Compare/contrast short answer"],
    "Perspectives": ["Compare/contrast short answer"],
    "Context/History": ["Sequencing/ordering", "Multiple choice"],
}

# Backward-compatible names. DEPRECATED: these are the static FALLBACK values and do
# NOT reflect knowledge base edits. New code should call the get_*() functions.
CONTENT_SUBTYPES = _FALLBACK_CONTENT_SUBTYPES
WORKSHEET_SUBTYPES = _FALLBACK_WORKSHEET_SUBTYPES
ACTIVITY_SUBTYPES = _FALLBACK_ACTIVITY_SUBTYPES
WORKSHEET_SUBTYPE_COMPATIBILITY = _FALLBACK_WORKSHEET_SUBTYPE_COMPATIBILITY

_logger = logging.getLogger(__name__)
_taxonomy_cache: Optional[Dict] = None  # resolved once per process (like the KB cache)


def _fallback_taxonomy() -> Dict:
    return {
        'content': list(_FALLBACK_CONTENT_SUBTYPES),
        'worksheet': list(_FALLBACK_WORKSHEET_SUBTYPES),
        'activity': list(_FALLBACK_ACTIVITY_SUBTYPES),
        'compat': {k: list(v) for k, v in _FALLBACK_WORKSHEET_SUBTYPE_COMPATIBILITY.items()},
    }


def _derive_taxonomy() -> Dict:
    """
    Build the legacy subtype vocabulary from the knowledge base. Raises on anything
    unusable; the caller falls back.

    Derived from the KB: the content subtype list (legacy content types, KB order)
    and the content -> worksheet compatibility table (each legacy content type's
    pairing-table worksheet formats, restricted to formats that have a legacy label,
    shown by that legacy label), plus the worksheet and activity subtype lists
    (kb.get_legacy_subtypes, in the KB's legacy order). Every label in the compatibility
    table is restricted to the worksheet list, so the two cannot disagree.
    """
    from services import knowledge_base_service as kb

    label_map = kb.get_legacy_label_map()
    content_label_to_id = label_map.get('content') or {}
    ws_id_to_labels: Dict[str, List[str]] = {}
    for label, fid in (label_map.get('worksheet') or {}).items():
        ws_id_to_labels.setdefault(fid, []).append(label)

    id_to_label = {cid: label for label, cid in content_label_to_id.items()}
    pairing = {row['content_type_id']: row for row in kb.get_pairing_table()}

    content = []
    compat: Dict[str, List[str]] = {}
    for ct in kb.get_content_types():
        cid = ct.get('id')
        label = id_to_label.get(cid)
        if label is None:  # not a legacy content type
            continue
        labels: List[str] = []
        for fid in (pairing.get(cid) or {}).get('worksheet_format_ids', []):
            for lbl in ws_id_to_labels.get(fid, []):
                if lbl not in labels:
                    labels.append(lbl)
        if not labels:
            raise ValueError(f"no legacy worksheet subtype for content type {cid!r}")
        content.append(label)
        compat[label] = labels

    if not content or not all(isinstance(c, str) and c for c in content):
        raise ValueError("no usable legacy content types")

    worksheet = kb.get_legacy_subtypes('worksheet')
    activity = kb.get_legacy_subtypes('activity')
    for lst in (worksheet, activity):
        if not lst or not all(isinstance(x, str) and x for x in lst):
            raise ValueError("no usable legacy worksheet/activity subtypes")
    # Same label set for table and list: a label outside the list is dropped here.
    compat = {c: [l for l in ls if l in worksheet] for c, ls in compat.items()}
    if not all(compat.values()):
        raise ValueError("compatibility table references worksheet labels outside the allowed list")

    taxonomy = _fallback_taxonomy()
    taxonomy['content'] = content
    taxonomy['worksheet'] = worksheet
    taxonomy['activity'] = activity
    taxonomy['compat'] = compat
    return taxonomy


def _taxonomy() -> Dict:
    """Resolved once per process, including a failure (logged once, then fallback)."""
    global _taxonomy_cache
    if _taxonomy_cache is None:
        try:
            _taxonomy_cache = _derive_taxonomy()
        except Exception as e:
            _logger.warning("Legacy subtype taxonomy: knowledge base unusable (%s); using built-in fallback", e)
            _taxonomy_cache = _fallback_taxonomy()
    return _taxonomy_cache


def reset_taxonomy_cache() -> None:
    """Forget the resolved taxonomy (tests / after the KB cache is refreshed)."""
    global _taxonomy_cache
    _taxonomy_cache = None


def get_content_subtypes() -> List[str]:
    return list(_taxonomy()['content'])


def get_worksheet_subtypes() -> List[str]:
    return list(_taxonomy()['worksheet'])


def get_activity_subtypes() -> List[str]:
    return list(_taxonomy()['activity'])


def get_worksheet_subtype_compatibility() -> Dict[str, List[str]]:
    return {k: list(v) for k, v in _taxonomy()['compat'].items()}


# Flexible section toolkit for content blocks — LLM picks 3-5 per block.
# Deliberately NOT knowledge-base derived: it is prompt wording (how generated prose
# is structured), not a taxonomy teachers pick from or that is stored on blocks.
CONTENT_SECTION_TOOLKIT = """
Available sections (choose 3-5 that fit the concept — do NOT use sections that don't apply):

  Explain It        — Always include. Core explanation: what this concept IS, 4-6 sentences.
  How It Works      — For processes, mechanisms, systems, or cause-and-effect.
  Key Points        — For fact-heavy topics. 3-5 bullet points that would work on a PPT slide.
  Parts / Structure — For anatomy, components, or physical structures (what are the pieces?).
  Types / Categories— For classification topics (what kinds are there?).
  In Real Life      — Always valuable. 2-3 concrete examples from the student's world.
  Key People & Events— For history, biographies, social studies topics.
  Why It Matters    — For context, significance, or impact — why should students care?
  Formula / Rule    — For math or science: the actual formula or rule, written out clearly.
  How to Do It      — For skills, procedures, techniques: numbered step-by-step.
  Common Mix-Ups    — The most frequent misconception students have, and the correct idea.

Write the chosen sections as natural flowing prose or lists — NOT as a rigid form.
The content must read the way a knowledgeable teacher would explain it, not like a template.
"""


def _filter_excluded_block_specs(block_specs: List[Dict], excluded_block_ids: Optional[List[str]]) -> List[Dict]:
    """
    Apply the teacher's exclusions to an approved subsection's block-spec list,
    before any content generation happens.

    1. Drop any block_spec whose own id was excluded.
    2. For remaining worksheet specs, drop excluded ids from source_block_ids;
       if that leaves the worksheet with no sources (and it originally had some),
       drop the worksheet spec entirely rather than generating it against nothing.
    Activities have no source_block_ids and are never dropped by step 2 — only
    by being excluded themselves in step 1.
    """
    excluded = set(excluded_block_ids or [])
    kept = [spec for spec in block_specs if spec.get('id') not in excluded]

    filtered = []
    for spec in kept:
        if spec.get('type') == 'worksheet' and spec.get('source_block_ids'):
            remaining = [bid for bid in spec['source_block_ids'] if bid not in excluded]
            if not remaining:
                continue  # all sources excluded — skip this worksheet
            spec = {**spec, 'source_block_ids': remaining}
        filtered.append(spec)

    return filtered


def get_block_generation_prompt(
    teacher_input: Dict,
    subsection: Dict,
    section_title: str,
    block_specs: List[Dict],
    other_subsections: list = None,
    session_minutes: int = 60,
    fixed_block_minutes: Optional[int] = None,
) -> str:
    """
    Build the prompt that expands an approved subsection's block specs (titles/
    subtypes only, decided in Phase 1.5) into full block content.

    Args:
        teacher_input: Course-level info (course_name, age_range_start/end, requirements)
        subsection: The subsection dict with title, description, core_concept, learning_objectives
        section_title: Title of the parent section
        block_specs: Ordered list of approved block-spec dicts (already exclusion-filtered),
            each {id, type, subtype, title, source_block_ids? (worksheet only)}
        session_minutes: Estimated total minutes for this subsection (from Phase 1.5)
        fixed_block_minutes: Course Builder plans only. When set, EVERY block is exactly this
            long (15), the 15/15/30 rules below do not apply, and the format ids / subtypes of
            the plan are passed through as given (they come from the knowledge base and may
            not be in the legacy lists above). None = the legacy behaviour, unchanged.

    Returns:
        str: Prompt for the LLM — expects JSON { "blocks": [...] }
    """
    age_range_start = teacher_input.get('age_range_start', '')
    age_range_end = teacher_input.get('age_range_end', '')
    age_range = f"{age_range_start}–{age_range_end} years old"
    course_name = teacher_input.get('course_name', '')
    subject = teacher_input.get('subject', '')
    topic = teacher_input.get('topic', '')
    requirements = teacher_input.get('requirements', 'None')

    sub_title = subsection.get('title', '')
    sub_description = subsection.get('description', '')
    core_concept = subsection.get('core_concept', '')
    learning_objectives = subsection.get('learning_objectives', [])

    objectives_text = "\n".join(f"  - {o}" for o in learning_objectives) if learning_objectives else "  (none listed)"

    # Build a "do not repeat" list from all other subsections in the course
    already_covered_text = ""
    if other_subsections:
        lines = [f"  - {s['section']}: {s['subsection']}" for s in other_subsections]
        already_covered_text = (
            "\nALREADY COVERED IN OTHER LESSONS (DO NOT REPEAT these concepts, titles, or activities):\n"
            + "\n".join(lines)
            + "\nYour blocks must cover content that is DISTINCT from all of the above.\n"
        )

    subject_topic_line = f"- Subject / Topic: {subject} / {topic}\n" if (subject or topic) else ""

    id_by_index = {i: spec.get('id') for i, spec in enumerate(block_specs)}
    content_ids = {spec['id'] for spec in block_specs if spec.get('type') == 'content'}

    spec_lines = []
    for i, spec in enumerate(block_specs):
        line = f"  {i + 1}. id=\"{spec.get('id')}\" type=\"{spec.get('type')}\" subtype=\"{spec.get('subtype')}\" title=\"{spec.get('title')}\""
        if spec.get('type') == 'worksheet' and spec.get('source_block_ids'):
            line += f" source_block_ids={spec['source_block_ids']}"
        if fixed_block_minutes:
            line += f" format_id=\"{spec.get('format_id', '')}\""
            if spec.get('description'):
                line += f" plan_note=\"{spec['description']}\""
            if (spec.get('part_count') or 1) > 1:
                line += f" part=\"{spec.get('part')} of {spec.get('part_count')}\""
            if spec.get('type') == 'activity' and spec.get('group_size'):
                line += f" group_size=\"{spec['group_size']}\""
            if spec.get('resources'):
                line += " resources=" + ", ".join(f"{r['quantity']} x {r['name']}" for r in spec['resources'])
        spec_lines.append(line)
    specs_text = "\n".join(spec_lines)

    prompt = f"""
You are an expert curriculum designer. The block COMPOSITION for this session has already been
decided and approved by the teacher — your job is to expand EACH approved block spec below into
its full content. Do NOT add, remove, or reorder blocks, and do NOT change any block's id,
type, subtype, or title — use them exactly as given.

COURSE CONTEXT:
- Course Name: {course_name}
{subject_topic_line}- Student Age Range: {age_range}
- Section: {section_title}
- This Session: {sub_title}
- Session Description: {sub_description}
- Core Concept: {core_concept}
- Learning Objectives:
{objectives_text}
- Special Requirements: {requirements}
{already_covered_text}

APPROVED BLOCK COMPOSITION (expand each of these, in this exact order, using the given id/type/subtype/title):
{specs_text}

TIME BUDGET:
- This session is estimated at {session_minutes} minutes of teaching — content blocks are 15
  or 30 minutes each (default 15, use 30 only if the concept genuinely needs more depth),
  worksheets are always 15 minutes, activities are always 30 minutes.

CONTENT BLOCK RULES (for specs with type "content"):
- Think of each content block as ONE slide in a presentation.
- Each block covers EXACTLY ONE concept matching its given subtype and title — never bundle.
- Titles are already fixed (given above) — write content that matches the given title exactly.

CONTENT BLOCK STRUCTURE:
{CONTENT_SECTION_TOOLKIT}
For each content block, choose the 3-5 sections from the toolkit above that best fit the concept.
Write the content field as natural flowing prose and lists — not a rigid form.
All vocabulary, examples, and complexity must be appropriate for ages {age_range_start}–{age_range_end}.

For each spec with type "content", output:
- id, type, subtype, title: copied exactly from the approved composition above
- content: the teaching content using 3-5 chosen sections from the toolkit
- key_takeaways: array of 3-5 concise bullet strings (used for PPT generation)
- pedagogy: object with fields:
    teaching_approach, memory_device, misconception, guided_questions (array of 2-3), mastery_signal
- visual_suggestion: one sentence describing an image or diagram for a PPT slide
- sources: array of 2-3 objects, each with name, search_query, type (one of "educational_site", "encyclopedia", "curriculum_standard", "textbook")
- duration_minutes: 15 or 30

For each spec with type "worksheet", output:
- id, type, subtype, title, source_block_ids: copied exactly from the approved composition above
- duration_minutes: 15
- content: must follow this exact structure —

**Learning Objective:**
Students will [verb] [specific thing].

**Duration:** Approximately 15 minutes for students to complete.

**Worksheet Type:** {{subtype}}

**Worksheet Content:**
[WRITE THE COMPLETE VERBATIM STUDENT-FACING WORKSHEET TEXT HERE — every word, sentence, blank, question, answer option, comprehension passage, or drawing prompt exactly as it would appear on the printed worksheet. Do NOT write instructions about what to generate — write the actual content. This must be complete enough for another system to generate a PDF directly from this text. Base every question on the content block(s) referenced by source_block_ids.]

**Answer Key:**
[Complete answers for every blank, question, or item, numbered to match the worksheet.]

For each spec with type "activity", output:
- id, type, subtype, title: copied exactly from the approved composition above
- duration_minutes: 30
- content: must follow this exact structure, built around the session's Core Concept above (not a single content block) —

**Learning Objective:**
Students will [verb] [specific thing].

**Duration:** 30 minutes

**Activity Type:** {{subtype}}

**Resources/Materials Needed:**
- [Material 1]
- [Material 2]
(use "None required" if no materials needed)

**Steps to Conduct:**
1. [Setup — what to prepare before students arrive]
2. [Introduction — how to frame the activity for students]
3. [Main activity — what students do, in detail]
4. [Check / debrief question]
5. [Wrap-up]

**Management Tips:**
- [Tip 1: specific behavioral or logistical guidance]
- [Tip 2: grouping or pacing strategy]
- [Tip 3: transition or early-finisher guidance]

CONTENT QUALITY RULES:
- Every block must be directly tied to "{course_name}" for students aged {age_range}
- Worksheet and activity content must be COMPLETE verbatim text, not instructions about what to generate
- Preserve the exact ids, types, subtypes, and titles given in the approved composition above

OUTPUT FORMAT (strict JSON, no other text, one entry per approved block spec above, same order):
{{
  "blocks": [
    {{
      "id": "string — copied from the approved composition",
      "type": "content",
      "subtype": "string — copied from the approved composition",
      "title": "string — copied from the approved composition",
      "content": "string — natural prose using 3-5 chosen sections from the toolkit, written with **Section Name** as bold headers",
      "key_takeaways": ["string", "string", "string"],
      "pedagogy": {{
        "teaching_approach": "string",
        "memory_device": "string",
        "misconception": "string",
        "guided_questions": ["string", "string"],
        "mastery_signal": "string"
      }},
      "visual_suggestion": "string",
      "sources": [
        {{"name": "string", "search_query": "string", "type": "string"}},
        {{"name": "string", "search_query": "string", "type": "string"}}
      ],
      "duration_minutes": 15
    }},
    {{
      "id": "string — copied from the approved composition",
      "type": "worksheet",
      "subtype": "string — copied from the approved composition",
      "title": "string — copied from the approved composition",
      "source_block_ids": ["string — copied from the approved composition"],
      "content": "string — complete verbatim student-facing worksheet with answer key",
      "duration_minutes": 15
    }},
    {{
      "id": "string — copied from the approved composition",
      "type": "activity",
      "subtype": "string — copied from the approved composition",
      "title": "string — copied from the approved composition",
      "content": "string — complete activity instructions with materials, steps, and management tips",
      "duration_minutes": 30
    }}
  ]
}}

Generate the blocks now as valid JSON only. No other text.
"""
    if fixed_block_minutes:
        m = int(fixed_block_minutes)
        prompt = prompt.replace(
            f"""- This session is estimated at {session_minutes} minutes of teaching — content blocks are 15
  or 30 minutes each (default 15, use 30 only if the concept genuinely needs more depth),
  worksheets are always 15 minutes, activities are always 30 minutes.""",
            f"""- This session is {session_minutes} minutes of teaching. EVERY block, of every type, is exactly {m}
  minutes. A block marked part "k of n" is one {m}-minute part of a longer item: write only what
  fits in {m} minutes and make it make sense on its own. Honour each block's plan_note, group_size
  and resources where given; the format_id and subtype are fixed by the teacher's plan.""")
        prompt = prompt.replace("- duration_minutes: 15 or 30", f"- duration_minutes: {m}")
        prompt = prompt.replace("- duration_minutes: 30\n", f"- duration_minutes: {m}\n")
        prompt = prompt.replace("**Duration:** 30 minutes", f"**Duration:** {m} minutes")
        prompt = prompt.replace('"duration_minutes": 30', f'"duration_minutes": {m}')
        prompt = prompt.replace('"duration_minutes": 15', f'"duration_minutes": {m}')
        prompt = prompt.replace("Approximately 15 minutes", f"Approximately {m} minutes")
    return prompt
