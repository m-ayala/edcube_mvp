from datetime import datetime, timedelta
from config import (
    MIN_VIEW_COUNT,
    MIN_LIKE_RATIO,
    PREFER_VERIFIED_CHANNELS,
    WPM_RANGES,
    ATTENTION_SPAN_RANGES,
    MIN_CONTENT_COVERAGE_PERCENTAGE,
    MAX_REDUNDANCY_PERCENTAGE
)
from channel_database import calculate_channel_demographic_score


def filter_and_rank_videos(videos, section, grade_level, existing_videos=[]):
    """
    Filter and rank videos based on quality criteria
    
    Args:
        videos (list): List of video dictionaries with content analysis
        section (dict): Section data (for duration matching and content requirements)
        grade_level (str): Grade level for age-appropriateness
        existing_videos (list): Already selected videos (for redundancy check)
    
    Returns:
        list: Filtered and ranked videos (sorted by score, highest first)
    """
    if not videos:
        return []
    
    section_duration_minutes = section.get('duration_minutes', 0)
    filtered_videos = []
    
    for video in videos:
        # Apply hard filters
        if not passes_filters(video, section_duration_minutes, grade_level):
            continue
        
        # Calculate multi-factor relevance score
        score = calculate_relevance_score(video, section, grade_level, existing_videos)
        video['relevance_score'] = round(score, 2)
        
        filtered_videos.append(video)
    
    # Sort by relevance score (highest first)
    filtered_videos.sort(key=lambda x: x['relevance_score'], reverse=True)
    
    return filtered_videos


def passes_filters(video, section_duration_minutes, grade_level):
    """
    Check if video passes basic quality filters
    
    Args:
        video (dict): Video data
        section_duration_minutes (int): Target duration for the section
        grade_level (str): Target grade level
    
    Returns:
        bool: True if video passes all filters
    """
    # Filter 1: Minimum view count
    if video['view_count'] < MIN_VIEW_COUNT:
        return False
    
    # Filter 2: Minimum like ratio
    if video['like_ratio'] < MIN_LIKE_RATIO:
        return False
    
    # Filter 3: Blacklisted channel check
    from channel_database import get_channel_tier
    if get_channel_tier(video['channel_name']) == -1:
        return False
    
    # Filter 4: Duration appropriateness
    video_duration_minutes = video['duration_seconds'] / 60
    
    # Get grade-specific attention span range
    try:
        grade_num = int(grade_level) if isinstance(grade_level, str) and grade_level.isdigit() else 5
    except:
        grade_num = 5
    
    attention_span = ATTENTION_SPAN_RANGES.get(grade_num, (10, 15))
    max_duration = attention_span[1]
    
    # Video must not exceed attention span
    if video_duration_minutes > max_duration + 5:  # Allow 5 min grace
        return False
    
    # Video must be at least 2 minutes (too short = not educational)
    if video_duration_minutes < 2:
        return False
    
    # Filter 5: Content coverage (if available)
    if 'content_coverage' in video:
        coverage_pct = video['content_coverage'].get('coverage_percentage', 0)
        if coverage_pct < MIN_CONTENT_COVERAGE_PERCENTAGE:
            return False
    
    # Filter 6: Redundancy check (if available)
    if 'redundancy_analysis' in video:
        redundancy_pct = video['redundancy_analysis'].get('redundancy_percentage', 0)
        if redundancy_pct > MAX_REDUNDANCY_PERCENTAGE:
            return False
    
    return True


