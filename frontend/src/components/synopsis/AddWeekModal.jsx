// frontend/src/components/synopsis/AddWeekModal.jsx
import { useState, useRef } from 'react';
import { X, Plus, Trash2, Upload, Sparkles, ChevronDown, ChevronUp, Link } from 'lucide-react';
import { setupWeek, parseFlyer } from '../../services/synopsisService';

const INPUT = {
  padding: '9px 12px', borderRadius: 8, border: '1px solid #E5E0D8',
  fontSize: 13, fontFamily: "'DM Sans', sans-serif", color: '#1C1917',
  outline: 'none', width: '100%', boxSizing: 'border-box', background: '#FFFFFF',
};
const LABEL = {
  display: 'block', fontSize: 11, fontWeight: 600, color: '#8b7355',
  marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em',
};
const BTN = (extra = {}) => ({
  display: 'inline-flex', alignItems: 'center', gap: 5,
  padding: '7px 14px', borderRadius: 100, border: 'none',
  cursor: 'pointer', fontSize: 12, fontWeight: 500,
  fontFamily: "'DM Sans', sans-serif", ...extra,
});

const blankCamp = () => ({ camp_name: '', time_start: '', time_end: '' });
const blankGroup = () => ({ group_name: '', age_group: '', camps: [blankCamp()], autoParsed: false });

// "Brick Moto Mighty & Sports Camp" → ["Brick Moto Mighty", "Sports"]
function parseCampNamesFromGroup(groupName) {
  const base = groupName.replace(/\s+camps?\.?$/i, '').trim();
  if (!base) return [];
  return base
    .split(/\s*,\s*&\s*|\s+&\s+|\s+and\s+/i)
    .map(s => s.trim())
    .filter(Boolean);
}

