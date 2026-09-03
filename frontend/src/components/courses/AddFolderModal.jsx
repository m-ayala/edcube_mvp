// frontend/src/components/courses/AddFolderModal.jsx
// Create / edit a course folder. Name is the only required field; description,
// labels, collaborators and colour are optional. Persists via dbService and
// hands the resulting folder object back through onSaved().

import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getAllTeachers } from '../../utils/teacherService';
import { createCourseFolder, updateCourseFolder } from '../../firebase/dbService';
import { FOLDER_COLOR_KEYS, resolveFolderColor } from './folderColors';

const LABEL_SUGGESTIONS = [
  'Mathematics', 'Science', 'Language', 'Social Studies', 'Arts',
  'Computer Science', 'Physical Education', 'Music',
];

const getInitials = (name) => {
  if (!name) return '?';
  const p = name.trim().split(/\s+/);
  return (p.length === 1 ? p[0][0] : p[0][0] + p[p.length - 1][0]).toUpperCase();
};

const Avatar = ({ person, size = 28 }) =>
  person.profile_picture_url ? (
    <img
      src={person.profile_picture_url}
      alt={person.display_name}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
    />
  ) : (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: '#8B7355', color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.4, fontWeight: 600, flexShrink: 0,
    }}>
      {getInitials(person.display_name)}
    </div>
  );

