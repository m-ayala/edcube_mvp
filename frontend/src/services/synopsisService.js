// frontend/src/services/synopsisService.js

const API_BASE = `${import.meta.env.VITE_API_BASE_URL}/api/synopsis`;

const authHeader = async (currentUser) => {
  const token = await currentUser.getIdToken();
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
};

// ── Public reads ──────────────────────────────────────────────────────────────

export const getActiveWeek = async () => {
  const res = await fetch(`${API_BASE}/weeks/active`);
  if (!res.ok) throw new Error('Failed to fetch active week');
  return res.json();
};

export const getVisibleWeeks = async () => {
  const res = await fetch(`${API_BASE}/weeks/visible`);
  if (!res.ok) throw new Error('Failed to fetch visible weeks');
  return res.json();
};

export const getCampsForWeek = async (weekId) => {
  const res = await fetch(`${API_BASE}/weeks/${weekId}/camps`);
  if (!res.ok) throw new Error('Failed to fetch camps');
  return res.json();
};

export const getEntriesForCamp = async (campId, weekId) => {
  const url = weekId
    ? `${API_BASE}/camps/${campId}/entries?week_id=${encodeURIComponent(weekId)}`
    : `${API_BASE}/camps/${campId}/entries`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch entries');
  return res.json();
};

// ── Public writes ─────────────────────────────────────────────────────────────

export const saveEntries = async (campId, weekId, entries) => {
  const res = await fetch(`${API_BASE}/entries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ camp_id: campId, week_id: weekId, entries }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to save entries');
  }
  return res.json();
};

export const uploadPhoto = async (file, campId, day) => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(
    `${API_BASE}/photos?camp_id=${encodeURIComponent(campId)}&day=${encodeURIComponent(day)}`,
    { method: 'POST', body: formData }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to upload photo');
  }
  return res.json(); // { url }
};

// ── Admin reads ───────────────────────────────────────────────────────────────

export const getAllWeeks = async (currentUser) => {
  const headers = await authHeader(currentUser);
  const res = await fetch(`${API_BASE}/weeks`, { headers });
  if (!res.ok) throw new Error('Failed to fetch weeks');
  return res.json();
};

// ── Admin writes ──────────────────────────────────────────────────────────────

export const setupWeek = async (currentUser, data) => {
  const headers = await authHeader(currentUser);
  const res = await fetch(`${API_BASE}/weeks/setup`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to create week');
  }
  return res.json();
};

export const parseFlyer = async (currentUser, file) => {
  const token = await currentUser.getIdToken();
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/parse-flyer`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to parse file');
  }
  return res.json();
};

export const createWeek = async (currentUser, data) => {
  const headers = await authHeader(currentUser);
  const res = await fetch(`${API_BASE}/weeks`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create week');
  return res.json();
};

export const updateWeek = async (currentUser, weekId, data) => {
  const headers = await authHeader(currentUser);
  const res = await fetch(`${API_BASE}/weeks/${weekId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update week');
  return res.json();
};

export const createCamp = async (currentUser, data) => {
  const headers = await authHeader(currentUser);
  const res = await fetch(`${API_BASE}/camps`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create camp');
  return res.json();
};

export const updateCamp = async (currentUser, campId, weekId, data) => {
  const headers = await authHeader(currentUser);
  const res = await fetch(`${API_BASE}/camps/${campId}?week_id=${encodeURIComponent(weekId)}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update camp');
  return res.json();
};

export const deleteCamp = async (currentUser, campId, weekId) => {
  const headers = await authHeader(currentUser);
  const res = await fetch(`${API_BASE}/camps/${campId}?week_id=${encodeURIComponent(weekId)}`, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok) throw new Error('Failed to delete camp');
  return res.json();
};

export const deleteWeek = async (currentUser, weekId) => {
  const headers = await authHeader(currentUser);
  const res = await fetch(`${API_BASE}/weeks/${weekId}`, { method: 'DELETE', headers });
  if (!res.ok) throw new Error('Failed to delete week');
  return res.json();
};

// Both resolve to { folder: { name, link }, files: [{ name, link }] }
export const saveWeeklyDocsToDrive = async (currentUser, weekId) => {
  const headers = await authHeader(currentUser);
  const res = await fetch(`${API_BASE}/weeks/${weekId}/save-to-drive`, { method: 'POST', headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to save docs to Drive');
  }
  return res.json();
};

export const saveGroupDocToDrive = async (currentUser, weekId, groupName) => {
  const headers = await authHeader(currentUser);
  const url = `${API_BASE}/weeks/${weekId}/save-to-drive?group_name=${encodeURIComponent(groupName)}`;
  const res = await fetch(url, { method: 'POST', headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to save doc to Drive');
  }
  return res.json();
};


// ── AI Enhance ────────────────────────────────────────────────────────────────

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

// ── Food ──────────────────────────────────────────────────────────────────────

export const getFoodForWeek = async (weekId) => {
  const res = await fetch(`${API_BASE}/weeks/${weekId}/food`);
  if (!res.ok) throw new Error('Failed to fetch food data');
  return res.json(); // { food: {...} | null }
};

export const parseFoodImage = async (currentUser, file) => {
  const token = await currentUser.getIdToken();
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/parse-food`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to parse food image');
  }
  return res.json();
};

export const saveFoodForWeek = async (weekId, days) => {
  const res = await fetch(`${API_BASE}/weeks/${weekId}/food`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ days }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to save food data');
  }
  return res.json();
};
