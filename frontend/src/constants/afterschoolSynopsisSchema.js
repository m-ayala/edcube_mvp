// frontend/src/constants/afterschoolSynopsisSchema.js
/**
 * After-School / ECA Synopsis Schema - Single Source of Truth for Field Names
 * ⚠️ CRITICAL: Keep in sync with backend/schemas/afterschool_synopsis_schema.py
 *
 * Separate, additive feature from the existing camp-synopsis schema
 * (constants/synopsisSchema.js) — different Firestore collections, different
 * routes. Only ICC_ADMIN_DOMAIN (constants/synopsisSchema.js) is shared/reused,
 * never duplicated here.
 */

// ── Taxonomy ─────────────────────────────────────────────────────────────────
// Exact strings must match backend/schemas/afterschool_synopsis_schema.py's
// GRADE_OPTIONS/SYNOPSIS_TYPE_OPTIONS byte-for-byte — grade_slug/type_slug are
// derived server-side from whatever raw label the frontend submits.

export const GRADE_OPTIONS = [
  'Transitional Kindergarten (TK)',
  'Kindergarten',
  'First Grade',
  'Second & Third Grade',
  'Fourth/Fifth/Sixth Grade',
];

// The one synopsis type whose entry always has exactly one block (week: null).
// Every ECA type instead grows however many blocks the teacher adds via
// "Add another week" — there is no fixed or computed week count.
export const SINGLE_BLOCK_TYPE = 'After School Class';

export const SYNOPSIS_TYPE_OPTIONS = [
  SINGLE_BLOCK_TYPE,
  'Theater',
  'Art',
  'Spanish',
  'Music',
  'Sports',
  'Dance',
];

// ── Firestore field names ─────────────────────────────────────────────────────

export const AfterschoolMonthFields = {
  MONTH_ID: 'month_id',
  YEAR: 'year',
  MONTH: 'month',
  LABEL: 'label',
  IS_ACTIVE: 'is_active',
  IS_VISIBLE: 'is_visible',
  COLOR_THEME: 'color_theme',
  CREATED_BY: 'created_by',
  CREATED_AT: 'created_at',
};

export const AfterschoolEntryFields = {
  ENTRY_ID: 'entry_id',
  GRADE: 'grade',
  GRADE_SLUG: 'grade_slug',
  SYNOPSIS_TYPE: 'synopsis_type',
  TYPE_SLUG: 'type_slug',
  MONTH_ID: 'month_id',
  MONTH_LABEL: 'month_label',
  BLOCKS: 'blocks',
  CREATED_AT: 'created_at',
  UPDATED_AT: 'updated_at',
};

export const AfterschoolBlockFields = {
  WEEK: 'week', // "week1", "week2", ... or null for After School Class
  TITLE: 'title',
  RAW_TEXT: 'raw_text',
  PHOTO_URLS: 'photo_urls',
};

// Same per-block cap as the camp-synopsis feature's PHOTO_MAX
// (frontend/src/constants/synopsisSchema.js).
export const PHOTO_MAX = 6;

// sessionStorage key gating the shared teacher-portal credential form —
// cleared on browser/tab close, re-prompts each new session.
export const PORTAL_SESSION_KEY = 'afterschool_synopsis_portal_authed';

// Admins may only create months in this fixed window — mirrors the backend's
// ALLOWED_MONTHS validation (September 2026 through May 2027).
const MONTH_NAMES = {
  1: 'January', 2: 'February', 3: 'March', 4: 'April',
  5: 'May', 6: 'June', 7: 'July', 8: 'August',
  9: 'September', 10: 'October', 11: 'November', 12: 'December',
};

const pad2 = (n) => String(n).padStart(2, '0');

export const ALLOWED_MONTHS = [
  [2026, 9], [2026, 10], [2026, 11], [2026, 12],
  [2027, 1], [2027, 2], [2027, 3], [2027, 4], [2027, 5],
].map(([year, month]) => ({
  year,
  month,
  month_id: `${year}-${pad2(month)}`,
  label: `${MONTH_NAMES[month]} ${year}`,
}));

// Newsletter highlight color palette — same 6 named themes/hex values the
// backend resolves a month's color_theme through when building the .docx
// section-heading band color (hex includes the leading '#' here for direct
// use in CSS; the backend stores/expects the bare hex without '#').
export const COLOR_THEMES = [
  { id: 'yellow', label: 'Yellow', hex: '#FFE599' },
  { id: 'orange', label: 'Orange', hex: '#F9C89A' },
  { id: 'beige', label: 'Beige', hex: '#E8DFC8' },
  { id: 'red', label: 'Red', hex: '#F6C6C6' },
  { id: 'green', label: 'Green', hex: '#C9E8C9' },
  { id: 'blue', label: 'Blue', hex: '#C6DFF6' },
];

export const COLOR_THEME_HEX = Object.fromEntries(COLOR_THEMES.map((t) => [t.id, t.hex]));

// Auto-suggested default theme by calendar month — always admin-overridable
// afterward. Mirrors backend's DEFAULT_THEME_BY_MONTH; used only for a nicer
// pre-selected swatch in the UI before an admin's own choice/the server's
// actual stored value is known.
const DEFAULT_THEME_BY_MONTH = { 9: 'yellow', 10: 'orange', 11: 'beige', 12: 'red' };
export const defaultThemeForMonth = (month) => DEFAULT_THEME_BY_MONTH[month] || 'yellow';

/**
 * Slugifies a display string into the URL/doc-id-safe form the backend also
 * derives server-side (e.g. "Second & Third Grade" -> "second-third-grade").
 * Kept identical in behavior to the backend's slugify() (lowercase, runs of
 * non a-z0-9 collapsed to a single '-', trimmed) so grade_slug/type_slug
 * always match what the server computes.
 */
export const slugify = (value) => {
  const s = (value || '').trim().toLowerCase();
  return s.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
};
