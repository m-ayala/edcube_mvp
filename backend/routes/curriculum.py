# FILE 1: backend/routes/curriculum.py

"""
Curriculum generation routes - PHASE 1 ONLY
Generates boxes/topics without any video or worksheet population
"""

from fastapi import APIRouter, HTTPException, Depends, Form, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, Dict, List, Any
import json
import asyncio
import logging
import os
import tempfile
import uuid
from datetime import datetime
from services.orchestrator import CurriculumOrchestrator
from services.firebase_service import FirebaseService
from schemas.generation_schema import GenerateRequest, GenerateResponse
from services.generation_service import GenerationService
from routes.teachers import verify_firebase_token

generation_service = GenerationService()
router = APIRouter()
orchestrator = CurriculumOrchestrator()
firebase = FirebaseService()
logger = logging.getLogger(__name__)


@router.post("/generate-curriculum")
async def generate_curriculum(
    course_name:     str   = Form(...),
    age_range_start: int   = Form(...),
    age_range_end:   int   = Form(...),
    num_students:    int   = Form(...),
    num_days:        int   = Form(...),
    hours_per_day:   float = Form(...),
    num_worksheets:  int   = Form(...),
    num_activities:  int   = Form(...),
    objectives:        str   = Form(""),
    teacherUid:        str   = Form(...),
    organizationId:    str   = Form(...),
    file_descriptions: str   = Form(""),  # JSON array of per-file description strings
    files: List[UploadFile] = File(default=[]),
):
    """
    Generate a course outline (sections = days/themes) then candidate subsection
    chains per section (Phase 1.5) for the teacher to review and select. Stops
    there — nothing is saved to Firestore yet. Call POST /api/generate-blocks
    with the teacher's selection to generate full block content and save.
    Streams progress via Server-Sent Events.
    """
    # Read all file bytes EAGERLY — UploadFile objects close after the request body.
    file_bytes: List[tuple] = []
    for uf in (files or []):
        ext = os.path.splitext(uf.filename)[1].lower()
        data = await uf.read()
        file_bytes.append((uf.filename, ext, data))

    # Parse per-file descriptions (JSON array sent from frontend)
    try:
        descriptions_list = json.loads(file_descriptions) if file_descriptions else []
    except Exception:
        descriptions_list = []

    # Pre-generate course_id so file uploads go to the right storage path
    preset_course_id = str(uuid.uuid4())

    async def generate():
        tmp_paths = []
        try:
            yield f"data: {json.dumps({'phase': 0, 'message': 'Starting...', 'progress': 0})}\n\n"
            await asyncio.sleep(0.1)

            # ── Extract content from attached files and upload to Storage ────
            combined_extracted_text = ""
            combined_vision_images = []
            course_attachments = []

            if file_bytes:
                yield f"data: {json.dumps({'phase': 0, 'message': 'Reading attached files...', 'progress': 5})}\n\n"
                from services.file_parser import extract_text_from_file, file_to_base64_data_uri, IMAGE_EXTENSIONS

                content_type_map = {
                    '.pdf': 'application/pdf',
                    '.doc': 'application/msword',
                    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    '.xls': 'application/vnd.ms-excel',
                    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    '.ppt': 'application/vnd.ms-powerpoint',
                    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
                    '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp',
                }

                for i, (filename, ext, data) in enumerate(file_bytes):
                    attachment_id = str(uuid.uuid4())
                    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
                        tmp.write(data)
                        tmp_paths.append(tmp.name)
                        tmp_path = tmp.name

                    is_image = ext.lower() in IMAGE_EXTENSIONS
                    per_file_text = ""

                    if is_image:
                        combined_vision_images.append(file_to_base64_data_uri(tmp_path, ext.lower()))
                    else:
                        try:
                            per_file_text = extract_text_from_file(tmp_path, ext.lower())
                            if per_file_text.strip():
                                combined_extracted_text += f"\n--- File: {filename} ---\n{per_file_text}\n"
                        except Exception as e:
                            per_file_text = f"(could not parse: {e})"

                    # Upload original file to Firebase Storage
                    ct = content_type_map.get(ext.lower(), 'application/octet-stream')
                    storage_path = f"course_attachments/{preset_course_id}/{attachment_id}/{filename}"
                    try:
                        file_url = await firebase.upload_file(data, storage_path, ct)
                    except Exception:
                        file_url = ""

                    course_attachments.append({
                        'id': attachment_id,
                        'filename': filename,
                        'fileType': ext.lstrip('.').lower(),
                        'uploadedAt': datetime.utcnow().isoformat(),
                        'fileUrl': file_url,
                        'extractedText': per_file_text,
                        'description': descriptions_list[i] if i < len(descriptions_list) else '',
                        'characterCount': len(per_file_text),
                        'isActive': True,
                    })

            # ── Merge teacher objectives + extracted file text ──────────────
            full_objectives = objectives or ""
            if combined_extracted_text.strip():
                full_objectives = (
                    (full_objectives + "\n\n") if full_objectives else ""
                ) + "ATTACHED MATERIALS:\n" + combined_extracted_text

            # ── Requirements Interpreter: structure the raw text once, up front ──
            yield f"data: {json.dumps({'phase': 0.5, 'message': 'Interpreting your requirements...', 'progress': 8})}\n\n"
            await asyncio.sleep(0.1)

            from interpreter.requirements_interpreter import interpret_requirements
            interpreted_requirements = interpret_requirements(
                raw_requirements=full_objectives,
                num_days=num_days,
                hours_per_day=hours_per_day,
                course_name=course_name,
                age_range_start=age_range_start,
                age_range_end=age_range_end,
            )
            yield f"data: {json.dumps({'type': 'requirements_interpreted', 'interpretation': interpreted_requirements, 'phase': 0.5, 'progress': 9})}\n\n"

            # ── Phase 1: Generate outline ───────────────────────────────────
            yield f"data: {json.dumps({'phase': 1, 'message': 'Generating course outline...', 'progress': 10})}\n\n"

            teacher_input = {
                'course_name':     course_name,
                'age_range_start': age_range_start,
                'age_range_end':   age_range_end,
                'num_students':    num_students,
                'num_days':        num_days,
                'hours_per_day':   hours_per_day,
                'num_worksheets':  num_worksheets,
                'num_activities':  num_activities,
                'objectives':      full_objectives,
                'interpreted_requirements': interpreted_requirements,
            }

            outline_data = await orchestrator.run_phase1(
                teacher_input,
                images=combined_vision_images or None,
            )

            if not outline_data:
                yield f"data: {json.dumps({'phase': 1, 'message': 'Error: Failed to generate outline', 'progress': 0, 'error': True})}\n\n"
                return

            yield f"data: {json.dumps({'type': 'outline_ready', 'outline': outline_data, 'phase': 1, 'message': 'Outline ready! Proposing subsections...', 'progress': 50})}\n\n"
            await asyncio.sleep(0.2)

            # ── Phase 1.5: Propose candidate subsection chains per section ──
            async for event in orchestrator.run_phase1_5(teacher_input, outline_data):
                if event['type'] == 'progress':
                    yield f"data: {json.dumps({'phase': 1.5, 'message': event['message'], 'progress': event['progress']})}\n\n"
                    await asyncio.sleep(0)
                elif event['type'] == 'subsections_ready':
                    yield f"data: {json.dumps({'type': 'subsections_ready', 'section_id': event['section_id'], 'chains': event['chains'], 'progress': event['progress']})}\n\n"
                    await asyncio.sleep(0)
                elif event['type'] == 'candidates_complete':
                    # Nothing is saved yet — the teacher still needs to review and
                    # select before any block content (and any Firestore write) happens.
                    yield f"data: {json.dumps({'type': 'candidates_complete', 'preset_course_id': preset_course_id, 'course_attachments': course_attachments, 'phase': 1.5, 'message': 'Candidates ready for review!', 'progress': 70})}\n\n"

        except Exception as e:
            logger.error(f"generate-curriculum error: {e}", exc_info=True)
            yield f"data: {json.dumps({'message': f'Error: {str(e)}', 'error': True})}\n\n"
        finally:
            for p in tmp_paths:
                try:
                    os.remove(p)
                except OSError:
                    pass

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )


