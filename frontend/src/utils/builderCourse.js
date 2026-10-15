// frontend/src/utils/builderCourse.js
// Course Builder courses in the classic workspace: how a built course is recognised, loaded,
// ordered and saved. Pure functions only (no React, no network).
//
// What a Course Builder course looks like (see backend/outliner/course_builder_handoff.py):
//   section   = a day: bullets, leads_to, objective_ids, day_schedule (ALL the day's block ids in
//               the teacher's order), slots, block_minutes, day_topics
//   subsection = a lesson unit of the day (today a topic): icon, priority, topic_id,
//               source:'course_builder', blocks (the plan's block specs)
//   block     = format_id, format_label, topic_id, icon, part, part_count, part_group_id,
//               goes_with, objective_id, group_size, resources, is_revision, day_position,
//               duration_minutes, generation_failed, needs_review, review_note, ...
// A section is "a builder section" exactly when it carries a day_schedule array. Sections that
// do not are classic: nothing in this file touches them.
//
// The workspace is the classic one (sections -> subsections -> blocks). It edits each
// subsection's blocks as a list; nothing here depends on whether subsections are topics or hours.
// Order and fields survive save/load because (1) on load a subsection's blocks are put in
// day_schedule order (not re-grouped by type), (2) on save day_schedule is recomputed from the
// classic order (reconcileDaySchedule), and (3) saving keeps every field a section, subsection
// and block already has instead of rebuilding it from a fixed key list.

export const isBuilderSection = (s) => !!s && s.type !== 'break' && Array.isArray(s.day_schedule);
const BLOCK_ARRAYS = [['content_blocks', 'content'], ['worksheets', 'worksheet'], ['activities', 'activity']];
// Keys of a saved subsection that the workspace holds elsewhere while editing (blocks in
// handsOnResources, videos in videosByTopic) and writes back on save.
const DERIVED_SUB_KEYS = ['content_blocks', 'worksheets', 'activities', 'video_resources', 'topicBoxes'];

export const subHasBlockArrays = (sub) => BLOCK_ARRAYS.some(([key]) => Array.isArray(sub?.[key]));

// All blocks stored on a saved subsection (the three type arrays are all that type-grouping keeps).
export const blocksFromArrays = (sub) => [
  ...(sub.content_blocks || []).map((r) => ({ ...r, type: r.type || 'content' })),
  ...(sub.worksheets || []).map((r) => ({ ...r, type: 'worksheet' })),
  ...(sub.activities || []).map((r) => ({ ...r, type: 'activity' })),
];

// Stable sort by position in the day's schedule; blocks not in it keep their relative order after.
export const sortBySchedule = (blocks, schedule) => {
  const pos = new Map((schedule || []).map((id, i) => [id, i]));
  const rank = (b, i) => (pos.has(b.id) ? pos.get(b.id) : (schedule || []).length + i);
  return blocks.map((b, i) => ({ b, r: rank(b, i) })).sort((x, y) => x.r - y.r).map((x) => x.b);
};

// ── Hour time in the classic workspace ────────────────────────────────────────────────
// A built course's hour subsections carry hour_number, start_minute, end_minute and
// duration_minutes 60; their blocks carry duration_minutes 15. The workspace already shows the
// durations ("60 min" on the subsection page, "15 mins" on each block). It has no element for a
// time window, so the window is written at the start of the subsection's description, the one
// text the workspace shows for a subsection: "Hour 2 · 1:00–2:00. <description>". Applying it
// again does nothing new (the old prefix is replaced), so it is safe at every load and in the
// saved copy. Subsections without these fields are returned untouched.
const HOUR_PREFIX = /^Hour \d+ · \d+:\d{2}–\d+:\d{2}(?:\. |\.$|$)/;
const minuteClock = (m) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
export const hourTimeLabel = (sub) => (
  Number.isInteger(sub?.hour_number) && Number.isFinite(sub?.start_minute) && Number.isFinite(sub?.end_minute)
    ? `Hour ${sub.hour_number} · ${minuteClock(sub.start_minute)}–${minuteClock(sub.end_minute)}` : '');
export const withHourTime = (sub) => {
  const label = hourTimeLabel(sub);
  if (!label) return sub;
  const rest = (sub.description || '').replace(HOUR_PREFIX, '');
  const description = rest ? `${label}. ${rest}` : label;
  // The backend writes the same label itself (an empty hour's ends in ". "); leave that as is.
  return description === (sub.description || '').trimEnd().replace(/\.$/, '') ? sub : { ...sub, description };
};

// ── Loading ───────────────────────────────────────────────────────────────────────────

