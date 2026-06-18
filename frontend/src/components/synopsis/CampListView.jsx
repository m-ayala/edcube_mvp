// frontend/src/components/synopsis/CampListView.jsx
import { useState, useMemo, useEffect } from 'react';
import {
  SynopsisWeekFields,
  SynopsisCampFields,
  SynopsisEntryFields,
  VALID_DAYS,
  DAY_LABELS,
} from '../../constants/synopsisSchema';
import { Link, Trash2 } from 'lucide-react';
import {
  updateWeek,
  updateCamp,
  createCamp,
  deleteCamp,
  downloadGroupDoc,
} from '../../services/synopsisService';

const FONT  = "'DM Sans', sans-serif";
const SERIF = "'DM Serif Display', serif";

function progressCount(campId, allEntries) {
  return (allEntries[campId] || []).filter(e => e[SynopsisEntryFields.RAW_TEXT]?.trim()).length;
}

function EditInput({ value, onChange, onSave, onCancel, style = {} }) {
  return (
    <input
      autoFocus
      value={value}
      onChange={e => onChange(e.target.value)}
      onBlur={onSave}
      onKeyDown={e => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel(); }}
      style={{
        fontFamily: FONT, fontSize: 14, color: '#1e1e2e',
        border: '1.5px solid #ACD8F0', borderRadius: 8,
        padding: '7px 10px', outline: 'none',
        background: 'rgba(255,255,255,0.9)',
        ...style,
      }}
    />
  );
}

