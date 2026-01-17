"""
Analyzes video content using transcripts and LLM
Determines what topics are covered and how well they match section requirements
"""

import logging
from typing import Dict, List
from utils.llm_handler import call_openai

# Initialize logger
logger = logging.getLogger(__name__)


def analyze_video_content(
    transcript_text: str,
    video_metadata: Dict,
    section_requirements: Dict
) -> Dict:
    """
    Use LLM to analyze what topics a video covers.
    
    Args:
        transcript_text: Full or truncated transcript text
        video_metadata: Video title, description, etc.
        section_requirements: Section data with objectives and keywords
    
    Returns:
        dict: Analysis results with topics_covered, main_focus, content_depth
    
    Example:
        >>> analysis = analyze_video_content(
        ...     transcript_text="Photosynthesis is the process...",
        ...     video_metadata={'title': 'Intro to Photosynthesis'},
        ...     section_requirements={'title': 'Plant Biology'}
        ... )
        >>> 'photosynthesis' in analysis['topics_covered']
        True
    """
    if not transcript_text:
        # Fallback to title/description analysis if no transcript
        logger.warning("No transcript available, analyzing from metadata only")
        return _analyze_from_metadata(video_metadata, section_requirements)
    
    # Truncate transcript for token efficiency (use first 2000 chars)
    transcript_sample = transcript_text[:2000] if len(transcript_text) > 2000 else transcript_text
    
    prompt = f"""
Analyze this educational video to determine what topics and concepts it covers.

VIDEO TITLE: {video_metadata.get('title', 'N/A')}
VIDEO DESCRIPTION: {video_metadata.get('description', 'N/A')[:300]}

TRANSCRIPT SAMPLE:
{transcript_sample}

Extract and list:
1. Main topics/concepts covered in the video
2. The primary focus of the video
3. Depth level of coverage (surface/moderate/deep)

Output as JSON:
{{
  "topics_covered": ["topic1", "topic2", "topic3"],
  "main_focus": "primary subject of the video",
  "content_depth": "surface|moderate|deep"
}}

Generate the analysis now as valid JSON only.
"""
    
    system_message = "You are an expert at analyzing educational video content. You extract key topics and assess content depth accurately."
    
    try:
        logger.info(f"Analyzing video content: {video_metadata.get('title', 'Unknown')[:50]}")
        analysis = call_openai(prompt, system_message)
        return analysis
    
    except Exception as e:
        logger.error(f"Error analyzing video content: {e}")
        return {
            "topics_covered": [],
            "main_focus": "unknown",
            "content_depth": "unknown"
        }


def _analyze_from_metadata(video_metadata: Dict, section_requirements: Dict) -> Dict:
    """
    Fallback analysis using only title and description (when no transcript).
    
    Args:
        video_metadata: Video title, description
        section_requirements: Section data
    
    Returns:
        dict: Basic analysis from metadata
    """
    prompt = f"""
Based only on the video title and description, infer what topics this video likely covers.

VIDEO TITLE: {video_metadata.get('title', 'N/A')}
VIDEO DESCRIPTION: {video_metadata.get('description', 'N/A')[:500]}

Output as JSON:
{{
  "topics_covered": ["topic1", "topic2"],
  "main_focus": "inferred primary subject",
  "content_depth": "surface|moderate|deep"
}}
"""
    
    system_message = "You are an expert at inferring video content from titles and descriptions."
    
    try:
        logger.info("Analyzing video from metadata only (no transcript)")
        analysis = call_openai(prompt, system_message)
        return analysis
    
    except Exception as e:
        logger.error(f"Error analyzing from metadata: {e}")
        return {
            "topics_covered": [],
            "main_focus": "unknown",
            "content_depth": "unknown"
        }


