#!/usr/bin/env python3
"""
EdCube MVP - Phase 2: Video Resource Generation
"""

import os
import json
from populator.populator_config import OUTPUTS_DIR, INPUT_OUTLINE_FILE, OUTPUT_OUTLINE_FILE, OUTPUT_OUTLINE_TXT_FILE
from cli_interface import (
    display_phase2_start,
    display_section_progress,
    display_video_results,
    display_api_usage,
    display_phase2_summary,
    display_error,
    confirm_continue
)
from resource_generator import generate_resources_for_outline, save_enriched_outline


def load_outline():
    """
    Load the course outline from Phase 1
    
    Returns:
        dict: Course outline data
    """
    input_path = os.path.join(OUTPUTS_DIR, INPUT_OUTLINE_FILE)
    
    if not os.path.exists(input_path):
        display_error(f"Course outline not found at: {input_path}")
        display_error("Please run Phase 1 first to generate a course outline.")
        return None
    
    try:
        with open(input_path, 'r') as f:
            outline_data = json.load(f)
        
        print(f"\n✅ Loaded course outline from: {input_path}")
        print(f"   Course: {outline_data.get('course_title', 'N/A')}")
        print(f"   Sections: {len(outline_data.get('sections', []))}")
        
        return outline_data
    
    except Exception as e:
        display_error(f"Failed to load outline: {str(e)}")
        return None


def main():
    """
    Main entry point for Phase 2
    """
    display_phase2_start()
    
    # Step 1: Load Phase 1 outline
    outline_data = load_outline()
    if not outline_data:
        return
    
    # Get grade level from outline
    grade_level = outline_data.get('grade_level', '5')
    sections = outline_data.get('sections', [])
    total_sections = len(sections)
    
    print(f"\nProcessing {total_sections} sections...")
    
    # Confirm before starting
    if not confirm_continue():
        print("\n❌ Cancelled by user.\n")
        return
    
    # Step 2: Generate video resources for each section
    try:
        total_api_units = 0
        total_videos_added = 0
        
        for i, section in enumerate(sections, 1):
            display_section_progress(i, total_sections, section.get('title', 'Unknown'))
            
            # Generate queries for this section
            from search_query_generator import generate_queries_for_section
            queries = generate_queries_for_section(section, grade_level)
            section['search_queries_used'] = [q.get('query', '') for q in queries]
            
            # Search and filter videos
            from youtube_handler import search_videos, get_video_details
            from video_filter import filter_and_rank_videos, select_top_videos
            from populator.populator_config import YOUTUBE_MAX_VIDEOS_PER_SECTION
            from resource_generator import generate_selection_rationale
            
            all_video_ids = []
            for query_data in queries:
                query = query_data.get('query', '')
                print(f"   🔍 Searching: \"{query}\"")
                video_ids = search_videos(query)
                all_video_ids.extend(video_ids)
                total_api_units += 100
            
            all_video_ids = list(set(all_video_ids))
            
            if not all_video_ids:
                print(f"   ⚠️  No videos found")
                section['video_resources'] = []
                continue
            
            print(f"   📥 Found {len(all_video_ids)} videos, fetching details...")
            videos = get_video_details(all_video_ids)
            total_api_units += len(all_video_ids)
            
            print(f"   🔧 Filtering and ranking...")
            filtered_videos = filter_and_rank_videos(videos, section, grade_level)
            selected_videos = select_top_videos(filtered_videos, YOUTUBE_MAX_VIDEOS_PER_SECTION)
            
            for video in selected_videos:
                video['why_selected'] = generate_selection_rationale(video, section)
            
            section['video_resources'] = selected_videos
            total_videos_added += len(selected_videos)
            
            # Display results
            display_video_results(selected_videos, section.get('title', ''))
        
        # Step 3: Save enriched outline
        output_json_path = os.path.join(OUTPUTS_DIR, OUTPUT_OUTLINE_FILE)
        output_txt_path = os.path.join(OUTPUTS_DIR, OUTPUT_OUTLINE_TXT_FILE)
        
        save_enriched_outline(outline_data, output_json_path, output_txt_path)
        
        # Step 4: Display summary
        display_phase2_summary(total_videos_added, total_sections, total_api_units)
    
    except Exception as e:
        display_error(f"An error occurred during resource generation: {str(e)}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()