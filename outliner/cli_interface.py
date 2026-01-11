def get_teacher_input():
    """
    Get teacher input for curriculum generation.
    """
    print("Please provide the following information:\n")
    
    # Grade level
    grade_level = input("Grade Level (e.g., 3, 4, 5, 6): ").strip()
    
    # Subject
    subject = input("Subject (e.g., Science, History, Art): ").strip()
    
    # Topic
    topic = input("Topic (e.g., Martin Luther King Jr., Photosynthesis): ").strip()
    
    # Duration
    print("\nHow much teaching time do you have available?")
    print("(This helps us generate an appropriate number of boxes)")
    duration = input("Duration (e.g., '2 hours', '90 minutes', '3 days'): ").strip()
    
    # Parse duration to minutes
    total_minutes = parse_duration(duration)
    
    # Requirements
    print("\nAny special requirements or focus areas?")
    requirements = input("(Press Enter to skip): ").strip()
    if not requirements:
        requirements = "None"
    
    print("\n" + "="*70)
    print("We'll generate boxes covering ~2x your available time.")
    print("This gives you flexibility to pick and choose what fits best.")
    print("You can select fewer or more boxes than your time allows!")
    print("="*70 + "\n")
    
    return {
        'grade_level': grade_level,
        'subject': subject,
        'topic': topic,
        'duration': duration,
        'total_minutes': total_minutes,
        'requirements': requirements
    }

def display_boxes(boxes_data):
    """
    Display generated box library organized by PLA pillars in columns
    """
    boxes = boxes_data['boxes']
    
    print("\n" + "="*70)
    print("📚 CURRICULUM LIBRARY GENERATED")
    print("="*70)
    print(f"\nTopic: {boxes_data['topic']}")
    print(f"Grade: {boxes_data['grade_level']}")
    print(f"Total Boxes: {len(boxes)}")
    print("\nBoxes organized by PLA Pillar:\n")
    
    # Group boxes by primary PLA pillar
    pla_groups = {
        'Self-Knowledge': [],
        'Knowledge': [],
        'Wisdom': [],
        'Application': []
    }
    
    for box in boxes:
        # Get primary pillar (first one listed)
        primary_pillar = box.get('pla_pillars', ['Knowledge'])[0]
        if primary_pillar in pla_groups:
            pla_groups[primary_pillar].append(box)
    
    # Display in columns by PLA pillar
    pla_icons = {
        'Self-Knowledge': '🧠 SELF-KNOWLEDGE',
        'Knowledge': '📖 KNOWLEDGE',
        'Wisdom': '💡 WISDOM',
        'Application': '🎯 APPLICATION'
    }
    
    for pillar in ['Knowledge', 'Self-Knowledge', 'Wisdom', 'Application']:
        if pla_groups[pillar]:
            print(f"\n{pla_icons[pillar]}")
            print("-" * 70)
            for box in pla_groups[pillar]:
                prereq_str = ""
                if box.get('prerequisites'):
                    prereq_str = f" [Requires: {', '.join(map(str, box['prerequisites']))}]"
                
                print(f"  [{box['box_id']}] {box['title']} ({box['duration_minutes']} min){prereq_str}")
                print(f"      {box['description']}\n")
    
    print("="*70)