export default function AddWeekModal({ currentUser, onClose, onSuccess }) {
  const [weekLabel, setWeekLabel] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isVisible, setIsVisible] = useState(true);
  const [driveLink, setDriveLink] = useState('');
  const [groups, setGroups] = useState([blankGroup()]);
  const [flyerFile, setFlyerFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const fileInputRef = useRef(null);

  // ── Flyer parsing ─────────────────────────────────────────────────────────
  const handleFileSelect = (e) => {
    const f = e.target.files?.[0];
    if (f) { setFlyerFile(f); setParseError(''); }
  };

  const handleParse = async () => {
    if (!flyerFile) return;
    setParsing(true);
    setParseError('');
    try {
      const result = await parseFlyer(currentUser, flyerFile);
      if (result.week_name) setWeekLabel(result.week_name);
      if (result.start_date) setStartDate(result.start_date);
      if (result.end_date) setEndDate(result.end_date);
      if (result.camp_groups?.length) {
        setGroups(result.camp_groups.map(g => ({
          group_name: g.group_name || '',
          age_group: g.age_group || '',
          autoParsed: (g.camps?.length || 0) > 1,
          camps: (g.camps || [blankCamp()]).map(c => ({
            camp_name: c.camp_name || '',
            time_start: c.time_start || '',
            time_end: c.time_end || '',
          })),
        })));
      }
    } catch (err) {
      setParseError(err.message);
    } finally {
      setParsing(false);
    }
  };

  // ── Group / camp manipulation ─────────────────────────────────────────────
  const updateGroup = (gi, field, val) =>
    setGroups(gs => gs.map((g, i) => i === gi ? { ...g, [field]: val, autoParsed: false } : g));

  // Auto-parse camp names from group name on blur
  const handleGroupNameBlur = (gi) => {
    setGroups(gs => gs.map((g, i) => {
      if (i !== gi) return g;
      const parsed = parseCampNamesFromGroup(g.group_name);
      if (parsed.length < 2) return g; // only auto-parse when ≥2 camps detected
      // Merge: preserve existing timing data where name matches
      const camps = parsed.map(name => {
        const existing = g.camps.find(c => c.camp_name.toLowerCase() === name.toLowerCase());
        return { camp_name: name, time_start: existing?.time_start || '', time_end: existing?.time_end || '' };
      });
      return { ...g, camps, autoParsed: true, age_group: g.age_group };
    }));
  };

  const addGroup = () => setGroups(gs => [...gs, blankGroup()]);

  const removeGroup = (gi) => setGroups(gs => gs.filter((_, i) => i !== gi));

  const addCamp = (gi) =>
    setGroups(gs => gs.map((g, i) => i === gi ? { ...g, camps: [...g.camps, blankCamp()], autoParsed: false } : g));

  const removeCamp = (gi, ci) =>
    setGroups(gs => {
      const mapped = gs.map((g, i) => i === gi ? { ...g, camps: g.camps.filter((_, j) => j !== ci) } : g);
      const filtered = mapped.filter(g => g.camps.length > 0);
      return filtered.length > 0 ? filtered : [blankGroup()];
    });

  const updateCamp = (gi, ci, field, val) =>
    setGroups(gs => gs.map((g, i) =>
      i === gi ? { ...g, camps: g.camps.map((c, j) => j === ci ? { ...c, [field]: val } : c) } : g
    ));

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaveError('');
    if (!weekLabel.trim()) { setSaveError('Week name is required.'); return; }

    const validGroups = groups
      .filter(g => g.camps.some(c => c.camp_name.trim()))
      .map(g => ({
        group_name: g.group_name.trim(),
        age_group: g.age_group.trim(),
        camps: g.camps
          .filter(c => c.camp_name.trim())
          .map(c => ({
            camp_name: c.camp_name.trim(),
            time_start: c.time_start.trim(),
            time_end: c.time_end.trim(),
          })),
      }));

    setSaving(true);
    try {
      await setupWeek(currentUser, {
        label: weekLabel.trim(),
        start_date: startDate,
        end_date: endDate,
        is_active: isActive,
        is_visible: isVisible,
        drive_link: driveLink.trim(),
        camp_groups: validGroups,
      });
      onSuccess();
      onClose();
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      backgroundColor: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      overflowY: 'auto', padding: '40px 16px',
    }}>
      <div style={{
        background: '#FFFFFF', borderRadius: 20, width: '100%', maxWidth: 680,
        boxShadow: '0 24px 64px rgba(0,0,0,0.18)', fontFamily: "'DM Sans', sans-serif",
        position: 'relative',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '24px 28px 20px', borderBottom: '1px solid #F0EDE8',
        }}>
          <div>
            <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, color: '#1C1917', fontWeight: 600 }}>
              Set up a new week
            </div>
            <div style={{ fontSize: 12, color: '#8b7355', marginTop: 3 }}>
              Add the week details and all camps in one step
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B6459', display: 'flex' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '24px 28px' }}>

          {/* ── Auto-fill from flyer ── */}
          <div style={{ background: '#FFF8F0', border: '1px solid #F0E4D0', borderRadius: 12, padding: '14px 16px', marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#8b7355', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={13} /> Auto-fill from flyer or schedule
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={BTN({ background: '#E8E0D5', color: '#5c4a32' })}
              >
                <Upload size={13} />
                {flyerFile ? flyerFile.name : 'Choose file (image or Excel)'}
              </button>
              {flyerFile && (
                <button
                  type="button"
                  onClick={handleParse}
                  disabled={parsing}
                  style={BTN({ background: '#1C1917', color: '#FAF8F4', opacity: parsing ? 0.6 : 1 })}
                >
                  <Sparkles size={13} /> {parsing ? 'Parsing…' : 'Parse & auto-fill'}
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.xlsx,.xls,.csv"
                style={{ display: 'none' }}
                onChange={handleFileSelect}
              />
            </div>
            {parseError && <div style={{ fontSize: 12, color: '#c0392b', marginTop: 8 }}>{parseError}</div>}
          </div>

          {/* ── Week info ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 24 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={LABEL}>Week name *</label>
              <input
                required
                value={weekLabel}
                onChange={e => setWeekLabel(e.target.value)}
                placeholder="Week of June 16–20"
                style={INPUT}
              />
            </div>
            <div>
              <label style={LABEL}>Start date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={INPUT} />
            </div>
            <div>
              <label style={LABEL}>End date</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={INPUT} />
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  id="isActive"
                  checked={isActive}
                  onChange={e => setIsActive(e.target.checked)}
                  style={{ accentColor: '#8b7355', width: 15, height: 15 }}
                />
                <label htmlFor="isActive" style={{ fontSize: 13, color: '#1C1917', cursor: 'pointer' }}>
                  Set as active week
                </label>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  id="isVisible"
                  checked={isVisible}
                  onChange={e => setIsVisible(e.target.checked)}
                  style={{ accentColor: '#8b7355', width: 15, height: 15 }}
                />
                <label htmlFor="isVisible" style={{ fontSize: 13, color: '#1C1917', cursor: 'pointer' }}>
                  Show on teacher view
                </label>
              </div>
            </div>
          </div>

          {/* ── Google Drive link ── */}
          <div style={{ marginBottom: 24 }}>
            <label style={LABEL}>Google Drive link (optional)</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#8b7355', display: 'flex' }}>
                <Link size={14} />
              </span>
              <input
                type="url"
                value={driveLink}
                onChange={e => setDriveLink(e.target.value)}
                placeholder="https://drive.google.com/drive/folders/..."
                style={{ ...INPUT, paddingLeft: 32 }}
              />
            </div>
            <div style={{ fontSize: 11, color: '#a0998e', marginTop: 4 }}>
              Paste a shared Google Drive folder link for this week's materials. Teachers will see this as a read-only link.
            </div>
          </div>

          {/* ── Camp groups ── */}
          <div style={{ borderTop: '1px solid #F0EDE8', paddingTop: 20, marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1C1917', marginBottom: 16 }}>
              Camps
            </div>

            {groups.map((group, gi) => (
              <div key={gi} style={{
                border: '1px solid #E5E0D8', borderRadius: 12, padding: '16px',
                marginBottom: 12, background: '#FAFAF9',
              }}>
                {/* Group header row */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 4 }}>
                      <div>
                        <label style={LABEL}>Camp group name</label>
                        <input
                          value={group.group_name}
                          onChange={e => updateGroup(gi, 'group_name', e.target.value)}
                          onBlur={() => handleGroupNameBlur(gi)}
                          placeholder="e.g. Brick Moto Mighty & Sports Camp"
                          style={INPUT}
                        />
                      </div>
                      <div>
                        <label style={LABEL}>Age group</label>
                        <input
                          value={group.age_group}
                          onChange={e => updateGroup(gi, 'age_group', e.target.value)}
                          placeholder="e.g. Ages 5–8"
                          style={INPUT}
                        />
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: '#a0998e' }}>
                      Camp names are auto-detected from the group name — just add timings below
                    </div>
                  </div>
                  {groups.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeGroup(gi)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c0392b', marginTop: 20, flexShrink: 0 }}
                      title="Remove group"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>

                {/* Auto-parsed indicator */}
                {group.autoParsed && (
                  <div style={{ fontSize: 11, color: '#2E7A43', background: '#E5F4E9', borderRadius: 6, padding: '5px 10px', marginBottom: 10, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <Sparkles size={11} /> {group.camps.length} camps detected — add timings below
                  </div>
                )}

                {/* Sub-camp rows */}
                {group.camps.map((camp, ci) => (
                  <div key={ci} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'end' }}>
                    <div>
                      {ci === 0 && <label style={LABEL}>Camp name</label>}
                      <input
                        value={camp.camp_name}
                        onChange={e => updateCamp(gi, ci, 'camp_name', e.target.value)}
                        placeholder="e.g. Brick Moto Mighty"
                        style={{
                          ...INPUT,
                          background: group.autoParsed && camp.camp_name ? '#F5F9F5' : '#FFFFFF',
                        }}
                      />
                    </div>
                    <div>
                      {ci === 0 && <label style={LABEL}>Start time</label>}
                      <input
                        value={camp.time_start}
                        onChange={e => updateCamp(gi, ci, 'time_start', e.target.value)}
                        placeholder="9:00 AM"
                        style={INPUT}
                      />
                    </div>
                    <div>
                      {ci === 0 && <label style={LABEL}>End time</label>}
                      <input
                        value={camp.time_end}
                        onChange={e => updateCamp(gi, ci, 'time_end', e.target.value)}
                        placeholder="12:00 PM"
                        style={INPUT}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeCamp(gi, ci)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: '#c0392b',
                        display: 'flex', alignItems: 'center', paddingBottom: 2,
                      }}
                      title="Remove camp"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => addCamp(gi)}
                  style={BTN({ background: '#F0EDE8', color: '#8b7355', marginTop: 4 })}
                >
                  <Plus size={13} /> Add camp
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={addGroup}
              style={BTN({ background: '#E8E0D5', color: '#5c4a32', marginTop: 4 })}
            >
              <Plus size={13} /> Add camp group
            </button>
          </div>

          {/* ── Error + submit ── */}
          {saveError && (
            <div style={{ fontSize: 13, color: '#c0392b', padding: '10px 14px', background: '#fff5f5', borderRadius: 8, marginTop: 16 }}>
              {saveError}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24, paddingTop: 20, borderTop: '1px solid #F0EDE8' }}>
            <button type="button" onClick={onClose} style={BTN({ background: '#F0EDE8', color: '#6B6459', padding: '10px 20px' })}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={BTN({ background: saving ? '#c8bfb5' : '#1C1917', color: '#FAF8F4', padding: '10px 24px', fontSize: 13, opacity: saving ? 0.7 : 1 })}
            >
              {saving ? 'Creating…' : 'Create week & camps'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
