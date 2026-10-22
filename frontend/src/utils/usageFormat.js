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

export const CREDIT_KINDS = ['courses', 'generates', 'edo_messages'];

// Short noun per credit kind, used in sentences ("7 of 10 courses left ...").
const KIND_NOUN = { courses: 'courses', generates: 'Generate actions', edo_messages: 'Edo messages' };
export const kindLabel = (kind) => ({ courses: 'Courses', generates: 'Generate', edo_messages: 'Edo' }[kind] || kind);

// "7 of 10 courses left this month" / "... left in your free trial". Unlimited -> "Unlimited ...".
// The total counts bonus credits an admin granted, so "left" never exceeds it.
export const counterText = (kind, c, { isTrial = false } = {}) => {
  const noun = KIND_NOUN[kind] || kind;
  if (!c || c.limit == null) return `Unlimited ${noun}`;
  const total = c.limit + (c.bonus_remaining || 0);
  const left = c.remaining ?? Math.max(0, c.limit - (c.used || 0));
  return `${left} of ${total} ${noun} left${isTrial ? ' in your free trial' : kind === 'courses' ? ' this month' : ''}`;
};

// True once the trial's end date has passed (the server answers 402 plan_inactive from then).
export const trialEnded = (data) => {
  if (!data?.is_trial) return false;
  if (data.trial_days_left === 0) return true;
  if (!data.trial_ends_at) return false;
  const t = new Date(data.trial_ends_at).getTime();
  return !Number.isNaN(t) && t <= Date.now();
};

export const TRIAL_ENDED_MESSAGE =
  'Your free trial has ended, so AI features and new sharing are paused. You can still view and edit your courses. Join the waitlist to hear when paid plans open.';

// Why one AI feature is paused. Prefers the server's own message when it sent one.
export const pausedMessage = (kind, { isTrial = false, resetsAt = null, trialEndsAt = null, message = null } = {}) => {
  if (message) return message;
  const noun = KIND_NOUN[kind] || 'AI actions';
  const when = isTrial ? ' in your free trial' : ' for this month';
  const date = isTrial ? formatResetDate(trialEndsAt) : formatResetDate(resetsAt);
  const tail = isTrial ? (date ? ` Your trial ends ${date}.` : '') : (date ? ` Resets ${date}.` : '');
  return `You've used all your ${noun}${when}.${tail} Manual editing still works.`;
};

export const quotaTitle = (detail) => {
  const trial = !!detail?.is_trial || detail?.plan === 'trial';
  if (detail?.code === 'plan_inactive') return 'Your free trial has ended';
  if (detail?.code === 'plan_upgrade_required') return 'This is not part of your current plan';
  if (trial && detail?.kind) return 'Your free trial allowance is used up';
  switch (detail?.kind) {
    case 'courses':
      return `You've used all ${detail.limit} course creations this month`;
    case 'generates':
      return `You've used all ${detail.limit} Generate actions this month`;
    case 'edo_messages':
      return "You've used all your Edo messages for this month";
    default:
      return "You've reached this month's limit";
  }
};
