"""
Prompts for block generation within a subsection.
Each subsection = 1 hour. Blocks are 15/30/45-min content/worksheet/activity chunks.
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


def get_block_generation_prompt(
    teacher_input: Dict,
    subsection: Dict,
    section_title: str,
    worksheet_slots: int,
    activity_slots: int,
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

    # Derive content block count: fill remaining time after worksheet + activity
    # Each block is 15, 30, or 45 min. Target total: 30–60 min.
    # Assume worksheet = 15 min, activity = 30 min. Content fills the rest.
    # We let the AI decide exact durations, just enforce the constraints.
    content_slots = "at least 1"  # always include at least one content block

    worksheet_instruction = ""
    if worksheet_slots == 1:
        worksheet_instruction = f"""
WORKSHEET BLOCK (include exactly 1):
- type: "worksheet"
- worksheetType: one of {WORKSHEET_TYPES} — pick the type best suited to the age group and learning objective
- duration_minutes: 15
- Title should describe exactly what the worksheet is (e.g. "Label the Parts of a Flower")
- Content field must follow this exact structure:

**Learning Objectives:**
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
- duration_minutes: 30
- Title should describe exactly what students do (e.g. "Build a Simple Robot Arm")
- Content field must follow this exact structure:

**Learning Objectives:**
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

    prompt = f"""
You are an expert elementary education curriculum designer. Generate the content blocks for ONE HOUR of teaching.

COURSE CONTEXT:
- Subject: {subject}
- Topic: {topic}
- Student Age Range: {age_range}
- Day: {section_title}
- This Hour: {sub_title}
- Hour Description: {sub_description}
- Learning Objectives:
{objectives_text}
- What Must Be Covered: {what_must_be_covered}
- Special Requirements: {requirements}

TIME BUDGET:
- This subsection = 1 hour (60 minutes) of teaching
- Total block time must be between 30 and 60 minutes (inclusive) — do NOT exceed 60 minutes
- You do not need to fill the full 60 minutes; 30–45 minutes of blocks is fine
- Each block must be exactly 15, 30, or 45 minutes

BLOCK TYPES TO GENERATE:

CONTENT BLOCK(S) (include {content_slots}):
- type: "content"
- subcategory: one of {CONTENT_SUBCATEGORIES}
  Pick the subcategory that best describes the block (e.g. "Definitions" for vocab, "Process" for step-by-step, "Parts of" for anatomy, "Compare & Contrast" for comparisons)
- duration_minutes: 15 (each content block covers one focused concept — keep blocks short)
- Title: specific and descriptive (e.g. "What Is a Robot?", "Parts of a Robot", "Types of Robots")
  IMPORTANT: Each block must cover EXACTLY ONE concept. Never bundle multiple concepts into one block.
  If a subsection has several concepts (e.g. what it is, its parts, its types), generate a SEPARATE block for each.
- Content field must follow this exact structure:

  **Learning Objective:**
  Students will [measurable verb] [specific concept].

  **Description:**
  [2-4 sentence plain explanation of THIS ONE concept — what it is, how it works, why it matters. Keep it simple and age-appropriate for {age_range}.]

  **Key [concept-specific noun]:**
  - [Part or element 1]: brief explanation
  - [Part or element 2]: brief explanation
  - [Part or element 3]: brief explanation

  **Pedagogy:**
  How to teach this concept to {age_range} students:
  1. Opening hook: [specific hook idea]
  2. Main explanation: [what to say, show, or demonstrate]
  3. Mid-lesson check: [one specific question to verify understanding]
  4. Common confusion: [what students typically get wrong and how to fix it]
  5. Reinforcement: [short activity, example, or prompt to make it stick]

  **Example:**
  [One concrete, specific, relatable example for {age_range}]

{worksheet_instruction}

{activity_instruction}

CONTENT QUALITY RULES:
- Every block must be directly tied to "{topic}" for students aged {age_range}
- Each content block covers EXACTLY ONE concept — never bundle multiple concepts into a single block
- Content blocks should progress logically within the hour (e.g. definition first, then parts, then types, then application)
- All vocabulary, examples, and complexity must be appropriate for ages {age_range_start}–{age_range_end}
- Block titles must be specific — never generic like "Introduction" or "Review"
- The total duration_minutes of all blocks combined must be between 30 and 60
- Worksheet **Worksheet Content:** must be complete verbatim student text — not instructions about what to generate

OUTPUT FORMAT (strict JSON, no other text):
{{
  "blocks": [
    {{
      "id": "auto",
      "type": "content",
      "subcategory": "string — from the content subcategory list",
      "title": "string — specific single-concept block title (e.g. 'What Is a Robot?')",
      "content": "**Learning Objective:**\\nStudents will [verb] [concept].\\n\\n**Description:**\\n[2-4 sentence plain explanation of this ONE concept]\\n\\n**Key [noun]:**\\n- [Part 1]: explanation\\n- [Part 2]: explanation\\n- [Part 3]: explanation\\n\\n**Pedagogy:**\\nHow to teach this concept to [age]-year-olds:\\n1. Opening hook: ...\\n2. Main explanation: ...\\n3. Mid-lesson check: ...\\n4. Common confusion: ...\\n5. Reinforcement: ...\\n\\n**Example:**\\n[Concrete example]",
      "duration_minutes": 15
    }},
    {{
      "id": "auto",
      "type": "worksheet",
      "worksheetType": "string — from the worksheet type list",
      "title": "string — specific worksheet title",
      "content": "**Learning Objectives:**\\nStudents will [verb] [thing].\\n\\n**Duration:** Approximately 15 minutes for students to complete.\\n\\n**Worksheet Type:** [type]\\n\\n**Worksheet Content:**\\n[Complete verbatim student-facing worksheet text]\\n\\n**Answer Key:**\\n[Complete answers numbered to match]",
      "duration_minutes": 15
    }},
    {{
      "id": "auto",
      "type": "activity",
      "activityType": "string — from the activity type list",
      "title": "string — specific activity title",
      "content": "**Learning Objectives:**\\nStudents will [verb] [thing].\\n\\n**Duration:** 30 minutes\\n\\n**Activity Type:** [type]\\n\\n**Resources/Materials Needed:**\\n- [Material 1]\\n- [Material 2]\\n\\n**Steps to Conduct:**\\n1. [Setup]\\n2. [Introduction]\\n3. [Main activity]\\n4. [Debrief]\\n5. [Wrap-up]\\n\\n**Management Tips:**\\n- [Tip 1]\\n- [Tip 2]\\n- [Tip 3]",
      "duration_minutes": 30
    }}
  ]
}}

Only include the block types specified above. Generate the blocks now as valid JSON only. No other text.
"""
    return prompt
