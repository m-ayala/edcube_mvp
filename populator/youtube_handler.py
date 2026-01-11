from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from config import (
    YOUTUBE_API_KEY,
    YOUTUBE_MAX_RESULTS_PER_QUERY
)
import isodate

# Initialize YouTube API client
youtube = build('youtube', 'v3', developerKey=YOUTUBE_API_KEY)


def search_videos(query, max_results=YOUTUBE_MAX_RESULTS_PER_QUERY):
    """
    Search YouTube for videos matching the query
    
    Args:
        query (str): Search query
        max_results (int): Maximum number of results to return
    
    Returns:
        list: List of video IDs
    """
    try:
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
        return video_ids
    
    except HttpError as e:
        print(f"❌ YouTube API Error: {e}")
        return []
    except Exception as e:
        print(f"❌ Error searching videos: {str(e)}")
        return []


def get_video_details(video_ids):
    """
    Get detailed information for a list of video IDs
    
    Args:
        video_ids (list): List of YouTube video IDs
    
    Returns:
        list: List of video detail dictionaries
    """
    if not video_ids:
        return []
    
    try:
        videos_response = youtube.videos().list(
            part='snippet,contentDetails,statistics',
            id=','.join(video_ids)
        ).execute()
        
        videos = []
        for item in videos_response.get('items', []):
            video_data = parse_video_data(item)
            videos.append(video_data)
        
        return videos
    
    except HttpError as e:
        print(f"❌ YouTube API Error: {e}")
        return []
    except Exception as e:
        print(f"❌ Error getting video details: {str(e)}")
        return []


def parse_video_data(item):
    """
    Parse YouTube API response into structured video data
    
    Args:
        item (dict): YouTube API video item
    
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
    duration_formatted = format_duration(duration_seconds)
    
    # Get statistics
    view_count = int(statistics.get('viewCount', 0))
    like_count = int(statistics.get('likeCount', 0))
    
    # Calculate like ratio (likes / views)
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


def format_duration(seconds):
    """
    Convert seconds to MM:SS or HH:MM:SS format
    
    Args:
        seconds (int): Duration in seconds
    
    Returns:
        str: Formatted duration
    """
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60
    
    if hours > 0:
        return f"{hours}:{minutes:02d}:{secs:02d}"
    else:
        return f"{minutes}:{secs:02d}"