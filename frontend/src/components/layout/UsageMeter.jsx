// frontend/src/components/layout/UsageMeter.jsx
// Plan badge + usage bars for public-space users. Renders nothing for org users.
// Numbers come from UsageContext (GET /api/account/usage); none are hardcoded.
import { useAuth } from '../../contexts/AuthContext';
import { useUsage } from '../../contexts/usageContextCore';
import { formatResetDate, percentUsed } from '../../utils/usageFormat';

const GREEN = '#2C5F3A';
const ORANGE = '#E8761A';

const Bar = ({ label, used, limit, edo, compact }) => {
  const unlimited = limit == null;
  const pct = percentUsed(used, limit);
  const text = unlimited
    ? 'Unlimited'
    : edo
      ? `${100 - pct}% left`
      : `${used}/${limit}`;
  return (
    <div style={{ marginBottom: compact ? 6 : 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: compact ? 11 : 13, color: '#555', marginBottom: 2 }}>
        <span>{label}</span>
        <span>{text}</span>
      </div>
      <div style={{ height: compact ? 4 : 6, borderRadius: 3, background: '#E7E5E4', overflow: 'hidden' }}>
        <div style={{ width: unlimited ? '100%' : `${pct}%`, height: '100%', background: unlimited ? '#B7D3BF' : pct >= 90 ? ORANGE : GREEN, transition: 'width .3s ease' }} />
      </div>
    </div>
  );
};

const UsageMeter = ({ compact = false }) => {
  const { isPublicUser } = useAuth();
  const { usage, limits, plan, resetsAt, loaded, openUpgrade } = useUsage();
  if (!isPublicUser || !loaded) return null;

  const isPro = plan === 'pro';
  const resets = formatResetDate(resetsAt);
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
          background: isPro ? GREEN : '#FDEBDD', color: isPro ? '#fff' : ORANGE,
        }}>
          {isPro ? 'Pro plan' : 'Free plan'}
        </span>
        {!isPro && (
          <button
            onClick={openUpgrade}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: ORANGE, fontWeight: 600, fontSize: compact ? 11 : 13, fontFamily: 'inherit', textDecoration: 'underline' }}
          >
            Upgrade
          </button>
        )}
      </div>
      <Bar compact={compact} label="Courses" used={usage?.courses ?? 0} limit={limits?.courses} />
      <Bar compact={compact} label="Generate" used={usage?.generates ?? 0} limit={limits?.generates} />
      <Bar compact={compact} label="Edo" used={usage?.edo_tokens ?? 0} limit={limits?.edo_tokens} edo />
      {!compact && resets && !isPro && (
        <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>Resets on {resets}</div>
      )}
    </div>
  );
};

export default UsageMeter;
