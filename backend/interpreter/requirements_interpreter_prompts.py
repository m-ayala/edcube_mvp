"""
Prompts for the Requirements Interpreter — a one-shot pass over the teacher's
raw free-text requirements/objectives, run once before Phase 1 outline
generation. Structures day-by-day content (if present) and any recurring
daily structure so later phases receive pre-scoped context instead of having
to re-interpret the same raw blob independently at every step.
"""

from typing import Dict


def get_requirements_interpretation_prompt(
    raw_requirements: str,
    num_days: int,
    hours_per_day: float,
    course_name: str = '',
    age_range_start: str = '',
    age_range_end: str = '',
) -> str:
    """
    Build the prompt that turns the teacher's raw requirements text into
    structured JSON: an optional recurring parallel-track structure, and one
    slice of extracted content per day/session if — and only if — the text
    actually describes a day-by-day or session-by-session structure.

    Returns:
        str: Prompt for the LLM — expects the JSON shape documented inline below.
    """
    age_range = f"{age_range_start}–{age_range_end} years old" if (age_range_start or age_range_end) else "unspecified"

    prompt = f"""
You are analyzing a teacher's raw course requirements text to extract its structure before a
course outline is generated. Do NOT generate a course outline yourself — only interpret what the
teacher already wrote.

COURSE CONTEXT:
- Course Name: {course_name}
- Student Age Range: {age_range}
- Course Length: {num_days} day(s), roughly {hours_per_day} teaching hour(s) per day

TEACHER'S RAW REQUIREMENTS TEXT:
\"\"\"
{raw_requirements}
\"\"\"

YOUR TASK — read the text above and determine:

0. SUBJECT & TOPIC DETECTION: infer this course's SUBJECT and TOPIC from the Course Name above and the
   requirements text below — the teacher will not tell you these directly.
   - SUBJECT = the broadest academic/programmatic discipline this course belongs to (e.g. "Biology",
     "Theater Arts", "Mathematics", "Computer Science").
   - TOPIC = the mid-level category under that subject this course sits inside — broader than the course
     itself, narrower than the subject. Think of it as the shelf a librarian would file this course under.
   - Course Name is always more specific than TOPIC.
   Worked examples:
     - Course Name "Photosynthesis" → topic "Plants", subject "Biology"
     - Course Name "The Island of Cards Drama Camp" (staging a Tagore play, acting, prop-making)
       → topic "Drama & Theater Production", subject "Theater Arts"
   Use Title Case, 1-3 words each, no punctuation. Always make a best-effort inference, even from a weak
   signal — never leave these blank.

1. DAY-BY-DAY STRUCTURE: does the teacher describe distinct content for specific days or
   sessions (e.g. "Day 1: ...", "Monday we'll ...", "the first session covers ...")? If yes,
   produce EXACTLY {num_days} day slices (one per teaching day of this course — the same count
   the teacher already committed to for course length) in the "days" array, in day order. If the
   text does NOT describe day-by-day structure — it's a general description of the whole course —
   return an EMPTY "days" array. Do not force a day-by-day breakdown onto text that doesn't have one.

2. RECURRING STRUCTURE: does the teacher describe a structure that REPEATS across every day (e.g.
   "every day splits into two parts: coding in the morning, robotics in the afternoon" or "the
   last 30 minutes is always free build time")? If so, capture it ONCE at the course level in
   "recurring_structure" — do not re-describe it inside every day slice. Each day's explicit_topics
   and explicit_deliverables should instead just tag which track/part of the recurring structure
   they belong to (via the "track" field), using the SAME track keys you define in
   "recurring_structure" (e.g. "track_1", "track_2"). If there is no recurring structure, set
   "recurring_structure" to null and leave every "track" field null.

3. PER DAY (only if "days" is non-empty), extract:
   - explicit_topics: named subjects, themes, or skills the teacher's text actually names for that
     day, each tagged with its track if a recurring_structure exists, else track: null.
   - explicit_deliverables: any worksheet, activity, project, or presentation the teacher already
     described in enough detail to identify. PRESERVE the teacher's description faithfully — do
     NOT paraphrase it into something generic. If the teacher wrote "a worksheet where kids label
     the layers of Earth's crust", keep that specificity, don't shrink it to "a worksheet".
   - teacher_emphasis: anything the teacher flagged as a personal interest, priority, or "make
     sure to include" for that day.
   - enrichment_suggestions: YOUR OWN ideas for extending what the teacher asked for that day —
     these must be things the teacher's text does NOT already say. NEVER put your own inventions
     into explicit_topics or explicit_deliverables — those two fields are ONLY for content you can
     directly trace to the teacher's own words. If you're not sure whether something was said by
     the teacher or is your addition, treat it as an enrichment_suggestion, not explicit content.

4. GAPS: note any day that seems thin relative to its time allocation ({hours_per_day} hour(s)),
   and any direct question the teacher asked in the text (e.g. "let me know if I'm missing
   something", "is this enough for a full day?") in "gap_flags" / "answers_to_teacher_questions".
   If a question was asked, actually answer it briefly in "answers_to_teacher_questions" based on
   what you can infer from the rest of the text — don't just restate the question.

OUTPUT FORMAT (strict JSON, no other text):
{{
  "detected_subject": "string — e.g. 'Biology'",
  "detected_topic": "string — e.g. 'Plants'",
  "recurring_structure": {{
    "track_1": {{"name": "string", "time_window": "string, e.g. 'first half of the day'"}},
    "track_2": {{"name": "string", "time_window": "string"}}
  }},
  "days": [
    {{
      "day_number": 1,
      "explicit_topics": [{{"topic": "string", "track": "track_1" | "track_2" | null}}],
      "explicit_deliverables": [
        {{"block_type": "worksheet" | "activity" | "presentation" | "content",
          "description": "string — the teacher's own description, preserved faithfully",
          "track": "track_1" | "track_2" | null}}
      ],
      "teacher_emphasis": ["string"],
      "enrichment_suggestions": ["string"]
    }}
  ],
  "gap_flags": ["string"],
  "answers_to_teacher_questions": ["string"]
}}

If there's no recurring structure, set "recurring_structure" to null (not an object with empty
tracks). If there's no day-by-day structure, set "days" to an empty array — in that case
"gap_flags" and "answers_to_teacher_questions" may still be populated from the text as a whole.

Generate the interpretation now as valid JSON only. No other text.
"""

    return prompt
