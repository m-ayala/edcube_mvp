"""
Prompts for Phase 2: Video Resource Generation
"""

from typing import Dict

def get_search_query_generation_prompt(section: Dict, grade_level: str, teacher_comments: str) -> str:
    """
    Generate the prompt for creating YouTube search queries for a section.
    
    Args:
        section: Section data from course outline
        grade_level: Grade level of students
        teacher_comments: Teacher's special requirements/objectives
    
    Returns:
        str: Prompt for LLM
    """
    section_title = section.get('title', '')
    section_description = section.get('description', '')
    duration_minutes = section.get('duration_minutes', 0)
    subtopics = section.get('subtopics', [])
    
    subject = section.get('subject', '')
    course_name = section.get('course_name', '')
    course_topic = section.get('course_topic', '')
    # Extract detailed objectives and keywords from instruction
    instruction = section.get('components', {}).get('instruction', {})
    learning_objectives = instruction.get('learning_objectives', [])
    content_keywords = instruction.get('content_keywords', [])
    what_must_be_covered = instruction.get('what_must_be_covered', '')
    
    # Extract subtopic details
    subtopic_list = []
    for subtopic in subtopics:
        topics = ', '.join(subtopic.get('topics', []))
        subtopic_list.append(topics)
    
    subtopics_text = '; '.join(subtopic_list) if subtopic_list else "N/A"
    objectives_text = '\n'.join([f"- {obj}" for obj in learning_objectives]) if learning_objectives else "N/A"
    keywords_text = ', '.join(content_keywords) if content_keywords else "N/A"
    
    # Parse grade level to int
    try:
        if isinstance(grade_level, str):
            if '-' in grade_level:
                grade_num = int(grade_level.split('-')[0])
            elif grade_level.lower().startswith('k'):
                grade_num = 0
            else:
                grade_num = int(grade_level)
        else:
            grade_num = int(grade_level)
    except (ValueError, TypeError):
        grade_num = 5
    
    prompt = f"""
You are an expert at finding educational YouTube videos for elementary students. Generate 1-3 optimal YouTube search queries for the following course section.

TEACHER'S PRIORITY OBJECTIVES (HIGHEST PRIORITY):
{teacher_comments if teacher_comments else "No special comments provided"}

SECTION DETAILS:
- Subject: {subject if subject else "Not specified"}
- Course Name: {course_name if course_name else "Not specified"}
- Course Topic: {course_topic if course_topic else "Not specified"}
- Section Title: {section_title}
- Description: {section_description}
- Subtopics: {subtopics_text}
- Duration: {duration_minutes} minutes
- Grade Level: {grade_level} (approximately {grade_num + 5} years old)

DETAILED LEARNING OBJECTIVES:
{objectives_text}

CONTENT KEYWORDS THAT MUST BE COVERED:
{keywords_text}

WHAT MUST BE COVERED IN THIS SECTION:
{what_must_be_covered if what_must_be_covered else "See learning objectives above"}

REQUIREMENTS FOR QUERY GENERATION:

1. ⚠️ MANDATORY: You MUST include "{course_name}" in EVERY query. Queries without "{course_name}" will be rejected.
   Example: Instead of "yarn types for kids" → "crochet yarn types for kids"
   
2. PRIORITIZE teacher's comments - these are non-negotiable learning goals

3. Each query should be 3-8 words maximum

4. DO NOT use redundant terms:
   - If course_name is "crochet" and subject is "Art", use ONLY "crochet" (not "art crochet")
   - Remove generic subject if course_name is more specific

EXAMPLE OUTPUT for course_name="crochet", section_title="Yarn Types and Uses":
{{
  "queries": [
    {{"priority": "primary", "query": "crochet yarn types for beginners"}},
    {{"priority": "secondary", "query": "different crochet yarn explained for kids"}},
    {{"priority": "tertiary", "query": "crochet yarn characteristics kids"}},
    {{"priority": "quaternary", "query": "understanding crochet yarn varieties"}}
  ]
}}

Now generate queries for THIS section (remember: include "{course_name}" in every query): 

QUERY STRATEGY:
- Primary query: Most specific to learning objectives and teacher's comments
- Secondary query: Broader backup if primary returns limited results
- Tertiary query: Alternative angle or complementary content
- Quaternary query: Fallback with simplified educational terms

AVOID:
- Overly generic queries that return thousands of irrelevant results
- Forced age indicators unless naturally appropriate
- Terms that would return college-level content (e.g., "documentary", "comprehensive analysis")

Generate EXACTLY 4 queries ranked by priority.

OUTPUT FORMAT (strict JSON):
{{
  "section_id": "{section.get('id', '')}",
  "section_title": "{section_title}",
  "queries": [
    {{
      "priority": "primary",
      "query": "string (3-8 words)",
      "rationale": "string"
    }},
    {{
      "priority": "secondary",
      "query": "string (3-8 words)",
      "rationale": "string"
    }},
    {{
      "priority": "tertiary",
      "query": "string (3-8 words)",
      "rationale": "string"
    }},
    {{
      "priority": "quaternary",
      "query": "string (3-8 words)",
      "rationale": "string"
    }}
  ]
}}

Generate the search queries now as valid JSON only. No other text.
"""
    
    return prompt