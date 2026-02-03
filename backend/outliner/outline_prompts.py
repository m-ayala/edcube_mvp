"""
Prompts for Phase 1: Course Outline Generation
"""

from config import OutlinerConfig
from typing import Dict


def get_box_generation_prompt(teacher_input: Dict) -> str:
    """
    Generate the prompt for creating a GROUPED course outline.
    Output is sections (chapters) containing subsections (individual lessons).
    
    Args:
        teacher_input: Teacher's requirements (grade, subject, topic, duration, etc.)
    
    Returns:
        str: Prompt for LLM
    """
    grade_level = teacher_input['grade_level']
    subject = teacher_input['subject']
    topic = teacher_input['topic']
    duration = teacher_input['duration']
    total_minutes = teacher_input['total_minutes']
    requirements = teacher_input['requirements']

    # Target 2x content so teacher has flexibility
    target_total_minutes = total_minutes * 2

    prompt = f"""
You are an expert elementary education curriculum designer. Generate a structured course outline for the following topic. The outline must be organized into SECTIONS (logical chapters) and SUBSECTIONS (individual lessons within each chapter).

TEACHER INPUT:
- Grade Level: {grade_level}
- Subject: {subject}
- Topic: {topic}
- Available Teaching Time: {duration} ({total_minutes} minutes)
- Special Requirements: {requirements}

PLA FRAMEWORK (every subsection must map to one or more of these pillars):
{OutlinerConfig.PLA_FRAMEWORK}

WHAT SECTIONS AND SUBSECTIONS MEAN:
- A SECTION is a logical chapter or grouping. Example: "Introduction to MLK" or "The Civil Rights Movement in the 1960s". It groups related lessons together.
- A SUBSECTION is one individual lesson inside that chapter. Example: under "Introduction to MLK", the subsections might be "What is Segregation", "MLK's Early Life", "Growing Up in the South". Each subsection is one teachable unit with its own topic box, resources, and hands-on activities.

DESIGN RULES:
1. Generate 3-5 sections total
2. Each section must have 2-4 subsections
3. Each subsection is one lesson: 15-30 minutes, independently teachable
4. Target ~{target_total_minutes} total minutes across ALL subsections (2x teacher time for flexibility)
5. Topics must be BROAD and well-known — easy to find YouTube videos, worksheets, and activities for
6. Every subsection needs specific learning objectives and content keywords (these are used later to find real resources)
7. Section and subsection descriptions should be clear enough for a teacher to understand the lesson at a glance
8. Sections should flow in a logical teaching order (e.g. foundational knowledge first, then deeper dives, then application)

EXAMPLE OF GOOD STRUCTURE (for MLK topic):
Section 1: "Introduction to MLK"
- Subsection 1.1: "What is Segregation" (20 min)
- Subsection 1.2: "MLK's Early Life" (18 min)
- Subsection 1.3: "Growing Up in the South" (22 min)
Section 2: "The Civil Rights Movement"
- Subsection 2.1: "The Montgomery Bus Boycott" (25 min)
- Subsection 2.2: "Sit-Ins and Protests" (20 min)
Section 3: "MLK's Legacy"
- Subsection 3.1: "The 'I Have a Dream' Speech" (22 min)
- Subsection 3.2: "MLK's Impact Today" (18 min)

OUTPUT FORMAT (strict JSON, no other text):
{{
"topic": "{topic}",
"grade_level": "{grade_level}",
"subject": "{subject}",
"teacher_time_budget_minutes": {total_minutes},
"sections": [
{{
    "section_id": "section_1",
    "title": "string (chapter name)",
    "description": "string (what this chapter covers, 1-2 sentences)",
    "subsections": [
    {{
        "subsection_id": "section_1_sub_1",
        "title": "string (lesson name, broad and resource-friendly)",
        "description": "string (what students will learn in this lesson, 1-2 sentences)",
        "duration_minutes": 0,
        "pla_pillars": ["Self-Knowledge", "Knowledge", "Wisdom", "Application"],
        "learning_objectives": ["string - specific, measurable goals"],
        "content_keywords": ["string - key concepts for finding resources"],
        "what_must_be_covered": "string - detailed content description for resource finding"
    }}
    ]
}}
]
}}

IMPORTANT:
- Be VERY specific in learning_objectives, content_keywords, and what_must_be_covered. These are used by a second system to find real YouTube videos and worksheets — vague keywords will find bad resources.
- Use age-appropriate language for grade {grade_level}
- Worksheets and activities are NOT generated here — leave them out entirely
- Address teacher's requirements: {requirements}

Generate the course outline now as valid JSON only. No other text.
"""

    return prompt