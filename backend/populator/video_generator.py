"""
Phase 2: Video Resource Generation
Single-section video generation with iterative search and content validation
"""

import logging
from typing import Dict, List, Optional

from config import PopulatorConfig
from populator.search_query_generator import generate_queries_for_section
from utils.youtube_handler import search_videos, get_video_details
from utils.transcript_handler import (
    get_transcript,
    extract_transcript_text,
    calculate_wpm
)
from utils.content_analyzer import (
    analyze_video_content,
    calculate_content_coverage,
    detect_redundancy
)
from populator.video_filter import (
    filter_and_rank_videos,
    select_top_videos
)

# Initialize logger
logger = logging.getLogger(__name__)


def generate_videos_for_section(
    section: Dict,
    grade_level: str,
    teacher_comments: str = ""
) -> Dict:
    """
    Generate curated video resources for a single curriculum section.
    
    This function performs iterative YouTube search with content validation,
    transcript analysis, and multi-factor relevance scoring to find the best
    educational videos matching section learning objectives.
    
    Process:
    1. Generate search queries from section learning objectives
    2. Search YouTube for relevant videos
    3. Fetch video details and transcripts
    4. Analyze content coverage against section requirements
    5. Filter and rank videos by relevance
    6. Iterate if coverage is insufficient (up to MAX_ITERATIONS)
    7. Select top N videos
    
    Args:
        section: Section dictionary containing:
            - title (str): Section title
            - description (str): Section overview
            - components (dict): Learning objectives and keywords under 'instruction'
            - duration_minutes (int): Target duration
        grade_level: Target grade level (e.g., "3", "K-5", "5")
        teacher_comments: Optional context from teacher about priorities
    
    Returns:
        dict: Section enriched with 'video_resources' array containing:
            - video_id, title, channel_name, duration_formatted
            - relevance_score, content_coverage, topics_covered
            - why_selected (rationale string)
            - transcript_available, wpm (words per minute)
        
        Also adds:
            - search_queries_used: List of queries executed
            - content_coverage_status: Overall coverage percentage and iterations
    
    Raises:
        ValueError: If section missing required fields
        Exception: If critical errors occur during processing
    
    Example:
        >>> section = {
        ...     "title": "Introduction to Photosynthesis",
        ...     "components": {
        ...         "instruction": {
        ...             "learning_objectives": ["Understand photosynthesis"],
        ...             "content_keywords": ["chloroplast", "sunlight"]
        ...         }
        ...     },
        ...     "duration_minutes": 20
        ... }
        >>> enriched = generate_videos_for_section(section, "5")
        >>> len(enriched['video_resources'])
        3
        >>> enriched['video_resources'][0]['relevance_score'] > 5.0
        True
    """
    # Validate input
    _validate_section_input(section)
    
    section_id = section.get('id', 'unknown')
    section_title = section.get('title', 'Unknown Section')
    
    logger.info(f"="*70)
    logger.info(f"Generating videos for section: {section_title}")
    logger.info(f"Grade level: {grade_level}")
    logger.info(f"="*70)
    
    # Generate search queries for this section
    queries = generate_queries_for_section(section, grade_level, teacher_comments)
    section['search_queries_used'] = [q.get('query', '') for q in queries]
    
    logger.info(f"Generated {len(queries)} search queries")
    
    # Iterative search with content validation
    selected_videos = []
    iteration = 0
    previous_coverage = 0
    
    while iteration < PopulatorConfig.MAX_SEARCH_ITERATIONS:
        iteration += 1
        logger.info(f"--- Search Iteration {iteration}/{PopulatorConfig.MAX_SEARCH_ITERATIONS} ---")
        
        # Search YouTube for each query
        all_video_ids = []
        for query_data in queries:
            query = query_data.get('query', '')
            logger.info(f"Searching YouTube: '{query}'")
            
            video_ids = search_videos(query, PopulatorConfig.YOUTUBE_MAX_RESULTS_PER_QUERY)
            all_video_ids.extend(video_ids)
        
        # Remove duplicates
        all_video_ids = list(set(all_video_ids))
        
        if not all_video_ids:
            logger.warning(f"No videos found in iteration {iteration}")
            break
        
        logger.info(f"Found {len(all_video_ids)} unique videos, fetching details...")
        
        # Get detailed info for all videos
        videos = get_video_details(all_video_ids)
        
        if not videos:
            logger.warning("Failed to fetch video details")
            break
        
        # Get transcripts and analyze content
        logger.info(f"Analyzing content for {len(videos)} videos...")
        for video in videos:
            # Get transcript
            transcript = get_transcript(video['video_id'])
            
            if transcript:
                transcript_text = extract_transcript_text(transcript)
                video['wpm'] = calculate_wpm(transcript, video['duration_seconds'])
                video['transcript_available'] = True
            else:
                transcript_text = ""
                video['wpm'] = None
                video['transcript_available'] = False
            
            # Analyze content
            content_analysis = analyze_video_content(transcript_text, video, section)
            video['topics_covered'] = content_analysis.get('topics_covered', [])
            video['main_focus'] = content_analysis.get('main_focus', '')
            video['content_depth'] = content_analysis.get('content_depth', 'unknown')
            
            # Calculate content coverage
            coverage_analysis = calculate_content_coverage(content_analysis, section)
            video['content_coverage'] = coverage_analysis
            
            # Detect redundancy with already-selected videos
            redundancy_analysis = detect_redundancy(video['topics_covered'], selected_videos)
            video['redundancy_analysis'] = redundancy_analysis
        
        # Filter and rank videos
        logger.info(f"Filtering and ranking videos...")
        filtered_videos = filter_and_rank_videos(videos, section, grade_level, selected_videos)
        
        if not filtered_videos:
            logger.warning(f"No videos passed filters in iteration {iteration}")
            break
        
        # Select additional videos (up to max)
        remaining_slots = PopulatorConfig.YOUTUBE_MAX_VIDEOS_PER_SECTION - len(selected_videos)
        if remaining_slots <= 0:
            logger.info("Already have maximum number of videos")
            break
        
        new_selections = select_top_videos(filtered_videos, remaining_slots)
        
        # Add to selected list with rationale
        for video in new_selections:
            video['why_selected'] = _generate_selection_rationale(video, section)
            selected_videos.append(video)
        
        logger.info(f"Selected {len(new_selections)} video(s) this iteration (total: {len(selected_videos)})")
        
        # Calculate current coverage
        current_coverage = _calculate_section_coverage(selected_videos)
        logger.info(f"Content coverage: {current_coverage}%")
        
        # Check for convergence
        if len(selected_videos) >= PopulatorConfig.YOUTUBE_MAX_VIDEOS_PER_SECTION:
            logger.info("Reached maximum number of videos")
            break
        
        improvement = current_coverage - previous_coverage
        if improvement < PopulatorConfig.CONVERGENCE_THRESHOLD:
            logger.info(f"Coverage improvement minimal ({improvement}%), stopping iterations")
            break
        
        previous_coverage = current_coverage
    
    # Store results in section
    section['video_resources'] = selected_videos
    section['content_coverage_status'] = {
        'coverage_percentage': _calculate_section_coverage(selected_videos),
        'iterations_performed': iteration
    }
    
    logger.info(f"Final: {len(selected_videos)} video(s) selected for section '{section_title}'")
    logger.info(f"Coverage: {section['content_coverage_status']['coverage_percentage']}%")
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
    
    # Check for instruction component (optional but recommended)
    if 'components' not in section or 'instruction' not in section.get('components', {}):
        logger.warning(
            f"Section '{section.get('title')}' missing instruction component. "
            "Video search may be less effective without learning objectives."
        )


