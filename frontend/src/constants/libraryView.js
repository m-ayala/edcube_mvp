// Shared constants for the Phase 1.5 library + day lanes view.
// Lives in a non-component file so both ContentLibraryPanel.jsx and
// DayLanesPanel.jsx can import it without breaking React Fast Refresh.

// Matches the pastel palette already used for section accents in CourseEditor.jsx
export const SECTION_GRADIENTS = [
  'linear-gradient(180deg,#B2E8C8,#ACD8F0)',
  'linear-gradient(180deg,#F2C0D4,#F7E4A0)',
  'linear-gradient(180deg,#ACD8F0,#B2E8C8)',
  'linear-gradient(180deg,#F7E4A0,#F2C0D4)',
];

// Matches the block-type color coding already used for chips in CourseEditor.jsx
export const BLOCK_TYPE_STYLE = {
  content:   { bg: 'rgba(59,95,187,0.10)',  border: 'rgba(59,95,187,0.28)', dot: '#3B5FBB', label: 'Content' },
  worksheet: { bg: 'rgba(176,90,26,0.10)',  border: 'rgba(176,90,26,0.28)', dot: '#B05A1A', label: 'Worksheet' },
  activity:  { bg: 'rgba(26,122,64,0.10)',  border: 'rgba(26,122,64,0.28)', dot: '#1A7A40', label: 'Activity' },
};

export const LIBRARY_DND_TYPES = {
  SUBSECTION: 'LIBRARY_SUBSECTION',
  BLOCK: 'LIBRARY_BLOCK',
};

// Droppable id helpers. Each day exposes two typed droppables (one per library
// drag type) stacked as a single visual lane.
export const LIBRARY_SOURCE_PREFIX = 'lib-';
export const DAY_DROP_PREFIX = 'day-';
export const dayDropId = (day, kind) => `${DAY_DROP_PREFIX}${day}-${kind}`; // kind: 'sub' | 'block'
export const parseDayDropId = (id) => {
  const m = /^day-(\d+)-(sub|block)$/.exec(id || '');
  return m ? { day: Number(m[1]), kind: m[2] } : null;
};

// Used when the course has no usable numDays (older courses / empty field).
export const DEFAULT_NUM_DAYS = 5;
export const MAX_NUM_DAYS = 60;
