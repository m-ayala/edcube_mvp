// frontend/src/components/synopsis/ProgressBar.jsx
// progress: 0-100 for a determinate bar, or null/undefined for an indeterminate
// (animated, no known percentage) bar — used so long-running downloads still
// visibly show they're alive instead of looking frozen.
export default function ProgressBar({ progress = null, color = '#ACD8F0', height = 4, trackColor = 'rgba(0,0,0,0.08)' }) {
  const indeterminate = progress == null;
  return (
    <div style={{
      width: '100%', height, borderRadius: height / 2,
      background: trackColor, overflow: 'hidden', position: 'relative',
    }}>
      <div style={indeterminate ? {
        position: 'absolute', top: 0, height: '100%', width: '35%',
        background: color, borderRadius: height / 2,
        animation: 'progress-indeterminate 1.1s ease-in-out infinite',
      } : {
        height: '100%', width: `${Math.max(0, Math.min(100, progress))}%`,
        background: color, borderRadius: height / 2,
        transition: 'width 0.25s ease',
      }} />
    </div>
  );
}
