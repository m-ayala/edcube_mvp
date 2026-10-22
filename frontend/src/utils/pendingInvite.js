// frontend/src/utils/pendingInvite.js
// Remembers the invite token of someone who opened /invite/:token while signed out, so that after
// sign-up -> email verification -> log in (or Google) the app can send them back to accept it.
// localStorage so a verification link opened in another tab still finds it; both stores can throw
// (private mode, blocked storage), so every access is wrapped. Entries expire with the invite (14 days).
const KEY = 'edcube.pendingInvite';
const TTL_MS = 14 * 24 * 60 * 60 * 1000;

export const rememberInvite = (token) => {
  const value = JSON.stringify({ token, at: Date.now() });
  try { window.localStorage.setItem(KEY, value); return; } catch { /* fall through */ }
  try { window.sessionStorage.setItem(KEY, value); } catch { /* best effort */ }
};

export const pendingInviteToken = () => {
  for (const store of ['localStorage', 'sessionStorage']) {
    try {
      const raw = window[store].getItem(KEY);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed?.token && Date.now() - (parsed.at || 0) < TTL_MS) return String(parsed.token);
      window[store].removeItem(KEY);
    } catch { /* ignore a broken entry */ }
  }
  return null;
};

export const forgetInvite = () => {
  for (const store of ['localStorage', 'sessionStorage']) {
    try { window[store].removeItem(KEY); } catch { /* best effort */ }
  }
};
