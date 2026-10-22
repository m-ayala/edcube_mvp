// frontend/src/services/sharingApi.js
// Sharing, collaboration and course-deletion calls (TASK-036 backend). Every call that needs an
// account goes through authFetch (token + X-EdCube-Workspace). The two public reads
// (view-only link, invite landing) are plain fetches: they must work signed out.
//
// Failures throw ApiError carrying .status, .code and .detail (the backend's `detail` object) so a
// screen can branch on the code instead of parsing text.
import { authFetch } from './authFetch';

const API = () => import.meta.env.VITE_API_BASE_URL;
const enc = encodeURIComponent;

export class ApiError extends Error {
  constructor(message, status, detail) {
    super(message);
    this.status = status;
    this.detail = detail && typeof detail === 'object' ? detail : null;
    this.code = this.detail?.code;
    this.reason = this.detail?.reason;
  }
}

const errorFrom = async (res, fallback) => {
  let detail = null;
  try { detail = (await res.json()).detail; } catch { /* non-JSON body */ }
  const message = typeof detail === 'string' && detail
    ? detail
    : (detail && typeof detail.message === 'string' && detail.message) || `${fallback} (${res.status})`;
  return new ApiError(message, res.status, detail);
};

// `quietBlock`: the caller shows a blocking 402 inline, so authFetch must not open the global modal.
const call = async (path, { method = 'GET', body, fallback = 'Request failed' } = {}) => {
  const res = await authFetch(`${API()}${path}`, {
    method,
    quietBlock: true,
    ...(body !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) throw await errorFrom(res, fallback);
  try { return await res.json(); } catch { return {}; }
};

// ── owner: view-only links ──────────────────────────────────────────────────────────────────
export const createLink = (courseId) =>
  call(`/api/curricula/${enc(courseId)}/links`, { method: 'POST', fallback: 'Could not create the link' });
export const listLinks = (courseId) =>
  call(`/api/curricula/${enc(courseId)}/links`, { fallback: 'Could not load the links' });
export const revokeLink = (courseId, token) =>
  call(`/api/curricula/${enc(courseId)}/links/${enc(token)}`, { method: 'DELETE', fallback: 'Could not revoke the link' });

// ── owner: collaborators and invites ────────────────────────────────────────────────────────
export const listCollaborators = (courseId) =>
  call(`/api/curricula/${enc(courseId)}/collaborators`, { fallback: 'Could not load collaborators' });
export const inviteByEmail = (courseId, email, accessType) =>
  call(`/api/curricula/${enc(courseId)}/invites`, {
    method: 'POST', body: { email, access_type: accessType }, fallback: 'Could not send the invite',
  });
export const cancelInvite = (courseId, inviteId) =>
  call(`/api/curricula/${enc(courseId)}/invites/${enc(inviteId)}`, { method: 'DELETE', fallback: 'Could not cancel the invite' });
export const removeCollaborator = (courseId, uid) =>
  call(`/api/curricula/${enc(courseId)}/collaborators/${enc(uid)}`, { method: 'DELETE', fallback: 'Could not remove the collaborator' });

// ── any member ──────────────────────────────────────────────────────────────────────────────
export const leaveCourse = (courseId) =>
  call(`/api/curricula/${enc(courseId)}/leave`, { method: 'POST', fallback: 'Could not leave the course' });
export const getAccess = (courseId) =>
  call(`/api/curricula/${enc(courseId)}/access`, { fallback: 'Could not check access' });

// ── delete (owner only) ─────────────────────────────────────────────────────────────────────
export const getDeleteImpact = (courseId) =>
  call(`/api/curricula/${enc(courseId)}/delete-impact`, { fallback: 'Could not check who is affected' });
export const deleteCourse = (courseId) =>
  call(`/api/curricula/${enc(courseId)}`, { method: 'DELETE', fallback: 'Could not delete the course' });

// ── invite accept (signed in) ───────────────────────────────────────────────────────────────
export const acceptInvite = (token) =>
  call(`/api/invites/${enc(token)}/accept`, { method: 'POST', fallback: 'Could not accept the invite' });

// ── public (no account) ─────────────────────────────────────────────────────────────────────
const publicGet = async (path, fallback) => {
  const res = await fetch(`${API()}${path}`, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw await errorFrom(res, fallback);
  return res.json();
};
export const getPublicShare = (token) => publicGet(`/api/share/${enc(token)}`, 'Could not load this course');
export const getInviteInfo = (token) => publicGet(`/api/invites/${enc(token)}`, 'Could not load this invitation');
