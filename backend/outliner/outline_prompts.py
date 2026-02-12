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
- A SECTION is a logical chapter or grouping. It groups related lessons together.
- A SUBSECTION is one individual lesson inside that chapter. Each subsection is one teachable unit with its own topic box, resources, and hands-on activities.

CRITICAL SPECIFICITY RULES:
- ALL titles and descriptions must be SPECIFIC to "{topic}" for Grade {grade_level} — never use generic filler
- Section titles must name the specific aspect of "{topic}" being explored, NOT generic labels like "Introduction", "Core Concepts", "Advanced Topics", or "Review and Assessment"
- Subsection titles must describe the EXACT learning activity or concept — start with an activity type when possible: "Watch:", "Experiment:", "Visual Models:", "Discussion:", "Practice:", "Read:", "Draw:", "Sort:", "Compare:", etc.
- The subsection title should tell a teacher EXACTLY what happens during this learning block
- Subsection descriptions must be 2-3 sentences with CONCRETE details about what students will do and learn — not vague summaries
- Learning objectives must use measurable action verbs (identify, explain, compare, demonstrate, calculate, describe, list, classify) and reference specific content from "{topic}"
- Content keywords must be precise enough that searching YouTube for "Grade {grade_level} [keyword]" would find relevant educational videos
- what_must_be_covered must detail the SPECIFIC facts, concepts, or skills — as if briefing a substitute teacher

BAD EXAMPLES (too generic — DO NOT do this):
- Section: "Introduction to the Topic" / "Foundational Concepts" / "Exploring Key Ideas"
- Subsection: "Key Vocabulary" / "Main Ideas" / "Practice and Review" / "Introduction" / "Key Facts" / "Wrap Up"
- Learning objective: "Students will understand the topic" / "Students will learn key concepts"
- Content keyword: "introduction" / "basics" / "review"

GOOD EXAMPLES (for topic "The Water Cycle", Grade 3):
- Section: "Where Does Rain Come From? — Understanding Evaporation and Condensation"
- Subsection: "Watch: How the Sun Turns Puddles Into Water Vapor" (10 min)
  Description: "Students watch a short video showing how heat from the sun causes water to change from liquid to invisible gas. Real-life examples include puddles drying up on a sunny day and wet clothes drying on a clothesline. Introduces vocabulary: evaporation, water vapor, heat energy."
- Subsection: "Experiment: Measuring Evaporation with Two Cups of Water" (15 min)
  Description: "Students place two cups of water — one in direct sunlight and one in the shade — and predict which will lose more water. They measure and record water levels over time to observe evaporation in action."
- Learning objective: "Students will explain how heat from the sun causes water to evaporate from lakes, rivers, and oceans"
- Content keywords: ["water cycle evaporation", "sun heats water", "water vapor for kids", "evaporation experiment grade 3"]

GOOD EXAMPLES (for topic "Fractions", Grade 5):
- Section: "What Are Fractions? — Dividing Wholes into Equal Parts"
- Subsection: "Visual Models: Using Fraction Bars to Show 1/2, 1/3, and 1/4" (10 min)
  Description: "Students use fraction bar manipulatives to see how wholes divide into equal parts, comparing the size of 1/2, 1/3, and 1/4 pieces side by side. Teaches numerator (parts taken) and denominator (total equal parts)."
- Subsection: "Word Problems: Sharing Pizza Slices with Friends" (15 min)
  Description: "Students solve real-world fraction problems about dividing pizza equally among friends, writing fractions with correct numerator and denominator. Practice naming fractions from pictures: 1/2, 1/3, 1/4, 2/3, 3/4."
- Learning objective: "Students will identify and name fractions using real-world examples of dividing food into equal parts"
- Content keywords: ["fractions for kids grade 5", "naming fractions pizza", "numerator denominator", "equal parts fractions"]

DESIGN RULES:
1. Generate 3-5 sections total
2. Each section must have 2-4 subsections
3. Each subsection is one lesson: 15-30 minutes, independently teachable
4. Target ~{target_total_minutes} total minutes across ALL subsections (2x teacher time for flexibility)
5. Topics must be specific yet well-known enough to find YouTube videos, worksheets, and activities for
6. Every subsection needs specific learning objectives and content keywords (these are used later by an automated system to find real resources — vague keywords will find bad or irrelevant resources)
7. Section and subsection descriptions should be clear enough for a teacher to understand the lesson at a glance
8. Sections should flow in a logical teaching order (foundational knowledge first, then deeper dives, then application/synthesis)

OUTPUT FORMAT (strict JSON, no other text):
{{
"topic": "{topic}",
"grade_level": "{grade_level}",
"subject": "{subject}",
"teacher_time_budget_minutes": {total_minutes},
"sections": [
{{
    "section_id": "section_1",
    "title": "string (specific chapter name tied to {topic})",
    "description": "string (what this chapter covers with specific subtopics mentioned, 2-3 sentences)",
    "subsections": [
    {{
        "subsection_id": "section_1_sub_1",
        "title": "string (activity-specific title, e.g. 'Watch: How Volcanoes Erupt' or 'Experiment: Building a Baking Soda Volcano')",
        "description": "string (2-3 sentences with concrete details about what students will DO and LEARN — name specific activities, materials, examples, and vocabulary)",
        "duration_minutes": 0,
        "pla_pillars": ["Self-Knowledge", "Knowledge", "Wisdom", "Application"],
        "learning_objectives": ["string - specific, measurable goals using action verbs and referencing actual content"],
        "content_keywords": ["string - precise terms for finding Grade {grade_level} YouTube videos and worksheets"],
        "what_must_be_covered": "string - detailed content brief as if instructing a substitute teacher: specific facts, vocabulary, examples, and activities"
    }}
    ]
}}
]
}}

IMPORTANT:
- Be VERY specific in learning_objectives, content_keywords, and what_must_be_covered. These are used by an automated system to find real YouTube videos and worksheets — vague or generic keywords will find irrelevant resources and ruin the course.
- Use age-appropriate language for grade {grade_level}
- Worksheets and activities are NOT generated here — leave them out entirely
- Address teacher's requirements: {requirements}

Generate the course outline now as valid JSON only. No other text.
"""

    return prompt