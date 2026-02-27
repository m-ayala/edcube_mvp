# FILE 1: backend/routes/curriculum.py

"""
Curriculum generation routes - PHASE 1 ONLY
Generates boxes/topics without any video or worksheet population
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
import json
import asyncio
import logging
from services.orchestrator import CurriculumOrchestrator
from services.firebase_service import FirebaseService
from schemas.generation_schema import GenerateRequest, GenerateResponse
from services.generation_service import GenerationService

generation_service = GenerationService()
router = APIRouter()
orchestrator = CurriculumOrchestrator()
firebase = FirebaseService()
logger = logging.getLogger(__name__)


class CourseRequest(BaseModel):
    """Request model for course generation"""
    course_name: str
    grade_level: str
    subject: str
    topic: str
    time_duration: str
    num_worksheets: int
    num_activities: int
    objectives: Optional[str] = ""
    teacherUid: str
    organizationId: str


@router.post("/generate-curriculum")
async def generate_curriculum(request: CourseRequest):
    """
    PHASE 1 ONLY: Generate curriculum boxes/topics
    
    This endpoint ONLY generates boxes. It does NOT:
    - Generate videos (Phase 2)
    - Generate worksheets/activities (Phase 3)
    
    Flow:
    1. Validate request
    2. Run Phase 1 (outliner) - generate boxes
    3. Save boxes to Firebase
    4. Return curriculum ID and boxes
    """
    
    async def generate():
        """Generator function for SSE streaming"""
        try:
            # Initial status
            yield f"data: {json.dumps({'phase': 0, 'message': 'Starting box generation...', 'progress': 0})}\n\n"
            await asyncio.sleep(0.1)
            
            # Phase 1: Generate boxes ONLY
            yield f"data: {json.dumps({'phase': 1, 'message': 'Generating curriculum boxes...', 'progress': 10})}\n\n"
            
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
                yield f"data: {json.dumps({'phase': 1, 'message': 'Error: Failed to generate boxes', 'progress': 0, 'error': True})}\n\n"
                return
            
            yield f"data: {json.dumps({'phase': 1, 'message': 'Boxes generated successfully!', 'progress': 80})}\n\n"
            await asyncio.sleep(0.5)
            
            # Save to Firebase (just the boxes, NO VIDEOS)
            yield f"data: {json.dumps({'phase': 1, 'message': 'Saving curriculum...', 'progress': 90})}\n\n"
            
            curriculum_id = await firebase.save_curriculum(
                teacherUid=request.teacherUid,
                curriculum_data={
                    'course_name': request.course_name,
                    'grade_level': request.grade_level,
                    'subject': request.subject,
                    'topic': request.topic,
                    'duration': request.time_duration,
                    'outline': outline_data,
                    'sections': outline_data.get('sections', [])
                },
                organizationId=request.organizationId
            )
            
            # Complete
            result = {
                'phase': 1,
                'message': 'Complete! Boxes ready to drag into outline',
                'progress': 100,
                'curriculum_id': curriculum_id,
                'done': True
            }
            yield f"data: {json.dumps(result)}\n\n"
            
        except Exception as e:
            error_msg = f"Error during generation: {str(e)}"
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


@router.get("/curricula/{curriculum_id}")
async def get_curriculum(curriculum_id: str, teacherUid: str):
    """
    Fetch a saved curriculum by ID
    
    Args:
        curriculum_id: Firestore document ID
        teacherUid: User ID for authorization
    """
    try:
        curriculum = await firebase.get_curriculum(curriculum_id, teacherUid)
        
        if not curriculum:
            raise HTTPException(status_code=404, detail="Curriculum not found")
        
        return curriculum
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/curricula")
async def list_curricula(teacherUid: str):
    """
    List all curricula for a teacher
    
    Args:
        teacherUid: Firebase user ID
    """
    try:
        curricula = await firebase.list_teacher_curricula(teacherUid)
        return {"curricula": curricula}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/curricula/{curriculum_id}")
async def delete_curriculum(curriculum_id: str, teacherUid: str):
    """
    Delete a curriculum
    
    Args:
        curriculum_id: Firestore document ID
        teacherUid: User ID for authorization
    """
    try:
        success = await firebase.delete_curriculum(curriculum_id, teacherUid)
        
        if not success:
            raise HTTPException(status_code=404, detail="Curriculum not found")
        
        return {"message": "Curriculum deleted successfully"}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
# In backend/routes/curriculum.py
@router.post("/save-course")
async def save_course(course_data: dict, teacherUid: str, organizationId: str):
    """Save course from CourseWorkspace"""
    try:
        if not teacherUid:
            raise HTTPException(status_code=400, detail="teacherUid is required")

        if not organizationId:
            raise HTTPException(status_code=400, detail="organizationId is required")
        
        # FIX: Ensure course_data has the right structure
        curriculum_data = {
            'course_name': course_data.get('courseName'),  # Convert from frontend format
            'grade_level': course_data.get('class'),
            'subject': course_data.get('subject'),
            'topic': course_data.get('topic', ''),
            'duration': course_data.get('timeDuration'),  # This will become 'timeDuration' in Firebase
            'objectives': course_data.get('objectives', ''),
            'sections': course_data.get('sections', []),
            'boxes': course_data.get('generatedTopics', []),
            'handsOnResources': course_data.get('handsOnResources', {}),
            'outline': course_data.get('outline', {})
        }
        
        course_id = await firebase.save_curriculum(
            teacherUid=teacherUid,
            curriculum_data=curriculum_data,
            organizationId=organizationId
        )
        
        return {
            'success': True,
            'courseId': course_id,
            'message': 'Course saved successfully'
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@router.get("/my-courses")
async def get_my_courses(teacherUid: str):
    """
    Get all courses for the logged-in teacher
    
    Args:
        teacherUid: Firebase user ID
    """
    try:
        curricula = await firebase.list_teacher_curricula(teacherUid)
        
        return {
            'success': True,
            'courses': curricula
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@router.post("/update-course")
async def update_course(course_data: dict, teacherUid: str):
    """
    Update an existing course in Firebase
    
    Args:
        course_data: Updated course data (must include courseId)
        teacherUid: Firebase user ID (passed as query parameter)
    """
    try:
        if not teacherUid:
            raise HTTPException(status_code=400, detail="teacherUid is required")
        
        course_id = course_data.get('courseId')
        if not course_id:
            raise HTTPException(status_code=400, detail="courseId is required for updates")
        
        # Verify ownership before updating
        existing_course = await firebase.get_curriculum(course_id, teacherUid)
        if not existing_course:
            raise HTTPException(status_code=404, detail="Course not found or unauthorized")
        
        # Prepare update data (keep the same courseId)
        update_data = {
            'courseName': course_data.get('courseName'),
            'class': course_data.get('class'),
            'subject': course_data.get('subject'),
            'topic': course_data.get('topic'),
            'timeDuration': course_data.get('timeDuration'),
            'objectives': course_data.get('objectives', ''),
            'sections': course_data.get('sections', []),
            'outline': course_data.get('outline', {}),
            'generatedTopics': course_data.get('generatedTopics', []),
            'handsOnResources': course_data.get('handsOnResources', {}),
        }
        
        # Update in Firebase (this will use the existing document)
        await firebase.update_curriculum(course_id, update_data)
        
        return {
            'success': True,
            'courseId': course_id,
            'message': 'Course updated successfully'
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating course: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# NEW UNIFIED GENERATION ENDPOINT
# ============================================================================

@router.post("/curriculum/generate", response_model=GenerateResponse)
async def generate_curriculum_content(request: GenerateRequest):
    """
    Unified generation endpoint for sections, subsections, and topic boxes
    
    Args:
        request: GenerateRequest with level, context, user_guidance, count
        
    Returns:
        GenerateResponse with generated items
        
    Examples:
        Generate sections:
        POST /api/curriculum/generate
        {
            "level": "sections",
            "context": {
                "course": {"title": "...", "description": "...", "grade": "5"},
                "existing_sections": [{"title": "...", "description": "..."}]
            },
            "user_guidance": "Focus on hands-on activities",
            "count": 3,
            "teacher_uid": "user123"
        }
        
        Generate subsections:
        POST /api/curriculum/generate
        {
            "level": "subsections",
            "context": {
                "course": {"title": "...", "grade": "5"},
                "all_section_names": ["Section 1", "Section 2"],
                "current_section": {
                    "title": "Section 1",
                    "description": "...",
                    "existingSubsections": [{"title": "...", "description": "..."}]
                }
            },
            "count": 3,
            "teacher_uid": "user123"
        }
        
        Generate topics:
        POST /api/curriculum/generate
        {
            "level": "topics",
            "context": {
                "course": {"title": "...", "grade": "5"},
                "current_section": {"title": "...", "description": "..."},
                "subsection": {
                    "title": "...",
                    "description": "...",
                    "existingTopics": [{"title": "...", "description": "..."}]
                }
            },
            "count": 3,
            "teacher_uid": "user123"
        }
    """
    
    try:
        logger.info(f"Generation request: level={request.level}, count={request.count}")
        
        # Validate teacher_uid
        if not request.teacher_uid:
            raise HTTPException(status_code=400, detail="teacher_uid is required")
        
        # Convert Pydantic model to dict for service
        context_dict = request.context.dict()
        
        # Call generation service
        result = await generation_service.generate(
            level=request.level,
            context=context_dict,
            user_guidance=request.user_guidance,
            count=request.count
        )
        
        if not result.get("success"):
            error_msg = result.get("error", "Unknown error during generation")
            logger.error(f"Generation failed: {error_msg}")
            raise HTTPException(status_code=500, detail=error_msg)
        
        # Return response
        return GenerateResponse(
            success=True,
            level=result["level"],
            items=result["items"],
            message=f"Successfully generated {len(result['items'])} {request.level}"
        )
    
    except HTTPException:
        raise
    
    except Exception as e:
        logger.error(f"Unexpected error in generate endpoint: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# VISIBILITY TOGGLE
# ============================================================================

class VisibilityUpdate(BaseModel):
    isPublic: bool

@router.patch("/curricula/{curriculum_id}/visibility")
async def update_course_visibility(curriculum_id: str, body: VisibilityUpdate, teacherUid: str):
    """Toggle a course's public/private visibility. Only the owner can change this."""
    try:
        # Verify ownership
        curriculum = await firebase.get_curriculum(curriculum_id, teacherUid)
        if not curriculum:
            raise HTTPException(status_code=404, detail="Course not found or unauthorized")

        await firebase.update_curriculum(curriculum_id, {'isPublic': body.isPublic})
        return {"success": True, "isPublic": body.isPublic}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating visibility: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# FORK ENDPOINT
# ============================================================================

@router.post("/curricula/{course_id}/fork")
async def fork_course(course_id: str, teacherUid: str, displayName: str, organizationId: str):
    """
    Fork a public course into the requesting teacher's own library.

    Creates a new curriculum document owned by teacherUid, preserving all
    content and building a forkLineage chain for attribution.

    Returns the new courseId and the full course document.
    """
    try:
        if not teacherUid or not displayName or not organizationId:
            raise HTTPException(status_code=400, detail="teacherUid, displayName, and organizationId are required")

        new_course_id, new_doc = await firebase.fork_curriculum(
            source_id=course_id,
            forker_uid=teacherUid,
            forker_display_name=displayName,
            org_id=organizationId,
        )

        return {
            "success": True,
            "courseId": new_course_id,
            "course": new_doc,
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error forking course {course_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))