// A builder section as the workspace edits it: every field kept, minus the keys it holds in
// handsOnResources / videosByTopic (they are written back on save).
export const builderSectionForEditing = (section) => ({
  ...section,
  subsections: (section.subsections || []).map((sub) => {
    const out = { ...sub };
    DERIVED_SUB_KEYS.forEach((k) => { delete out[k]; });
    return withHourTime(out);
  }),
});

// Blocks (day-ordered within each topic) and videos of one builder section, keyed by topic id.
// A subsection that has block arrays uses them (once the workspace has saved, they are the
// truth, even if empty). Otherwise `fallback[topicId]` is used: the course was just built and
// its blocks only exist in the document's top-level handsOnResources.
export const builderSectionBlocks = (section, fallback = {}) => {
  const blocksBySub = {};
  const videosBySub = {};
  (section.subsections || []).forEach((sub) => {
    const blocks = subHasBlockArrays(sub) ? blocksFromArrays(sub) : (fallback[sub.id] || []);
    if (blocks.length > 0) blocksBySub[sub.id] = sortBySchedule(blocks, section.day_schedule);
    if ((sub.video_resources || []).length > 0) videosBySub[sub.id] = sub.video_resources;
  });
  return { blocksBySub, videosBySub };
};

// Sections for navigation state (/course-view, /course-workspace) from a saved course document,
// or null when it is not a Course Builder course (callers then use their existing mapping).
// Every field is kept; blocks are put back into the three type arrays the viewers read, from the
// subsection's own arrays or, before the first workspace save, the document's handsOnResources.
export const navSectionsFromDoc = (doc) => {
  const raw = doc?.outline?.sections || doc?.sections || [];
  if (!raw.some(isBuilderSection)) return null;
  const top = doc.handsOnResources || {};
  return raw.map((section) => {
    if (!isBuilderSection(section)) return section;
    return {
      ...section,
      subsections: (section.subsections || []).map((sub) => {
        const blocks = subHasBlockArrays(sub) ? blocksFromArrays(sub) : sortBySchedule(top[sub.id] || [], section.day_schedule);
        const ordered = sortBySchedule(blocks, section.day_schedule);
        return {
          ...withHourTime(sub),
          content_blocks: ordered.filter((b) => (b.type || 'content') === 'content'),
          worksheets: ordered.filter((b) => b.type === 'worksheet'),
          activities: ordered.filter((b) => b.type === 'activity'),
          video_resources: sub.video_resources || [],
        };
      }),
    };
  });
};

// True when a Course Builder course document (as a list route returned it) has a topic whose
// blocks are in neither its own arrays nor the document's handsOnResources: opening it would
// show, and the first save would write, a topic with no blocks.
export const builderBlocksMissing = (doc) => {
  const raw = doc?.outline?.sections || doc?.sections || [];
  const top = doc?.handsOnResources || {};
  return raw.filter(isBuilderSection).some((section) => (section.subsections || []).some((sub) => !subHasBlockArrays(sub) && !top[sub.id]));
};

// ── Save guard ────────────────────────────────────────────────────────────────────────
// Ids of the days that carry a day_schedule in `sections` (what a course was loaded with).
export const builderDayIds = (sections) => (sections || []).filter(isBuilderSection).map((s) => s.id);

// Sections that were Course Builder sections when the course was loaded and are in `payload`
// without their day_schedule. A save with any of these would turn part of a built course into a
// classic-shaped one and lose its order, so callers refuse it. A section that is simply not in
// the payload was deleted by the teacher in the classic editor: that is an edit, not a loss.
export const downgradedDays = (loadedDayIds, payload) => {
  const byId = new Map((payload || []).map((s) => [s.id, s]));
  return (loadedDayIds || []).filter((id) => byId.has(id) && !isBuilderSection(byId.get(id)));
};

// The course-level outline fields other than `sections` (course_title, age_range, ...), kept
// so a workspace save does not shrink `outline` down to {sections}.
export const outlineExtrasOf = (doc) => {
  const out = { ...(doc?.outline || {}) };
  delete out.sections;
  return out;
};

// ── Saving ────────────────────────────────────────────────────────────────────────────

