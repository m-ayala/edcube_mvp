// frontend/src/components/courses/folderColors.js
// Folder tint palette from the Figma redesign. A folder stores the KEY
// (e.g. "pink"); the card and modal resolve it through this map. `null` /
// unknown keys fall back to `neutral`.

export const FOLDER_COLORS = {
  neutral: { panel: '#F4F1F5', title: '#3F3B44', chipBg: '#E7E2EA', chipText: '#54505B' },
  pink:    { panel: '#FFF2F8', title: '#BF2066', chipBg: '#FBD9E7', chipText: '#A61F58' },
  peach:   { panel: '#FFF1E9', title: '#C2610F', chipBg: '#FBE2CE', chipText: '#9A4E0C' },
  lime:    { panel: '#F4F8E8', title: '#6C7C1A', chipBg: '#E6EDC6', chipText: '#5A6817' },
  blue:    { panel: '#E4F8FF', title: '#1E7FA6', chipBg: '#CDEDF7', chipText: '#1B6C8C' },
  violet:  { panel: '#F1ECFF', title: '#6D4BC4', chipBg: '#E0D6F9', chipText: '#5B3FA6' },
};

export const FOLDER_COLOR_KEYS = Object.keys(FOLDER_COLORS).filter((k) => k !== 'neutral');

export const resolveFolderColor = (key) => FOLDER_COLORS[key] || FOLDER_COLORS.neutral;
