// frontend/src/components/synopsis/AdminPanel.jsx
import { useState } from 'react';
import { Plus, FolderUp, ChevronDown, Trash2 } from 'lucide-react';
import { SynopsisWeekFields } from '../../constants/synopsisSchema';
import { updateWeek, deleteWeek, saveWeeklyDocsToDrive } from '../../services/synopsisService';
import AddWeekModal from './AddWeekModal';

const FONT = "'DM Sans', sans-serif";

const BTN = (extra = {}) => ({
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 16px', borderRadius: 100, border: 'none',
  cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: FONT,
  ...extra,
});

export default function AdminPanel({ currentUser, allWeeks, displayWeekId, activeWeekId, onWeekChange, onDataRefresh, onWeekReset }) {
  const [showAddWeek, setShowAddWeek] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [weekMenuOpen, setWeekMenuOpen] = useState(false);
  const [togglingVisible, setTogglingVisible] = useState(null);

  const isDisplayingActiveWeek = displayWeekId === activeWeekId;
  const displayWeek = allWeeks.find(w => w[SynopsisWeekFields.WEEK_ID] === displayWeekId);
  const displayWeekLabel = displayWeek?.[SynopsisWeekFields.LABEL] || 'this week';

  const handleSetActive = async () => {
    if (!displayWeekId || isDisplayingActiveWeek) return;
    try {
      await updateWeek(currentUser, displayWeekId, { is_active: true });
      await onDataRefresh();
    } catch (err) { alert(err.message); }
  };

  const handleToggleVisible = async (week) => {
    const weekId = week[SynopsisWeekFields.WEEK_ID];
    setTogglingVisible(weekId);
    try {
      await updateWeek(currentUser, weekId, { is_visible: !week[SynopsisWeekFields.IS_VISIBLE] });
      await onDataRefresh();
    } catch (err) { alert(err.message); }
    finally { setTogglingVisible(null); }
  };

  const handleDelete = async () => {
    if (!displayWeekId) return;
    if (!window.confirm(`Delete "${displayWeekLabel}" and all its camps? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await deleteWeek(currentUser, displayWeekId);
      if (onWeekReset) onWeekReset(); else await onDataRefresh();
    } catch (err) { alert(err.message); }
    finally { setDeleting(false); }
  };

  const handleGenerateAll = async () => {
    if (!displayWeekId) return alert('Select a week first');
    setDownloading(true);
    try {
      const { folder, files } = await saveWeeklyDocsToDrive(currentUser, displayWeekId);
      alert(`Saved ${files.length} doc${files.length !== 1 ? 's' : ''} to Drive folder "${folder.name}".`);
      if (folder.link) window.open(folder.link, '_blank', 'noopener');
    } catch (err) { alert(err.message); }
    finally { setDownloading(false); }
  };

  return (
    <>
      <div style={{
        display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10,
        background: 'rgba(255,255,255,0.7)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.9)',
        borderRadius: 16, padding: '14px 20px', marginBottom: 28,
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em', marginRight: 4 }}>
          Admin
        </span>

        {/* Week selector */}
        {allWeeks.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
              <button
                onClick={() => setWeekMenuOpen(o => !o)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '7px 30px 7px 12px', borderRadius: 8,
                  border: '1px solid rgba(0,0,0,0.12)',
                  fontSize: 14, fontFamily: FONT, color: '#1e1e2e',
                  background: '#FFFFFF', cursor: 'pointer', outline: 'none',
                  position: 'relative',
                }}
              >
                {displayWeekLabel}{displayWeek?.[SynopsisWeekFields.IS_ACTIVE] ? ' ★' : ''}
                <ChevronDown size={13} style={{ position: 'absolute', right: 9, color: '#888' }} />
              </button>

              {weekMenuOpen && (
                <>
                  <div
                    onClick={() => setWeekMenuOpen(false)}
                    style={{ position: 'fixed', inset: 0, zIndex: 19 }}
                  />
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 20,
                    background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 12,
                    boxShadow: '0 10px 32px rgba(0,0,0,0.14)', minWidth: 300,
                    maxHeight: 340, overflowY: 'auto', padding: 6,
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '6px 10px' }}>
                      Show on teacher view
                    </div>
                    {allWeeks.map(w => {
                      const wId = w[SynopsisWeekFields.WEEK_ID];
                      return (
                        <div
                          key={wId}
                          onClick={() => { onWeekChange(wId); setWeekMenuOpen(false); }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '9px 10px', borderRadius: 8, cursor: 'pointer',
                            background: wId === displayWeekId ? 'rgba(172,216,240,0.25)' : 'transparent',
                          }}
                          onMouseEnter={e => { if (wId !== displayWeekId) e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; }}
                          onMouseLeave={e => { if (wId !== displayWeekId) e.currentTarget.style.background = 'transparent'; }}
                        >
                          <input
                            type="checkbox"
                            checked={!!w[SynopsisWeekFields.IS_VISIBLE]}
                            disabled={togglingVisible === wId}
                            onClick={e => e.stopPropagation()}
                            onChange={() => handleToggleVisible(w)}
                            title="Visible to teachers"
                            style={{ width: 15, height: 15, cursor: 'pointer', flexShrink: 0 }}
                          />
                          <span style={{ flex: 1, fontSize: 14, color: '#1e1e2e' }}>
                            {w[SynopsisWeekFields.LABEL]}{w[SynopsisWeekFields.IS_ACTIVE] ? ' ★' : ''}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Active week indicator / set active button */}
            {isDisplayingActiveWeek ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 100, background: '#B2E8C8', color: '#1a4a2a', fontSize: 13, fontWeight: 500 }}>
                ✓ This is the active week
              </span>
            ) : (
              <button onClick={handleSetActive} style={BTN({ background: 'rgba(0,0,0,0.07)', color: '#1e1e2e' })}>
                Set as active week
              </button>
            )}
          </div>
        )}

        <button onClick={() => setShowAddWeek(true)} style={BTN({ background: '#1e1e2e', color: '#FFF' })}>
          <Plus size={14} /> Set up new week
        </button>

        <div style={{ flex: 1 }} />

        {/* Delete week */}
        <button
          onClick={handleDelete}
          disabled={deleting || !displayWeekId}
          style={BTN({ background: 'rgba(239,68,68,0.1)', color: '#dc2626', opacity: (deleting || !displayWeekId) ? 0.4 : 1, cursor: (deleting || !displayWeekId) ? 'not-allowed' : 'pointer' })}
        >
          <Trash2 size={14} /> {deleting ? 'Deleting…' : 'Delete week'}
        </button>

        {/* Generate all — saves every group's doc to the week's Drive folder */}
        <button
          onClick={handleGenerateAll}
          disabled={downloading || !displayWeekId}
          style={BTN({ background: '#E8E0D5', color: '#5c4a32', opacity: (downloading || !displayWeekId) ? 0.5 : 1, cursor: (downloading || !displayWeekId) ? 'not-allowed' : 'pointer' })}
        >
          <FolderUp size={14} /> {downloading ? 'Generating…' : 'Generate All'}
        </button>
      </div>

      {showAddWeek && (
        <AddWeekModal
          currentUser={currentUser}
          onClose={() => setShowAddWeek(false)}
          onSuccess={onWeekReset || onDataRefresh}
        />
      )}
    </>
  );
}
