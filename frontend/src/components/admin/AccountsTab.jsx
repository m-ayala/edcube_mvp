// frontend/src/components/admin/AccountsTab.jsx
// Recent accounts, search by email, and a detail panel: summary, usage (personal + org pools)
// and actions (set plan, grant bonus credits, deactivate / reactivate).
import { useState, useEffect, useCallback } from 'react';
import {
  recentAccounts, findAccounts, getAccount, getAccountUsage,
  setAccountPlan, grantCredits, deactivateAccount, reactivateAccount,
} from '../../services/adminApi';
import { counterText, CREDIT_KINDS, kindLabel } from '../../utils/usageFormat';
import { fmtDate, btn, input, card } from './adminStyles';
import { Table, ConfirmButton, ErrorLine } from './adminUi';

const PLAN_OPTIONS = [
  { value: 'trial', label: 'Trial' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'org', label: 'Organization' },
];

const rowFromView = (v) => ({
  uid: v.uid,
  email: v.account?.email,
  plan: v.summary?.plan,
  plan_source: v.summary?.plan_source,
  created_at: v.account?.created_at,
  status: v.summary?.status,
  email_domain: v.account?.email_domain,
});

const COLUMNS = [
  { key: 'email', label: 'Email' },
  { key: 'plan', label: 'Plan' },
  { key: 'plan_source', label: 'Plan source', render: (r) => r.plan_source || '–' },
  { key: 'status', label: 'Status' },
  { key: 'created_at', label: 'Created', render: (r) => fmtDate(r.created_at) },
  { key: 'email_domain', label: 'Domain' },
];