def calculate_content_coverage(video_analysis: Dict, section_requirements: Dict) -> Dict:
    """
    Calculate how well video content matches section requirements.
    
    Args:
        video_analysis: Result from analyze_video_content()
        section_requirements: Section with learning objectives and keywords
    
    Returns:
        dict: Coverage analysis with percentage, matched topics, missing topics
    
    Example:
        >>> coverage = calculate_content_coverage(
        ...     video_analysis={'topics_covered': ['photosynthesis', 'chloroplast']},
        ...     section_requirements={'learning_objectives': ['Understand photosynthesis']}
        ... )
        >>> coverage['coverage_percentage'] > 0
        True
    """
    # Extract requirements from section
    instruction = section_requirements.get('components', {}).get('instruction', {})
    required_objectives = instruction.get('learning_objectives', [])
    required_keywords = instruction.get('content_keywords', [])
    what_must_be_covered = instruction.get('what_must_be_covered', '')
    
    video_topics = video_analysis.get('topics_covered', [])
    
    # Use LLM to semantically compare
    prompt = f"""
Determine how well this video covers the required learning content.

REQUIRED LEARNING OBJECTIVES:
{required_objectives}

REQUIRED CONTENT KEYWORDS:
{required_keywords}

WHAT MUST BE COVERED:
{what_must_be_covered}

VIDEO ACTUALLY COVERS:
{video_topics}

Analyze the match and output as JSON:
{{
  "coverage_percentage": 0-100,
  "matched_objectives": ["objective1", "objective2"],
  "missing_content": ["missing1", "missing2"],
  "extra_content": ["extra1", "extra2"],
  "assessment": "string - brief explanation of coverage quality"
}}
"""
    
    system_message = "You are an expert at assessing educational content alignment. You determine if learning materials match intended objectives."
    
    try:
        logger.info("Calculating content coverage for video")
        coverage = call_openai(prompt, system_message)
        logger.info(f"Coverage calculated: {coverage.get('coverage_percentage', 0)}%")
        return coverage
    
    except Exception as e:
        logger.error(f"Error calculating coverage: {e}")
        return {
            "coverage_percentage": 50,
            "matched_objectives": [],
            "missing_content": [],
            "extra_content": [],
            "assessment": "Unable to assess"
        }


def detect_redundancy(new_video_topics: List[str], existing_videos_data: List[Dict]) -> Dict:
    """
    Check if new video is redundant with already-selected videos.
    
    Args:
        new_video_topics: Topics covered by new video
        existing_videos_data: Already selected videos with their topics
    
    Returns:
        dict: Redundancy analysis with percentage and unique content
    
    Example:
        >>> redundancy = detect_redundancy(
        ...     new_video_topics=['photosynthesis'],
        ...     existing_videos_data=[{'topics_covered': ['respiration']}]
        ... )
        >>> redundancy['redundancy_percentage'] < 50
        True
    """
    if not existing_videos_data:
        logger.debug("No existing videos, zero redundancy")
        return {
            "redundancy_percentage": 0,
            "unique_new_content": new_video_topics,
            "overlapping_topics": []
        }
    
    # Collect all topics from existing videos
    all_existing_topics = []
    for video in existing_videos_data:
        all_existing_topics.extend(video.get('topics_covered', []))
    
    # Use LLM for semantic comparison
    prompt = f"""
Compare the topics covered by a new video against topics already covered by existing videos.

NEW VIDEO COVERS:
{new_video_topics}

EXISTING VIDEOS ALREADY COVER:
{all_existing_topics}

Determine overlap and unique content. Output as JSON:
{{
  "redundancy_percentage": 0-100,
  "unique_new_content": ["unique topic1", "unique topic2"],
  "overlapping_topics": ["overlap1", "overlap2"]
}}
"""
    
    system_message = "You are an expert at comparing educational content for redundancy. You identify overlaps and unique contributions."
    
    try:
        logger.info("Detecting content redundancy")
        redundancy = call_openai(prompt, system_message)
        logger.info(f"Redundancy detected: {redundancy.get('redundancy_percentage', 0)}%")
        return redundancy
    
    except Exception as e:
        logger.error(f"Error detecting redundancy: {e}")
        # Default to low redundancy if analysis fails
        return {
            "redundancy_percentage": 20,
            "unique_new_content": new_video_topics,
            "overlapping_topics": []
        }