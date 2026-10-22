// frontend/src/services/adminApi.js
// Calls to /api/admin/* (admin claim required; the backend enforces it). Every call goes
// through authFetch so the ID token and workspace header are attached.
import { authFetch, detailFromResponse } from './authFetch';

const BASE = () => `${import.meta.env.VITE_API_BASE_URL}/api/admin`;

const qs = (params) => {
  const p = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') p.set(k, v); });
  const s = p.toString();
  return s ? `?${s}` : '';
};

const json = async (res, fallback) => {
  if (!res.ok) throw new Error(await detailFromResponse(res, fallback));
  return res.json();
};

const send = (path, method, body) => authFetch(`${BASE()}${path}`, {
  method,
  headers: { 'Content-Type': 'application/json' },
  ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
});

export const recentAccounts = async (limit = 50) => json(await authFetch(`${BASE()}/accounts/recent${qs({ limit })}`), 'Could not load accounts');
export const findAccounts = async (email) => json(await authFetch(`${BASE()}/accounts${qs({ email })}`), 'Search failed');
export const getAccount = async (uid) => json(await authFetch(`${BASE()}/accounts/${encodeURIComponent(uid)}`), 'Could not load the account');
export const getAccountUsage = async (uid) => json(await authFetch(`${BASE()}/accounts/${encodeURIComponent(uid)}/usage`), 'Could not load usage');
export const setAccountPlan = async (uid, plan, startedAt) =>
  json(await send(`/accounts/${encodeURIComponent(uid)}/plan`, 'PATCH', { plan, ...(startedAt ? { started_at: startedAt } : {}) }), 'Could not change the plan');
export const grantCredits = async (uid, credits) =>
  json(await send(`/accounts/${encodeURIComponent(uid)}/credits`, 'POST', credits), 'Could not grant credits');
export const deactivateAccount = async (uid) => json(await send(`/accounts/${encodeURIComponent(uid)}/deactivate`, 'POST'), 'Could not deactivate');
export const reactivateAccount = async (uid) => json(await send(`/accounts/${encodeURIComponent(uid)}/reactivate`, 'POST'), 'Could not reactivate');

export const listWaitlist = async (interest) => json(await authFetch(`${BASE()}/waitlist${qs({ interest, format: 'json' })}`), 'Could not load the waitlist');
export const costSummary = async (from, to) => json(await authFetch(`${BASE()}/cost-summary${qs({ from, to })}`), 'Could not load costs');

// Fetches a CSV with the auth header and saves it through a temporary link
// (a plain <a href> could not send the token).
const downloadCsv = async (path, params, filename) => {
  const res = await authFetch(`${BASE()}${path}${qs({ ...params, format: 'csv' })}`);
  if (!res.ok) throw new Error(await detailFromResponse(res, 'Download failed'));
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
export const downloadWaitlistCsv = (interest) => downloadCsv('/waitlist', { interest }, 'edcube-waitlist.csv');
export const downloadUsageLogCsv = (from, to) => downloadCsv('/usage-log', { from, to }, 'edcube-usage-log.csv');
