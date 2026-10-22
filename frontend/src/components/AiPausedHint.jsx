// frontend/src/components/AiPausedHint.jsx
// Inline note shown next to an AI button that is paused (credit used up or trial ended).
// Renders nothing when the feature is available.
import { useAiGate, useUsage } from '../contexts/usageContextCore';

const AiPausedHint = ({ kind, style }) => {
  const { blocked, message } = useAiGate(kind);
  const { openUpgrade } = useUsage();
  if (!blocked) return null;
  return (
    <div
      data-testid={`ai-paused-${kind}`}
      role="status"
      style={{ fontSize: 12, color: '#B45309', background: '#FFF4E5', border: '1px solid #F5D9B0', borderRadius: 6, padding: '6px 10px', margin: '6px 0', fontFamily: "'DM Sans', sans-serif", textAlign: 'left', ...style }}
    >
      {message}{' '}
      <button
        type="button"
        onClick={openUpgrade}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#E8761A', fontWeight: 600, textDecoration: 'underline', fontSize: 'inherit', fontFamily: 'inherit' }}
      >
        Join the waitlist
      </button>
    </div>
  );
};

export default AiPausedHint;
