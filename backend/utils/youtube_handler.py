"""
YouTube API handler for video search and metadata retrieval
"""

import logging
import isodate
from typing import List, Dict, Optional
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from config import YOUTUBE_API_KEY, PopulatorConfig

# Initialize logger
logger = logging.getLogger(__name__)

# Initialize YouTube API client
youtube = build('youtube', 'v3', developerKey=YOUTUBE_API_KEY)


def search_videos(
    query: str,
    max_results: int = PopulatorConfig.YOUTUBE_MAX_RESULTS_PER_QUERY
) -> List[str]:
    """
    Search YouTube for videos matching the query.
    
    Args:
        query: Search query string
        max_results: Maximum number of results to return
    
    Returns:
        list: List of video IDs
    
    Example:
        >>> video_ids = search_videos("photosynthesis elementary")
        >>> len(video_ids)
        5
    """
    try:
        logger.info(f"Searching YouTube for: '{query}' (max_results={max_results})")
        
        search_response = youtube.search().list(
            q=query,
            part='id',
            type='video',
            maxResults=max_results,
            videoCategoryId='27',  # Education category
            safeSearch='strict',
            relevanceLanguage='en',
            order='relevance'
        ).execute()
        
        video_ids = [item['id']['videoId'] for item in search_response.get('items', [])]
        logger.info(f"Found {len(video_ids)} videos for query: '{query}'")
        
        return video_ids
    
    except HttpError as e:
        logger.error(f"YouTube API HTTP Error: {e}")
        if e.resp.status == 429:
            logger.error("Rate limit exceeded - YouTube API quota exhausted")
        return []
    
    except Exception as e:
        logger.error(f"Error searching YouTube videos: {e}")
        return []


def get_video_details(video_ids: List[str]) -> List[Dict]:
    """
    Get detailed information for a list of video IDs.
    
    Args:
        video_ids: List of YouTube video IDs
    
    Returns:
        list: List of video detail dictionaries containing:
            - video_id, title, channel_name, duration_seconds
            - view_count, like_count, like_ratio
            - thumbnail_url, video_url, description
    
    Example:
        >>> videos = get_video_details(['abc123', 'def456'])
        >>> videos[0]['title']
        'Introduction to Photosynthesis'
    """
    if not video_ids:
        logger.warning("No video IDs provided to get_video_details")
        return []
    
    try:
        logger.info(f"Fetching details for {len(video_ids)} videos")
        
        videos_response = youtube.videos().list(
            part='snippet,contentDetails,statistics',
            id=','.join(video_ids)
        ).execute()
        
        videos = []
        for item in videos_response.get('items', []):
            video_data = _parse_video_data(item)
            videos.append(video_data)
        
        logger.info(f"Successfully retrieved details for {len(videos)} videos")
        return videos
    
    except HttpError as e:
        logger.error(f"YouTube API HTTP Error: {e}")
        return []
    
    except Exception as e:
        logger.error(f"Error getting video details: {e}")
        return []


def _parse_video_data(item: Dict) -> Dict:
    """
    Parse YouTube API response into structured video data.
    
    Args:
        item: YouTube API video item
    
    Returns:
        dict: Structured video data
    """
    video_id = item['id']
    snippet = item['snippet']
    content_details = item['contentDetails']
    statistics = item.get('statistics', {})
    
    # Parse duration (ISO 8601 format like PT15M33S)
    duration_iso = content_details.get('duration', 'PT0S')
    duration_seconds = int(isodate.parse_duration(duration_iso).total_seconds())
    duration_formatted = _format_duration(duration_seconds)
    
    # Get statistics
    view_count = int(statistics.get('viewCount', 0))
    like_count = int(statistics.get('likeCount', 0))
    
    # Calculate like ratio
    like_ratio = (like_count / view_count) if view_count > 0 else 0
    
    # Check if channel is verified
    channel_verified = snippet.get('channelTitle', '').endswith('✓') or 'customUrl' in snippet
    
    video_data = {
        'video_id': video_id,
        'title': snippet.get('title', ''),
        'channel_name': snippet.get('channelTitle', ''),
        'channel_id': snippet.get('channelId', ''),
        'channel_verified': channel_verified,
        'duration_seconds': duration_seconds,
        'duration_formatted': duration_formatted,
        'view_count': view_count,
        'like_count': like_count,
        'like_ratio': round(like_ratio, 4),
        'thumbnail_url': snippet.get('thumbnails', {}).get('high', {}).get('url', ''),
        'video_url': f"https://www.youtube.com/watch?v={video_id}",
        'description': snippet.get('description', '')[:500],  # First 500 chars
        'category_id': snippet.get('categoryId', '')
    }
    
    return video_data


def _format_duration(seconds: int) -> str:
    """
    Convert seconds to MM:SS or HH:MM:SS format.
    
    Args:
        seconds: Duration in seconds
    
    Returns:
        str: Formatted duration string
    
    Example:
        >>> _format_duration(125)
        '2:05'
        >>> _format_duration(3665)
        '1:01:05'
    """
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60
    
    if hours > 0:
        return f"{hours}:{minutes:02d}:{secs:02d}"
    else:
        return f"{minutes}:{secs:02d}"