"""
Prompts for Phase 1: Course Outline Generation
"""

from config import OutlinerConfig
from typing import Dict


def get_box_generation_prompt(teacher_input: Dict, has_images: bool = False) -> str:
    """
    Generate the prompt for creating a course outline.
    Sections = teaching days. Subsections = hour-long lessons within each day.
    """
    age_range_start = teacher_input.get('age_range_start', '')
    age_range_end = teacher_input.get('age_range_end', '')
    num_students = teacher_input.get('num_students', '')
    age_range = f"{age_range_start}–{age_range_end} years old"
    subject = teacher_input['subject']
    topic = teacher_input['topic']
    num_days = teacher_input['num_days']
    hours_per_day = teacher_input['hours_per_day']
    requirements = teacher_input['requirements']

    # Each subsection = 1 hour. Number of subsections per section = hours_per_day.
    subsections_per_day = int(hours_per_day) if hours_per_day == int(hours_per_day) else hours_per_day

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
You are an expert elementary education curriculum designer. Generate a structured course outline for the following topic.

TIME MODEL:
- Each SECTION = one teaching DAY
- Each SUBSECTION = one HOUR of teaching within that day
- You will later generate content blocks (15–45 min each) that fill each subsection/hour

{image_instruction}
TEACHER INPUT:
- Student Age Range: {age_range}
- Number of Students: {num_students}
- Subject: {subject}
- Topic: {topic}
- Course Length: {num_days} day(s), {hours_per_day} teaching hour(s) per day
- Special Requirements: {requirements}

PLA FRAMEWORK (every subsection must map to one or more of these pillars):
{OutlinerConfig.PLA_FRAMEWORK}

WHAT SECTIONS AND SUBSECTIONS MEAN:
- A SECTION = one full teaching day. Title it "Day N: [specific aspect of {topic}]". Generate EXACTLY {num_days} section(s).
- A SUBSECTION = one hour-long lesson within that day. Each day must have EXACTLY {subsections_per_day} subsection(s). The subsection's duration_minutes field must be 60.
- Content blocks (worksheets, activities, explanations) will be generated separately — do NOT include them here.

CRITICAL SPECIFICITY RULES:
- ALL titles and descriptions must be SPECIFIC to "{topic}" for students aged {age_range} — never use generic filler
- Section titles must name the specific aspect of "{topic}" covered that day (e.g. "Day 1: What Is the Water Cycle and Why Does It Matter?")
- Subsection titles must describe the EXACT concept or skill for that hour — start with an activity hint when possible: "Understanding:", "Exploring:", "Practicing:", "Investigating:", "Comparing:", "Applying:", etc.
- Subsection descriptions must be 2-3 sentences with CONCRETE details about what students will learn — not vague summaries. Keep descriptions under 400 characters.
- Learning objectives must use measurable action verbs (identify, explain, compare, demonstrate, calculate, describe, list, classify) and reference specific content from "{topic}"
- Content keywords must be precise enough that searching YouTube for "{age_range_start}-{age_range_end} year old [keyword]" would find relevant educational videos
- what_must_be_covered must detail the SPECIFIC facts, concepts, or skills — as if briefing a substitute teacher

BAD EXAMPLES (too generic — DO NOT do this):
- Section: "Introduction to the Topic" / "Foundational Concepts" / "Exploring Key Ideas"
- Subsection: "Key Vocabulary" / "Main Ideas" / "Practice and Review" / "Introduction" / "Wrap Up"
- Learning objective: "Students will understand the topic" / "Students will learn key concepts"
- Content keyword: "introduction" / "basics" / "review"

