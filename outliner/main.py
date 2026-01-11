#!/usr/bin/env python3
"""
EdCube MVP - AI-Powered Course Design Platform
Phase 1: Outline Generation
"""

import os
from config import OUTPUT_DIR
from cli_interface import (
    get_teacher_input,
    display_boxes,
    get_box_selection,
    display_final_outline
)
from outline_generator import (
    generate_boxes,
    create_final_outline,
    save_outline
)


def main():
    """
    Main entry point for the EdCube MVP
    """
    print("\n" + "="*70)
    print("🎓 Welcome to EdCube - AI Course Design Platform")
    print("="*70)
    print("\nPhase 1: Course Outline Generation")
    print("This tool will help you design a complete course curriculum\n")
    
    # Step 1: Get teacher input
    teacher_input = get_teacher_input()
    
    # Step 2: Generate boxes (2x time budget)
    try:
        boxes_data = generate_boxes(teacher_input)
    except Exception as e:
        print(f"\n❌ Error generating boxes: {str(e)}")
        print("Please try again or check your API key.\n")
        return
    
    # Step 3: Display boxes to teacher
    display_boxes(boxes_data)
    
    # Step 4: Get teacher's box selection
    selected_ids = get_box_selection(boxes_data)
    
    # Get selected box objects
    selected_boxes = [box for box in boxes_data['boxes'] if box['box_id'] in selected_ids]
    
    # Step 5: Create final outline from selected boxes
    print("\n🔄 Creating final course outline...")
    final_outline = create_final_outline(selected_boxes, boxes_data)
    
    # Step 6: Display final outline
    display_final_outline(final_outline)
    
    # Step 7: Confirm and save
    print("\n" + "="*70)
    approve = input("\n✅ Approve this outline and save? (yes/no): ").strip().lower()
    
    if approve == 'yes':
        # Save outline
        save_outline(final_outline, OUTPUT_DIR)
        
        print("\n" + "="*70)
        print("🎉 SUCCESS!")
        print("="*70)
        print(f"\nYour course outline has been saved to: ./{OUTPUT_DIR}/")
        print(f"- course_outline.json (machine-readable)")
        print(f"- course_outline.txt (human-readable)")
        print("\n📌 Next Steps:")
        print("   Phase 2: Resource generation (YouTube videos, materials)")
        print("   Phase 3: Worksheet PDF generation")
        print("\nThank you for using EdCube!")
        print("="*70 + "\n")
    else:
        print("\n❌ Outline not saved. Exiting...")
        print("Run the program again to create a new outline.\n")


if __name__ == "__main__":
    main()