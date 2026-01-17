"""
Phase 1: Course Outline Generation
Generates modular teaching boxes and creates final course outlines
"""

import json
import logging
from typing import Dict, List

from outliner.outline_prompts import get_box_generation_prompt
from utils.llm_handler import call_openai, validate_json_response

# Initialize logger
logger = logging.getLogger(__name__)


def generate_boxes(teacher_input: Dict) -> Dict:
    """
    Generate modular teaching boxes using LLM.
    
    Args:
        teacher_input: Teacher's requirements containing:
            - grade_level (str)
            - subject (str)
            - topic (str)
            - duration (str)
            - total_minutes (int)
            - requirements (str)
    
    Returns:
        dict: Boxes data from LLM containing:
            - topic, grade_level, teacher_time_budget_minutes
            - total_boxes_generated
            - boxes (list of box objects)
    
    Raises:
        ValueError: If boxes response is invalid
    
    Example:
        >>> teacher_input = {
        ...     'grade_level': '5',
        ...     'subject': 'Social Studies',
        ...     'topic': 'Civil Rights Movement',
        ...     'duration': '2 weeks',
        ...     'total_minutes': 300,
        ...     'requirements': 'Focus on MLK'
        ... }
        >>> boxes = generate_boxes(teacher_input)
        >>> len(boxes['boxes']) >= 8
        True
    """
    logger.info("="*70)
    logger.info("Generating course modules (boxes)...")
    logger.info(f"Topic: {teacher_input.get('topic', 'Unknown')}")
    logger.info(f"Grade: {teacher_input.get('grade_level', 'Unknown')}")
    logger.info("="*70)
    
    # Get the prompt
    prompt = get_box_generation_prompt(teacher_input)
    
    # Call LLM
    system_message = (
        "You are an expert elementary education curriculum designer. "
        "You generate well-structured, pedagogically sound course modules in JSON format."
    )
    
    logger.info("Calling LLM to generate boxes (this may take 30-60 seconds)...")
    boxes_data = call_openai(prompt, system_message)
    
    # Validate response
    _validate_boxes_response(boxes_data)
    
    # Calculate total duration if not provided
    if 'total_duration_all_boxes_minutes' not in boxes_data or boxes_data['total_duration_all_boxes_minutes'] == 0:
        total = sum(box['duration_minutes'] for box in boxes_data['boxes'])
        boxes_data['total_duration_all_boxes_minutes'] = total
    
    logger.info(f"Successfully generated {len(boxes_data['boxes'])} boxes")
    logger.info(f"Total content duration: {boxes_data['total_duration_all_boxes_minutes']} minutes")
    logger.info("="*70)
    
    return boxes_data


def create_final_outline(selected_boxes: List[Dict], boxes_data: Dict) -> Dict:
    """
    Convert selected boxes into final course outline format.
    Marks sections as needing worksheets/activities instead of creating specific ones.
    
    Args:
        selected_boxes: List of selected box objects
        boxes_data: Original boxes data with metadata
    
    Returns:
        dict: Final course outline with sections
    
    Example:
        >>> selected_boxes = [{'box_id': 1, 'title': 'Introduction', ...}]
        >>> boxes_data = {'topic': 'Math', 'grade_level': '5'}
        >>> outline = create_final_outline(selected_boxes, boxes_data)
        >>> 'sections' in outline
        True
    """
    logger.info("Creating final course outline from selected boxes...")
    
    total_time = sum(box['duration_minutes'] for box in selected_boxes)
    
    outline = {
        "course_title": f"{boxes_data['topic']} - {boxes_data['grade_level']}",
        "grade_level": boxes_data['grade_level'],
        "subject": boxes_data.get('subject', ''),
        "topic": boxes_data['topic'],
        "total_duration_minutes": total_time,
        "sections": []
    }
    
    # Convert each box to a section
    for i, box in enumerate(selected_boxes, 1):
        section = {
            "id": f"section_{i}",
            "title": box['title'],
            "description": box['description'],
            "duration_minutes": box['duration_minutes'],
            "box_id": box['box_id'],
            "pla_pillars": box.get('pla_pillars', []),
            "subtopics": [],
            "needs_worksheets": False,
            "needs_activities": False,
            "learning_objectives": box.get('learning_outcomes', []),
            "content_keywords": []
        }
        
        # Add instruction as subtopic and extract keywords
        if box['components'].get('instruction'):
            inst = box['components']['instruction']
            section['subtopics'].append({
                "name": inst['teaching_method'].replace('_', ' ').title(),
                "topics": inst['subtopics'],
                "duration_minutes": inst['duration_minutes']
            })
            
            # Extract detailed learning info for Phase 2 and Phase 3
            section['content_keywords'] = inst.get('content_keywords', [])
            if inst.get('learning_objectives'):
                section['learning_objectives'].extend(inst['learning_objectives'])
            if inst.get('what_must_be_covered'):
                section['what_must_be_covered'] = inst['what_must_be_covered']
            
            # Store full instruction component for Phase 2
            section['components'] = {
                'instruction': inst
            }
        
        # Mark that this section needs resources (Phase 2 and 3 will handle)
        section['needs_worksheets'] = True
        section['needs_activities'] = True
        
        outline['sections'].append(section)
    
    logger.info(f"Created outline with {len(outline['sections'])} sections")
    logger.info(f"Total duration: {total_time} minutes")
    
    return outline


