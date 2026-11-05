"""
Course Builder Stage 1 prompts (see tasks/course-builder-spec.md, Prompt 1).

No pedagogy is typed here: age-band notes and objective categories are filled in
by code from the knowledge base. The legacy PLA_FRAMEWORK text is deliberately not used.
"""

from typing import Dict, List


def _objective_lines(categories: List[Dict]) -> str:
    return "\n".join(
        f"- {c['id']} — {c.get('label', c['id'])} — {c.get('description', '')}" for c in categories
    )


def _course_block(c: Dict) -> str:
    return (
        f"- Name: {c['course_name']}\n"
        f"- Students: ages {c['age_min']}–{c['age_max']}, {c['num_students']} in the class\n"
        f"- Time: {c['num_days']} days, {c['hours_per_day']} hours of teaching per day\n"
        f"{requirements_block(c.get('requirements'))}"
    )


def requirements_block(requirements) -> str:
    """The teacher's own objectives / requirements, as a binding section of the prompt.

    The teacher typed these on purpose, so they are instructions, not background: specific
    items (named topics, tools, projects, standards, a day-by-day order, things to avoid)
    must appear exactly as asked. Shared with the day-planning prompts.
    """
    text = str(requirements or "").strip()
    if not text or text.lower() == "none":
        return "\nTEACHER'S REQUIREMENTS\n(none given)"
    return f"""
TEACHER'S REQUIREMENTS (the teacher wrote these; they are instructions you MUST follow)
\"\"\"
{text}
\"\"\"
- Follow every requirement above. They take priority over the general guidance in this prompt
  (age-group notes, objective categories, example structures) whenever the two conflict.
- Be literal with specific requests: a named topic, tool, kit, software, project, standard,
  vocabulary list, book, day-by-day order, or anything the teacher says to include or avoid
  must appear exactly as asked, using the teacher's own words for names.
- If the teacher lists objectives or goals, every one of them must be clearly covered.
- Do not swap a requested item for something you think is better or more typical."""


def _age_block(band: Dict) -> str:
    return (
        f"WHAT SUITS THIS AGE GROUP ({band.get('label', 'unknown')})\n"
        f"{band.get('developmental_notes', '')}\n{band.get('pedagogy_notes', '')}"
    )


def build_three_outlines_prompt(course: Dict, band: Dict, categories: List[Dict]) -> str:
    return f"""You are planning a course with a teacher.

COURSE
{_course_block(course)}

{_age_block(band)}

LEARNING OBJECTIVE CATEGORIES (the course as a whole must touch every one)
{_objective_lines(categories)}

TASK
Propose 3 outlines for this course. They must differ in how the course is organised,
not just in wording: for example one that teaches part by part, one built around a
single project that grows each day, one that opens each day with a challenge.

Each outline has exactly {course['num_days']} days. For each day give:
- title: specific to the topic, never "Introduction" or "Wrap up"
- bullets: exactly 3, at most 12 words each, saying what is covered
- leads_to: one sentence on how this day sets up the next day. For the last day, say
  how it closes the thread of the course.
- objective_ids: the categories this day touches (use only the ids listed above)

Also give each outline a short name and a one-sentence description a teacher can use
to choose between them.

RULES
- Each day must need the day before it. A teacher should not be able to swap two days.
- Pitch every day at the age group above, and at what fits in {course['hours_per_day']} hours.
- Do not name individual worksheets or activities yet. That is the next step.
- All three outlines must follow every one of the teacher's requirements. The outlines may
  differ in how they are organised, never in whether they do what the teacher asked. If the
  teacher gave a day-by-day plan or order, every outline keeps it.

Return JSON: {{"outlines": [{{"name": "...", "description": "...", "days": [{{"title": "...", "bullets": ["...", "...", "..."], "leads_to": "...", "objective_ids": ["..."]}}]}}]}}"""


def build_single_outline_prompt(course: Dict, band: Dict, categories: List[Dict]) -> str:
    """One-day course: Stage 1 is skipped, so only one outline (one day) is produced."""
    return f"""You are planning a one-day course with a teacher.

COURSE
{_course_block(course)}

{_age_block(band)}

LEARNING OBJECTIVE CATEGORIES (the day should touch every one where it fits naturally)
{_objective_lines(categories)}

TASK
Propose 1 outline with exactly 1 day. Give the day:
- title: specific to the topic, never "Introduction" or "Wrap up"
- bullets: exactly 3, at most 12 words each, saying what is covered
- leads_to: one sentence on how this day closes the thread of the course
- objective_ids: the categories this day touches (use only the ids listed above)
Also give the outline a short name and a one-sentence description.

RULES
- Pitch the day at the age group above, and at what fits in {course['hours_per_day']} hours.
- Do not name individual worksheets or activities yet. That is the next step.
- Follow every one of the teacher's requirements.

Return JSON: {{"outlines": [{{"name": "...", "description": "...", "days": [{{"title": "...", "bullets": ["...", "...", "..."], "leads_to": "...", "objective_ids": ["..."]}}]}}]}}"""


def build_edit_outline_prompt(course: Dict, band: Dict, categories: List[Dict],
                              outline_json: str, history_text: str, message: str) -> str:
    return f"""You are Edo, helping a teacher revise the outline of their course.

COURSE
{_course_block(course)}

{_age_block(band)}

LEARNING OBJECTIVE CATEGORIES
{_objective_lines(categories)}

CURRENT OUTLINE (each day has an "id")
{outline_json}

{history_text}TEACHER'S MESSAGE
{message}

TASK
Revise the outline to do what the teacher asks. Return the FULL outline.

RULES
- Keep exactly {course['num_days']} days, in the same order, with the same "id" values.
- Change only what the message requires, plus every other day affected by it. Before
  answering, read the title, all 3 bullets and the "leads_to" of EVERY day and check
  whether it names, assumes or depends on what you changed (for example a tool or
  topic that was swapped out, or a skill taught on a changed day). Rewrite each such
  day so the whole course is consistent. Copy only days that are truly unaffected,
  word for word.
- Every day keeps a specific title, exactly 3 bullets of at most 12 words each, a
  "leads_to" sentence, and "objective_ids" using only the ids listed above.
- Every day you rewrite must still follow the teacher's requirements above.
- Keep the outline's "name" and "description" unless the message changes the approach.
- Do not name individual worksheets or activities.
- "reply": ONE short plain sentence giving the teacher your reason or approach. Plain
  English, under 120 characters, a reason only (for example "Because ..." or
  "Arduino is cheaper and easier for this age group."). Do NOT mention days, lessons,
  weekdays or numbers, and do NOT say or imply what you changed, added, merged or
  kept (the app adds that itself). If the request cannot be done within {course['num_days']} days or conflicts
  with the requirements, change nothing and give the reason in that sentence.

Return JSON: {{"reply": "...", "outline": {{"name": "...", "description": "...", "days": [{{"id": "...", "title": "...", "bullets": ["...", "...", "..."], "leads_to": "...", "objective_ids": ["..."]}}]}}}}"""
