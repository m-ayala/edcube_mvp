import json
import os
from search_query_generator import generate_queries_for_section
from youtube_handler import search_videos, get_video_details
from transcript_handler import get_transcript, extract_transcript_text, calculate_wpm
from content_analyzer import analyze_video_content, calculate_content_coverage, detect_redundancy
from video_filter import filter_and_rank_videos, select_top_videos
from populator_config import (
    YOUTUBE_MAX_VIDEOS_PER_SECTION,
    MAX_SEARCH_ITERATIONS,
    CONVERGENCE_THRESHOLD,
    DEMOGRAPHIC_REQUIREMENTS
)


def generate_resources_for_outline(outline_data, grade_level):
    """
    Generate video resources for all sections in the course outline
    
    Args:
        outline_data (dict): Course outline from Phase 1
        grade_level (str): Grade level of students
    
    Returns:
        dict: Enriched outline with video resources
        int: Total API units used
        int: Total videos added
    """
    sections = outline_data.get('sections', [])
    teacher_comments = outline_data.get('teacher_comments', '')  # From original teacher input
    
    total_api_units = 0
    total_videos_added = 0
    used_video_ids = set()  # Track globally to prevent duplicates across sections
    
    for section in sections:
        section_id = section.get('id', '')
        section_title = section.get('title', '')
        
        print(f"\n{'='*70}")
        print(f"Processing: {section_title}")
        print(f"{'='*70}")
        
        # Generate search queries for this section
        queries = generate_queries_for_section(section, grade_level, teacher_comments)
        section['search_queries_used'] = [q.get('query', '') for q in queries]
        
        # Iterative search with content validation
        selected_videos = []
        iteration = 0
        previous_coverage = 0
        
        while iteration < MAX_SEARCH_ITERATIONS and len(selected_videos) < YOUTUBE_MAX_VIDEOS_PER_SECTION:
            iteration += 1
            print(f"\n   --- Search Iteration {iteration} ---")
            
            # Search YouTube for each query
            all_video_ids = []
            for query_data in queries:
                query = query_data.get('query', '')
                print(f"   🔍 Searching: \"{query}\"")
                
                video_ids = search_videos(query)
                all_video_ids.extend(video_ids)
                total_api_units += 100  # Each search = 100 units
            
            # Remove duplicates and already-used videos
            all_video_ids = list(set(all_video_ids))
            all_video_ids = [vid for vid in all_video_ids if vid not in used_video_ids]
            
            if not all_video_ids:
                print(f"   ⚠️  No new videos found")
                break
            
            print(f"   📥 Found {len(all_video_ids)} new videos, fetching details...")
            
            # Get detailed info for all videos
            videos = get_video_details(all_video_ids)
            total_api_units += len(all_video_ids)  # Each video detail = 1 unit
            
            # Get transcripts and analyze content
            print(f"   📄 Analyzing content...")
            for video in videos:
                # Get transcript
                transcript = get_transcript(video['video_id'])
                
                if transcript:
                    transcript_text = extract_transcript_text(transcript)
                    video['wpm'] = calculate_wpm(transcript, video['duration_seconds'])
                    video['transcript_available'] = True
                else:
                    transcript_text = ""
                    video['wpm'] = None
                    video['transcript_available'] = False
                
                # Analyze content
                content_analysis = analyze_video_content(transcript_text, video, section)
                video['topics_covered'] = content_analysis.get('topics_covered', [])
                video['main_focus'] = content_analysis.get('main_focus', '')
                video['content_depth'] = content_analysis.get('content_depth', 'unknown')
                
                # Calculate content coverage
                coverage_analysis = calculate_content_coverage(content_analysis, section)
                video['content_coverage'] = coverage_analysis
                
                # Detect redundancy with already-selected videos
                redundancy_analysis = detect_redundancy(video['topics_covered'], selected_videos)
                video['redundancy_analysis'] = redundancy_analysis
            
            # Filter and rank videos
            print(f"   🔧 Filtering and ranking...")
            filtered_videos = filter_and_rank_videos(videos, section, grade_level, selected_videos)
            
            if not filtered_videos:
                print(f"   ⚠️  No videos passed filters")
                break
            
            # Select additional videos (up to max)
            remaining_slots = YOUTUBE_MAX_VIDEOS_PER_SECTION - len(selected_videos)
            new_selections = select_top_videos(filtered_videos, remaining_slots)
            
            # Add to selected list
            for video in new_selections:
                video['why_selected'] = generate_selection_rationale(video, section)
                selected_videos.append(video)
                used_video_ids.add(video['video_id'])
            
            print(f"   ✅ Selected {len(new_selections)} video(s) this iteration")
            
            # Calculate current coverage
            current_coverage = calculate_section_coverage(selected_videos, section)
            print(f"   📊 Coverage: {current_coverage}%")
            
            # Check for convergence
            improvement = current_coverage - previous_coverage
            if improvement < CONVERGENCE_THRESHOLD:
                print(f"   ✓ Coverage improvement minimal ({improvement}%), stopping iterations")
                break
            
            previous_coverage = current_coverage
        
        # Store results in section
        section['video_resources'] = selected_videos
        section['content_coverage_status'] = {
            'coverage_percentage': calculate_section_coverage(selected_videos, section),
            'iterations_performed': iteration
        }
        
        total_videos_added += len(selected_videos)
        
        print(f"\n   Final: {len(selected_videos)} video(s) selected for this section")
    
    # Validate demographic requirements
    validate_demographic_distribution(outline_data, grade_level)
    
    return outline_data, total_api_units, total_videos_added


