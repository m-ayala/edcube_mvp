"""
main.py

Phase 3: On-Demand Worksheet & Activity Generation
NEW APPROACH: Teachers selectively add resources only where needed via interactive CLI.
"""

from dotenv import load_dotenv
load_dotenv()

import json
import os
from typing import Dict, List, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed

from google_search_handler import GoogleSearchHandler
from content_extractor import ContentExtractor
from resource_filter import ResourceFilter
from hands_on_prompts import (
    generate_worksheet_prompt_suggestions,
    generate_activity_prompt_suggestions
)


class OnDemandResourceGenerator:
    """Generates worksheets and activities on-demand based on teacher selection."""
    
    def __init__(self):
        """Initialize all handlers."""
        self.search_handler = GoogleSearchHandler()
        self.content_extractor = ContentExtractor()
        self.resource_filter = ResourceFilter()
    
    def interactive_session(self, input_file: str, output_file: str):
        """
        Main interactive CLI session for adding resources to sections.
        
        Args:
            input_file: Path to course_outline_with_resources.json (from Phase 2)
            output_file: Path to save updated course outline
        """
        print("\n" + "="*70)
        print("🎓 EdCube Phase 3: On-Demand Resource Generation")
        print("="*70)
        print("\nAdd worksheets and activities to the sections you need!\n")
        
        # Load course outline
        course_data = self._load_course_outline(input_file)
        if not course_data:
            print("❌ Could not load course outline.")
            return
        
        grade = int(course_data.get('grade_level', 5))
        sections = course_data.get('sections', [])
        
        print(f"Course: {course_data.get('course_title', 'Unknown')}")
        print(f"Grade: {grade}")
        print(f"Sections: {len(sections)}\n")
        
        # Main loop: teacher selects sections to add resources to
        while True:
            print("\n" + "="*70)
            self._display_sections_summary(sections)
            print("="*70)
            
            print("\nOptions:")
            print(f"  [1-{len(sections)}] Select a section to add resources")
            print("  [r] Review all resources added so far")
            print("  [s] Save and exit")
            print("  [q] Quit without saving")
            
            choice = input("\nYour choice: ").strip().lower()
            
            if choice == 'q':
                print("\n❌ Exiting without saving.")
                return
            elif choice == 's':
                self._save_course_outline(course_data, output_file)
                print("\n✅ Course saved successfully!")
                print(f"Saved to: {output_file}\n")
                return
            elif choice == 'r':
                self._review_all_resources(sections)
            elif choice.isdigit() and 1 <= int(choice) <= len(sections):
                section_idx = int(choice) - 1
                self._handle_section_menu(sections[section_idx], grade)
            else:
                print("❌ Invalid choice. Try again.")
    
    def _display_sections_summary(self, sections: List[Dict]):
        """Display summary of all sections with resource counts."""
        print("\n📚 CURRICULUM SECTIONS:\n")
        for i, section in enumerate(sections, 1):
            title = section.get('title', 'Unknown')
            duration = section.get('duration_minutes', 0)
            
            # Count resources
            worksheets = len(section.get('worksheet_options', []))
            activities = len(section.get('activity_options', []))
            
            status = ""
            if worksheets > 0:
                status += f" [📝 {worksheets} worksheet{'s' if worksheets > 1 else ''}]"
            if activities > 0:
                status += f" [🎨 {activities} activit{'ies' if activities > 1 else 'y'}]"
            if not status:
                status = " [No resources added]"
            
            print(f"  [{i}] {title} ({duration} min){status}")
    
    def _handle_section_menu(self, section: Dict, grade: int):
        """
        Handle menu for a specific section - add worksheets or activities.
        
        Args:
            section: Section data
            grade: Grade level
        """
        while True:
            print("\n" + "-"*70)
            print(f"Section: {section.get('title', 'Unknown')}")
            print(f"Duration: {section.get('duration_minutes', 0)} minutes")
            print("-"*70)
            
            # Show current resources
            worksheets = section.get('worksheet_options', [])
            activities = section.get('activity_options', [])
            
            if worksheets:
                print(f"\n📝 Worksheets Added ({len(worksheets)}):")
                for i, ws in enumerate(worksheets, 1):
                    print(f"  {i}. {ws.get('worksheet_title', 'Unknown')}")
            
            if activities:
                print(f"\n🎨 Activities Added ({len(activities)}):")
                for i, act in enumerate(activities, 1):
                    print(f"  {i}. {act.get('title', 'Unknown')}")
            
            print("\nWhat would you like to add?")
            print("  [w] Add worksheet")
            print("  [a] Add activity")
            print("  [b] Back to main menu")
            
            choice = input("\nYour choice: ").strip().lower()
            
            if choice == 'b':
                return
            elif choice == 'w':
                self._add_worksheet_workflow(section, grade)
            elif choice == 'a':
                self._add_activity_workflow(section, grade)
            else:
                print("❌ Invalid choice.")
    
    def _add_worksheet_workflow(self, section: Dict, grade: int):
        """
        Workflow for adding a worksheet: show prompts → generate options → select one.
        
        Args:
            section: Section data
            grade: Grade level
        """
        print("\n" + "~"*70)
        print("📝 ADD WORKSHEET")
        print("~"*70)
        
        # Step 1: Generate prompt suggestions
        print("\n💡 Generating worksheet type suggestions...")
        prompts = generate_worksheet_prompt_suggestions(section, grade)
        
        # Step 2: Display prompts with descriptions
        print("\n💡 Suggested Worksheet Types:\n")
        for i, prompt in enumerate(prompts, 1):
            print(f"[{i}] {prompt.get('icon', '📝')} {prompt['name']}")
            print(f"    {prompt['description']}")
            print(f"    Includes:")
            for item in prompt.get('includes', []):
                print(f"      • {item}")
            print()
        
        print(f"[{len(prompts) + 1}] ✏️  Custom (describe what you're looking for)")
        print(f"[0] Cancel")
        
        # Step 3: Teacher selects prompt
        choice = input("\nSelect a worksheet type: ").strip()
        
        if choice == '0':
            return
        
        if choice.isdigit() and 1 <= int(choice) <= len(prompts):
            selected = prompts[int(choice) - 1]
            selected_prompt = selected['name']
            selected_search_query = selected.get('search_query', None)
        elif choice == str(len(prompts) + 1):
            selected_prompt = input("\nDescribe the worksheet you want: ").strip()
            selected_search_query = None  # Custom prompt, no pre-generated query
            if not selected_prompt:
                print("❌ No description provided. Cancelled.")
                return
        else:
            print("❌ Invalid choice.")
            return
        
        # Step 4: Generate worksheet options with CONCURRENCY
        print(f"\n🔍 Searching for '{selected_prompt}' worksheets...")
        print("⏳ This may take 30-60 seconds...\n")
        
        worksheets = self._generate_worksheets_concurrent(section, grade, selected_prompt, selected_search_query)
        
        if not worksheets:
            print("❌ No suitable worksheets found. Try a different prompt.")
            return
        
        # Step 5: Display options
        print(f"\n✅ Found {len(worksheets)} worksheet options:\n")
        for i, ws in enumerate(worksheets, 1):
            print(f"[{i}] {ws.get('worksheet_title', 'Unknown')}")
            print(f"    Grade: {ws.get('grade_level', 'N/A')} | Type: {ws.get('learning_approach', 'N/A')}")
            print(f"    {ws.get('description', 'No description')[:100]}...")
            print(f"    Score: {ws.get('overall_score', 0):.1f}/10")
            print(f"    Preview: {ws.get('image_url', 'N/A')[:60]}...")
            print()
        
        print("[0] Skip all")
        
        # Step 6: Teacher selects one
        choice = input("\nSelect a worksheet to add: ").strip()
        
        if choice == '0':
            return
        
        if choice.isdigit() and 1 <= int(choice) <= len(worksheets):
            selected = worksheets[int(choice) - 1]
            
            # Add to section
            if 'worksheet_options' not in section:
                section['worksheet_options'] = []
            section['worksheet_options'].append(selected)
            
            print(f"\n✅ Added worksheet: {selected.get('worksheet_title', 'Unknown')}")
        else:
            print("❌ Invalid choice.")
    
    def _add_activity_workflow(self, section: Dict, grade: int):
        """
        Workflow for adding an activity: show prompts → generate options → select one.
        
        Args:
            section: Section data
            grade: Grade level
        """
        print("\n" + "~"*70)
        print("🎨 ADD ACTIVITY")
        print("~"*70)
        
        # Step 1: Generate prompt suggestions
        print("\n💡 Generating activity type suggestions...")
        prompts = generate_activity_prompt_suggestions(section, grade)
        
        # Step 2: Display prompts with descriptions
        print("\n💡 Suggested Activity Types:\n")
        for i, prompt in enumerate(prompts, 1):
            print(f"[{i}] {prompt.get('icon', '🎨')} {prompt['name']}")
            print(f"    {prompt['description']}")
            print(f"    Includes:")
            for item in prompt.get('includes', []):
                print(f"      • {item}")
            print()
        
        print(f"[{len(prompts) + 1}] ✏️  Custom (describe what you're looking for)")
        print(f"[0] Cancel")
        
        # Step 3: Teacher selects prompt
        choice = input("\nSelect an activity type: ").strip()
        
        if choice == '0':
            return
        
        if choice.isdigit() and 1 <= int(choice) <= len(prompts):
            selected = prompts[int(choice) - 1]
            selected_prompt = selected['name']
            selected_search_query = selected.get('search_query', None)
        elif choice == str(len(prompts) + 1):
            selected_prompt = input("\nDescribe the activity you want: ").strip()
            selected_search_query = None  # Custom prompt, no pre-generated query
            if not selected_prompt:
                print("❌ No description provided. Cancelled.")
                return
        else:
            print("❌ Invalid choice.")
            return
        
        # Step 4: Generate activity options with CONCURRENCY
        print(f"\n🔍 Searching for '{selected_prompt}' activities...")
        print("⏳ This may take 30-60 seconds...\n")
        
        activities = self._generate_activities_concurrent(section, grade, selected_prompt, selected_search_query)
        
        if not activities:
            print("❌ No suitable activities found. Try a different prompt.")
            return
        
        # Step 5: Display options
        print(f"\n✅ Found {len(activities)} activity options:\n")
        for i, act in enumerate(activities, 1):
            print(f"[{i}] {act.get('title', 'Unknown')}")
            print(f"    Type: {act.get('type', 'N/A')} | Duration: {act.get('duration', 'N/A')}")
            print(f"    {act.get('description', 'No description')[:100]}...")
            print(f"    Score: {act.get('overall_score', 0):.1f}/10")
            print()
        
        print("[0] Skip all")
        
        # Step 6: Teacher selects one
        choice = input("\nSelect an activity to add: ").strip()
        
        if choice == '0':
            return
        
        if choice.isdigit() and 1 <= int(choice) <= len(activities):
            selected = activities[int(choice) - 1]
            
            # Add to section
            if 'activity_options' not in section:
                section['activity_options'] = []
            section['activity_options'].append(selected)
            
            print(f"\n✅ Added activity: {selected.get('title', 'Unknown')}")
        else:
            print("❌ Invalid choice.")
    
    def _generate_worksheets_concurrent(self, section: Dict, grade: int, user_prompt: str, search_query: str = None) -> List[Dict]:
        """
        Generate 2-3 worksheet options with CONCURRENT processing for speed.
        
        Args:
            section: Section data
            grade: Grade level
            user_prompt: Teacher's selected/custom prompt
            
        Returns:
            List of 2-3 ranked worksheets
        """
        # Build search query - use GPT-generated one if available
        if search_query:
            # GPT already generated optimal search query
            search_query = f"{search_query} grade {grade}"
        else:
            # Fallback for custom prompts
            search_query = f"{user_prompt} grade {grade}"
        
        # Search for worksheet images
        search_results = self.search_handler.search_worksheets(search_query, num_results=6)
        
        if not search_results:
            return []
        
        # Analyze images CONCURRENTLY (3 at a time for speed)
        print(f"  ⚡ Analyzing {len(search_results)} images in parallel...")
        all_worksheets = []
        
        with ThreadPoolExecutor(max_workers=3) as executor:
            futures = {executor.submit(self.content_extractor.analyze_worksheet_image, img): img 
                      for img in search_results[:6]}
            
            for future in as_completed(futures):
                try:
                    result = future.result(timeout=30)
                    if result:
                        all_worksheets.append(result)
                except Exception as e:
                    print(f"  ❌ Error analyzing image: {e}")
        
        if not all_worksheets:
            return []
        
        # Filter and rank
        section_requirements = {
            'title': section.get('title', ''),
            'learning_objectives': ' '.join(section.get('learning_objectives', [])),
            'keywords': ', '.join(section.get('content_keywords', [])),
            'grade': grade
        }
        
        ranked = self.resource_filter.filter_and_rank_worksheets(all_worksheets, section_requirements)
        
        # Return top 2-3
        return ranked[:3]
    
    def _generate_activities_concurrent(self, section: Dict, grade: int, user_prompt: str, search_query: str = None) -> List[Dict]:
        """
        Generate 2-3 activity options with CONCURRENT processing for speed.
        
        Args:
            section: Section data
            grade: Grade level
            user_prompt: Teacher's selected/custom prompt
            
        Returns:
            List of 2-3 ranked activities
        """
        # Build search query - use GPT-generated one if available
        grade_level = self._get_grade_level_descriptor(grade)
        if search_query:
            # GPT already generated optimal search query
            search_query = f"{search_query} {grade_level} classroom"
        else:
            # Fallback for custom prompts
            search_query = f"{user_prompt} {grade_level} classroom"
        
        # Search for activity pages
        search_results = self.search_handler.search_activities(search_query, num_results=8)
        
        if not search_results:
            return []
        
        # Crawl and extract CONCURRENTLY (4 at a time for speed)
        print(f"  ⚡ Crawling {len(search_results)} pages in parallel...")
        all_activities = []
        
        with ThreadPoolExecutor(max_workers=4) as executor:
            futures = {executor.submit(self._crawl_single_page, url_data): url_data 
                      for url_data in search_results[:8]}
            
            for future in as_completed(futures):
                try:
                    result = future.result(timeout=30)
                    if result and result.get('activities_found'):
                        # Each page may have multiple activities
                        for activity in result['activities_found']:
                            activity['source_url'] = result.get('source_url', '')
                            all_activities.append(activity)
                except Exception as e:
                    print(f"  ❌ Error crawling page: {e}")
        
        if not all_activities:
            return []
        
        # Filter and rank
        section_requirements = {
            'title': section.get('title', ''),
            'learning_objectives': ' '.join(section.get('learning_objectives', [])),
            'keywords': ', '.join(section.get('content_keywords', [])),
            'grade': grade
        }
        
        ranked = self.resource_filter.filter_and_rank_activities(all_activities, section_requirements)
        
        # Return top 2-3
        return ranked[:3]
    
    def _crawl_single_page(self, url_data: Dict) -> Optional[Dict]:
        """Helper for concurrent page crawling."""
        url = url_data.get('url', '')
        title = url_data.get('title', '')
        
        # Fetch content
        content = self.content_extractor._fetch_webpage_content(url)
        if not content:
            return None
        
        # Extract activities
        return self.content_extractor._extract_activity_from_page(url, content, title)
    
    def _review_all_resources(self, sections: List[Dict]):
        """Display summary of all resources added across all sections."""
        print("\n" + "="*70)
        print("📋 RESOURCE SUMMARY")
        print("="*70)
        
        total_worksheets = 0
        total_activities = 0
        
        for i, section in enumerate(sections, 1):
            worksheets = section.get('worksheet_options', [])
            activities = section.get('activity_options', [])
            
            if worksheets or activities:
                print(f"\nSection {i}: {section.get('title', 'Unknown')}")
                
                if worksheets:
                    print(f"  📝 Worksheets ({len(worksheets)}):")
                    for ws in worksheets:
                        print(f"     • {ws.get('worksheet_title', 'Unknown')}")
                    total_worksheets += len(worksheets)
                
                if activities:
                    print(f"  🎨 Activities ({len(activities)}):")
                    for act in activities:
                        print(f"     • {act.get('title', 'Unknown')}")
                    total_activities += len(activities)
        
        print(f"\n{'='*70}")
        print(f"TOTAL: {total_worksheets} worksheets, {total_activities} activities")
        print(f"{'='*70}")

    def _get_grade_level_descriptor(self, grade: int) -> str:
        """
        Get appropriate grade level descriptor for search queries.
        
        Args:
            grade: Grade level number (3-12)
            
        Returns:
            Descriptor like "elementary", "middle school", "high school"
        """
        if grade <= 5:
            return "elementary"
        elif grade <= 8:
            return "middle school"
        else:
            return "high school"
    
    def _load_course_outline(self, filepath: str) -> Optional[Dict]:
        """Load course outline from JSON file."""
        if not os.path.exists(filepath):
            print(f"❌ File not found: {filepath}")
            return None
        
        try:
            with open(filepath, 'r') as f:
                return json.load(f)
        except Exception as e:
            print(f"❌ Error loading file: {e}")
            return None
    
    def _save_course_outline(self, course_data: Dict, filepath: str):
        """Save updated course outline to JSON file."""
        try:
            os.makedirs(os.path.dirname(filepath), exist_ok=True)
            with open(filepath, 'w') as f:
                json.dump(course_data, f, indent=2)
        except Exception as e:
            print(f"❌ Error saving file: {e}")

    


def main():
    """Main entry point."""
    # Paths
    input_file = "../outputs/course_outline_with_resources.json"
    output_file = "../outputs/course_outline_complete.json"
    
    # Run interactive session
    generator = OnDemandResourceGenerator()
    generator.interactive_session(input_file, output_file)


if __name__ == "__main__":
    main()