def parse_duration(duration_str):
    """
    Parse duration string to minutes
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
    
    # Handle days (assume 1 hour per day)
    if 'day' in duration_str:
        try:
            days = int(duration_str.split('day')[0].strip())
            return days * 60
        except:
            pass
    
    # Default
    print(f"⚠️  Couldn't parse '{duration_str}', defaulting to 120 minutes (2 hours)")
    return 120

def get_box_selection(boxes_data):
    """
    Get teacher's selection of which boxes to include
    
    Args:
        boxes_data (dict): The boxes JSON
    
    Returns:
        list: Selected box IDs
    """
    time_budget = boxes_data['teacher_time_budget_minutes']
    
    print(f"\n🎯 SELECT BOXES TO BUILD YOUR COURSE")
    print(f"You have {time_budget} minutes ({time_budget//60}h {time_budget%60}m)")
    print("\nEnter box numbers separated by commas (e.g., 1,2,4,6)")
    print("Or type 'all' to select all boxes\n")
    
    while True:
        selection = input("Your selection: ").strip().lower()
        
        if selection == 'all':
            selected_ids = [box['box_id'] for box in boxes_data['boxes']]
            break
        else:
            try:
                selected_ids = [int(x.strip()) for x in selection.split(',')]
                
                # Validate IDs exist
                valid_ids = [box['box_id'] for box in boxes_data['boxes']]
                invalid = [sid for sid in selected_ids if sid not in valid_ids]
                if invalid:
                    print(f"❌ Invalid box IDs: {invalid}")
                    continue
                
                # Check time
                selected_boxes = [b for b in boxes_data['boxes'] if b['box_id'] in selected_ids]
                total_time = sum(b['duration_minutes'] for b in selected_boxes)
                
                print(f"\n⏱️  Selected boxes total: {total_time} minutes ({total_time//60}h {total_time%60}m)")
                
                if total_time > time_budget * 1.2:
                    print(f"⚠️  WARNING: This is {total_time - time_budget} minutes over your budget")
                    confirm = input("Continue anyway? (yes/no): ").strip().lower()
                    if confirm != 'yes':
                        continue
                
                # Check prerequisites
                missing = check_prerequisites(selected_boxes, selected_ids)
                if missing:
                    print(f"⚠️  WARNING: Missing prerequisites:")
                    for msg in missing:
                        print(f"    - {msg}")
                    print("\nPlease add required boxes or remove dependent boxes.")
                    continue
                
                break
                
            except ValueError:
                print("❌ Invalid input. Use comma-separated numbers (e.g., 1,2,3)")
    
    return selected_ids


def check_prerequisites(selected_boxes, selected_ids):
    """
    Check if all prerequisite boxes are included
    
    Args:
        selected_boxes (list): List of selected box objects
        selected_ids (list): List of selected box IDs
    
    Returns:
        list: List of missing prerequisite messages (empty if all satisfied)
    """
    missing = []
    for box in selected_boxes:
        if box.get('prerequisites'):
            for prereq in box['prerequisites']:
                if prereq not in selected_ids:
                    missing.append(f"Box {box['box_id']} ({box['title']}) requires Box {prereq}")
    return missing

def display_final_outline(outline):
    """
    Display the final course outline to the teacher in a readable format
    """
    print("\n📋 FINAL COURSE OUTLINE")
    print("="*70)
    print(f"Course: {outline['course_title']}")
    print(f"Grade: {outline['grade_level']}")
    total = outline['total_duration_minutes']
    print(f"Total Duration: {total} minutes ({total//60}h {total%60}m)")
    print("="*70)
    
    # Display sections
    print("\nSECTIONS:\n")
    for i, section in enumerate(outline['sections'], 1):
        print(f"{i}. {section['title']} ({section['duration_minutes']} min)")
        print(f"   {section['description']}")
        
        # Show subtopics
        for subtopic in section.get('subtopics', []):
            topics_str = ', '.join(subtopic['topics'])
            print(f"   ├─ {subtopic['name']}: {topics_str}")
        
        # Show resource flags
        resource_flags = []
        if section.get('needs_worksheets'):
            resource_flags.append("📝 Worksheets")
        if section.get('needs_activities'):
            resource_flags.append("🎯 Activities")
        
        if resource_flags:
            print(f"   └─ Resources needed: {', '.join(resource_flags)}")
        
        print()
    
    # Summary of resource needs
    print("\n" + "="*70)
    print("RESOURCE GENERATION PLAN:")
    print("="*70)
    
    sections_needing_worksheets = sum(1 for s in outline['sections'] if s.get('needs_worksheets'))
    sections_needing_activities = sum(1 for s in outline['sections'] if s.get('needs_activities'))
    
    print(f"\n📝 Worksheets: {sections_needing_worksheets} section(s) will get 5-6 worksheet options")
    print(f"🎯 Activities: {sections_needing_activities} section(s) will get 5-6 activity options")
    print(f"\nPhase 3 will generate these options for teacher selection.")
    print("="*70)