"""
Phase 1: Course Outline Generation
Generates modular teaching boxes and creates final course outlines
"""

import json
import logging
from typing import Dict, List, Optional

from outliner.outline_prompts import get_box_generation_prompt
from utils.llm_handler import call_openai, validate_json_response

# Initialize logger
logger = logging.getLogger(__name__)


def generate_boxes(teacher_input: Dict, images: Optional[List[str]] = None) -> Dict:
    """
    Generate course outline with sections and subsections using LLM.

    Args:
        teacher_input: Teacher's requirements containing:
            - grade_level (str)
            - course_name (str)
            - duration (str)
            - total_minutes (int)
            - requirements (str)
        images: Optional list of base64 data URIs for reference images

    Returns:
        dict: Outline data from LLM containing:
            - course_name, grade_level
            - sections (list of section objects, each with subsections)

    Raises:
        ValueError: If response is invalid
    """
    logger.info("="*70)
    logger.info("Generating course outline (sections + subsections)...")
    logger.info(f"Course: {teacher_input.get('course_name', 'Unknown')}")
    logger.info(f"Grade: {teacher_input.get('grade_level', 'Unknown')}")
    if images:
        logger.info(f"Reference images provided: {len(images)}")
    logger.info("="*70)

    prompt = get_box_generation_prompt(teacher_input, has_images=bool(images))

    system_message = (
        "You are an expert elementary education curriculum designer. "
        "You generate well-structured, pedagogically sound course outlines in JSON format."
    )

    logger.info("Calling LLM to generate outline (this may take 30-60 seconds)...")
    outline_data = call_openai(prompt, system_message, images=images or None)

    # Validate the new structure
    _validate_outline_response(outline_data)

    logger.info(f"Successfully generated {len(outline_data.get('sections', []))} sections")
    logger.info("="*70)

    return outline_data


def create_final_outline(outline_data: Dict, course_name: str = '', subject: str = '', topic: str = '') -> Dict:
    """
    Pass through the LLM outline, adding computed fields.
    Sections only — subsections are proposed later in Phase 1.5 and merged in
    once the teacher approves a selection (see run_phase2_blocks_for_selection).

    Args:
        outline_data: Raw LLM output with sections (title, description, depth_ceiling)
        course_name: Teacher-provided course name, used for the display title
        subject: Auto-detected broad discipline (e.g. "Biology"), from the Requirements
            Interpreter — not re-derived here, just carried onto the outline.
        topic: Auto-detected mid-level category (e.g. "Plants"), same source as subject.

    Returns:
        dict: Final course outline ready for Phase 1.5
    """
    logger.info("Building final outline from sections...")

    outline = {
        "course_title": f"{course_name} - {outline_data.get('age_range', '')}",
        "age_range": outline_data.get('age_range', ''),
        "subject": subject,
        "topic": topic,
        "sections": []
    }

    for section in outline_data.get('sections', []):
        outline['sections'].append({
            "id": section.get('section_id', ''),
            "title": section.get('title', ''),
            "description": section.get('description', ''),
            "depth_ceiling": section.get('depth_ceiling', 'Basics'),
            "subsections": []
        })

    logger.info(f"Final outline: {len(outline['sections'])} sections")
    for s in outline['sections']:
        logger.info(f"  - {s['title']} (depth_ceiling: {s['depth_ceiling']})")

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
    Validate the sections structure from LLM. Subsections are no longer part of
    Phase 1 output — they're proposed per-section in Phase 1.5.

    Args:
        outline_data: Parsed JSON from LLM

    Returns:
        bool: True if valid

    Raises:
        ValueError: If validation fails
    """
    required_top = ['age_range', 'sections']
    validate_json_response(outline_data, required_top, "outline response")

    if not isinstance(outline_data['sections'], list):
        raise ValueError("'sections' must be a list")

    if len(outline_data['sections']) == 0:
        raise ValueError("No sections generated")

    required_section_fields = ['section_id', 'title', 'description', 'depth_ceiling']

    for i, section in enumerate(outline_data['sections']):
        try:
            validate_json_response(section, required_section_fields, f"section {i+1}")
        except ValueError as e:
            raise ValueError(f"Section {i+1} validation failed: {e}")

        if section['depth_ceiling'] not in ('Basics', 'Intermediate', 'Advanced'):
            raise ValueError(
                f"Section {i+1} '{section['title']}' has invalid depth_ceiling: {section['depth_ceiling']!r}"
            )

    logger.info(f"✅ Validated: {len(outline_data['sections'])} sections")
    return True