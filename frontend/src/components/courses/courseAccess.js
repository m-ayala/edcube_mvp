// frontend/src/components/courses/courseAccess.js
// Live access to an open course. The backend computes the caller's edit right from the OWNER's plan on
// every request (GET /api/curricula/{id}/access); an open session polls it so a lapse, a downgrade or a
// removal reaches the screen without a reload. Nothing here ever touches the user's local edits.
import { useEffect, useRef } from 'react';
import { getAccess } from '../../services/sharingApi';

export const ACCESS_POLL_MS = 30000;

// What a lock is called in the UI: null (can edit) | 'plan' | 'view' | 'owner_deactivated' | 'removed'.
export const lockFromAccess = (access) => {
  // An answer without a clear can_edit (malformed, empty) never locks anyone out.
  if (!access || typeof access.can_edit !== 'boolean' || access.can_edit || access.role === 'owner') return null;
  if (access.role === 'collaborate') return access.reason === 'owner_deactivated' ? 'owner_deactivated' : 'plan';
  return 'view';
};

// Lock implied by a refused save: the 403 code, or a 404 (access gone).
export const lockFromSaveError = (status, detail) => {
  if (status === 404) return 'removed';
  const code = detail && typeof detail === 'object' ? detail.code : null;
  if (code === 'coediting_not_in_plan') return 'plan';
  if (code === 'access_view_only') return 'view';
  if (code === 'account_deactivated') return 'owner_deactivated';
  return null;
};

export const LOCK_MESSAGES = {
  plan: "The owner's plan no longer includes co-editing. You can still view this course.",
  view: 'You now have view-only access.',
  owner_deactivated: "This course's owner has deactivated their account. You can still view this course.",
  removed: 'You no longer have access to this course.',
};

// Polls while `enabled` (every ~30s and when the window regains focus); stops on unmount.
// onAccess(access) gets each successful answer; onNoAccess() a 404 (removed, left or deleted).
export const useCourseAccess = ({ courseId, enabled, onAccess, onNoAccess, immediate = false, intervalMs = ACCESS_POLL_MS }) => {
  const handlers = useRef({ onAccess, onNoAccess });
  useEffect(() => { handlers.current = { onAccess, onNoAccess }; });

  useEffect(() => {
    if (!enabled || !courseId || courseId === 'new-course') return undefined;
    let stopped = false;
    let busy = false;
    const check = async () => {
      if (busy || stopped) return;
      busy = true;
      try {
        const access = await getAccess(courseId);
        if (!stopped) handlers.current.onAccess?.(access);
      } catch (err) {
        if (!stopped && err?.status === 404) handlers.current.onNoAccess?.();
        // any other failure (offline, 5xx, 403 handled elsewhere): keep the last known access
      } finally {
        busy = false;
      }
    };
    if (immediate) check();
    const timer = setInterval(check, intervalMs);
    const onFocus = () => { if (document.visibilityState !== 'hidden') check(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      stopped = true;
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [courseId, enabled, immediate, intervalMs]);
};

// ── Local draft: the text a refused save could not store ─────────────────────────────────────
const draftKey = (courseId) => `edcube.draft.${courseId}`;
export const saveDraft = (courseId, text) => {
  if (!courseId) return;
  try { window.localStorage.setItem(draftKey(courseId), JSON.stringify({ at: Date.now(), text })); } catch { /* best effort */ }
};
export const readDraft = (courseId) => {
  try { return JSON.parse(window.localStorage.getItem(draftKey(courseId)) || 'null'); } catch { return null; }
};
export const clearDraft = (courseId) => {
  try { window.localStorage.removeItem(draftKey(courseId)); } catch { /* best effort */ }
};

// Sign-out cleanup: drop every local course draft so the next person on this browser never sees them.
export const clearAllDrafts = () => {
  try {
    const store = window.localStorage;
    for (let i = store.length - 1; i >= 0; i--) {
      const k = store.key(i);
      if (k && k.startsWith('edcube.draft.')) store.removeItem(k);
    }
  } catch { /* best effort */ }
};

export const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch { /* fall back below */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch { return false; }
};

// Plain-text rendition of the course as it is on screen (title, sections, subsections, blocks).
export const courseToText = ({ courseName, sections, handsOnResources }) => {
  const lines = [courseName || 'Untitled course', ''];
  (sections || []).forEach((section, si) => {
    if (section.type === 'break') { lines.push(`--- Break: ${section.duration || ''} ---`, ''); return; }
    lines.push(`Section ${si + 1}: ${section.title || ''}`);
    if (section.description) lines.push(section.description);
    (section.subsections || []).forEach((sub, bi) => {
      lines.push('', `  ${si + 1}.${bi + 1} ${sub.title || ''}`);
      if (sub.description) lines.push(`  ${sub.description}`);
      (sub.learning_objectives || []).forEach((o) => lines.push(`    - ${o}`));
      ((handsOnResources || {})[sub.id] || []).forEach((b) => {
        lines.push(`    [${b.type || 'content'}] ${b.title || ''}`);
        if (b.content) lines.push(`      ${String(b.content).replace(/\n/g, '\n      ')}`);
        if (b.url) lines.push(`      ${b.url}`);
      });
    });
    lines.push('');
  });
  return lines.join('\n');
};
