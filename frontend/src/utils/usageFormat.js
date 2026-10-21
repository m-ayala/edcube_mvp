// frontend/src/utils/usageFormat.js
// Display helpers for plan usage. All numbers come from GET /api/account/usage
// (or a 402 detail); nothing here knows a limit.

export const formatResetDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
};

// 0..100 share of the limit used; 0 when unlimited (null limit).
export const percentUsed = (used, limit) => {
  if (limit == null || limit <= 0) return limit === 0 ? 100 : 0;
  return Math.max(0, Math.min(100, Math.round((used / limit) * 100)));
};

export const quotaTitle = (detail) => {
  const limit = detail?.limit;
  switch (detail?.kind) {
    case 'courses':
      return `You've used all ${limit} course creations this month`;
    case 'generates':
      return `You've used all ${limit} Generate actions this month`;
    case 'edo_tokens':
      return "You've used your Edo allowance for this month";
    default:
      return "You've reached this month's limit";
  }
};
