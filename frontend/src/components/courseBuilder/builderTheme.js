// frontend/src/components/courseBuilder/builderTheme.js
// Colours shared by the Course Builder pages. Objective category ids and labels come
// from the backend, so chip colours cycle by position rather than being keyed to them.
export const CHIP_COLORS = [
  { bg: '#EFF6FF', fg: '#1D4ED8', bd: '#BFDBFE' },
  { bg: '#FFFBEB', fg: '#92400E', bd: '#FDE68A' },
  { bg: '#F3EFFF', fg: '#6D28D9', bd: '#DDD6FE' },
  { bg: '#FFF1F2', fg: '#BE123C', bd: '#FECDD3' },
  { bg: '#F3F4F6', fg: '#4B5563', bd: '#D1D5DB' },
];

// Tint behind a topic's emoji and the colour of the line joining its partner blocks.
// Cycled by the topic's position in the day.
export const TOPIC_TINTS = [
  { tint: '#ebf0ff', line: '#3e62bc' },
  { tint: '#fff2f8', line: '#bf2066' },
  { tint: '#e7f7ee', line: '#1a7a40' },
  { tint: '#fff3dc', line: '#8a5a00' },
  { tint: '#f1f1f1', line: '#5f5f5f' },
];
