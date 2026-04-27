"""
Video Filter for Phase 2
Filters and ranks videos based on content quality and relevance
"""

import logging
from typing import Dict, List

from config import PopulatorConfig

# Initialize logger
logger = logging.getLogger(__name__)


def filter_and_rank_videos(
    videos: List[Dict],
    section: Dict,
    grade_level: str,
    already_selected: List[Dict]
) -> List[Dict]:
    """
    Filter and rank videos based on multiple criteria.
    
    1. Fetch video details (including FULL description)
    2. Filter by description quality first
    3. ONLY fetch transcripts for videos that pass description filter
    4. Use transcript to validate/enhance (not as primary requirement)
    
    Args:
        videos: List of videos with analysis data
        section: Section data with learning objectives
        grade_level: Target grade level
        already_selected: Videos already selected for this section
    
    Returns:
        list: Filtered and ranked videos (best first)
    """
    logger.info(f"Filtering {len(videos)} videos for grade {grade_level}")
    logger.info(f"📊 FILTER DEBUG: Checking {len(videos)} videos")
    logger.info(f"Section: {section.get('title', 'Unknown')}")
    
    filtered_videos = []
    
    for video in videos:
        vid_id = video.get('videoId', '')
        vid_title = video.get('title', 'Unknown')
        vid_url = f"https://www.youtube.com/watch?v={vid_id}" if vid_id else "no-url"

        # Skip if missing critical data
        if not vid_id:
            logger.warning(f"❌ REJECTED (no videoId): '{vid_title}'")
            continue

        # Filter 1: Content coverage check
        coverage = video.get('content_coverage', {})
        cov_pct = coverage.get('coverage_percentage', 0)
        if cov_pct < PopulatorConfig.MIN_CONTENT_COVERAGE_PERCENTAGE:
            logger.warning(
                f"❌ REJECTED (coverage {cov_pct}% < {PopulatorConfig.MIN_CONTENT_COVERAGE_PERCENTAGE}%): "
                f"'{vid_title}' — {vid_url}"
            )
            continue

        # Filter 2: Redundancy check
        redundancy = video.get('redundancy_analysis', {})
        if redundancy.get('is_redundant', False):
            overlap = redundancy.get('overlap_percentage', 0)
            logger.warning(
                f"❌ REJECTED (redundant {overlap}% overlap): "
                f"'{vid_title}' — {vid_url}"
            )
            continue

        # Filter 3: Duration check (flexible, just avoid extremes)
        if not _passes_duration_filter(video, grade_level):
            duration_s = video.get('durationSeconds', 0)
            logger.warning(
                f"❌ REJECTED (duration {duration_s}s out of 120–3600s range): "
                f"'{vid_title}' — {vid_url}"
            )
            continue

        # Filter 4: Basic quality check (views and engagement)
        if not _passes_quality_filter(video):
            view_count = video.get('viewCount', 0)
            logger.warning(
                f"❌ REJECTED (only {view_count:,} views, need ≥500): "
                f"'{vid_title}' — {vid_url}"
            )
            continue
        
        # Calculate ranking score
        video['ranking_score'] = _calculate_ranking_score(video, grade_level)
        filtered_videos.append(video)
    
    # Sort by ranking score (highest first)
    filtered_videos.sort(key=lambda x: x['ranking_score'], reverse=True)
    
    logger.info(f"Filtered to {len(filtered_videos)} quality videos")
    return filtered_videos


def select_top_videos(filtered_videos: List[Dict], num_to_select: int) -> List[Dict]:
    """
    Select top N videos from filtered list.
    
    Args:
        filtered_videos: List of filtered and ranked videos
        num_to_select: Number of videos to select
    
    Returns:
        list: Top N videos
    """
    return filtered_videos[:num_to_select]


def _passes_duration_filter(video: Dict, grade_level: str) -> bool:
    """
    Check if video duration is reasonable (not too short or too long).
    
    Flexible ranges - we're just avoiding extremes:
    - Too short: < 2 minutes (likely not enough content)
    - Too long: > 30 minutes (too much for classroom use)
    """
    duration = video.get('durationSeconds', 0)
    if not duration:
        return False
    
    # Avoid extremes
    if duration < 120:  # Less than 1 minute
        return False
    if duration > 3600:  # More than 60 minutes
        return False
    
    return True


def _passes_quality_filter(video: Dict) -> bool:
    """
    Basic quality check - ensure video has some engagement.
    
    We're being lenient here - just filtering out very low quality content.
    """
    view_count = video.get('viewCount', 0)
    
    # Require at least 500 views (very lenient)
    if view_count < 500:
        return False
    
    return True


def _calculate_ranking_score(video: Dict, grade_level: str) -> float:
    """
    Calculate overall ranking score for video.
    
    Scoring factors:
    1. Content coverage (50% weight) - most important
    2. Engagement metrics (30% weight) - views and likes
    3. Recency (20% weight) - prefer newer content
    """
    score = 0.0
    
    # 1. Content coverage (0-50 points)
    coverage = video.get('content_coverage', {}).get('coverage_percentage', 0)
    score += (coverage / 100) * 50
    
    # 2. Engagement metrics (0-30 points)
    view_count = video.get('view_count', 0)
    like_count = video.get('like_count', 0)
    
    # Normalize view count (log scale)
    if view_count > 0:
        import math
        normalized_views = min(math.log10(view_count) / 7, 1.0)  # Cap at 10M views
        score += normalized_views * 15
    
    # Like ratio
    if view_count > 0 and like_count > 0:
        like_ratio = min(like_count / view_count, 0.1)  # Cap at 10%
        normalized_likes = like_ratio / 0.1
        score += normalized_likes * 15
    
    # 3. Recency (0-20 points)
    # Prefer videos from last 3 years
    published_at = video.get('published_at', '')
    if published_at:
        from datetime import datetime
        try:
            pub_date = datetime.fromisoformat(published_at.replace('Z', '+00:00'))
            age_days = (datetime.now(pub_date.tzinfo) - pub_date).days
            age_years = age_days / 365
            
            if age_years <= 1:
                score += 20
            elif age_years <= 2:
                score += 15
            elif age_years <= 3:
                score += 10
            elif age_years <= 5:
                score += 5
            else:
                score += 2
        except:
            score += 10  # Default middle score if parsing fails
    
    return score


def _extract_grade_number(grade_level: str) -> int:
    """
    Extract numeric grade from grade_level string.
    
    Examples:
        "Grade 3" -> 3
        "5th Grade" -> 5
        "Kindergarten" -> 0
    """
    import re
    
    grade_lower = grade_level.lower()
    
    if 'kindergarten' in grade_lower or grade_lower == 'k':
        return 0
    
    # Extract number
    match = re.search(r'\d+', grade_level)
    if match:
        return int(match.group())
    
    return 5  # Default to 5th grade if unclear