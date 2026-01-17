"""
Channel database for demographic filtering
Maintains whitelists and blacklists of educational channels with target age ranges
"""

import logging
from typing import Tuple, Optional

# Initialize logger
logger = logging.getLogger(__name__)


# ============================================================================
# CHANNEL TIER DEFINITIONS
# ============================================================================

# Tier 1: Channels explicitly designed for elementary students
TIER_1_CHANNELS = {
    'crash course kids': (3, 6),
    'national geographic kids': (2, 5),
    'pbs learningmedia': (1, 8),
    'free school': (3, 7),
    'homeschool pop': (1, 5),
    'brainpop': (3, 8),
    'flocabulary': (3, 8),
    'history for kids': (2, 6),
    'simple history': (4, 8),
    'peekaboo kidz': (1, 4),
    'happy learning english': (2, 6),
    'smile and learn': (1, 5),
}

# Tier 2: General educational channels (all ages, often appropriate)
TIER_2_CHANNELS = {
    'national geographic': (3, 12),
    'history channel': (5, 12),
    'biography': (5, 12),
    'smithsonian': (4, 12),
    'discovery': (4, 12),
    'pbs': (3, 12),
    'ted-ed': (6, 12),
    'scishow': (6, 12),
}

# Blacklist: Channels explicitly too advanced for elementary
BLACKLIST_CHANNELS = {
    'crashcourse',  # High school/college (NOT 'crash course kids')
    'khan academy',  # Unless specifically kids section
    'mit opencourseware',
    'stanford',
    'yale courses',
    'coursera',
    'udacity',
    'ap',
}


# ============================================================================
# PUBLIC API
# ============================================================================

def get_channel_tier(channel_name: str) -> int:
    """
    Determine which tier a channel belongs to.
    
    Args:
        channel_name: YouTube channel name
    
    Returns:
        int: 1 (tier 1), 2 (tier 2), 0 (unknown), -1 (blacklisted)
    
    Example:
        >>> get_channel_tier('Crash Course Kids')
        1
        >>> get_channel_tier('CrashCourse')
        -1
        >>> get_channel_tier('Random Channel')
        0
    """
    channel_lower = channel_name.lower()
    
    # Check blacklist first
    for blacklisted in BLACKLIST_CHANNELS:
        if blacklisted in channel_lower:
            logger.debug(f"Channel '{channel_name}' is blacklisted")
            return -1
    
    # Check tier 1
    for tier1_channel in TIER_1_CHANNELS.keys():
        if tier1_channel in channel_lower:
            logger.debug(f"Channel '{channel_name}' is tier 1 (kid-focused)")
            return 1
    
    # Check tier 2
    for tier2_channel in TIER_2_CHANNELS.keys():
        if tier2_channel in channel_lower:
            logger.debug(f"Channel '{channel_name}' is tier 2 (general educational)")
            return 2
    
    # Unknown channel
    logger.debug(f"Channel '{channel_name}' is unknown (tier 0)")
    return 0


def calculate_channel_demographic_score(channel_name: str, grade_level: int) -> float:
    """
    Calculate how well a channel matches the target grade level.
    
    Args:
        channel_name: YouTube channel name
        grade_level: Target grade level (0-12, where 0 = Kindergarten)
    
    Returns:
        float: Score 0-4 where:
            - 4.0 = Perfect match (tier 1, in age range)
            - 3.0 = Close match (tier 1, near age range)
            - 2.0 = General educational in range (tier 2)
            - 1.0 = General educational outside range
            - 0.5 = Unknown channel
            - 0.0 = Blacklisted
    
    Example:
        >>> calculate_channel_demographic_score('Crash Course Kids', 5)
        4.0
        >>> calculate_channel_demographic_score('National Geographic', 5)
        2.0
        >>> calculate_channel_demographic_score('MIT OpenCourseWare', 5)
        0.0
    """
    # Convert grade_level to int if needed
    grade_level = _parse_grade_level(grade_level)
    
    tier = get_channel_tier(channel_name)
    
    # Blacklisted
    if tier == -1:
        return 0.0
    
    # Tier 1: Check age range match
    if tier == 1:
        channel_lower = channel_name.lower()
        for channel_key, (min_grade, max_grade) in TIER_1_CHANNELS.items():
            if channel_key in channel_lower:
                if min_grade <= grade_level <= max_grade:
                    logger.debug(f"Perfect demographic match for '{channel_name}' at grade {grade_level}")
                    return 4.0  # Perfect match
                elif abs(grade_level - min_grade) <= 2 or abs(grade_level - max_grade) <= 2:
                    logger.debug(f"Close demographic match for '{channel_name}' at grade {grade_level}")
                    return 3.0  # Close match
                else:
                    logger.debug(f"Tier 1 but not ideal age range for '{channel_name}' at grade {grade_level}")
                    return 2.0  # Tier 1 but not ideal age range
    
    # Tier 2: Check age range match
    if tier == 2:
        channel_lower = channel_name.lower()
        for channel_key, (min_grade, max_grade) in TIER_2_CHANNELS.items():
            if channel_key in channel_lower:
                if min_grade <= grade_level <= max_grade:
                    logger.debug(f"General educational in range for '{channel_name}' at grade {grade_level}")
                    return 2.0  # General educational, in range
                else:
                    logger.debug(f"General educational outside range for '{channel_name}' at grade {grade_level}")
                    return 1.0  # General educational, outside range
    
    # Unknown channel
    logger.debug(f"Neutral score for unknown channel '{channel_name}'")
    return 0.5  # Neutral score for unknown channels


def is_kid_appropriate_channel(channel_name: str, grade_level: int) -> bool:
    """
    Quick check if channel is appropriate for elementary students.
    
    Args:
        channel_name: YouTube channel name
        grade_level: Target grade level
    
    Returns:
        bool: True if appropriate (not blacklisted), False if blacklisted
    
    Example:
        >>> is_kid_appropriate_channel('Crash Course Kids', 5)
        True
        >>> is_kid_appropriate_channel('MIT OpenCourseWare', 5)
        False
    """
    tier = get_channel_tier(channel_name)
    is_appropriate = tier != -1
    
    if not is_appropriate:
        logger.warning(f"Channel '{channel_name}' is not kid-appropriate (blacklisted)")
    
    return is_appropriate


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def _parse_grade_level(grade_level) -> int:
    """
    Parse grade level to integer.
    
    Args:
        grade_level: String or int grade level (e.g., "5", "3-4", "K", 5)
    
    Returns:
        int: Grade level as integer (0 for Kindergarten)
    
    Example:
        >>> _parse_grade_level("5")
        5
        >>> _parse_grade_level("K")
        0
        >>> _parse_grade_level("3-4")
        3
    """
    try:
        if isinstance(grade_level, str):
            # Handle formats like "5", "3-4", "K-5"
            if '-' in grade_level:
                grade_level = int(grade_level.split('-')[0])
            elif grade_level.lower().startswith('k'):
                grade_level = 0
            else:
                grade_level = int(grade_level)
        else:
            grade_level = int(grade_level)
    except (ValueError, AttributeError):
        logger.warning(f"Could not parse grade level: {grade_level}, defaulting to 5")
        grade_level = 5  # Default to grade 5 if parsing fails
    
    return grade_level