// The day's order after the teacher's classic edits, as an array of ids (the new day_schedule).
// The classic workspace orders blocks inside each subsection only, so the day's order is kept as
// it was wherever nothing changed: every subsection's blocks fill the schedule positions that its
// blocks held, in the subsection's current order. So that a reload shows exactly the order on
// screen:
//   - a block added to a subsection joins that subsection's last position (a subsection with no
//     position yet goes after the rest, in section order);
//   - a block that is no longer in this section (deleted, or moved to another section) leaves
//     the day;
//   - a block moved to another subsection takes a position there;
//   - plan-only block ids (in the plan's specs, never written, not deleted) keep their place.
// `existingIds`: ids of every block now in the workspace (any section). `deletedIds`: ids of
// blocks that existed when the course was loaded and are no longer anywhere.
export const reconcileDaySchedule = (section, handsOnResources, existingIds = new Set(), deletedIds = new Set()) => {
  const subs = section.subsections || [];
  const queues = new Map();
  const owner = new Map();
  subs.forEach((sub) => {
    const ids = (handsOnResources[sub.id] || []).map((b) => b.id);
    queues.set(sub.id, ids);
    ids.forEach((id) => owner.set(id, sub.id));
  });
  const planOnly = new Set();
  subs.forEach((sub) => (sub.blocks || []).forEach((spec) => {
    if (spec?.id && !existingIds.has(spec.id) && !deletedIds.has(spec.id)) planOnly.add(spec.id);
  }));
  const seen = new Set();
  const old = (section.day_schedule || []).filter((id) => {
    if (seen.has(id) || !(owner.has(id) || planOnly.has(id))) return false;
    seen.add(id);
    return true;
  });
  const remaining = new Map();
  old.forEach((id) => { if (owner.has(id)) remaining.set(owner.get(id), (remaining.get(owner.get(id)) || 0) + 1); });
  const out = [];
  old.forEach((id) => {
    const sid = owner.get(id);
    if (sid === undefined) { out.push(id); return; }
    const left = remaining.get(sid) - 1;
    remaining.set(sid, left);
    const q = queues.get(sid);
    if (left === 0) out.push(...q.splice(0)); else out.push(q.shift());
  });
  subs.forEach((sub) => { const q = queues.get(sub.id); if (q.length > 0) out.push(...q.splice(0)); });
  return out;
};

// Ids of every block in the workspace, for the "was loaded, is gone now" check.
export const allBlockIds = (handsOnResources) => new Set(Object.values(handsOnResources || {}).flatMap((list) => (list || []).map((b) => b.id)));

// A builder section ready to save: all its own fields, each subsection's blocks (in the three
// type arrays existing readers use) and videos, and a day_schedule / day_position / plan-spec
// list that agree with the classic order on screen. A deleted block is removed from all of them
// so a reload cannot bring it back. A plan spec whose block now lives in another subsection is
// dropped from this one (the block itself carries the same fields). `existingIds` and
// `deletedIds` as in reconcileDaySchedule.
export const builderSectionForSave = (section, handsOnResources, videosByTopic, existingIds = new Set(), deletedIds = new Set()) => {
  const order = reconcileDaySchedule(section, handsOnResources, existingIds, deletedIds);
  const pos = new Map(order.map((id, i) => [id, i]));
  const withPos = (b) => (pos.has(b.id) && b.day_position !== pos.get(b.id) ? { ...b, day_position: pos.get(b.id) } : b);
  const subsections = (section.subsections || []).map((sub) => {
    const blocks = (handsOnResources[sub.id] || []).map(withPos);
    const ownedHere = new Set(blocks.map((b) => b.id));
    return {
      ...sub,
      description: sub.description || '',
      learning_objectives: sub.learning_objectives || [],
      duration_minutes: sub.duration_minutes ?? 20,
      ...(Array.isArray(sub.blocks) ? {
        blocks: sub.blocks
          .filter((b) => !b?.id || (!deletedIds.has(b.id) && (!existingIds.has(b.id) || ownedHere.has(b.id))))
          .map((b) => (b?.id ? withPos(b) : b)),
      } : {}),
      content_blocks: blocks.filter((r) => r.type === 'content'),
      worksheets: blocks.filter((r) => r.type === 'worksheet'),
      activities: blocks.filter((r) => r.type === 'activity'),
      video_resources: videosByTopic[sub.id] || [],
    };
  });
  // day_topics mirrors the subsections: keep the entries that still have one, with its title.
  const titleOf = new Map(subsections.map((sub) => [sub.id, sub.title]));
  const dayTopics = Array.isArray(section.day_topics)
    ? { day_topics: section.day_topics.filter((t) => titleOf.has(t.id)).map((t) => (titleOf.get(t.id) === t.title ? t : { ...t, title: titleOf.get(t.id) })) }
    : {};
  return { ...section, ...dayTopics, day_schedule: order, subsections };
};

// Teacher-facing messages for a course that cannot be fully loaded or saved.
export const INCOMPLETE_COURSE_MESSAGE = "This course's content could not be loaded for you yet, so you can view it but not edit it. Ask the owner to open the course once, or try again later.";
export const SAVE_REFUSED_DAYS_MESSAGE = "Your recent changes are not being saved. The last change would have removed information this course needs, so saving was stopped to protect your course. You can no longer edit on this page. Leave it, and the course will open from its last saved version.";
export const SAVE_FAILED_MESSAGE = "Your latest changes could not be saved. Please check your connection. We will try again when you make your next change.";
