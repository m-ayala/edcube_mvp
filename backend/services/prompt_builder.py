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
Each section should have:
- A clear, descriptive title
- A detailed description (2-3 sentences) explaining what will be covered
- Alignment with the course theme and grade level

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
        
        prompt = f"""
You are an expert curriculum designer following Peter Drucker's Management as Liberal Art framework.

COURSE CONTEXT:
- Course: {course.get('title', 'Unknown')}
- Grade Level: {course.get('grade', 'Unknown')}
- Description: {course.get('description', 'Not provided')}
"""
        
        if all_section_names:
            prompt += f"""

OTHER SECTIONS IN COURSE (for context):
{', '.join(all_section_names)}
"""
        
        prompt += f"""

CURRENT SECTION:
- Title: {section.get('title', 'Unknown')}
- Description: {section.get('description', 'Not provided')}
"""
        
        if existing_subsections:
            prompt += f"""

EXISTING SUBSECTIONS (avoid duplication):
"""
            for i, subsection in enumerate(existing_subsections, 1):
                prompt += f"{i}. {subsection.get('title', 'Unknown')}: {subsection.get('description', 'No description')}\n"
        
        if user_guidance:
            prompt += f"""

TEACHER'S GUIDANCE:
{user_guidance}
"""
        
        prompt += f"""

TASK:
Generate {count} new subsection(s) for this section.
Each subsection should:
- Break down the section topic into focused learning units
- Have a clear, specific title
- Include a detailed description (2-3 sentences)
- Be appropriate for {course.get('grade', 'the grade level')}

Return ONLY valid JSON in this exact format:
{{
  "subsections": [
    {{
      "title": "Subsection Title",
      "description": "Detailed description of what this subsection covers",
      "duration_minutes": 30,
      "learning_objectives": ["objective 1", "objective 2"],
      "content_keywords": ["keyword1", "keyword2"]
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
        
        prompt = f"""
You are an expert curriculum designer following Peter Drucker's Management as Liberal Art framework.

COURSE: {course.get('title', 'Unknown')} (Grade {course.get('grade', 'Unknown')})

SECTION: {section.get('title', 'Unknown')}
{section.get('description', '')}

SUBSECTION: {subsection.get('title', 'Unknown')}
{subsection.get('description', 'Not provided')}
"""
        
        if existing_topics:
            prompt += f"""

EXISTING TOPIC BOXES (avoid duplication):
"""
            for i, topic in enumerate(existing_topics, 1):
                prompt += f"{i}. {topic.get('title', 'Unknown')}: {topic.get('description', 'No description')}\n"
        
        if user_guidance:
            prompt += f"""

TEACHER'S GUIDANCE:
{user_guidance}
"""
        
        prompt += f"""

TASK:
Generate {count} topic box(es) for this subsection.
Topic boxes are modular learning units that can be:
- Knowledge-based (concepts, facts, understanding)
- Application-based (practice, projects, real-world use)
- Critical thinking (analysis, evaluation, synthesis)
- Personal growth (reflection, character development)

Each topic box should:
- Have a clear, engaging title
- Include a description (1-2 sentences)
- Specify duration in minutes (10-30 min typical)
- Align with the subsection's learning goals

Return ONLY valid JSON in this exact format:
{{
  "topics": [
    {{
      "title": "Topic Title",
      "description": "What students will learn or do",
      "duration_minutes": 20,
      "pla_pillars": ["Knowledge", "Application"],
      "learning_objectives": ["specific objective"],
      "content_keywords": ["keyword1", "keyword2"]
    }}
  ]
}}
"""
        
        return prompt