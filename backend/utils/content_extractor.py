"""
Content extraction for worksheets and activities
Handles GPT-4 Vision analysis of worksheet images and web scraping for activities
"""

import logging
import requests
from bs4 import BeautifulSoup
import openai
import json
from typing import Dict, Optional, List

from config import OPENAI_API_KEY

# Initialize logger
logger = logging.getLogger(__name__)

# Initialize OpenAI
openai.api_key = OPENAI_API_KEY


class ContentExtractor:
    """Extracts and analyzes content from educational resource URLs."""
    
    def __init__(self, openai_api_key: str = None):
        """
        Initialize the content extractor.
        
        Args:
            openai_api_key: OpenAI API key (defaults to config value)
        
        Raises:
            ValueError: If API key not provided
        """
        self.api_key = openai_api_key or OPENAI_API_KEY
        if not self.api_key:
            raise ValueError(
                "Missing OpenAI API key. Set OPENAI_API_KEY environment variable "
                "or pass to constructor."
            )
        
        openai.api_key = self.api_key
        logger.info("Initialized ContentExtractor")
    
    def analyze_worksheet_image(self, image_result: Dict) -> Optional[Dict]:
        """
        Analyze a worksheet image using GPT-4 Vision to extract educational value.
        
        Args:
            image_result: Dict containing image_url, source_url, title
        
        Returns:
            dict: Worksheet analysis with format:
                {
                    'worksheet_title': str,
                    'grade_level': str,
                    'topics_covered': List[str],
                    'visual_quality': int (0-10),
                    'educational_value': int (0-10),
                    'is_age_appropriate': bool,
                    'has_images_or_art': bool,
                    'image_url': str,
                    'source_url': str,
                    'resource_type': 'worksheet_image'
                }
            None: If analysis fails
        
        Example:
            >>> extractor = ContentExtractor()
            >>> result = extractor.analyze_worksheet_image({
            ...     'image_url': 'https://example.com/worksheet.jpg',
            ...     'title': 'Math Worksheet'
            ... })
            >>> result['resource_type']
            'worksheet_image'
        """
        try:
            image_url = image_result.get('image_url', '')
            if not image_url:
                logger.warning("No image URL provided")
                return None
            
            logger.info(f"Analyzing worksheet image: {image_result.get('title', 'Unknown')[:50]}")
            
            # Use GPT-4 Vision to analyze the worksheet image
            prompt = self._get_worksheet_analysis_prompt(image_result)
            
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
            
            logger.info(f"Successfully analyzed worksheet: {data.get('worksheet_title', 'Unknown')}")
            return data
        
        except Exception as e:
            logger.error(f"Error analyzing worksheet image: {e}")
            return None
    
    def crawl_and_extract_activity(self, url: str, title: str = "") -> Optional[Dict]:
        """
        Crawl a single webpage and extract activity information.
        
        Args:
            url: URL to webpage
            title: Page title (optional)
        
        Returns:
            dict: Extracted activity data with format:
                {
                    'activities_found': List[Dict],
                    'source_url': str,
                    'source_title': str
                }
            None: If extraction fails
        
        Example:
            >>> extractor = ContentExtractor()
            >>> result = extractor.crawl_and_extract_activity(
            ...     'https://example.com/activity',
            ...     'Science Activity'
            ... )
            >>> 'activities_found' in result
            True
        """
        logger.info(f"Crawling activity page: {title or url}")
        
        # Fetch webpage content
        page_content = self._fetch_webpage_content(url)
        if not page_content:
            return None
        
        # Extract activity ideas from this page
        return self._extract_activity_from_page(url, page_content, title)
    
    def _fetch_webpage_content(self, url: str) -> Optional[str]:
        """
        Fetch and extract text from a webpage URL.
        
        Args:
            url: URL to webpage
        
        Returns:
            str: Extracted text content
            None: If fetch fails
        """
        try:
            logger.debug(f"Fetching content from: {url}")
            
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
            
            logger.debug(f"Extracted {len(text)} characters from {url}")
            return text
        
        except Exception as e:
            logger.error(f"Error fetching {url}: {e}")
            return None
    
    def _extract_activity_from_page(self, url: str, page_content: str, title: str) -> Optional[Dict]:
        """
        Extract activity information from a webpage using LLM.
        
        Args:
            url: Source URL
            page_content: Extracted text from page
            title: Page title
        
        Returns:
            dict: Extracted activity data
            None: If extraction fails
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
            
            logger.debug(f"Extracting activities from {url}")
            
            response = openai.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert at extracting educational activity information from webpages."
                    },
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=1500
            )
            
            response_text = response.choices[0].message.content.strip()
            
            # Remove markdown
            if response_text.startswith("```json"):
                response_text = response_text.replace("```json", "").replace("```", "").strip()
            elif response_text.startswith("```"):
                response_text = response_text.replace("```", "").strip()
            
            data = json.loads(response_text)
            data['source_url'] = url
            data['source_title'] = title
            
            num_activities = len(data.get('activities_found', []))
            logger.info(f"Extracted {num_activities} activities from {url}")
            
            return data
        
        except Exception as e:
            logger.error(f"Error extracting activities from page: {e}")
            return None
    
    def _get_worksheet_analysis_prompt(self, image_result: Dict) -> str:
        """
        Generate prompt for worksheet image analysis.
        
        Args:
            image_result: Image metadata
        
        Returns:
            str: Prompt for GPT-4 Vision
        """
        return f"""Analyze this worksheet image and extract educational details.

Image Title: {image_result.get('title', 'Unknown')}
Source: {image_result.get('source_url', 'Unknown')}

Analyze and return JSON:
{{
    "worksheet_title": "descriptive title of the worksheet",
    "grade_level": "estimated grade level (e.g., 'grade 3-4', 'elementary')",
    "topics_covered": ["topic1", "topic2", "topic3"],
    "visual_quality": 0-10,
    "educational_value": 0-10,
    "is_age_appropriate": true/false,
    "has_images_or_art": true/false,
    "description": "brief description of what the worksheet teaches"
}}

Scoring guidelines:
- visual_quality: clarity, layout, professional appearance
- educational_value: pedagogical merit, learning potential
- is_age_appropriate: suitable for elementary students

Return ONLY valid JSON.
"""