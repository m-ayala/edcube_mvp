def get_search_query_generation_prompt(section, grade_level, teacher_comments):
    """
    Generate the prompt for creating YouTube search queries for a section
    
    Args:
        section (dict): Section data from course outline
        grade_level (str): Grade level of students
        teacher_comments (str): Teacher's special requirements/objectives
    
    Returns:
        str: Prompt for LLM
    """
    
    section_title = section.get('title', '')
    section_description = section.get('description', '')
    duration_minutes = section.get('duration_minutes', 0)
    subtopics = section.get('subtopics', [])
    
    # Extract detailed objectives and keywords from instruction
    instruction = section.get('components', {}).get('instruction', {}) if 'components' in section else {}
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
    except:
        grade_num = 5
    
    prompt = f"""
You are an expert at finding educational YouTube videos for elementary students. Generate 1-3 optimal YouTube search queries for the following course section.

TEACHER'S PRIORITY OBJECTIVES (HIGHEST PRIORITY):
{teacher_comments}

SECTION DETAILS:
- Title: {section_title}
- Description: {section_description}
- Subtopics: {subtopics_text}
- Duration: {duration_minutes} minutes
- Grade Level: {grade_level} (approximately {grade_num + 5} years old)

DETAILED LEARNING OBJECTIVES:
{objectives_text}

CONTENT KEYWORDS THAT MUST BE COVERED:
{keywords_text}

WHAT MUST BE COVERED IN THIS SECTION:
{what_must_be_covered}

REQUIREMENTS FOR QUERY GENERATION:

1. PRIORITIZE teacher's comments - these are non-negotiable learning goals
2. Generate 1-3 search queries ranked by priority (Primary, Secondary, Tertiary if needed)
3. Queries should be optimized to find age-appropriate content for grade {grade_level}
4. Each query should be 3-8 words maximum
5. Use natural search terms that will find quality educational content
6. DO NOT force generic keywords like "for kids" or "grade X" - be smart and context-aware
7. Consider what terms would naturally return appropriate content:
   - For grades 2-3: Terms that attract simple, visual, narrative content
   - For grades 4-5: Terms that find balanced educational content (not dumbed down, not college-level)
   - For grades 6+: More sophisticated educational terminology acceptable

QUERY STRATEGY:
- Primary query: Most specific to learning objectives and teacher's comments
- Secondary query: Broader backup if primary returns limited results
- Tertiary query (optional): Alternative angle or complementary content

AVOID:
- Overly generic queries that return thousands of irrelevant results
- Forced age indicators unless naturally appropriate
- Terms that would return college-level content (e.g., "documentary", "comprehensive analysis")

OUTPUT FORMAT (strict JSON):
{{
  "section_id": "{section.get('id', '')}",
  "section_title": "{section_title}",
  "queries": [
    {{
      "priority": "primary",
      "query": "string (3-8 words)",
      "rationale": "string (why this query will find appropriate videos)"
    }},
    {{
      "priority": "secondary",
      "query": "string (3-8 words)",
      "rationale": "string (backup query rationale)"
    }}
  ]
}}

Generate the search queries now as valid JSON only. No other text.
"""
    
    return prompt


def get_content_analysis_prompt(transcript_text, video_metadata):
    """
    Prompt for analyzing video content from transcript
    
    Args:
        transcript_text (str): Video transcript
        video_metadata (dict): Video title, description
    
    Returns:
        str: Prompt for content analysis
    """
    # This is handled directly in content_analyzer.py
    # Included here for completeness/reference
    pass


def get_coverage_analysis_prompt(video_topics, section_requirements):
    """
    Prompt for comparing video content to section requirements
    
    Args:
        video_topics (list): Topics covered by video
        section_requirements (dict): Section objectives and keywords
    
    Returns:
        str: Prompt for coverage analysis
    """
    # This is handled directly in content_analyzer.py
    # Included here for completeness/reference
    pass