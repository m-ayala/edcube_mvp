import { createContext, useContext, useRef, useState } from 'react';
import { COURSE_BUILDER_ENABLED } from '../constants/featureFlags';
import { authFetch, legacyErrorFromResponse } from '../services/authFetch';
import { streamPlanDays, planDay, streamBuildCourse } from '../services/courseBuilderApi';
import { hourCapacity, placeBlocker } from '../components/courseBuilder/dayPlan';

const GenerationContext = createContext(null);

const IDLE = {
  status: 'idle',
  formData: null,
  targetFolderId: null,
  teacherUid: null,
  organizationId: null,
  sections: [],
  rawOutline: null,
  interpretedRequirements: null,
  presetCourseId: null,
  courseAttachments: [],
  candidatesBySection: {},
  handsOnResources: {},
  curriculumId: null,
  progress: { message: '', percent: 0 },
  pendingSubsectionIds: new Set(),
  // Course Builder (only populated when COURSE_BUILDER_ENABLED). See GenerationProvider
  // for the shape. null for the legacy flow.
  builder: null,
};

function mapOutlineToSections(outline) {
  // Phase 1 no longer produces subsections — each section starts empty and is
  // filled in once Phase 1.5 candidates are proposed and the teacher selects.
  return (outline?.sections || []).map(section => ({
    id: section.id,
    title: section.title,
    description: section.description,
    depthCeiling: section.depth_ceiling,
    subsections: [],
  }));
}

// Shared SSE line-by-line reader used by both the Stage 1 (outline + candidates)
// and Stage 2 (approved block generation) streams.
async function consumeSSE(response, onLine) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) onLine(line);
  }
  if (buffer.trim()) onLine(buffer.trim());
}

// Add new topics, spare blocks and notices to a ready day's library. Existing ids are skipped,
// so repeated or late deliveries never duplicate anything.
function addIdeasTo(day, { topics = [], blocks = [], notices = [] }) {
  const haveTopic = new Set(day.topics.map(t => t.id));
  const haveBlock = new Set([...day.placed, ...day.library].map(x => x.id));
  const haveNotice = new Set((day.notices || []).map(n => `${n.code}|${n.message}`));
  return {
    ...day,
    topics: [...day.topics, ...topics.filter(t => !haveTopic.has(t.id))],
    library: [...day.library, ...blocks.filter(x => !haveBlock.has(x.id))],
    notices: [...(day.notices || []), ...notices.filter(n => n && !haveNotice.has(`${n.code}|${n.message}`))],
  };
}

// The hours of a planned day, as the planner edits them. The backend sends
// `hours: [{id, number, title, icon, start_minute, end_minute, capacity_blocks, block_ids}]`
// (each hour is a lesson; `placed` is the hours' blocks in order). The hours are the one place
// the arrangement lives: `placed` is always re-derived from them (withHours). A plan that
// arrives without hours (an older backend) is cut into hours of four blocks so the planner
// still works; those are marked `synthetic` and are not sent to the build.
function hoursOfPlan(plan, blockMinutes) {
  const cap = hourCapacity(blockMinutes);
  const placed = plan.placed || [];
  const known = new Set([...placed, ...(plan.library || [])].map(b => b.id));
  const seen = new Set();
  const take = (ids) => (ids || []).filter(id => known.has(id) && !seen.has(id) && seen.add(id));
  let hours;
  let synthetic = false;
  if (Array.isArray(plan.hours) && plan.hours.length) {
    hours = plan.hours.map((h, i) => ({
      id: h.id,
      number: h.number ?? i + 1,
      title: h.title || `Hour ${i + 1}`,
      icon: h.icon || '',
      start_minute: Number.isFinite(h.start_minute) ? h.start_minute : i * 60,
      end_minute: Number.isFinite(h.end_minute) ? h.end_minute : (i + 1) * 60,
      block_ids: take(h.block_ids).slice(0, cap),
    }));
  } else {
    synthetic = true;
    const n = Math.max(1, Math.ceil((plan.slots || cap) / cap));
    const titleOf = Object.fromEntries((plan.topics || []).map(t => [t.id, t.title]));
    hours = Array.from({ length: n }, (_, i) => {
      const ids = take(placed.slice(i * cap, (i + 1) * cap).map(b => b.id));
      const first = placed.find(b => b.id === ids[0]);
      return {
        id: `hour-${i + 1}`, number: i + 1, title: (first && titleOf[first.topic_id]) || `Hour ${i + 1}`, icon: '',
        start_minute: i * 60, end_minute: (i + 1) * 60, block_ids: ids,
      };
    });
  }
  // A placed block the hours do not hold (should not happen) goes back to the library.
  const inHours = new Set(hours.flatMap(h => h.block_ids));
  const library = [...(plan.library || []), ...placed.filter(b => !inHours.has(b.id))];
  return { hours, library, synthetic };
}

