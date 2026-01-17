"""
Resource generation routes (on-demand Phase 3)
"""

import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional

from services.orchestrator import CurriculumOrchestrator
from services.firebase_service import FirebaseService

# Initialize logger
logger = logging.getLogger(__name__)

router = APIRouter()
orchestrator = CurriculumOrchestrator()
firebase = FirebaseService()


# ============================================================================
# NEW ENDPOINT FOR COURSEWORKSPACE
# ============================================================================

class GenerateResourceRequest(BaseModel):
    """Request model for generating a single resource for a topic"""
    topicId: str
    resourceType: str  # 'worksheet' or 'activity'
    gradeLevel: str
    topicTitle: Optional[str] = ""
    topicDescription: Optional[str] = ""
    learningObjectives: Optional[list] = []


@router.post("/generate-resource")
async def generate_resource(request: GenerateResourceRequest):
    """
    Generate a single worksheet or activity for a topic (Phase 3 on-demand).
    
    Called when teacher clicks "+ Worksheet" or "+ Activity" button in CourseWorkspace.
    
    Args:
        request: Topic data and resource type from frontend
    
    Returns:
        dict: Generated resource (worksheet or activity)
    """
    try:
        logger.info(f"Generating {request.resourceType} for topic: {request.topicId}")
        
        # Validate resource type
        if request.resourceType not in ['worksheet', 'activity']:
            raise HTTPException(
                status_code=400,
                detail="resourceType must be 'worksheet' or 'activity'"
            )
        
        # Convert frontend topic to backend section format
        section = {
            'id': request.topicId,
            'title': request.topicTitle or 'Untitled Topic',
            'description': request.topicDescription or '',
            'learning_objectives': request.learningObjectives or [],
            'content_keywords': []  # Could extract from description if needed
        }
        
        # For now, use a default user prompt
        # TODO: In future, show prompt suggestions to teacher first
        default_prompts = {
            'worksheet': f"{request.topicTitle} practice worksheet",
            'activity': f"{request.topicTitle} hands-on activity"
        }
        user_prompt = default_prompts[request.resourceType]
        
        # Generate the resource
        if request.resourceType == 'worksheet':
            enriched_section = await orchestrator.generate_worksheets(
                section=section,
                grade_level=request.gradeLevel,
                user_prompt=user_prompt,
                num_options=1  # Just generate 1 for now
            )
            
            worksheets = enriched_section.get('worksheet_options', [])
            if not worksheets:
                raise HTTPException(status_code=500, detail="No worksheets generated")
            
            worksheet = worksheets[0]
            return {
                'type': 'worksheet',
                'title': worksheet.get('worksheet_title', 'Generated Worksheet'),
                'imageUrl': worksheet.get('image_url', ''),
                'sourceUrl': worksheet.get('source_url', ''),
                'topicsCovered': worksheet.get('topics_covered', []),
                'gradeLevel': worksheet.get('grade_level', request.gradeLevel),
                'visualQuality': worksheet.get('visual_quality', 0),
                'educationalValue': worksheet.get('educational_value', 0)
            }
        
        else:  # activity
            enriched_section = await orchestrator.generate_activities(
                section=section,
                grade_level=request.gradeLevel,
                user_prompt=user_prompt,
                num_options=1  # Just generate 1 for now
            )
            
            activities = enriched_section.get('activity_options', [])
            if not activities:
                raise HTTPException(status_code=500, detail="No activities generated")
            
            activity = activities[0]
            return {
                'type': 'activity',
                'title': activity.get('name', 'Generated Activity'),
                'description': activity.get('description', ''),
                'activityType': activity.get('type', 'hands-on'),
                'materials': activity.get('materials', []),
                'steps': activity.get('steps', []),
                'duration': activity.get('duration', ''),
                'learningObjectives': activity.get('learning_objectives', [])
            }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating resource: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# EXISTING ENDPOINTS (keep these)
# ============================================================================

class WorksheetPromptRequest(BaseModel):
    """Request model for getting worksheet prompts"""
    section: dict
    grade_level: str


class ActivityPromptRequest(BaseModel):
    """Request model for getting activity prompts"""
    section: dict
    grade_level: str


class WorksheetGenerationRequest(BaseModel):
    """Request model for generating worksheets"""
    section: dict
    grade_level: str
    user_prompt: str
    num_options: Optional[int] = 3


class ActivityGenerationRequest(BaseModel):
    """Request model for generating activities"""
    section: dict
    grade_level: str
    user_prompt: str
    num_options: Optional[int] = 3


@router.post("/worksheet-prompts")
async def get_worksheet_prompts(request: WorksheetPromptRequest):
    """
    Get worksheet type suggestions for a section.
    
    Returns suggested worksheet types that teachers can select from.
    """
    try:
        prompts = await orchestrator.get_worksheet_prompts(
            section=request.section,
            grade_level=request.grade_level
        )
        
        return {
            "prompts": prompts
        }
    
    except Exception as e:
        logger.error(f"Error getting worksheet prompts: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/activity-prompts")
async def get_activity_prompts(request: ActivityPromptRequest):
    """
    Get activity type suggestions for a section.
    
    Returns suggested activity types that teachers can select from.
    """
    try:
        prompts = await orchestrator.get_activity_prompts(
            section=request.section,
            grade_level=request.grade_level
        )
        
        return {
            "prompts": prompts
        }
    
    except Exception as e:
        logger.error(f"Error getting activity prompts: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate-worksheets")
async def generate_worksheets(request: WorksheetGenerationRequest):
    """
    Generate worksheet options for a section based on user's selected prompt.
    
    Returns 3-5 curated worksheet options for teacher to choose from.
    """
    try:
        enriched_section = await orchestrator.generate_worksheets(
            section=request.section,
            grade_level=request.grade_level,
            user_prompt=request.user_prompt,
            num_options=request.num_options
        )
        
        worksheets = enriched_section.get('worksheet_options', [])
        
        return {
            "message": f"Generated {len(worksheets)} worksheet options",
            "worksheets": worksheets,
            "section": enriched_section
        }
    
    except Exception as e:
        logger.error(f"Error generating worksheets: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate-activities")
async def generate_activities(request: ActivityGenerationRequest):
    """
    Generate activity options for a section based on user's selected prompt.
    
    Returns 3-5 curated activity options for teacher to choose from.
    """
    try:
        enriched_section = await orchestrator.generate_activities(
            section=request.section,
            grade_level=request.grade_level,
            user_prompt=request.user_prompt,
            num_options=request.num_options
        )
        
        activities = enriched_section.get('activity_options', [])
        
        return {
            "message": f"Generated {len(activities)} activity options",
            "activities": activities,
            "section": enriched_section
        }
    
    except Exception as e:
        logger.error(f"Error generating activities: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))