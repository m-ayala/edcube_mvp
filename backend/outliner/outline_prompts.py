"""
Prompts for Phase 1: Course Outline Generation
"""

from config import OutlinerConfig
from typing import Dict

DEPTH_LEVELS = ["Basics", "Intermediate", "Advanced"]


def get_box_generation_prompt(teacher_input: Dict, has_images: bool = False) -> str:
    """
    Generate the prompt for creating a course outline.
    Sections = teaching days/themes. Subsections are NOT generated here — they are
    proposed per-section in Phase 1.5 (subsection ideation & selection) and reviewed
    by the teacher before any block content is written.
    """
    age_range_start = teacher_input.get('age_range_start', '')
    age_range_end = teacher_input.get('age_range_end', '')
    num_students = teacher_input.get('num_students', '')
    age_range = f"{age_range_start}–{age_range_end} years old"
    course_name = teacher_input.get('course_name', '')
    num_days = teacher_input['num_days']
    hours_per_day = teacher_input['hours_per_day']
    requirements = teacher_input['requirements']

    image_instruction = ""
    if has_images:
        image_instruction = """
REFERENCE IMAGES PROVIDED:
The teacher has uploaded reference images (e.g., syllabus pages, curriculum guides, textbook pages, whiteboard notes, or other materials). Carefully analyze each image and extract:
- Any specific topics, subtopics, or concepts to cover
- Vocabulary words or key terms visible in the images
- Learning objectives or standards mentioned
- Suggested activities, projects, or assessment ideas
- Any sequencing or pacing information
Incorporate all relevant details extracted from the images into the course outline below.
"""

    prompt = f"""
You are an expert elementary education curriculum designer. Generate a structured course outline for the following course.

TIME MODEL:
- Each SECTION = one teaching DAY / theme within the course
- Subsections (the actual lessons within a day) are NOT generated here — a later step proposes
  candidate subsections per section for the teacher to review and select. Do NOT include a
  "subsections" field in your output.

{image_instruction}
TEACHER INPUT:
- Course Name: {course_name}
- Student Age Range: {age_range}
- Number of Students: {num_students}
- Course Length: {num_days} day(s), {hours_per_day} teaching hour(s) per day
- Special Requirements: {requirements}

Infer the subject and specific theme of this course from the Course Name above — course names are
usually self-descriptive (e.g. "Science Camp", "The Water Cycle", "Art & Theater Camp").

PLA FRAMEWORK (context for what this course should build toward):
{OutlinerConfig.PLA_FRAMEWORK}

WHAT A SECTION MEANS:
- A SECTION = one full teaching day/theme. Title it "Day N: [specific aspect of {course_name}]". Generate EXACTLY {num_days} section(s).
- Each section must declare a depth_ceiling: one of {DEPTH_LEVELS} — how deep this section's
  content is allowed to go. Base this on {hours_per_day} teaching hour(s)/day and the age range:
  more hours per day and older students support a higher ceiling (up to "Advanced"); fewer hours
  or younger students should stay at "Basics" or "Intermediate".

CRITICAL SPECIFICITY RULES:
- ALL titles and descriptions must be SPECIFIC to "{course_name}" for students aged {age_range} — never use generic filler
- Section titles must name the specific aspect of "{course_name}" covered that day (e.g. "Day 1: What Is the Water Cycle and Why Does It Matter?")
- Section descriptions must be 2-3 sentences with CONCRETE details about what students will learn that day — not vague summaries. Keep descriptions under 400 characters.

BAD EXAMPLES (too generic — DO NOT do this):
- Section: "Introduction to the Topic" / "Foundational Concepts" / "Exploring Key Ideas"

GOOD EXAMPLES (for course "The Water Cycle", ages 8–9, 2 days × 2 hours/day):
- Section: "Day 1: Where Does Water Go? — Evaporation and Condensation" (depth_ceiling: "Intermediate")
- Section: "Day 2: Completing the Cycle — Precipitation and Runoff" (depth_ceiling: "Intermediate")

UNIQUENESS RULES (CRITICAL — violations make the course worthless):
- Every section must cover COMPLETELY DIFFERENT territory — no theme, concept, or vocabulary set may be repeated across two different sections
- Think of the full course as one continuous progression: Day 1 introduces X, Day 2 deepens with Y, Day 3 applies Z — never revisiting the same territory

DESIGN RULES:
1. Generate EXACTLY {num_days} section(s) — one per teaching day
2. Sections must flow in logical teaching order (foundational themes first, then deeper dives, then application)
3. Themes must be specific yet well-known enough that a later step can find real learning resources for them
4. Do NOT include subsections, topic boxes, worksheets, or activities in this output — those come later

OUTPUT FORMAT (strict JSON, no other text):
{{
"age_range": "{age_range}",
"num_days": {num_days},
"hours_per_day": {hours_per_day},
"sections": [
{{
    "section_id": "section_1",
    "title": "Day 1: [specific aspect of {course_name}]",
    "description": "string (what this day covers with specific subtopics mentioned, 2-3 sentences, max 400 characters)",
    "depth_ceiling": "string — one of {DEPTH_LEVELS}"
}}
]
}}

IMPORTANT:
- All content must be age-appropriate for students aged {age_range_start}–{age_range_end} years old.
- Do NOT include subsections, worksheets, or activities in the outline — those are generated in later steps.
- Address teacher's requirements: {requirements}
- STRICTLY generate {num_days} section(s).
- BEFORE outputting JSON: mentally scan every section title and confirm no two are the same or closely similar. If you find a duplicate, replace it with a genuinely distinct theme.

Generate the course outline now as valid JSON only. No other text.
"""

    return prompt
