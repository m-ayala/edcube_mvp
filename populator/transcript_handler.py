"""
Handles YouTube video transcript retrieval and analysis
"""

from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import TranscriptsDisabled, NoTranscriptFound


def get_transcript(video_id):
    """
    Get transcript for a YouTube video
    
    Args:
        video_id (str): YouTube video ID
    
    Returns:
        list: Transcript entries [{'text': '...', 'start': 0.0, 'duration': 2.5}, ...]
        None: If transcript not available
    """
    try:
        transcript = YouTubeTranscriptApi.get_transcript(video_id)
        return transcript
    except (TranscriptsDisabled, NoTranscriptFound):
        return None
    except Exception as e:
        print(f"   ⚠️  Error getting transcript for {video_id}: {str(e)}")
        return None


def extract_transcript_text(transcript):
    """
    Extract full text from transcript entries
    
    Args:
        transcript (list): Transcript entries from get_transcript()
    
    Returns:
        str: Full transcript text
    """
    if not transcript:
        return ""
    
    return " ".join([entry['text'] for entry in transcript])


def calculate_wpm(transcript, duration_seconds):
    """
    Calculate words per minute from transcript
    
    Args:
        transcript (list): Transcript entries
        duration_seconds (int): Video duration in seconds
    
    Returns:
        float: Words per minute, or None if transcript unavailable
    """
    if not transcript or duration_seconds == 0:
        return None
    
    text = extract_transcript_text(transcript)
    word_count = len(text.split())
    duration_minutes = duration_seconds / 60
    
    wpm = word_count / duration_minutes
    return round(wpm, 1)


def get_transcript_summary(transcript, max_chars=1000):
    """
    Get a truncated version of transcript for LLM analysis
    (to save tokens)
    
    Args:
        transcript (list): Transcript entries
        max_chars (int): Maximum characters to return
    
    Returns:
        str: Truncated transcript text
    """
    if not transcript:
        return ""
    
    full_text = extract_transcript_text(transcript)
    
    if len(full_text) <= max_chars:
        return full_text
    
    # Return first max_chars with ellipsis
    return full_text[:max_chars] + "..."