"""
YouTube video transcript retrieval and analysis
"""

import logging
from typing import List, Dict, Optional
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import TranscriptsDisabled, NoTranscriptFound

# Initialize logger
logger = logging.getLogger(__name__)


def get_transcript(video_id: str) -> Optional[List[Dict]]:
    """
    Get transcript for a YouTube video.
    
    Args:
        video_id: YouTube video ID
    
    Returns:
        list: Transcript entries with format:
            [{'text': '...', 'start': 0.0, 'duration': 2.5}, ...]
        None: If transcript not available
    
    Example:
        >>> transcript = get_transcript('abc123')
        >>> transcript[0]['text']
        'Hello and welcome to this video'
    """
    try:
        transcript = YouTubeTranscriptApi.get_transcript(video_id)
        logger.info(f"Successfully retrieved transcript for video: {video_id}")
        return transcript
    
    except (TranscriptsDisabled, NoTranscriptFound):
        logger.warning(f"No transcript available for video: {video_id}")
        return None
    
    except Exception as e:
        logger.error(f"Error getting transcript for {video_id}: {e}")
        return None


def extract_transcript_text(transcript: List[Dict]) -> str:
    """
    Extract full text from transcript entries.
    
    Args:
        transcript: Transcript entries from get_transcript()
    
    Returns:
        str: Full transcript text as single string
    
    Example:
        >>> transcript = [{'text': 'Hello'}, {'text': 'World'}]
        >>> extract_transcript_text(transcript)
        'Hello World'
    """
    if not transcript:
        return ""
    
    text = " ".join([entry['text'] for entry in transcript])
    logger.debug(f"Extracted {len(text)} characters from transcript")
    
    return text


def calculate_wpm(transcript: List[Dict], duration_seconds: int) -> Optional[float]:
    """
    Calculate words per minute from transcript.
    
    Args:
        transcript: Transcript entries
        duration_seconds: Video duration in seconds
    
    Returns:
        float: Words per minute, or None if transcript unavailable
    
    Example:
        >>> transcript = [{'text': 'one two three four five'}]
        >>> calculate_wpm(transcript, 60)
        5.0
    """
    if not transcript or duration_seconds == 0:
        return None
    
    text = extract_transcript_text(transcript)
    word_count = len(text.split())
    duration_minutes = duration_seconds / 60
    
    wpm = word_count / duration_minutes
    logger.debug(f"Calculated WPM: {wpm:.1f} ({word_count} words / {duration_minutes:.1f} min)")
    
    return round(wpm, 1)


def get_transcript_summary(transcript: List[Dict], max_chars: int = 1000) -> str:
    """
    Get a truncated version of transcript for LLM analysis (to save tokens).
    
    Args:
        transcript: Transcript entries
        max_chars: Maximum characters to return
    
    Returns:
        str: Truncated transcript text
    
    Example:
        >>> transcript = [{'text': 'a' * 2000}]
        >>> summary = get_transcript_summary(transcript, max_chars=100)
        >>> len(summary) <= 104  # 100 + "..."
        True
    """
    if not transcript:
        return ""
    
    full_text = extract_transcript_text(transcript)
    
    if len(full_text) <= max_chars:
        return full_text
    
    # Return first max_chars with ellipsis
    truncated = full_text[:max_chars] + "..."
    logger.debug(f"Truncated transcript from {len(full_text)} to {len(truncated)} chars")
    
    return truncated