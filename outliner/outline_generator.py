import json
from outliner_prompts import get_box_generation_prompt
from llm_handler import call_openai, validate_boxes_response


def generate_boxes(teacher_input):
    """
    Generate modular teaching boxes using LLM
    
    Args:
        teacher_input (dict): Teacher's requirements
    
    Returns:
        dict: Boxes data from LLM
    """
    print("\n🔄 Generating course modules...")
    print("This may take 30-60 seconds...\n")
    
    # Get the prompt
    prompt = get_box_generation_prompt(teacher_input)
    
    # Call LLM
    system_message = "You are an expert elementary education curriculum designer. You generate well-structured, pedagogically sound course modules in JSON format."
    
    boxes_data = call_openai(prompt, system_message)
    
    # Validate response
    validate_boxes_response(boxes_data)
    
    # Calculate total duration if not provided
    if 'total_duration_all_boxes_minutes' not in boxes_data or boxes_data['total_duration_all_boxes_minutes'] == 0:
        total = sum(box['duration_minutes'] for box in boxes_data['boxes'])
        boxes_data['total_duration_all_boxes_minutes'] = total
    
    return boxes_data


def create_final_outline(selected_boxes, boxes_data):
    """
    Convert selected boxes into final course outline format.
    Now marks sections as needing worksheets/activities instead of creating specific ones.
    
    Args:
        selected_boxes (list): List of selected box objects
        boxes_data (dict): Original boxes data
    
    Returns:
        dict: Final course outline
    """
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
            
            # Extract detailed learning info for Phase 3
            section['content_keywords'] = inst.get('content_keywords', [])
            if inst.get('learning_objectives'):
                section['learning_objectives'].extend(inst['learning_objectives'])
            if inst.get('what_must_be_covered'):
                section['what_must_be_covered'] = inst['what_must_be_covered']
        
        section['needs_worksheets'] = True
        section['needs_activities'] = True
        
        outline['sections'].append(section)
    
    return outline


def save_outline(outline, output_dir):
    """
    Save outline as JSON and readable TXT file
    
    Args:
        outline (dict): Final course outline
        output_dir (str): Directory to save files
    """
    import os
    
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    # Save JSON
    json_path = os.path.join(output_dir, "course_outline.json")
    with open(json_path, 'w') as f:
        json.dump(outline, f, indent=2)
    print(f"\n✅ Saved: {json_path}")
    
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
        f.write(f"Phase 3 will generate worksheet and activity options for each section.\n")
        f.write(f"Teachers can then select from 5-6 curated options per section.\n")
        f.write("="*70 + "\n")
    
    print(f"✅ Saved: {txt_path}")