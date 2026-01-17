"""
Prompts for Phase 3: Worksheet & Activity Generation
"""

import logging
from typing import List, Dict

from utils.llm_handler import call_openai

# Initialize logger
logger = logging.getLogger(__name__)


def generate_worksheet_prompt_suggestions(section: Dict, grade_level: str) -> List[Dict]:
    """
    Generate contextual worksheet type suggestions for a section.
    
    Uses LLM to analyze section content and suggest appropriate worksheet types
    that teachers can select from.
    
    Args:
        section: Section data with learning objectives
        grade_level: Target grade level
    
    Returns:
        list: Suggested worksheet types with format:
            [{
                'name': str,
                'description': str,
                'icon': str,
                'includes': List[str],
                'search_query': str
            }, ...]
    
    Example:
        >>> prompts = generate_worksheet_prompt_suggestions(
        ...     {'title': 'Fractions', 'learning_objectives': [...]},
        ...     '3'
        ... )
        >>> prompts[0]['name']
        'Visual Fraction Worksheet'
    """
    logger.info(f"Generating worksheet prompts for: {section.get('title', 'Unknown')}")
    
    section_title = section.get('title', 'Unknown')
    learning_objectives = section.get('learning_objectives', [])
    content_keywords = section.get('content_keywords', [])
    
    prompt = f"""
Generate 3-5 specific worksheet type suggestions for this curriculum section.

SECTION: {section_title}
GRADE: {grade_level}
LEARNING OBJECTIVES: {learning_objectives}
KEY CONCEPTS: {content_keywords}

For each worksheet type, provide:
1. A clear, specific name (e.g., "Timeline Worksheet", "Fill-in-the-Blank Vocabulary")
2. A brief description of what it includes
3. An appropriate emoji icon
4. List of specific elements it includes
5. An optimized Google search query to find this type

Output as JSON:
{{
  "suggestions": [
    {{
      "name": "Worksheet Type Name",
      "description": "What this worksheet helps students learn",
      "icon": "📝",
      "includes": ["element 1", "element 2", "element 3"],
      "search_query": "optimized search query for Google Images"
    }}
  ]
}}

Make suggestions specific to the section content. Focus on different pedagogical approaches:
- Visual/graphic organizers
- Practice/drill worksheets
- Creative/application worksheets
- Assessment/review worksheets

Return valid JSON only.
"""
    
    system_message = (
        "You are an expert elementary teacher who knows which worksheet types "
        "work best for different learning objectives."
    )
    
    try:
        response = call_openai(prompt, system_message)
        suggestions = response.get('suggestions', [])
        
        logger.info(f"Generated {len(suggestions)} worksheet prompt suggestions")
        return suggestions
    
    except Exception as e:
        logger.error(f"Error generating worksheet prompts: {e}")
        return _get_fallback_worksheet_prompts(section_title, grade_level)


