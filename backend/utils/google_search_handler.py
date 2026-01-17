"""
Google Custom Search API handler for finding worksheets and activities
"""

import logging
from typing import List, Dict
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from config import GOOGLE_API_KEY, GOOGLE_CSE_ID

# Initialize logger
logger = logging.getLogger(__name__)


class GoogleSearchHandler:
    """Manages Google Custom Search API calls for educational resources."""
    
    def __init__(self, api_key: str = None, cse_id: str = None):
        """
        Initialize the Google Custom Search client.
        
        Args:
            api_key: Google API key (defaults to config value)
            cse_id: Custom Search Engine ID (defaults to config value)
        
        Raises:
            ValueError: If API key or CSE ID not provided
        """
        self.api_key = api_key or GOOGLE_API_KEY
        self.cse_id = cse_id or GOOGLE_CSE_ID
        
        if not self.api_key or not self.cse_id:
            raise ValueError(
                "Missing API key or CSE ID. Set GOOGLE_API_KEY and GOOGLE_CSE_ID "
                "environment variables or pass them to constructor."
            )
        
        self.service = build("customsearch", "v1", developerKey=self.api_key)
        logger.info("Initialized Google Custom Search handler")
    
    def search_worksheets(self, query: str, num_results: int = 10) -> List[Dict]:
        """
        Search for worksheet IMAGES (visual worksheets, printables).
        Uses Google Image Search to find the best visual resources.
        
        Args:
            query: Search query (e.g., "MLK timeline worksheet grade 5")
            num_results: Number of results to return (max 10)
        
        Returns:
            list: Search results with image URLs and source pages, format:
                [{
                    'title': str,
                    'snippet': str,
                    'image_url': str,
                    'source_url': str,
                    'thumbnail_url': str,
                    'type': 'image'
                }, ...]
        
        Example:
            >>> handler = GoogleSearchHandler()
            >>> results = handler.search_worksheets("photosynthesis worksheet grade 4")
            >>> results[0]['type']
            'image'
        """
        # Add "printable worksheet" to query for better results
        search_query = f"{query} printable worksheet"
        logger.info(f"Searching for worksheet images: '{search_query}'")
        
        return self._execute_image_search(search_query, num_results)
    
    def search_activities(self, query: str, num_results: int = 10) -> List[Dict]:
        """
        Search for activity pages (lesson plans, blogs, educational sites).
        Uses regular web search to find detailed activity instructions.
        
        Args:
            query: Search query (e.g., "MLK discussion activity elementary")
            num_results: Number of results to return (max 10)
        
        Returns:
            list: Search results with URLs to crawl, format:
                [{
                    'url': str,
                    'title': str,
                    'snippet': str,
                    'type': 'webpage'
                }, ...]
        
        Example:
            >>> handler = GoogleSearchHandler()
            >>> results = handler.search_activities("photosynthesis lab elementary")
            >>> results[0]['type']
            'webpage'
        """
        # Add "classroom activity lesson plan" for better results
        search_query = f"{query} classroom activity lesson plan"
        logger.info(f"Searching for activity pages: '{search_query}'")
        
        return self._execute_web_search(search_query, num_results)
    
    def _execute_image_search(self, query: str, num_results: int) -> List[Dict]:
        """
        Execute Google Image Search API call.
        
        Args:
            query: Search query string
            num_results: Number of results wanted (max 10)
        
        Returns:
            list: Parsed image search results
        """
        try:
            num_results = min(num_results, 10)  # API limit
            
            result = self.service.cse().list(
                q=query,
                cx=self.cse_id,
                num=num_results,
                searchType='image'  # Image search mode
            ).execute()
            
            parsed_results = self._parse_image_results(result)
            logger.info(f"Found {len(parsed_results)} image results for: '{query}'")
            
            return parsed_results
        
        except HttpError as e:
            logger.error(f"Google API HTTP Error: {e}")
            if e.resp.status == 429:
                logger.error("Rate limit exceeded - Google API quota exhausted")
            return []
        
        except Exception as e:
            logger.error(f"Error executing image search: {e}")
            return []
    
    def _execute_web_search(self, query: str, num_results: int) -> List[Dict]:
        """
        Execute regular Google Web Search API call.
        
        Args:
            query: Search query string
            num_results: Number of results wanted (max 10)
        
        Returns:
            list: Parsed web search results
        """
        try:
            num_results = min(num_results, 10)  # API limit
            
            result = self.service.cse().list(
                q=query,
                cx=self.cse_id,
                num=num_results
                # No searchType = regular web search
            ).execute()
            
            parsed_results = self._parse_web_results(result)
            logger.info(f"Found {len(parsed_results)} web results for: '{query}'")
            
            return parsed_results
        
        except HttpError as e:
            logger.error(f"Google API HTTP Error: {e}")
            if e.resp.status == 429:
                logger.error("Rate limit exceeded - Google API quota exhausted")
            return []
        
        except Exception as e:
            logger.error(f"Error executing web search: {e}")
            return []
    
    def _parse_image_results(self, api_response: Dict) -> List[Dict]:
        """
        Parse Google Image Search response.
        
        Args:
            api_response: Raw JSON response from Google API
        
        Returns:
            list: Parsed image results
        """
        results = []
        
        if 'items' not in api_response:
            logger.warning("No items in API response")
            return results
        
        for item in api_response['items']:
            result = {
                'title': item.get('title', ''),
                'snippet': item.get('snippet', ''),
                'image_url': item.get('link', ''),  # Direct link to image
                'source_url': item.get('image', {}).get('contextLink', ''),  # Page where image appears
                'thumbnail_url': item.get('image', {}).get('thumbnailLink', ''),
                'type': 'image'
            }
            results.append(result)
        
        return results
    
    def _parse_web_results(self, api_response: Dict) -> List[Dict]:
        """
        Parse Google Web Search response.
        
        Args:
            api_response: Raw JSON response from Google API
        
        Returns:
            list: Parsed web results
        """
        results = []
        
        if 'items' not in api_response:
            logger.warning("No items in API response")
            return results
        
        for item in api_response['items']:
            results.append({
                'url': item.get('link', ''),
                'title': item.get('title', ''),
                'snippet': item.get('snippet', ''),
                'type': 'webpage'
            })
        
        return results