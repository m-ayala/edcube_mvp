// frontend/src/components/share/InvitePage.jsx
// /invite/:token -- landing page for a course invitation. Public (outside ProtectedRoute and the app
// layout) because the invitee may have no account yet. Signed out: the token is remembered so that after
// sign-up -> email verification -> log in (or Google) PendingInviteRedirect brings them back here and the
// invite is accepted automatically. Signed in: "Accept invite" -> workspace set -> into the course.
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { logoutTeacher } from '../../firebase/authService';
import { fetchCourseDocument } from '../../services/courseBuilderApi';
import { acceptInvite, getInviteInfo } from '../../services/sharingApi';
import { courseViewState } from '../../utils/courseNav';
import { forgetInvite, pendingInviteToken, rememberInvite } from '../../utils/pendingInvite';

const SANS = "'DM Sans', sans-serif";

const primaryBtn = {
  display: 'inline-block', padding: '12px 22px', borderRadius: 100, border: 'none', cursor: 'pointer',
  background: '#1C1917', color: '#FAF8F4', fontFamily: SANS, fontSize: 15.5, fontWeight: 600, textDecoration: 'none',
};
const secondaryBtn = { ...primaryBtn, background: '#fff', color: '#1C1917', border: '1px solid #D8D2C8' };

const Shell = ({ children }) => (
  <div style={{
    minHeight: '100vh', background: '#FAF8F4', display: 'flex', alignItems: 'center',
    justifyContent: 'center', padding: 24, fontFamily: SANS,
  }}>
    <div style={{
      width: '100%', maxWidth: 440, background: '#fff', border: '0.5px solid #E5E0D8', borderRadius: 18,
      padding: '32px 28px', textAlign: 'center',
    }}>
      <div style={{ fontWeight: 800, fontSize: 20, color: '#1C1917', letterSpacing: '-0.5px', marginBottom: 18 }}>EdCube</div>
      {children}
    </div>
  </div>
);

const notice = (kind) => ({
  fontSize: 14, lineHeight: 1.5, margin: '14px 0', padding: '10px 14px', borderRadius: 8, textAlign: 'left',
  background: kind === 'error' ? '#FDEEE6' : '#FFF8E6',
  border: `0.5px solid ${kind === 'error' ? '#F9C0A8' : '#F2D58A'}`,
  color: kind === 'error' ? '#C05A2A' : '#7A5A00',
});

