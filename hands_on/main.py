"""
main.py

Main orchestrator for Phase 3: Worksheet and Activity Finder
Loads course outline and generates 5-6 options per section for teacher choice.
"""

from dotenv import load_dotenv
load_dotenv()

import json
import os
from typing import Dict, List
import openai

from google_search_handler import GoogleSearchHandler
from content_extractor import ContentExtractor
from resource_filter import ResourceFilter
from prompts import get_search_query_prompt


class WorksheetActivityFinder:
    """Main class to orchestrate finding and populating worksheets and activities."""
    
    def __init__(self):
        """Initialize all handlers."""
        self.search_handler = GoogleSearchHandler()
        self.content_extractor = ContentExtractor()
        self.resource_filter = ResourceFilter()
        
        # OpenAI client for search query generation
        openai.api_key = os.getenv('OPENAI_API_KEY')
    
    def process_course(self, input_file: str, output_file: str):
        """
        Main processing function: load outline, find resource OPTIONS, save complete course.
        
        Args:
            input_file: Path to course_outline_with_resources.json (from Phase 2)
            output_file: Path to save course_outline_complete.json
        """
        print("=== Starting Phase 3: Worksheet & Activity Finder ===\n")
        print("Generating 5-6 options per section for teacher choice\n")
        
        # Load course outline
        course_data = self._load_course_outline(input_file)
        if not course_data:
            print("Error: Could not load course outline.")
            return
        
        grade = int(course_data.get('grade_level', 5))
        print(f"Processing course: {course_data.get('topic', 'Unknown')} (Grade {grade})\n")
        
        # Process each section
        sections = course_data.get('sections', [])
        for i, section in enumerate(sections, 1):
            print(f"\n{'='*70}")
            print(f"Section {i}/{len(sections)}: {section.get('title', 'Untitled')}")
            print(f"{'='*70}\n")
            
            # Generate worksheet options if needed
            if section.get('needs_worksheets', False):
                self._generate_worksheet_options(section, grade)
            else:
                print("  No worksheets needed for this section.\n")
            
            # Generate activity options if needed
            if section.get('needs_activities', False):
                self._generate_activity_options(section, grade)
            else:
                print("  No activities needed for this section.\n")
        
        # Save complete course
        self._save_course_outline(course_data, output_file)
        print(f"\n{'='*70}")
        print(f"✅ Complete course saved to: {output_file}")
        print(f"{'='*70}\n")
        print("Teachers can now review and select from the generated options!")
    
    def _load_course_outline(self, filepath: str) -> Dict:
        """Load course outline JSON from Phase 2."""
        try:
            with open(filepath, 'r') as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading course outline: {e}")
            return None
    
    def _save_course_outline(self, course_data: Dict, filepath: str):
        """Save complete course outline with all resource options."""
        try:
            os.makedirs(os.path.dirname(filepath), exist_ok=True)
            with open(filepath, 'w') as f:
                json.dump(course_data, f, indent=2)
        except Exception as e:
            print(f"Error saving course outline: {e}")
    
    def _generate_worksheet_options(self, section: Dict, grade: int):
        """
        Generate 5-6 diverse worksheet options for this section.
        
        Args:
            section: Section data from outline
            grade: Grade level
        """
        print(f"🔍 Generating worksheet options for: {section.get('title', 'Unknown')}")
        
        # Generate multiple search queries for diversity
        query_types = [
            "timeline worksheet",
            "reading comprehension worksheet",
            "vocabulary worksheet",
            "critical thinking worksheet",
            "coloring activity worksheet"
        ]
        
        all_worksheets = []
        
        for query_type in query_types:
            # Generate specific search query
            search_query = self._generate_diverse_worksheet_query(section, grade, query_type)
            print(f"  → Searching: {query_type}")
            print(f"     Query: '{search_query}'")
            
            # Search Google Images
            search_results = self.search_handler.search_worksheets(search_query, num_results=5)
            
            if not search_results:
                continue
            
            # Analyze top 2-3 images for this query type
            for result in search_results[:3]:
                analyzed = self.content_extractor.analyze_worksheet_image(result)
                if analyzed:
                    all_worksheets.append(analyzed)
        
        print(f"  ✓ Analyzed {len(all_worksheets)} total worksheets")
        
        # Filter and rank all worksheets
        section_requirements = {
            'title': section.get('title', ''),
            'learning_objectives': ' '.join(section.get('learning_objectives', [])),
            'keywords': ', '.join(section.get('content_keywords', [])),
            'grade': grade
        }
        
        ranked_worksheets = self.resource_filter.filter_and_rank_worksheets(
            all_worksheets,
            section_requirements
        )
        
        # Keep top 5-6 diverse options
        final_options = self._ensure_diversity(ranked_worksheets[:6], 'learning_approach')
        
        # Store in section
        section['worksheet_options'] = final_options
        
        print(f"\n  ✅ Generated {len(final_options)} worksheet options:")
        for i, ws in enumerate(final_options, 1):
            print(f"     {i}. {ws.get('worksheet_title', 'Unknown')} (Score: {ws.get('overall_score', 0):.1f})")
            print(f"        Approach: {ws.get('learning_approach', 'Unknown')}")
        print()
    
    def _generate_activity_options(self, section: Dict, grade: int):
        """
        Generate 5-6 diverse activity options for this section.
        
        Args:
            section: Section data from outline
            grade: Grade level
        """
        print(f"🔍 Generating activity options for: {section.get('title', 'Unknown')}")
        
        # Generate multiple search queries for diversity
        query_types = [
            "discussion activity",
            "hands-on project",
            "group activity",
            "role play activity",
            "creative activity"
        ]
        
        all_activity_sources = []
        
        for query_type in query_types:
            # Generate specific search query
            search_query = self._generate_diverse_activity_query(section, grade, query_type)
            print(f"  → Searching: {query_type}")
            print(f"     Query: '{search_query}'")
            
            # Search web for activities
            search_results = self.search_handler.search_activities(search_query, num_results=5)
            
            if not search_results:
                continue
            
            # Crawl top 3 pages for this query type
            extracted = self.content_extractor.crawl_and_extract_activities(search_results[:3])
            all_activity_sources.extend(extracted)
        
        print(f"  ✓ Crawled {len(all_activity_sources)} activity sources")
        
        # Synthesize multiple distinct activities from all sources
        section_requirements = {
            'title': section.get('title', ''),
            'learning_objectives': ' '.join(section.get('learning_objectives', [])),
            'keywords': ', '.join(section.get('content_keywords', [])),
            'grade': grade
        }
        
        # Group sources by activity type and synthesize one activity per type
        activity_options = []
        for query_type in query_types[:6]:  # Generate up to 6 different activities
            # Filter sources relevant to this activity type
            relevant_sources = [s for s in all_activity_sources if s]
            
            if relevant_sources:
                # Synthesize one activity from these sources
                synthesized = self.content_extractor.synthesize_activity(
                    relevant_sources[:3],  # Use top 3 sources per type
                    section_requirements
                )
                
                if synthesized:
                    # Evaluate the synthesized activity
                    evaluated = self.resource_filter.rank_synthesized_activity(
                        synthesized,
                        section_requirements
                    )
                    
                    if evaluated and evaluated.get('relevance_data', {}).get('is_suitable', False):
                        activity_options.append(evaluated)
        
        # Store in section
        section['activity_options'] = activity_options
        
        print(f"\n  ✅ Generated {len(activity_options)} activity options:")
        for i, act in enumerate(activity_options, 1):
            print(f"     {i}. {act.get('title', 'Unknown')} (Score: {act.get('overall_score', 0):.1f})")
            print(f"        Type: {act.get('type', 'Unknown')}, Duration: {act.get('duration', 'Unknown')}")
        print()
    
    def _generate_diverse_worksheet_query(self, section: Dict, grade: int, query_type: str) -> str:
        """Generate a search query for a specific worksheet type."""
        topic = section.get('title', '')
        return f"{topic} {query_type} grade {grade}"
    
    def _generate_diverse_activity_query(self, section: Dict, grade: int, query_type: str) -> str:
        """Generate a search query for a specific activity type."""
        topic = section.get('title', '')
        return f"{topic} {query_type} elementary grade {grade} lesson plan"
    
    def _ensure_diversity(self, items: List[Dict], diversity_key: str) -> List[Dict]:
        """
        Ensure diversity in the list by removing items with duplicate values for diversity_key.
        
        Args:
            items: List of items to diversify
            diversity_key: Key to check for uniqueness
            
        Returns:
            Diversified list
        """
        seen_values = set()
        diverse_items = []
        
        for item in items:
            value = item.get(diversity_key, '')
            if value not in seen_values or len(diverse_items) < 3:  # Allow some duplicates if we have <3 items
                seen_values.add(value)
                diverse_items.append(item)
        
        return diverse_items


def main():
    """Main entry point."""
    # File paths
    input_file = "../outputs/course_outline_with_resources.json"
    output_file = "../outputs/course_outline_complete.json"
    
    # Create finder and process
    finder = WorksheetActivityFinder()
    finder.process_course(input_file, output_file)


if __name__ == "__main__":
    main()