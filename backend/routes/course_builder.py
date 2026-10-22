"""
Course Builder Stage 2 routes: plan each day as named one-hour lessons of four 15-minute blocks, ask for more
ideas, and hand the finalized plan (day = section, hour = subsection) to the existing
block-content generation + save. Teaching time per day is whole hours only: a request with a
fractional hours_per_day / hoursPerDay is rejected with a plain 422.

Same conventions as the Stage 1 course-builder routes in routes/curriculum.py: nothing is
persisted before the course is built (the frontend sends the chosen outline and the
course_context back). Every route requires a Firebase ID token (require_org).
"""

import asyncio
import json
import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from routes.teachers import require_org, resolve_caller_uid
from services.usage_service import enforce_quota, throttle_chips, refund_charge, defer_settlement, settle_charge, track_ai
from outliner.course_day_planner import (
    DayPlanningError, library_topup_event, library_topup_enabled, library_topup_failed_event,
    library_topup_timeout, more_ideas, parse_context, plan_day,
    taught_titles, _find_day,
)
from outliner.course_builder_handoff import PlanRejected, to_generation_inputs, validate_plan_with_notes
from outliner.course_outline_generator import check_outline_limits, check_day_shape, outline_to_legacy
from utils.llm_handler import OpenAIServiceError

logger = logging.getLogger(__name__)
router = APIRouter()

SSE_HEADERS = {"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"}


