# backend/services/prompt_builder.py

"""
Prompt Builder for Unified Curriculum Generation
Builds context-aware prompts for sections, subsections, and topic boxes
"""

from typing import Dict, List, Optional, Any


class PromptBuilder:
    """Builds AI prompts based on generation level and context"""
    
    def __init__(self):
        pass
    
    def build_prompt(
        self,
        level: str,
        context: Dict[str, Any],
        user_guidance: Optional[str] = None,
        count: int = 3
    ) -> str:
        """
        Main entry point - routes to appropriate prompt builder
        
        Args:
            level: "full_course", "sections", "subsections", or "topics"
            context: Context dictionary with course, section, subsection info
            user_guidance: Optional teacher guidance text
            count: Number of items to generate
            
        Returns:
            str: Complete prompt for GPT-4
        """
        
        if level == "full_course":
            return self._build_full_course_prompt(context, user_guidance)
        elif level == "sections":
            return self._build_sections_prompt(context, user_guidance, count)
        elif level == "subsections":
            return self._build_subsections_prompt(context, user_guidance, count)
        elif level == "topics":
            return self._build_topics_prompt(context, user_guidance, count)
        else:
            raise ValueError(f"Unknown level: {level}")
    
    def _build_full_course_prompt(
        self,
        context: Dict[str, Any],
        user_guidance: Optional[str]
    ) -> str:
        """Build prompt for full course generation (existing flow)"""
        course = context.get('course', {})
        
        base_prompt = f"""
You are an expert curriculum designer following Peter Drucker's Management as Liberal Art framework.

Create a comprehensive curriculum structure for:
- Course: {course.get('title', 'Unknown')}
- Grade Level: {course.get('grade', 'Unknown')}
- Subject: {course.get('subject', 'Unknown')}
- Duration: {course.get('duration', 'Unknown')}

Generate a complete course outline with sections, subsections, and topic boxes.
Each section should have 3-4 subsections, and each subsection should have 2-3 topic boxes.
"""
        
        if user_guidance:
            base_prompt += f"""

TEACHER'S GUIDANCE:
{user_guidance}

Incorporate this guidance while maintaining curriculum coherence.
"""
        
        base_prompt += """

Return the complete course structure in JSON format.
"""
        
        return base_prompt
    
    def _build_sections_prompt(
        self,
        context: Dict[str, Any],
        user_guidance: Optional[str],
        count: int
    ) -> str:
        """Build prompt for generating new sections"""
        course = context.get('course', {})
        existing_sections = context.get('existing_sections', [])
        
        prompt = f"""
You are an expert curriculum designer following Peter Drucker's Management as Liberal Art framework.

COURSE CONTEXT:
- Course: {course.get('title', 'Unknown')}
- Grade Level: {course.get('grade', 'Unknown')}
- Subject: {course.get('subject', 'Unknown')}
- Description: {course.get('description', 'Not provided')}
"""
        
        if existing_sections:
            prompt += f"""

EXISTING SECTIONS (avoid duplication):
"""
            for i, section in enumerate(existing_sections, 1):
                prompt += f"{i}. {section.get('title', 'Unknown')}: {section.get('description', 'No description')}\n"
        
        if user_guidance:
            prompt += f"""

TEACHER'S GUIDANCE:
{user_guidance}
"""
        
        prompt += f"""

TASK:
Generate {count} new section(s) that complement the existing curriculum structure.

UNIQUENESS REQUIREMENT:
- Before generating, review ALL existing sections listed above
- Each new section must cover territory that NONE of the existing sections touch
- If existing sections already cover a concept (even partially), do not overlap — find a genuinely distinct angle or chapter
- The new section must add clear value that is missing from the current structure

IMPORTANT SPECIFICITY RULES:
- Section titles must be SPECIFIC to the actual course content, NOT generic templates like "Introduction" or "Advanced Concepts"
- For example, for a Grade 3 course on "The Water Cycle": use "How Water Moves Through Nature" NOT "Introduction to Topic"
- For a Grade 5 course on "Fractions": use "Understanding Parts of a Whole" NOT "Foundational Concepts"
- Descriptions must mention CONCRETE subtopics, skills, or activities students will engage with
- Every section must be directly tied to the course subject "{course.get('title', '')}" and appropriate for Grade {course.get('grade', 'Unknown')}

Each section should have:
- A specific, content-rich title that tells the teacher exactly what will be taught
- A detailed description (2-3 sentences) naming concrete topics, skills, or concepts covered
- Logical progression from prior sections (if any exist)

Return ONLY valid JSON in this exact format:
{{
  "sections": [
    {{
      "title": "Section Title",
      "description": "Detailed description of what this section covers"
    }}
  ]
}}
"""
        
        return prompt
    
    def _build_subsections_prompt(
        self,
        context: Dict[str, Any],
        user_guidance: Optional[str],
        count: int
    ) -> str:
        """Build prompt for generating subsections within a section"""
        course = context.get('course', {})
        section = context.get('current_section', {})
        all_section_names = context.get('all_section_names', [])
        existing_subsections = section.get('existingSubsections', [])
        other_sections = context.get('other_sections', [])

        prompt = f"""
You are an expert curriculum designer following Peter Drucker's Management as Liberal Art framework.

COURSE CONTEXT:
- Course: {course.get('title', 'Unknown')}
- Grade Level: {course.get('grade', 'Unknown')}
- Description: {course.get('description', 'Not provided')}

CURRENT SECTION (generate subsections for THIS section only):
- Title: {section.get('title', 'Unknown')}
- Description: {section.get('description', 'Not provided')}
"""

        if other_sections:
            prompt += """
OTHER SECTIONS IN THIS COURSE (for context — do NOT generate content that belongs in these sections):
"""
            for i, sec in enumerate(other_sections, 1):
                subs = sec.get('subsections', [])
                sub_list = ', '.join(subs) if subs else 'no subsections yet'
                prompt += f"  {i}. {sec.get('title', 'Unknown')}: {sec.get('description', 'No description')} (Subsections: {sub_list})\n"
        elif all_section_names:
            prompt += f"""
OTHER SECTIONS IN COURSE (for context):
{', '.join(all_section_names)}
"""

        if existing_subsections:
            prompt += """
EXISTING SUBSECTIONS IN THIS SECTION (avoid duplication):
"""
            for i, subsection in enumerate(existing_subsections, 1):
                prompt += f"  {i}. {subsection.get('title', 'Unknown')}: {subsection.get('description', 'No description')}\n"
        
        if user_guidance:
            prompt += f"""

TEACHER'S GUIDANCE:
{user_guidance}
"""
        
        prompt += f"""

TASK:
Generate {count} new subsection(s) for the section "{section.get('title', 'Unknown')}".

UNIQUENESS REQUIREMENT:
- Before generating, review ALL existing subsections in this section listed above
- Each new subsection must cover an angle that NONE of the existing subsections in this section already cover
- Also check other sections — do not generate a subsection that belongs more naturally in a different section
- The new subsection must add a genuinely distinct perspective or skill within "{section.get('title', 'Unknown')}"

IMPORTANT SPECIFICITY AND SCOPE RULES:
- ONLY generate subsections that belong in the CURRENT section "{section.get('title', 'Unknown')}"
- Do NOT generate content that would be more appropriate for other sections listed above
- For example, if the current section is "Introduction to Leaves" and another section is "Functions of Leaves", do NOT create a subsection about photosynthesis or transpiration here
- Subsection titles must name the EXACT topic or skill being taught, NOT generic labels
- BAD example: "Key Concepts", "Practice and Application", "Review"
- GOOD example (for section "The Water Cycle"): "Evaporation: How the Sun Heats Water", "Condensation: Clouds Forming in the Sky"
- GOOD example (for section "Fractions"): "Cutting Pizzas into Equal Pieces", "Comparing Fractions with Same Denominators"
- Each subsection is ONE lesson (15-30 minutes) that a teacher can teach independently
- Learning objectives must use measurable verbs (identify, explain, compare, demonstrate, calculate) and reference specific content
- Content keywords must be specific enough to find real YouTube videos and worksheets for Grade {course.get('grade', 'Unknown')} students

Each subsection should:
- Have a specific title naming the exact concept or skill
- Include a description (2-3 sentences) explaining what students will do and learn
- Specify a realistic duration in minutes (15-30 min)
- List 2-3 specific, measurable learning objectives
- Include content keywords useful for finding educational resources

Return ONLY valid JSON in this exact format:
{{
  "subsections": [
    {{
      "title": "Subsection Title",
      "description": "Detailed description of what this subsection covers",
      "duration_minutes": 25,
      "learning_objectives": ["Students will be able to identify...", "Students will explain..."],
      "content_keywords": ["specific keyword for resource search", "another specific keyword"]
    }}
  ]
}}
"""
        
        return prompt
    
    def _build_topics_prompt(
        self,
        context: Dict[str, Any],
        user_guidance: Optional[str],
        count: int
    ) -> str:
        """Build prompt for generating topic boxes within a subsection"""
        course = context.get('course', {})
        section = context.get('current_section', {})
        subsection = context.get('subsection', {})
        existing_topics = subsection.get('existingTopics', [])
        other_sections = context.get('other_sections', [])
        sibling_subsections = context.get('sibling_subsections', [])

        prompt = f"""
You are an expert curriculum designer following Peter Drucker's Management as Liberal Art framework.

COURSE: {course.get('title', 'Unknown')} (Grade {course.get('grade', 'Unknown')})

CURRENT SECTION (generate topics for THIS section only): {section.get('title', 'Unknown')}
{section.get('description', '')}

CURRENT SUBSECTION (generate topics for THIS subsection only): {subsection.get('title', 'Unknown')}
{subsection.get('description', 'Not provided')}
"""

        if sibling_subsections:
            prompt += """
OTHER SUBSECTIONS IN THIS SECTION (for context — do NOT generate content that belongs in these):
"""
            for i, sib in enumerate(sibling_subsections, 1):
                prompt += f"  {i}. {sib.get('title', 'Unknown')}: {sib.get('description', 'No description')}\n"

        if other_sections:
            prompt += """
OTHER SECTIONS IN THIS COURSE (for context — do NOT generate content that belongs in these):
"""
            for i, sec in enumerate(other_sections, 1):
                subs = sec.get('subsections', [])
                sub_list = ', '.join(subs) if subs else 'no subsections yet'
                prompt += f"  {i}. {sec.get('title', 'Unknown')}: {sec.get('description', 'No description')} (Subsections: {sub_list})\n"

        if existing_topics:
            prompt += """
EXISTING TOPIC BOXES IN THIS SUBSECTION (avoid duplication):
"""
            for i, topic in enumerate(existing_topics, 1):
                prompt += f"  {i}. {topic.get('title', 'Unknown')}: {topic.get('description', 'No description')}\n"

        if user_guidance:
            prompt += f"""

TEACHER'S GUIDANCE:
{user_guidance}
"""
        
        prompt += f"""

TASK:
Generate {count} topic box(es) for the subsection "{subsection.get('title', 'Unknown')}" in section "{section.get('title', 'Unknown')}".

Topic boxes are the ATOMIC unit of learning — narrow, self-contained, and resource-ready.

UNIQUENESS REQUIREMENT:
- Review ALL existing topic boxes in this subsection listed above
- Each new topic box must cover something NONE of the existing ones already cover
- Also compare against sibling subsections — do not generate content that belongs in another subsection
- If in doubt, go narrower — a topic box should cover ONE specific idea or skill, not a broad theme

NARROWNESS AND SPECIFICITY (CRITICAL):
- Topic boxes must be NARROW. Not "Forces and Motion" — "How Friction Slows a Sliding Object"
- Not "Introduction to Fractions" — "Using a Number Line to Place Fractions Between 0 and 1"
- The title must describe exactly ONE concept or activity. If the title could apply to a full chapter, it is too broad.
- Scope: 10–30 minutes of focused instruction on a single idea

DESCRIPTION REQUIREMENTS (for resource generation quality):
- 2–3 sentences, fully concrete — name the EXACT objects, phenomena, equations, or scenarios students engage with
- Must be specific enough that a search engine can find real YouTube videos and worksheets about it
- BAD: "Students explore forces and how they affect motion." (too vague — will surface generic results)
- GOOD: "Students observe how increasing the mass of a cart affects its speed when pushed with equal force, recording data in a table." (specific — will surface relevant physics demos)
- No filler phrases: avoid "students will explore", "learn about", "discover the concept of"

LEARNING OBJECTIVES REQUIREMENTS (for resource generation quality):
- 2–3 objectives per topic box
- Must use specific action verbs: identify, calculate, compare, label, describe, demonstrate, explain, predict, measure
- Each objective must name the EXACT skill or knowledge being assessed — specific enough to write a test question for
- BAD: "Students will understand forces." (untestable)
- GOOD: "Students will identify the direction of friction force on an object moving across a rough surface." (testable)
- GOOD: "Students will calculate net force when two forces act in opposite directions." (testable)
- Objectives must directly correspond to what the description says students will do

CONTENT KEYWORDS REQUIREMENTS (for resource generation):
- 3–5 keywords specific enough to find Grade {course.get('grade', 'Unknown')}-appropriate videos and worksheets
- Must include: the specific concept name + grade level + format hint (e.g., "friction experiment grade 4", "net force worksheet middle school")
- BAD: "forces", "motion", "physics" (too broad — will surface college-level results)
- GOOD: "friction forces grade 4 experiment", "sliding friction vs static friction elementary" (specific — surfaces appropriate resources)

PLA PILLARS — map to 1-2 of:
- "Personal Growth": self-reflection, identity, collaboration, emotional awareness
- "Core Learning": facts, vocabulary, foundational concepts, essential skills
- "Critical Thinking": analysis, comparison, debate, synthesis, why/how questions
- "Application & Impact": real-world projects, career connections, making something, community relevance

Return ONLY valid JSON in this exact format:
{{
  "topics": [
    {{
      "title": "Specific narrow topic title — one concept only",
      "description": "2-3 concrete sentences describing exactly what students see, do, and engage with",
      "duration_minutes": 20,
      "pla_pillars": ["Core Learning"],
      "learning_objectives": [
        "Students will identify the direction of friction force on a moving object.",
        "Students will compare friction on rough vs smooth surfaces using experimental data."
      ],
      "content_keywords": ["friction force direction grade 4", "rough vs smooth surface friction experiment elementary"]
    }}
  ]
}}
"""
        
        return prompt