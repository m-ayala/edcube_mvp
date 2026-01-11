"""
content_extractor.py

Handles fetching and extracting content from worksheet images and activity webpages.
"""

from dotenv import load_dotenv
load_dotenv()

import requests
from bs4 import BeautifulSoup
import openai
import json
import os
from typing import Dict, Optional, List
from prompts import (
    get_worksheet_image_analysis_prompt, 
    get_activity_synthesis_prompt
)


class ContentExtractor:
    """Extracts and analyzes content from educational resource URLs."""
    
    def __init__(self, openai_api_key: str = None):
        """
        Initialize the content extractor.
        
        Args:
            openai_api_key: OpenAI API key (or set OPENAI_API_KEY env var)
        """
        self.api_key = openai_api_key or os.getenv('OPENAI_API_KEY')
        if not self.api_key:
            raise ValueError("Missing OpenAI API key. Set OPENAI_API_KEY environment variable.")
        
        openai.api_key = self.api_key
    
    def analyze_worksheet_image(self, image_result: Dict) -> Optional[Dict]:
        """
        Analyze a worksheet image using GPT-4 Vision to extract educational value.
        
        Args:
            image_result: Dict containing image_url, source_url, title
            
        Returns:
            Dictionary with worksheet analysis, or None if analysis fails
        """
        try:
            image_url = image_result.get('image_url', '')
            if not image_url:
                return None
            
            print(f"      Analyzing image: {image_result.get('title', 'Unknown')[:50]}...")
            
            # Use GPT-4 Vision to analyze the worksheet image
            prompt = get_worksheet_image_analysis_prompt(image_result)
            
            response = openai.chat.completions.create(
                model="gpt-4o",  # GPT-4o has vision capabilities
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {"type": "image_url", "image_url": {"url": image_url}}
                        ]
                    }
                ],
                max_tokens=1000,
                temperature=0.3
            )
            
            # Parse JSON response
            response_text = response.choices[0].message.content.strip()
            
            # Remove markdown code blocks if present
            if response_text.startswith("```json"):
                response_text = response_text.replace("```json", "").replace("```", "").strip()
            elif response_text.startswith("```"):
                response_text = response_text.replace("```", "").strip()
            
            data = json.loads(response_text)
            
            # Add metadata
            data['image_url'] = image_url
            data['source_url'] = image_result.get('source_url', '')
            data['resource_type'] = 'worksheet_image'
            
            return data
            
        except Exception as e:
            print(f"      Error analyzing image: {e}")
            return None
    
    def crawl_and_extract_activities(self, search_results: List[Dict]) -> List[Dict]:
        """
        Crawl multiple activity webpages and extract all activity ideas.
        
        Args:
            search_results: List of search results with URLs to crawl
            
        Returns:
            List of extracted activity data from each page
        """
        activities = []
        
        for i, result in enumerate(search_results, 1):
            url = result.get('url', '')
            if not url:
                continue
            
            print(f"      Crawling ({i}/{len(search_results)}): {result.get('title', 'Unknown')[:50]}...")
            
            # Fetch webpage content
            page_content = self._fetch_webpage_content(url)
            if not page_content:
                continue
            
            # Extract activity ideas from this page
            activity_data = self._extract_activity_from_page(url, page_content, result.get('title', ''))
            if activity_data:
                activities.append(activity_data)
        
        return activities
    
    def synthesize_activity(self, activities: List[Dict], requirements: Dict) -> Optional[Dict]:
        """
        Synthesize the BEST activity from multiple sources using LLM.
        
        Args:
            activities: List of activity data extracted from different pages
            requirements: Section requirements (learning objectives, grade, etc.)
            
        Returns:
            Single synthesized activity with complete details
        """
        if not activities:
            return None
        
        try:
            print(f"      Synthesizing {len(activities)} activity ideas into one complete activity...")
            
            prompt = get_activity_synthesis_prompt(activities, requirements)
            
            response = openai.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "You are an expert elementary school teacher who creates engaging, age-appropriate activities."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.5,
                max_tokens=1500
            )
            
            response_text = response.choices[0].message.content.strip()
            
            # Remove markdown code blocks
            if response_text.startswith("```json"):
                response_text = response_text.replace("```json", "").replace("```", "").strip()
            elif response_text.startswith("```"):
                response_text = response_text.replace("```", "").strip()
            
            synthesized = json.loads(response_text)
            synthesized['resource_type'] = 'synthesized_activity'
            synthesized['sources'] = [a.get('source_url', '') for a in activities]
            
            return synthesized
            
        except Exception as e:
            print(f"      Error synthesizing activities: {e}")
            return None
    
    def _fetch_webpage_content(self, url: str) -> Optional[str]:
        """
        Fetch and extract text from a webpage URL.
        
        Args:
            url: URL to webpage
            
        Returns:
            Extracted text content, or None if fetch fails
        """
        try:
            response = requests.get(url, timeout=10, headers={
                'User-Agent': 'Mozilla/5.0 (Educational Resource Bot)'
            })
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Remove script and style elements
            for script in soup(["script", "style", "nav", "footer", "header", "aside"]):
                script.decompose()
            
            # Get text
            text = soup.get_text(separator='\n', strip=True)
            
            return text
            
        except Exception as e:
            print(f"        Error fetching {url}: {e}")
            return None
    
    def _extract_activity_from_page(self, url: str, page_content: str, title: str) -> Optional[Dict]:
        """
        Extract activity information from a webpage using LLM.
        
        Args:
            url: Source URL
            page_content: Extracted text from page
            title: Page title
            
        Returns:
            Extracted activity data
        """
        try:
            # Limit content to avoid token limits
            content_preview = page_content[:4000]
            
            prompt = f"""Extract activity information from this educational webpage.

URL: {url}
Title: {title}

Content:
{content_preview}

Extract and return JSON:
{{
    "activities_found": [
        {{
            "name": "Activity name",
            "type": "discussion/hands-on/project/game/etc",
            "description": "What students do",
            "materials": ["list", "of", "materials"],
            "steps": ["step 1", "step 2", ...],
            "duration": "estimated time",
            "grade_level": "target grade",
            "learning_objectives": ["what students learn"]
        }}
    ]
}}

Return ONLY valid JSON with all activities found on this page.
"""
            
            response = openai.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "You are an expert at extracting educational activity information from webpages."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=1500
            )
            
            response_text = response.choices[0].message.content.strip()
            
            if response_text.startswith("```json"):
                response_text = response_text.replace("```json", "").replace("```", "").strip()
            elif response_text.startswith("```"):
                response_text = response_text.replace("```", "").strip()
            
            data = json.loads(response_text)
            data['source_url'] = url
            data['source_title'] = title
            
            return data
            
        except Exception as e:
            print(f"        Error extracting from page: {e}")
            return None


# Example usage
if __name__ == "__main__":
    extractor = ContentExtractor()
    
    # Test worksheet image analysis
    print("=== Testing Worksheet Image Analysis ===")
    test_image = {
        'image_url': 'https://example.com/worksheet.jpg',
        'source_url': 'https://example.com/mlk-timeline',
        'title': 'MLK Timeline Worksheet'
    }
    result = extractor.analyze_worksheet_image(test_image)
    if result:
        print(json.dumps(result, indent=2))