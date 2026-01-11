from config import PLA_FRAMEWORK, MAX_BOX_DURATION_MINUTES

def get_box_generation_prompt(teacher_input):
    """
    Generate the prompt for creating a LIBRARY of modular teaching boxes.
    """
    
    grade_level = teacher_input['grade_level']
    subject = teacher_input['subject']
    topic = teacher_input['topic']
    duration = teacher_input['duration']
    total_minutes = teacher_input['total_minutes']
    requirements = teacher_input['requirements']
    
    # Generate 2x content (so teacher has options)
    target_total_minutes = total_minutes * 2
    
    # Calculate number of boxes (targeting 20-25 min per box on average)
    num_boxes = max(8, min(20, int(target_total_minutes / 22)))
    
    prompt = f"""
You are an expert elementary education curriculum designer. Generate a LIBRARY of modular teaching boxes that teachers can mix and match to create custom curricula.

TEACHER INPUT:
- Grade Level: {grade_level}
- Subject: {subject}
- Topic: {topic}
- Available Teaching Time: {duration} ({total_minutes} minutes)
- Special Requirements: {requirements}

PLA FRAMEWORK:
{PLA_FRAMEWORK}

TASK:
Generate {num_boxes} self-contained teaching modules ("boxes") that cover {topic} from multiple angles.
Target total content: ~{target_total_minutes} minutes (2x teacher's available time for flexibility)

CRITICAL BOX DESIGN PRINCIPLES:

1. MODULARITY & INDEPENDENCE
   - Each box should work as a standalone lesson
   - Minimize dependencies (only mark truly essential prerequisites)
   - Teacher should be able to pick ANY combination of boxes

2. TOPIC BREADTH (NOT SPECIFICITY)
   - Topics should be broad enough to have many available resources
   - ✅ GOOD: "MLK's Early Life", "The 'I Have a Dream' Speech", "Montgomery Bus Boycott"
   - ❌ BAD: "MLK's Education at Morehouse and Gandhi's Influence"
   - Each topic should be something a teacher can easily find worksheets/videos/activities for

3. DURATION
   - Each box: 15-30 minutes (bite-sized and focused)
   - NO box should exceed 30 minutes

4. DIVERSITY OF LEARNING EXPERIENCES
   Create boxes across different types:
   
   a) CORE KNOWLEDGE - Essential foundation
      - Who, what, when, where basics
      - Historical context
      - Timeline of events
   
   b) DEEP DIVES - Specific events, speeches, concepts
      - Famous speeches
      - Major events (boycotts, marches, etc.)
      - Key concepts (nonviolence, civil disobedience, etc.)
   
   c) APPLICATION & REFLECTION - Critical thinking
      - Comparing past and present
      - "What would you do?" scenarios
      - Relevance to today's world
   
   d) HANDS-ON & CREATIVE - Projects and activities
      - Art projects
      - Role-playing
      - Presentations

5. PLA PILLAR COVERAGE
   - Ensure all 4 PLA pillars are represented across the library
   - Self-Knowledge: Reflection, personal connections
   - Knowledge: Facts, events, timeline
   - Wisdom: Critical thinking, analysis
   - Application: Real-world connections, projects

6. DETAILED LEARNING OBJECTIVES (CRITICAL FOR RESOURCE FINDING)
   For each box, provide:
   - Specific, measurable learning objectives
   - Key concepts and keywords (these help find YouTube videos and worksheets)
   - What must be covered in the lesson
   
   Example GOOD box:
   {{
     "title": "The Montgomery Bus Boycott",
     "subtopics": ["Rosa Parks arrest", "Bus boycott organization", "Impact"],
     "learning_objectives": [
       "Students will understand what sparked the Montgomery Bus Boycott",
       "Students will identify key people involved",
       "Students will explain how the boycott worked and its outcome"
     ],
     "content_keywords": [
       "Rosa Parks",
       "Montgomery buses",
       "segregation",
       "boycott",
       "381 days"
     ],
     "what_must_be_covered": "The arrest of Rosa Parks, how the boycott was organized, the role of MLK, how long it lasted, and its success"
   }}

CONSTRAINTS:
- Generate {num_boxes} boxes total
- Each box: 15-30 minutes (NO longer)
- Only mark prerequisites for truly essential foundational knowledge
- Use age-appropriate language for {grade_level}
- Topics should be broad enough for easy resource discovery
- Address teacher's requirements: {requirements}

OUTPUT FORMAT (strict JSON):
{{
  "topic": "{topic}",
  "grade_level": "{grade_level}",
  "teacher_time_budget_minutes": {total_minutes},
  "total_boxes_generated": {num_boxes},
  "library_approach": true,
  "boxes": [
    {{
      "box_id": 1,
      "title": "string (broad, resource-rich topic)",
      "description": "string (1 sentence - what students will learn)",
      "duration_minutes": 0,
      "box_type": "core_knowledge|deep_dive|application_reflection|hands_on_creative",
      "components": {{
        "instruction": {{
          "subtopics": ["string - broad subtopics"],
          "teaching_method": "video_explanation|direct_teaching|guided_discovery",
          "duration_minutes": 0,
          "learning_objectives": ["string - specific, measurable goals"],
          "content_keywords": ["string - key concepts for resource finding"],
          "what_must_be_covered": "string - detailed content description"
        }},
        "worksheet": null,
        "activity": null
      }},
      "learning_outcomes": ["string"],
      "pla_pillars": ["Self-Knowledge", "Knowledge", "Wisdom", "Application"],
      "prerequisites": [],
      "difficulty_level": "easy|medium|challenging",
      "resource_availability": "high|medium|low"
    }}
  ]
}}

IMPORTANT NOTES:
- Focus on BROAD, well-known topics that have lots of available educational resources
- Each box should be independently teachable
- Avoid overly specific or niche combinations of topics
- Worksheets/activities in components should be null (Phase 3 will generate options)
- Mark "resource_availability" honestly - popular topics should be "high"
- Be VERY SPECIFIC in learning objectives and keywords for Phase 3 resource finding

Generate the library of boxes now as valid JSON only. No other text.
"""
    
    return prompt