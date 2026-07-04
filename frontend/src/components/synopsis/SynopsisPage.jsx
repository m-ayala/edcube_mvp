// frontend/src/components/synopsis/SynopsisPage.jsx
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import {
  SynopsisWeekFields,
  SynopsisCampFields,
  ICC_ADMIN_DOMAIN,
} from '../../constants/synopsisSchema';
import {
  getActiveWeek,
  getVisibleWeeks,
  getCampsForWeek,
  getEntriesForCamp,
  getAllWeeks,
} from '../../services/synopsisService';
import CampListView from './CampListView';
import CampEntryView from './CampEntryView';
import FoodMenuPage from './FoodMenuPage';
import AdminPanel from './AdminPanel';
import AdminLoginModal from './AdminLoginModal';

const toCampSlug = (name) => (name || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

export default function SynopsisPage() {
  const navigate = useNavigate();
  const { campSlug } = useParams();
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.email?.endsWith(`@${ICC_ADMIN_DOMAIN}`) ?? false;

  const [view, setView] = useState('list');
  const [selectedCamp, setSelectedCamp] = useState(null);
  const [activeWeek, setActiveWeek] = useState(null);
  const [displayWeek, setDisplayWeek] = useState(null);
  const [allWeeks, setAllWeeks] = useState([]);
  const [visibleWeeks, setVisibleWeeks] = useState([]);
  const [camps, setCamps] = useState([]);
  const [allEntries, setAllEntries] = useState({});
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [forceRefresh, setForceRefresh] = useState(0);
  // Allows admin to preview the teacher (non-admin) view
  const [adminViewMode, setAdminViewMode] = useState(true);

  const effectiveIsAdmin = isAdmin && adminViewMode;

  // Incrementing this triggers the effect with the latest closure values
  const refresh = useCallback(() => setForceRefresh(n => n + 1), []);

  // Used after week creation or deletion — resets selected week then refreshes
  const handleReset = useCallback(() => {
    setDisplayWeek(null);
    setForceRefresh(n => n + 1);
  }, []);

  const loadData = async () => {
    try {
      const weekRes = await getActiveWeek();
      const active = weekRes.week || null;
      setActiveWeek(active);

      const visibleRes = await getVisibleWeeks();
      const visible = visibleRes.weeks || [];
      setVisibleWeeks(visible);

      if (isAdmin && currentUser) {
        try {
          const weeksRes = await getAllWeeks(currentUser);
          setAllWeeks(weeksRes.weeks || []);
        } catch {
          // token may not be ready on first load
        }
      }

      // Teachers only get a default week if the active week is one the admin
      // has flagged visible; otherwise they must pick one from the dropdown.
      const teacherDefault = visible.find(w => w[SynopsisWeekFields.WEEK_ID] === active?.[SynopsisWeekFields.WEEK_ID]) || null;
      const current = displayWeek || (effectiveIsAdmin ? active : teacherDefault);
      if (!current) {
        setCamps([]);
        setAllEntries({});
        setLoading(false);
        return;
      }

      const weekId = current[SynopsisWeekFields.WEEK_ID];
      const campsRes = await getCampsForWeek(weekId);
      const campList = campsRes.camps || [];
      setCamps(campList);

      const entriesMap = {};
      await Promise.all(
        campList.map(async (camp) => {
          try {
            const res = await getEntriesForCamp(camp[SynopsisCampFields.CAMP_ID], weekId);
            entriesMap[camp[SynopsisCampFields.CAMP_ID]] = res.entries || [];
          } catch {
            entriesMap[camp[SynopsisCampFields.CAMP_ID]] = [];
          }
        })
      );
      setAllEntries(entriesMap);
    } catch (err) {
      console.error('Synopsis load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [currentUser, displayWeek, forceRefresh, adminViewMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Resolve campSlug from URL after camps load
  useEffect(() => {
    if (!campSlug || loading) return;
    if (view === 'camp') return;
    const match = camps.find(c => toCampSlug(c[SynopsisCampFields.CAMP_NAME]) === campSlug);
    if (match) {
      setSelectedCamp(match);
      setView('camp');
    } else if (camps.length > 0) {
      navigate('/synopsis', { replace: true });
    }
  }, [campSlug, loading, camps]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleWeekChange = (weekId) => {
    const week = allWeeks.find(w => w[SynopsisWeekFields.WEEK_ID] === weekId)
      || visibleWeeks.find(w => w[SynopsisWeekFields.WEEK_ID] === weekId);
    setDisplayWeek(week || null);
  };

  const handleCampSelect = (camp) => {
    setSelectedCamp(camp);
    setView('camp');
    navigate(`/synopsis/${toCampSlug(camp[SynopsisCampFields.CAMP_NAME])}`);
  };

  const handleFoodSelect = () => {
    setView('food');
    navigate('/synopsis');
  };

  const handleBack = () => {
    setSelectedCamp(null);
    setView('list');
    navigate('/synopsis');
    refresh();
  };

  // When admin toggles views, reset to the synopsis home page
  const handleViewToggle = () => {
    if (adminViewMode) setDisplayWeek(null);
    setAdminViewMode(v => !v);
    setView('list');
    setSelectedCamp(null);
    navigate('/synopsis');
  };

  const activeWeekId = activeWeek?.[SynopsisWeekFields.WEEK_ID];
  const currentDisplayWeek = displayWeek || activeWeek;
  const displayWeekId = currentDisplayWeek?.[SynopsisWeekFields.WEEK_ID];

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, rgba(178,232,200,0.45) 0%, rgba(172,216,240,0.35) 35%, rgba(242,192,212,0.35) 65%, rgba(247,228,160,0.40) 100%)',
      backgroundColor: '#F0EDE8',
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Serif+Display&display=swap');
      `}</style>

      {/* Header */}
      <header style={{
        background: 'rgba(255,255,255,0.65)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.8)',
        padding: '0 40px',
        height: 62,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, color: '#1e1e2e', letterSpacing: '-0.3px' }}>
          EdCube
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {isAdmin && (
            <button
              onClick={handleViewToggle}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '6px 14px', borderRadius: 100, border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 500, fontFamily: "'DM Sans', sans-serif",
                background: adminViewMode ? 'rgba(0,0,0,0.07)' : '#B2E8C8',
                color: adminViewMode ? '#555' : '#1a4a2a',
                transition: 'background 0.15s',
              }}
            >
              {adminViewMode ? 'Admin view' : 'Teacher view'}
              <span style={{ fontSize: 11, opacity: 0.7 }}>
                {adminViewMode ? '→ teacher' : '→ admin'}
              </span>
            </button>
          )}

          {currentUser ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                fontSize: 13, color: '#555',
                background: 'rgba(0,0,0,0.05)', padding: '5px 11px',
                borderRadius: 100, maxWidth: 200,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {currentUser.displayName || currentUser.email}
              </span>
              <button
                onClick={() => signOut(auth)}
                style={{ background: 'none', border: '0.5px solid #ccc', cursor: 'pointer', fontSize: 13, color: '#555', fontFamily: "'DM Sans', sans-serif", padding: '5px 14px', borderRadius: 100 }}
              >
                Log out
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAdminLogin(true)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#555', fontFamily: "'DM Sans', sans-serif", textDecoration: 'underline' }}
            >
              Admin login
            </button>
          )}

          <button
            onClick={() => navigate('/')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 100, background: '#1e1e2e', color: '#FFFFFF', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500, fontFamily: "'DM Sans', sans-serif" }}
          >
            Go to EdCube →
          </button>
        </div>
      </header>

      {/* Main content */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 62px)', color: '#8b7355', fontSize: 14 }}>
          Loading…
        </div>
      ) : view === 'camp' && selectedCamp ? (
        <CampEntryView camp={selectedCamp} onBack={handleBack} isAdmin={effectiveIsAdmin} />
      ) : view === 'food' ? (
        <FoodMenuPage
          week={currentDisplayWeek}
          isAdmin={effectiveIsAdmin}
          currentUser={currentUser}
          onBack={handleBack}
        />
      ) : (
        <CampListView
          activeWeek={activeWeek}
          displayWeek={currentDisplayWeek}
          visibleWeeks={visibleWeeks}
          onWeekChange={handleWeekChange}
          camps={camps}
          allEntries={allEntries}
          isAdmin={effectiveIsAdmin}
          currentUser={currentUser}
          onCampSelect={handleCampSelect}
          onFoodSelect={handleFoodSelect}
          onDataRefresh={refresh}
          adminPanel={
            effectiveIsAdmin ? (
              <AdminPanel
                currentUser={currentUser}
                allWeeks={allWeeks}
                displayWeekId={displayWeekId}
                activeWeekId={activeWeekId}
                onWeekChange={handleWeekChange}
                onDataRefresh={refresh}
                onWeekReset={handleReset}
              />
            ) : null
          }
        />
      )}

      {showAdminLogin && <AdminLoginModal onClose={() => setShowAdminLogin(false)} />}
    </div>
  );
}
