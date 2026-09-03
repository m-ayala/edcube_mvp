// frontend/src/utils/formatDate.js
// Curriculum docs carry `lastModified`/`createdAt` in three shapes depending on
// which writer touched them last:
//   - Firestore Timestamp instance (has .toDate())   — frontend saveCurriculum
//   - { seconds, nanoseconds } plain object          — serialized Timestamp
//   - ISO 8601 string                                — every backend write
// `toJsDate` normalizes all three; `formatCardDate` renders "Jul 6, 2026".

export const toJsDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value.toDate === 'function') {
    try { return value.toDate(); } catch { return null; }
  }
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000);
  if (typeof value._seconds === 'number') return new Date(value._seconds * 1000);
  return null;
};

export const formatCardDate = (value) => {
  const d = toJsDate(value);
  if (!d) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};