def calculate_section_coverage(selected_videos, section):
    """
    Calculate overall coverage percentage for a section
    
    Args:
        selected_videos (list): Videos selected so far
        section (dict): Section requirements
    
    Returns:
        int: Coverage percentage (0-100)
    """
    if not selected_videos:
        return 0
    
    # Average coverage across all selected videos
    total_coverage = sum([v.get('content_coverage', {}).get('coverage_percentage', 0) for v in selected_videos])
    avg_coverage = total_coverage / len(selected_videos)
    
    return int(avg_coverage)


def generate_selection_rationale(video, section):
    """
    Generate a brief explanation of why this video was selected
    
    Args:
        video (dict): Video data
        section (dict): Section data
    
    Returns:
        str: Rationale text
    """
    reasons = []
    
    # High relevance score
    if video.get('relevance_score', 0) >= 7.0:
        reasons.append("high relevance score")
    
    # Good content coverage
    coverage = video.get('content_coverage', {}).get('coverage_percentage', 0)
    if coverage >= 80:
        reasons.append("excellent content coverage")
    elif coverage >= 60:
        reasons.append("good content coverage")
    
    # Appropriate pacing
    wpm = video.get('wpm')
    if wpm and 100 <= wpm <= 130:
        reasons.append("appropriate pacing for grade level")
    
    # Kid-friendly channel
    from channel_database import get_channel_tier
    tier = get_channel_tier(video['channel_name'])
    if tier == 1:
        reasons.append("kid-friendly channel")
    elif tier == 2:
        reasons.append("educational channel")
    
    # Low redundancy
    redundancy = video.get('redundancy_analysis', {}).get('redundancy_percentage', 0)
    if redundancy < 30:
        reasons.append("unique content")
    
    if not reasons:
        return "Meets quality criteria"
    
    return ", ".join(reasons).capitalize()


def validate_demographic_distribution(outline_data, grade_level):
    """
    Check if videos meet grade-level demographic requirements
    (e.g., 60% kid-focused for grade 4)
    
    Args:
        outline_data (dict): Complete outline with videos
        grade_level (str): Target grade level
    """
    try:
        grade_num = int(grade_level) if isinstance(grade_level, str) and grade_level.isdigit() else 5
    except:
        grade_num = 5
    
    requirements = DEMOGRAPHIC_REQUIREMENTS.get(grade_num, {'tier1_min': 0.50, 'tier2_max': 0.50})
    
    all_videos = []
    for section in outline_data.get('sections', []):
        all_videos.extend(section.get('video_resources', []))
    
    if not all_videos:
        return
    
    from channel_database import get_channel_tier
    
    tier1_count = sum([1 for v in all_videos if get_channel_tier(v['channel_name']) == 1])
    tier2_count = sum([1 for v in all_videos if get_channel_tier(v['channel_name']) == 2])
    
    tier1_ratio = tier1_count / len(all_videos)
    tier2_ratio = tier2_count / len(all_videos)
    
    print(f"\n{'='*70}")
    print(f"DEMOGRAPHIC DISTRIBUTION CHECK")
    print(f"{'='*70}")
    print(f"Total videos: {len(all_videos)}")
    print(f"Tier 1 (kid-focused): {tier1_count} ({tier1_ratio*100:.1f}%)")
    print(f"Tier 2 (general educational): {tier2_count} ({tier2_ratio*100:.1f}%)")
    print(f"Required for grade {grade_num}: {requirements['tier1_min']*100:.0f}% kid-focused minimum")
    
    if tier1_ratio < requirements['tier1_min']:
        print(f"⚠️  WARNING: Not enough kid-focused content ({tier1_ratio*100:.1f}% < {requirements['tier1_min']*100:.0f}%)")
    else:
        print(f"✅ Demographic requirements met")
    print(f"{'='*70}")


