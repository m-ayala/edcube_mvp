"""
Resource generation routes (on-demand Phase 3)
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
from services.orchestrator import CurriculumOrchestrator
from services.firebase_service import FirebaseService

router = APIRouter()
orchestrator = CurriculumOrchestrator()
firebase = FirebaseService()


class ResourceRequest(BaseModel):
    """Request model for generating resources"""
    curriculum_id: str
    teacher_id: str
    section_ids: List[str]  # Which sections to generate resources for
    resource_type: str  # "worksheets" or "activities"


@router.post("/generate-resources")
async def generate_resources(request: ResourceRequest):
    """
    Generate worksheets or activities on-demand for specific sections
    
    This replaces the old batch Phase 3 approach where all resources
    were generated upfront (wasteful). Now teachers select which sections
    need resources and we generate only those.
    
    Args:
        request: Contains curriculum_id, section_ids, and resource_type
        
    Returns:
        Generated resources for the selected sections
    """
    try:
        # Fetch curriculum from Firebase
        curriculum = await firebase.get_curriculum(
            request.curriculum_id, 
            request.teacher_id
        )
        
        if not curriculum:
            raise HTTPException(status_code=404, detail="Curriculum not found")
        
        # Filter sections to process
        sections_to_process = [
            section for section in curriculum['outline']['sections']
            if section.get('id') in request.section_ids
        ]
        
        if not sections_to_process:
            raise HTTPException(status_code=400, detail="No valid sections found")
        
        # Generate resources based on type
        if request.resource_type == "worksheets":
            resources = await orchestrator.generate_worksheets(
                sections=sections_to_process,
                grade_level=curriculum['grade_level']
            )
        elif request.resource_type == "activities":
            resources = await orchestrator.generate_activities(
                sections=sections_to_process,
                grade_level=curriculum['grade_level']
            )
        else:
            raise HTTPException(
                status_code=400, 
                detail="Invalid resource_type. Must be 'worksheets' or 'activities'"
            )
        
        # Update curriculum in Firebase with new resources
        await firebase.add_resources_to_curriculum(
            curriculum_id=request.curriculum_id,
            teacher_id=request.teacher_id,
            section_ids=request.section_ids,
            resources=resources,
            resource_type=request.resource_type
        )
        
        return {
            "message": f"Generated {len(resources)} {request.resource_type}",
            "resources": resources
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/resources/{curriculum_id}")
async def get_curriculum_resources(curriculum_id: str, teacher_id: str):
    """
    Get all generated resources for a curriculum
    
    Args:
        curriculum_id: Firestore document ID
        teacher_id: User ID for authorization
    """
    try:
        curriculum = await firebase.get_curriculum(curriculum_id, teacher_id)
        
        if not curriculum:
            raise HTTPException(status_code=404, detail="Curriculum not found")
        
        # Extract all resources from sections
        all_resources = {
            "worksheets": [],
            "activities": []
        }
        
        for section in curriculum['outline']['sections']:
            if 'worksheets' in section:
                all_resources['worksheets'].extend(section['worksheets'])
            if 'activities' in section:
                all_resources['activities'].extend(section['activities'])
        
        return all_resources
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))