// frontend/src/components/synopsis/AdminPanel.jsx
import { useState } from 'react';
import { Plus, Download, ChevronDown, Trash2 } from 'lucide-react';
import { SynopsisWeekFields } from '../../constants/synopsisSchema';
import { updateWeek, deleteWeek, downloadWeeklyDoc } from '../../services/synopsisService';
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

  const isDisplayingActiveWeek = displayWeekId === activeWeekId;
  const displayWeekLabel = allWeeks.find(w => w[SynopsisWeekFields.WEEK_ID] === displayWeekId)?.[SynopsisWeekFields.LABEL] || 'this week';

  const handleSetActive = async () => {
    if (!displayWeekId || isDisplayingActiveWeek) return;
    try {
      await updateWeek(currentUser, displayWeekId, { is_active: true });
      await onDataRefresh();
    } catch (err) { alert(err.message); }
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

  const handleDownload = async () => {
    if (!displayWeekId) return alert('Select a week first');
    setDownloading(true);
    try {
      const blob = await downloadWeeklyDoc(currentUser, displayWeekId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `synopsis_${displayWeekId}.docx`;
      a.click();
      URL.revokeObjectURL(url);
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
              <select
                value={displayWeekId || ''}
                onChange={e => onWeekChange(e.target.value)}
                style={{
                  padding: '7px 30px 7px 12px', borderRadius: 8,
                  border: '1px solid rgba(0,0,0,0.12)',
                  fontSize: 14, fontFamily: FONT, color: '#1e1e2e',
                  background: '#FFFFFF', cursor: 'pointer', appearance: 'none', outline: 'none',
                }}
              >
                {allWeeks.map(w => (
                  <option key={w[SynopsisWeekFields.WEEK_ID]} value={w[SynopsisWeekFields.WEEK_ID]}>
                    {w[SynopsisWeekFields.LABEL]}{w[SynopsisWeekFields.IS_ACTIVE] ? ' ★' : ''}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} style={{ position: 'absolute', right: 9, pointerEvents: 'none', color: '#888' }} />
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

        {/* Download all */}
        <button
          onClick={handleDownload}
          disabled={downloading || !displayWeekId}
          style={BTN({ background: '#E8E0D5', color: '#5c4a32', opacity: (downloading || !displayWeekId) ? 0.5 : 1, cursor: (downloading || !displayWeekId) ? 'not-allowed' : 'pointer' })}
        >
          <Download size={14} /> {downloading ? 'Generating…' : 'Download all'}
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