def _calculate_section_coverage(selected_videos: List[Dict]) -> int:
    """
    Calculate overall coverage percentage for a section.
    
    Args:
        selected_videos: Videos selected so far
    
    Returns:
        int: Coverage percentage (0-100)
    """
    if not selected_videos:
        return 0
    
    # Average coverage across all selected videos
    total_coverage = sum([
        v.get('content_coverage', {}).get('coverage_percentage', 0)
        for v in selected_videos
    ])
    avg_coverage = total_coverage / len(selected_videos)
    
    return int(avg_coverage)


def _generate_selection_rationale(video: Dict, section: Dict) -> str:
    """
    Generate a brief explanation of why this video was selected.
    
    Args:
        video: Video data
        section: Section data
    
    Returns:
        str: Rationale text explaining selection
    
    Example:
        >>> rationale = _generate_selection_rationale(video, section)
        >>> 'relevance' in rationale.lower() or 'coverage' in rationale.lower()
        True
    """
    reasons = []
    
    # High relevance score
    if video.get('relevance_score', 0) >= 7.0:
        reasons.append("high relevance score")
    
    # Good content coverage
    coverage = video.get('content_coverage', {}).get('coverage_percentage', 0)
    if coverage >= 80:
        reasons.append("excellent content coverage")
    elif coverage >= 60:
        reasons.append("good content coverage")
    
    # Appropriate pacing
    wpm = video.get('wpm')
    if wpm and 100 <= wpm <= 130:
        reasons.append("appropriate pacing for grade level")
    
    # Kid-friendly channel
    from utils.channel_database import get_channel_tier
    tier = get_channel_tier(video.get('channel_name', ''))
    if tier == 1:
        reasons.append("kid-friendly channel")
    elif tier == 2:
        reasons.append("educational channel")
    
    # Low redundancy
    redundancy = video.get('redundancy_analysis', {}).get('redundancy_percentage', 0)
    if redundancy < 30:
        reasons.append("unique content")
    
    if not reasons:
        return "Meets quality criteria"
    
    return ", ".join(reasons).capitalize()