const InvitePage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { currentUser, resolving, setActiveWorkspace } = useAuth();

  const [info, setInfo] = useState({ status: 'loading' }); // loading | available | unavailable | rate_limited | error
  const [accepting, setAccepting] = useState(false);
  const [problem, setProblem] = useState(null); // { kind: 'mismatch'|'gone'|'error', message }
  // Came back here after signing in (the token was remembered while signed out): accept without a click.
  const [cameBack] = useState(() => pendingInviteToken() === token);
  const startedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    getInviteInfo(token)
      .then((d) => {
        if (cancelled) return;
        if (d && d.available) setInfo({ status: 'available', data: d });
        else setInfo({ status: 'unavailable', reason: d?.status });
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.status === 404) setInfo({ status: 'unavailable' });
        else if (err.status === 429) setInfo({ status: 'rate_limited' });
        else setInfo({ status: 'error' });
      });
    return () => { cancelled = true; };
  }, [token]);

  // Signed out: remember the invite for after sign-up / login.
  useEffect(() => {
    if (!currentUser && info.status === 'available') rememberInvite(token);
  }, [currentUser, info.status, token]);

  const accept = async () => {
    if (!currentUser || accepting) return;
    setAccepting(true);
    setProblem(null);
    try {
      const r = await acceptInvite(token);
      forgetInvite();
      await setActiveWorkspace(r.workspace);
      try {
        const doc = await fetchCourseDocument(r.course_id, currentUser.uid);
        navigate('/course-view', {
          replace: true,
          state: courseViewState(doc, { courseId: r.course_id, accessType: r.access_type }),
        });
      } catch {
        navigate('/my-courses', { replace: true });
      }
    } catch (err) {
      if (err.status === 403 && err.code === 'invite_email_mismatch') {
        setProblem({ kind: 'mismatch' });
      } else if (err.status === 410 || err.status === 404) {
        forgetInvite();
        setProblem({ kind: 'gone', message: 'This invitation has expired or was cancelled. Ask the course owner to send a new one.' });
      } else {
        setProblem({ kind: 'error', message: err.message || 'Could not accept the invitation.' });
      }
      setAccepting(false);
    }
  };

  const canAct = !!currentUser && !resolving && info.status === 'available';
  useEffect(() => {
    if (cameBack && canAct && !startedRef.current) {
      startedRef.current = true;
      Promise.resolve().then(accept);
    }
  });

  const signOut = async () => {
    try { await logoutTeacher(); } catch { /* already signed out */ }
  };
  const skip = () => { forgetInvite(); navigate(currentUser ? '/my-courses' : '/', { replace: true }); };

  if (info.status === 'loading') return <Shell><p style={{ color: '#6B6459', margin: 0 }}>Loading invitation…</p></Shell>;
  if (info.status === 'rate_limited') return <Shell><p role="alert" style={{ margin: 0, color: '#374151' }}>Too many requests, try again shortly.</p></Shell>;
  if (info.status === 'error') return <Shell><p role="alert" style={{ margin: 0, color: '#374151' }}>Something went wrong loading this invitation. Please try again.</p></Shell>;
  if (info.status === 'unavailable') {
    const used = info.reason === 'accepted';
    return (
      <Shell>
        <p role="alert" style={{ margin: '0 0 18px', color: '#374151', fontSize: 16 }}>
          {used ? 'This invitation has already been used.' : 'This invitation has expired or was cancelled.'}
        </p>
        <Link to={currentUser ? '/my-courses' : '/'} style={secondaryBtn} onClick={forgetInvite}>
          {currentUser ? 'Go to My Courses' : 'Go to EdCube'}
        </Link>
      </Shell>
    );
  }

  const d = info.data;
  const canEdit = d.access_type === 'collaborate';

  return (
    <Shell>
      <h1 style={{ fontSize: 22, margin: '0 0 8px', color: '#1C1917' }}>{d.course_title || 'A course'}</h1>
      <p style={{ margin: '0 0 6px', color: '#44403C', fontSize: 15.5, lineHeight: 1.55 }}>
        <strong>{d.inviter_name || 'A teacher'}</strong> invited you to {canEdit ? 'edit' : 'view'} this course.
      </p>
      <p data-testid="invite-access" style={{ margin: '0 0 4px', color: '#6B6459', fontSize: 14 }}>
        Access: {canEdit ? 'Can edit' : 'Can view'}
      </p>
      {d.email_hint && (
        <p data-testid="invite-email-hint" style={{ margin: '0 0 4px', color: '#6B6459', fontSize: 14 }}>
          Sent to {d.email_hint}
        </p>
      )}
      <p style={{ margin: '0 0 18px', color: '#6B6459', fontSize: 14 }}>Joining is free on any plan.</p>

      {problem?.kind === 'mismatch' && (
        <div role="alert" style={notice('error')}>
          This invite was sent to {d.email_hint}. Sign in with that email.
          <div style={{ marginTop: 10 }}>
            <button type="button" onClick={signOut} style={{ ...secondaryBtn, padding: '8px 16px', fontSize: 14 }}>Sign out</button>
          </div>
        </div>
      )}
      {problem && problem.kind !== 'mismatch' && <div role="alert" style={notice('error')}>{problem.message}</div>}

      {!currentUser ? (
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/signup" style={primaryBtn}>Sign up free</Link>
          <Link to="/login" style={secondaryBtn}>Log in</Link>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button type="button" onClick={accept} disabled={!canAct || accepting}
            style={{ ...primaryBtn, opacity: !canAct || accepting ? 0.6 : 1 }}>
            {accepting ? 'Joining…' : 'Accept invite'}
          </button>
          <button type="button" onClick={skip} style={secondaryBtn}>Not now</button>
        </div>
      )}
    </Shell>
  );
};

export default InvitePage;