// Rebuild a day from its hours and library. `placed` is the hours' blocks in order.
function withHours(day, hours, library) {
  const byId = Object.fromEntries([...day.placed, ...day.library].map(b => [b.id, b]));
  return { ...day, hours, library, placed: hours.flatMap(h => h.block_ids.map(id => byId[id])).filter(Boolean) };
}

export function GenerationProvider({ children }) {
  const [genState, setGenState] = useState(IDLE);
  // Keep a stable ref for handsOnResources so we can merge without re-rendering the whole object
  const handsOnRef = useRef({});

  const startGeneration = async (formData, attachedFiles, teacherUid, organizationId, targetFolderId) => {
    handsOnRef.current = {};

    setGenState({
      ...IDLE,
      status: 'generating-outline',
      formData,
      targetFolderId,
      teacherUid,
      organizationId,
      progress: { message: 'Starting...', percent: 0 },
    });

    const body = new FormData();
    body.append('course_name',      formData.courseName);
    body.append('age_range_start',  String(parseInt(formData.ageRangeStart)));
    body.append('age_range_end',    String(parseInt(formData.ageRangeEnd)));
    body.append('num_students',     String(parseInt(formData.numStudents)));
    body.append('num_days',         String(parseInt(formData.numDays)));
    body.append('hours_per_day',    String(parseFloat(formData.hoursPerDay)));
    body.append('num_worksheets',   String(parseInt(formData.numWorksheets)));
    body.append('num_activities',   String(parseInt(formData.numActivities)));
    body.append('objectives',       formData.objectives || '');
    body.append('teacherUid',       teacherUid);
    body.append('organizationId',   organizationId);
    body.append('file_descriptions', JSON.stringify(attachedFiles.map(f => f.description || '')));
    attachedFiles.forEach(({ file }) => body.append('files', file));
    if (COURSE_BUILDER_ENABLED) body.append('flow', 'course_builder');

    const processLine = (line) => {
      if (!line.startsWith('data: ')) return;
      try {
        const data = JSON.parse(line.slice(6));

        if (data.error) {
          setGenState(prev => ({ ...prev, status: 'error', progress: { message: data.message || 'Generation failed', percent: 0 } }));
          return;
        }

        if (data.type === 'requirements_interpreted') {
          // Stage 1: surfaced for review only — not yet consumed by generation.
          console.log('Requirements Interpreter output:', data.interpretation);
          setGenState(prev => ({ ...prev, interpretedRequirements: data.interpretation }));
          return;
        }

        if (data.type === 'outlines_ready') {
          // Course Builder Stage 1. Nothing is persisted server-side, so everything the
          // later stages send back to the backend is kept here, in memory:
          //   builder = {
          //     outlines:         the three outlines as generated (never mutated)
          //     requiresChoice:   false for one-day courses (Stage 1 is skipped)
          //     chosenOutlineId:  id of the outline the teacher picked
          //     chosenOutline:    that outline INCLUDING Edo edits (what Stage 2 plans from)
          //     edits:            { [outlineId]: { outline, turns: [{ userMessage, reply,
          //                         changedDayIds, previousOutline }] } } edit history per outline
          //     courseContext:    echoed back to every Stage 2 call
          //     interpretation, presetCourseId, courseAttachments, subject, topic
          //     plan:             null until Stage 2 starts, then (see startDayPlanning)
          //                       { running, fatal, days: { [dayId]: { status: 'pending'|'planning'|
          //                         'ready'|'failed', error, number, title, slots, blockMinutes,
          //                         topics, hours [{id, number, title, icon, start_minute, end_minute,
          //                         block_ids}] (the teacher's arrangement), placed (derived: the hours'
          //                         blocks in order), library, planned, notices } } }
          //     build:            null until "Build course", then { phase: 'building'|'failed'|'done',
          //                       percent, message, notes, problems, error, curriculumId, handsOnResources }
          //   }
          // Stage 2 hand-off: status 'builder-planning' (route /course-builder/plan).
          const outlines = Array.isArray(data.outlines) ? data.outlines : [];
          if (outlines.length === 0) {
            setGenState(prev => ({ ...prev, status: 'error', progress: { message: 'No outlines came back. Please try again.', percent: 0 } }));
            return;
          }
          const requiresChoice = !!data.requires_choice;
          setGenState(prev => ({
            ...prev,
            status: requiresChoice ? 'outlines-ready' : 'builder-planning',
            presetCourseId: data.preset_course_id || prev.presetCourseId,
            courseAttachments: data.course_attachments || prev.courseAttachments,
            interpretedRequirements: data.interpretation ?? prev.interpretedRequirements,
            progress: { message: data.message || 'Outlines ready!', percent: data.progress ?? 60 },
            builder: {
              outlines,
              requiresChoice,
              chosenOutlineId: outlines[0].id,
              chosenOutline: outlines[0],
              chosenOutlineLegacy: data.chosen_outline_legacy || null,
              edits: {},
              courseContext: data.course_context || null,
              interpretation: data.interpretation || null,
              presetCourseId: data.preset_course_id || null,
              courseAttachments: data.course_attachments || [],
              subject: data.subject || '',
              topic: data.topic || '',
              plan: null,
              build: null,
            },
          }));
          return;
        }

        if (data.type === 'outline_ready') {
          const sections = mapOutlineToSections(data.outline);
          setGenState(prev => ({
            ...prev,
            status: 'generating-candidates',
            sections,
            rawOutline: data.outline,
            progress: { message: data.message || 'Outline ready!', percent: data.progress || 50 },
          }));
          return;
        }

        if (data.type === 'subsections_ready') {
          setGenState(prev => ({
            ...prev,
            status: 'generating-candidates',
            candidatesBySection: { ...prev.candidatesBySection, [data.section_id]: data.chains || [] },
            progress: { message: prev.progress.message, percent: data.progress ?? prev.progress.percent },
          }));
          return;
        }

        if (data.type === 'candidates_complete') {
          setGenState(prev => ({
            ...prev,
            status: 'selection-pending',
            presetCourseId: data.preset_course_id || prev.presetCourseId,
            courseAttachments: data.course_attachments || prev.courseAttachments,
            progress: { message: data.message || 'Candidates ready!', percent: data.progress ?? 70 },
          }));
          return;
        }

        // Generic progress update
        if (data.message || data.progress != null) {
          setGenState(prev => ({
            ...prev,
            progress: { message: data.message || prev.progress.message, percent: data.progress ?? prev.progress.percent },
          }));
        }
      } catch (err) {
        console.error('GenerationContext: error parsing SSE line', err);
      }
    };

    try {
      const response = await authFetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/generate-curriculum`,
        { method: 'POST', body }
      );
      // A 401/403 comes back as a plain JSON error, not a stream: show its message
      // instead of waiting on a stream that never starts.
      if (!response.ok) throw await legacyErrorFromResponse(response, 'Failed to generate course. Please try again.');
      await consumeSSE(response, processLine);
    } catch (err) {
      console.error('GenerationContext: fetch error', err);
      setGenState(prev => ({ ...prev, status: 'error', progress: { message: err.status ? err.message : 'Failed to generate course. Please try again.', percent: 0 } }));
    }
  };

  // Called once the teacher submits their Phase 1.5 selection in the matrix UI.
  // `selections` is an array of { subsectionId, sectionId, sectionTitle, title,
  // description, coreConcept, depthLevel, prerequisiteSubsectionId, chainId,
  // durationMinutes, learningObjectives, blocks, included, excludedBlockIds }.
  const submitSelectionsAndGenerateBlocks = async (selections) => {
    handsOnRef.current = {};

    const includedIds = new Set(selections.filter(s => s.included).map(s => s.subsectionId));

    setGenState(prev => ({
      ...prev,
      status: 'generating-blocks',
      pendingSubsectionIds: includedIds,
      progress: { message: 'Generating content blocks...', percent: 0 },
    }));

    const { formData, teacherUid, organizationId, presetCourseId, courseAttachments, rawOutline } = genState;

    const requestBody = {
      presetCourseId,
      teacherUid,
      organizationId,
      courseName: formData.courseName,
      ageRangeStart: parseInt(formData.ageRangeStart),
      ageRangeEnd: parseInt(formData.ageRangeEnd),
      numStudents: parseInt(formData.numStudents),
      numDays: parseInt(formData.numDays),
      hoursPerDay: parseFloat(formData.hoursPerDay),
      objectives: formData.objectives || '',
      courseAttachments,
      outline: rawOutline,
      selections,
    };

    const processLine = (line) => {
      if (!line.startsWith('data: ')) return;
      try {
        const data = JSON.parse(line.slice(6));

        if (data.error) {
          setGenState(prev => ({ ...prev, status: 'error', progress: { message: data.message || 'Generation failed', percent: 0 } }));
          return;
        }

        if (data.type === 'subsection_blocks') {
          handsOnRef.current = { ...handsOnRef.current, [data.subsection_id]: data.blocks };
          setGenState(prev => {
            const next = new Set(prev.pendingSubsectionIds);
            next.delete(data.subsection_id);
            return {
              ...prev,
              status: 'generating-blocks',
              handsOnResources: { ...handsOnRef.current },
              pendingSubsectionIds: next,
              progress: { message: prev.progress.message, percent: data.progress ?? prev.progress.percent },
            };
          });
          return;
        }

        if (data.done && data.curriculum_id) {
          setGenState(prev => ({
            ...prev,
            status: 'complete',
            curriculumId: data.curriculum_id,
            progress: { message: 'Complete!', percent: 100 },
          }));
          return;
        }

        if (data.message || data.progress != null) {
          setGenState(prev => ({
            ...prev,
            progress: { message: data.message || prev.progress.message, percent: data.progress ?? prev.progress.percent },
          }));
        }
      } catch (err) {
        console.error('GenerationContext: error parsing SSE line', err);
      }
    };

    try {
      const response = await authFetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/generate-blocks`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        }
      );
      if (!response.ok) throw await legacyErrorFromResponse(response, 'Failed to generate blocks. Please try again.');
      await consumeSSE(response, processLine);
    } catch (err) {
      console.error('GenerationContext: fetch error', err);
      setGenState(prev => ({ ...prev, status: 'error', progress: { message: err.status ? err.message : 'Failed to generate blocks. Please try again.', percent: 0 } }));
    }
  };

  // Called when the teacher clicks "+" on a depth-level row in the matrix UI to
  // request one more independent chain for a section. Returns the new chains
  // (also merged into genState.candidatesBySection) so the caller can await it.
  const generateMoreSubsections = async (sectionId) => {
    const section = genState.sections.find(s => s.id === sectionId);
    if (!section) throw new Error(`Unknown section: ${sectionId}`);

    // Dedup context: every subsection already proposed anywhere in the course,
    // including this section's own existing chains.
    const existingSubsections = Object.entries(genState.candidatesBySection).flatMap(([secId, chains]) => {
      const secTitle = genState.sections.find(s => s.id === secId)?.title || '';
      return chains.flatMap(chain => chain.subsections.map(sub => ({ section: secTitle, subsection: sub.title })));
    });

    const { formData, rawOutline } = genState;
    const dayNumber = genState.sections.findIndex(s => s.id === sectionId) + 1;
    const response = await authFetch(`${import.meta.env.VITE_API_BASE_URL}/api/generate-more-subsections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sectionId: section.id,
        sectionTitle: section.title,
        sectionDescription: section.description || '',
        depthCeiling: section.depthCeiling || 'Basics',
        courseName: formData.courseName,
        subject: rawOutline?.subject || '',
        topic: rawOutline?.topic || '',
        ageRangeStart: parseInt(formData.ageRangeStart),
        ageRangeEnd: parseInt(formData.ageRangeEnd),
        objectives: formData.objectives || '',
        hoursPerDay: parseFloat(formData.hoursPerDay),
        numDays: parseInt(formData.numDays),
        dayNumber: dayNumber > 0 ? dayNumber : null,
        numWorksheets: parseInt(formData.numWorksheets) || 0,
        numActivities: parseInt(formData.numActivities) || 0,
        existingSubsections,
      }),
    });

    if (!response.ok) {
      throw await legacyErrorFromResponse(response, `generate-more-subsections failed: ${response.status}`);
    }
    const data = await response.json();
    const newChains = data.chains || [];

    setGenState(prev => ({
      ...prev,
      candidatesBySection: {
        ...prev.candidatesBySection,
        [sectionId]: [...(prev.candidatesBySection[sectionId] || []), ...newChains],
      },
    }));

    return newChains;
  };

  // ── Course Builder Stage 1 actions ─────────────────────────────────────
  // Switching outlines keeps each outline's own edits, so nothing is lost silently.
  const selectBuilderOutline = (outlineId) => {
    setGenState(prev => {
      const b = prev.builder;
      if (!b) return prev;
      const base = b.outlines.find(o => o.id === outlineId);
      if (!base) return prev;
      return { ...prev, builder: { ...b, chosenOutlineId: outlineId, chosenOutline: b.edits[outlineId]?.outline || base } };
    });
  };

  // Record an applied Edo edit as a history turn so it can be undone.
  const applyBuilderEdit = (outlineId, { userMessage, reply, outline, changedDayIds }) => {
    setGenState(prev => {
      const b = prev.builder;
      if (!b || b.chosenOutlineId !== outlineId) return prev;
      const entry = b.edits[outlineId] || { turns: [] };
      const previousOutline = b.chosenOutline;
      return {
        ...prev,
        builder: {
          ...b,
          chosenOutline: outline,
          edits: {
            ...b.edits,
            [outlineId]: {
              outline,
              turns: [...entry.turns, { userMessage, reply, changedDayIds, previousOutline }],
            },
          },
        },
      };
    });
  };

  // Undo the most recent edit that changed something (and any no-change replies after it).
  const undoBuilderEdit = () => {
    setGenState(prev => {
      const b = prev.builder;
      const entry = b?.edits[b.chosenOutlineId];
      if (!entry) return prev;
      let idx = -1;
      for (let i = entry.turns.length - 1; i >= 0; i--) {
        if (entry.turns[i].changedDayIds.length > 0) { idx = i; break; }
      }
      if (idx < 0) return prev;
      const restored = entry.turns[idx].previousOutline;
      return {
        ...prev,
        builder: {
          ...b,
          chosenOutline: restored,
          edits: { ...b.edits, [b.chosenOutlineId]: { outline: restored, turns: entry.turns.slice(0, idx) } },
        },
      };
    });
  };

  // ── Course Builder Stage 2 (day planner) ───────────────────────────────
  // Always-current copy of genState for async code (streams, guards).
  const genRef = useRef(genState);
  genRef.current = genState;
  const planRunRef = useRef(null); // { id, controller } of the streaming plan-days run
  const buildingRef = useRef(false);

  const patchPlan = (fn) => setGenState(prev => {
    const b = prev.builder;
    if (!b?.plan) return prev;
    return { ...prev, builder: { ...b, plan: fn(b.plan) } };
  });
  // Change one day. A day named in a failed build's `problems` stops being flagged as soon as
  // the teacher changes it (the next build re-checks it). `keepProblems`: for changes that do
  // not touch the arrangement (e.g. marking a day planned), leave the flags alone.
  const patchDay = (dayId, fn, { keepProblems = false } = {}) => setGenState(prev => {
    const b = prev.builder;
    const day = b?.plan?.days[dayId];
    if (!day) return prev;
    const next = fn(day);
    if (next === day) return prev;
    let build = b.build;
    if (!keepProblems && build?.problems?.some(p => p.day_id === dayId)) {
      build = { ...build, problems: build.problems.filter(p => p.day_id !== dayId) };
    }
    return { ...prev, builder: { ...b, plan: { ...b.plan, days: { ...b.plan.days, [dayId]: next } }, build } };
  });
  const patchBuild = (fn) => setGenState(prev => {
    const b = prev.builder;
    if (!b) return prev;
    return { ...prev, builder: { ...b, build: fn(b.build || {}) } };
  });

  const dayFromPlan = (plan) => {
    const blockMinutes = plan.block_minutes || 15;
    const { hours, library, synthetic } = hoursOfPlan(plan, blockMinutes);
    const base = {
      status: 'ready',
      error: '',
      number: plan.day_number,
      title: plan.title,
      slots: plan.slots,
      blockMinutes,
      topics: plan.topics || [],
      placed: plan.placed || [],
      library,
      hoursSynthetic: synthetic,
      planned: false,
      // Teacher-facing notes ([{code, severity, message}]). The raw `warnings` strings are
      // technical and are not shown.
      notices: Array.isArray(plan.notices) ? plan.notices : [],
    };
    return withHours(base, hours, library);
  };

  // Titles of the topics on every day before `dayId` (planned days only).
  const earlierTopicTitles = (dayId) => {
    const b = genRef.current.builder;
    const order = b.chosenOutline.days.map(d => d.id);
    const upto = order.indexOf(dayId);
    // Only topics with at least one block PLACED in the earlier day count as already taught
    // (library-only topics were never taught), matching what the backend stream sends.
    return order.slice(0, Math.max(upto, 0)).flatMap(id => {
      const d = b.plan?.days[id];
      const used = new Set((d?.placed || []).map(x => x.topic_id));
      return (d?.topics || []).filter(t => used.has(t.id)).map(t => t.title);
    });
  };

  const stopPlanRun = () => {
    if (planRunRef.current) planRunRef.current.controller.abort();
    planRunRef.current = null;
  };

  // Plan every day, in order, streaming each in as it arrives. Safe to call twice (a second
  // call while a plan exists or is running does nothing). Lives here, not in the page, so
  // leaving the page does not stop planning.
  const startDayPlanning = async () => {
    const b = genRef.current.builder;
    if (!b || b.plan || planRunRef.current) return;
    const outline = b.chosenOutline;
    const days = {};
    outline.days.forEach((d, i) => {
      days[d.id] = { status: i === 0 ? 'planning' : 'pending', error: '', number: i + 1, title: d.title, planned: false, topics: [], hours: [], placed: [], library: [] };
    });
    const run = { id: Date.now() + Math.random(), controller: new AbortController() };
    planRunRef.current = run;
    const live = () => planRunRef.current === run;
    setGenState(prev => (prev.builder ? { ...prev, builder: { ...prev.builder, plan: { running: true, fatal: '', days }, build: null } } : prev));

    let finished = false;
    const failOpenDays = (message) => patchPlan(plan => ({
      ...plan,
      days: Object.fromEntries(Object.entries(plan.days).map(([id, d]) => [
        id, (d.status === 'pending' || d.status === 'planning') ? { ...d, status: 'failed', error: message } : d,
      ])),
    }));
    try {
      await streamPlanDays({
        courseContext: b.courseContext,
        outline,
        signal: run.controller.signal,
        onEvent: (data) => {
          if (!live()) return;
          if (data.error === true) { // fatal; a day_failed event carries an error string and the run continues
            finished = true;
            patchPlan(plan => ({ ...plan, fatal: data.message || 'Planning stopped.' }));
            failOpenDays(data.message || 'Planning stopped before this day was planned.');
            return;
          }
          if (data.type === 'day_started') {
            patchDay(data.day_id, d => (d.status === 'ready' ? d : { ...d, status: 'planning', error: '' }));
          } else if (data.type === 'day_planned' && data.plan) {
            patchDay(data.day_id, () => dayFromPlan(data.plan));
          } else if (data.type === 'day_library') {
            // The backend tops the day's library up after sending the day's plan. Ignored if
            // the day is not ready yet (or was re-planned meanwhile): the add is by block id.
            // Its `notices` are the full list for the day (counts recomputed by the backend), so
            // they replace the day's notices; topics and blocks are merged by id.
            patchDay(data.day_id, d => {
              if (d.status !== 'ready') return d;
              const merged = addIdeasTo(d, { topics: data.topics, blocks: data.blocks });
              return Array.isArray(data.notices) ? { ...merged, notices: data.notices } : merged;
            }, { keepProblems: true });
          } else if (data.type === 'day_failed') {
            patchDay(data.day_id, d => ({ ...d, status: 'failed', error: data.error || 'This day could not be planned.' }));
          } else if (data.type === 'plans_complete') {
            finished = true;
          }
        },
      });
      if (live() && !finished) failOpenDays('Planning stopped before this day was planned.');
    } catch (err) {
      if (live() && err.name !== 'AbortError') {
        patchPlan(plan => ({ ...plan, fatal: err.message || 'Planning stopped.' }));
        failOpenDays(err.message || 'Planning stopped before this day was planned.');
      }
    } finally {
      if (live()) {
        planRunRef.current = null;
        patchPlan(plan => ({ ...plan, running: false }));
      }
    }
  };

  // Plan (or re-plan) one day. Only that day changes. Returns after the request settles.
  const planOneDay = async (dayId) => {
    const b = genRef.current.builder;
    if (!b?.plan?.days[dayId]) return;
    patchDay(dayId, d => ({ ...d, status: 'planning', error: '' }));
    try {
      const plan = await planDay({
        courseContext: b.courseContext, outline: b.chosenOutline, dayId, earlierTopics: earlierTopicTitles(dayId),
      });
      patchDay(dayId, () => dayFromPlan(plan));
    } catch (err) {
      patchDay(dayId, d => ({ ...d, status: 'failed', error: err.message || 'This day could not be planned.' }));
    }
  };

  // Move a block inside a day. `toHourId`: the id of the hour to put it in, or null for the
  // library; `index`: position in that hour or the library (omit to append). The rules are
  // enforced here, whatever the UI did: an hour never holds more than an hour of blocks, and
  // the day never more than `slots` blocks. A move that would break either is ignored.
  const movePlanBlock = (dayId, blockId, toHourId, index) => patchDay(dayId, day => {
    if (day.status !== 'ready') return day;
    const known = [...day.placed, ...day.library].some(x => x.id === blockId);
    if (!known) return day;
    if (toHourId != null && placeBlocker(day, blockId, toHourId)) return day;
    const hours = day.hours.map(h => ({ ...h, block_ids: h.block_ids.filter(id => id !== blockId) }));
    const library = day.library.filter(x => x.id !== blockId);
    const block = [...day.placed, ...day.library].find(x => x.id === blockId);
    const insert = (list, item) => {
      const at = Number.isInteger(index) ? Math.max(0, Math.min(index, list.length)) : list.length;
      list.splice(at, 0, item);
    };
    if (toHourId == null) insert(library, block);
    else insert(hours.find(h => h.id === toHourId).block_ids, blockId);
    return withHours(day, hours, library);
  });

  // Rename every part of a block (they share a title) and clear its review flag: the
  // teacher has looked at it.
  const resolveBlockReview = (dayId, blockId, newTitle) => patchDay(dayId, day => {
    const all = [...day.placed, ...day.library];
    const target = all.find(x => x.id === blockId);
    if (!target) return day;
    const title = (newTitle || '').trim().slice(0, 300) || target.title;
    // Parts of one block share a part_group_id. A block without one is renamed alone.
    const fix = (x) => ((x.id === target.id || (target.part_group_id && x.part_group_id === target.part_group_id))
      ? { ...x, title, needs_review: false, review_note: '' }
      : x);
    return { ...day, placed: day.placed.map(fix), library: day.library.map(fix) };
  });

  const setDayPlanned = (dayId, planned) => patchDay(dayId, d => ({ ...d, planned }), { keepProblems: true });

  // Append "more ideas" results to the day's library (new topics included).
  const addDayIdeas = (dayId, ideas) => patchDay(dayId, day => addIdeasTo(day, ideas), { keepProblems: true });

  // Send the teacher's plan to /build-course and follow the stream. The plan in
  // builder.plan is never touched, so a failed build can simply be retried.
  const buildPlannedCourse = async () => {
    const g = genRef.current;
    const b = g.builder;
    if (!b?.plan || buildingRef.current) return;
    buildingRef.current = true;
    const ctx = b.courseContext || {};
    const days = b.chosenOutline.days.map(d => {
      const day = b.plan.days[d.id];
      const placed = day?.status === 'ready' ? day.placed : [];
      const used = new Set(placed.map(x => x.topic_id));
      // The teacher's final arrangement, hour by hour. Every hour is also a topic (an hour is a
      // lesson), so the hours are kept in `topics` even when the teacher emptied one.
      const sendHours = day?.status === 'ready' && !day.hoursSynthetic && day.hours.length > 0;
      if (sendHours) day.hours.forEach(h => used.add(h.id));
      return {
        day_id: d.id,
        topics: (day?.topics || []).filter(t => used.has(t.id)).map(t => ({ id: t.id, title: t.title, icon: t.icon, priority: t.priority })),
        blocks: placed,
        ...(sendHours ? { hours: day.hours.map(h => ({ id: h.id, block_ids: [...h.block_ids] })) } : {}),
      };
    });
    const payload = {
      presetCourseId: b.presetCourseId || '',
      teacherUid: g.teacherUid,
      organizationId: g.organizationId,
      courseName: ctx.course_name,
      ageRangeStart: parseInt(ctx.age_range_start),
      ageRangeEnd: parseInt(ctx.age_range_end),
      numStudents: parseInt(ctx.num_students),
      numDays: b.chosenOutline.days.length,
      hoursPerDay: parseFloat(ctx.hours_per_day),
      objectives: ctx.objectives || '',
      courseAttachments: b.courseAttachments || [],
      subject: b.subject || '',
      topic: b.topic || '',
      outline: b.chosenOutline,
      days,
    };
    patchBuild(() => ({ phase: 'building', percent: 0, message: 'Checking your plan...', notes: [], problems: [], error: '', curriculumId: null, handsOnResources: {} }));
    const handsOn = {};
    let curriculumId = null;
    let streamError = '';
    try {
      await streamBuildCourse(payload, (data) => {
        if (data.error === true) { streamError = data.message || 'The course could not be built.'; return; }
        if (data.type === 'build_notes') {
          patchBuild(x => ({ ...x, notes: Array.isArray(data.notes) ? data.notes : [] }));
        } else if (data.type === 'subsection_blocks') {
          handsOn[data.subsection_id] = data.blocks;
          patchBuild(x => ({ ...x, handsOnResources: { ...handsOn }, percent: data.progress ?? x.percent }));
        } else if (data.done && data.curriculum_id) {
          curriculumId = data.curriculum_id;
        } else if (data.message || data.progress != null) {
          patchBuild(x => ({ ...x, message: data.message || x.message, percent: data.progress ?? x.percent }));
        }
      });
      if (streamError) {
        patchBuild(x => ({ ...x, phase: 'failed', error: streamError }));
      } else if (!curriculumId) {
        patchBuild(x => ({ ...x, phase: 'failed', error: 'The build stopped before the course was saved.' }));
      } else {
        patchBuild(x => ({ ...x, phase: 'done', percent: 100, curriculumId }));
      }
    } catch (err) {
      patchBuild(x => ({
        ...x,
        phase: 'failed',
        problems: err.problems || [],
        error: err.problems?.length ? (err.message || 'Some days cannot be built yet.') : (err.status ? err.message : 'The connection to the server dropped while building.'),
      }));
    } finally {
      buildingRef.current = false;
    }
  };

  const dismissBuildResult = () => patchBuild(() => null);

  // Stage 2 hand-off / return to Stage 1. Returning discards every day plan (they are
  // re-made from the outline on the way back in).
  const proceedToPlanning = () => {
    stopPlanRun();
    setGenState(prev => (prev.builder ? { ...prev, status: 'builder-planning', builder: { ...prev.builder, plan: null, build: null } } : prev));
  };
  const backToBuilderOutline = () => {
    if (!genRef.current.builder?.requiresChoice) return;
    stopPlanRun();
    setGenState(prev => (prev.builder?.requiresChoice
      ? { ...prev, status: 'outlines-ready', builder: { ...prev.builder, plan: null, build: null } }
      : prev));
  };

  const clearGeneration = () => {
    stopPlanRun();
    handsOnRef.current = {};
    setGenState(IDLE);
  };

  return (
    <GenerationContext.Provider value={{ genState, startGeneration, submitSelectionsAndGenerateBlocks, generateMoreSubsections, clearGeneration, selectBuilderOutline, applyBuilderEdit, undoBuilderEdit, proceedToPlanning, backToBuilderOutline, startDayPlanning, planOneDay, movePlanBlock, resolveBlockReview, setDayPlanned, addDayIdeas, buildPlannedCourse, dismissBuildResult }}>
      {children}
    </GenerationContext.Provider>
  );
}

export function useGeneration() {
  return useContext(GenerationContext);
}