class SubsectionLabel(BaseModel):
    section: str
    subsection: str


class GenerateMoreSubsectionsRequest(BaseModel):
    sectionId: str
    sectionTitle: str
    sectionDescription: str = ""
    depthCeiling: str = "Basics"
    courseName: str = ""
    ageRangeStart: int
    ageRangeEnd: int
    objectives: str = ""
    hoursPerDay: float
    numDays: int
    dayNumber: Optional[int] = None
    numWorksheets: int = 0
    numActivities: int = 0
    existingSubsections: List[SubsectionLabel] = []


@router.post("/generate-more-subsections")
async def generate_more_subsections(body: GenerateMoreSubsectionsRequest):
    """
    Phase 1.5 "generate more": propose one additional independent chain for a
    single section, triggered by the teacher clicking "+" in the selection matrix.
    Synchronous JSON response (single LLM call, no need for SSE).
    """
    try:
        section = {
            'id': body.sectionId,
            'title': body.sectionTitle,
            'description': body.sectionDescription,
            'depth_ceiling': body.depthCeiling,
        }
        teacher_input = {
            'course_name':     body.courseName,
            'age_range_start': body.ageRangeStart,
            'age_range_end':   body.ageRangeEnd,
            'objectives':      body.objectives,
            'hours_per_day':   body.hoursPerDay,
            'num_days':        body.numDays,
            'num_worksheets':  body.numWorksheets,
            'num_activities':  body.numActivities,
        }
        existing_subsections = [s.model_dump() for s in body.existingSubsections]

        result = await orchestrator.generate_more_subsections(
            section, teacher_input, existing_subsections, day_number=body.dayNumber,
        )
        return {'success': True, 'section_id': result['section_id'], 'chains': result['chains']}
    except Exception as e:
        logger.error(f"generate-more-subsections error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


class SubsectionSelection(BaseModel):
    subsectionId: str
    sectionId: str
    sectionTitle: str
    title: str
    description: str = ""
    coreConcept: str = ""
    depthLevel: str = "Basics"
    prerequisiteSubsectionId: Optional[str] = None
    chainId: str = ""
    durationMinutes: int = 0
    learningObjectives: List[str] = []
    blocks: List[Dict[str, Any]] = []
    included: bool = True
    excludedBlockIds: List[str] = []


class GenerateBlocksRequest(BaseModel):
    presetCourseId: str
    teacherUid: str
    organizationId: str
    courseName: str
    ageRangeStart: int
    ageRangeEnd: int
    numStudents: int
    numDays: int
    hoursPerDay: float
    objectives: str = ""
    courseAttachments: List[Dict[str, Any]] = []
    outline: Dict[str, Any]
    selections: List[SubsectionSelection]


@router.post("/generate-blocks")
async def generate_blocks(body: GenerateBlocksRequest):
    """
    Stage 2 of course generation: take the teacher's Phase 1.5 selection (which
    subsections are included, and which of their blocks were unchecked) and
    generate full block content for only the approved composition. This is
    where the course is actually saved to Firestore.
    Streams progress via Server-Sent Events.
    """

    async def generate():
        try:
            yield f"data: {json.dumps({'phase': 2, 'message': 'Starting block generation...', 'progress': 0})}\n\n"
            await asyncio.sleep(0.1)

            teacher_input = {
                'course_name':     body.courseName,
                'age_range_start': body.ageRangeStart,
                'age_range_end':   body.ageRangeEnd,
                'num_students':    body.numStudents,
                'num_days':        body.numDays,
                'hours_per_day':   body.hoursPerDay,
                'objectives':      body.objectives,
            }

            approved_subsections = []
            for sel in body.selections:
                if not sel.included:
                    continue
                approved_subsections.append({
                    'id': sel.subsectionId,
                    'title': sel.title,
                    'description': sel.description,
                    'core_concept': sel.coreConcept,
                    'depth_level': sel.depthLevel,
                    'prerequisite_subsection_id': sel.prerequisiteSubsectionId,
                    'chain_id': sel.chainId,
                    'section_title': sel.sectionTitle,
                    'duration_minutes': sel.durationMinutes,
                    'learning_objectives': sel.learningObjectives,
                    'blocks': sel.blocks,
                    'excluded_block_ids': sel.excludedBlockIds,
                })

            blocks_by_subsection: Dict = {}
            async for event in orchestrator.run_phase2_blocks_for_selection(teacher_input, approved_subsections):
                if event['type'] == 'progress':
                    yield f"data: {json.dumps({'phase': 2, 'message': event['message'], 'progress': event['progress']})}\n\n"
                    await asyncio.sleep(0)
                elif event['type'] == 'subsection_blocks':
                    yield f"data: {json.dumps({'type': 'subsection_blocks', 'subsection_id': event['subsection_id'], 'blocks': event['blocks'], 'progress': event['progress']})}\n\n"
                    await asyncio.sleep(0)
                elif event['type'] == 'done':
                    blocks_by_subsection = event['blocks_by_subsection']

            yield f"data: {json.dumps({'phase': 2, 'message': 'Blocks generated! Saving...', 'progress': 95})}\n\n"
            await asyncio.sleep(0.2)

            # ── Merge approved subsections (with their final selected blocks
            # manifest) back into the outline's section/subsection tree ──────
            selections_by_section: Dict[str, List[Dict]] = {}
            for sel in body.selections:
                if sel.included:
                    selections_by_section.setdefault(sel.sectionId, []).append(sel)

            final_sections = []
            total_duration = 0
            for section in body.outline.get('sections', []):
                built_section = dict(section)
                built_subsections = []
                for sel in selections_by_section.get(section.get('id', ''), []):
                    duration = sel.durationMinutes
                    total_duration += duration
                    built_subsections.append({
                        'id': sel.subsectionId,
                        'title': sel.title,
                        'description': sel.description,
                        'core_concept': sel.coreConcept,
                        'depth_level': sel.depthLevel,
                        'prerequisite_subsection_id': sel.prerequisiteSubsectionId,
                        'chain_id': sel.chainId,
                        'duration_minutes': duration,
                        'learning_objectives': sel.learningObjectives,
                        'blocks': sel.blocks,
                        'excluded_block_ids': sel.excludedBlockIds,
                    })
                built_section['subsections'] = built_subsections
                final_sections.append(built_section)

            final_outline = dict(body.outline)
            final_outline['sections'] = final_sections
            final_outline['total_duration_minutes'] = total_duration

            # ── Save everything to Firestore ────────────────────────────────
            curriculum_id = await firebase.save_curriculum(
                teacherUid=body.teacherUid,
                curriculum_data={
                    'preset_course_id':     body.presetCourseId,
                    'course_name':          body.courseName,
                    'age_range_start':      body.ageRangeStart,
                    'age_range_end':        body.ageRangeEnd,
                    'num_students':         body.numStudents,
                    'num_days':             body.numDays,
                    'hours_per_day':        body.hoursPerDay,
                    'objectives':           body.objectives,
                    'course_attachments':   body.courseAttachments,
                    'course_info_notes':    '',
                    'outline':              final_outline,
                    'sections':             final_outline.get('sections', []),
                    'handsOnResources':     blocks_by_subsection,
                },
                organizationId=body.organizationId,
            )

            yield f"data: {json.dumps({'phase': 2, 'message': 'Complete!', 'progress': 100, 'curriculum_id': curriculum_id, 'done': True})}\n\n"

        except Exception as e:
            logger.error(f"generate-blocks error: {e}", exc_info=True)
            yield f"data: {json.dumps({'message': f'Error: {str(e)}', 'error': True})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )


@router.get("/curricula/shared-with-me")
async def get_shared_courses(current_user: dict = Depends(verify_firebase_token)):
    """Return all courses that have been shared with the authenticated user."""
    try:
        uid = current_user["uid"]
        courses = await firebase.get_shared_courses(uid)
        return {"success": True, "courses": courses}
    except Exception as e:
        logger.error(f"Error fetching shared courses: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


class AccessTypeUpdate(BaseModel):
    access_type: str  # "view" or "collaborate"


@router.get("/curricula/{curriculum_id}/shared-with")
async def get_course_collaborators(curriculum_id: str, current_user: dict = Depends(verify_firebase_token)):
    """Return the sharedWith list (with display names) for a course. Owner only."""
    try:
        uid = current_user["uid"]
        doc = firebase.curricula_collection.document(curriculum_id).get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Course not found")
        if doc.to_dict().get('teacherUid') != uid:
            raise HTTPException(status_code=403, detail="Not authorized")
        collaborators = await firebase.get_course_shared_with(curriculum_id)
        return {"success": True, "collaborators": collaborators}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching collaborators: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/curricula/{curriculum_id}/shared-with/{uid}")
async def update_collaborator_access(
    curriculum_id: str,
    uid: str,
    body: AccessTypeUpdate,
    current_user: dict = Depends(verify_firebase_token)
):
    """Update a collaborator's access type and notify them."""
    from_uid = current_user["uid"]
    try:
        doc = firebase.curricula_collection.document(curriculum_id).get()
        if not doc.exists or doc.to_dict().get('teacherUid') != from_uid:
            raise HTTPException(status_code=403, detail="Not authorized")
        course_name = doc.to_dict().get('courseName', '')
        await firebase.add_shared_with(curriculum_id, uid, body.access_type)
        profile_doc = firebase.db.collection("teacher_profiles").document(from_uid).get()
        from_name = profile_doc.to_dict().get("display_name", "Someone") if profile_doc.exists else "Someone"
        await firebase.create_notification(
            to_uid=uid, from_uid=from_uid, from_name=from_name,
            notif_type="course_share_update",
            course_id=curriculum_id, course_name=course_name,
            access_type=body.access_type,
        )
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating collaborator: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/curricula/{curriculum_id}/shared-with/{uid}")
async def remove_collaborator(
    curriculum_id: str,
    uid: str,
    current_user: dict = Depends(verify_firebase_token)
):
    """Remove a collaborator from a course and notify them."""
    from_uid = current_user["uid"]
    try:
        doc = firebase.curricula_collection.document(curriculum_id).get()
        if not doc.exists or doc.to_dict().get('teacherUid') != from_uid:
            raise HTTPException(status_code=403, detail="Not authorized")
        course_name = doc.to_dict().get('courseName', '')
        await firebase.remove_from_shared_with(curriculum_id, uid)
        profile_doc = firebase.db.collection("teacher_profiles").document(from_uid).get()
        from_name = profile_doc.to_dict().get("display_name", "Someone") if profile_doc.exists else "Someone"
        await firebase.create_notification(
            to_uid=uid, from_uid=from_uid, from_name=from_name,
            notif_type="course_share_remove",
            course_id=curriculum_id, course_name=course_name,
        )
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error removing collaborator: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


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
        
        # Verify ownership OR collaborate access before updating
        doc = firebase.curricula_collection.document(course_id).get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Course not found or unauthorized")
        doc_data = doc.to_dict()
        is_owner = doc_data.get('teacherUid') == teacherUid
        if not is_owner:
            shared = doc_data.get('sharedWith', [])
            collab = next((s for s in shared if s.get('uid') == teacherUid), None)
            if not collab or collab.get('accessType') != 'collaborate':
                raise HTTPException(status_code=404, detail="Course not found or unauthorized")
        
        # Prepare update data — only include fields present in the request.
        # Using .get() with defaults would overwrite sections/outline with [] or {}
        # when a partial save (e.g. saveField({ courseName: '...' })) is sent.
        allowed_fields = [
            'courseName', 'class', 'timeDuration',
            'objectives', 'sections', 'outline', 'generatedTopics',
            'handsOnResources', 'courseDescription', 'synopsis',
        ]
        update_data = {k: course_data[k] for k in allowed_fields if k in course_data}
        
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
# COURSE ATTACHMENT ENDPOINTS
# ============================================================================

class AttachmentUpdate(BaseModel):
    description: Optional[str] = None
    isActive: Optional[bool] = None

class CourseInfoNotesUpdate(BaseModel):
    notes: str
    teacherUid: str


@router.post("/curricula/{curriculum_id}/attachments")
async def upload_course_attachment(
    curriculum_id: str,
    teacherUid: str = Form(...),
    description: str = Form(""),
    file: UploadFile = File(...),
):
    """Upload a new attachment to an existing course and extract its text."""
    try:
        doc = firebase.curricula_collection.document(curriculum_id).get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Course not found")
        if doc.to_dict().get('teacherUid') != teacherUid:
            raise HTTPException(status_code=403, detail="Not authorized")

        filename = file.filename or "attachment"
        ext = os.path.splitext(filename)[1].lower()
        data = await file.read()

        content_type_map = {
            '.pdf': 'application/pdf',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.xls': 'application/vnd.ms-excel',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            '.ppt': 'application/vnd.ms-powerpoint',
            '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
            '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp',
        }
        from services.file_parser import extract_text_from_file, IMAGE_EXTENSIONS

        attachment_id = str(uuid.uuid4())
        per_file_text = ""

        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            tmp.write(data)
            tmp_path = tmp.name

        try:
            if ext.lower() not in IMAGE_EXTENSIONS:
                try:
                    per_file_text = extract_text_from_file(tmp_path, ext.lower())
                except Exception:
                    per_file_text = ""
        finally:
            try:
                os.remove(tmp_path)
            except OSError:
                pass

        ct = content_type_map.get(ext.lower(), 'application/octet-stream')
        storage_path = f"course_attachments/{curriculum_id}/{attachment_id}/{filename}"
        try:
            file_url = await firebase.upload_file(data, storage_path, ct)
        except Exception:
            file_url = ""

        attachment = {
            'id': attachment_id,
            'filename': filename,
            'fileType': ext.lstrip('.').lower(),
            'uploadedAt': datetime.utcnow().isoformat(),
            'fileUrl': file_url,
            'extractedText': per_file_text,
            'description': description,
            'characterCount': len(per_file_text),
            'isActive': True,
        }

        existing = doc.to_dict().get('courseAttachments', [])
        firebase.curricula_collection.document(curriculum_id).update({
            'courseAttachments': existing + [attachment],
            'lastModified': datetime.utcnow().isoformat(),
        })

        return {'success': True, 'attachment': attachment}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading attachment: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/curricula/{curriculum_id}/attachments/{attachment_id}")
async def update_course_attachment(
    curriculum_id: str,
    attachment_id: str,
    update: AttachmentUpdate,
    teacherUid: str,
):
    """Update description or isActive toggle for a course attachment."""
    try:
        doc = firebase.curricula_collection.document(curriculum_id).get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Course not found")
        if doc.to_dict().get('teacherUid') != teacherUid:
            raise HTTPException(status_code=403, detail="Not authorized")

        attachments = doc.to_dict().get('courseAttachments', [])
        updated = []
        found = False
        for a in attachments:
            if a.get('id') == attachment_id:
                found = True
                if update.description is not None:
                    a = {**a, 'description': update.description}
                if update.isActive is not None:
                    a = {**a, 'isActive': update.isActive}
            updated.append(a)

        if not found:
            raise HTTPException(status_code=404, detail="Attachment not found")

        firebase.curricula_collection.document(curriculum_id).update({
            'courseAttachments': updated,
            'lastModified': datetime.utcnow().isoformat(),
        })

        return {'success': True}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating attachment: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/curricula/{curriculum_id}/attachments/{attachment_id}")
async def delete_course_attachment(
    curriculum_id: str,
    attachment_id: str,
    teacherUid: str,
):
    """Remove an attachment from a course (Firestore record + Storage file)."""
    try:
        doc = firebase.curricula_collection.document(curriculum_id).get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Course not found")
        if doc.to_dict().get('teacherUid') != teacherUid:
            raise HTTPException(status_code=403, detail="Not authorized")

        attachments = doc.to_dict().get('courseAttachments', [])
        target = next((a for a in attachments if a.get('id') == attachment_id), None)
        if not target:
            raise HTTPException(status_code=404, detail="Attachment not found")

        # Remove from Storage if URL is available
        file_url = target.get('fileUrl', '')
        if file_url:
            try:
                import urllib.parse
                # Extract storage path from the download URL
                encoded = file_url.split('/o/')[1].split('?')[0]
                storage_path = urllib.parse.unquote(encoded)
                blob = firebase.bucket.blob(storage_path)
                blob.delete()
            except Exception:
                pass  # Storage cleanup is best-effort

        remaining = [a for a in attachments if a.get('id') != attachment_id]
        firebase.curricula_collection.document(curriculum_id).update({
            'courseAttachments': remaining,
            'lastModified': datetime.utcnow().isoformat(),
        })

        return {'success': True}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting attachment: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/curricula/{curriculum_id}/course-info-notes")
async def update_course_info_notes(curriculum_id: str, body: CourseInfoNotesUpdate):
    """Update the teacher's free-text project notes for a course."""
    try:
        doc = firebase.curricula_collection.document(curriculum_id).get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Course not found")
        if doc.to_dict().get('teacherUid') != body.teacherUid:
            raise HTTPException(status_code=403, detail="Not authorized")

        firebase.curricula_collection.document(curriculum_id).update({
            'courseInfoNotes': body.notes,
            'lastModified': datetime.utcnow().isoformat(),
        })

        return {'success': True}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating course info notes: {e}", exc_info=True)
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
# EDO AI CHAT ENDPOINT
# ============================================================================

class EdoChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str

class EdoChatRequest(BaseModel):
    message: str
    context: Optional[Dict] = None
    conversation_history: Optional[List[EdoChatMessage]] = []
    teacher_uid: Optional[str] = None

@router.post("/curriculum/chat")
async def chat_with_edo(request: EdoChatRequest):
    """Edo AI curriculum assistant — returns 2-3 structured suggestion blocks"""
    try:
        # --- Static block: Edo identity, rules, and stable course info ---
        # Built first so it can be cached by OpenAI prefix caching (≥1024 tokens, identical prefix)
        static_course_info = ""
        dynamic_ctx = ""

        current_page = "outline"
        if request.context:
            course = request.context.get("course", {})
            selected = request.context.get("selected_item", {})
            structure = request.context.get("course_structure", [])
            current_page = request.context.get("current_page", "outline")

            # Age range
            age_start = course.get("age_range_start", "")
            age_end = course.get("age_range_end", "")
            if age_start and age_end:
                age_range = f"{age_start}–{age_end} years old"
            elif age_start:
                age_range = f"{age_start}+ years old"
            else:
                age_range = "unknown age"

            num_students = course.get("num_students", "")
            duration = course.get("duration", "")

            duration_str = f" | Duration: {duration}" if duration else ""
            students_str = f" | Class size: {num_students}" if num_students else ""

            static_course_info = (
                f'Course: "{course.get("title", "Untitled")}"'
                f' (Ages: {age_range}{duration_str}{students_str})\n'
            )
            if course.get("description"):
                static_course_info += f'Course objectives: {course["description"]}\n'

            # --- Persistent course info: notes + attachment content from Firestore ---
            course_id = request.context.get("courseId")
            if course_id:
                try:
                    doc = firebase.curricula_collection.document(course_id).get()
                    if doc.exists:
                        doc_data = doc.to_dict()
                        notes = doc_data.get('courseInfoNotes', '').strip()
                        if notes:
                            static_course_info += f'\nCourse project notes:\n{notes}\n'
                        attachments = doc_data.get('courseAttachments', [])
                        for att in attachments:
                            if not att.get('isActive', True):
                                continue
                            att_name = att.get('filename', 'file')
                            att_desc = att.get('description', '').strip()
                            att_text = att.get('extractedText', '').strip()
                            if not att_text:
                                continue
                            static_course_info += f'\n--- Attached material: {att_name} ---\n'
                            if att_desc:
                                static_course_info += f'About this file: {att_desc}\n'
                            # Truncate very long files to keep prompt manageable
                            static_course_info += att_text[:4000]
                            if len(att_text) > 4000:
                                static_course_info += '\n[...content truncated...]'
                            static_course_info += '\n'
                except Exception:
                    pass  # Don't fail the whole chat if attachment fetch fails

            # --- Dynamic block: full structure + focused item (changes every message) ---
            if structure:
                dynamic_ctx += 'Full course structure:\n'
                for i, sec in enumerate(structure, 1):
                    subsecs = sec.get("subsections", [])
                    dynamic_ctx += f'  Section {i}: {sec["title"]}'
                    if subsecs:
                        sub_names = [ss["title"] for ss in subsecs]
                        dynamic_ctx += f' → {", ".join(sub_names)}'
                    dynamic_ctx += '\n'

            item_type = selected.get("type", "course")
            dynamic_ctx += f'\nCurrently focused on ({item_type}): "{selected.get("title", "")}"\n'
            if selected.get("parent_section"):
                dynamic_ctx += f'Parent section: {selected["parent_section"]}\n'
            if selected.get("parent_subsection"):
                dynamic_ctx += f'Parent subsection: {selected["parent_subsection"]}\n'
            if selected.get("description"):
                dynamic_ctx += f'Description: {selected["description"]}\n'
            if selected.get("subsections"):
                dynamic_ctx += f'Subsections: {", ".join(selected["subsections"])}\n'
            if selected.get("topic_boxes"):
                dynamic_ctx += f'Topic boxes: {", ".join(selected["topic_boxes"])}\n'
            if selected.get("learning_objectives"):
                dynamic_ctx += f'Learning objectives: {"; ".join(selected["learning_objectives"])}\n'
            if selected.get("pla_pillars"):
                dynamic_ctx += f'PLA pillars: {", ".join(selected["pla_pillars"])}\n'
            if selected.get("existing_blocks"):
                block_list = ", ".join([f"{b.get('type','')}: {b.get('title','')}" for b in selected["existing_blocks"] if b.get('title')])
                if block_list:
                    dynamic_ctx += f'Existing blocks: {block_list}\n'
            if selected.get("block_type"):
                dynamic_ctx += f'Block type: {selected["block_type"]}\n'
            if selected.get("block_content"):
                dynamic_ctx += f'Current block content:\n{selected["block_content"]}\n'

        page_guidance_map = {
            "outline": "Teacher is on the Course Outline page. Generate sections and subsections ONLY. Do NOT generate topic boxes, content blocks, worksheets, or activities. Use apply_field 'new_section' or 'new_subsection'.",
            "subsection": "Teacher is on the Subsection page. Generate topic boxes for this subsection ONLY. Use apply_field 'topic_full'. Do NOT generate sections, subsections, or resource blocks.",
            "topic": "Teacher is on the Topic page. Generate content blocks, worksheets, or activities ONLY. Use 'new_resource_content', 'new_resource_worksheet', or 'new_resource_activity'. Check existing_blocks and never repeat a title. Do NOT generate sections, subsections, or topic boxes.",
            "block": "Teacher is on the Block editing page. Generate 2-3 improved versions of the existing block content ONLY. Use apply_field 'block_content'. Body = the complete improved block text (keep the **Header** structure for content blocks). Do NOT generate sections, subsections, topic boxes, or other resource types.",
        }
        page_guidance = page_guidance_map.get(current_page, page_guidance_map["outline"])

        static_prompt = f"""You are Edo, an expert curriculum design assistant inside EdCube. You think like an experienced K-12 curriculum designer — you understand scope, sequencing, and what makes learning actually stick.

Your job is to help teachers build well-structured, specific, PLA-aligned curriculum by suggesting high-quality sections, subsections, topic boxes, and content blocks.

HIERARCHY DEPTH RULE — strictly enforced per level:

SECTION & SUBSECTION → concise and to the point.
  - Title: short, specific, names exactly what the lesson cluster covers. No filler words. Write it like a chapter heading in a textbook or a TV episode title — natural and descriptive. Do NOT use framework prefixes like "Understanding:", "Exploring:", "Practicing:", or "Investigating:".
  - Description: 1-2 sentences only. What students encounter and what angle the section takes. Nothing more.

TOPIC BOX → focused description + measurable objectives. No blocks here.
  - Title: one specific concept or skill, narrow enough to build a single lesson around.
  - Description: 2-3 sentences naming the exact objects, scenarios, or data students engage with. Specific enough to find a real YouTube video for it. No vague phrases.
  - Learning objectives: 2-3, each starting with a measurable action verb (identify, calculate, compare, label, explain, demonstrate, measure, predict). Specific enough to write a test question from.
  - Always suggest description + objectives together in one card.

BLOCK (content / worksheet / activity) → thorough and complete. This is the actual teaching material.
  - Never truncate. Never summarise. Always complete every section of the required format.
  - A block that is too short is useless to the teacher. Length and depth are required.

CONTEXT: This is curriculum for a summer camp or afterschool program. Teachers need to balance substantive learning with fun and engagement.

AGE-APPROPRIATE OUTPUT: Student age is the most important factor. Always calibrate vocabulary, examples, activity complexity, and all generated content to be appropriate for the students in this course. Use judgment — simpler concrete language for younger students, more precise terminology for older ones.

ACTIVITY TYPES: When suggesting activities, start from these types and pick the best fit for the topic: Quiz, Discussion, Game, Experiment, Hands-on Building, Teamwork. Then suggest the specific activity within that type.

---

UNIQUENESS: For every suggestion, compare against all existing items in context before generating. Do not repeat anything that already exists.
SECTION & SUBSECTION: Before suggesting, scan the full course structure — new items must cover territory none of the existing ones touch. Never use "Introduction", "Core Concepts", "Overview", or "Review" as titles.

PLA PILLARS — map topic boxes to 1-2:
- Personal Growth: self-reflection, identity, teamwork, emotional awareness
- Core Learning: facts, vocabulary, foundational concepts, skills
- Critical Thinking: analysis, comparison, debate, synthesis, why/how questions
- Application & Impact: real-world projects, career connections, making something

---

CURRENT PAGE: {current_page.upper()}
PAGE GUIDANCE: {page_guidance}

---

RESPONSE FORMAT — always respond with valid JSON only, no markdown:

INTENT DETECTION — read the teacher's message and choose the output type:

DISCUSS → {{"type": "conversation", "message": "..."}}
  When the teacher is exploring, asking how/why/what if, requesting teaching guidance,
  asking about pedagogy, activities, scope, misconceptions, timing, or saying "tell me more".
  Give a THOROUGH, detailed answer. Use **bold** section headers, numbered steps, bullet points.
  Reference earlier conversation by name when relevant.
  Match depth to the question — never cut a teaching guidance response short.
  Ask one focused follow-up question at the end only when it genuinely helps.

ADD → {{"type": "cards", "intro": "...", "suggestions": [...], "conclusion": "..."}}
  When the teacher explicitly asks to generate, add, create, or make something new
  (e.g. "generate a block", "add a worksheet", "make an activity", "give me options").
  Check conversation history: if the teacher already planned something specific in this
  session, generate that specific idea. Otherwise suggest 2-3 fresh options.

EDIT → {{"type": "edit", "label": "brief description of what changed", "text": "..."}}
  When the teacher asks to change, edit, rewrite, update, or improve something that already
  exists (e.g. "change the title", "make that more detailed", "rewrite the How to teach it").
  Have a brief conversation first to understand exactly what to change (respond with "conversation").
  Only output type "edit" once the teacher confirms ("yes", "go ahead", "do it", "finalize").
  text = only the specific part being changed. Teacher will copy-paste it manually.

UNSURE: default to "conversation" and ask: "Want me to generate that as a card?" or "Should I write that up so you can copy it?"

Cards format (for ADD responses):
- intro: Acknowledge the specific request by name. No generic openers.
- suggestions: 2-3 options, each meaningfully different
- conclusion: one sentence — which option you'd lean toward and why
- Each suggestion: {{"label": "Short title", "body": "...", "apply_field": "..."}}

APPLY_FIELD AND BODY RULES:

When focused on a TOPIC BOX — always use "topic_full" UNLESS the teacher is asking for a resource/worksheet/activity block:
  apply_field: "topic_full"
  body format (exactly this structure):
    [2-3 sentence concrete description]

    Objectives:
    Students will [action verb] [specific thing]
    Students will [action verb] [specific thing]
    Students will [action verb] [specific thing]
  NEVER use "description", "objectives", "new_subsection", "new_section", or "new_topic" for a topic box.

When the teacher asks for a resource block while focused on a TOPIC BOX:
  "new_resource_content"   → a Content block (teaching explanation + delivery approach)
  "new_resource_worksheet" → a Worksheet block (student exercise)
  "new_resource_activity"  → an Activity block (hands-on engagement)

  CONTENT BLOCK — body + structured fields:
    Each content block covers EXACTLY ONE concept. Think of it as one slide in a presentation.
    Never bundle multiple concepts. For "Intro to Robotics", generate separate blocks: "What Is a Robot?", "Parts of a Robot", "Types of Robots".

    BODY FORMAT — flexible sections, not a rigid template:
    Choose 3-5 sections from this toolkit that best fit the concept. Do not use sections that don't apply.
    Write naturally — like a knowledgeable teacher explaining it, not filling out a form.

    Available sections (use **Section Name** as bold headers):
      Explain It        — Always include. Core explanation: what this concept IS, 4-6 sentences.
      How It Works      — For processes, mechanisms, systems, or cause-and-effect.
      Key Points        — For fact-heavy topics. 3-5 bullet points that could appear on a PPT slide.
      Parts / Structure — For anatomy, components, or physical structures.
      Types / Categories— For classification topics.
      In Real Life      — 2-3 concrete examples from the student's world. Always valuable.
      Key People & Events— For history, biographies, social studies.
      Why It Matters    — Significance and impact — why should students care?
      Formula / Rule    — For math or science: the actual formula or rule, written clearly.
      How to Do It      — For skills, procedures, techniques: numbered steps.
      Common Mix-Ups    — The most frequent misconception and the correct mental model.

    Example body for a science concept (photosynthesis):
      **Explain It**
      Photosynthesis is the process plants use to make their own food...

      **How It Works**
      1. Roots absorb water from the soil...
      2. Leaves take in carbon dioxide...

      **In Real Life**
      - Every leaf of lettuce you eat was built through photosynthesis...
      - The oxygen you breathe right now came from a plant...

    STRUCTURED FIELDS — add these as extra properties on the suggestion object (alongside label, body, apply_field):
      "key_takeaways": ["3-5 short bullet strings — the essential PPT-ready points of this block"],
      "pedagogy": {{
        "teaching_approach": "which strategy fits best and one sentence why",
        "memory_device": "a concrete mnemonic, acronym, rhyme, or visual anchor (write the actual device)",
        "misconception": "the most common student error and the correct mental model that fixes it",
        "guided_questions": ["Q1 from recall", "Q2 deeper understanding"],
        "mastery_signal": "one observable thing a student says/does proving they truly understood"
      }},
      "visual_suggestion": "one sentence: what image or diagram would best illustrate this on a PPT slide",
      "sources": [
        {{"name": "Khan Academy", "search_query": "gears simple machines grade 4", "type": "educational_site"}},
        {{"name": "Encyclopedia Britannica Kids", "search_query": "gear machine", "type": "encyclopedia"}}
      ]

    Rules:
    - Body must be complete and thorough — never truncate or summarise.
    - Each option must cover a meaningfully different angle of the same concept.
    - Age-appropriate language throughout. No URLs in body — teacher adds links separately.
    - label: specific single-concept title (e.g. "What Is a Robot?", "Parts of a Robot", "Types of Robots")

  WORKSHEET BLOCK — body format (complete, verbatim, ready to print):

    **Learning Objective:**
    Students will [verb] [specific thing].

    **Duration:** Approximately [X] minutes for students to complete.

    **Worksheet Type:** [fill in the blanks | comprehension | answering questions | name the images | matching | drawing | multiple choice | essay writing]
      — pick the type most appropriate for the course age range (no essay writing for under 7s)

    **Worksheet Content:**
    [Write the COMPLETE verbatim student-facing worksheet text — every word, sentence, blank (___), question, answer option, matching pair, passage, or drawing prompt exactly as it would appear on the printed page.]

    **Answer Key:**
    [Complete answers for every blank, question, or item, numbered to match the worksheet.]

    label: worksheet title (e.g. "Robot Parts Labelling Sheet")

  ACTIVITY BLOCK — body format (complete, specific, ready to run):

    **Learning Objective:**
    Students will [verb] [specific thing].

    **Duration:** [X] minutes

    **Activity Type:** [quiz | discussion | experiment | teamwork | hands-on | game]

    **Resources/Materials Needed:**
    - [Material 1]
    (use "None required" if no materials needed)

    **Steps to Conduct:**
    1. [Setup — what to prepare before students arrive]
    2. [Introduction — how to frame the activity]
    3. [Main activity — what students do, in detail]
    4. [Debrief question]
    5. [Wrap-up]

    **Management Tips:**
    - [Tip 1: behavioral or logistical guidance]
    - [Tip 2: grouping or pacing strategy]
    - [Tip 3: transition or early-finisher guidance]

    Age-appropriate. No URLs. label: activity title (e.g. "Build-a-Robot Relay Race")

  Rules for all resource blocks:
  - Only generate when the teacher explicitly asks for a resource, worksheet, activity, or content block
  - Generate 2-3 meaningfully different options per request
  - Check existing_resources in the context — never repeat a title that already exists
  - Always pick age-appropriate worksheet types

When on the BLOCK page (apply_field "block_content"):
  body = the complete improved block text, maintaining the same **Header** structure used in the original.
  label = a short descriptive name for this version (e.g. "Clearer explanation", "More examples", "Simpler language")
  Generate 2-3 meaningfully different improvement approaches (e.g. one clearer, one with more examples, one age-adjusted).

When focused on a SECTION or SUBSECTION:
  "description" → body = rewritten description paragraph
  "title" → body = new title only
  "new_subsection" → body = description of the new subsection (label = its title)
  "new_topic" → body = description of the new topic box (label = its title)

General:
  "new_section" → adds a new top-level section (label = title, body = description)
  null → ONLY for holistic multi-field analysis spanning many items simultaneously

When the teacher asks for a worksheet, activity, or content block while focused on a topic, generate cards with the appropriate new_resource_* apply_field.

---

Course info:
{static_course_info}
Respond ONLY with valid JSON. No markdown, no preamble."""

        system_prompt = static_prompt + "\n\n---\n\nCurrent course context:\n" + dynamic_ctx

        messages = [{"role": "system", "content": system_prompt}]
        for msg in (request.conversation_history or []):
            messages.append({"role": msg.role, "content": msg.content})
        messages.append({"role": "user", "content": request.message})

        # Dynamic token ceiling: different intents need different room
        msg_lower = request.message.lower()
        if any(w in msg_lower for w in ['generate', 'add', 'create', 'make', 'give me', 'suggest', 'write me']):
            max_tokens = 4000   # Card generation: full blocks with complete worksheet content + answer keys
        elif any(w in msg_lower for w in ['change', 'edit', 'rewrite', 'update', 'fix', 'improve', 'modify']):
            max_tokens = 1200   # Edit: partial text only
        else:
            max_tokens = 2000   # Co-pilot conversation: thorough but bounded

        response = await generation_service.client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            temperature=0.7,
            max_tokens=max_tokens,
            response_format={"type": "json_object"}
        )

        raw = response.choices[0].message.content
        try:
            parsed = json.loads(raw)
            response_type = parsed.get("type", "cards")

            if response_type == "conversation":
                return {"type": "conversation", "message": parsed.get("message", raw)}

            if response_type == "edit":
                return {
                    "type": "edit",
                    "label": parsed.get("label", "Edited text"),
                    "text": parsed.get("text", ""),
                }

            # Cards response
            suggestions = parsed.get("suggestions", [])
            intro = parsed.get("intro", "")
            conclusion = parsed.get("conclusion", "")
            if not suggestions:
                # Fallback: treat as conversation if no suggestions
                return {"type": "conversation", "message": intro or raw}
            return {"type": "cards", "intro": intro, "suggestions": suggestions, "conclusion": conclusion}

        except Exception:
            return {"type": "conversation", "message": raw}

    except Exception as e:
        logger.error(f"Edo chat error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")


# ============================================================================
# EDO CHIP GENERATION ENDPOINT
# ============================================================================

class EdoChipsRequest(BaseModel):
    block_type: str  # "content" | "worksheet" | "activity"
    course_title: str
    topic_title: str
    topic_description: Optional[str] = None
    subsection_title: Optional[str] = None
    age_range: Optional[str] = None
    taxonomy_hints: Optional[List[str]] = []  # subcategory names from blockCategories

@router.post("/curriculum/chips")
async def generate_edo_chips(request: EdoChipsRequest):
    """Generate context-specific quick-chips for Edo block generation, tailored to the topic."""
    try:
        block_label = {"content": "content block", "worksheet": "worksheet", "activity": "activity"}.get(request.block_type, "block")
        taxonomy = ", ".join(request.taxonomy_hints) if request.taxonomy_hints else ""

        prompt = f"""You are helping a teacher build a {block_label} for a topic called "{request.topic_title}" in a course called "{request.course_title}".
{f'Subsection: {request.subsection_title}' if request.subsection_title else ''}
{f'Topic description: {request.topic_description}' if request.topic_description else ''}
{f'Student age range: {request.age_range}' if request.age_range else ''}

Your job is to generate 7-9 short, specific chip labels that represent the most useful and relevant things a teacher might want to generate a {block_label} about for THIS specific topic.

These chips will appear as clickable buttons. Each chip should be:
- Short (2-5 words max)
- Specific to the topic (e.g. for "3D Printing Basics": "What is a 3D Printer?", "Parts of a 3D Printer", "Types of 3D Printing" — NOT generic things like "Teamwork" or "Metacognition")
- Something a teacher would actually want to generate content about
- Concrete and actionable — readable at a glance on a small button

For context, here are some general educational subcategory directions you can draw from or adapt to the topic (only use the ones that make sense):
{taxonomy}

For a {block_label} on "{request.topic_title}", what would be the most useful, topic-specific chips?

Respond ONLY with a JSON object in this exact format, no markdown:
{{"chips": ["chip label 1", "chip label 2", "chip label 3", ...]}}

Generate 7-9 chips total."""

        response = await generation_service.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.6,
            max_tokens=300,
            response_format={"type": "json_object"}
        )

        raw = response.choices[0].message.content
        parsed = json.loads(raw)
        chips = parsed.get("chips", [])
        if not isinstance(chips, list):
            chips = []
        # Sanitise: strings only, trim, max 50 chars each
        chips = [str(c).strip()[:50] for c in chips if c][:10]
        return {"chips": chips}

    except Exception as e:
        logger.error(f"Edo chips error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Chip generation failed: {str(e)}")


