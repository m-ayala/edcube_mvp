// frontend/src/components/layout/UsageMeter.jsx
// Credit counters for the workspace in use ("7 of 10 courses left this month"). Numbers come
// from UsageContext (GET /api/account/usage); none are hardcoded. Hidden for an organization
// pool with no limits, so unlimited organizations see no change.
import { useAuth } from '../../contexts/AuthContext';
import { useUsage } from '../../contexts/usageContextCore';
import { formatResetDate, percentUsed, counterText, CREDIT_KINDS } from '../../utils/usageFormat';
import { planLabel } from '../../utils/planLabel';

const GREEN = '#2C5F3A';
const ORANGE = '#E8761A';

const Row = ({ kind, c, isTrial, compact }) => {
  const unlimited = !c || c.limit == null;
  const total = unlimited ? 0 : c.limit + (c.bonus_remaining || 0);
  const pctLeft = unlimited || total <= 0 ? 100 : 100 - percentUsed(total - (c.remaining ?? 0), total);
  return (
    <div style={{ marginBottom: compact ? 6 : 10 }} data-testid={`credit-${kind}`}>
      <div style={{ fontSize: compact ? 11 : 13, color: '#555', marginBottom: 2 }}>{counterText(kind, c, { isTrial })}</div>
      <div style={{ height: compact ? 4 : 6, borderRadius: 3, background: '#E7E5E4', overflow: 'hidden' }}>
        <div style={{ width: `${pctLeft}%`, height: '100%', background: unlimited ? '#B7D3BF' : pctLeft <= 10 ? ORANGE : GREEN, transition: 'width .3s ease' }} />
      </div>
    </div>
  );
};

const UsageMeter = ({ compact = false }) => {
  const { orgName, plan: authPlan } = useAuth();
  const { credits, plan, isTrial, isPool, trialDaysLeft, trialEndsAt, resetsAt, meterVisible, openUpgrade } = useUsage();
  if (!meterVisible) return null;

  const shownPlan = plan || authPlan;
  const resets = formatResetDate(resetsAt);
  const trialEnd = formatResetDate(trialEndsAt);
  return (
    <div
      data-testid="usage-meter"
      style={{
        fontFamily: "'DM Sans', sans-serif",
        padding: compact ? '10px 14px 4px' : '16px 18px',
        ...(compact ? {} : { border: '1px solid #E7E5E4', borderRadius: 10, background: '#fff', maxWidth: 360 }),
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: compact ? 8 : 12 }}>
        <span style={{
          fontSize: compact ? 11 : 12, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
          background: isTrial ? '#FDEBDD' : GREEN, color: isTrial ? ORANGE : '#fff',
        }}>
          {isPool ? "Your organization's pool" : planLabel(shownPlan, orgName)}
        </span>
        {isTrial && (
          <button
            onClick={openUpgrade}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: ORANGE, fontWeight: 600, fontSize: compact ? 11 : 13, fontFamily: 'inherit', textDecoration: 'underline' }}
          >
            Upgrade
          </button>
        )}
      </div>
      {CREDIT_KINDS.map((k) => (
        <Row key={k} kind={k} c={credits?.[k]} isTrial={isTrial} compact={compact} />
      ))}
      {isTrial && trialEnd && (
        <div style={{ fontSize: compact ? 11 : 12, color: '#888', marginTop: 4 }}>
          Trial ends {trialEnd}{trialDaysLeft != null ? ` (${trialDaysLeft} ${trialDaysLeft === 1 ? 'day' : 'days'} left)` : ''}
        </div>
      )}
      {!isTrial && resets && (
        <div style={{ fontSize: compact ? 11 : 12, color: '#888', marginTop: 4 }}>Resets {resets}</div>
      )}
    </div>
  );
};

export default UsageMeter;
