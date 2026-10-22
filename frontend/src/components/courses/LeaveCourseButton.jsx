// frontend/src/components/courses/LeaveCourseButton.jsx
// "Leave course" for someone a course was shared with (collaborator or viewer): confirms, calls
// POST /api/curricula/{id}/leave, then returns to My Courses. Access ends immediately.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { leaveCourse } from '../../services/sharingApi';

const LeaveCourseButton = ({ courseId, style }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      await leaveCourse(courseId);
      navigate('/my-courses', { replace: true });
    } catch (err) {
      if (err.status === 404) { navigate('/my-courses', { replace: true }); return; } // already no access
      setError(err.message || 'Could not leave the course.');
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} style={style}>Leave course</button>
      {open && (
        <div
          style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 2000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif",
          }}
          onClick={() => !busy && setOpen(false)}
        >
          <div
            role="dialog" aria-label="Leave course" data-testid="leave-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 12, padding: '26px 28px', maxWidth: 400, width: '90%', textAlign: 'center' }}
          >
            <h3 style={{ margin: '0 0 10px', fontSize: 19 }}>Leave this course?</h3>
            <p style={{ margin: '0 0 18px', color: '#555', fontSize: 15, lineHeight: 1.5 }}>
              You will lose access right away. The owner can invite you again later.
            </p>
            {error && <p role="alert" style={{ margin: '0 0 12px', color: '#B91C1C', fontSize: 14 }}>{error}</p>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" disabled={busy} onClick={() => setOpen(false)} style={{ flex: 1, padding: 11, border: '1px solid #D1D5DB', background: '#fff', borderRadius: 8, cursor: 'pointer', fontSize: 15 }}>Cancel</button>
              <button type="button" disabled={busy} onClick={confirm} style={{ flex: 1, padding: 11, border: 'none', background: '#DC2626', color: '#fff', borderRadius: 8, cursor: busy ? 'not-allowed' : 'pointer', fontSize: 15, fontWeight: 600 }}>
                {busy ? 'Leaving…' : 'Leave course'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default LeaveCourseButton;