def save_outline(outline: Dict, output_dir: str) -> None:
    """
    Save outline as JSON and readable TXT file.
    
    Args:
        outline: Final course outline
        output_dir: Directory to save files
    
    Example:
        >>> outline = {'course_title': 'Math - Grade 5', ...}
        >>> save_outline(outline, '../outputs')
    """
    import os
    
    logger.info(f"Saving outline to: {output_dir}")
    
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    # Save JSON
    json_path = os.path.join(output_dir, "course_outline.json")
    with open(json_path, 'w') as f:
        json.dump(outline, f, indent=2)
    logger.info(f"✅ Saved JSON: {json_path}")
    
    # Save readable TXT
    txt_path = os.path.join(output_dir, "course_outline.txt")
    with open(txt_path, 'w') as f:
        f.write("="*70 + "\n")
        f.write("COURSE OUTLINE\n")
        f.write("="*70 + "\n\n")
        
        f.write(f"Course: {outline['course_title']}\n")
        f.write(f"Grade Level: {outline['grade_level']}\n")
        f.write(f"Topic: {outline['topic']}\n")
        total = outline['total_duration_minutes']
        f.write(f"Total Duration: {total} minutes ({total//60}h {total%60}m)\n")
        f.write("\n" + "="*70 + "\n\n")
        
        # Sections
        f.write("SECTIONS:\n\n")
        for i, section in enumerate(outline['sections'], 1):
            f.write(f"{i}. {section['title']} ({section['duration_minutes']} min)\n")
            f.write(f"   {section['description']}\n")
            if section.get('subtopics'):
                for subtopic in section['subtopics']:
                    f.write(f"   - {subtopic['name']}: {', '.join(subtopic['topics'])}\n")
            f.write(f"   PLA Pillars: {', '.join(section.get('pla_pillars', []))}\n")
            
            # Show what resources this section needs
            if section.get('needs_worksheets'):
                f.write(f"   📝 Needs worksheets (Phase 3 will generate options)\n")
            if section.get('needs_activities'):
                f.write(f"   🎯 Needs activities (Phase 3 will generate options)\n")
            
            f.write("\n")
        
        f.write("\n" + "="*70 + "\n")
        f.write("RESOURCE GENERATION:\n")
        f.write(f"Phase 2 will add video resources for each section.\n")
        f.write(f"Phase 3 will generate worksheet and activity options for each section.\n")
        f.write(f"Teachers can then select from curated options.\n")
        f.write("="*70 + "\n")
    
    logger.info(f"✅ Saved TXT: {txt_path}")


def _validate_boxes_response(boxes_data: Dict) -> bool:
    """
    Validate that the boxes response has the correct structure.
    
    Args:
        boxes_data: The parsed JSON from LLM
    
    Returns:
        bool: True if valid
    
    Raises:
        ValueError: If validation fails
    """
    required_fields = ['topic', 'grade_level', 'teacher_time_budget_minutes', 'boxes']
    
    # Validate top-level fields
    validate_json_response(boxes_data, required_fields, "boxes response")
    
    if not isinstance(boxes_data['boxes'], list):
        raise ValueError("'boxes' must be a list")
    
    if len(boxes_data['boxes']) == 0:
        raise ValueError("No boxes generated")
    
    # Validate each box has required fields
    required_box_fields = ['box_id', 'title', 'description', 'duration_minutes', 'components']
    for i, box in enumerate(boxes_data['boxes']):
        try:
            validate_json_response(box, required_box_fields, f"box {i+1}")
        except ValueError as e:
            raise ValueError(f"Box {i+1} validation failed: {e}")
    
    logger.info(f"✅ Validated: {len(boxes_data['boxes'])} boxes")
    return True