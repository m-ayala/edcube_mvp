// frontend/src/constants/editorTheme.js
// Shared visual constants for the course editor, Edo and the Course Builder.
// Moved here verbatim from CourseEditor.jsx / EdoChatbot.jsx so the Course Builder
// can reuse them without a second copy (those files now import from here).

export const FONT = "'DM Sans', sans-serif";
export const T = {
  crumbMuted: '#8a8a8a',
  crumbActive: '#3e62bc',
  sectionTag: '#3e62bc',
  heading: '#1f1f1f',
  desc: '#727272',
  rowBorder: '#d7e1fb',
  numBg: '#ebf0ff',
  numFg: '#3e62bc',
  cardBorder: '#e4e4e4',
  cardTitle: '#262626',
  cardDesc: '#8f8f8f',
  primary: '#bf2066',
  dashed: '#cdd7ee',
  addPillBg: '#f1f1f1',
  addPillFg: '#9b9b9b',
  iconEditBg: '#fff2f8', iconEditFg: '#bf2066',
  iconDelBg: '#fff3dc', iconDelFg: '#c0871d',
};


export const EDO_GREEN = '#2C5F3A';
export const EDO_ORANGE = '#E8761A';

// Block-type tag colours (content / worksheet / activity). Moved verbatim from
// CourseEditor.jsx so the Course Builder day planner shows identical tags.
export const BLOCK_TAG = {
  content:   { bg: '#fff2f8', fg: '#ad004b', label: 'Content' },
  worksheet: { bg: '#fff3dc', fg: '#a9761b', label: 'Worksheet' },
  activity:  { bg: '#e7f7ee', fg: '#1a7a40', label: 'Activity' },
};
