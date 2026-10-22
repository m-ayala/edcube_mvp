// frontend/src/components/admin/DomainsTab.jsx
// Email domains people have signed up with, tagged by the backend (education, personal, ...).
// The person's outreach list for Org plans. A tag can be overridden per row; "auto" clears it.
import { useState, useEffect } from 'react';
import { listDomains, setDomainTag, downloadDomainsCsv } from '../../services/adminApi';
import { fmtDate, btn, input } from './adminStyles';
import { Table, ErrorLine } from './adminUi';

const TAGS = [
  { id: 'education', label: 'Education' },
  { id: 'personal', label: 'Personal' },
  { id: 'org_registered', label: 'Org registered' },
  { id: 'other', label: 'Other' },
];

const manualBadge = { marginLeft: 6, padding: '1px 6px', borderRadius: 8, background: '#FDE7D3', color: '#B45309', fontSize: 11, fontWeight: 700 };

const DomainsTab = () => {
  const [tag, setTag] = useState('education');
  const [confidence, setConfidence] = useState('');
  const [state, setState] = useState({ key: null, rows: [], error: '' });
  const [dl, setDl] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState('');
  const key = `${tag}|${confidence}`;

  useEffect(() => {
    let live = true;
    listDomains({ tag, confidence })
      .then((r) => { if (live) setState({ key, rows: r.domains || [], error: '' }); })
      .catch((e) => { if (live) setState({ key, rows: [], error: e.message }); });
    return () => { live = false; };
  }, [tag, confidence, key]);

  const loading = state.key !== key;

  const download = async () => {
    setDl(true); setError('');
    try { await downloadDomainsCsv(tag, confidence); } catch (e) { setError(e.message); } finally { setDl(false); }
  };

  const retag = async (row, value) => {
    setSaving(row.domain); setError('');
    try {
      const updated = await setDomainTag(row.domain, value);
      setState((s) => ({ ...s, rows: s.rows.map((r) => (r.domain === row.domain ? { ...r, ...updated } : r)) }));
    } catch (e) { setError(e.message); } finally { setSaving(''); }
  };

  const columns = [
    { key: 'domain', label: 'Domain', render: (r) => <span style={{ fontWeight: 600 }}>{r.domain}</span> },
    {
      key: 'tag', label: 'Tag',
      render: (r) => (
        <span style={{ whiteSpace: 'nowrap' }}>
          <select
            aria-label={`Tag for ${r.domain}`}
            data-testid={`tag-${r.domain}`}
            value={r.tag}
            disabled={saving === r.domain}
            onChange={(e) => retag(r, e.target.value)}
            style={{ ...input, padding: '4px 6px', fontSize: 13 }}
          >
            {TAGS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            {!TAGS.some((t) => t.id === r.tag) && <option value={r.tag}>{r.tag}</option>}
          </select>
          {r.tag_source === 'admin' && (
            <>
              <span style={manualBadge}>manual</span>
              <button type="button" data-testid={`reset-${r.domain}`} disabled={saving === r.domain} onClick={() => retag(r, 'auto')}
                style={{ ...btn('ghost', saving === r.domain), marginLeft: 6, padding: '3px 8px', fontSize: 12 }}>Reset to auto</button>
            </>
          )}
        </span>
      ),
    },
    { key: 'confidence', label: 'Confidence' },
    { key: 'user_count', label: 'Users' },
    { key: 'first_seen_at', label: 'First seen', render: (r) => fmtDate(r.first_seen_at) },
    { key: 'last_seen_at', label: 'Last seen', render: (r) => fmtDate(r.last_seen_at) },
    { key: 'reason', label: 'Reason', max: 320 },
  ];

  return (
    <div>
      <p style={{ margin: '0 0 14px', color: '#57534E', fontSize: 14 }}>
        Education domains people have signed up with, newest first. Use this as an outreach list for organization plans.
      </p>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <select aria-label="Tag filter" value={tag} onChange={(e) => setTag(e.target.value)} style={input}>
          {TAGS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <select aria-label="Confidence filter" value={confidence} onChange={(e) => setConfidence(e.target.value)} style={input}>
          <option value="">Any confidence</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <span style={{ fontSize: 13, color: '#78716C' }}>{loading ? '' : `${state.rows.length} ${state.rows.length === 1 ? 'domain' : 'domains'}`}</span>
        <button type="button" data-testid="domains-csv" onClick={download} disabled={dl} style={{ ...btn('orange', dl), marginLeft: 'auto' }}>
          {dl ? 'Preparing…' : 'Download CSV'}
        </button>
      </div>
      <ErrorLine error={error || state.error} />
      {loading ? <div style={{ color: '#78716C' }}>Loading…</div> : (
        <Table testid="admin-domains" columns={columns} rows={state.rows.map((r) => ({ ...r, id: r.domain }))} empty="No domains match these filters yet." />
      )}
    </div>
  );
};

export default DomainsTab;
