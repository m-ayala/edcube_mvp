// frontend/src/components/modals/QuotaExceededModal.jsx
import { formatResetDate, quotaTitle } from '../../utils/usageFormat';

const QuotaExceededModal = ({ detail, onClose, onUpgrade }) => {
  const resets = formatResetDate(detail?.resets_at);
  const isFree = !detail?.plan || detail.plan === 'free';
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
        aria-label="Monthly limit reached"
        style={{ backgroundColor: 'white', borderRadius: '8px', padding: '30px', maxWidth: '420px', width: '90%', textAlign: 'center' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0, color: '#2C5F3A', fontSize: '22px' }}>{quotaTitle(detail)}</h2>
        {resets && (
          <p style={{ marginBottom: '24px', color: '#666' }}>Resets on {resets}.</p>
        )}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: '12px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px', fontFamily: 'inherit' }}
          >
            Close
          </button>
          {isFree && (
            <button
              onClick={onUpgrade}
              style={{ flex: 1, padding: '12px', backgroundColor: '#E8761A', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px', fontWeight: 600, fontFamily: 'inherit' }}
            >
              Upgrade to Pro
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuotaExceededModal;
