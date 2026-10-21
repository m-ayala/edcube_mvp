// frontend/src/services/courseBuilderApi.js
// Course Builder network calls. Nothing is persisted server-side; callers keep state.

import { authFetch, legacyErrorFromResponse, isQuotaDetail, QUOTA_MESSAGE } from './authFetch';

const API = () => `${import.meta.env.VITE_API_BASE_URL}`;

let taxonomyPromise = null;

// Whole knowledge-base taxonomy payload (objective_categories, vocabularies, formats...).
// Cached for the session; a failed fetch is not cached.
export const fetchTaxonomy = (currentUser) => {
  if (!taxonomyPromise) {
    taxonomyPromise = (async () => {
      const token = await currentUser.getIdToken();
      const res = await fetch(`${API()}/api/knowledge-base/taxonomy`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Taxonomy request failed (${res.status})`);
      return res.json();
    })().catch((err) => {
      taxonomyPromise = null;
      throw err;
    });
  }
  return taxonomyPromise;
};

// Objective categories ([{id, label, description}]) from the backend's knowledge
// base taxonomy route.
export const fetchObjectiveCategories = (currentUser) =>
  fetchTaxonomy(currentUser).then((data) => (Array.isArray(data.objective_categories) ? data.objective_categories : []));

// Ask Edo to revise the outline. Returns { reply, outline, changed_day_ids }.
export const editOutline = async ({ outline, message, course, conversationHistory }) => {
  const res = await authFetch(`${API()}/api/course-builder/edit-outline`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      outline,
      message,
      course,
      conversation_history: conversationHistory || [],
    }),
  });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json()).detail; } catch { /* non-JSON error body */ }
    const quota = res.status === 402 && isQuotaDetail(detail);
    const err = new Error(quota ? QUOTA_MESSAGE : (typeof detail === 'string' && detail ? detail : `Edo could not revise the outline (${res.status})`));
    err.status = res.status;
    err.quota = quota;
    throw err;
  }
  const data = await res.json();
  if (!data || !Array.isArray(data.outline?.days) || data.outline.days.length === 0) {
    throw new Error('Edo sent back an outline the page could not read.');
  }
  return {
    reply: data.reply || 'I updated the outline.',
    outline: data.outline,
    changed_day_ids: Array.isArray(data.changed_day_ids) ? data.changed_day_ids : [],
  };
};

// A saved course document (what build-course saved). Same route the workspace already uses
// for course info. Rejects with an Error on a non-2xx answer.
export const fetchCourseDocument = async (curriculumId, teacherUid) => {
  const res = await authFetch(`${API()}/api/curricula/${encodeURIComponent(curriculumId)}?teacherUid=${encodeURIComponent(teacherUid)}`);
  if (!res.ok) throw await legacyErrorFromResponse(res, `The saved course could not be loaded (${res.status}).`);
  return res.json();
};

// ── Stage 2: day planning ───────────────────────────────────────────────

const errorFromResponseWithProblems = async (res, fallback) => {
  let detail = null;
  try { detail = (await res.json()).detail; } catch { /* non-JSON error body */ }
  const quota = res.status === 402 && isQuotaDetail(detail);
  const err = new Error(quota ? QUOTA_MESSAGE : (typeof detail === 'string' && detail ? detail : (detail?.message || `${fallback} (${res.status})`)));
  err.status = res.status;
  err.quota = quota;
  err.problems = Array.isArray(detail?.problems) ? detail.problems : [];
  return err;
};

// Reads a server-sent-event response, calling onEvent(parsedJson) for each data line.
const readSSE = async (response, onEvent) => {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const handle = (line) => {
    if (!line.startsWith('data: ')) return;
    let data;
    try { data = JSON.parse(line.slice(6)); } catch { return; }
    onEvent(data);
  };
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    lines.forEach(handle);
  }
  if (buffer.trim()) handle(buffer.trim());
};

const postJSON = (path, body, signal) => authFetch(`${API()}${path}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
  signal,
});

// Plan days one after another. Events go to onEvent: day_started, day_planned, day_failed,
// plans_complete, or a fatal { message, error: true }.
export const streamPlanDays = async ({ courseContext, outline, dayIds, earlierTopics, signal, onEvent }) => {
  const res = await postJSON('/api/course-builder/plan-days', {
    course_context: courseContext,
    outline,
    ...(dayIds ? { day_ids: dayIds } : {}),
    ...(earlierTopics ? { earlier_topics: earlierTopics } : {}),
  }, signal);
  if (!res.ok) throw await errorFromResponseWithProblems(res, 'Planning the days failed');
  await readSSE(res, onEvent);
};

// Re-plan one day. Returns the day plan.
export const planDay = async ({ courseContext, outline, dayId, earlierTopics }) => {
  const res = await postJSON('/api/course-builder/plan-day', {
    course_context: courseContext, outline, day_id: dayId, earlier_topics: earlierTopics || [],
  });
  if (!res.ok) throw await errorFromResponseWithProblems(res, 'Could not plan this day');
  return res.json();
};

// More spare blocks for a day's library. Returns { topics, blocks, notices } (notices:
// teacher-facing [{code, severity, message}]; the technical `warnings` are not passed on).
export const fetchDayIdeas = async ({ courseContext, outline, dayId, earlierTopics, currentTopics, count = 6 }) => {
  const res = await postJSON('/api/course-builder/day-ideas', {
    course_context: courseContext, outline, day_id: dayId,
    earlier_topics: earlierTopics || [], current_topics: currentTopics, count,
  });
  if (!res.ok) throw await errorFromResponseWithProblems(res, 'Could not come up with more ideas');
  const data = await res.json();
  return {
    topics: Array.isArray(data.topics) ? data.topics : [],
    blocks: Array.isArray(data.blocks) ? data.blocks : [],
    notices: Array.isArray(data.notices) ? data.notices : [],
  };
};

// Build the course from the teacher's plan. Rejects with an Error carrying .status and
// .problems ([{day_id, code, message}]) on a 4xx/5xx before any stream starts; otherwise
// streams events to onEvent (build_notes, subsection_blocks, progress, done, error).
export const streamBuildCourse = async (payload, onEvent) => {
  const res = await postJSON('/api/course-builder/build-course', payload);
  if (!res.ok) throw await errorFromResponseWithProblems(res, 'The course could not be built');
  await readSSE(res, onEvent);
};