def generate_activity_prompt_suggestions(section: Dict, grade_level: str) -> List[Dict]:
    """
    Generate contextual activity type suggestions for a section.
    
    Uses LLM to analyze section content and suggest appropriate activity types
    that teachers can select from.
    
    Args:
        section: Section data with learning objectives
        grade_level: Target grade level
    
    Returns:
        list: Suggested activity types with format:
            [{
                'name': str,
                'description': str,
                'icon': str,
                'includes': List[str],
                'search_query': str
            }, ...]
    
    Example:
        >>> prompts = generate_activity_prompt_suggestions(
        ...     {'title': 'Water Cycle', 'learning_objectives': [...]},
        ...     '4'
        ... )
        >>> prompts[0]['name']
        'Hands-on Water Cycle Experiment'
    """
    logger.info(f"Generating activity prompts for: {section.get('title', 'Unknown')}")
    
    section_title = section.get('title', 'Unknown')
    learning_objectives = section.get('learning_objectives', [])
    content_keywords = section.get('content_keywords', [])
    
    prompt = f"""
Generate 3-5 specific classroom activity suggestions for this curriculum section.

SECTION: {section_title}
GRADE: {grade_level}
LEARNING OBJECTIVES: {learning_objectives}
KEY CONCEPTS: {content_keywords}

For each activity type, provide:
1. A clear, specific name (e.g., "Group Discussion Activity", "Hands-on Experiment")
2. A brief description of what students do
3. An appropriate emoji icon
4. List of what the activity typically includes
5. An optimized Google search query to find lesson plans

Output as JSON:
{{
  "suggestions": [
    {{
      "name": "Activity Type Name",
      "description": "What students do in this activity",
      "icon": "🎨",
      "includes": ["element 1", "element 2", "element 3"],
      "search_query": "optimized search query for Google"
    }}
  ]
}}

Make suggestions specific to the section content. Focus on different activity types:
- Hands-on experiments/projects
- Group discussions/debates
- Creative/art projects
- Games/simulations
- Role-playing activities

Return valid JSON only.
"""
    
    system_message = (
        "You are an expert elementary teacher who knows which classroom activities "
        "work best for different learning objectives."
    )
    
    try:
        response = call_openai(prompt, system_message)
        suggestions = response.get('suggestions', [])
        
        logger.info(f"Generated {len(suggestions)} activity prompt suggestions")
        return suggestions
    
    except Exception as e:
        logger.error(f"Error generating activity prompts: {e}")
        return _get_fallback_activity_prompts(section_title, grade_level)


def _get_fallback_worksheet_prompts(section_title: str, grade_level: str) -> List[Dict]:
    """Fallback worksheet prompts if LLM fails."""
    return [
        {
            "name": f"{section_title} Practice Worksheet",
            "description": "Basic practice problems and exercises",
            "icon": "📝",
            "includes": ["Practice problems", "Review questions", "Answer key"],
            "search_query": f"{section_title} worksheet grade {grade_level}"
        },
        {
            "name": f"{section_title} Visual Organizer",
            "description": "Graphic organizer or diagram worksheet",
            "icon": "📊",
            "includes": ["Visual diagrams", "Labels", "Organizing spaces"],
            "search_query": f"{section_title} graphic organizer grade {grade_level}"
        },
        {
            "name": f"{section_title} Review Sheet",
            "description": "Comprehensive review and assessment",
            "icon": "✅",
            "includes": ["Key concepts", "Practice questions", "Self-check"],
            "search_query": f"{section_title} review worksheet grade {grade_level}"
        }
    ]


def _get_fallback_activity_prompts(section_title: str, grade_level: str) -> List[Dict]:
    """Fallback activity prompts if LLM fails."""
    return [
        {
            "name": f"{section_title} Hands-on Activity",
            "description": "Interactive learning experience",
            "icon": "🔬",
            "includes": ["Materials list", "Step-by-step instructions", "Learning objectives"],
            "search_query": f"{section_title} hands-on activity grade {grade_level}"
        },
        {
            "name": f"{section_title} Group Discussion",
            "description": "Collaborative conversation and sharing",
            "icon": "💬",
            "includes": ["Discussion questions", "Group roles", "Reflection prompts"],
            "search_query": f"{section_title} discussion activity grade {grade_level}"
        },
        {
            "name": f"{section_title} Creative Project",
            "description": "Student-created work demonstrating understanding",
            "icon": "🎨",
            "includes": ["Project guidelines", "Materials needed", "Rubric"],
            "search_query": f"{section_title} project activity grade {grade_level}"
        }
    ]