# ── Block Link Generation ──────────────────────────────────────────────────────

class GenerateBlockLinksRequest(BaseModel):
    blockType: str  # "content" | "worksheet" | "activity"
    blockTitle: Optional[str] = ""
    blockContent: Optional[str] = ""
    topicTitle: Optional[str] = ""
    topicDescription: Optional[str] = ""
    gradeLevel: Optional[str] = ""
    teacherUid: Optional[str] = None


@router.post("/curriculum/generate-block-links")
async def generate_block_links(request: GenerateBlockLinksRequest):
    """
    Generate relevant resource links for a block using existing video/worksheet generators.
    - content blocks  → YouTube video links via the video generator (video_id → youtube.com/watch?v=...)
    - worksheet blocks → worksheet source URLs via worksheet generator (source_url)
    - activity blocks  → YouTube demo/tutorial video links via the video generator
    Returns { "links": [{ "url", "label", "type" }] }
    """
    try:
        import asyncio
        from populator.video_generator import generate_videos_for_section
        from hands_on.worksheet_generator import generate_worksheets_for_section

        block_title = (request.blockTitle or request.topicTitle or "").strip()

        # Build a rich description from block content so the generators have
        # more than just the title to work with.
        raw_content = (request.blockContent or "").strip()
        # Strip markdown-style headers (e.g. **Header**) and bullets for cleaner text
        import re
        clean_content = re.sub(r'\*\*(.+?)\*\*', r'\1', raw_content)
        clean_content = re.sub(r'^[-•]\s+', '', clean_content, flags=re.MULTILINE)
        content_snippet = clean_content[:400].strip()

        # Combine topic description + block content into a meaningful description
        description_parts = []
        if request.topicDescription:
            description_parts.append(request.topicDescription.strip())
        if content_snippet:
            description_parts.append(content_snippet)
        full_description = " ".join(description_parts)

        # Section dict compatible with both generators.
        # IMPORTANT: content_keywords inside components.instruction feed directly into
        # calculate_content_coverage's LLM prompt as "required content the video must cover".
        # Only put real topical keywords there — NOT meta-tags like "STEAM" or "educational video",
        # which the LLM penalises videos for not explicitly covering.
        section = {
            "id": f"block-{block_title[:20]}",
            "title": block_title or "Untitled",
            "description": full_description,
            "learning_objectives": [block_title] if block_title else [],
            "content_keywords": [],
            "duration_minutes": 20,
            "components": {
                "instruction": {
                    "learning_objectives": [block_title] if block_title else [],
                    "content_keywords": [],  # intentionally empty — block title + description are enough
                }
            },
        }

        logger.info(
            f"[generate-block-links] blockType={request.blockType!r} "
            f"title={block_title!r} grade={request.gradeLevel!r} "
            f"descLen={len(full_description)}"
        )

        grade_level = request.gradeLevel or "5"
        links: list = []

        loop = asyncio.get_event_loop()

        if request.blockType == "worksheet":
            # Extract keywords line from blockContent (format: "Keywords: a, b, c")
            keywords_from_content = ""
            for line in (request.blockContent or "").splitlines():
                if line.lower().startswith("keywords:"):
                    keywords_from_content = line.split(":", 1)[-1].strip()
                    break
            if keywords_from_content:
                user_prompt = f'"{block_title}" {keywords_from_content} worksheet'
            else:
                user_prompt = f'"{block_title}" worksheet'
            enriched = await loop.run_in_executor(
                None,
                generate_worksheets_for_section,
                section,
                grade_level,
                user_prompt,
                2,
            )
            for ws in enriched.get("worksheet_options", []):
                src = ws.get("source_url", "").strip()
                if src:
                    links.append({
                        "url": src,
                        "label": ws.get("worksheet_title", "Worksheet"),
                        "type": "worksheet",
                    })

        else:
            # content and activity both use video generator for YouTube links
            enriched = await loop.run_in_executor(
                None,
                generate_videos_for_section,
                section,
                grade_level,
                "",  # teacher_comments
            )
            for vid in enriched.get("video_resources", []):
                vid_id = vid.get("videoId", "").strip()  # camelCase matches youtube_handler output
                if vid_id:
                    links.append({
                        "url": f"https://www.youtube.com/watch?v={vid_id}",
                        "label": vid.get("title", "Video"),
                        "type": "video",
                    })

        logger.info(f"[generate-block-links] returning {len(links)} link(s): {[l.get('url','')[:60] for l in links]}")
        return {"links": links}

    except Exception as e:
        logger.error(f"Block link generation error: {e}", exc_info=True)
        return {"links": []}


