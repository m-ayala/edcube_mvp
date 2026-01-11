def display_phase2_start():
    """
    Display Phase 2 start message
    """
    print("\n" + "="*70)
    print("🎬 PHASE 2: VIDEO RESOURCE GENERATION")
    print("="*70)
    print("\nThis will find relevant YouTube videos for each course section.")
    print("API quota will be monitored to stay within limits.\n")


def display_section_progress(section_num, total_sections, section_title):
    """
    Display progress for current section
    """
    print("\n" + "-"*70)
    print(f"📹 Section {section_num}/{total_sections}: {section_title}")
    print("-"*70)


def display_video_results(videos, section_title):
    """
    Display filtered video results for a section
    
    Args:
        videos (list): List of video dictionaries
        section_title (str): Section title
    """
    if not videos:
        print(f"   ⚠️  No suitable videos found for this section")
        return
    
    print(f"\n   ✅ Selected {len(videos)} video(s):")
    for i, video in enumerate(videos, 1):
        print(f"\n   [{i}] {video['title']}")
        print(f"       Channel: {video['channel_name']}" + 
              (" ✓" if video.get('channel_verified') else ""))
        print(f"       Duration: {video['duration_formatted']} | " +
              f"Views: {format_number(video['view_count'])} | " +
              f"Score: {video['relevance_score']}/10")
        print(f"       URL: {video['video_url']}")


def display_api_usage(units_used, total_units=10000):
    """
    Display YouTube API quota usage
    """
    percentage = (units_used / total_units) * 100
    print(f"\n📊 API Usage: {units_used:,} / {total_units:,} units ({percentage:.1f}%)")


def display_phase2_summary(total_videos, total_sections, units_used):
    """
    Display Phase 2 completion summary
    """
    print("\n" + "="*70)
    print("✅ PHASE 2 COMPLETE!")
    print("="*70)
    print(f"Videos added: {total_videos} total across {total_sections} sections")
    display_api_usage(units_used)
    print("\nEnriched course outline saved to ../outputs/")
    print("="*70 + "\n")


def format_number(num):
    """
    Format large numbers with K/M suffixes
    
    Args:
        num (int): Number to format
    
    Returns:
        str: Formatted number (e.g., "1.5M", "450K")
    """
    if num >= 1_000_000:
        return f"{num / 1_000_000:.1f}M"
    elif num >= 1_000:
        return f"{num / 1_000:.1f}K"
    else:
        return str(num)


def display_error(message):
    """
    Display error message
    """
    print(f"\n❌ ERROR: {message}\n")


def confirm_continue():
    """
    Ask user to confirm continuation
    
    Returns:
        bool: True if user wants to continue
    """
    response = input("\nContinue with resource generation? (yes/no): ").strip().lower()
    return response == 'yes'