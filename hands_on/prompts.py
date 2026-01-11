"""
prompts.py

Prompt templates for LLM interactions in Phase 3 (worksheet and activity finding).
"""

import json

def get_search_query_prompt(section_data: dict, resource_type: str, grade: int) -> str:
    """
    Generate prompt for creating Google search queries from outline section data.
    
    Args:
        section_data: Dict containing section title, learning objectives, keywords
        resource_type: Either "worksheet" or "activity"
        grade: Grade level (3-6)
        
    Returns:
        Formatted prompt string
    """
    
    if resource_type == "worksheet":
        prompt = f"""You are helping find educational worksheet IMAGES for elementary students.

Grade Level: {grade}
Section Title: {section_data.get('title', '')}
Learning Objectives: {section_data.get('learning_objectives', '')}
Key Topics: {section_data.get('keywords', '')}

Generate 1 concise Google IMAGE search query (5-8 words) to find a high-quality visual worksheet that covers these learning objectives.

Requirements:
- Include grade level
- Include main topic
- Use terms like "worksheet", "printable", "activity sheet"
- Keep it simple and specific
- This will be used for IMAGE search, so focus on visual worksheets

Return ONLY the search query, nothing else.

Example output: "MLK timeline worksheet grade 5 printable"
"""
    
    else:  # activity
        prompt = f"""You are helping find educational activity instructions for elementary students.

Grade Level: {grade}
Section Title: {section_data.get('title', '')}
Learning Objectives: {section_data.get('learning_objectives', '')}
Key Topics: {section_data.get('keywords', '')}
Activity Type: {section_data.get('activity_type', 'classroom activity')}

Generate 1 concise Google search query (6-10 words) to find detailed activity lesson plans that help achieve these learning objectives.

Requirements:
- Include grade level or "elementary"
- Include main topic
- Include activity type (discussion, hands-on, project, etc.)
- Use terms like "lesson plan", "classroom activity", "teaching ideas"

Return ONLY the search query, nothing else.

Example output: "MLK civil rights discussion activity elementary lesson plan"
"""
    
    return prompt


def get_worksheet_image_analysis_prompt(image_result: dict) -> str:
    """
    Generate prompt for analyzing worksheet images using GPT-4 Vision.
    
    Args:
        image_result: Dict with image_url, source_url, title
        
    Returns:
        Formatted prompt string
    """
    
    prompt = f"""Analyze this educational worksheet image and extract key information.

Image Title: {image_result.get('title', 'Unknown')}
Source: {image_result.get('source_url', 'Unknown')}

Evaluate this worksheet and return JSON:

{{
    "worksheet_title": "What is this worksheet about?",
    "grade_level": "What grade level is this for? (e.g., 'grade 5', 'grades 3-5', 'elementary')",
    "subject": "Main subject area",
    "topics_covered": ["specific", "topics", "shown"],
    "visual_quality": 0-10 (How clear, colorful, engaging is it visually?),
    "learning_approach": "How does it teach? (timeline, matching, fill-in-blank, coloring, etc.)",
    "has_images_or_art": true/false,
    "is_age_appropriate": true/false (for elementary students),
    "educational_value": 0-10 (How well does this teach the concept?),
    "description": "Brief description of what students would do with this worksheet",
    "strengths": ["What makes this worksheet good?"],
    "overall_score": 0-10
}}

Return ONLY valid JSON, no other text.
"""
    
    return prompt


def get_activity_synthesis_prompt(activities: list, requirements: dict) -> str:
    """
    Generate prompt for synthesizing multiple activity ideas into one best activity.
    
    Args:
        activities: List of activity data extracted from multiple sources
        requirements: Section requirements (learning objectives, grade, etc.)
        
    Returns:
        Formatted prompt string
    """
    
    # Format activities for the prompt
    activities_text = ""
    for i, activity in enumerate(activities, 1):
        activities_text += f"\n--- Source {i} ---\n"
        activities_text += f"URL: {activity.get('source_url', 'Unknown')}\n"
        activities_text += f"Activities found: {json.dumps(activity.get('activities_found', []), indent=2)}\n"
    
    prompt = f"""You are an expert elementary school teacher. You've researched multiple sources for activity ideas.

LEARNING REQUIREMENTS:
Title: {requirements.get('title', '')}
Learning Objectives: {requirements.get('learning_objectives', '')}
Grade Level: {requirements.get('grade', 5)}
Key Topics: {requirements.get('keywords', '')}

ACTIVITY IDEAS FROM MULTIPLE SOURCES:
{activities_text}

Your task: Synthesize these ideas into ONE complete, engaging classroom activity that best achieves the learning objectives.

Take the best elements from all sources and create a cohesive, detailed activity.

Return JSON:
{{
    "title": "Engaging activity name",
    "type": "discussion/hands-on/project/game/role-play/etc",
    "description": "Clear description of what students will do (2-3 sentences)",
    "duration": "Realistic time estimate (e.g., '30 minutes', '1 hour')",
    "materials_needed": ["specific", "materials", "list"],
    "preparation": "What teacher needs to prep beforehand",
    "step_by_step_instructions": [
        "Step 1: Clear, actionable instruction",
        "Step 2: ...",
        ...
    ],
    "learning_objectives": ["what", "students", "will", "learn"],
    "discussion_questions": ["optional", "questions", "for", "reflection"],
    "differentiation": "How to adapt for different learners (optional)",
    "assessment": "How to know students learned (optional)",
    "why_this_works": "Brief explanation of why this is effective for grade {requirements.get('grade', 5)}"
}}

Return ONLY valid JSON. Make this practical and ready-to-use for a teacher.
"""
    
    return prompt


def get_relevance_check_prompt(resource_data: dict, section_requirements: dict) -> str:
    """
    Generate prompt for checking if resource matches section requirements.
    
    Args:
        resource_data: Extracted resource data (worksheet or activity)
        section_requirements: Learning objectives and keywords from outline
        
    Returns:
        Formatted prompt string
    """
    
    prompt = f"""You are evaluating if an educational resource matches the learning requirements.

SECTION REQUIREMENTS:
Title: {section_requirements.get('title', '')}
Learning Objectives: {section_requirements.get('learning_objectives', '')}
Key Topics: {section_requirements.get('keywords', '')}
Grade Level: {section_requirements.get('grade', '')}

RESOURCE DATA:
{json.dumps(resource_data, indent=2)}

Evaluate this resource and return JSON:

{{
    "matches_grade": true/false,
    "matches_topic": true/false,
    "coverage_percentage": 0-100 (what % of learning objectives does this cover?),
    "quality_score": 0-10,
    "is_suitable": true/false (overall recommendation),
    "reasoning": "Brief explanation (1-2 sentences)"
}}

Return ONLY valid JSON, no other text.
"""
    
    return prompt