def get_relevance_check_prompt(resource: Dict, section_requirements: Dict) -> str:
    """
    Generate prompt for LLM to check resource relevance.
    
    Args:
        resource: Extracted resource data (worksheet or activity)
        section_requirements: Learning objectives from section
    
    Returns:
        str: Prompt for LLM relevance checking
    """
    resource_type = resource.get('resource_type', 'resource')
    
    if resource_type == 'worksheet_image':
        resource_info = f"""
WORKSHEET:
- Title: {resource.get('worksheet_title', 'Unknown')}
- Grade Level: {resource.get('grade_level', 'Unknown')}
- Topics Covered: {resource.get('topics_covered', [])}
- Visual Quality: {resource.get('visual_quality', 0)}/10
- Educational Value: {resource.get('educational_value', 0)}/10
"""
    else:
        resource_info = f"""
ACTIVITY:
- Name: {resource.get('name', 'Unknown')}
- Type: {resource.get('type', 'Unknown')}
- Description: {resource.get('description', 'N/A')}
- Grade Level: {resource.get('grade_level', 'Unknown')}
- Learning Objectives: {resource.get('learning_objectives', [])}
"""
    
    prompt = f"""
Evaluate if this educational resource matches the section requirements.

{resource_info}

SECTION REQUIREMENTS:
- Title: {section_requirements.get('title', 'Unknown')}
- Learning Objectives: {section_requirements.get('learning_objectives', 'N/A')}
- Keywords: {section_requirements.get('keywords', 'N/A')}
- Grade: {section_requirements.get('grade', 'Unknown')}

Analyze and return JSON:
{{
  "is_suitable": true/false,
  "coverage_percentage": 0-100,
  "quality_score": 0-10,
  "matches_grade": true/false,
  "matches_topic": true/false,
  "reasoning": "brief explanation of suitability"
}}

Return valid JSON only.
"""
    
    return prompt


def get_worksheet_image_analysis_prompt(image_result: Dict) -> str:
    """
    Generate prompt for GPT-4 Vision worksheet analysis.
    
    Args:
        image_result: Image metadata
    
    Returns:
        str: Prompt for vision model
    """
    return f"""Analyze this worksheet image and extract educational details.

Image Title: {image_result.get('title', 'Unknown')}
Source: {image_result.get('source_url', 'Unknown')}

Analyze and return JSON:
{{
    "worksheet_title": "descriptive title of the worksheet",
    "grade_level": "estimated grade level (e.g., 'grade 3-4', 'elementary')",
    "topics_covered": ["topic1", "topic2", "topic3"],
    "visual_quality": 0-10,
    "educational_value": 0-10,
    "is_age_appropriate": true/false,
    "has_images_or_art": true/false,
    "description": "brief description of what the worksheet teaches"
}}

Scoring guidelines:
- visual_quality: clarity, layout, professional appearance
- educational_value: pedagogical merit, learning potential
- is_age_appropriate: suitable for elementary students

Return ONLY valid JSON.
"""


def get_activity_synthesis_prompt(activities: List[Dict], requirements: Dict) -> str:
    """
    Generate prompt for synthesizing best activity from multiple sources.
    
    Args:
        activities: List of activity data from different pages
        requirements: Section requirements
    
    Returns:
        str: Prompt for LLM
    """
    activities_text = "\n\n".join([
        f"Activity {i+1}:\n{activity}"
        for i, activity in enumerate(activities)
    ])
    
    prompt = f"""
Synthesize the BEST classroom activity from these sources.

SECTION REQUIREMENTS:
- Title: {requirements.get('title', 'Unknown')}
- Grade: {requirements.get('grade_level', 'Unknown')}
- Learning Objectives: {requirements.get('learning_objectives', [])}

SOURCE ACTIVITIES:
{activities_text}

Create ONE comprehensive activity by combining the best elements. Return JSON:
{{
    "title": "Activity name",
    "type": "hands-on/discussion/project/game/etc",
    "description": "What students do",
    "step_by_step_instructions": ["step 1", "step 2", ...],
    "materials_needed": ["item 1", "item 2", ...],
    "duration": "estimated time",
    "learning_objectives": ["objective 1", ...],
    "age_appropriate": true/false
}}

Return valid JSON only.
"""
    
    return prompt