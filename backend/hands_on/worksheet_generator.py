"""
Phase 3: Worksheet Generation
Single-section worksheet generation with concurrent image analysis
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


def generate_worksheets_for_section(
    section: Dict,
    grade_level: str,
    user_prompt: str,
    num_options: int = HandsOnConfig.MAX_WORKSHEET_OPTIONS
) -> Dict:
    """
    Generate worksheet options for a single curriculum section.
    
    This function searches Google Images for worksheets matching the user's
    prompt, analyzes them using GPT-4 Vision, filters by quality and relevance,
    and returns the top options for teacher selection.
    
    Process:
    1. Build search query from user prompt and grade level
    2. Search Google Images for worksheet images
    3. Analyze images concurrently using GPT-4 Vision
    4. Filter worksheets by quality and relevance
    5. Rank and return top N options
    
    Args:
        section: Section dictionary containing:
            - title (str): Section title
            - learning_objectives (list): Learning goals
            - content_keywords (list): Key concepts
        grade_level: Target grade level (e.g., "3", "5", "K-5")
        user_prompt: Teacher's selected worksheet type (e.g., "timeline worksheet",
            "fill-in-the-blank vocabulary", "math word problems")
        num_options: Number of worksheet options to return (default 3)
    
    Returns:
        dict: Section enriched with 'worksheet_options' array containing:
            - worksheet_title, grade_level, topics_covered
            - visual_quality (0-10), educational_value (0-10)
            - is_age_appropriate, has_images_or_art
            - image_url, source_url
            - overall_score, relevance_data
    
    Raises:
        ValueError: If section missing required fields
    
    Example:
        >>> section = {
        ...     "title": "Introduction to Fractions",
        ...     "learning_objectives": ["Understand halves and quarters"],
        ...     "content_keywords": ["fraction", "half", "quarter"]
        ... }
        >>> enriched = generate_worksheets_for_section(
        ...     section, "3", "visual fraction worksheet"
        ... )
        >>> len(enriched['worksheet_options']) <= 3
        True
    """
    # Validate input
    _validate_section_input(section)
    
    section_title = section.get('title', 'Unknown Section')
    
    logger.info(f"="*70)
    logger.info(f"Generating worksheets for section: {section_title}")
    logger.info(f"Grade level: {grade_level}")
    logger.info(f"User prompt: {user_prompt}")
    logger.info(f"="*70)
    
    # Initialize handlers
    search_handler = GoogleSearchHandler()
    content_extractor = ContentExtractor()
    resource_filter = ResourceFilter()
    
    # Build search query
    search_query = f"{user_prompt} grade {grade_level}"
    logger.info(f"Search query: '{search_query}'")
    
    # Search for worksheet images
    logger.info(f"Searching Google Images...")
    search_results = search_handler.search_worksheets(
        search_query,
        num_results=HandsOnConfig.GOOGLE_MAX_WORKSHEET_IMAGES
    )
    
    if not search_results:
        logger.warning("No worksheet images found")
        section['worksheet_options'] = []
        return section
    
    logger.info(f"Found {len(search_results)} images")
    
    # Analyze images CONCURRENTLY (for speed)
    logger.info(f"Analyzing images in parallel (workers={HandsOnConfig.WORKSHEET_ANALYSIS_WORKERS})...")
    all_worksheets = []
    
    with ThreadPoolExecutor(max_workers=HandsOnConfig.WORKSHEET_ANALYSIS_WORKERS) as executor:
        futures = {
            executor.submit(content_extractor.analyze_worksheet_image, img): img
            for img in search_results
        }
        
        for future in as_completed(futures):
            try:
                result = future.result(timeout=HandsOnConfig.TIMEOUT_SECONDS)
                if result:
                    all_worksheets.append(result)
                    logger.debug(f"Analyzed: {result.get('worksheet_title', 'Unknown')}")
            except Exception as e:
                logger.error(f"Error analyzing worksheet image: {e}")
    
    if not all_worksheets:
        logger.warning("No worksheets successfully analyzed")
        section['worksheet_options'] = []
        return section
    
    logger.info(f"Successfully analyzed {len(all_worksheets)} worksheets")
    
    # Filter and rank
    section_requirements = {
        'title': section.get('title', ''),
        'learning_objectives': ' '.join(section.get('learning_objectives', [])),
        'keywords': ', '.join(section.get('content_keywords', [])),
        'grade': grade_level
    }
    
    logger.info("Filtering and ranking worksheets...")
    ranked = resource_filter.filter_and_rank_worksheets(all_worksheets, section_requirements)
    
    # Return top N
    top_worksheets = ranked[:num_options]
    section['worksheet_options'] = top_worksheets
    
    logger.info(f"Selected {len(top_worksheets)} top worksheet(s)")
    for i, ws in enumerate(top_worksheets, 1):
        logger.info(
            f"  {i}. {ws.get('worksheet_title', 'Unknown')} "
            f"(Score: {ws.get('overall_score', 0):.1f})"
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
            "Worksheet filtering may be less effective."
        )
    
    if not section.get('content_keywords'):
        logger.warning(
            f"Section '{section.get('title')}' missing content_keywords. "
            "Worksheet search may be less targeted."
        )