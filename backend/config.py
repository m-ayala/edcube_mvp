"""
EdCube Backend Configuration
Centralized configuration for all three phases (Outliner, Populator, Hands-on)
"""

import os
from dotenv import load_dotenv
from dataclasses import dataclass

# Load environment variables
load_dotenv()


# ============================================================================
# API CONFIGURATION (Shared across all phases)
# ============================================================================

class APIConfig:
    """API keys and credentials"""
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")
    GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
    GOOGLE_CSE_ID = os.getenv("GOOGLE_CSE_ID")
    
    # OpenAI settings
    OPENAI_MODEL = "gpt-4o"
    OPENAI_TEMPERATURE = 0.7


# ============================================================================
# PHASE 1: OUTLINER CONFIGURATION
# ============================================================================

class OutlinerConfig:
    """Configuration for Phase 1: Course Outline Generation"""
    
    # Course generation settings
    MAX_BOX_DURATION_MINUTES = 45
    BOX_TIME_MULTIPLIER = 2  # Generate 2x the teacher's time budget
    
    # PLA Framework
    PLA_FRAMEWORK = """
The PLA (Pillars of Learning and Achievement) Framework consists of 4 pillars:

1. SELF-KNOWLEDGE
   - Understanding oneself, personal strengths, values, and growth areas
   - Self-reflection, metacognition, emotional awareness
   - Building confidence and self-efficacy

2. KNOWLEDGE
   - Acquiring facts, concepts, and information
   - Subject matter expertise and foundational understanding
   - Building vocabulary and comprehension

3. WISDOM
   - Critical thinking, analysis, and synthesis
   - Making connections between concepts
   - Asking "why" and "how" questions
   - Evaluating and judging information

4. APPLICATION
   - Putting knowledge into practice
   - Real-world connections and hands-on experiences
   - Problem-solving and project-based learning
   - Creating, building, and experimenting

Every course should integrate all 4 pillars across its sections and activities.
"""
    
    # Output settings
    OUTPUT_DIR = "../outputs"


# ============================================================================
# PHASE 2: POPULATOR CONFIGURATION (Video Resources)
# ============================================================================

class PopulatorConfig:
    """Configuration for Phase 2: Video Resource Generation"""
    
    # YouTube search settings
    YOUTUBE_MAX_RESULTS_PER_QUERY = 5  # Results per search query
    YOUTUBE_MAX_VIDEOS_PER_SECTION = 3  # Max videos to select per section
    
    # Video filtering criteria
    MIN_VIEW_COUNT = 10000  # Minimum views to consider
    MIN_LIKE_RATIO = 0.005  # 0.5% like ratio (realistic for educational content)
    PREFER_VERIFIED_CHANNELS = True
    
    # Information density (Words Per Minute)
    WPM_RANGES = {
        'elementary': (100, 130),      # Grades K-5
        'middle_school': (130, 160),   # Grades 6-8
        'high_school': (160, 180),     # Grades 9-12
    }
    
    # Duration appropriateness by grade level
    ATTENTION_SPAN_RANGES = {
        1: (5, 7),    # Grade 1: 5-7 min max
        2: (5, 8),    # Grade 2: 5-8 min max
        3: (8, 12),   # Grade 3: 8-12 min max
        4: (10, 15),  # Grade 4: 10-15 min max
        5: (10, 15),  # Grade 5: 10-15 min max
        6: (12, 18),  # Grade 6: 12-18 min max
    }
    
    # Grade-level demographic requirements
    DEMOGRAPHIC_REQUIREMENTS = {
        2: {'tier1_min': 0.80, 'tier2_max': 0.20},  # 80% kid channels
        3: {'tier1_min': 0.70, 'tier2_max': 0.30},  # 70/30
        4: {'tier1_min': 0.60, 'tier2_max': 0.40},  # 60/40
        5: {'tier1_min': 0.50, 'tier2_max': 0.50},  # 50/50
        6: {'tier1_min': 0.40, 'tier2_max': 0.60},  # 40/60
    }
    
    # Content validation settings
    MIN_CONTENT_COVERAGE_PERCENTAGE = 20  # Videos must cover 60% of requirements
    MAX_REDUNDANCY_PERCENTAGE = 80        # Reject videos with >60% overlap
    MAX_SEARCH_ITERATIONS = 3             # Max search iterations per section
    CONVERGENCE_THRESHOLD = 10            # Stop if coverage improvement < 10%
    
    # File paths
    OUTPUTS_DIR = "../outputs"
    INPUT_OUTLINE_FILE = "course_outline.json"
    OUTPUT_OUTLINE_FILE = "course_outline_with_resources.json"
    OUTPUT_OUTLINE_TXT_FILE = "course_outline_with_resources.txt"


# ============================================================================
# PHASE 3: HANDS-ON CONFIGURATION (Worksheets & Activities)
# ============================================================================

class HandsOnConfig:
    """Configuration for Phase 3: Worksheet & Activity Generation"""
    
    # Search settings
    GOOGLE_MAX_WORKSHEET_IMAGES = 6   # Max images to analyze per search
    GOOGLE_MAX_ACTIVITY_PAGES = 8     # Max pages to crawl per search
    
    # Resource selection
    MAX_WORKSHEET_OPTIONS = 3         # Top worksheets to return
    MAX_ACTIVITY_OPTIONS = 3          # Top activities to return
    
    # Concurrent processing
    WORKSHEET_ANALYSIS_WORKERS = 3    # Parallel image analysis threads
    ACTIVITY_CRAWL_WORKERS = 4        # Parallel web crawling threads
    TIMEOUT_SECONDS = 30              # Timeout for API/crawl operations
    
    # Quality filtering
    MIN_WORKSHEET_VISUAL_QUALITY = 5      # 0-10 scale
    MIN_WORKSHEET_EDUCATIONAL_VALUE = 5   # 0-10 scale
    MIN_ACTIVITY_QUALITY_SCORE = 4        # 0-10 scale
    
    # File paths
    OUTPUTS_DIR = "../outputs"


# ============================================================================
# LOGGING CONFIGURATION
# ============================================================================

class LoggingConfig:
    """Logging settings for all phases"""
    
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    LOG_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"


# ============================================================================
# CONVENIENCE EXPORTS
# ============================================================================

# Export commonly used configs
OPENAI_API_KEY = APIConfig.OPENAI_API_KEY
OPENAI_MODEL = APIConfig.OPENAI_MODEL
OPENAI_TEMPERATURE = APIConfig.OPENAI_TEMPERATURE

YOUTUBE_API_KEY = APIConfig.YOUTUBE_API_KEY
GOOGLE_API_KEY = APIConfig.GOOGLE_API_KEY
GOOGLE_CSE_ID = APIConfig.GOOGLE_CSE_ID