"""
google_search_handler.py

Handles all Google Custom Search API interactions for finding worksheets and activities.
"""

from dotenv import load_dotenv
load_dotenv()

from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import os
from typing import List, Dict, Optional


class GoogleSearchHandler:
    """Manages Google Custom Search API calls for educational resources."""
    
    def __init__(self, api_key: str = None, cse_id: str = None):
        """
        Initialize the Google Custom Search client.
        
        Args:
            api_key: Google API key (or set GOOGLE_API_KEY env var)
            cse_id: Custom Search Engine ID (or set GOOGLE_CSE_ID env var)
        """
        self.api_key = api_key or os.getenv('GOOGLE_API_KEY')
        self.cse_id = cse_id or os.getenv('GOOGLE_CSE_ID')
        
        if not self.api_key or not self.cse_id:
            raise ValueError("Missing API key or CSE ID. Set GOOGLE_API_KEY and GOOGLE_CSE_ID environment variables.")
        
        self.service = build("customsearch", "v1", developerKey=self.api_key)
    
    def search_worksheets(self, query: str, num_results: int = 10) -> List[Dict]:
        """
        Search for worksheet IMAGES (visual worksheets, printables).
        Uses Google Image Search to find the best visual resources.
        
        Args:
            query: Search query (e.g., "MLK timeline worksheet grade 5")
            num_results: Number of results to return
            
        Returns:
            List of search results with image URLs and source pages
        """
        # Search for worksheet images
        search_query = f"{query} printable worksheet"
        
        return self._execute_image_search(search_query, num_results)
    
    def search_activities(self, query: str, num_results: int = 10) -> List[Dict]:
        """
        Search for activity pages (lesson plans, blogs, educational sites).
        Uses regular web search to find detailed activity instructions.
        
        Args:
            query: Search query (e.g., "MLK discussion activity elementary")
            num_results: Number of results to return
            
        Returns:
            List of search results with URLs to crawl
        """
        # Search for activity lesson plans
        search_query = f"{query} classroom activity lesson plan"
        
        return self._execute_web_search(search_query, num_results)
    
    def _execute_image_search(self, query: str, num_results: int) -> List[Dict]:
        """
        Execute Google Image Search API call.
        
        Args:
            query: Search query string
            num_results: Number of results wanted (max 10)
            
        Returns:
            Parsed list of image search results
        """
        try:
            num_results = min(num_results, 10)
            
            result = self.service.cse().list(
                q=query,
                cx=self.cse_id,
                num=num_results,
                searchType='image'  # Image search mode
            ).execute()
            
            return self._parse_image_results(result)
            
        except HttpError as e:
            print(f"    API Error: {e}")
            if e.resp.status == 429:
                print("    Rate limit exceeded. You've hit the 100 queries/day free tier limit.")
            return []
        except Exception as e:
            print(f"    Search error: {e}")
            return []
    
    def _execute_web_search(self, query: str, num_results: int) -> List[Dict]:
        """
        Execute regular Google Web Search API call.
        
        Args:
            query: Search query string
            num_results: Number of results wanted (max 10)
            
        Returns:
            Parsed list of web search results
        """
        try:
            num_results = min(num_results, 10)
            
            result = self.service.cse().list(
                q=query,
                cx=self.cse_id,
                num=num_results
                # No searchType = regular web search
            ).execute()
            
            return self._parse_web_results(result)
            
        except HttpError as e:
            print(f"    API Error: {e}")
            if e.resp.status == 429:
                print("    Rate limit exceeded. You've hit the 100 queries/day free tier limit.")
            return []
        except Exception as e:
            print(f"    Search error: {e}")
            return []
    
    def _parse_image_results(self, api_response: Dict) -> List[Dict]:
        """
        Parse Google Image Search response.
        
        Args:
            api_response: Raw JSON response from Google API
            
        Returns:
            List of dicts with image URLs and source pages
        """
        results = []
        
        if 'items' not in api_response:
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
            List of dicts with URLs and snippets
        """
        results = []
        
        if 'items' not in api_response:
            return results
        
        for item in api_response['items']:
            results.append({
                'url': item.get('link', ''),
                'title': item.get('title', ''),
                'snippet': item.get('snippet', ''),
                'type': 'webpage'
            })
        
        return results


# Example usage
if __name__ == "__main__":
    handler = GoogleSearchHandler()
    
    # Test worksheet image search
    print("=== Searching for Worksheet Images ===")
    worksheet_results = handler.search_worksheets("MLK timeline worksheet grade 5", num_results=5)
    for i, result in enumerate(worksheet_results, 1):
        print(f"{i}. {result['title']}")
        print(f"   Image: {result['image_url']}")
        print(f"   Source: {result['source_url']}\n")
    
    # Test activity web search
    print("\n=== Searching for Activity Pages ===")
    activity_results = handler.search_activities("MLK discussion activity elementary", num_results=5)
    for i, result in enumerate(activity_results, 1):
        print(f"{i}. {result['title']}")
        print(f"   URL: {result['url']}\n")