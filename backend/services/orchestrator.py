"""
Curriculum Orchestrator Service
Coordinates execution of Phase 1 (outliner) and Phase 2 (populator)
"""

import sys
import os
import json
from typing import Dict, Optional
import asyncio
import importlib.util


class CurriculumOrchestrator:
    """Orchestrates the curriculum generation pipeline"""
    
    def __init__(self):
        """Initialize orchestrator and load phase modules"""
        self.temp_dir = "/tmp/edcube"
        os.makedirs(self.temp_dir, exist_ok=True)
        
        # Get project root (edcube_v1/)
        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../'))
        
        # Save current sys.path
        original_path = sys.path.copy()
        
        # Load outliner module in isolation
        outliner_dir = os.path.join(project_root, 'outliner')
        sys.path = [outliner_dir] + original_path  # Outliner first
        
        outliner_path = os.path.join(outliner_dir, 'outline_generator.py')
        spec = importlib.util.spec_from_file_location("outliner_gen", outliner_path)
        self.outliner_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.outliner_module)
        
        # Restore original path before loading populator
        sys.path = original_path.copy()
        
        # Load populator module in isolation
        populator_dir = os.path.join(project_root, 'populator')
        sys.path = [populator_dir] + original_path  # Populator first
        
        populator_path = os.path.join(populator_dir, 'resource_generator.py')
        spec = importlib.util.spec_from_file_location("populator_gen", populator_path)
        self.populator_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.populator_module)
        
        # Restore original path
        sys.path = original_path
    
    @staticmethod
    def transform_frontend_input_to_phase1_format(request_data: Dict) -> Dict:
        """
        Transform frontend request to Phase 1 format.
        
        Handles field name mapping and adds total_minutes calculation.
        
        Frontend may send various field names, we normalize them to what Phase 1 expects.
        
        Phase 1 expects:
        {
            "grade_level": "5",
            "subject": "History",
            "topic": "MLK",
            "duration": "700 minutes",  # Can be minutes or time periods
            "total_minutes": 700,
            "requirements": "Teacher objectives..."
        }
        """
        
        # STEP 1: Extract and normalize grade_level
        # Frontend might send: "grade_level", "class", "grade"
        grade_level = (
            request_data.get('grade_level') or 
            request_data.get('class') or 
            request_data.get('grade') or 
            '5'  # default
        )
        # Remove "Class " prefix if exists (e.g., "Class 1" -> "1")
        if isinstance(grade_level, str) and grade_level.lower().startswith('class '):
            grade_level = grade_level.split()[-1]
        
        # STEP 2: Extract subject and topic (usually correct)
        subject = request_data.get('subject', 'General')
        topic = request_data.get('topic', 'Untitled Topic')
        
        # STEP 3: Handle duration and calculate total_minutes
        # Frontend might send:
        # - "duration": "700" with "duration_unit": "minutes"
        # - "time_duration": 700 with "time_duration_unit": "minutes" 
        # - "duration": "2 weeks"
        
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
            # Already a number
            total_minutes = duration_value
            duration_str = f"{duration_value} {duration_unit}"
        elif duration_value.isdigit():
            # String number like "700"
            total_minutes = int(duration_value)
            duration_str = f"{duration_value} {duration_unit}"
        else:
            # It's a time period like "2 weeks"
            duration_map = {
                # Weeks
                '1 week': 5 * 60,
                '2 weeks': 10 * 60,
                '3 weeks': 15 * 60,
                '1 month': 20 * 60,
                '2 months': 40 * 60,
                '3 months': 60 * 60,
                # Hours
                '1 hour': 60,
                '2 hours': 120,
                '3 hours': 180,
                '4 hours': 240,
                '5 hours': 300,
                # Days
                '1 day': 60,
                '2 days': 120,
                '3 days': 180,
                '4 days': 240,
                '5 days': 300,
            }
            total_minutes = duration_map.get(duration_value, 600)
            duration_str = duration_value
        
        # STEP 4: Extract requirements/objectives/comments
        # Frontend might send: "requirements", "objectives", "comments", "objectives_requirements_comments"
        requirements = (
            request_data.get('requirements') or
            request_data.get('objectives') or
            request_data.get('comments') or
            request_data.get('objectives_requirements_comments') or
            request_data.get('objectivesRequirementsComments') or
            'None'
        )
        
        # STEP 5: Extract worksheet and activity counts
        num_worksheets = request_data.get('num_worksheets') or request_data.get('worksheets') or 0
        num_activities = request_data.get('num_activities') or request_data.get('activities') or 0
        
        # STEP 6: Build the standardized Phase 1 input
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
        Run Phase 1: Generate curriculum outline
        
        Args:
            course_data: Dictionary from frontend with grade_level, subject, topic, duration, etc.
            
        Returns:
            Course outline dictionary or None if failed
        """
        try:
            print("\n=== PHASE 1: Generating Curriculum Outline ===")
            
            # STEP 1: Transform frontend input to Phase 1 format
            teacher_input = self.transform_frontend_input_to_phase1_format(course_data)
            
            print(f"\nTransformed input:")
            print(f"  - Grade: {teacher_input['grade_level']}")
            print(f"  - Subject: {teacher_input['subject']}")
            print(f"  - Topic: {teacher_input['topic']}")
            print(f"  - Duration: {teacher_input['duration']} ({teacher_input['total_minutes']} minutes)")
            
            # STEP 2: Generate boxes (curriculum options)
            print(f"\nGenerating curriculum options...")
            boxes_data = await asyncio.to_thread(
                self.outliner_module.generate_boxes,
                teacher_input
            )
            
            if not boxes_data or 'boxes' not in boxes_data:
                print("❌ Failed to generate boxes")
                return None
            
            print(f"✅ Generated {len(boxes_data['boxes'])} curriculum boxes")
            
            # STEP 3: Auto-select all boxes for API (no teacher interaction needed)
            selected_boxes = boxes_data['boxes']
            
            # STEP 4: Format final outline using Phase 1's create_final_outline function
            outline = self.outliner_module.create_final_outline(selected_boxes, boxes_data)
            
            # STEP 5: Add metadata from original request
            outline['num_worksheets_requested'] = course_data.get('num_worksheets', 0)
            outline['num_activities_requested'] = course_data.get('num_activities', 0)
            outline['teacher_comments'] = course_data.get('requirements', '')
            
            print(f"✅ Phase 1 complete: {len(outline['sections'])} sections generated")
            
            return outline
        
        except Exception as e:
            print(f"❌ Phase 1 error: {str(e)}")
            import traceback
            traceback.print_exc()
            return None
    
    async def run_phase2(self, outline_data: Dict) -> Optional[Dict]:
        """
        Run Phase 2: Add video resources to curriculum
        
        Args:
            outline_data: Course outline from Phase 1
            
        Returns:
            Enriched curriculum with video resources or None if failed
        """
        try:
            print("\n=== PHASE 2: Adding Video Resources ===")
            
            grade_level = outline_data.get('grade_level', '5')
            
            # Run Phase 2 resource generation
            print(f"\nProcessing {len(outline_data['sections'])} sections...")
            
            enriched_data, api_units, videos_added = await asyncio.to_thread(
                self.populator_module.generate_resources_for_outline,
                outline_data,
                grade_level
            )
            
            if not enriched_data:
                print("❌ Failed to add video resources")
                return None
            
            print(f"✅ Phase 2 complete: Added {videos_added} video resources")
            print(f"   API units used: {api_units}")
            
            return enriched_data
        
        except Exception as e:
            print(f"❌ Phase 2 error: {str(e)}")
            import traceback
            traceback.print_exc()
            return None
    
    async def generate_worksheets(self, sections: list, grade_level: str) -> list:
        """
        Generate worksheet options for specific sections (on-demand Phase 3)
        
        Args:
            sections: List of section dictionaries
            grade_level: Grade level string
            
        Returns:
            List of worksheet resources
        """
        # TODO: Implement Phase 3 worksheet generation
        # For now, return placeholder
        print("\n⚠️  Worksheet generation not yet implemented")
        return []
    
    async def generate_activities(self, sections: list, grade_level: str) -> list:
        """
        Generate activity options for specific sections (on-demand Phase 3)
        
        Args:
            sections: List of section dictionaries
            grade_level: Grade level string
            
        Returns:
            List of activity resources
        """
        # TODO: Implement Phase 3 activity generation
        # For now, return placeholder
        print("\n⚠️  Activity generation not yet implemented")
        return []