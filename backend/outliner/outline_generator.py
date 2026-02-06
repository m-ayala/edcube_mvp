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
    Generate course outline with sections and subsections using LLM.
    
    Args:
        teacher_input: Teacher's requirements containing:
            - grade_level (str)
            - subject (str)
            - topic (str)
            - duration (str)
            - total_minutes (int)
            - requirements (str)
    
    Returns:
        dict: Outline data from LLM containing:
            - topic, grade_level, subject
            - sections (list of section objects, each with subsections)
    
    Raises:
        ValueError: If response is invalid
    """
    logger.info("="*70)
    logger.info("Generating course outline (sections + subsections)...")
    logger.info(f"Topic: {teacher_input.get('topic', 'Unknown')}")
    logger.info(f"Grade: {teacher_input.get('grade_level', 'Unknown')}")
    logger.info("="*70)
    
    prompt = get_box_generation_prompt(teacher_input)
    
    system_message = (
        "You are an expert elementary education curriculum designer. "
        "You generate well-structured, pedagogically sound course outlines in JSON format."
    )
    
    logger.info("Calling LLM to generate outline (this may take 30-60 seconds)...")
    outline_data = call_openai(prompt, system_message)
    
    # Validate the new structure
    _validate_outline_response(outline_data)
    
    # Calculate total duration across all subsections
    total = 0
    for section in outline_data.get('sections', []):
        for sub in section.get('subsections', []):
            total += sub.get('duration_minutes', 0)
    outline_data['total_duration_minutes'] = total
    
    logger.info(f"Successfully generated {len(outline_data.get('sections', []))} sections")
    logger.info(f"Total content duration: {total} minutes")
    logger.info("="*70)
    
    return outline_data


def create_final_outline(outline_data: Dict) -> Dict:
    """
    Pass through the LLM outline, adding computed fields.
    The LLM now directly outputs sections with subsections,
    so no box-to-section conversion needed.
    
    Args:
        outline_data: Raw LLM output with sections and subsections
    
    Returns:
        dict: Final course outline ready for Firestore
    """
    logger.info("Building final outline from sections/subsections...")
    
    outline = {
        "course_title": f"{outline_data.get('topic', '')} - {outline_data.get('grade_level', '')}",
        "grade_level": outline_data.get('grade_level', ''),
        "subject": outline_data.get('subject', ''),
        "topic": outline_data.get('topic', ''),
        "total_duration_minutes": outline_data.get('total_duration_minutes', 0),
        "sections": []
    }
    
    for section in outline_data.get('sections', []):
        built_section = {
            "id": section.get('section_id', ''),
            "title": section.get('title', ''),
            "description": section.get('description', ''),
            "subsections": []
        }
        
        for sub in section.get('subsections', []):
            built_subsection = {
                "id": sub.get('subsection_id', ''),
                "title": sub.get('title', ''),
                "description": sub.get('description', ''),
                "topicBoxes": []  # NEW: Start with empty topic boxes array
            }
            built_section['subsections'].append(built_subsection)
        
        outline['sections'].append(built_section)
    
    logger.info(f"Final outline: {len(outline['sections'])} sections")
    for s in outline['sections']:
        logger.info(f"  - {s['title']}: {len(s['subsections'])} subsections")
    
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
        
        for i, section in enumerate(outline['sections'], 1):
            f.write(f"SECTION {i}: {section['title']}\n")
            f.write(f"  {section['description']}\n\n")
            
            for j, sub in enumerate(section['subsections'], 1):
                f.write(f"  {i}.{j} {sub['title']} ({sub['duration_minutes']} min)\n")
                f.write(f"      {sub['description']}\n")
                f.write(f"      PLA: {', '.join(sub.get('pla_pillars', []))}\n")
                f.write(f"      Keywords: {', '.join(sub.get('content_keywords', []))}\n")
                f.write(f"\n")
            
            f.write("\n")
        
        f.write("="*70 + "\n")
        f.write("Phase 2 (videos) and Phase 3 (worksheets/activities) run on-demand per subsection.\n")
        f.write("="*70 + "\n")
    
    logger.info(f"✅ Saved TXT: {txt_path}")


def _validate_outline_response(outline_data: Dict) -> bool:
    """
    Validate the new sections/subsections structure from LLM.
    
    Args:
        outline_data: Parsed JSON from LLM
    
    Returns:
        bool: True if valid
    
    Raises:
        ValueError: If validation fails
    """
    required_top = ['topic', 'grade_level', 'sections']
    validate_json_response(outline_data, required_top, "outline response")
    
    if not isinstance(outline_data['sections'], list):
        raise ValueError("'sections' must be a list")
    
    if len(outline_data['sections']) == 0:
        raise ValueError("No sections generated")
    
    required_section_fields = ['section_id', 'title', 'description', 'subsections']
    required_sub_fields = ['subsection_id', 'title', 'description', 'duration_minutes']
    
    for i, section in enumerate(outline_data['sections']):
        try:
            validate_json_response(section, required_section_fields, f"section {i+1}")
        except ValueError as e:
            raise ValueError(f"Section {i+1} validation failed: {e}")
        
        if not isinstance(section['subsections'], list) or len(section['subsections']) == 0:
            raise ValueError(f"Section {i+1} '{section['title']}' has no subsections")
        
        for j, sub in enumerate(section['subsections']):
            try:
                validate_json_response(sub, required_sub_fields, f"section {i+1} subsection {j+1}")
            except ValueError as e:
                raise ValueError(f"Section {i+1}, Subsection {j+1} validation failed: {e}")
    
    logger.info(f"✅ Validated: {len(outline_data['sections'])} sections")
    return True