const Field = ({ label, children }) => (
  <div style={{ minWidth: 150 }}>
    <div style={{ fontSize: 11, color: '#78716C', textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
    <div style={{ fontSize: 14, fontWeight: 600 }}>{children ?? '–'}</div>
  </div>
);

const UsageBlock = ({ title, overview }) => {
  if (!overview) return null;
  const trial = overview.is_trial;
  return (
    <div style={{ marginBottom: 12 }} data-testid="admin-usage-block">
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{title} <span style={{ fontWeight: 400, color: '#78716C' }}>({overview.plan})</span></div>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#44403C' }}>
        {CREDIT_KINDS.map((k) => {
          const c = overview.credits?.[k];
          return <li key={k}>{kindLabel(k)}: {counterText(k, c, { isTrial: trial })}{c && c.limit != null ? ` (${c.used} used${c.bonus_remaining ? `, ${c.bonus_remaining} bonus` : ''})` : ''}</li>;
        })}
      </ul>
    </div>
  );
};

const AccountDetail = ({ view, usage, onChanged, onError }) => {
  const s = view.summary || {};
  const [plan, setPlan] = useState(s.plan || 'trial');
  const [startDate, setStartDate] = useState('');
  const [grant, setGrant] = useState({ courses: '', generates: '', edo_messages: '' });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const run = async (fn, doneText) => {
    setBusy(true); onError(''); setNote('');
    try {
      const next = await fn();
      setNote(doneText);
      await onChanged(next);
    } catch (e) {
      onError(e.message || 'That did not work.');
    } finally {
      setBusy(false);
    }
  };

  const deactivated = s.status && s.status !== 'active';
  const n = (v) => Math.max(0, parseInt(v, 10) || 0);
  const grantBody = { courses: n(grant.courses), generates: n(grant.generates), edo_messages: n(grant.edo_messages) };
  const grantEmpty = !grantBody.courses && !grantBody.generates && !grantBody.edo_messages;

  return (
    <div data-testid="admin-detail" style={{ ...card, marginTop: 16 }}>
      <h3 style={{ margin: '0 0 12px', fontSize: 17 }}>{view.account?.email || view.uid}</h3>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 16 }}>
        <Field label="Plan">{s.plan}</Field>
        <Field label="Plan source"><span data-testid="admin-plan-source">{s.plan_source || '–'}</span></Field>
        <Field label="Plan started">{fmtDate(s.plan_started_at)}</Field>
        <Field label="Trial ends">{s.plan === 'trial' ? `${fmtDate(s.trial_ends_at)}${s.trial_expired ? ' (ended)' : s.trial_days_left != null ? ` (${s.trial_days_left} days left)` : ''}` : '–'}</Field>
        <Field label="Status">{s.status}{s.deactivated_at ? ` since ${fmtDate(s.deactivated_at)}` : ''}</Field>
        {s.delete_after && <Field label="Permanent deletion after">{fmtDate(s.delete_after)}</Field>}
        <Field label="Bonus credits granted">{CREDIT_KINDS.map((k) => `${s.bonus_credits?.[k] || 0} ${kindLabel(k)}`).join(' · ')}</Field>
        {s.is_admin && <Field label="Role">Admin</Field>}
      </div>

      <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>Usage</h4>
      {!usage ? <div style={{ fontSize: 13, color: '#78716C' }}>Loading usage…</div> : (
        <>
          <UsageBlock title="Personal workspace" overview={usage.personal} />
          {Object.entries(usage.pools || {}).map(([org, ov]) => <UsageBlock key={org} title={`Organization pool: ${org}`} overview={ov} />)}
        </>
      )}

      <h4 style={{ margin: '16px 0 8px', fontSize: 14 }}>Set plan</h4>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <select aria-label="Plan" value={plan} onChange={(e) => setPlan(e.target.value)} style={input}>
          {PLAN_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <label style={{ fontSize: 13, color: '#57534E' }}>
          Start date (optional){' '}
          <input aria-label="Plan start date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={input} />
        </label>
        <ConfirmButton
          testid="admin-set-plan"
          kind="primary"
          label="Set plan"
          confirmText={`Change this account to ${plan}${startDate ? ` starting ${startDate}` : ''}?`}
          disabled={busy}
          onConfirm={() => run(() => setAccountPlan(view.uid, plan, startDate ? `${startDate}T00:00:00Z` : undefined), 'Plan updated.')}
        />
      </div>

      <h4 style={{ margin: '16px 0 8px', fontSize: 14 }}>Grant bonus credits</h4>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        {CREDIT_KINDS.map((k) => (
          <label key={k} style={{ fontSize: 13, color: '#57534E' }}>
            {kindLabel(k)}{' '}
            <input aria-label={`Bonus ${kindLabel(k)}`} type="number" min="0" value={grant[k]} onChange={(e) => setGrant((g) => ({ ...g, [k]: e.target.value }))} style={{ ...input, width: 80 }} />
          </label>
        ))}
        <button
          type="button"
          data-testid="admin-grant"
          disabled={busy || grantEmpty}
          onClick={() => run(async () => { const r = await grantCredits(view.uid, grantBody); setGrant({ courses: '', generates: '', edo_messages: '' }); return r; }, 'Credits granted.')}
          style={btn('primary', busy || grantEmpty)}
        >
          Grant credits
        </button>
      </div>

      <h4 style={{ margin: '16px 0 8px', fontSize: 14 }}>Account status</h4>
      {deactivated ? (
        <ConfirmButton testid="admin-reactivate" kind="primary" label="Reactivate account" confirmText="Restore this account?" disabled={busy}
          onConfirm={() => run(() => reactivateAccount(view.uid), 'Account reactivated.')} />
      ) : (
        <ConfirmButton testid="admin-deactivate" kind="danger" label="Deactivate account" disabled={busy}
          confirmText="Deactivate this account? They are signed out and it is deleted after the grace period unless reactivated."
          onConfirm={() => run(() => deactivateAccount(view.uid), 'Account deactivated.')} />
      )}
      {note && <div role="status" data-testid="admin-note" style={{ marginTop: 10, color: '#2C5F3A', fontSize: 13 }}>{note}</div>}
    </div>
  );
};

const AccountsTab = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [searchNote, setSearchNote] = useState('');
  const [selected, setSelected] = useState(null); // { view, usage }

  const loadRecent = useCallback(async () => {
    setLoading(true);
    try {
      const r = await recentAccounts(50);
      setRows(r.accounts || []);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRecent(); }, [loadRecent]);

  const open = async (uid) => {
    setError('');
    setSelected({ view: null, usage: null });
    try {
      const [view, usage] = await Promise.all([getAccount(uid), getAccountUsage(uid)]);
      setSelected({ view, usage });
    } catch (e) {
      setSelected(null);
      setError(e.message);
    }
  };

  const search = async (e) => {
    e.preventDefault();
    if (!email.trim()) { setSearchNote(''); loadRecent(); return; }
    setError(''); setSearchNote('');
    try {
      const r = await findAccounts(email.trim());
      setRows((r.accounts || []).map(rowFromView));
      if (!(r.accounts || []).length) {
        setSearchNote(r.auth_user ? `A login exists for ${r.auth_user.email} (${r.auth_user.uid}) but it has no account record yet.` : 'No account with that email.');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  // After an admin action: take the fresh view the server returned and reload usage + list.
  const afterChange = async (nextView) => {
    const uid = nextView?.uid || selected?.view?.uid;
    const [view, usage] = await Promise.all([getAccount(uid), getAccountUsage(uid)]);
    setSelected({ view: view || nextView, usage });
    setRows((prev) => prev.map((r) => (r.uid === uid ? { ...r, ...rowFromView(view) } : r)));
  };

  return (
    <div>
      <form onSubmit={search} style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <input aria-label="Search by email" placeholder="Search by email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ ...input, width: 300 }} />
        <button type="submit" style={btn('primary')}>Search</button>
        <button type="button" onClick={() => { setEmail(''); setSearchNote(''); loadRecent(); }} style={btn('ghost')}>Show recent</button>
      </form>
      <ErrorLine error={error} />
      {searchNote && <div style={{ fontSize: 13, color: '#78716C', margin: '8px 0' }}>{searchNote}</div>}
      {loading ? <div style={{ color: '#78716C' }}>Loading…</div> : (
        <Table testid="admin-accounts" columns={COLUMNS} rows={rows} onRowClick={(r) => open(r.uid)} empty="No accounts yet." />
      )}
      {selected && !selected.view && <div style={{ marginTop: 16, color: '#78716C' }}>Loading account…</div>}
      {selected?.view && (
        <AccountDetail key={selected.view.uid} view={selected.view} usage={selected.usage} onChanged={afterChange} onError={setError} />
      )}
    </div>
  );
};

export default AccountsTab;
