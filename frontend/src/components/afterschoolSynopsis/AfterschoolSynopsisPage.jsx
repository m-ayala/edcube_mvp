// frontend/src/components/afterschoolSynopsis/AfterschoolSynopsisPage.jsx
//
// Top-level page owning the view-state machine ('gate' | 'select' | 'entry' |
// 'adminLogin' | 'adminHome'), mirroring the approved mockup's Portal.dc.html
// structure and the camp feature's SynopsisPage.jsx pattern (glassmorphism
// header, admin-view toggle, "Go to EdCube →"). Admin access lives inside
// this same page via the state machine, exactly like the old feature keeps
// admin inside /synopsis.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import { ICC_ADMIN_DOMAIN } from '../../constants/synopsisSchema';
import { PORTAL_SESSION_KEY } from '../../constants/afterschoolSynopsisSchema';
import PortalLoginGate from './PortalLoginGate';
import GradeTypeMonthSelectView from './GradeTypeMonthSelectView';
import EntryFormView from './EntryFormView';
import AdminLoginView from './AdminLoginView';
import AdminMonthDropdown from './AdminMonthDropdown';
import AdminClassView from './AdminClassView';

const FONT = "'DM Sans', sans-serif";
const SERIF = "'DM Serif Display', serif";

const hasPortalSession = () => {
  try { return !!sessionStorage.getItem(PORTAL_SESSION_KEY); } catch { return false; }
};

export default function AfterschoolSynopsisPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.email?.endsWith(`@${ICC_ADMIN_DOMAIN}`) ?? false;

  // Allows an admin to preview the teacher (non-admin) view, same convention
  // as the camp feature's SynopsisPage.jsx.
  const [adminViewMode, setAdminViewMode] = useState(true);
  const effectiveIsAdmin = isAdmin && adminViewMode;

  const [view, setView] = useState(() => (hasPortalSession() ? 'select' : 'gate'));
  const [selection, setSelection] = useState(null); // { grade, synopsisType, monthId, monthLabel }
  const [adminMonthId, setAdminMonthId] = useState('');
  const [adminMonths, setAdminMonths] = useState([]);

  const teacherEntryView = () => (hasPortalSession() || isAdmin ? 'select' : 'gate');

  // Derived rather than effect-driven: once signed in as an @indiacc.org admin
  // (and not previewing teacher view), the admin home renders regardless of
  // whatever `view` was left at — no setState-in-effect needed. Toggling back
  // to teacher view or signing out explicitly resets `view` via their handlers
  // below, so it's a sensible fallback once effectiveIsAdmin goes false again.
  const effectiveView = effectiveIsAdmin ? 'adminHome' : view;

  const handlePortalSuccess = () => setView('select');

  const handleSelectSubmit = (sel) => {
    setSelection(sel);
    setView('entry');
  };

  const handleBackToSelect = () => {
    setSelection(null);
    setView('select');
  };

  const handleAdminLoginBack = () => setView(teacherEntryView());

  const handleSignOutAdmin = async () => {
    await signOut(auth);
    setView(teacherEntryView());
  };

  const handleViewToggle = () => {
    setAdminViewMode((v) => !v);
    setView(teacherEntryView());
  };

  const selectedMonthLabel = adminMonths.find((m) => m.month_id === adminMonthId)?.label;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, rgba(178,232,200,0.45) 0%, rgba(172,216,240,0.35) 35%, rgba(242,192,212,0.35) 65%, rgba(247,228,160,0.40) 100%)',
      backgroundColor: '#F0EDE8',
      fontFamily: FONT,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Serif+Display&display=swap');
      `}</style>

      <header style={{
        background: 'rgba(255,255,255,0.65)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.8)',
        padding: '0 40px', height: 62,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ fontFamily: SERIF, fontSize: 22, color: '#1e1e2e', letterSpacing: '-0.3px' }}>
          EdCube
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {isAdmin && (
            <button
              onClick={handleViewToggle}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '6px 14px', borderRadius: 100, border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 500, fontFamily: FONT,
                background: adminViewMode ? 'rgba(0,0,0,0.07)' : '#B2E8C8',
                color: adminViewMode ? '#555' : '#1a4a2a',
              }}
            >
              {adminViewMode ? 'Admin view' : 'Teacher view'}
              <span style={{ fontSize: 11, opacity: 0.7 }}>{adminViewMode ? '→ teacher' : '→ admin'}</span>
            </button>
          )}

          {isAdmin ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                fontSize: 13, color: '#555', background: 'rgba(0,0,0,0.05)', padding: '5px 11px',
                borderRadius: 100, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {currentUser.email}
              </span>
              <button
                onClick={handleSignOutAdmin}
                style={{ background: 'none', border: '0.5px solid #ccc', cursor: 'pointer', fontSize: 13, color: '#555', fontFamily: FONT, padding: '5px 14px', borderRadius: 100 }}
              >
                Log out
              </button>
            </div>
          ) : (
            (effectiveView === 'gate' || effectiveView === 'select' || effectiveView === 'entry') && (
              <button
                onClick={() => setView('adminLogin')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#555', fontFamily: FONT, textDecoration: 'underline' }}
              >
                Admin login
              </button>
            )
          )}

          <button
            onClick={() => navigate('/')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 100, background: '#1e1e2e', color: '#FFFFFF', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500, fontFamily: FONT }}
          >
            Go to EdCube →
          </button>
        </div>
      </header>

      {effectiveView === 'gate' && <PortalLoginGate onSuccess={handlePortalSuccess} />}

      {effectiveView === 'select' && <GradeTypeMonthSelectView onSubmit={handleSelectSubmit} />}

      {effectiveView === 'entry' && selection && (
        <EntryFormView
          grade={selection.grade}
          synopsisType={selection.synopsisType}
          monthId={selection.monthId}
          monthLabel={selection.monthLabel}
          onBack={handleBackToSelect}
        />
      )}

      {effectiveView === 'adminLogin' && <AdminLoginView onBack={handleAdminLoginBack} />}

      {effectiveView === 'adminHome' && (
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '36px 28px' }}>
          <h1 style={{ fontFamily: SERIF, fontSize: 24, color: '#1C1917', marginBottom: 20 }}>
            Admin — After-School &amp; ECA Synopsis
          </h1>
          <AdminMonthDropdown
            currentUser={currentUser}
            selectedMonthId={adminMonthId}
            onSelectMonth={setAdminMonthId}
            onMonthsChange={setAdminMonths}
          />
          {adminMonthId && (
            <AdminClassView
              currentUser={currentUser}
              monthId={adminMonthId}
              monthLabel={selectedMonthLabel}
            />
          )}
        </div>
      )}
    </div>
  );
}