const AddFolderModal = ({ folder = null, parentId = null, onClose, onSaved }) => {
  const { currentUser } = useAuth();
  const isEdit = !!folder;

  const [name, setName] = useState(folder?.name || '');
  const [description, setDescription] = useState(folder?.description || '');
  const [labels, setLabels] = useState(folder?.labels || []);
  const [labelDraft, setLabelDraft] = useState('');
  const [collaborators, setCollaborators] = useState(folder?.collaborators || []);
  const [color, setColor] = useState(folder?.color || FOLDER_COLOR_KEYS[0]);

  const [allTeachers, setAllTeachers] = useState([]);
  const [teacherQuery, setTeacherQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const nameRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => { setTimeout(() => nameRef.current?.focus(), 60); }, []);

  useEffect(() => {
    if (!currentUser) return;
    getAllTeachers(currentUser)
      .then((all) => setAllTeachers(all.filter((t) => t.teacher_uid !== currentUser.uid)))
      .catch(() => {});
  }, [currentUser]);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectedUids = new Set(collaborators.map((c) => c.uid));
  const teacherSuggestions = teacherQuery.trim()
    ? allTeachers.filter(
        (t) =>
          t.display_name.toLowerCase().includes(teacherQuery.trim().toLowerCase()) &&
          !selectedUids.has(t.teacher_uid),
      ).slice(0, 6)
    : [];

  const addLabel = (raw) => {
    const v = raw.trim();
    if (v && !labels.some((l) => l.toLowerCase() === v.toLowerCase())) {
      setLabels((prev) => [...prev, v]);
    }
    setLabelDraft('');
  };

  const addCollaborator = (t) => {
    setCollaborators((prev) => [
      ...prev,
      { uid: t.teacher_uid, display_name: t.display_name, profile_picture_url: t.profile_picture_url || null },
    ]);
    setTeacherQuery('');
    setDropdownOpen(false);
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) { setError('Folder name is required.'); nameRef.current?.focus(); return; }
    setSaving(true);
    setError(null);
    const payload = { description: description.trim(), labels, collaborators, color };
    try {
      if (isEdit) {
        await updateCourseFolder(currentUser.uid, folder.id, { name: trimmed, ...payload });
        onSaved({ ...folder, name: trimmed, ...payload });
      } else {
        const created = await createCourseFolder(currentUser.uid, trimmed, parentId, payload);
        onSaved(created);
      }
    } catch (err) {
      console.error('Save folder error:', err);
      setError('Could not save the folder. Please try again.');
      setSaving(false);
    }
  };

  return (
    <div style={overlay} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={modal}>
        <div style={headerRow}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1C1917' }}>
            {isEdit ? 'Edit folder' : 'New folder'}
          </h3>
          <button onClick={onClose} style={iconBtn} aria-label="Close"><X size={18} /></button>
        </div>

        <div style={body}>
          {/* Name */}
          <label style={field}>
            <span style={label}>Name<span style={{ color: '#DC2626' }}> *</span></span>
            <input
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
              placeholder="e.g. Summer Camp 2026"
              style={input}
            />
          </label>

          {/* Description */}
          <label style={field}>
            <span style={label}>Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this folder for?"
              rows={2}
              style={{ ...input, resize: 'vertical', minHeight: '54px' }}
            />
          </label>

          {/* Labels */}
          <div style={field}>
            <span style={label}>Labels</span>
            <div style={chipWrap}>
              {labels.map((l) => (
                <span key={l} style={chip}>
                  {l}
                  <button onClick={() => setLabels((prev) => prev.filter((x) => x !== l))} style={chipX}>×</button>
                </span>
              ))}
              <input
                value={labelDraft}
                onChange={(e) => setLabelDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addLabel(labelDraft); }
                  if (e.key === 'Backspace' && !labelDraft && labels.length) {
                    setLabels((prev) => prev.slice(0, -1));
                  }
                }}
                placeholder={labels.length ? '' : 'Add a subject and press Enter'}
                style={chipInput}
              />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
              {LABEL_SUGGESTIONS.filter((s) => !labels.some((l) => l.toLowerCase() === s.toLowerCase()))
                .slice(0, 6)
                .map((s) => (
                  <button key={s} onClick={() => addLabel(s)} style={suggestChip}>+ {s}</button>
                ))}
            </div>
          </div>

          {/* Collaborators */}
          <div style={field} ref={dropdownRef}>
            <span style={label}>Collaborators</span>
            {collaborators.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                {collaborators.map((c) => (
                  <span key={c.uid} style={personPill}>
                    <Avatar person={c} size={22} />
                    {c.display_name}
                    <button
                      onClick={() => setCollaborators((prev) => prev.filter((x) => x.uid !== c.uid))}
                      style={chipX}
                    >×</button>
                  </span>
                ))}
              </div>
            )}
            <div style={{ position: 'relative' }}>
              <input
                value={teacherQuery}
                onChange={(e) => { setTeacherQuery(e.target.value); setDropdownOpen(true); }}
                onFocus={() => teacherQuery.trim() && setDropdownOpen(true)}
                placeholder="Invite teachers by name…"
                style={input}
              />
              {dropdownOpen && teacherSuggestions.length > 0 && (
                <div style={dropdown}>
                  {teacherSuggestions.map((t) => (
                    <div
                      key={t.teacher_uid}
                      onMouseDown={() => addCollaborator(t)}
                      style={dropdownRow}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#F9FAFB'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <Avatar person={t} size={26} />
                      <span style={{ fontSize: '14px', color: '#1C1917' }}>{t.display_name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Colour */}
          <div style={field}>
            <span style={label}>Colour</span>
            <div style={{ display: 'flex', gap: '10px' }}>
              {FOLDER_COLOR_KEYS.map((key) => {
                const c = resolveFolderColor(key);
                const active = color === key;
                return (
                  <button
                    key={key}
                    className="mc-btn"
                    onClick={() => setColor(key)}
                    aria-label={key}
                    style={{
                      width: '30px', height: '30px', borderRadius: '50%',
                      background: c.panel, cursor: 'pointer',
                      border: active ? `2px solid ${c.title}` : '2px solid transparent',
                      boxShadow: active ? `0 0 0 2px #fff, 0 0 0 3px ${c.title}` : 'inset 0 0 0 1px rgba(0,0,0,0.08)',
                    }}
                  />
                );
              })}
            </div>
          </div>

          {error && <p style={{ color: '#DC2626', fontSize: '13.5px', margin: '4px 0 0' }}>{error}</p>}
        </div>

        <div style={footer}>
          <button className="mc-btn" onClick={onClose} style={cancelBtn}>Cancel</button>
          <button className="mc-btn" onClick={handleSave} disabled={saving} style={{ ...saveBtn, opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create folder'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── styles ──────────────────────────────────────────────────────────────────
const overlay = {
  position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.35)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const modal = {
  width: '480px', maxWidth: '96vw', maxHeight: '92vh', background: '#fff',
  borderRadius: '14px', boxShadow: '0 20px 60px rgba(0,0,0,0.22)',
  display: 'flex', flexDirection: 'column', fontFamily: "'DM Sans', sans-serif",
  overflow: 'hidden',
};
const headerRow = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '18px 22px 14px', borderBottom: '1px solid #F3F4F6', flexShrink: 0,
};
const iconBtn = {
  background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF',
  display: 'flex', padding: '4px',
};
const body = { padding: '18px 22px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' };
const field = { display: 'flex', flexDirection: 'column', gap: '6px' };
const label = { fontSize: '12.5px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em' };
const input = {
  border: '1px solid #D1D5DB', borderRadius: '8px', padding: '9px 12px',
  fontSize: '14.5px', color: '#1C1917', outline: 'none', width: '100%',
  fontFamily: "'DM Sans', sans-serif", boxSizing: 'border-box', background: '#FAFAF9',
};
const chipWrap = {
  display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center',
  border: '1px solid #D1D5DB', borderRadius: '8px', padding: '7px 10px', background: '#FAFAF9',
};
const chip = {
  display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 4px 3px 10px',
  borderRadius: '14px', background: '#EDEBF3', color: '#4B455B', fontSize: '13px', fontWeight: 500,
};
const chipInput = {
  border: 'none', outline: 'none', background: 'transparent', flex: 1, minWidth: '120px',
  fontSize: '14px', color: '#1C1917', fontFamily: "'DM Sans', sans-serif", padding: '2px 0',
};
const chipX = {
  border: 'none', background: 'none', cursor: 'pointer', color: '#9CA3AF',
  fontSize: '16px', lineHeight: 1, padding: '0 3px',
};
const suggestChip = {
  border: '1px dashed #D1D5DB', background: '#fff', color: '#6B7280',
  borderRadius: '14px', padding: '3px 10px', fontSize: '12.5px', cursor: 'pointer',
  fontFamily: "'DM Sans', sans-serif",
};
const personPill = {
  display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 6px 3px 4px',
  borderRadius: '16px', background: '#F3F4F6', color: '#374151', fontSize: '13px', fontWeight: 500,
};
const dropdown = {
  position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50,
  background: '#fff', border: '1px solid #E5E7EB', borderRadius: '8px',
  boxShadow: '0 8px 20px rgba(0,0,0,0.1)', maxHeight: '190px', overflowY: 'auto',
};
const dropdownRow = { display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', cursor: 'pointer' };
const footer = {
  display: 'flex', justifyContent: 'flex-end', gap: '10px',
  padding: '14px 22px', borderTop: '1px solid #F3F4F6', flexShrink: 0,
};
const cancelBtn = {
  padding: '9px 18px', background: '#F3F4F6', color: '#374151', border: '1px solid #D1D5DB',
  borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500,
  fontFamily: "'DM Sans', sans-serif",
};
const saveBtn = {
  padding: '9px 20px', background: '#2C5F3A', color: '#fff', border: 'none',
  borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600,
  fontFamily: "'DM Sans', sans-serif",
};

export default AddFolderModal;