def _sse(payload: Dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"


class PlanDaysRequest(BaseModel):
    course_context: Dict[str, Any]
    outline: Dict[str, Any]                       # the chosen (possibly edited) builder outline
    day_ids: Optional[List[str]] = Field(default=None, max_length=60)  # default: every day, in order
    # Topic titles already planned for days NOT in this request, keyed by day id
    earlier_topics: Dict[str, List[str]] = Field(default_factory=dict)  # hour-lesson titles


class PlanDayRequest(BaseModel):
    course_context: Dict[str, Any]
    outline: Dict[str, Any]
    day_id: str = Field(..., max_length=80)
    earlier_topics: List[str] = Field(default_factory=list, max_length=200)  # hour-lesson titles of earlier days


class DayIdeasRequest(PlanDayRequest):
    # The day's hours (as `topics`), each with ALL its blocks (placed and library), so ideas don't repeat them
    # and every new idea gets a home hour
    current_topics: List[Dict[str, Any]] = Field(default_factory=list, max_length=12)
    count: int = Field(6, ge=2, le=10)


@router.post("/course-builder/plan-days", dependencies=[Depends(enforce_quota("generates", "plan_days"))])
async def course_builder_plan_days(body: PlanDaysRequest, current_user: dict = Depends(require_org)):
    """
    SSE. Plans days one after another (a day sees the topics of the days before it).
    Events (each `data: {json}`):
      {type:'day_started', day_id, day_number, progress, message}
      {type:'day_planned', day_id, day_number, plan: <day plan: hours, topics (= the hours), placed, library, ...>,
       progress, message}
      {type:'day_library', day_id, day_number, topped_up, topics, blocks, notices, objective_coverage,
       warnings, progress}   # additive: spare ideas for that day's library, sent as soon as its top-up finishes (AFTER its
                             # day_planned; may arrive while a later day is being planned; a top-up over
                             # the time limit is sent with topped_up:false); always before plans_complete
      {type:'day_failed',  day_id, day_number, error: str, progress}    # run continues with the next day
      {type:'plans_complete', planned_day_ids, failed_day_ids, progress: 100}
      {message, error: true}      # fatal: AI service unavailable (run stops)
    """
    try:
        parse_context(body.course_context)
        check_outline_limits(body.outline)
        days = body.outline.get("days")
        if not isinstance(days, list) or not days:
            raise ValueError("outline.days is required")
        for d in days:
            check_day_shape(d)
        order = [d["id"] for d in days]
        wanted = body.day_ids if body.day_ids is not None else order
        for did in wanted:
            if did not in order:
                raise ValueError(f"day '{did}' is not in the outline")
        wanted = [d for d in order if d in set(wanted)]  # outline order, no duplicates
        if not wanted:
            raise ValueError("no days to plan")
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    async def generate():
        # Day planning and library top-ups run as tasks that all feed one queue; this generator only
        # drains it, so each event goes out the moment it exists. A day's top-up is started after its
        # day_planned is queued (so day_library never precedes it), never delays the next day's planning
        # (separate task), and the planner waits for all top-ups before plans_complete.
        queue: asyncio.Queue = asyncio.Queue()
        done = object()
        topups: List[asyncio.Task] = []
        planned_titles: Dict[str, List[str]] = {}
        planned_ok, failed = [], []

        async def run_topup(did: str, number: int, plan: Dict, earlier: List[str]):
            limit = library_topup_timeout()
            try:
                payload = await asyncio.wait_for(asyncio.to_thread(
                    library_topup_event, body.course_context, body.outline, plan, earlier), limit)
            except asyncio.TimeoutError:
                # the worker thread's model call keeps running and its result is discarded
                logger.warning("Library top-up for %s exceeded %ss; sent as unavailable", did, limit)
                payload = await asyncio.to_thread(library_topup_failed_event, plan, "library top-up timed out")
            except asyncio.CancelledError:
                raise
            except Exception as e:  # noqa: BLE001 - never fails the run
                logger.warning("Library top-up task for %s failed: %s", did, e)
                payload = await asyncio.to_thread(library_topup_failed_event, plan)
            if payload:  # None = top-up skipped (enough spare ideas)
                await queue.put(_sse({"type": "day_library", "day_id": did, "day_number": number, **payload,
                                      "progress": int(len(planned_ok) / len(wanted) * 100)}))

        async def plan_all():
            try:
                for n, did in enumerate(wanted):
                    number = order.index(did) + 1
                    pct = int(n / len(wanted) * 100)
                    await queue.put(_sse({"type": "day_started", "day_id": did, "day_number": number,
                                          "progress": pct, "message": f"Planning day {number}..."}))
                    earlier: List[str] = []
                    for prev in order[: number - 1]:
                        earlier += planned_titles.get(prev) or body.earlier_topics.get(prev) or []
                    try:
                        plan = await asyncio.to_thread(plan_day, body.course_context, body.outline, did, earlier)
                    except DayPlanningError as e:
                        failed.append(did)
                        await queue.put(_sse({"type": "day_failed", "day_id": did, "day_number": number,
                                              "error": str(e), "progress": pct}))
                        continue
                    except OpenAIServiceError as e:
                        if not planned_ok:
                            refund_charge(current_user, "generates")  # fatal before any day completed
                        await queue.put(_sse({"message": str(e), "error": True}))
                        return  # fatal: the run stops (finally below cancels top-ups)
                    except Exception as e:  # noqa: BLE001 - one bad day must not kill the stream
                        logger.error("plan-days error on %s: %s", did, e, exc_info=True)
                        failed.append(did)
                        await queue.put(_sse({"type": "day_failed", "day_id": did, "day_number": number,
                                              "error": "Could not plan this day. Please try again.", "progress": pct}))
                        continue
                    planned_titles[did] = taught_titles(plan)  # library-only topics are not taught that day
                    planned_ok.append(did)
                    await queue.put(_sse({"type": "day_planned", "day_id": did, "day_number": number, "plan": plan,
                                          "progress": int((n + 1) / len(wanted) * 100), "message": f"Day {number} planned"}))
                    if library_topup_enabled():
                        topups.append(asyncio.ensure_future(run_topup(did, number, plan, earlier)))
                if topups:  # every top-up is delivered before plans_complete
                    await asyncio.gather(*topups, return_exceptions=True)
                await queue.put(_sse({"type": "plans_complete", "planned_day_ids": planned_ok,
                                      "failed_day_ids": failed, "progress": 100}))
            except asyncio.CancelledError:
                raise
            except Exception as e:  # noqa: BLE001
                logger.error("plan-days error: %s", e, exc_info=True)
                if not planned_ok:
                    refund_charge(current_user, "generates")
                await queue.put(_sse({"message": f"Error: {e}", "error": True}))
            finally:
                for t in topups:  # run ended early (fatal error): drop pending top-ups
                    if not t.done():
                        t.cancel()
                await queue.put(done)

        planner = asyncio.ensure_future(plan_all())
        try:
            while True:
                item = await queue.get()
                if item is done:
                    break
                yield item
        finally:
            # client left (or run over): cancel everything still outstanding and let it settle
            for t in [planner, *topups]:
                if not t.done():
                    t.cancel()
            await asyncio.gather(planner, *topups, return_exceptions=True)
            # Credit (TASK-033): one "generates" per run, charged only if at least one day was planned.
            settle_charge(current_user, "generates", bool(planned_ok), action="plan_days",
                          planned_days=len(planned_ok), failed_days=len(failed))

    defer_settlement(current_user, "generates")   # the stream settles the credit when it ends
    return StreamingResponse(generate(), media_type="text/event-stream", headers=SSE_HEADERS)


@router.post("/course-builder/plan-day", dependencies=[Depends(enforce_quota("generates", "plan_day"))])
async def course_builder_plan_day(body: PlanDayRequest, current_user: dict = Depends(require_org)):
    """Plan (or re-plan) a single day. Plain JSON: the day plan. 422 bad input, 502 AI failure."""
    try:
        # one JSON response: the plan with its library already topped up (plan.notices covers both)
        return await asyncio.to_thread(plan_day, body.course_context, body.outline, body.day_id,
                                       body.earlier_topics, None, library_topup=library_topup_enabled())
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except (DayPlanningError, OpenAIServiceError) as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:  # noqa: BLE001 - unreadable model output is a 502, never a 500
        logger.error("plan-day error: %s", e, exc_info=True)
        raise HTTPException(status_code=502, detail="Could not plan this day. Please try again.")


@router.post("/course-builder/day-ideas", dependencies=[Depends(enforce_quota("generates", "day_ideas"))])
async def course_builder_day_ideas(body: DayIdeasRequest, current_user: dict = Depends(require_org)):
    """More spare blocks for a day's library. Returns {day_id, block_minutes, topics (new only), blocks, warnings, notices}."""
    try:
        return await asyncio.to_thread(
            more_ideas, body.course_context, body.outline, body.day_id, body.current_topics,
            body.earlier_topics, body.count)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except (DayPlanningError, OpenAIServiceError) as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:  # noqa: BLE001
        logger.error("day-ideas error: %s", e, exc_info=True)
        raise HTTPException(status_code=502, detail="Could not come up with more ideas. Please try again.")


class PlannedDay(BaseModel):
    day_id: str = Field(..., max_length=80)
    topics: List[Dict[str, Any]] = Field(..., max_length=20)   # the day's hours: {id, title, icon, priority}
    blocks: List[Dict[str, Any]] = Field(..., max_length=100)  # placed blocks only
    # The teacher's final arrangement: [{id: <hour id>, block_ids: [placed block ids in order]}]. Optional
    # (older clients): without it the placed order is cut into hours of four blocks.
    hours: Optional[List[Dict[str, Any]]] = Field(default=None, max_length=40)


class BuildCourseRequest(BaseModel):
    presetCourseId: str
    teacherUid: Optional[str] = None  # optional; token uid is authoritative
    organizationId: str
    courseName: str = Field(..., max_length=300)
    ageRangeStart: int
    ageRangeEnd: int
    numStudents: int
    numDays: int
    hoursPerDay: float
    objectives: str = Field("", max_length=20000)
    courseAttachments: List[Dict[str, Any]] = Field(default_factory=list, max_length=50)
    subject: str = Field("", max_length=300)
    topic: str = Field("", max_length=300)
    outline: Dict[str, Any]                       # the chosen (possibly edited) builder outline
    days: List[PlannedDay] = Field(..., max_length=60)


@router.post("/course-builder/build-course", dependencies=[Depends(track_ai("build_course"))])
async def course_builder_build_course(body: BuildCourseRequest, current_user: dict = Depends(require_org)):
    """
    Build hand-off. Validates the teacher's finalized plan (including the server-side hard
    caps: an hour never holds more than 4 blocks -> 422 code `hour_over_capacity`, a day's blocks never
    exceed hoursPerDay x 4 -> 422 `over_capacity`, both with `problems`; a non-whole hoursPerDay -> 422), converts it to
    the existing section / subsection / block shapes and runs the existing /generate-blocks
    pipeline (SSE stream and save are identical to that route's).
    """
    from routes.curriculum import GenerateBlocksRequest, SubsectionSelection, generate_blocks
    uid = resolve_caller_uid(current_user, body.teacherUid)  # 403 before any work / stream
    try:
        check_outline_limits(body.outline)
        for d in body.outline.get("days") or []:
            check_day_shape(d)
        if not body.outline.get("days"):
            raise ValueError("outline.days is required")
        days, notes = validate_plan_with_notes(body.hoursPerDay, body.outline, [d.model_dump() for d in body.days])
    except PlanRejected as e:
        raise HTTPException(status_code=422, detail={"message": str(e), "problems": e.problems})
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    from outliner.course_day_planner import slots_for_hours
    legacy = outline_to_legacy(body.outline, body.courseName, body.subject, body.topic,
                               body.ageRangeStart, body.ageRangeEnd)
    outline, selections = to_generation_inputs(legacy, days, {"slots": slots_for_hours(body.hoursPerDay)})
    if notes:
        logger.info("build-course notes: %s", notes)
    req = GenerateBlocksRequest(
        presetCourseId=body.presetCourseId, teacherUid=uid, organizationId=body.organizationId,
        courseName=body.courseName, ageRangeStart=body.ageRangeStart, ageRangeEnd=body.ageRangeEnd,
        numStudents=body.numStudents, numDays=body.numDays, hoursPerDay=body.hoursPerDay,
        objectives=body.objectives, courseAttachments=body.courseAttachments, outline=outline,
        selections=[SubsectionSelection(**s) for s in selections],
    )
    response = await generate_blocks(req, current_user)
    if not notes:
        return response

    inner = response.body_iterator

    async def with_notes():
        # non-fatal notes first, before generation starts; the rest of the stream is untouched
        yield _sse({"type": "build_notes", "notes": notes, "progress": 0})
        async for chunk in inner:
            yield chunk

    return StreamingResponse(with_notes(), media_type=response.media_type, headers=SSE_HEADERS)
