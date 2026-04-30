# FILE 1: backend/routes/curriculum.py

"""
Curriculum generation routes - PHASE 1 ONLY
Generates boxes/topics without any video or worksheet population
"""

from fastapi import APIRouter, HTTPException, Depends, Form, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, Dict, List
import json
import asyncio
import logging
import os
import tempfile
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
    course_name:     str = Form(...),
    age_range_start: int = Form(...),
    age_range_end:   int = Form(...),
    num_students:    int = Form(...),
    subject:         str = Form(...),
    topic:           str = Form(...),
    time_duration:   str = Form(...),
    num_worksheets:  int = Form(...),
    num_activities:  int = Form(...),
    objectives:      str = Form(""),
    teacherUid:      str = Form(...),
    organizationId:  str = Form(...),
    files: List[UploadFile] = File(default=[]),
):
    """
    PHASE 1 ONLY: Generate curriculum boxes/topics.
    Accepts multipart/form-data so teachers can attach reference files
    (PDF, Word, Excel, PPT, images) alongside the form fields.
    """
    # ── Read all file bytes EAGERLY before the generator ──────────────────
    # UploadFile objects are closed after the request, so we must read them
    # here (in the endpoint body) before handing control to the SSE generator.
    file_bytes: List[tuple] = []  # list of (filename, ext, bytes)
    for uf in (files or []):
        ext = os.path.splitext(uf.filename)[1].lower()
        data = await uf.read()
        file_bytes.append((uf.filename, ext, data))

    async def generate():
        tmp_paths = []
        try:
            yield f"data: {json.dumps({'phase': 0, 'message': 'Starting...', 'progress': 0})}\n\n"
            await asyncio.sleep(0.1)

            # ── Write pre-read bytes to temp files & extract content ────────
            extracted_text = ""
            vision_images = []

            if file_bytes:
                yield f"data: {json.dumps({'phase': 0, 'message': 'Reading attached files...', 'progress': 5})}\n\n"
                from services.file_parser import extract_content_from_uploaded_files

                file_tuples = []
                for filename, ext, data in file_bytes:
                    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
                        tmp.write(data)
                        tmp_paths.append(tmp.name)
                        file_tuples.append((tmp.name, ext))

                result = await extract_content_from_uploaded_files(file_tuples)
                extracted_text = result['extracted_text']
                vision_images = result['images']

            # ── Merge objectives + extracted file text ──────────────────────
            full_objectives = objectives or ""
            if extracted_text.strip():
                full_objectives = (
                    (full_objectives + "\n\n") if full_objectives else ""
                ) + "ATTACHED MATERIALS:\n" + extracted_text

            yield f"data: {json.dumps({'phase': 1, 'message': 'Generating curriculum outline...', 'progress': 10})}\n\n"

            outline_data = await orchestrator.run_phase1(
                {
                    'age_range_start': age_range_start,
                    'age_range_end':   age_range_end,
                    'num_students':    num_students,
                    'subject':         subject,
                    'topic':           topic,
                    'duration':        time_duration,
                    'num_worksheets':  num_worksheets,
                    'num_activities':  num_activities,
                    'objectives':      full_objectives,
                },
                images=vision_images or None,
            )

            if not outline_data:
                yield f"data: {json.dumps({'phase': 1, 'message': 'Error: Failed to generate outline', 'progress': 0, 'error': True})}\n\n"
                return

            yield f"data: {json.dumps({'phase': 1, 'message': 'Outline generated!', 'progress': 80})}\n\n"
            await asyncio.sleep(0.3)

            yield f"data: {json.dumps({'phase': 1, 'message': 'Saving curriculum...', 'progress': 90})}\n\n"

            curriculum_id = await firebase.save_curriculum(
                teacherUid=teacherUid,
                curriculum_data={
                    'course_name':     course_name,
                    'age_range_start': age_range_start,
                    'age_range_end':   age_range_end,
                    'num_students':    num_students,
                    'subject':         subject,
                    'topic':           topic,
                    'duration':        time_duration,
                    'outline':         outline_data,
                    'sections':        outline_data.get('sections', []),
                },
                organizationId=organizationId,
            )

            yield f"data: {json.dumps({'phase': 1, 'message': 'Complete!', 'progress': 100, 'curriculum_id': curriculum_id, 'done': True})}\n\n"

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
            subject = course.get("subject", "")
            topic = course.get("topic", "")
            duration = course.get("duration", "")

            subject_str = f" | Subject: {subject}" if subject else ""
            topic_str = f" | Topic: {topic}" if topic else ""
            duration_str = f" | Duration: {duration}" if duration else ""
            students_str = f" | Class size: {num_students}" if num_students else ""

            static_course_info = (
                f'Course: "{course.get("title", "Untitled")}"'
                f' (Ages: {age_range}{subject_str}{topic_str}{duration_str}{students_str})\n'
            )
            if course.get("description"):
                static_course_info += f'Course objectives: {course["description"]}\n'

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
  - Title: short, specific, names exactly what the lesson cluster covers. No filler words.
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

