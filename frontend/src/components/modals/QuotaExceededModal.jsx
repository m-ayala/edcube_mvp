// frontend/src/components/modals/QuotaExceededModal.jsx
// Shown for any blocking 402: quota_exceeded (a credit is used up), plan_inactive
// (trial ended) and plan_upgrade_required (not in the plan). The server's `message`
// is used whenever it sent one.
import { formatResetDate, quotaTitle, pausedMessage, TRIAL_ENDED_MESSAGE } from '../../utils/usageFormat';

const QuotaExceededModal = ({ detail, onClose, onUpgrade }) => {
  const code = detail?.code || 'quota_exceeded';
  const trial = !!detail?.is_trial || detail?.plan === 'trial';
  const resets = formatResetDate(detail?.resets_at);
  const trialEnds = formatResetDate(detail?.trial_ends_at);
  let body = detail?.message;
  if (!body) {
    if (code === 'plan_inactive') body = TRIAL_ENDED_MESSAGE;
    else if (code === 'plan_upgrade_required') body = 'This is not included in your current plan.';
    else if (detail?.kind) body = pausedMessage(detail.kind, { isTrial: trial, resetsAt: detail.resets_at, trialEndsAt: detail.trial_ends_at });
  }
  const dateLine = code === 'quota_exceeded'
    ? (trial ? (trialEnds ? `Your trial ends ${trialEnds}.` : '') : (resets ? `Resets ${resets}.` : ''))
    : '';
  // The server's message carries no date; the built-in fallback already does.
  const showDate = !!detail?.message && !!dateLine;
  return (
    <div
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000,
        fontFamily: "'DM Sans', sans-serif",
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={quotaTitle(detail)}
        data-testid="quota-modal"
        data-code={code}
        data-kind={detail?.kind || ''}
        style={{ backgroundColor: 'white', borderRadius: '8px', padding: '30px', maxWidth: '420px', width: '90%', textAlign: 'center' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0, color: '#2C5F3A', fontSize: '22px' }}>{quotaTitle(detail)}</h2>
        {body && <p data-testid="quota-message" style={{ margin: '0 0 12px', color: '#666' }}>{body}</p>}
        {showDate && <p style={{ margin: '0 0 12px', color: '#666' }}>{dateLine}</p>}
        <p style={{ margin: '0 0 24px', color: '#888', fontSize: 13 }}>You can still view and edit your courses by hand.</p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: '12px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px', fontFamily: 'inherit' }}
          >
            Close
          </button>
          {detail?.pool !== true && (
            <button
              onClick={onUpgrade}
              style={{ flex: 1, padding: '12px', backgroundColor: '#E8761A', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px', fontWeight: 600, fontFamily: 'inherit' }}
            >
              Join the waitlist
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuotaExceededModal;