# ============================================================================
# SYNOPSIS GENERATION
# ============================================================================

class SynopsisBlock(BaseModel):
    sectionTitle: str
    subsectionTitle: str
    blockType: str  # "content" | "worksheet" | "activity"
    blockTitle: str
    blockContent: Optional[str] = ""


class GenerateDescriptionRequest(BaseModel):
    courseName: str
    ageRangeStart: Optional[Any] = ""
    ageRangeEnd: Optional[Any] = ""
    numStudents: Optional[Any] = ""
    timeDuration: Optional[Any] = ""
    timeUnit: Optional[str] = ""
    objectives: Optional[str] = ""
    teacherUid: Optional[str] = None


@router.post("/curriculum/generate-description")
async def generate_description(request: GenerateDescriptionRequest):
    """
    Generate a one-paragraph course description based on the teacher's course info.
    Describes student learning outcomes and the general theme of the course.
    """
    try:
        age_start = str(request.ageRangeStart) if request.ageRangeStart not in (None, "", 0) else ""
        age_end   = str(request.ageRangeEnd)   if request.ageRangeEnd   not in (None, "", 0) else ""
        duration  = str(request.timeDuration)  if request.timeDuration  not in (None, "", 0) else ""

        age_info = ""
        if age_start and age_end:
            age_info = f" designed for students aged {age_start}–{age_end}"
        elif age_start:
            age_info = f" designed for students aged {age_start}+"

        duration_info = ""
        if duration and request.timeUnit:
            duration_info = f" The course spans {duration} {request.timeUnit}."
        elif duration:
            duration_info = f" The course runs for {duration}."

        objectives_info = f"\n\nThe teacher has outlined the following goals and notes:\n{request.objectives}" if request.objectives else ""

        system_prompt = (
            "You are an educational curriculum assistant writing professional course documentation. "
            "Write exactly one concise paragraph in a clear, informative, and engaging tone. "
            "The paragraph should describe what students will learn and what skills or understanding they will gain, "
            "as well as the general theme or approach of the course. Infer the subject and theme from the course name. "
            "Do not use bullet points or headers. Do not start with 'This course'. Refer to learners as 'students'."
        )

        user_prompt = (
            f"Write a one-paragraph description for the course \"{request.courseName}\"{age_info}.{duration_info}"
            f"{objectives_info}\n\n"
            f"The paragraph should cover:\n"
            f"1. The general theme and focus of the course\n"
            f"2. What students will learn and the key skills or concepts they will develop\n"
            f"3. The learning outcomes — what students will be able to do or understand by the end\n\n"
            f"Keep it to a single paragraph of 3–5 sentences. Write for a general audience (parents and students)."
        )

        response = await generation_service.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.7,
            max_tokens=300,
        )

        description_text = response.choices[0].message.content.strip()
        logger.info(f"[generate-description] Generated description ({len(description_text)} chars) for course '{request.courseName}'")
        return {"success": True, "description": description_text}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Description generation error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


