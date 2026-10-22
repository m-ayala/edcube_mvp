// frontend/src/components/admin/adminStyles.js
// Formatting and style helpers shared by the admin tabs (EdCube palette: green #2C5F3A, orange #E8761A).

export const fmtDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
};
export const fmtMoney = (n) => `$${(Number(n) || 0).toFixed(4)}`;
export const fmtPct = (r) => (r == null ? '–' : `${Math.round(r * 100)}%`);

export const btn = (kind = 'primary', disabled = false) => ({
  padding: '8px 14px', borderRadius: 6, border: kind === 'ghost' ? '1px solid #D0CAC0' : 'none', cursor: disabled ? 'not-allowed' : 'pointer',
  fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, opacity: disabled ? 0.6 : 1,
  background: kind === 'primary' ? '#2C5F3A' : kind === 'danger' ? '#B91C1C' : kind === 'orange' ? '#E8761A' : '#fff',
  color: kind === 'ghost' ? '#444' : '#fff',
});
export const input = { padding: '8px 10px', border: '1px solid #D0CAC0', borderRadius: 6, fontSize: 14, fontFamily: "'DM Sans', sans-serif", boxSizing: 'border-box' };
export const card = { border: '1px solid #E7E5E4', borderRadius: 10, background: '#fff', padding: 16 };

