// frontend/src/services/afterschoolSynopsisService.js
//
// Fetch wrappers for backend/routes/afterschool_synopsis.py. Teacher/public
// endpoints are unauthenticated (shared portal credential is verified
// server-side, never held here); admin endpoints attach a Firebase ID token,
// mirroring services/synopsisService.js's authHeader() pattern exactly.

const API_BASE = `${import.meta.env.VITE_API_BASE_URL}/api/afterschool-synopsis`;

const authHeader = async (currentUser) => {
  const token = await currentUser.getIdToken();
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
};

// ── Teacher-facing (public, shared-credential portal) ────────────────────────

export const portalLogin = async (username, password) => {
  const res = await fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Incorrect username or password.');
  }
  return res.json();
};

export const getVisibleMonths = async () => {
  const res = await fetch(`${API_BASE}/months/visible`);
  if (!res.ok) throw new Error('Failed to fetch visible months');
  return res.json(); // { months: [...] }
};

export const getActiveMonth = async () => {
  const res = await fetch(`${API_BASE}/months/active`);
  if (!res.ok) throw new Error('Failed to fetch active month');
  return res.json(); // { month: {...} | null }
};

export const getEntry = async (gradeSlug, typeSlug, monthId) => {
  const url = `${API_BASE}/entries/${encodeURIComponent(gradeSlug)}/${encodeURIComponent(typeSlug)}/${encodeURIComponent(monthId)}`;
  const res = await fetch(url);
  if (res.status === 404) return { entry: null };
  if (!res.ok) throw new Error('Failed to fetch entry');
  return res.json(); // { entry: {...} | null }
};

// entries POST always upserts the full entry — pass the complete blocks array.
// drive_link is entry-level (one per grade+activity+month, not per block) and
// is written back verbatim by the backend, so callers must resend the current
// value on every save (same round-trip pattern as `blocks`) or it gets cleared.
export const saveEntry = async ({ grade, synopsisType, monthId, blocks, driveLink }) => {
  const res = await fetch(`${API_BASE}/entries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grade, synopsis_type: synopsisType, month_id: monthId, blocks, drive_link: driveLink }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to save entry');
  }
  return res.json();
};

export const enhanceText = async (rawText) => {
  const res = await fetch(`${API_BASE}/enhance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw_text: rawText }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to enhance text');
  }
  return res.json(); // { enhanced_text }
};

export const uploadPhoto = async (file, gradeSlug, typeSlug, monthId, blockIndex) => {
  const formData = new FormData();
  formData.append('file', file);
  const params = new URLSearchParams({
    grade_slug: gradeSlug,
    type_slug: typeSlug,
    month_id: monthId,
    block_index: String(blockIndex),
  });
  const res = await fetch(`${API_BASE}/photos?${params.toString()}`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to upload photo');
  }
  return res.json(); // { url }
};

// ── Admin-facing (Firebase @indiacc.org auth) ─────────────────────────────────

export const getAllMonths = async (currentUser) => {
  const headers = await authHeader(currentUser);
  const res = await fetch(`${API_BASE}/months`, { headers });
  if (!res.ok) throw new Error('Failed to fetch months');
  return res.json(); // { months: [...] }
};

export const createMonth = async (currentUser, data) => {
  const headers = await authHeader(currentUser);
  const res = await fetch(`${API_BASE}/months`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to create month');
  }
  return res.json();
};

export const updateMonth = async (currentUser, monthId, data) => {
  const headers = await authHeader(currentUser);
  const res = await fetch(`${API_BASE}/months/${encodeURIComponent(monthId)}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to update month');
  }
  return res.json();
};

export const deleteMonth = async (currentUser, monthId) => {
  const headers = await authHeader(currentUser);
  const res = await fetch(`${API_BASE}/months/${encodeURIComponent(monthId)}`, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok) throw new Error('Failed to delete month');
  return res.json();
};

// Full entries (title/raw_text/photo_urls) for all 7 activities at a grade+month —
// gated server-side by verify_icc_admin, so this call always attaches the admin's
// Firebase token even though it's a read.
export const getClassStatus = async (currentUser, gradeSlug, monthId) => {
  const headers = await authHeader(currentUser);
  const res = await fetch(
    `${API_BASE}/classes/${encodeURIComponent(gradeSlug)}?month_id=${encodeURIComponent(monthId)}`,
    { headers }
  );
  if (!res.ok) throw new Error('Failed to fetch class data');
  return res.json(); // { grade, month, entries: { <type_slug>: {...} | null, ... } }
};

const downloadBlob = async (currentUser, url) => {
  const headers = await authHeader(currentUser);
  delete headers['Content-Type'];
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error('Failed to download document');
  return res.blob();
};

export const downloadAfterSchoolDoc = (currentUser, gradeSlug, monthId) =>
  downloadBlob(
    currentUser,
    `${API_BASE}/classes/${encodeURIComponent(gradeSlug)}/download/after-school?month_id=${encodeURIComponent(monthId)}`
  );

export const downloadEcaDoc = (currentUser, gradeSlug, monthId) =>
  downloadBlob(
    currentUser,
    `${API_BASE}/classes/${encodeURIComponent(gradeSlug)}/download/eca?month_id=${encodeURIComponent(monthId)}`
  );
