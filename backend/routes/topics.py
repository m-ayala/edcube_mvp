"""
Topic/Section routes for on-demand population (Phase 2)
"""

import logging
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
import json
import asyncio

from services.orchestrator import CurriculumOrchestrator
from services.firebase_service import FirebaseService

# Initialize logger
logger = logging.getLogger(__name__)

router = APIRouter()
orchestrator = CurriculumOrchestrator()
firebase = FirebaseService()


class PopulateSectionRequest(BaseModel):
    """Request model for populating a section with videos (Phase 2)"""
    curriculum_id: str
    section_id: str
    section: dict  # The box data (title, learning objectives, etc.)
    grade_level: str
    teacher_comments: Optional[str] = ""


@router.post("/populate-section")
async def populate_section(request: PopulateSectionRequest):
    """
    Populate a single section with video resources (Phase 2 on-demand).
    
    Called when teacher drags a box into the course outline.
    Runs Phase 2 for JUST this section and returns the populated section.
    
    Args:
        request: Section data from the dragged box
    
    Returns:
        StreamingResponse: Progress updates via SSE, final populated section
    """
    
    async def generate():
        """Generator function for SSE streaming"""
        try:
            logger.info(f"Populating section: {request.section.get('title', 'Unknown')}")
            
            # Initial status
            yield f"data: {json.dumps({'message': 'Finding educational videos...', 'progress': 0})}\n\n"
            await asyncio.sleep(0.1)
            
            # Run Phase 2 for this section only
            yield f"data: {json.dumps({'message': 'Searching YouTube...', 'progress': 20})}\n\n"
            
            populated_section = await orchestrator.populate_single_section(
                section=request.section,
                grade_level=request.grade_level,
                teacher_comments=request.teacher_comments
            )
            
            if not populated_section:
                yield f"data: {json.dumps({'message': 'Error: Could not find suitable videos', 'progress': 0, 'error': True})}\n\n"
                return
            
            yield f"data: {json.dumps({'message': 'Analyzing video content...', 'progress': 60})}\n\n"
            await asyncio.sleep(0.3)
            
            # Update Firebase with populated section
            yield f"data: {json.dumps({'message': 'Saving videos...', 'progress': 90})}\n\n"
            
            await firebase.update_section(
                curriculum_id=request.curriculum_id,
                section_id=request.section_id,
                section_data=populated_section
            )
            
            # Complete - send the populated section
            video_count = len(populated_section.get('video_resources', []))
            yield f"data: {json.dumps({'message': f'Complete! Found {video_count} videos', 'progress': 100, 'section': populated_section, 'done': True})}\n\n"

        except Exception as e:
            error_msg = f"Error populating section: {str(e)}"
            logger.error(error_msg, exc_info=True)
            yield f"data: {json.dumps({'message': error_msg, 'error': True})}\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@router.get("/section/{curriculum_id}/{section_id}")
async def get_section(curriculum_id: str, section_id: str, teacher_id: str):
    """
    Get a specific section's data (for viewing populated content).
    
    Called when teacher clicks on a populated box to view details.
    
    Args:
        curriculum_id: Firestore document ID
        section_id: Section ID within the curriculum
        teacher_id: User ID for authorization
    
    Returns:
        dict: Section data with video resources
    """
    try:
        section = await firebase.get_section(curriculum_id, section_id, teacher_id)
        
        if not section:
            raise HTTPException(status_code=404, detail="Section not found")
        
        return section
    
    except Exception as e:
        logger.error(f"Error fetching section: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))