def save_enriched_outline(outline_data, output_json_path, output_txt_path):
    """
    Save the enriched outline with video resources
    
    Args:
        outline_data (dict): Enriched course outline
        output_json_path (str): Path to save JSON file
        output_txt_path (str): Path to save TXT file
    """
    # Save JSON
    with open(output_json_path, 'w') as f:
        json.dump(outline_data, f, indent=2)
    print(f"\n✅ Saved: {output_json_path}")
    
    # Save human-readable TXT
    with open(output_txt_path, 'w') as f:
        f.write("="*70 + "\n")
        f.write("COURSE OUTLINE WITH VIDEO RESOURCES\n")
        f.write("="*70 + "\n\n")
        
        f.write(f"Course: {outline_data.get('course_title', 'N/A')}\n")
        f.write(f"Grade Level: {outline_data.get('grade_level', 'N/A')}\n")
        f.write(f"Topic: {outline_data.get('topic', 'N/A')}\n")
        total = outline_data.get('total_duration_minutes', 0)
        f.write(f"Total Duration: {total} minutes ({total//60}h {total%60}m)\n")
        f.write("\n" + "="*70 + "\n\n")
        
        # Sections with videos
        for i, section in enumerate(outline_data.get('sections', []), 1):
            f.write(f"SECTION {i}: {section.get('title', 'N/A')} ({section.get('duration_minutes', 0)} min)\n")
            f.write(f"Description: {section.get('description', 'N/A')}\n")
            
            # Coverage status
            coverage_status = section.get('content_coverage_status', {})
            f.write(f"Content Coverage: {coverage_status.get('coverage_percentage', 0)}%\n\n")
            
            # Subtopics
            if section.get('subtopics'):
                f.write("Subtopics:\n")
                for subtopic in section['subtopics']:
                    topics = ', '.join(subtopic.get('topics', []))
                    f.write(f"  - {subtopic.get('name', 'N/A')}: {topics}\n")
                f.write("\n")
            
            # Video resources
            videos = section.get('video_resources', [])
            if videos:
                f.write(f"Video Resources ({len(videos)}):\n")
                for j, video in enumerate(videos, 1):
                    f.write(f"\n  [{j}] {video['title']}\n")
                    f.write(f"      Channel: {video['channel_name']}\n")
                    f.write(f"      Duration: {video['duration_formatted']}\n")
                    f.write(f"      Views: {video['view_count']:,} | Relevance Score: {video['relevance_score']}/10\n")
                    if video.get('wpm'):
                        f.write(f"      Pacing: {video['wpm']} WPM\n")
                    f.write(f"      Coverage: {video.get('content_coverage', {}).get('coverage_percentage', 0)}%\n")
                    f.write(f"      URL: {video['video_url']}\n")
                    f.write(f"      Why Selected: {video.get('why_selected', 'N/A')}\n")
            else:
                f.write("Video Resources: None found\n")
            
            f.write("\n" + "-"*70 + "\n\n")
        
        # Worksheets
        worksheets = outline_data.get('worksheets', [])
        if worksheets:
            f.write("="*70 + "\n\n")
            f.write(f"WORKSHEETS ({len(worksheets)}):\n\n")
            for i, ws in enumerate(worksheets, 1):
                f.write(f"{i}. {ws.get('title', 'N/A')} ({ws.get('duration_minutes', 0)} min)\n")
                f.write(f"   Linked to: {ws.get('linked_section_title', 'N/A')}\n\n")
        
        # Activities
        activities = outline_data.get('activities', [])
        if activities:
            f.write("="*70 + "\n\n")
            f.write(f"ACTIVITIES ({len(activities)}):\n\n")
            for i, act in enumerate(activities, 1):
                f.write(f"{i}. {act.get('name', 'N/A')} ({act.get('duration_minutes', 0)} min)\n")
                f.write(f"   Type: {act.get('type', 'N/A')}\n")
                f.write(f"   Linked to: {act.get('linked_section_title', 'N/A')}\n\n")
        
        f.write("="*70 + "\n")
    
    print(f"✅ Saved: {output_txt_path}")