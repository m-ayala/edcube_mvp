// frontend/src/components/afterschoolSynopsis/AdminMonthDropdown.jsx
//
// A plain native <select> for choosing which month to manage/view — an
// earlier popover-based dropdown design was flaky and was replaced with this
// simpler, reliable pattern — plus an always-visible checklist below it (one
// row per month, visibility checkbox + label + "★ active" tag; never hidden
// in a panel, so every month stays easy to find). A "Set as active month"
// button / "✓ Active month" badge reacts to whichever month the select
// currently shows. A row of 6 color swatches sets that month's newsletter
// highlight color. "+ Add month" offers only unadded months from the fixed
// Sept 2026 – May 2027 list.

import { useState, useEffect, useCallback } from 'react';
import { Plus, Check } from 'lucide-react';
import { ALLOWED_MONTHS, COLOR_THEMES } from '../../constants/afterschoolSynopsisSchema';
import { getAllMonths, createMonth, updateMonth } from '../../services/afterschoolSynopsisService';

const FONT = "'DM Sans', sans-serif";

const selectStyle = {
  padding: '9px 14px', borderRadius: 10, border: '1.5px solid rgba(255,255,255,0.9)',
  fontSize: 14, fontFamily: FONT, color: '#1e1e2e', background: 'rgba(255,255,255,0.85)',
  outline: 'none', cursor: 'pointer', minWidth: 220,
};

const sectionLabel = {
  fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase',
  letterSpacing: '0.06em', marginBottom: 8,
};

export default function AdminMonthDropdown({ currentUser, selectedMonthId, onSelectMonth, onMonthsChange }) {
  const [months, setMonths] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyMonthId, setBusyMonthId] = useState(null);
  const [addingMonthId, setAddingMonthId] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await getAllMonths(currentUser);
      const list = res.months || [];
      setMonths(list);
      onMonthsChange?.(list);
      if (!selectedMonthId && list.length) {
        const active = list.find((m) => m.is_active);
        onSelectMonth((active || list[0]).month_id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  useEffect(() => { load(); }, [load]);

  const selectedMonth = months.find((m) => m.month_id === selectedMonthId);

  const handleSetActive = async () => {
    if (!selectedMonth || selectedMonth.is_active) return;
    setBusyMonthId(selectedMonth.month_id);
    try {
      await updateMonth(currentUser, selectedMonth.month_id, { is_active: true });
      await load();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusyMonthId(null);
    }
  };

  const handleToggleVisible = async (month) => {
    setBusyMonthId(month.month_id);
    try {
      await updateMonth(currentUser, month.month_id, { is_visible: !month.is_visible });
      await load();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusyMonthId(null);
    }
  };

  const handleColorChange = async (colorId) => {
    if (!selectedMonth) return;
    setBusyMonthId(selectedMonth.month_id);
    try {
      await updateMonth(currentUser, selectedMonth.month_id, { color_theme: colorId });
      await load();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusyMonthId(null);
    }
  };

  const addedIds = new Set(months.map((m) => m.month_id));
  const availableToAdd = ALLOWED_MONTHS.filter((m) => !addedIds.has(m.month_id));

  const handleAddMonth = async () => {
    if (!addingMonthId) return;
    const target = ALLOWED_MONTHS.find((m) => m.month_id === addingMonthId);
    if (!target) return;
    setCreating(true);
    setError('');
    try {
      const res = await createMonth(currentUser, { year: target.year, month: target.month });
      setAddingMonthId('');
      await load();
      if (res?.month_id) onSelectMonth(res.month_id);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return <div style={{ fontSize: 13, color: '#8b7355', fontFamily: FONT }}>Loading months…</div>;
  }

  return (
    <div style={{
      background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      border: '1px solid rgba(255,255,255,0.9)', borderRadius: 16, padding: '18px 20px', marginBottom: 24,
      fontFamily: FONT,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <select
          value={selectedMonthId || ''}
          onChange={(e) => onSelectMonth(e.target.value)}
          style={selectStyle}
        >
          {!months.length && <option value="">No months yet</option>}
          {months.map((m) => (
            <option key={m.month_id} value={m.month_id}>
              {m.label}{m.is_active ? ' ★ active' : ''}
            </option>
          ))}
        </select>

        {selectedMonth && (
          selectedMonth.is_active ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 100, background: '#B2E8C8', color: '#1a4a2a', fontSize: 13, fontWeight: 500 }}>
              <Check size={13} /> Active month
            </span>
          ) : (
            <button
              onClick={handleSetActive}
              disabled={busyMonthId === selectedMonth.month_id}
              style={{
                padding: '8px 16px', borderRadius: 100, border: 'none', cursor: 'pointer',
                background: 'rgba(0,0,0,0.07)', color: '#1e1e2e', fontSize: 13, fontWeight: 500, fontFamily: FONT,
              }}
            >
              Set as active month
            </button>
          )
        )}
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={sectionLabel}>Visible to teachers</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 220, overflowY: 'auto' }}>
          {months.map((m) => (
            <label key={m.month_id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', borderRadius: 8, cursor: 'pointer',
              background: m.month_id === selectedMonthId ? 'rgba(172,216,240,0.25)' : 'transparent',
            }}>
              <input
                type="checkbox"
                checked={!!m.is_visible}
                disabled={busyMonthId === m.month_id}
                onChange={() => handleToggleVisible(m)}
                style={{ width: 15, height: 15, cursor: 'pointer', flexShrink: 0 }}
              />
              <span style={{ flex: 1, fontSize: 13, color: '#1e1e2e' }}>{m.label}</span>
              {m.is_active && <span style={{ fontSize: 11, color: '#2d7a47', fontWeight: 600 }}>★ active</span>}
            </label>
          ))}
          {!months.length && <div style={{ fontSize: 13, color: '#8b7355' }}>No months added yet.</div>}
        </div>
      </div>

      {selectedMonth && (
        <div style={{ marginBottom: 16 }}>
          <div style={sectionLabel}>Newsletter highlight color</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {COLOR_THEMES.map((c) => (
              <button
                key={c.id}
                onClick={() => handleColorChange(c.id)}
                title={c.label}
                disabled={busyMonthId === selectedMonth.month_id}
                style={{
                  width: 28, height: 28, borderRadius: '50%', background: c.hex, cursor: 'pointer',
                  border: selectedMonth.color_theme === c.id ? '3px solid #1C1917' : '1px solid rgba(0,0,0,0.15)',
                  padding: 0,
                }}
              />
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingTop: 12, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
        <select
          value={addingMonthId}
          onChange={(e) => setAddingMonthId(e.target.value)}
          style={{ ...selectStyle, minWidth: 180 }}
          disabled={!availableToAdd.length}
        >
          <option value="">{availableToAdd.length ? 'Choose a month to add…' : 'All months added'}</option>
          {availableToAdd.map((m) => <option key={m.month_id} value={m.month_id}>{m.label}</option>)}
        </select>
        <button
          onClick={handleAddMonth}
          disabled={!addingMonthId || creating}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '9px 16px', borderRadius: 100, border: 'none',
            cursor: (!addingMonthId || creating) ? 'not-allowed' : 'pointer',
            background: '#1C1917', color: '#FAF8F4', fontSize: 13, fontWeight: 500, fontFamily: FONT,
            opacity: (!addingMonthId || creating) ? 0.5 : 1,
          }}
        >
          <Plus size={14} /> {creating ? 'Adding…' : 'Add month'}
        </button>
      </div>

      {error && <div style={{ fontSize: 12, color: '#c0392b', marginTop: 10 }}>{error}</div>}
    </div>
  );
}
