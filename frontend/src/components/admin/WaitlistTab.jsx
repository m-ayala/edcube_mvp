// frontend/src/components/admin/WaitlistTab.jsx
// Paid / enterprise waitlist entries, newest first, with an interest filter and a CSV download.
import { useState, useEffect } from 'react';
import { listWaitlist, downloadWaitlistCsv } from '../../services/adminApi';
import { fmtDate, btn, input } from './adminStyles';
import { Table, ErrorLine } from './adminUi';

const COLUMNS = [
  { key: 'created_at', label: 'Joined', render: (r) => fmtDate(r.created_at) },
  { key: 'interest', label: 'Interest', render: (r) => (r.interest === 'organization' ? 'School / org' : 'Teacher') },
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'org_name', label: 'Organization' },
  { key: 'staff_size', label: 'Staff size' },
  { key: 'role', label: 'Role' },
  { key: 'note', label: 'Note', max: 320 },
  { key: 'source', label: 'Source' },
];

const WaitlistTab = () => {
  const [interest, setInterest] = useState('');
  const [state, setState] = useState({ key: null, entries: [], error: '' });
  const [dl, setDl] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    listWaitlist(interest || undefined)
      .then((r) => { if (live) setState({ key: interest, entries: r.entries || [], error: '' }); })
      .catch((e) => { if (live) setState({ key: interest, entries: [], error: e.message }); });
    return () => { live = false; };
  }, [interest]);

  const loading = state.key !== interest;

  const download = async () => {
    setDl(true); setError('');
    try { await downloadWaitlistCsv(interest || undefined); } catch (e) { setError(e.message); } finally { setDl(false); }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
        <select aria-label="Interest filter" value={interest} onChange={(e) => setInterest(e.target.value)} style={input}>
          <option value="">Everyone</option>
          <option value="teacher">Teacher plan</option>
          <option value="organization">School or organization</option>
        </select>
        <span style={{ fontSize: 13, color: '#78716C' }}>{loading ? '' : `${state.entries.length} ${state.entries.length === 1 ? 'entry' : 'entries'}`}</span>
        <button type="button" data-testid="waitlist-csv" onClick={download} disabled={dl} style={{ ...btn('orange', dl), marginLeft: 'auto' }}>
          {dl ? 'Preparing…' : 'Download CSV'}
        </button>
      </div>
      <ErrorLine error={error || state.error} />
      {loading ? <div style={{ color: '#78716C' }}>Loading…</div> : (
        <Table testid="admin-waitlist" columns={COLUMNS} rows={state.entries} empty="Nobody has joined the waitlist yet." />
      )}
    </div>
  );
};

export default WaitlistTab;
