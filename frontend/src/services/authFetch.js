// frontend/src/services/authFetch.js
// One shared way to call protected backend routes: attaches the signed-in user's
// Firebase ID token as `Authorization: Bearer <token>`. Content-Type is never set
// here, so FormData bodies keep their multipart boundary; callers that send JSON
// pass their own 'Content-Type' header as before.
import { auth } from '../firebase/config';

// The active workspace ('personal' or an org id) lives in this module so every
// backend call can send it as `X-EdCube-Workspace` without threading React
// state through. AuthContext is the only writer (setActiveWorkspaceHeader). Null
// until an account is resolved, so bootstrap / me are sent without it and the
// backend picks the default workspace.
export const WORKSPACE_HEADER = 'X-EdCube-Workspace';
let activeWorkspaceHeader = null;
export const setActiveWorkspaceHeader = (ws) => { activeWorkspaceHeader = ws || null; };
export const workspaceHeader = () => (activeWorkspaceHeader ? { [WORKSPACE_HEADER]: activeWorkspaceHeader } : {});

export const authHeaders = async (extra = {}) => {
  const user = auth.currentUser;
  if (!user) {
    const err = new Error('Please sign in to continue.');
    err.status = 401;
    throw err;
  }
  const token = await user.getIdToken();
  return { ...extra, ...workspaceHeader(), Authorization: `Bearer ${token}` };
};

// Window events that UsageContext listens to. Dispatching from here means every
// caller (including streaming ones) triggers the quota modal / usage refresh
// without per-caller edits.
export const QUOTA_EVENT = 'edcube:quota-exceeded';
export const USAGE_CHANGED_EVENT = 'edcube:usage-changed';
export const QUOTA_MESSAGE = 'Monthly limit reached';

export const notifyQuotaExceeded = (detail) => {
  window.dispatchEvent(new CustomEvent(QUOTA_EVENT, { detail }));
};

// 402 codes that stop an AI action or a sharing action and open a modal:
// a used-up credit (quota_exceeded), an ended trial (plan_inactive) or a plan that
// does not include the action (plan_upgrade_required).
export const BLOCK_CODES = ['quota_exceeded', 'plan_inactive', 'plan_upgrade_required'];

// True when `detail` is one of the backend's blocking 402 payloads. The name is kept
// from when quota_exceeded was the only one, so every existing caller covers all three.
export const isQuotaDetail = (detail) => !!detail && typeof detail === 'object' && BLOCK_CODES.includes(detail.code);

// Mid-session deactivation: any call answered 403 account_deactivated.
export const DEACTIVATED_EVENT = 'edcube:account-deactivated';
export const DEACTIVATED_MESSAGE = 'This account is deactivated.';
export const isDeactivatedDetail = (detail) => !!detail && typeof detail === 'object' && detail.code === 'account_deactivated';
export const notifyDeactivated = (detail) => {
  window.dispatchEvent(new CustomEvent(DEACTIVATED_EVENT, { detail }));
};

// True for an error produced from a quota 402 (see errorFromResponse).
export const isQuotaError = (err) => !!err && err.status === 402 && err.quota === true;

export const authFetch = async (url, options = {}) => {
  const headers = await authHeaders(options.headers || {});
  const res = await fetch(url, { ...options, headers });
  if (res.status === 402) {
    try {
      const detail = (await res.clone().json()).detail;
      if (isQuotaDetail(detail)) notifyQuotaExceeded(detail);
    } catch { /* non-JSON body */ }
  } else if (res.status === 403) {
    try {
      const detail = (await res.clone().json()).detail;
      if (isDeactivatedDetail(detail)) notifyDeactivated(detail);
    } catch { /* non-JSON body */ }
  } else if (res.ok && (options.method || 'GET').toUpperCase() !== 'GET') {
    window.dispatchEvent(new Event(USAGE_CHANGED_EVENT));
  }
  return res;
};

// Text for a failed response: the backend's `detail` (401/403 and others) when it
// sent one, otherwise the fallback.
export const detailFromResponse = async (res, fallback = 'Request failed') => {
  let detail = null;
  try { detail = (await res.clone().json()).detail; } catch { /* non-JSON body */ }
  if (typeof detail === 'string' && detail) return detail;
  if (res.status === 402 && isQuotaDetail(detail)) return QUOTA_MESSAGE;
  if (detail && typeof detail.message === 'string' && detail.message) return detail.message;
  if (res.status === 401) return 'Your session has expired. Please sign in again.';
  return `${fallback} (${res.status})`;
};

// Error carrying .status for a failed response.
export const errorFromResponse = async (res, fallback) => {
  const err = new Error(await detailFromResponse(res, fallback));
  err.status = res.status;
  if (res.status === 402) err.quota = err.message === QUOTA_MESSAGE;
  return err;
};

// Same as errorFromResponse, but keeps each call site's original wording for
// ordinary failures so org users see no change: only a quota 402 and the 401/403
// detail pass-through differ from the plain `fallback`. With `useDetail`, other
// statuses show the backend's string `detail` when there is one (calls that did so
// before authFetch was introduced).
export const legacyErrorFromResponse = async (res, fallback, { useDetail = false } = {}) => {
  let detail = null;
  try { detail = (await res.clone().json()).detail; } catch { /* non-JSON body */ }
  let message = fallback;
  let quota;
  if (res.status === 402 && isQuotaDetail(detail)) {
    message = QUOTA_MESSAGE;
    quota = true;
  } else if (res.status === 401 || res.status === 403) {
    if (typeof detail === 'string' && detail) message = detail;
    else if (res.status === 401) message = 'Your session has expired. Please sign in again.';
  } else if (useDetail && typeof detail === 'string' && detail) {
    message = detail;
  }
  const err = new Error(message);
  err.status = res.status;
  if (res.status === 402) err.quota = quota === true;
  return err;
};