class GenerateSynopsisRequest(BaseModel):
    courseName: str
    classLevel: Optional[str] = ""
    teacherUid: Optional[str] = None
    selectedBlocks: List[SynopsisBlock]


@router.post("/curriculum/generate-synopsis")
async def generate_synopsis(request: GenerateSynopsisRequest):
    """
    Generate a parent-facing narrative synopsis of a completed course.
    The teacher selects which blocks (content/worksheet/activity) were completed,
    and this returns a 3–5 paragraph friendly summary for parents.
    """
    try:
        if not request.selectedBlocks:
            raise HTTPException(status_code=400, detail="At least one block must be selected")

        # Group blocks by section then subsection for a structured narrative
        from collections import defaultdict
        grouped: dict = defaultdict(lambda: defaultdict(list))
        for blk in request.selectedBlocks:
            grouped[blk.sectionTitle][blk.subsectionTitle].append(blk)

        # Build a structured summary for the prompt
        structure_lines = []
        for section_title, subsections in grouped.items():
            structure_lines.append(f"\nSection: {section_title}")
            for sub_title, blocks in subsections.items():
                structure_lines.append(f"  Lesson: {sub_title}")
                for b in blocks:
                    type_label = {"content": "Content", "worksheet": "Worksheet", "activity": "Activity"}.get(b.blockType, b.blockType.title())
                    structure_lines.append(f"    [{type_label}] {b.blockTitle}")

        structure_text = "\n".join(structure_lines)

        age_info = f" for students aged {request.classLevel}" if request.classLevel else ""

        system_prompt = (
            "You are an educational curriculum assistant writing professional course documentation. "
            "Write in a clear, informative, and professional tone. Refer to learners as 'students' throughout. "
            "Infer the subject and theme from the course name. "
            "Do not use bullet points or headers — write flowing paragraphs."
        )

        user_prompt = (
            f"Write a detailed synopsis for the course \"{request.courseName}\"{age_info}. "
            f"The following lessons and activities were completed:\n{structure_text}\n\n"
            f"Write 3–5 paragraphs that:\n"
            f"1. Open with a concise overview of what the course covered and its learning goals\n"
            f"2. Describe the key lessons and concepts students engaged with in each section\n"
            f"3. Highlight the worksheets and hands-on activities that were completed (mention them by name)\n"
            f"4. Close with the skills and knowledge students have developed through this course\n\n"
            f"Write in a professional, neutral tone suitable for any reader. Always use 'students', never 'children' or 'kids'."
        )

        response = await generation_service.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.7,
            max_tokens=1000,
        )

        synopsis_text = response.choices[0].message.content.strip()
        logger.info(f"[generate-synopsis] Generated synopsis ({len(synopsis_text)} chars) for course '{request.courseName}'")
        return {"success": True, "synopsis": synopsis_text}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Synopsis generation error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
