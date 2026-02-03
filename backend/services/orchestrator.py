# FILE 2: backend/services/orchestrator.py

"""
Orchestrator for curriculum generation - PHASE 1 ONLY VERSION

This version ONLY supports Phase 1 (box generation).
Phase 2 and Phase 3 are commented out for testing.
"""

import logging
import asyncio
from typing import Dict

logger = logging.getLogger(__name__)


class CurriculumOrchestrator:
    """
    Orchestrator for curriculum generation - PHASE 1 ONLY VERSION
    
    This version ONLY supports Phase 1 (box generation).
    Phase 2 and Phase 3 are commented out for testing.
    """
    
    def __init__(self):
        """Initialize the orchestrator"""
        logger.info("Initialized CurriculumOrchestrator (Phase 1 Only)")
    
    async def run_phase1(self, teacher_input: Dict) -> Dict:
        """
        Run Phase 1: Generate curriculum boxes/topics
        
        Args:
            teacher_input: Dictionary containing:
                - grade_level: str
                - subject: str
                - topic: str
                - duration: str (e.g., "8 hours", "2 weeks")
                - num_worksheets: int
                - num_activities: int
                - objectives: str (optional)
        
        Returns:
            dict: Outline data with generated boxes
        """
        from outliner.outline_generator import generate_boxes, create_final_outline
        
        logger.info(f"Running Phase 1 for: {teacher_input.get('topic', 'Unknown')}")
        
        try:
            # Convert duration string to minutes
            duration_str = teacher_input.get('duration', '8 hours')
            total_minutes = self._parse_duration_to_minutes(duration_str)
            
            # Add total_minutes and requirements fields expected by generate_boxes
            teacher_input_formatted = {
                'grade_level': teacher_input.get('grade_level'),
                'subject': teacher_input.get('subject'),
                'topic': teacher_input.get('topic'),
                'duration': duration_str,
                'total_minutes': total_minutes,
                'requirements': teacher_input.get('objectives', 'None')
            }
            
            # Generate outline (sections + subsections)
            outline_data = generate_boxes(teacher_input_formatted)
            
            if not outline_data:
                logger.error("Phase 1 failed: No outline generated")
                return None
            
            logger.info(f"Phase 1 complete: Generated {len(outline_data.get('sections', []))} sections")
            
            # Build final outline with computed fields
            outline = create_final_outline(outline_data)
            
            return outline
            
        except Exception as e:
            logger.error(f"Phase 1 error: {e}", exc_info=True)
            return None
    
    def _parse_duration_to_minutes(self, duration_str: str) -> int:
        """
        Parse duration string to minutes.
        
        Args:
            duration_str: Duration string like "8 hours", "90 minutes", "2 weeks"
        
        Returns:
            int: Total minutes
        """
        duration_str = duration_str.lower().strip()
        
        # Handle hours
        if 'hour' in duration_str:
            try:
                hours = float(duration_str.split('hour')[0].strip())
                return int(hours * 60)
            except:
                pass
        
        # Handle minutes
        if 'min' in duration_str:
            try:
                minutes = int(duration_str.split('min')[0].strip())
                return minutes
            except:
                pass
        
        # Handle days (assume 1 hour per day of instruction)
        if 'day' in duration_str:
            try:
                days = int(duration_str.split('day')[0].strip())
                return days * 60
            except:
                pass
        
        # Handle weeks (assume 5 hours per week)
        if 'week' in duration_str:
            try:
                weeks = int(duration_str.split('week')[0].strip())
                return weeks * 300  # 5 hours = 300 minutes
            except:
                pass
        
        # Default to 480 minutes (8 hours)
        logger.warning(f"Could not parse duration '{duration_str}', defaulting to 480 minutes (8 hours)")
        return 480
    
    # PHASE 2 METHODS - COMMENTED OUT FOR PHASE 1 TESTING
    # Uncomment these when ready to test Phase 2
    
    async def run_phase2(self, outline_data: Dict) -> Dict:
        """Run Phase 2: Add video resources (DISABLED FOR TESTING)"""
        logger.warning("Phase 2 is disabled - boxes will not be populated with videos")
        return outline_data
    
    async def populate_single_section(
    self,
    section: Dict,
    grade_level: str,
    teacher_comments: str = ""
) -> Dict:
        """
        Populate a single section with video resources (Phase 2 on-demand).
        """
        from populator.video_generator import generate_videos_for_section
        
        print("Calling Orchstrator HIT", section.get('title', 'Unknown'))
        
        try:
            enriched_section = generate_videos_for_section(
                section=section,
                grade_level=grade_level,
                teacher_comments=teacher_comments
            )
            
            return enriched_section
            
        except Exception as e:
            logger.error(f"Error populating section: {e}", exc_info=True)
            return section  # Return original section if fails
    
    # PHASE 3 METHODS
    async def generate_worksheets(
    self,
    section: dict,
    grade_level: str,
    user_prompt: str,
    num_options: int = 3
) -> dict:
        """
        Generate worksheet options for a section (Phase 3).
        
        Args:
            section: Section data with title, learning_objectives
            grade_level: Target grade level
            user_prompt: Type of worksheet to generate
            num_options: Number of options to return
        
        Returns:
            dict: Section enriched with 'worksheet_options'
        """
        from hands_on.worksheet_generator import generate_worksheets_for_section
        
        logger.info(f"📝 Generating {num_options} worksheet(s) for: {section.get('title', 'Unknown')}")
        
        # Call Phase 3 worksheet generator (runs in thread pool)
        loop = asyncio.get_event_loop()
        enriched_section = await loop.run_in_executor(
            None,
            generate_worksheets_for_section,
            section,
            grade_level,
            user_prompt,
            num_options
        )
        
        return enriched_section


    async def generate_activities(
        self,
        section: dict,
        grade_level: str,
        user_prompt: str,
        num_options: int = 3
    ) -> dict:
        """
        Generate activity options for a section (Phase 3).
        
        Args:
            section: Section data with title, learning_objectives
            grade_level: Target grade level
            user_prompt: Type of activity to generate
            num_options: Number of options to return
        
        Returns:
            dict: Section enriched with 'activity_options'
        """
        from hands_on.activity_generator import generate_activities_for_section
        
        logger.info(f"🎯 Generating {num_options} activit(ies) for: {section.get('title', 'Unknown')}")
        
        # Call Phase 3 activity generator (runs in thread pool)
        loop = asyncio.get_event_loop()
        enriched_section = await loop.run_in_executor(
            None,
            generate_activities_for_section,
            section,
            grade_level,
            user_prompt,
            num_options
        )
        
        return enriched_section