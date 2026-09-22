// frontend/src/components/afterschoolSynopsis/GradeTypeMonthSelectView.jsx
//
// 3 dropdowns (Grade, Synopsis Type, Month) — Submit hands the selection up
// to AfterschoolSynopsisPage, which switches to the entry view.

import { useState, useEffect } from 'react';
import { GRADE_OPTIONS, SYNOPSIS_TYPE_OPTIONS } from '../../constants/afterschoolSynopsisSchema';
import { getVisibleMonths, getActiveMonth } from '../../services/afterschoolSynopsisService';

const FONT = "'DM Sans', sans-serif";
const SERIF = "'DM Serif Display', serif";

const selectStyle = {
  width: '100%', padding: '12px 14px', borderRadius: 10,
  border: '1.5px solid rgba(255,255,255,0.9)', fontSize: 14,
  fontFamily: FONT, color: '#1e1e2e', background: 'rgba(255,255,255,0.8)',
  outline: 'none', boxSizing: 'border-box', cursor: 'pointer',
};

const labelStyle = {
  display: 'block', fontSize: 11, fontWeight: 600, color: '#8b7355',
  marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em',
};

export default function GradeTypeMonthSelectView({ onSubmit }) {
  const [grade, setGrade] = useState('');
  const [synopsisType, setSynopsisType] = useState('');
  const [monthId, setMonthId] = useState('');
  const [months, setMonths] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getVisibleMonths(), getActiveMonth().catch(() => ({ month: null }))])
      .then(([visibleRes, activeRes]) => {
        if (cancelled) return;
        const visible = visibleRes.months || [];
        setMonths(visible);
        const active = activeRes.month;
        if (active && visible.some((m) => m.month_id === active.month_id)) {
          setMonthId(active.month_id);
        } else if (visible.length) {
          setMonthId(visible[0].month_id);
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const canSubmit = grade && synopsisType && monthId;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    const month = months.find((m) => m.month_id === monthId);
    onSubmit({ grade, synopsisType, monthId, monthLabel: month?.label || monthId });
  };

  return (
    <div style={{ maxWidth: 440, margin: '0 auto', padding: '56px 24px' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <h1 style={{ fontFamily: SERIF, fontSize: 26, color: '#1C1917', margin: '0 0 8px' }}>
          Fill in this month's write-up
        </h1>
        <p style={{ fontSize: 14, color: '#6B6459', margin: 0 }}>
          Pick your grade, class, and month to get started.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{
        background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.9)', borderRadius: 18, padding: '28px 26px',
      }}>
        <div style={{ marginBottom: 18 }}>
          <label style={labelStyle}>Grade batch</label>
          <select value={grade} onChange={(e) => setGrade(e.target.value)} style={selectStyle} required>
            <option value="" disabled>Select a grade…</option>
            {GRADE_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={labelStyle}>Synopsis type</label>
          <select value={synopsisType} onChange={(e) => setSynopsisType(e.target.value)} style={selectStyle} required>
            <option value="" disabled>Select a class…</option>
            {SYNOPSIS_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>Month</label>
          <select
            value={monthId} onChange={(e) => setMonthId(e.target.value)} style={selectStyle}
            required disabled={loading || !months.length}
          >
            {!months.length && <option value="">{loading ? 'Loading…' : 'No months available yet'}</option>}
            {months.map((m) => <option key={m.month_id} value={m.month_id}>{m.label}</option>)}
          </select>
        </div>

        <button
          type="submit" disabled={!canSubmit}
          style={{
            width: '100%', padding: '13px', borderRadius: 100,
            background: canSubmit ? '#1C1917' : '#c8bfb5', color: '#FAF8F4',
            border: 'none', cursor: canSubmit ? 'pointer' : 'not-allowed',
            fontSize: 15, fontWeight: 600, fontFamily: FONT,
          }}
        >
          Continue
        </button>
      </form>
    </div>
  );
}