def calculate_relevance_score(video, section, grade_level, existing_videos):
    """
    Calculate a multi-factor relevance score for the video
    
    Scoring components:
    - Channel demographic match (25%)
    - Content coverage (25%)
    - Information density / WPM (20%)
    - Content uniqueness (15%)
    - Duration appropriateness (10%)
    - Engagement ratio (5%)
    
    Args:
        video (dict): Video data with content analysis
        section (dict): Section requirements
        grade_level (str): Target grade level
        existing_videos (list): Already selected videos
    
    Returns:
        float: Relevance score (0-10)
    """
    score = 0.0
    
    # Component 1: Channel demographic match (0-4 points, 25% weight = 0-2.5 final)
    channel_score = calculate_channel_demographic_score(video['channel_name'], grade_level)
    score += (channel_score / 4.0) * 2.5
    
    # Component 2: Content coverage (0-100%, 25% weight = 0-2.5 final)
    if 'content_coverage' in video:
        coverage_pct = video['content_coverage'].get('coverage_percentage', 50)
        score += (coverage_pct / 100.0) * 2.5
    else:
        score += 1.25  # Neutral score if no coverage data
    
    # Component 3: Information density / WPM (0-3 points, 20% weight = 0-2.0 final)
    wpm_score = calculate_wpm_score(video.get('wpm'), grade_level)
    score += (wpm_score / 3.0) * 2.0
    
    # Component 4: Content uniqueness (0-3 points, 15% weight = 0-1.5 final)
    if 'redundancy_analysis' in video:
        redundancy_pct = video['redundancy_analysis'].get('redundancy_percentage', 0)
        uniqueness_score = 3.0 * (1 - redundancy_pct / 100.0)  # Lower redundancy = higher score
        score += (uniqueness_score / 3.0) * 1.5
    else:
        score += 1.5  # Full uniqueness score if first video
    
    # Component 5: Duration appropriateness (0-2 points, 10% weight = 0-1.0 final)
    duration_score = calculate_duration_score(video['duration_seconds'], section.get('duration_minutes', 0), grade_level)
    score += (duration_score / 2.0) * 1.0
    
    # Component 6: Engagement ratio (0-2 points, 5% weight = 0-0.5 final)
    engagement_score = calculate_engagement_score(video['view_count'], video['like_count'])
    score += (engagement_score / 2.0) * 0.5
    
    return min(score, 10.0)  # Cap at 10


def calculate_wpm_score(wpm, grade_level):
    """
    Score based on words-per-minute (information density)
    
    Args:
        wpm (float): Words per minute, or None if no transcript
        grade_level (str): Target grade level
    
    Returns:
        float: Score 0-3
    """
    if wpm is None:
        return 1.5  # Neutral score if no transcript
    
    # Determine appropriate WPM range
    try:
        grade_num = int(grade_level) if isinstance(grade_level, str) and grade_level.isdigit() else 5
    except:
        grade_num = 5
    
    if grade_num <= 5:
        target_range = WPM_RANGES['elementary']
    elif grade_num <= 8:
        target_range = WPM_RANGES['middle_school']
    else:
        target_range = WPM_RANGES['high_school']
    
    min_wpm, max_wpm = target_range
    
    # Perfect match
    if min_wpm <= wpm <= max_wpm:
        return 3.0
    
    # Slightly fast but acceptable
    if max_wpm < wpm <= max_wpm + 20:
        return 1.5
    
    # Too fast
    if wpm > max_wpm + 20:
        return 0.0
    
    # Slightly slow but acceptable
    if min_wpm - 20 <= wpm < min_wpm:
        return 2.0
    
    # Too slow (overly simplistic)
    return 1.0


def calculate_duration_score(duration_seconds, section_duration_minutes, grade_level):
    """
    Score based on video duration vs attention span and section time
    
    Args:
        duration_seconds (int): Video duration
        section_duration_minutes (int): Section allocated time
        grade_level (str): Target grade level
    
    Returns:
        float: Score 0-2
    """
    video_duration_minutes = duration_seconds / 60
    
    # Get grade-appropriate attention span
    try:
        grade_num = int(grade_level) if isinstance(grade_level, str) and grade_level.isdigit() else 5
    except:
        grade_num = 5
    
    attention_span = ATTENTION_SPAN_RANGES.get(grade_num, (10, 15))
    min_attention, max_attention = attention_span
    
    score = 0.0
    
    # Within attention span range
    if min_attention <= video_duration_minutes <= max_attention:
        score += 1.0
    
    # Fits within section time (±5 min tolerance)
    if abs(video_duration_minutes - section_duration_minutes) <= 5:
        score += 1.0
    elif abs(video_duration_minutes - section_duration_minutes) <= 10:
        score += 0.5
    
    return score


def calculate_engagement_score(view_count, like_count):
    """
    Score based on engagement ratio (likes per view)
    
    Args:
        view_count (int): Number of views
        like_count (int): Number of likes
    
    Returns:
        float: Score 0-2
    """
    if view_count == 0:
        return 0.0
    
    # Calculate likes per 1000 views
    engagement_ratio = (like_count / view_count) * 1000
    
    # Educational content typically has 5-20 likes per 1000 views
    if 10 <= engagement_ratio <= 30:
        return 2.0  # Optimal range
    elif 5 <= engagement_ratio < 10 or 30 < engagement_ratio <= 50:
        return 1.0  # Acceptable range
    else:
        return 0.5  # Outside normal range


def select_top_videos(videos, max_count):
    """
    Select top N videos from filtered and ranked list
    
    Args:
        videos (list): Filtered and ranked videos
        max_count (int): Maximum number of videos to select
    
    Returns:
        list: Top N videos
    """
    return videos[:max_count]