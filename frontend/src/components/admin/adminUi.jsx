// frontend/src/components/admin/adminUi.jsx
// Small shared components for the admin tabs (table, confirm button). Matches the
// EdCube palette used elsewhere: green #2C5F3A, orange #E8761A, warm greys.
import { useState } from 'react';
import { btn } from './adminStyles';

export const Table = ({ columns, rows, onRowClick, empty = 'Nothing to show.', testid }) => (
  <div style={{ overflowX: 'auto', border: '1px solid #E7E5E4', borderRadius: 10, background: '#fff' }}>
    <table data-testid={testid} style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <thead>
        <tr style={{ background: '#FAFAF8', textAlign: 'left' }}>
          {columns.map((c) => <th key={c.key} style={{ padding: '10px 12px', fontWeight: 700, color: '#57534E', borderBottom: '1px solid #E7E5E4', whiteSpace: 'nowrap' }}>{c.label}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr><td colSpan={columns.length} style={{ padding: 16, color: '#78716C' }}>{empty}</td></tr>
        )}
        {rows.map((r, i) => (
          <tr
            key={r.id || r.uid || i}
            onClick={onRowClick ? () => onRowClick(r) : undefined}
            style={{ cursor: onRowClick ? 'pointer' : 'default', borderBottom: '1px solid #F5F5F4' }}
          >
            {columns.map((c) => <td key={c.key} style={{ padding: '9px 12px', verticalAlign: 'top', maxWidth: c.max || 260, overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.render ? c.render(r) : r[c.key]}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// Button that asks "Are you sure?" inline before running. For destructive or account-changing actions.
export const ConfirmButton = ({ label, confirmText, onConfirm, kind = 'danger', disabled, testid }) => {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return <button data-testid={testid} type="button" disabled={disabled} onClick={() => setAsking(true)} style={btn(kind, disabled)}>{label}</button>;
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 13, color: '#57534E' }}>{confirmText}</span>
      <button data-testid={testid ? `${testid}-yes` : undefined} type="button" onClick={() => { setAsking(false); onConfirm(); }} style={btn(kind)}>Yes, confirm</button>
      <button type="button" onClick={() => setAsking(false)} style={btn('ghost')}>Cancel</button>
    </span>
  );
};

export const ErrorLine = ({ error }) => (error ? <div role="alert" style={{ color: '#B91C1C', fontSize: 13, margin: '8px 0' }}>{error}</div> : null);
