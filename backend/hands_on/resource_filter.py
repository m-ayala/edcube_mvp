"""
Resource filtering and ranking for worksheets and activities
Filters based on quality and relevance to learning objectives
"""

import logging
import openai
import json
import os
from typing import List, Dict, Optional

from config import OPENAI_API_KEY
from hands_on.resource_prompts import get_relevance_check_prompt

# Initialize logger
logger = logging.getLogger(__name__)

# Initialize OpenAI
openai.api_key = OPENAI_API_KEY


class ResourceFilter:
    """Filters and ranks worksheets and activities based on quality and relevance."""
    
    def __init__(self, openai_api_key: str = None):
        """
        Initialize the resource filter.
        
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
        logger.info("Initialized ResourceFilter")
    
    def filter_and_rank_worksheets(
        self, 
        worksheets: List[Dict], 
        section_requirements: Dict
    ) -> List[Dict]:
        """
        Filter and rank worksheet images based on visual quality and relevance.
        
        Args:
            worksheets: List of analyzed worksheet images
            section_requirements: Learning objectives and keywords from outline
        
        Returns:
            list: Filtered and ranked worksheets (best first)
        
        Example:
            >>> filter = ResourceFilter()
            >>> worksheets = [{'worksheet_title': 'Math Problems', ...}]
            >>> ranked = filter.filter_and_rank_worksheets(worksheets, requirements)
            >>> len(ranked) <= len(worksheets)
            True
        """
        logger.info(f"Filtering {len(worksheets)} worksheets")
        filtered_worksheets = []
        
        for worksheet in worksheets:
            # Skip if analysis failed
            if not worksheet:
                continue
            
            # Basic quality checks
            if not self._is_quality_worksheet(worksheet):
                logger.debug(f"Skipping low-quality worksheet: {worksheet.get('worksheet_title', 'Unknown')}")
                continue
            
            # Check relevance using LLM
            relevance_data = self._check_relevance(worksheet, section_requirements)
            if not relevance_data:
                continue
            
            # Add relevance scores to worksheet
            worksheet['relevance_data'] = relevance_data
            
            # Only keep suitable worksheets
            if relevance_data.get('is_suitable', False):
                # Calculate overall score
                worksheet['overall_score'] = self._calculate_worksheet_score(worksheet, relevance_data)
                filtered_worksheets.append(worksheet)
            else:
                logger.debug(
                    f"Worksheet not suitable: {worksheet.get('worksheet_title', 'Unknown')} - "
                    f"{relevance_data.get('reasoning', '')}"
                )
        
        # Sort by overall score (highest first)
        filtered_worksheets.sort(key=lambda x: x['overall_score'], reverse=True)
        
        logger.info(f"Filtered to {len(filtered_worksheets)} quality worksheets")
        return filtered_worksheets
    
    def filter_and_rank_activities(
        self, 
        activities: List[Dict], 
        section_requirements: Dict
    ) -> List[Dict]:
        """
        Filter and rank activities based on quality and relevance.
        
        Args:
            activities: List of extracted activities
            section_requirements: Learning objectives and keywords from outline
        
        Returns:
            list: Filtered and ranked activities (best first)
        
        Example:
            >>> filter = ResourceFilter()
            >>> activities = [{'name': 'Science Experiment', ...}]
            >>> ranked = filter.filter_and_rank_activities(activities, requirements)
            >>> len(ranked) <= len(activities)
            True
        """
        logger.info(f"Filtering {len(activities)} activities")
        filtered_activities = []
        
        for activity in activities:
            # Skip if extraction failed
            if not activity:
                continue
            
            # Basic quality checks
            if not self._is_quality_activity(activity):
                logger.debug(f"Skipping low-quality activity: {activity.get('name', 'Unknown')}")
                continue
            
            # Check relevance using LLM
            relevance_data = self._check_relevance(activity, section_requirements)
            if not relevance_data:
                continue
            
            # Add relevance scores to activity
            activity['relevance_data'] = relevance_data
            
            # Only keep suitable activities - LENIENT FILTERING
            is_lenient_suitable = (
                relevance_data.get('is_suitable', False) or
                relevance_data.get('coverage_percentage', 0) >= 40 or
                relevance_data.get('quality_score', 0) >= 6
            )
            
            if is_lenient_suitable:
                # Calculate overall score
                activity['overall_score'] = self._calculate_activity_score(activity, relevance_data)
                filtered_activities.append(activity)
            else:
                logger.debug(
                    f"Activity not suitable: {activity.get('name', 'Unknown')} - "
                    f"{relevance_data.get('reasoning', '')}"
                )
        
        # FALLBACK: If NO activities passed, take top 3 by quality anyway
        if len(filtered_activities) == 0 and len(activities) > 0:
            logger.warning("No activities met strict criteria - showing top 3 by description quality")
            # Sort by having good description and steps
            quality_sorted = sorted(
                [a for a in activities if a and a.get('name') and a.get('description')],
                key=lambda x: len(x.get('steps', [])) + (10 if x.get('materials') else 0),
                reverse=True
            )
            for act in quality_sorted[:3]:
                act['overall_score'] = 7.0  # Default score
                filtered_activities.append(act)
        
        # Sort by overall score (highest first)
        filtered_activities.sort(key=lambda x: x.get('overall_score', 0), reverse=True)
        
        logger.info(f"Filtered to {len(filtered_activities)} quality activities")
        return filtered_activities
    
    def _is_quality_worksheet(self, worksheet: Dict) -> bool:
        """
        Check if worksheet meets minimum quality standards.
        
        Args:
            worksheet: Analyzed worksheet data
        
        Returns:
            bool: True if meets quality standards
        """
        # Must be age-appropriate
        if not worksheet.get('is_age_appropriate', False):
            return False
        
        # Must have reasonable visual quality (at least 5/10)
        if worksheet.get('visual_quality', 0) < 5:
            return False
        
        # Must have reasonable educational value (at least 5/10)
        if worksheet.get('educational_value', 0) < 5:
            return False
        
        # Must have topics covered
        if not worksheet.get('topics_covered'):
            return False
        
        return True
    
    def _is_quality_activity(self, activity: Dict) -> bool:
        """
        Check if activity meets minimum quality standards.
        
        Args:
            activity: Extracted activity data
        
        Returns:
            bool: True if meets quality standards
        """
        # Must have a name
        if not activity.get('name'):
            return False
        
        # Must have description
        if not activity.get('description'):
            return False
        
        # Must have either steps or materials
        if not activity.get('steps') and not activity.get('materials'):
            return False
        
        return True
    
    def _check_relevance(self, resource: Dict, section_requirements: Dict) -> Optional[Dict]:
        """
        Use LLM to check if resource matches section requirements.
        
        Args:
            resource: Extracted resource data
            section_requirements: Learning objectives from outline
        
        Returns:
            dict: Relevance evaluation data, or None if check fails
        """
        try:
            prompt = get_relevance_check_prompt(resource, section_requirements)
            
            response = openai.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert at evaluating educational resources for elementary students. Always return valid JSON."
                    },
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=500
            )
            
            # Extract and parse response
            response_text = response.choices[0].message.content.strip()
            
            # Remove markdown code blocks if present
            if response_text.startswith("```json"):
                response_text = response_text.replace("```json", "").replace("```", "").strip()
            elif response_text.startswith("```"):
                response_text = response_text.replace("```", "").strip()
            
            relevance_data = json.loads(response_text)
            return relevance_data
        
        except Exception as e:
            logger.error(f"Error checking relevance: {e}")
            return None
    
    def _calculate_worksheet_score(self, worksheet: Dict, relevance_data: Dict) -> float:
        """
        Calculate overall score for ranking worksheet images.
        
        Args:
            worksheet: Analyzed worksheet data
            relevance_data: Relevance evaluation from LLM
        
        Returns:
            float: Overall score (0-100)
        """
        # Visual quality score
        visual_score = worksheet.get('visual_quality', 5) * 10  # Convert 0-10 to 0-100
        
        # Educational value score
        educational_score = worksheet.get('educational_value', 5) * 10
        
        # Coverage score from relevance check
        coverage_score = relevance_data.get('coverage_percentage', 50)
        
        # LLM quality rating
        llm_quality = relevance_data.get('quality_score', 5) * 10
        
        # Weighted average - visual quality matters for worksheets!
        overall_score = (
            visual_score * 0.25 +           # 25% visual appeal
            educational_score * 0.25 +      # 25% educational value
            coverage_score * 0.30 +         # 30% topic coverage
            llm_quality * 0.20              # 20% LLM assessment
        )
        
        # Bonus for exact grade match
        if relevance_data.get('matches_grade', False):
            overall_score += 5
        
        # Bonus for exact topic match
        if relevance_data.get('matches_topic', False):
            overall_score += 5
        
        # Bonus for having visual elements (images/art)
        if worksheet.get('has_images_or_art', False):
            overall_score += 5
        
        return min(overall_score, 100)  # Cap at 100
    
    def _calculate_activity_score(self, activity: Dict, relevance_data: Dict) -> float:
        """
        Calculate overall score for an activity.
        
        Args:
            activity: Activity data
            relevance_data: Relevance evaluation from LLM
        
        Returns:
            float: Overall score (0-10)
        """
        # Relevance factors (70% of score)
        coverage = relevance_data.get('coverage_percentage', 50) / 10  # Scale to 0-10
        quality = relevance_data.get('quality_score', 5)
        relevance_score = (coverage * 0.5 + quality * 0.5) * 0.7
        
        # Content quality factors (30% of score)
        has_steps = 2.0 if activity.get('steps') else 0
        has_materials = 1.0 if activity.get('materials') else 0
        has_duration = 0.5 if activity.get('duration') else 0
        has_objectives = 0.5 if activity.get('learning_objectives') else 0
        
        content_score = (has_steps + has_materials + has_duration + has_objectives) * 0.75
        
        overall = relevance_score + content_score
        
        return min(overall, 10.0)  # Cap at 10