GOOD EXAMPLES (for topic "The Water Cycle", ages 8–9, 2 days × 2 hours/day):
- Section: "Day 1: Where Does Water Go? — Evaporation and Condensation"
  - Subsection 1: "Understanding: How the Sun Turns Water Into Invisible Vapor" (60 min)
    Description: "Students explore evaporation by observing how heat from the sun causes liquid water to become water vapor. Real-life examples: puddles drying up, wet laundry on a line. Key vocabulary: evaporate, water vapor, heat energy."
  - Subsection 2: "Exploring: How Water Vapor Becomes Clouds — Condensation in Action" (60 min)
    Description: "Students learn how rising water vapor cools and condenses into tiny droplets that form clouds. They observe condensation on a cold glass and connect it to cloud formation."
- Section: "Day 2: Completing the Cycle — Precipitation and Runoff"
  - Subsection 1: "Investigating: Why Does It Rain? Understanding Precipitation" (60 min)
  - Subsection 2: "Applying: Tracing Water from Rain to River to Ocean" (60 min)

UNIQUENESS RULES (CRITICAL — violations make the course worthless):
- Every subsection across ALL sections must cover COMPLETELY DIFFERENT content — no concept, skill, vocabulary set, or activity type may be repeated in two different subsections
- Before assigning a subsection title or description, mentally check: "has this concept appeared in any earlier section or subsection?" If yes, pick a different concept
- Subsections within the same section must also be distinct from each other — no two subsections in the same day should teach overlapping ideas
- Think of the full course as one continuous progression: Day 1 introduces X, Day 2 deepens with Y, Day 3 applies Z — never revisiting the same territory

DESIGN RULES:
1. Generate EXACTLY {num_days} section(s) — one per teaching day
2. Each section must have EXACTLY {subsections_per_day} subsection(s) — one per teaching hour
3. Every subsection has duration_minutes = 60
4. Sections must flow in logical teaching order (foundational concepts first, then deeper dives, then application)
5. Topics must be specific yet well-known enough to find YouTube videos and worksheets for
6. Every subsection needs specific learning objectives and content keywords (used by an automated system to find real resources — vague keywords will find irrelevant resources)
7. Plan ALL subsection titles for all sections BEFORE writing any descriptions — this forces you to see the full picture and catch repeats early

OUTPUT FORMAT (strict JSON, no other text):
{{
"topic": "{topic}",
"age_range": "{age_range}",
"subject": "{subject}",
"num_days": {num_days},
"hours_per_day": {hours_per_day},
"sections": [
{{
    "section_id": "section_1",
    "title": "Day 1: [specific aspect of {topic}]",
    "description": "string (what this day covers with specific subtopics mentioned, 2-3 sentences, max 400 characters)",
    "subsections": [
    {{
        "subsection_id": "section_1_sub_1",
        "title": "string (e.g. 'Understanding: How Volcanoes Form' or 'Investigating: The Role of Tectonic Plates')",
        "description": "string (2-3 sentences with concrete details about what students will DO and LEARN — name specific concepts, vocabulary, and examples; max 400 characters)",
        "duration_minutes": 60,
        "pla_pillars": ["Self-Knowledge", "Knowledge", "Wisdom", "Application"],
        "learning_objectives": ["string - specific, measurable goals using action verbs and referencing actual content"],
        "content_keywords": ["string - precise terms for finding YouTube videos and worksheets appropriate for ages {age_range_start}–{age_range_end}"],
        "what_must_be_covered": "string - detailed content brief as if instructing a substitute teacher: specific facts, vocabulary, examples"
    }}
    ]
}}
]
}}

IMPORTANT:
- Be VERY specific in learning_objectives, content_keywords, and what_must_be_covered.
- All content must be age-appropriate for students aged {age_range_start}–{age_range_end} years old.
- Do NOT include worksheets or activities in the outline — those are generated separately per subsection.
- Address teacher's requirements: {requirements}
- STRICTLY generate {num_days} section(s) with {subsections_per_day} subsection(s) each.
- BEFORE outputting JSON: mentally scan every subsection title and confirm no two are the same or closely similar. If you find a duplicate, replace it with a genuinely distinct concept.

Generate the course outline now as valid JSON only. No other text.
"""

    return prompt