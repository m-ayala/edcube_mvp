// frontend/src/components/admin/CostsTab.jsx
// AI cost report from GET /api/admin/cost-summary: totals, then by action, credit kind and user.
import { useState, useEffect } from 'react';
import { costSummary, downloadUsageLogCsv } from '../../services/adminApi';
import { fmtMoney, fmtPct, btn, input, card } from './adminStyles';
import { Table, ErrorLine } from './adminUi';

const isoDay = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => { const d = new Date(); d.setUTCDate(d.getUTCDate() - n); return isoDay(d); };

const common = [
  { key: 'count', label: 'Calls' },
  { key: 'success', label: 'Success', render: (r) => fmtPct(r.success_rate) },
  { key: 'tokens', label: 'Tokens', render: (r) => r.tokens?.sum ?? 0 },
  { key: 'bb', label: 'Browserbase search / fetch', render: (r) => `${r.bb_search?.sum ?? 0} / ${r.bb_fetch?.sum ?? 0}` },
  { key: 'cost', label: 'Est. cost', render: (r) => fmtMoney(r.est_cost_usd?.sum) },
  { key: 'avg', label: 'Avg per call', render: (r) => fmtMoney(r.est_cost_usd?.avg) },
];
const BY_ACTION = [{ key: 'action', label: 'Action' }, { key: 'credit_kind', label: 'Credit kind', render: (r) => r.credit_kind || '–' }, ...common];
const BY_KIND = [
  { key: 'credit_kind', label: 'Credit kind', render: (r) => r.credit_kind || '–' },
  ...common,
  { key: 'per_credit', label: 'Cost per charged credit', render: (r) => (r.est_cost_per_charged_credit_usd == null ? '–' : fmtMoney(r.est_cost_per_charged_credit_usd)) },
];
const BY_USER = [{ key: 'uid', label: 'User', max: 200 }, { key: 'email_domain', label: 'Domain', render: (r) => r.email_domain || '–' }, { key: 'plan', label: 'Plan', render: (r) => r.plan || '–' }, ...common];

const Stat = ({ label, value }) => (
  <div style={{ ...card, padding: '12px 16px', minWidth: 150 }}>
    <div style={{ fontSize: 11, color: '#78716C', textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 700, color: '#2C5F3A' }}>{value}</div>
  </div>
);

const CostsTab = () => {
  const [from, setFrom] = useState(() => daysAgo(30));
  const [to, setTo] = useState(() => isoDay(new Date()));
  const [state, setState] = useState({ key: null, data: null, error: '' });
  const [dl, setDl] = useState(false);
  const [error, setError] = useState('');
  const key = `${from}|${to}`;

  useEffect(() => {
    let live = true;
    costSummary(from, to)
      .then((data) => { if (live) setState({ key, data, error: '' }); })
      .catch((e) => { if (live) setState({ key, data: null, error: e.message }); });
    return () => { live = false; };
  }, [from, to, key]);

  const loading = state.key !== key;
  const d = loading ? null : state.data;
  const t = d?.totals;

  const download = async () => {
    setDl(true); setError('');
    try { await downloadUsageLogCsv(from, to); } catch (e) { setError(e.message); } finally { setDl(false); }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        <label style={{ fontSize: 13, color: '#57534E' }}>From <input aria-label="From date" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} style={input} /></label>
        <label style={{ fontSize: 13, color: '#57534E' }}>To <input aria-label="To date" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} style={input} /></label>
        <button type="button" data-testid="usage-csv" onClick={download} disabled={dl} style={{ ...btn('orange', dl), marginLeft: 'auto' }}>
          {dl ? 'Preparing…' : 'Download usage log CSV'}
        </button>
      </div>
      <ErrorLine error={error || state.error} />
      {loading && <div style={{ color: '#78716C' }}>Loading…</div>}
      {d && (
        <>
          {d.rates_are_placeholder && (
            <div data-testid="rates-banner" role="status" style={{ background: '#FFF4E5', border: '1px solid #F5D9B0', color: '#7A4A12', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 14 }}>
              Cost estimates are $0 until you fill in cost_rates in EdCube/platform_config.
            </div>
          )}
          {d.truncated && (
            <div style={{ background: '#FFF4E5', border: '1px solid #F5D9B0', color: '#7A4A12', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 14 }}>
              Only the newest {d.scan_limit} log rows in this range were counted. Pick a shorter range for exact totals.
            </div>
          )}
          <div data-testid="cost-totals" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
            <Stat label="AI calls" value={t?.count ?? 0} />
            <Stat label="Success rate" value={fmtPct(t?.success_rate)} />
            <Stat label="Tokens" value={t?.tokens?.sum ?? 0} />
            <Stat label="Browserbase search / fetch" value={`${t?.bb_search?.sum ?? 0} / ${t?.bb_fetch?.sum ?? 0}`} />
            <Stat label="Estimated cost" value={fmtMoney(t?.est_cost_usd?.sum)} />
            <Stat label="Spent on failures" value={fmtMoney(t?.est_cost_usd?.failed_sum)} />
          </div>
          <h3 style={{ fontSize: 15, margin: '0 0 8px' }}>By action</h3>
          <Table testid="cost-by-action" columns={BY_ACTION} rows={(d.by_action || []).map((r, i) => ({ id: i, ...r }))} empty="No AI calls in this range." />
          <h3 style={{ fontSize: 15, margin: '20px 0 8px' }}>By credit kind</h3>
          <Table testid="cost-by-kind" columns={BY_KIND} rows={(d.by_credit_kind || []).map((r, i) => ({ id: i, ...r }))} empty="No AI calls in this range." />
          <h3 style={{ fontSize: 15, margin: '20px 0 8px' }}>By user</h3>
          <Table testid="cost-by-user" columns={BY_USER} rows={(d.by_user || []).map((r, i) => ({ id: i, ...r }))} empty="No AI calls in this range." />
        </>
      )}
    </div>
  );
};

export default CostsTab;
