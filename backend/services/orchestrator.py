"""
Curriculum Orchestrator Service
Coordinates execution of all three phases with new single-section processing
"""

import logging
from typing import Dict, Optional, List

from outliner.outline_generator import generate_boxes, create_final_outline
from populator.video_generator import generate_videos_for_section
from hands_on.worksheet_generator import generate_worksheets_for_section
from hands_on.activity_generator import generate_activities_for_section
from hands_on.resource_prompts import (
    generate_worksheet_prompt_suggestions,
    generate_activity_prompt_suggestions
)

# Initialize logger
logger = logging.getLogger(__name__)


class CurriculumOrchestrator:
    """Orchestrates the curriculum generation pipeline"""
    
    def __init__(self):
        """Initialize orchestrator"""
        logger.info("Initialized CurriculumOrchestrator")
    
    @staticmethod
    def transform_frontend_input_to_phase1_format(request_data: Dict) -> Dict:
        """
        Transform frontend request to Phase 1 format.
        
        Handles field name mapping and adds total_minutes calculation.
        
        Args:
            request_data: Raw request from frontend
        
        Returns:
            dict: Standardized Phase 1 input format
        """
        # STEP 1: Extract and normalize grade_level
        grade_level = (
            request_data.get('grade_level') or 
            request_data.get('class') or 
            request_data.get('grade') or 
            '5'
        )
        if isinstance(grade_level, str) and grade_level.lower().startswith('class '):
            grade_level = grade_level.split()[-1]
        
        # STEP 2: Extract subject and topic
        subject = request_data.get('subject', 'General')
        topic = request_data.get('topic', 'Untitled Topic')
        
        # STEP 3: Handle duration and calculate total_minutes
        duration_value = (
            request_data.get('duration') or 
            request_data.get('time_duration') or
            request_data.get('timeDuration') or
            '700'
        )
        
        duration_unit = (
            request_data.get('duration_unit') or
            request_data.get('time_duration_unit') or
            request_data.get('timeDurationUnit') or
            'minutes'
        )
        
        # Calculate total_minutes
        if isinstance(duration_value, int):
            total_minutes = duration_value
            duration_str = f"{duration_value} {duration_unit}"
        elif str(duration_value).isdigit():
            total_minutes = int(duration_value)
            duration_str = f"{duration_value} {duration_unit}"
        else:
            # Time period mapping
            duration_map = {
                '1 week': 5 * 60, '2 weeks': 10 * 60, '3 weeks': 15 * 60,
                '1 month': 20 * 60, '2 months': 40 * 60, '3 months': 60 * 60,
                '1 hour': 60, '2 hours': 120, '3 hours': 180, '4 hours': 240, '5 hours': 300,
                '1 day': 60, '2 days': 120, '3 days': 180, '4 days': 240, '5 days': 300,
            }
            total_minutes = duration_map.get(duration_value, 600)
            duration_str = duration_value
        
        # STEP 4: Extract requirements
        requirements = (
            request_data.get('requirements') or
            request_data.get('objectives') or
            request_data.get('comments') or
            request_data.get('objectives_requirements_comments') or
            request_data.get('objectivesRequirementsComments') or
            'None'
        )
        
        # STEP 5: Extract resource counts
        num_worksheets = request_data.get('num_worksheets') or request_data.get('worksheets') or 0
        num_activities = request_data.get('num_activities') or request_data.get('activities') or 0
        
        return {
            'grade_level': str(grade_level),
            'subject': subject,
            'topic': topic,
            'duration': duration_str,
            'total_minutes': total_minutes,
            'requirements': requirements,
            'num_worksheets': int(num_worksheets) if num_worksheets else 0,
            'num_activities': int(num_activities) if num_activities else 0,
        }
    
    async def run_phase1(self, course_data: Dict) -> Optional[Dict]:
        """
        Run Phase 1: Generate curriculum outline.
        
        Args:
            course_data: Dictionary from frontend with grade_level, subject, topic, etc.
        
        Returns:
            dict: Course outline or None if failed
        """
        try:
            logger.info("="*70)
            logger.info("PHASE 1: Generating Curriculum Outline")
            logger.info("="*70)
            
            # Transform frontend input
            teacher_input = self.transform_frontend_input_to_phase1_format(course_data)
            
            logger.info(f"Grade: {teacher_input['grade_level']}")
            logger.info(f"Subject: {teacher_input['subject']}")
            logger.info(f"Topic: {teacher_input['topic']}")
            logger.info(f"Duration: {teacher_input['duration']} ({teacher_input['total_minutes']} min)")
            
            # Generate boxes
            boxes_data = generate_boxes(teacher_input)
            
            if not boxes_data or 'boxes' not in boxes_data:
                logger.error("Failed to generate boxes")
                return None
            
            logger.info(f"Generated {len(boxes_data['boxes'])} curriculum boxes")
            
            # Auto-select all boxes (no teacher interaction for API)
            selected_boxes = boxes_data['boxes']
            
            # Create final outline
            outline = create_final_outline(selected_boxes, boxes_data)
            
            # Add metadata
            outline['num_worksheets_requested'] = course_data.get('num_worksheets', 0)
            outline['num_activities_requested'] = course_data.get('num_activities', 0)
            outline['teacher_comments'] = course_data.get('requirements', '')
            
            logger.info(f"✅ Phase 1 complete: {len(outline['sections'])} sections generated")
            logger.info("="*70)
            
            return outline
        
        except Exception as e:
            logger.error(f"Phase 1 error: {e}", exc_info=True)
            return None
    
    async def run_phase2(self, outline_data: Dict) -> Optional[Dict]:
        """
        Run Phase 2: Add video resources to ALL sections in curriculum.
        
        Args:
            outline_data: Course outline from Phase 1
        
        Returns:
            dict: Enriched curriculum with video resources or None if failed
        """
        try:
            logger.info("="*70)
            logger.info("PHASE 2: Adding Video Resources")
            logger.info("="*70)
            
            grade_level = outline_data.get('grade_level', '5')
            teacher_comments = outline_data.get('teacher_comments', '')
            sections = outline_data.get('sections', [])
            
            logger.info(f"Processing {len(sections)} sections...")
            
            total_videos_added = 0
            
            # Process each section individually
            for i, section in enumerate(sections, 1):
                logger.info(f"\n--- Section {i}/{len(sections)}: {section.get('title', 'Unknown')} ---")
                
                try:
                    # Generate videos for this section
                    enriched_section = generate_videos_for_section(
                        section=section,
                        grade_level=grade_level,
                        teacher_comments=teacher_comments
                    )
                    
                    # Update section with enriched data
                    sections[i-1] = enriched_section
                    
                    videos_added = len(enriched_section.get('video_resources', []))
                    total_videos_added += videos_added
                    
                except Exception as e:
                    logger.error(f"Error processing section {i}: {e}")
                    # Continue with other sections even if one fails
                    continue
            
            logger.info(f"\n{'='*70}")
            logger.info(f"✅ Phase 2 complete: Added {total_videos_added} videos across {len(sections)} sections")
            logger.info("="*70)
            
            return outline_data
        
        except Exception as e:
            logger.error(f"Phase 2 error: {e}", exc_info=True)
            return None
    
    async def run_phase2_single_section(
        self,
        section: Dict,
        grade_level: str,
        teacher_comments: str = ""
    ) -> Optional[Dict]:
        """
        Run Phase 2 for a SINGLE section (on-demand).
        
        Args:
            section: Section data
            grade_level: Target grade level
            teacher_comments: Optional teacher context
        
        Returns:
            dict: Section enriched with video resources
        """
        try:
            logger.info(f"Generating videos for section: {section.get('title', 'Unknown')}")
            
            enriched_section = generate_videos_for_section(
                section=section,
                grade_level=grade_level,
                teacher_comments=teacher_comments
            )
            
            videos_added = len(enriched_section.get('video_resources', []))
            logger.info(f"✅ Added {videos_added} videos to section")
            
            return enriched_section
        
        except Exception as e:
            logger.error(f"Error generating videos for section: {e}", exc_info=True)
            return None
    
    async def get_worksheet_prompts(
        self,
        section: Dict,
        grade_level: str
    ) -> List[Dict]:
        """
        Get worksheet type suggestions for a section.
        
        Args:
            section: Section data
            grade_level: Target grade level
        
        Returns:
            list: Worksheet prompt suggestions
        """
        try:
            logger.info(f"Getting worksheet prompts for: {section.get('title', 'Unknown')}")
            
            prompts = generate_worksheet_prompt_suggestions(section, grade_level)
            
            logger.info(f"Generated {len(prompts)} worksheet prompt suggestions")
            return prompts
        
        except Exception as e:
            logger.error(f"Error getting worksheet prompts: {e}", exc_info=True)
            return []
    
    async def get_activity_prompts(
        self,
        section: Dict,
        grade_level: str
    ) -> List[Dict]:
        """
        Get activity type suggestions for a section.
        
        Args:
            section: Section data
            grade_level: Target grade level
        
        Returns:
            list: Activity prompt suggestions
        """
        try:
            logger.info(f"Getting activity prompts for: {section.get('title', 'Unknown')}")
            
            prompts = generate_activity_prompt_suggestions(section, grade_level)
            
            logger.info(f"Generated {len(prompts)} activity prompt suggestions")
            return prompts
        
        except Exception as e:
            logger.error(f"Error getting activity prompts: {e}", exc_info=True)
            return []
    
    async def generate_worksheets(
        self,
        section: Dict,
        grade_level: str,
        user_prompt: str,
        num_options: int = 3
    ) -> Dict:
        """
        Generate worksheet options for a single section (on-demand).
        
        Args:
            section: Section data
            grade_level: Target grade level
            user_prompt: Teacher's selected worksheet type
            num_options: Number of options to return
        
        Returns:
            dict: Section enriched with worksheet_options
        """
        try:
            logger.info(f"Generating worksheets for: {section.get('title', 'Unknown')}")
            logger.info(f"User prompt: {user_prompt}")
            
            enriched_section = generate_worksheets_for_section(
                section=section,
                grade_level=grade_level,
                user_prompt=user_prompt,
                num_options=num_options
            )
            
            worksheets_added = len(enriched_section.get('worksheet_options', []))
            logger.info(f"✅ Generated {worksheets_added} worksheet options")
            
            return enriched_section
        
        except Exception as e:
            logger.error(f"Error generating worksheets: {e}", exc_info=True)
            return section  # Return original section if generation fails
    
    async def generate_activities(
        self,
        section: Dict,
        grade_level: str,
        user_prompt: str,
        num_options: int = 3
    ) -> Dict:
        """
        Generate activity options for a single section (on-demand).
        
        Args:
            section: Section data
            grade_level: Target grade level
            user_prompt: Teacher's selected activity type
            num_options: Number of options to return
        
        Returns:
            dict: Section enriched with activity_options
        """
        try:
            logger.info(f"Generating activities for: {section.get('title', 'Unknown')}")
            logger.info(f"User prompt: {user_prompt}")
            
            enriched_section = generate_activities_for_section(
                section=section,
                grade_level=grade_level,
                user_prompt=user_prompt,
                num_options=num_options
            )
            
            activities_added = len(enriched_section.get('activity_options', []))
            logger.info(f"✅ Generated {activities_added} activity options")
            
            return enriched_section
        
        except Exception as e:
            logger.error(f"Error generating activities: {e}", exc_info=True)
            return section  # Return original section if generation fails