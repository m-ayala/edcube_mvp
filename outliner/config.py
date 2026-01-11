import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# OpenAI Configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = "gpt-4o"
OPENAI_TEMPERATURE = 0.7

# Course Generation Settings
MAX_BOX_DURATION_MINUTES = 45
BOX_TIME_MULTIPLIER = 2  # Generate 2x the teacher's time budget in boxes

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

# Output Settings
OUTPUT_DIR = "../outputs"