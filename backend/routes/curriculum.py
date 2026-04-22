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
        course_ctx = ""
        if request.context:
            course = request.context.get("course", {})
            selected = request.context.get("selected_item", {})
            structure = request.context.get("course_structure", [])

            # Course-level info
            grade = course.get("grade", "")
            subject = course.get("subject", "")
            topic = course.get("topic", "")
            duration = course.get("duration", "")
            grade_str = f"Grade {grade}" if grade else "unknown grade"
            subject_str = f" | Subject: {subject}" if subject else ""
            topic_str = f" | Topic: {topic}" if topic else ""
            duration_str = f" | Duration: {duration}" if duration else ""
            course_ctx = f'Course: "{course.get("title", "Untitled")}" ({grade_str}{subject_str}{topic_str}{duration_str})\n'
            if course.get("description"):
                course_ctx += f'Course objectives: {course["description"]}\n'

            # Full course structure overview
            if structure:
                course_ctx += '\nFull course structure:\n'
                for i, sec in enumerate(structure, 1):
                    subsecs = sec.get("subsections", [])
                    course_ctx += f'  Section {i}: {sec["title"]}'
                    if subsecs:
                        sub_names = [ss["title"] for ss in subsecs]
                        course_ctx += f' → {", ".join(sub_names)}'
                    course_ctx += '\n'

            # Currently focused item
            item_type = selected.get("type", "course")
            course_ctx += f'\nCurrently focused on ({item_type}): "{selected.get("title", "")}"\n'
            if selected.get("parent_section"):
                course_ctx += f'Parent section: {selected["parent_section"]}\n'
            if selected.get("parent_subsection"):
                course_ctx += f'Parent subsection: {selected["parent_subsection"]}\n'
            if selected.get("description"):
                course_ctx += f'Description: {selected["description"]}\n'
            if selected.get("subsections"):
                course_ctx += f'Subsections: {", ".join(selected["subsections"])}\n'
            if selected.get("topic_boxes"):
                course_ctx += f'Topic boxes: {", ".join(selected["topic_boxes"])}\n'
            if selected.get("learning_objectives"):
                course_ctx += f'Learning objectives: {"; ".join(selected["learning_objectives"])}\n'
            if selected.get("pla_pillars"):
                course_ctx += f'PLA pillars: {", ".join(selected["pla_pillars"])}\n'

        system_prompt = f"""You are Edo, an expert curriculum design assistant inside EdCube. You think like an experienced K-12 curriculum designer — you understand scope, sequencing, and what makes learning actually stick.

Your job is to help teachers build well-structured, specific, PLA-aligned curriculum by suggesting high-quality sections, subsections, and topic boxes.

---

QUALITY STANDARDS — apply these to every suggestion:

SECTION — a logical chapter of the course
- Before suggesting, scan the full course structure below — every new section must cover territory NONE of the existing sections touch
- Title names the specific aspect of the subject being explored (never "Introduction", "Core Concepts", "Review")
- Description (2-3 sentences): exactly what students encounter, what angle it takes, how it fits the arc

SUBSECTION — a focused lesson cluster within a section
- Before suggesting, scan existing subsections in the parent section — the new one must bring a genuinely new angle
- Title tells exactly what learning happens (one concept or skill, not a theme)
- Description scopes the 30-45 minute lesson block concretely

TOPIC BOX — the atomic unit of learning (most critical to get right)
- NARROW: covers exactly ONE specific concept or activity. "Photosynthesis" is too broad — "How Chlorophyll Captures Sunlight to Make Sugar" is correct.
- Description (2-3 sentences): name the exact objects, scenarios, or data students engage with. No vague phrases ("explore", "learn about", "discover"). Must be specific enough to find a real YouTube video or worksheet for it.
- Learning objectives: 2-3, measurable, each starting with a specific action verb (identify, calculate, compare, label, explain, demonstrate, measure, predict). Specific enough to write a test question from.
- IMPORTANT: description and objectives are always suggested TOGETHER in a single card — never separately.

UNIQUENESS: For every suggestion type, compare against all existing items in context before generating. Do not repeat anything that already exists.

PLA PILLARS — map topic boxes to 1-2:
- Personal Growth: self-reflection, identity, teamwork, emotional awareness
- Core Learning: facts, vocabulary, foundational concepts, skills
- Critical Thinking: analysis, comparison, debate, synthesis, why/how questions
- Application & Impact: real-world projects, career connections, making something

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

When focused on a TOPIC BOX — always use "topic_full":
  apply_field: "topic_full"
  body format (exactly this structure):
    [2-3 sentence concrete description]

    Objectives:
    Students will [action verb] [specific thing]
    Students will [action verb] [specific thing]
    Students will [action verb] [specific thing]
  NEVER use "description", "objectives", "new_subsection", "new_section", or "new_topic" for a topic box.

When focused on a SECTION or SUBSECTION:
  "description" → body = rewritten description paragraph
  "title" → body = new title only
  "new_subsection" → body = description of the new subsection (label = its title)
  "new_topic" → body = description of the new topic box (label = its title)

General:
  "new_section" → adds a new top-level section (label = title, body = description)
  null → ONLY for holistic multi-field analysis spanning many items simultaneously

Videos and worksheets are generated by separate buttons — if asked, direct the teacher to the green resource chips.

---

Current course context:
{course_ctx}

Respond ONLY with valid JSON. No markdown, no preamble."""

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
