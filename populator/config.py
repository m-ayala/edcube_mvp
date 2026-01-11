import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# OpenAI Configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = "gpt-4o"
OPENAI_TEMPERATURE = 0.7

# YouTube API Configuration
YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")
YOUTUBE_MAX_RESULTS_PER_QUERY = 5  # Get 5 results per search query
YOUTUBE_MAX_VIDEOS_PER_SECTION = 3  # Select max 3 videos per section

# Video Filtering Criteria
MIN_VIEW_COUNT = 10000  # Minimum views to consider
MIN_LIKE_RATIO = 0.005  # 0.5% like ratio (likes / views) - realistic for educational content
PREFER_VERIFIED_CHANNELS = True

# Information Density (Words Per Minute)
WPM_RANGES = {
    'elementary': (100, 130),  # Grades K-5
    'middle_school': (130, 160),  # Grades 6-8
    'high_school': (160, 180),  # Grades 9-12
}

# Duration Appropriateness (by grade level)
ATTENTION_SPAN_RANGES = {
    1: (5, 7),    # Grade 1: 5-7 min max
    2: (5, 8),    # Grade 2: 5-8 min max
    3: (8, 12),   # Grade 3: 8-12 min max
    4: (10, 15),  # Grade 4: 10-15 min max
    5: (10, 15),  # Grade 5: 10-15 min max
    6: (12, 18),  # Grade 6: 12-18 min max
}

# Grade-Level Demographic Requirements (kid-focused vs general educational split)
DEMOGRAPHIC_REQUIREMENTS = {
    2: {'tier1_min': 0.80, 'tier2_max': 0.20},  # 80% kid channels, 20% general
    3: {'tier1_min': 0.70, 'tier2_max': 0.30},  # 70/30
    4: {'tier1_min': 0.60, 'tier2_max': 0.40},  # 60/40
    5: {'tier1_min': 0.50, 'tier2_max': 0.50},  # 50/50
    6: {'tier1_min': 0.40, 'tier2_max': 0.60},  # 40/60
}

# Content Validation Settings
MIN_CONTENT_COVERAGE_PERCENTAGE = 60  # Videos must cover at least 60% of section requirements
MAX_REDUNDANCY_PERCENTAGE = 60  # Reject videos with >60% content overlap with existing videos
MAX_SEARCH_ITERATIONS = 3  # Maximum times to iterate search if content gaps exist
CONVERGENCE_THRESHOLD = 10  # Stop iterating if coverage improvement < 10%

# File Paths
OUTPUTS_DIR = "../outputs"
INPUT_OUTLINE_FILE = "course_outline.json"
OUTPUT_OUTLINE_FILE = "course_outline_with_resources.json"
OUTPUT_OUTLINE_TXT_FILE = "course_outline_with_resources.txt"