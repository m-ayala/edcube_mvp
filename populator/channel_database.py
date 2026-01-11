"""
Channel database for demographic filtering
Maintains whitelists and blacklists of educational channels with target age ranges
"""

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


def get_channel_tier(channel_name):
    """
    Determine which tier a channel belongs to
    
    Args:
        channel_name (str): YouTube channel name
    
    Returns:
        int: 1 (tier 1), 2 (tier 2), 0 (unknown), -1 (blacklisted)
    """
    channel_lower = channel_name.lower()
    
    # Check blacklist first
    for blacklisted in BLACKLIST_CHANNELS:
        if blacklisted in channel_lower:
            return -1
    
    # Check tier 1
    for tier1_channel in TIER_1_CHANNELS.keys():
        if tier1_channel in channel_lower:
            return 1
    
    # Check tier 2
    for tier2_channel in TIER_2_CHANNELS.keys():
        if tier2_channel in channel_lower:
            return 2
    
    # Unknown channel
    return 0


def calculate_channel_demographic_score(channel_name, grade_level):
    """
    Calculate how well a channel matches the target grade level
    
    Args:
        channel_name (str): YouTube channel name
        grade_level (str or int): Target grade level (e.g., "5" or 5)
    
    Returns:
        float: Score 0-4
    """
    # Convert grade_level to int
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
    except:
        grade_level = 5  # Default to grade 5 if parsing fails
    
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
                    return 4.0  # Perfect match
                elif abs(grade_level - min_grade) <= 2 or abs(grade_level - max_grade) <= 2:
                    return 3.0  # Close match
                else:
                    return 2.0  # Tier 1 but not ideal age range
    
    # Tier 2: Check age range match
    if tier == 2:
        channel_lower = channel_name.lower()
        for channel_key, (min_grade, max_grade) in TIER_2_CHANNELS.items():
            if channel_key in channel_lower:
                if min_grade <= grade_level <= max_grade:
                    return 2.0  # General educational, in range
                else:
                    return 1.0  # General educational, outside range
    
    # Unknown channel
    return 0.5  # Neutral score for unknown channels


def is_kid_appropriate_channel(channel_name, grade_level):
    """
    Quick check if channel is appropriate for elementary students
    
    Args:
        channel_name (str): YouTube channel name
        grade_level (str or int): Target grade level
    
    Returns:
        bool: True if appropriate, False if blacklisted
    """
    tier = get_channel_tier(channel_name)
    return tier != -1  # Everything except blacklisted is potentially appropriate