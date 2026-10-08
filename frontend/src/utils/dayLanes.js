// Pure helpers for the Phase 1.5 day lanes (UI state only, never persisted).
import { DEFAULT_NUM_DAYS, MAX_NUM_DAYS } from '../constants/libraryView';

// formData.numDays is a string from a form input and can be '' / missing on
// older courses. Fall back to DEFAULT_NUM_DAYS; clamp to MAX_NUM_DAYS.
export const resolveNumDays = (raw) => {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_NUM_DAYS;
  return Math.min(n, MAX_NUM_DAYS);
};

let counter = 0;
export const newCopyId = (prefix) => {
  const rand = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  counter += 1;
  return `${prefix}-${rand}-${counter}`;
};

const deepClone = (value) => (
  typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value))
);

// Independent copy of a block: all data deep-cloned, fresh id.
export const copyBlock = (block) => ({ ...deepClone(block), id: newCopyId('daycopy-block') });

// Standalone chip copy.
export const makeBlockItem = (block) => ({
  id: newCopyId('dayitem'),
  kind: 'block',
  block: copyBlock(block),
});

// Grouped card copy: new group id + a fresh independent copy of every block.
export const makeGroupItem = (subsection, blocks) => ({
  id: newCopyId('dayitem'),
  kind: 'group',
  title: subsection?.title || 'Untitled subsection',
  blocks: (blocks || []).map(copyBlock),
});