When the teacher's message is exploratory, vague, or you need to clarify scope:
{{"type": "conversation", "message": "..."}}
Keep it short. End with a sharp question or "Want me to generate options?"

When the teacher confirms or asks for suggestions:
{{"type": "cards", "intro": "...", "suggestions": [...], "conclusion": "..."}}

Cards format:
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

  CONTENT BLOCK — body format (MANDATORY — use ALL 5 sections, every time, no exceptions):
    Do NOT generate short summaries, definitions only, or partial structures. Every content block MUST contain all 5 sections below. A content block without all 5 sections is malformed.

    **What is [concept name]?**
    A clear, age-appropriate definition in 1-2 sentences. Use simple words for young students.

    **Key [concept-specific noun] / components:**
    - [Part or element 1]: brief explanation
    - [Part or element 2]: brief explanation
    - [Part or element 3]: brief explanation
    (3-5 bullet points covering the main components, vocabulary, or sub-concepts — specific to the topic, not generic)

    **How to teach it:**
    Step-by-step delivery approach — what to show first, what analogy to use, how to check understanding. 2-3 sentences.

    **Things to consider:**
    Tips, common misconceptions students have, or differentiation ideas. 1-2 sentences.

    **Example:**
    One concrete, specific example the teacher can use in class. Make it relatable to the course age group.

    Rules for content blocks:
    - ALWAYS include all 5 sections. Never skip any section. Never truncate.
    - Adapt the header wording to the concept (e.g. "Key robot parts:" not "Key parts:", "Key printing steps:" not "Key parts:").
    - Each option should focus on a meaningfully different angle of the same concept (e.g. one more visual/concrete, one more technical, one with a stronger analogy).
    - Keep language age-appropriate. Simpler for younger students, more precise for older.
    - No URLs — teacher adds links separately.
    label: short descriptive title starting with "What is…" or the concept name (e.g. "What Is a Robot?" or "3D Printer Basics")

  WORKSHEET BLOCK — body format:
    Line 1: Type: [fill in the blanks | name the images | drawing | matching | multiple choice | essay writing]
      — pick the type most appropriate for the course age range (e.g. no essay writing for under 7s)
    Line 2: Keywords: [2-5 keyword phrases the worksheet covers, e.g. "robot parts, sensors, movement"]
    Line 3-4: Brief description of what the worksheet asks students to do.
    label: worksheet title (e.g. "Robot Parts Labelling Sheet")

  ACTIVITY BLOCK — body format:
    Line 1: Type: [quiz | discussion | experiment | teamwork | hands-on]
    Line 2-4: Step-by-step teacher instructions — setup, grouping, what students do, timing, debrief question.
    Be concrete and specific. Age-appropriate. No URLs — teacher adds links separately.
    label: activity title (e.g. "Build-a-Robot Relay Race")

  SUBCATEGORY-SPECIFIC CONTENT — ONLY applies when the teacher's message contains the word "STRICTLY" followed by a subcategory name (e.g. "STRICTLY about 'Definitions'"). In that case, OVERRIDE the 5-section structure and use the subcategory-specific format:
  - "Definitions" → A full, rich definition block. Use this structure:
      **What is [term]?**
      Full definition in 2-3 sentences — what it is, what it does, and how it works in simple terms.
      **Where does the word/concept come from?**
      Etymology, origin, or context that helps students remember it (1-2 sentences).
      **In plain English:**
      A one-sentence analogy or comparison to something students already know (e.g. "It works like a…").
      **Key vocabulary connected to this term:**
      - [Related term 1]: one-sentence definition
      - [Related term 2]: one-sentence definition
      - [Related term 3]: one-sentence definition
      **Why it matters:**
      1-2 sentences on why this concept is relevant to the course topic or real world.
      Do NOT include How to teach it or activity sections.
  - "Concepts" or "Key Concepts" → A rich concept map block. Structure:
      **Core Concept: [name]**
      What this concept means and why it matters (2-3 sentences).
      **How this concept works:**
      3-5 bullet points, each explaining a distinct facet or mechanism with a concrete example.
      **Common misconception:**
      One thing students often get wrong and the correct explanation.
      **Real-world connection:**
      One specific real-world application relevant to the course.
  - "Parts of" or "Types of" → A thorough breakdown block. Structure:
      **[Topic] — Parts/Types Overview**
      Brief intro sentence explaining why understanding the parts/types matters.
      **The [N] main parts/types:**
      - **[Part/Type 1]:** What it is, what it does, and one concrete example (2-3 sentences).
      - **[Part/Type 2]:** Same format.
      - **[Part/Type 3]:** Same format.
      (Cover 4-6 parts/types minimum. Be specific — name the actual real-world parts, not generic labels.)
      **How the parts work together:**
      1-2 sentences on the relationship between the parts/types.
  - "How to teach it" → A teaching guide block. Structure:
      **Teaching [concept]: Step-by-Step**
      1. [Step 1]: What to do and say (1-2 sentences)
      2. [Step 2]: ...
      (5-7 numbered steps covering setup, introduction, main activity, checking understanding, wrap-up.)
      **Suggested timing:** X minutes per step.
      **What to watch for:** 1-2 common points where students get confused.
  - Soft skills subcategories (e.g. "Emotional Intelligence", "Communication", "Teamwork") → A scenario-based block. Structure:
      **What is [skill]?** 1-2 sentence definition.
      **Why it matters:** 1-2 sentences on real-world relevance for students.
      **Scenario:** A specific, relatable classroom or life scenario (3-4 sentences).
      **Discussion questions:** 3 reflection prompts students can discuss.
      **Quick practice:** One concrete 5-minute activity to practice the skill.
  - "Real-world Examples" → A concrete examples block. Structure:
      **[Topic] in the Real World**
      Brief intro (1 sentence).
      **Example 1 — [Specific named example]:** 2-3 sentences describing how it works and why it's relevant.
      **Example 2 — [Specific named example]:** Same format.
      **Example 3 — [Specific named example]:** Same format.
      **What these examples have in common:** 1-2 sentences on the pattern.
  - Activity subcategories (e.g. "Hands-on Building") → Use ACTIVITY BLOCK format.
  Rule: The subcategory override ONLY applies when "STRICTLY" is in the message. For all other content block requests, ALWAYS use the full 5-section structure above.

  Rules:
  - Only use these when the teacher explicitly asks for a resource, worksheet, activity, or content block, OR when they click the generate buttons for content/worksheet/activity
  - Generate 2-3 meaningfully different options per request
  - Check existing_resources in the context — never repeat a title that already exists
  - Always pick age-appropriate worksheet types (no essay writing for students under 7)

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

        response = await generation_service.client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            temperature=0.7,
            max_tokens=1400,
            response_format={"type": "json_object"}
        )

        raw = response.choices[0].message.content
        try:
            parsed = json.loads(raw)
            response_type = parsed.get("type", "cards")

            if response_type == "conversation":
                return {"type": "conversation", "message": parsed.get("message", raw)}

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
    subject: Optional[str] = ""
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
