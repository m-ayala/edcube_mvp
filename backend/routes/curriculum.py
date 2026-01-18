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
    time_duration: str
    num_worksheets: int
    num_activities: int
    objectives: Optional[str] = ""
    teacherUid: str


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
                    'boxes': outline_data.get('sections', [])
                }
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
async def save_course(course_data: dict, teacherUid: str):
    """Save course from CourseWorkspace"""
    try:
        if not teacherUid:
            raise HTTPException(status_code=400, detail="teacherUid is required")
        
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
            curriculum_data=curriculum_data
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