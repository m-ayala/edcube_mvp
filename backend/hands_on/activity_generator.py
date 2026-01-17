"""
Phase 3: Activity Generation
Single-section activity generation with concurrent web crawling
"""

import logging
from typing import Dict, List, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed

from config import HandsOnConfig
from utils.google_search_handler import GoogleSearchHandler
from utils.content_extractor import ContentExtractor
from hands_on.resource_filter import ResourceFilter

# Initialize logger
logger = logging.getLogger(__name__)


def generate_activities_for_section(
    section: Dict,
    grade_level: str,
    user_prompt: str,
    num_options: int = HandsOnConfig.MAX_ACTIVITY_OPTIONS
) -> Dict:
    """
    Generate activity options for a single curriculum section.
    
    This function searches the web for activity lesson plans, crawls the pages
    concurrently to extract activity details using LLM, filters by quality and
    relevance, and returns the top options for teacher selection.
    
    Process:
    1. Build search query from user prompt and grade level
    2. Search Google for activity lesson plan pages
    3. Crawl pages concurrently and extract activities using LLM
    4. Filter activities by quality and relevance
    5. Rank and return top N options
    
    Args:
        section: Section dictionary containing:
            - title (str): Section title
            - learning_objectives (list): Learning goals
            - content_keywords (list): Key concepts
        grade_level: Target grade level (e.g., "3", "5", "K-5")
        user_prompt: Teacher's selected activity type (e.g., "hands-on experiment",
            "group discussion", "art project")
        num_options: Number of activity options to return (default 3)
    
    Returns:
        dict: Section enriched with 'activity_options' array containing:
            - name, type, description
            - materials, steps, duration
            - learning_objectives, grade_level
            - source_url, overall_score, relevance_data
    
    Raises:
        ValueError: If section missing required fields
    
    Example:
        >>> section = {
        ...     "title": "The Water Cycle",
        ...     "learning_objectives": ["Understand evaporation and condensation"],
        ...     "content_keywords": ["water cycle", "evaporation"]
        ... }
        >>> enriched = generate_activities_for_section(
        ...     section, "4", "hands-on water cycle experiment"
        ... )
        >>> len(enriched['activity_options']) <= 3
        True
    """
    # Validate input
    _validate_section_input(section)
    
    section_title = section.get('title', 'Unknown Section')
    
    logger.info(f"="*70)
    logger.info(f"Generating activities for section: {section_title}")
    logger.info(f"Grade level: {grade_level}")
    logger.info(f"User prompt: {user_prompt}")
    logger.info(f"="*70)
    
    # Initialize handlers
    search_handler = GoogleSearchHandler()
    content_extractor = ContentExtractor()
    resource_filter = ResourceFilter()
    
    # Build search query with grade descriptor
    grade_descriptor = _get_grade_level_descriptor(grade_level)
    search_query = f"{user_prompt} {grade_descriptor} classroom"
    logger.info(f"Search query: '{search_query}'")
    
    # Search for activity pages
    logger.info(f"Searching Google for activity pages...")
    search_results = search_handler.search_activities(
        search_query,
        num_results=HandsOnConfig.GOOGLE_MAX_ACTIVITY_PAGES
    )
    
    if not search_results:
        logger.warning("No activity pages found")
        section['activity_options'] = []
        return section
    
    logger.info(f"Found {len(search_results)} activity pages")
    
    # Crawl and extract CONCURRENTLY (for speed)
    logger.info(f"Crawling pages in parallel (workers={HandsOnConfig.ACTIVITY_CRAWL_WORKERS})...")
    all_activities = []
    
    with ThreadPoolExecutor(max_workers=HandsOnConfig.ACTIVITY_CRAWL_WORKERS) as executor:
        futures = {
            executor.submit(
                content_extractor.crawl_and_extract_activity,
                url_data.get('url', ''),
                url_data.get('title', '')
            ): url_data
            for url_data in search_results
        }
        
        for future in as_completed(futures):
            try:
                result = future.result(timeout=HandsOnConfig.TIMEOUT_SECONDS)
                if result and result.get('activities_found'):
                    # Each page may have multiple activities
                    for activity in result['activities_found']:
                        activity['source_url'] = result.get('source_url', '')
                        all_activities.append(activity)
                        logger.debug(f"Extracted: {activity.get('name', 'Unknown')}")
            except Exception as e:
                logger.error(f"Error crawling activity page: {e}")
    
    if not all_activities:
        logger.warning("No activities successfully extracted")
        section['activity_options'] = []
        return section
    
    logger.info(f"Successfully extracted {len(all_activities)} activities")
    
    # Filter and rank
    section_requirements = {
        'title': section.get('title', ''),
        'learning_objectives': ' '.join(section.get('learning_objectives', [])),
        'keywords': ', '.join(section.get('content_keywords', [])),
        'grade': grade_level
    }
    
    logger.info("Filtering and ranking activities...")
    ranked = resource_filter.filter_and_rank_activities(all_activities, section_requirements)
    
    # Return top N
    top_activities = ranked[:num_options]
    section['activity_options'] = top_activities
    
    logger.info(f"Selected {len(top_activities)} top activit{'ies' if len(top_activities) != 1 else 'y'}")
    for i, act in enumerate(top_activities, 1):
        logger.info(
            f"  {i}. {act.get('name', 'Unknown')} "
            f"(Score: {act.get('overall_score', 0):.1f})"
        )
    
    logger.info(f"="*70)
    
    return section


def _validate_section_input(section: Dict) -> None:
    """
    Validate that section has required fields.
    
    Args:
        section: Section dictionary to validate
    
    Raises:
        ValueError: If required fields are missing
    """
    required_fields = ['title']
    
    for field in required_fields:
        if field not in section:
            raise ValueError(f"Section missing required field: '{field}'")
    
    # Warn if missing optional but helpful fields
    if not section.get('learning_objectives'):
        logger.warning(
            f"Section '{section.get('title')}' missing learning_objectives. "
            "Activity filtering may be less effective."
        )
    
    if not section.get('content_keywords'):
        logger.warning(
            f"Section '{section.get('title')}' missing content_keywords. "
            "Activity search may be less targeted."
        )


def _get_grade_level_descriptor(grade_level: str) -> str:
    """
    Get appropriate grade level descriptor for search queries.
    
    Args:
        grade_level: Grade level (e.g., "3", "K-5", "6")
    
    Returns:
        str: Descriptor like "elementary", "middle school", "high school"
    
    Example:
        >>> _get_grade_level_descriptor("4")
        'elementary'
        >>> _get_grade_level_descriptor("7")
        'middle school'
    """
    try:
        # Parse grade level to int
        if isinstance(grade_level, str):
            if '-' in grade_level:
                grade = int(grade_level.split('-')[0])
            elif grade_level.lower().startswith('k'):
                grade = 0
            else:
                grade = int(grade_level)
        else:
            grade = int(grade_level)
        
        # Return descriptor
        if grade <= 5:
            return "elementary"
        elif grade <= 8:
            return "middle school"
        else:
            return "high school"
    
    except (ValueError, AttributeError):
        logger.warning(f"Could not parse grade level: {grade_level}, defaulting to 'elementary'")
        return "elementary"