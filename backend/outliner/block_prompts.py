"""
Prompts for block generation within a subsection.
Each subsection = 1 hour. Blocks are 15/30-min content/worksheet/activity chunks.
"""

from typing import Dict


# Canonical lists used by the rest of the system (kept in sync with frontend)
WORKSHEET_TYPES = [
    "fill in the blanks",
    "comprehension",
    "answering questions",
    "name the images",
    "matching",
    "drawing",
    "multiple choice",
    "essay writing",
]

ACTIVITY_TYPES = [
    "quiz",
    "discussion",
    "experiment",
    "teamwork",
    "hands-on",
    "game",
]

CONTENT_SUBCATEGORIES = [
    "Definitions",
    "Concepts",
    "Theories",
    "Types of",
    "Parts of",
    "Process",
    "Methodologies",
    "Techniques",
    "Principles",
    "Frameworks",
    "Systems",
    "Rules & Formulas",
    "Critical Thinking",
    "Compare & Contrast",
    "Pattern Recognition",
    "Examine Evidence",
    "Synthesize",
    "History",
    "Evolution",
    "Perspectives",
    "Impact & Consequences",
]

# Flexible section toolkit for content blocks — LLM picks 3-5 per block
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


def get_block_generation_prompt(
    teacher_input: Dict,
    subsection: Dict,
    section_title: str,
    worksheet_slots: int,
    activity_slots: int,
    other_subsections: list = None,
    session_minutes: int = 60,
) -> str:
    """
    Build the prompt that generates content blocks for one subsection (1 hour).

    Args:
        teacher_input: Course-level info (topic, age_range_start/end, subject, requirements)
        subsection: The subsection dict with title, description, learning_objectives, what_must_be_covered
        section_title: Title of the parent section (day)
        worksheet_slots: 0 or 1 — how many worksheet blocks to include
        activity_slots: 0 or 1 — how many activity blocks to include

    Returns:
        str: Prompt for the LLM — expects JSON array { "blocks": [...] }
    """
    age_range_start = teacher_input.get('age_range_start', '')
    age_range_end = teacher_input.get('age_range_end', '')
    age_range = f"{age_range_start}–{age_range_end} years old"
    subject = teacher_input.get('subject', '')
    topic = teacher_input.get('topic', '')
    requirements = teacher_input.get('requirements', 'None')

    sub_title = subsection.get('title', '')
    sub_description = subsection.get('description', '')
    learning_objectives = subsection.get('learning_objectives', [])
    what_must_be_covered = subsection.get('what_must_be_covered', '')

    objectives_text = "\n".join(f"  - {o}" for o in learning_objectives) if learning_objectives else "  (none listed)"

    # Build a "do not repeat" list from all other subsections in the course
    already_covered_text = ""
    if other_subsections:
        lines = []
        for s in other_subsections:
            lines.append(f"  - {s['section']}: {s['subsection']}")
        already_covered_text = (
            "\nALREADY COVERED IN OTHER LESSONS (DO NOT REPEAT these concepts, titles, or activities):\n"
            + "\n".join(lines)
            + "\nYour blocks must cover content that is DISTINCT from all of the above.\n"
        )

    worksheet_instruction = ""
    if worksheet_slots == 1:
        worksheet_instruction = f"""
WORKSHEET BLOCK (include exactly 1):
- type: "worksheet"
- worksheetType: one of {WORKSHEET_TYPES} — pick the type best suited to the age group and learning objective
- duration_minutes: 15 (worksheets are always 15 minutes)
- contentBlockIndex: the 0-based index of the content block in this blocks array that this worksheet is designed to reinforce.
  Pick the content block whose concept is most worth testing or practising.
- Title should describe exactly what the worksheet is (e.g. "Label the Parts of a Flower")
- Content field must follow this exact structure:

**Learning Objective:**
Students will [verb] [specific thing].

**Duration:** Approximately 15 minutes for students to complete.

**Worksheet Type:** [chosen type from the list above]

**Worksheet Content:**
[WRITE THE COMPLETE VERBATIM STUDENT-FACING WORKSHEET TEXT HERE — every word, sentence, blank, question, answer option, comprehension passage, or drawing prompt exactly as it would appear on the printed worksheet. Do NOT write instructions about what to generate — write the actual content. This must be complete enough for another system to generate a PDF directly from this text.]

**Answer Key:**
[Complete answers for every blank, question, or item, numbered to match the worksheet.]
"""
    else:
        worksheet_instruction = "- Do NOT include any worksheet block in this subsection."

    activity_instruction = ""
    if activity_slots == 1:
        activity_instruction = f"""
ACTIVITY BLOCK (include exactly 1):
- type: "activity"
- activityType: one of {ACTIVITY_TYPES} — pick the type best suited to the learning objective and age group
- duration_minutes: 30 (activities are always 30 minutes)
- contentBlockIndex: the 0-based index of the content block in this blocks array that this activity is designed to reinforce.
  Pick the content block whose concept students most need to apply or experience hands-on.
- Title should describe exactly what students do (e.g. "Build a Simple Robot Arm")
- Content field must follow this exact structure:

**Learning Objective:**
Students will [verb] [specific thing].

**Duration:** 30 minutes

**Activity Type:** [chosen type from the list above]

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
"""
    else:
        activity_instruction = "- Do NOT include any activity block in this subsection."

    # Calculate safe total block budget: aim to fill 50–80% of session, never exceed it
    max_total = session_minutes
    min_total = min(15, session_minutes)
    target_total = max(15, round(session_minutes * 0.6))

    prompt = f"""
You are an expert curriculum designer. Generate the content blocks for this teaching session.

COURSE CONTEXT:
- Subject: {subject}
- Topic: {topic}
- Student Age Range: {age_range}
- Day: {section_title}
- This Session: {sub_title}
- Session Description: {sub_description}
- Learning Objectives:
{objectives_text}
- What Must Be Covered: {what_must_be_covered}
- Special Requirements: {requirements}
{already_covered_text}

TIME BUDGET:
- This session = {session_minutes} minutes of teaching
- Total block time must NOT exceed {max_total} minutes
- Aim for around {target_total} minutes of blocks (leave buffer for transitions and questions)
- Content blocks: exactly 15 or 30 minutes each. 15 for a single tight concept, 30 for a richer one that needs depth.
- Default to 15 minutes — only use 30 if the concept genuinely needs more time.

CONTENT BLOCK RULES:
- Think of each content block as ONE slide in a presentation — it should have enough to fill that slide.
- Each block covers EXACTLY ONE concept. NEVER bundle multiple concepts into a single block.
- If a subsection covers multiple distinct concepts (e.g. definition, how it works, types), generate a SEPARATE block for each.
- Blocks must progress logically (e.g. definition first → how it works → types → application).
- Titles must be specific: "What Is a Gear?" not "Introduction". "The Three Types of Rock" not "Types".

CONTENT BLOCK STRUCTURE:
{CONTENT_SECTION_TOOLKIT}
For each content block, choose the 3-5 sections from the toolkit above that best fit the concept.
Write the content field as natural flowing prose and lists — not a rigid form.
All vocabulary, examples, and complexity must be appropriate for ages {age_range_start}–{age_range_end}.

BLOCK TYPES TO GENERATE:

CONTENT BLOCK(S) (include at least 1, more if the what_must_be_covered spans multiple distinct concepts):
- type: "content"
- subcategory: one of {CONTENT_SUBCATEGORIES}
- duration_minutes: 15 or 30
- title: specific single-concept title
- content: the teaching content using 3-5 chosen sections from the toolkit
- key_takeaways: array of 3-5 concise bullet strings (used for PPT generation — must capture the essential points of this block)
- pedagogy: object with fields:
    teaching_approach: which strategy fits best and one sentence why
    memory_device: a concrete mnemonic, acronym, rhyme, or visual anchor (write the actual device)
    misconception: the most common student error and the correct mental model that fixes it
    guided_questions: array of 2-3 questions progressing from recall to deeper understanding
    mastery_signal: one observable thing a student says/does that proves they truly understood this concept
- visual_suggestion: one sentence describing an image or diagram that would illustrate this on a PPT slide
- sources: array of 2-3 objects, each with:
    name: well-known educational resource (e.g. "Khan Academy", "Encyclopedia Britannica Kids", "National Geographic Kids")
    search_query: the exact search terms a teacher would type to find this concept on that site
    type: one of "educational_site", "encyclopedia", "curriculum_standard", "textbook"

{worksheet_instruction}

{activity_instruction}

CONTENT QUALITY RULES:
- Every block must be directly tied to "{topic}" for students aged {age_range}
- Each content block covers EXACTLY ONE concept — never bundle
- Block titles must be specific — never "Introduction", "Overview", "Key Concepts", or "Review"
- Worksheet and activity content must be COMPLETE verbatim text, not instructions about what to generate
- The total duration_minutes of all blocks combined must NOT exceed {max_total} minutes

OUTPUT FORMAT (strict JSON, no other text):
{{
  "blocks": [
    {{
      "id": "auto",
      "type": "content",
      "subcategory": "string — from the content subcategory list",
      "title": "string — specific single-concept title",
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
      "id": "auto",
      "type": "worksheet",
      "worksheetType": "string — from the worksheet type list",
      "title": "string — specific worksheet title",
      "content": "string — complete verbatim student-facing worksheet with answer key",
      "contentBlockIndex": 0,
      "duration_minutes": 15
    }},
    {{
      "id": "auto",
      "type": "activity",
      "activityType": "string — from the activity type list",
      "title": "string — specific activity title",
      "content": "string — complete activity instructions with materials, steps, and management tips",
      "contentBlockIndex": 1,
      "duration_minutes": 30
    }}
  ]
}}

Only include the block types specified above. Generate the blocks now as valid JSON only. No other text.
"""
    return prompt
