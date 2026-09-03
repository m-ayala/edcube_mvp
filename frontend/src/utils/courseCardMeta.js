// frontend/src/utils/courseCardMeta.js
// Derives the display fields the redesigned course card needs from a raw
// curriculum doc. Nothing here is stored on the doc — see the "Data model
// facts" section of the My Courses redesign plan.

import { formatCardDate } from './formatDate';

const sectionsOf = (c) =>
  (c.outline?.sections || c.sections || []).filter((s) => s?.type !== 'break');

/** Number of "lessons" = total subsections across real (non-break) sections. */
export const lessonCount = (c) =>
  sectionsOf(c).reduce((n, s) => n + (s.subsections?.length || 0), 0);

/**
 * Duration string. Prefer the explicit `timeDuration` text; otherwise sum
 * subsection `duration_minutes` and render "X hr Y min".
 */
export const durationText = (c) => {
  if (typeof c.timeDuration === 'string' && c.timeDuration.trim()) {
    return c.timeDuration.trim();
  }
  const mins = sectionsOf(c).reduce(
    (n, s) => n + (s.subsections || []).reduce((m, sub) => m + (sub.duration_minutes || 0), 0),
    0,
  );
  if (!mins) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h} hr ${m} min`;
  if (h) return `${h} hr`;
  return `${m} min`;
};

const LEVEL_RANK = { basics: 0, beginner: 0, intermediate: 1, advanced: 2 };
const LEVEL_LABEL = ['Beginner', 'Intermediate', 'Advanced'];

/** Highest section `depth_ceiling` across the outline, mapped to a friendly label. */
export const levelLabel = (c) => {
  const ranks = (c.outline?.sections || [])
    .map((s) => LEVEL_RANK[String(s.depth_ceiling || '').toLowerCase()])
    .filter((r) => r !== undefined);
  if (!ranks.length) return '';
  return LEVEL_LABEL[Math.max(...ranks)];
};

/** "Grades 4-5" from `class`, else "Ages 6-8" from the age range, else ''. */
export const gradeText = (c) => {
  if (c.class !== undefined && c.class !== null && String(c.class).trim()) {
    const v = String(c.class).trim();
    return /grade/i.test(v) ? v : `Grade${/[-–—]/.test(v) ? 's' : ''} ${v}`;
  }
  const a = c.ageRangeStart;
  const b = c.ageRangeEnd;
  if (a && b) return `Ages ${a}–${b}`;
  if (a) return `Ages ${a}+`;
  return '';
};

/** "Intermediate · Grades 4-5" — omits empty parts, '' when both empty. */
export const levelLine = (c) => [levelLabel(c), gradeText(c)].filter(Boolean).join(' · ');

/** Short course description with sensible fallbacks. */
export const descriptionText = (c) => {
  const pick = c.courseDescription || c.objectives || '';
  return typeof pick === 'string' ? pick.trim() : '';
};

export const lastModifiedText = (c) => formatCardDate(c.lastModified || c.createdAt);
