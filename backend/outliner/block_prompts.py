"""
Prompts for block generation within a subsection.
Each subsection = 1 hour. Blocks are 15/30/45-min content/worksheet/activity chunks.
"""

from typing import Dict


# Canonical lists used by the rest of the system (kept in sync with frontend)
WORKSHEET_TYPES = [
    "fill in the blanks",
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
- worksheetType: one of {WORKSHEET_TYPES}
- Pick the type that best fits the learning objective
- duration_minutes: 15
- Title should describe exactly what students do (e.g. "Label the Parts of a Flower")
- Content field: concise instructions for the teacher on how to run it (what students fill in, match, draw, etc.)
"""
    else:
        worksheet_instruction = "- Do NOT include any worksheet block in this subsection."

    activity_instruction = ""
    if activity_slots == 1:
        activity_instruction = f"""
ACTIVITY BLOCK (include exactly 1):
- type: "activity"
- activityType: one of {ACTIVITY_TYPES}
- Pick the type that best fits the learning objective and age group
- duration_minutes: 30
- Title should describe exactly what students do (e.g. "Quiz: Water Cycle Vocabulary")
- Content field: step-by-step instructions for the teacher to run the activity
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
- duration_minutes: 15, 30, or 45
- Title: specific and descriptive (e.g. "What Is Photosynthesis? — Definition and Key Terms")
- Content field: full teacher-facing explanation structured as:
  **What is [concept]?** [1-2 sentence definition]
  **Key [concept-specific noun]:**
  - Point 1: explanation
  - Point 2: explanation
  **How to teach it:** 1. Opening hook → 2. Main explanation → 3. Mid-lesson check → 4. Common confusion to address → 5. Reinforcement
  **Example:** One concrete, age-appropriate example.

{worksheet_instruction}

{activity_instruction}

CONTENT QUALITY RULES:
- Every block must be directly tied to "{topic}" for students aged {age_range}
- Content blocks should progress logically within the hour (e.g. definition first, then process, then application)
- All vocabulary, examples, and complexity must be appropriate for ages {age_range_start}–{age_range_end}
- Block titles must be specific — never generic like "Introduction" or "Review"
- The total duration_minutes of all blocks combined must be between 30 and 60

OUTPUT FORMAT (strict JSON, no other text):
{{
  "blocks": [
    {{
      "id": "auto",
      "type": "content",
      "subcategory": "string — from the content subcategory list",
      "title": "string — specific block title",
      "content": "string — full formatted content as described above",
      "duration_minutes": 15
    }},
    {{
      "id": "auto",
      "type": "worksheet",
      "worksheetType": "string — from the worksheet type list",
      "title": "string — specific worksheet title",
      "content": "string — teacher instructions for running the worksheet",
      "duration_minutes": 15
    }},
    {{
      "id": "auto",
      "type": "activity",
      "activityType": "string — from the activity type list",
      "title": "string — specific activity title",
      "content": "string — step-by-step teacher instructions",
      "duration_minutes": 30
    }}
  ]
}}

Only include the block types specified above. Generate the blocks now as valid JSON only. No other text.
"""
    return prompt