export default function CampListView({
  activeWeek, displayWeek, camps, allEntries,
  isAdmin, currentUser, onCampSelect, onFoodSelect, onDataRefresh, adminPanel,
}) {
  const currentWeek = displayWeek || activeWeek;
  const weekId      = currentWeek?.[SynopsisWeekFields.WEEK_ID];
  const weekLabel   = currentWeek?.[SynopsisWeekFields.LABEL] || '';
  const isActiveWeek = !!currentWeek?.[SynopsisWeekFields.IS_ACTIVE];
  const weekDriveLink = currentWeek?.[SynopsisWeekFields.DRIVE_LINK] || '';

  // ── Week name edit (admin) ─────────────────────────────────────────────────
  const [editingWeekName, setEditingWeekName] = useState(false);
  const [weekNameVal, setWeekNameVal]         = useState('');

  // ── Drive link edit (admin) ────────────────────────────────────────────────
  const [editingDriveLink, setEditingDriveLink] = useState(false);
  const [driveLinkVal, setDriveLinkVal]         = useState('');

  const startEditDriveLink = () => { setDriveLinkVal(weekDriveLink); setEditingDriveLink(true); };
  const saveDriveLink = async () => {
    setEditingDriveLink(false);
    const trimmed = driveLinkVal.trim();
    if (trimmed === weekDriveLink) return;
    try { await updateWeek(currentUser, weekId, { drive_link: trimmed }); await onDataRefresh(); }
    catch (err) { alert(err.message); }
  };

  const startEditWeekName = () => { setWeekNameVal(weekLabel); setEditingWeekName(true); };
  const saveWeekName = async () => {
    setEditingWeekName(false);
    const trimmed = weekNameVal.trim();
    if (!trimmed || trimmed === weekLabel) return;
    try { await updateWeek(currentUser, weekId, { label: trimmed }); await onDataRefresh(); }
    catch (err) { alert(err.message); }
  };

  // ── Group name edit (admin) ────────────────────────────────────────────────
  const [editingGroup, setEditingGroup] = useState(null);
  const [groupNameVal, setGroupNameVal] = useState('');

  const startEditGroup = (name) => { setEditingGroup(name); setGroupNameVal(name); };
  const saveGroupName = async (oldName, groupCamps) => {
    setEditingGroup(null);
    const trimmed = groupNameVal.trim();
    if (!trimmed || trimmed === oldName) return;
    try {
      await Promise.all(groupCamps.map(c => updateCamp(currentUser, c[SynopsisCampFields.CAMP_ID], { group_name: trimmed })));
      await onDataRefresh();
    } catch (err) { alert(err.message); }
  };

  // ── Sub-camp inline edit (admin) ───────────────────────────────────────────
  const [editingCampId, setEditingCampId] = useState(null);
  const [editCampData, setEditCampData]   = useState({});

  const startEditCamp = (camp, e) => {
    e.stopPropagation();
    setEditingCampId(camp[SynopsisCampFields.CAMP_ID]);
    setEditCampData({
      camp_name:    camp[SynopsisCampFields.CAMP_NAME]    || '',
      teacher_name: camp[SynopsisCampFields.TEACHER_NAME] || '',
      time_start:   camp[SynopsisCampFields.TIME_START]   || '',
      time_end:     camp[SynopsisCampFields.TIME_END]     || '',
    });
  };
  const saveCampEdit = async (campId) => {
    setEditingCampId(null);
    try { await updateCamp(currentUser, campId, editCampData); await onDataRefresh(); }
    catch (err) { alert(err.message); }
  };

  // ── Delete sub-camp / group (admin) ───────────────────────────────────────
  const [deletingCampId, setDeletingCampId] = useState(null);
  const [deletingGroup,  setDeletingGroup]  = useState(null);

  const handleDeleteCamp = async (campId, campName, e) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${campName}"? This cannot be undone.`)) return;
    setDeletingCampId(campId);
    try { await deleteCamp(currentUser, campId); await onDataRefresh(); }
    catch (err) { alert(err.message); }
    finally { setDeletingCampId(null); }
  };

  const handleDeleteGroup = async (groupName, groupCamps) => {
    if (!window.confirm(`Delete the entire "${groupName}" group and all its sub-camps? This cannot be undone.`)) return;
    setDeletingGroup(groupName);
    try {
      await Promise.all(groupCamps.map(c => deleteCamp(currentUser, c[SynopsisCampFields.CAMP_ID])));
      await onDataRefresh();
    } catch (err) { alert(err.message); }
    finally { setDeletingGroup(null); }
  };

  // ── Add sub-camp (admin) ───────────────────────────────────────────────────
  const [addingToGroup, setAddingToGroup] = useState(null);
  const [newCamp, setNewCamp]             = useState({ camp_name: '', teacher_name: '', time_start: '', time_end: '' });

  const saveNewCamp = async (groupName, groupCamps) => {
    if (!newCamp.camp_name.trim()) return;
    const newCampName = newCamp.camp_name.trim();

    // Recompute group_name to include the new sub-camp
    const allNames = [...groupCamps.map(c => c[SynopsisCampFields.CAMP_NAME]), newCampName];
    const updatedGroupName = allNames.length === 2
      ? `${allNames[0]} & ${allNames[1]} Camp`
      : allNames.slice(0, -1).join(', ') + ` & ${allNames[allNames.length - 1]} Camp`;

    try {
      // Patch existing camps to the updated group name
      await Promise.all(groupCamps.map(c =>
        updateCamp(currentUser, c[SynopsisCampFields.CAMP_ID], { group_name: updatedGroupName })
      ));
      await createCamp(currentUser, {
        week_id: weekId, group_name: updatedGroupName,
        camp_name: newCampName, teacher_name: newCamp.teacher_name.trim(),
        time_start: newCamp.time_start.trim(), time_end: newCamp.time_end.trim(),
      });
      setAddingToGroup(null);
      setNewCamp({ camp_name: '', teacher_name: '', time_start: '', time_end: '' });
      await onDataRefresh();
    } catch (err) { alert(err.message); }
  };

  // ── Per-group download (admin) ─────────────────────────────────────────────
  const [downloadingGroup, setDownloadingGroup] = useState(null);

  const handleGroupDownload = async (groupName) => {
    setDownloadingGroup(groupName);
    try {
      const blob = await downloadGroupDoc(currentUser, weekId, groupName);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `synopsis_${groupName.replace(/\s+/g, '_')}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) { alert(err.message); }
    finally { setDownloadingGroup(null); }
  };

  // ── Non-admin: selected group from dropdown ────────────────────────────────
  const [selectedGroup, setSelectedGroup] = useState(null);

  // ── Grouped camps (sorted by time_start within each group) ────────────────
  const groupedCamps = useMemo(() => {
    const parseTime = (t) => {
      if (!t) return Infinity;
      const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (!m) return Infinity;
      let h = parseInt(m[1]), min = parseInt(m[2]);
      const pm = m[3].toUpperCase() === 'PM';
      if (pm && h !== 12) h += 12;
      if (!pm && h === 12) h = 0;
      return h * 60 + min;
    };
    const map = new Map();
    for (const camp of camps) {
      const key = camp[SynopsisCampFields.GROUP_NAME] || '';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(camp);
    }
    return Array.from(map.entries()).map(([name, cs]) => ({
      name,
      camps: [...cs].sort((a, b) => parseTime(a[SynopsisCampFields.TIME_START]) - parseTime(b[SynopsisCampFields.TIME_START])),
    }));
  }, [camps]);

  // ── Shared sub-styles ──────────────────────────────────────────────────────
  const inlineEditRowStyle = {
    display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap',
    background: 'rgba(247,228,160,0.25)', border: '1px dashed rgba(0,0,0,0.15)',
    borderRadius: 14, padding: '18px 22px', marginBottom: 12,
  };
  const editLabelStyle  = { fontSize: 12, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em' };
  const editInputStyle  = { padding: '9px 12px', borderRadius: 9, border: '1px solid rgba(0,0,0,0.15)', fontSize: 14, fontFamily: FONT, color: '#1e1e2e', background: '#FFFFFF', outline: 'none' };
  const saveBtn         = { padding: '9px 18px', borderRadius: 100, border: 'none', background: '#1e1e2e', color: '#FFF', fontSize: 14, fontWeight: 500, fontFamily: FONT, cursor: 'pointer' };
  const cancelBtn       = { padding: '9px 18px', borderRadius: 100, border: 'none', background: 'rgba(0,0,0,0.07)', color: '#555', fontSize: 14, fontWeight: 500, fontFamily: FONT, cursor: 'pointer' };
  const pillBtn = (bg, color) => ({ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 15px', borderRadius: 100, border: 'none', fontSize: 13, fontWeight: 500, fontFamily: FONT, cursor: 'pointer', background: bg, color });
  const editIconBtn     = { background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: '#bbb', padding: '3px 6px', borderRadius: 6 };

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '48px 64px 72px', fontFamily: FONT }}>
      {adminPanel}

      {/* Week heading */}
      {weekLabel && (
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            {isAdmin && editingWeekName ? (
              <EditInput
                value={weekNameVal} onChange={setWeekNameVal}
                onSave={saveWeekName} onCancel={() => setEditingWeekName(false)}
                style={{ fontFamily: SERIF, fontSize: 38, width: 440, borderRadius: 10, padding: '4px 12px' }}
              />
            ) : (
              <>
                <h1 style={{ fontFamily: SERIF, fontSize: 38, fontWeight: 600, color: '#1e1e2e', margin: 0 }}>{weekLabel}</h1>
                {isAdmin && <button onClick={startEditWeekName} style={editIconBtn} title="Edit week name">✏️</button>}
              </>
            )}
          </div>
          {!isActiveWeek && <span style={{ fontSize: 14, color: '#888', fontStyle: 'italic' }}>Past week</span>}

          {/* Drive link row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <Link size={14} style={{ color: '#8b7355', flexShrink: 0 }} />
            {isAdmin && editingDriveLink ? (
              <>
                <input
                  autoFocus
                  type="url"
                  value={driveLinkVal}
                  onChange={e => setDriveLinkVal(e.target.value)}
                  onBlur={saveDriveLink}
                  onKeyDown={e => { if (e.key === 'Enter') saveDriveLink(); if (e.key === 'Escape') setEditingDriveLink(false); }}
                  placeholder="https://drive.google.com/drive/folders/..."
                  style={{ fontFamily: FONT, fontSize: 13, color: '#1e1e2e', border: '1.5px solid #ACD8F0', borderRadius: 8, padding: '6px 10px', outline: 'none', background: 'rgba(255,255,255,0.9)', width: 420 }}
                />
                <button onClick={() => setEditingDriveLink(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: 13 }}>Cancel</button>
              </>
            ) : weekDriveLink ? (
              <>
                <a
                  href={weekDriveLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 13, color: '#2563EB', textDecoration: 'underline', fontFamily: FONT }}
                >
                  Week's Google Drive folder
                </a>
                {isAdmin && <button onClick={startEditDriveLink} style={editIconBtn} title="Edit Drive link">✏️</button>}
              </>
            ) : isAdmin ? (
              <button
                onClick={startEditDriveLink}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#8b7355', fontFamily: FONT, padding: 0, textDecoration: 'underline dotted' }}
              >
                Add Google Drive link for this week
              </button>
            ) : null}
          </div>
        </div>
      )}

      {/* No week */}
      {!currentWeek && (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>☀️</div>
          <div style={{ fontFamily: SERIF, fontSize: 22, color: '#1e1e2e', marginBottom: 8 }}>No active week yet</div>
          <div style={{ fontSize: 15, color: '#666' }}>
            {isAdmin ? 'Use "Set up new week" to get started.' : "Check back soon — camp week hasn't started yet."}
          </div>
        </div>
      )}

      {/* Legend — admin only */}
      {isAdmin && groupedCamps.length > 0 && (
        <div style={{ display: 'flex', gap: 20, alignItems: 'center', fontSize: 14, color: '#555', marginBottom: 28 }}>
          {[['#B2E8C8','All 5 days done'],['#F7E4A0','Some days added'],['rgba(0,0,0,0.12)','Not started']].map(([bg, label]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: bg }} />
              {label}
            </div>
          ))}
        </div>
      )}

      {/* ═══════ ADMIN VIEW ═══════ */}
      {isAdmin && groupedCamps.map(({ name, camps: groupCamps }) => (
        <div key={name || '__ungrouped__'} style={{ marginBottom: 44 }}>

          {/* Group header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingBottom: 12, borderBottom: '2px solid rgba(0,0,0,0.08)' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {editingGroup === name ? (
                  <EditInput value={groupNameVal} onChange={setGroupNameVal}
                    onSave={() => saveGroupName(name, groupCamps)} onCancel={() => setEditingGroup(null)}
                    style={{ fontSize: 18, fontWeight: 600, width: 340 }}
                  />
                ) : (
                  <>
                    <span style={{ fontSize: 18, fontWeight: 600, color: '#1e1e2e' }}>{name || 'Ungrouped'}</span>
                    <button onClick={() => startEditGroup(name)} style={editIconBtn} title="Edit group name">✏️</button>
                  </>
                )}
              </div>
              <div style={{ fontSize: 13, color: '#888', marginTop: 3 }}>
                Full day camp · {groupCamps.length} sub-camp{groupCamps.length !== 1 ? 's' : ''}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button onClick={() => { setAddingToGroup(name); setNewCamp({ camp_name: '', teacher_name: '', time_start: '', time_end: '' }); }} style={pillBtn('rgba(178,232,200,0.6)', '#1a4a2a')}>
                + Sub-camp
              </button>
              <button onClick={() => handleGroupDownload(name)} disabled={downloadingGroup === name}
                style={{ ...pillBtn('#ACD8F0', '#1e3a4a'), opacity: downloadingGroup === name ? 0.6 : 1, cursor: downloadingGroup === name ? 'wait' : 'pointer' }}>
                {downloadingGroup === name ? '…' : '↓'} Download doc
              </button>
              <button
                onClick={() => handleDeleteGroup(name, groupCamps)}
                disabled={deletingGroup === name}
                style={{ ...pillBtn('rgba(239,68,68,0.1)', '#dc2626'), opacity: deletingGroup === name ? 0.5 : 1, cursor: deletingGroup === name ? 'wait' : 'pointer' }}
                title="Delete entire group"
              >
                <Trash2 size={13} /> {deletingGroup === name ? 'Deleting…' : 'Delete group'}
              </button>
            </div>
          </div>

          {/* Sub-camps */}
          {groupCamps.map(camp => {
            const campId = camp[SynopsisCampFields.CAMP_ID];
            const count  = progressCount(campId, allEntries);
            const done   = count === VALID_DAYS.length;
            const partial = count > 0 && !done;
            return (
              <div key={campId}>
                <div onClick={() => onCampSelect(camp)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.9)', borderRadius: 16, padding: '20px 24px', marginBottom: 12, cursor: 'pointer', transition: 'box-shadow 0.18s, transform 0.12s' }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,0,0,0.09)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', flexShrink: 0, background: done ? '#B2E8C8' : partial ? '#F7E4A0' : 'rgba(0,0,0,0.12)' }} />
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 600, color: '#1e1e2e' }}>{camp[SynopsisCampFields.CAMP_NAME]}</div>
                      {camp[SynopsisCampFields.TEACHER_NAME] && <div style={{ fontSize: 15, color: '#555', marginTop: 4 }}>{camp[SynopsisCampFields.TEACHER_NAME]}</div>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {(camp[SynopsisCampFields.TIME_START] || camp[SynopsisCampFields.TIME_END]) && (
                      <span style={{ fontSize: 14, fontWeight: 500, background: '#ACD8F0', color: '#1e3a4a', padding: '5px 13px', borderRadius: 100, whiteSpace: 'nowrap' }}>
                        {[camp[SynopsisCampFields.TIME_START], camp[SynopsisCampFields.TIME_END]].filter(Boolean).join('–')}
                      </span>
                    )}
                    <span style={{ fontSize: 14, color: '#1e1e2e', background: 'rgba(0,0,0,0.07)', padding: '5px 13px', borderRadius: 100, fontWeight: 500 }}>
                      {count} / {VALID_DAYS.length} days
                    </span>
                    <button onClick={e => startEditCamp(camp, e)} style={{ ...editIconBtn, fontSize: 17, padding: '5px 7px' }} title="Edit camp">✏️</button>
                    <button
                      onClick={e => handleDeleteCamp(campId, camp[SynopsisCampFields.CAMP_NAME], e)}
                      disabled={deletingCampId === campId}
                      style={{ ...editIconBtn, padding: '5px 7px', color: deletingCampId === campId ? '#ccc' : '#ef4444', cursor: deletingCampId === campId ? 'wait' : 'pointer' }}
                      title="Delete sub-camp"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {editingCampId === campId && (
                  <div style={inlineEditRowStyle}>
                    {[['Camp name','camp_name',180],['Teacher','teacher_name',130],['Start','time_start',90],['End','time_end',90]].map(([label, field, w]) => (
                      <div key={field} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <div style={editLabelStyle}>{label}</div>
                        <input value={editCampData[field] || ''} onChange={e => setEditCampData(p => ({ ...p, [field]: e.target.value }))} onKeyDown={e => e.key === 'Enter' && saveCampEdit(campId)} style={{ ...editInputStyle, width: w }} />
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                      <button onClick={() => saveCampEdit(campId)} style={saveBtn}>Save</button>
                      <button onClick={() => setEditingCampId(null)} style={cancelBtn}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {addingToGroup === name && (
            <div style={{ ...inlineEditRowStyle, marginTop: 4 }}>
              {[['Camp name','camp_name',180],['Teacher','teacher_name',130],['Start','time_start',90],['End','time_end',90]].map(([label, field, w]) => (
                <div key={field} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <div style={editLabelStyle}>{label}</div>
                  <input value={newCamp[field] || ''} onChange={e => setNewCamp(p => ({ ...p, [field]: e.target.value }))} onKeyDown={e => e.key === 'Enter' && saveNewCamp(name, groupCamps)}
                    placeholder={field === 'camp_name' ? 'e.g. Junior Robotics' : field === 'time_start' ? '9:00 AM' : ''}
                    style={{ ...editInputStyle, width: w }} />
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <button onClick={() => saveNewCamp(name, groupCamps)} style={saveBtn}>Add</button>
                <button onClick={() => setAddingToGroup(null)} style={cancelBtn}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* ═══════ FOOD MENU CARD ═══════ */}
      {currentWeek && onFoodSelect && (
        <div style={{ marginBottom: 44 }}>
          <div
            onClick={onFoodSelect}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'rgba(249,203,156,0.25)',
              backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(249,203,156,0.6)',
              borderRadius: 16, padding: '20px 24px',
              cursor: 'pointer', transition: 'box-shadow 0.18s, transform 0.12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,0,0,0.09)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
          >
            <div>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#1e1e2e' }}>🍽️ Food Menu</div>
              <div style={{ fontSize: 13, color: '#888', marginTop: 3 }}>
                {isAdmin ? "View and edit this week's food menu" : "See this week's snacks and meals"}
              </div>
            </div>
            <span style={{ fontSize: 20, color: '#8b7355' }}>›</span>
          </div>
        </div>
      )}

      {/* ═══════ NON-ADMIN VIEW — group dropdown ═══════ */}
      {!isAdmin && groupedCamps.length > 0 && (() => {
        const activeGroupData = groupedCamps.find(g => g.name === selectedGroup);

        return (
          <>
            {/* Group selector dropdown */}
            <div style={{ marginBottom: 28 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                Select your camp group
              </label>
              <div style={{ position: 'relative', display: 'inline-block', width: '100%', maxWidth: 480 }}>
                <select
                  value={selectedGroup || ''}
                  onChange={e => setSelectedGroup(e.target.value || null)}
                  style={{
                    width: '100%',
                    appearance: 'none', WebkitAppearance: 'none',
                    background: 'rgba(255,255,255,0.85)',
                    backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                    border: '1.5px solid rgba(172,216,240,0.7)',
                    borderRadius: 12, padding: '14px 44px 14px 18px',
                    fontSize: 15, fontWeight: 500, fontFamily: FONT, color: '#1e1e2e',
                    cursor: 'pointer', outline: 'none',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                  }}
                >
                  <option value="">— Choose a group —</option>
                  {groupedCamps.map(({ name }) => (
                    <option key={name || '__ungrouped__'} value={name}>
                      {name || 'Ungrouped'}
                    </option>
                  ))}
                </select>
                <span style={{
                  position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
                  pointerEvents: 'none', fontSize: 16, color: '#888',
                }}>▾</span>
              </div>
            </div>

            {/* Camps for selected group */}
            {activeGroupData && (
              <div>
                <div style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>
                  {activeGroupData.camps.length} sub-camp{activeGroupData.camps.length !== 1 ? 's' : ''}
                </div>
                {activeGroupData.camps.map(camp => {
                  const campId  = camp[SynopsisCampFields.CAMP_ID];
                  const count   = progressCount(campId, allEntries);
                  const done    = count === VALID_DAYS.length;
                  const partial = count > 0 && !done;

                  return (
                    <div key={campId}
                      onClick={() => onCampSelect(camp)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        background: 'rgba(255,255,255,0.8)',
                        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                        border: '1px solid rgba(255,255,255,0.9)',
                        borderRadius: 14, padding: '18px 22px', marginBottom: 10,
                        cursor: 'pointer', transition: 'box-shadow 0.15s, transform 0.1s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, background: done ? '#B2E8C8' : partial ? '#F7E4A0' : 'rgba(0,0,0,0.12)' }} />
                        <div>
                          <div style={{ fontSize: 16, fontWeight: 600, color: '#1e1e2e' }}>{camp[SynopsisCampFields.CAMP_NAME]}</div>
                          {camp[SynopsisCampFields.TEACHER_NAME] && <div style={{ fontSize: 13, color: '#6B6459', marginTop: 2 }}>{camp[SynopsisCampFields.TEACHER_NAME]}</div>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {(camp[SynopsisCampFields.TIME_START] || camp[SynopsisCampFields.TIME_END]) && (
                          <span style={{ fontSize: 13, fontWeight: 500, background: '#ACD8F0', color: '#1e3a4a', padding: '4px 11px', borderRadius: 100, whiteSpace: 'nowrap' }}>
                            {[camp[SynopsisCampFields.TIME_START], camp[SynopsisCampFields.TIME_END]].filter(Boolean).join('–')}
                          </span>
                        )}
                        <span style={{ fontSize: 13, color: '#1e1e2e', background: 'rgba(0,0,0,0.07)', padding: '4px 11px', borderRadius: 100, fontWeight: 500 }}>
                          {count} / {VALID_DAYS.length} days
                        </span>
                        <span style={{ color: '#aaa', fontSize: 18 }}>›</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Prompt when nothing selected */}
            {!activeGroupData && (
              <div style={{ textAlign: 'center', padding: '48px 0', color: '#aaa', fontSize: 15 }}>
                Select your camp group above to see your camps.
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
}
