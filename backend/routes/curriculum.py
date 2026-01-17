"""
Curriculum generation routes with live progress streaming
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
import json
import asyncio
from services.orchestrator import CurriculumOrchestrator
from services.firebase_service import FirebaseService

router = APIRouter()
orchestrator = CurriculumOrchestrator()
firebase = FirebaseService()


class CourseRequest(BaseModel):
    """Request model for course generation"""
    course_name: str
    grade_level: str
    subject: str
    topic: str
    time_duration: str  # e.g., "1 week", "2 hours"
    num_worksheets: int
    num_activities: int
    objectives: Optional[str] = ""
    teacher_id: str  # Firebase user ID


class CurriculumResponse(BaseModel):
    """Response model for generated curriculum"""
    curriculum_id: str
    status: str
    message: str


@router.post("/generate-curriculum")
async def generate_curriculum(request: CourseRequest):
    """
    Generate curriculum with live progress updates via Server-Sent Events
    
    Flow:
    1. Validate request
    2. Run Phase 1 (outliner) - stream progress
    3. Run Phase 2 (populator) - stream progress
    4. Save to Firebase
    5. Return curriculum ID
    """
    
    async def generate():
        """Generator function for SSE streaming"""
        try:
            # Initial status
            yield f"data: {json.dumps({'phase': 0, 'message': 'Starting curriculum generation...', 'progress': 0})}\n\n"
            await asyncio.sleep(0.1)
            
            # Phase 1: Generate outline
            yield f"data: {json.dumps({'phase': 1, 'message': 'Phase 1/2: Generating curriculum structure...', 'progress': 10})}\n\n"
            
            outline_data = await orchestrator.run_phase1({
                'grade_level': request.grade_level,
                'subject': request.subject,
                'topic': request.topic,
                'duration': request.time_duration,
                'num_worksheets': request.num_worksheets,
                'num_activities': request.num_activities,
                'objectives': request.objectives
            })
            
            if not outline_data:
                yield f"data: {json.dumps({'phase': 1, 'message': 'Error: Phase 1 failed', 'progress': 0, 'error': True})}\n\n"
                return
            
            yield f"data: {json.dumps({'phase': 1, 'message': 'Phase 1 complete! Generated curriculum structure', 'progress': 40})}\n\n"
            await asyncio.sleep(0.5)
            
            # Phase 2: Add video resources
            yield f"data: {json.dumps({'phase': 2, 'message': 'Phase 2/2: Finding educational videos...', 'progress': 50})}\n\n"
            
            enriched_data = await orchestrator.run_phase2(outline_data)
            
            if not enriched_data:
                yield f"data: {json.dumps({'phase': 2, 'message': 'Error: Phase 2 failed', 'progress': 40, 'error': True})}\n\n"
                return
            
            yield f"data: {json.dumps({'phase': 2, 'message': 'Phase 2 complete! Added video resources', 'progress': 80})}\n\n"
            await asyncio.sleep(0.5)
            
            # Save to Firebase
            yield f"data: {json.dumps({'phase': 3, 'message': 'Saving curriculum to database...', 'progress': 90})}\n\n"
            
            curriculum_id = await firebase.save_curriculum(
                teacher_id=request.teacher_id,
                curriculum_data={
                    'course_name': request.course_name,
                    'grade_level': request.grade_level,
                    'subject': request.subject,
                    'topic': request.topic,
                    'duration': request.time_duration,
                    'outline': enriched_data
                }
            )
            
            # Complete
            yield f"data: {json.dumps({'phase': 3, 'message': 'Complete! Curriculum generated successfully', 'progress': 100, 'curriculum_id': curriculum_id, 'done': True})}\n\n"
            
        except Exception as e:
            error_msg = f"Error during generation: {str(e)}"
            yield f"data: {json.dumps({'message': error_msg, 'error': True})}\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # Disable nginx buffering
        }
    )


@router.get("/curricula/{curriculum_id}")
async def get_curriculum(curriculum_id: str, teacher_id: str):
    """
    Fetch a saved curriculum by ID
    
    Args:
        curriculum_id: Firestore document ID
        teacher_id: User ID for authorization
    """
    try:
        curriculum = await firebase.get_curriculum(curriculum_id, teacher_id)
        
        if not curriculum:
            raise HTTPException(status_code=404, detail="Curriculum not found")
        
        return curriculum
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/curricula")
async def list_curricula(teacher_id: str):
    """
    List all curricula for a teacher
    
    Args:
        teacher_id: Firebase user ID
    """
    try:
        curricula = await firebase.list_teacher_curricula(teacher_id)
        return {"curricula": curricula}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/curricula/{curriculum_id}")
async def delete_curriculum(curriculum_id: str, teacher_id: str):
    """
    Delete a curriculum
    
    Args:
        curriculum_id: Firestore document ID
        teacher_id: User ID for authorization
    """
    try:
        success = await firebase.delete_curriculum(curriculum_id, teacher_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="Curriculum not found")
        
        return {"message": "Curriculum deleted successfully"}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))