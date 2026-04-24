// src/components/modals/AddResourceModal.jsx
import { useState, useEffect } from 'react';
import { X, Plus, Check, BookMarked, Trash2 } from 'lucide-react';
import LibraryPickerModal from './LibraryPickerModal';

const WORKSHEET_TYPES = [
  'fill in the blanks',
  'name the images',
  'matching',
  'drawing',
  'multiple choice',
  'essay writing',
];

const ACTIVITY_TYPES = [
  'quiz',
  'discussion',
  'experiment',
  'teamwork',
  'hands-on',
];

const colors = {
  accent: '#D4C4A8',
  border: '#E8E6E1',
  textSecondary: '#6B6760',
  textPrimary: '#2C2A26',
  accentLight: '#F5F3EE',
  danger: '#E57373',
  stripe: {
    content:   '#6B8FE8',
    video:     '#6B8FE8',
    worksheet: '#E8A55C',
    activity:  '#5CC97C',
  },
};

/* ── Multi-link input ── */
const LinkListInput = ({ links, onChange }) => {
  const addLink = () => onChange([...links, '']);
  const updateLink = (i, val) => { const next = [...links]; next[i] = val; onChange(next); };
  const removeLink = (i) => onChange(links.filter((_, idx) => idx !== i));

  return (
    <div>
      {links.map((url, i) => (
        <div key={i} style={{ display: 'flex', gap: '6px', marginBottom: '8px', alignItems: 'center' }}>
          <input
            type="url"
            value={url}
            onChange={e => updateLink(i, e.target.value)}
            placeholder="https://..."
            style={{ flex: 1, padding: '9px 12px', border: `1px solid ${colors.border}`, borderRadius: '8px', fontSize: '14.3px', outline: 'none', fontFamily: 'inherit' }}
            onFocus={e => { e.target.style.borderColor = colors.accent; }}
            onBlur={e => { e.target.style.borderColor = colors.border; }}
          />
          <button
            type="button"
            onClick={() => removeLink(i)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.danger, padding: '4px', display: 'flex', alignItems: 'center' }}
          >
            <Trash2 size={15} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addLink}
        style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 12px', backgroundColor: colors.accentLight, border: `1px dashed ${colors.border}`, borderRadius: '8px', cursor: 'pointer', fontSize: '13.2px', color: colors.textSecondary, fontWeight: '600', fontFamily: 'inherit' }}
      >
        <Plus size={13} /> Add link
      </button>
    </div>
  );
};

const AddResourceModal = ({ isOpen, onClose, onAdd, resourceType = 'content', initialData = null, mode = 'add', currentUser = null }) => {
  // Content fields
  const [information, setInformation] = useState('');
  // Worksheet fields
  const [title, setTitle] = useState('');
  const [worksheetType, setWorksheetType] = useState('');
  const [contentKeywords, setContentKeywords] = useState('');
  // Activity fields
  const [activityType, setActivityType] = useState('');
  const [instructions, setInstructions] = useState('');
  // Shared
  const [links, setLinks] = useState([]);
  const [errors, setErrors] = useState({});
  const [showLibraryPicker, setShowLibraryPicker] = useState(false);

  const effectiveType = resourceType === 'video' ? 'content' : resourceType;

  useEffect(() => {
    if (!isOpen) return;
    setErrors({});
    if (effectiveType === 'content') {
      setInformation(initialData?.information || initialData?.notes || initialData?.description || '');
      setLinks(Array.isArray(initialData?.links) ? initialData.links : (initialData?.url ? [initialData.url] : []));
    } else if (effectiveType === 'worksheet') {
      setTitle(initialData?.title || '');
      setWorksheetType(initialData?.worksheetType || '');
      setContentKeywords(initialData?.contentKeywords || '');
      setLinks(Array.isArray(initialData?.links) ? initialData.links : (initialData?.url ? [initialData.url] : []));
    } else if (effectiveType === 'activity') {
      setTitle(initialData?.title || '');
      setActivityType(initialData?.activityType || '');
      setInstructions(initialData?.instructions || initialData?.notes || '');
      setLinks(Array.isArray(initialData?.links) ? initialData.links : (initialData?.url ? [initialData.url] : []));
    }
  }, [isOpen, initialData, effectiveType]);

  if (!isOpen) return null;

  const validateLinks = () => links.every(l => !l.trim() || (() => { try { new URL(l); return true; } catch { return false; } })());

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};
    const cleanLinks = links.filter(l => l.trim());

    if (!validateLinks()) newErrors.links = 'One or more links are not valid URLs';

    if (effectiveType === 'content') {
      if (!information.trim()) newErrors.information = 'Content information is required';
    } else if (effectiveType === 'worksheet') {
      if (!title.trim()) newErrors.title = 'Title is required';
      if (!worksheetType) newErrors.worksheetType = 'Please select a worksheet type';
    } else if (effectiveType === 'activity') {
      if (!title.trim()) newErrors.title = 'Title is required';
      if (!activityType) newErrors.activityType = 'Please select an activity type';
      if (!instructions.trim()) newErrors.instructions = 'Instructions are required';
    }

    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

    let resourceData;
    if (effectiveType === 'content') {
      resourceData = { type: 'content', information: information.trim(), links: cleanLinks, source: 'manual', addedAt: new Date().toISOString() };
    } else if (effectiveType === 'worksheet') {
      resourceData = { type: 'worksheet', title: title.trim(), worksheetType, contentKeywords: contentKeywords.trim(), links: cleanLinks, source: 'manual', addedAt: new Date().toISOString() };
    } else {
      resourceData = { type: 'activity', title: title.trim(), activityType, instructions: instructions.trim(), links: cleanLinks, source: 'manual', addedAt: new Date().toISOString() };
    }

    onAdd(resourceData);
    resetForm();
  };

  const resetForm = () => {
    setInformation(''); setTitle(''); setWorksheetType(''); setContentKeywords('');
    setActivityType(''); setInstructions(''); setLinks([]); setErrors({});
  };

  const handleClose = () => { resetForm(); onClose(); };

  const handleLibrarySelect = (link) => {
    if (effectiveType === 'content') {
      setInformation(link.description || link.notes || '');
      setLinks(link.url ? [link.url] : []);
    } else {
      setTitle(link.title || '');
      if (effectiveType === 'activity') setInstructions(link.description || link.notes || '');
      if (link.url) setLinks([link.url]);
    }
    setErrors({});
    setShowLibraryPicker(false);
  };

  const typeLabels = { content: 'Content', worksheet: 'Worksheet', activity: 'Activity' };
  const typeLabel = typeLabels[effectiveType] || 'Resource';
  const stripe = colors.stripe[effectiveType] || colors.accent;

  const fieldStyle = (errKey) => ({
    width: '100%', padding: '10px 14px',
    border: errors[errKey] ? `2px solid ${colors.danger}` : `1px solid ${colors.border}`,
    borderRadius: '8px', fontSize: '14.3px', outline: 'none', fontFamily: 'inherit',
  });
  const onFocus = (errKey) => (e) => { if (!errors[errKey]) e.target.style.borderColor = colors.accent; };
  const onBlur = (errKey) => (e) => { if (!errors[errKey]) e.target.style.borderColor = colors.border; };

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '20px' }}
        onClick={handleClose}
      >
        <div
          style={{ backgroundColor: 'white', borderRadius: '12px', padding: '28px', width: '100%', maxWidth: '560px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto', borderTop: `4px solid ${stripe}` }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h3 style={{ margin: 0, fontSize: '22px', color: colors.textPrimary, fontWeight: '700' }}>
              {mode === 'edit' ? 'Edit' : 'Add'} {typeLabel} Block
            </h3>
            <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', color: colors.textSecondary }}>
              <X size={24} />
            </button>
          </div>

          {/* Library picker */}
          {mode === 'add' && currentUser && (
            <>
              <button
                type="button"
                onClick={() => setShowLibraryPicker(true)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px 16px', marginBottom: '20px', backgroundColor: colors.accentLight, color: '#8b7355', border: `1px solid ${colors.border}`, borderRadius: '8px', cursor: 'pointer', fontSize: '14.3px', fontWeight: '600', fontFamily: 'inherit' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#EDE8DF'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = colors.accentLight}
              >
                <BookMarked size={15} /> Pick from Resource Library
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <div style={{ flex: 1, height: '1px', backgroundColor: colors.border }} />
                <span style={{ fontSize: '13.2px', color: '#9ca3af', flexShrink: 0 }}>or enter manually</span>
                <div style={{ flex: 1, height: '1px', backgroundColor: colors.border }} />
              </div>
            </>
          )}

          <form onSubmit={handleSubmit}>

            {/* ── CONTENT fields ── */}
            {effectiveType === 'content' && (
              <>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '14.3px', color: colors.textSecondary, marginBottom: '4px', fontWeight: '600' }}>Content Information *</label>
                  <p style={{ fontSize: '12.5px', color: '#9ca3af', marginBottom: '8px', fontStyle: 'italic' }}>
                    Explain the topic in age-appropriate language. Include how the teacher can deliver this content — analogies, pacing, key points to emphasise.
                  </p>
                  <textarea
                    value={information}
                    onChange={e => { setInformation(e.target.value); if (errors.information) setErrors({ ...errors, information: null }); }}
                    placeholder="e.g. A robot is a machine that can be programmed to do tasks automatically. Teachers can start by showing everyday robots (vacuum cleaners, toy cars) and asking: what makes this a robot?"
                    rows={5}
                    style={{ ...fieldStyle('information'), resize: 'vertical', lineHeight: '1.6' }}
                    onFocus={onFocus('information')} onBlur={onBlur('information')}
                  />
                  {errors.information && <p style={{ margin: '6px 0 0', fontSize: '13.2px', color: colors.danger }}>{errors.information}</p>}
                </div>
              </>
            )}

            {/* ── WORKSHEET fields ── */}
            {effectiveType === 'worksheet' && (
              <>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '14.3px', color: colors.textSecondary, marginBottom: '8px', fontWeight: '600' }}>Title *</label>
                  <input type="text" value={title} onChange={e => { setTitle(e.target.value); if (errors.title) setErrors({ ...errors, title: null }); }}
                    placeholder="e.g. Robot Parts Labelling Sheet"
                    style={fieldStyle('title')} onFocus={onFocus('title')} onBlur={onBlur('title')} />
                  {errors.title && <p style={{ margin: '6px 0 0', fontSize: '13.2px', color: colors.danger }}>{errors.title}</p>}
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '14.3px', color: colors.textSecondary, marginBottom: '8px', fontWeight: '600' }}>Worksheet Type *</label>
                  <select value={worksheetType} onChange={e => { setWorksheetType(e.target.value); if (errors.worksheetType) setErrors({ ...errors, worksheetType: null }); }}
                    style={{ ...fieldStyle('worksheetType'), backgroundColor: 'white', cursor: 'pointer' }}
                    onFocus={onFocus('worksheetType')} onBlur={onBlur('worksheetType')}
                  >
                    <option value="">Select a type…</option>
                    {WORKSHEET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {errors.worksheetType && <p style={{ margin: '6px 0 0', fontSize: '13.2px', color: colors.danger }}>{errors.worksheetType}</p>}
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '14.3px', color: colors.textSecondary, marginBottom: '4px', fontWeight: '600' }}>Content Keywords <span style={{ fontWeight: '400', color: '#9ca3af' }}>(optional)</span></label>
                  <p style={{ fontSize: '12.5px', color: '#9ca3af', marginBottom: '8px', fontStyle: 'italic' }}>Key concepts this worksheet covers, e.g. robot parts, sensors, movement</p>
                  <input type="text" value={contentKeywords} onChange={e => setContentKeywords(e.target.value)}
                    placeholder="e.g. robot parts, sensors, movement"
                    style={fieldStyle('')} onFocus={e => { e.target.style.borderColor = colors.accent; }} onBlur={e => { e.target.style.borderColor = colors.border; }} />
                </div>
              </>
            )}

            {/* ── ACTIVITY fields ── */}
            {effectiveType === 'activity' && (
              <>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '14.3px', color: colors.textSecondary, marginBottom: '8px', fontWeight: '600' }}>Title *</label>
                  <input type="text" value={title} onChange={e => { setTitle(e.target.value); if (errors.title) setErrors({ ...errors, title: null }); }}
                    placeholder="e.g. Build-a-Robot Relay Race"
                    style={fieldStyle('title')} onFocus={onFocus('title')} onBlur={onBlur('title')} />
                  {errors.title && <p style={{ margin: '6px 0 0', fontSize: '13.2px', color: colors.danger }}>{errors.title}</p>}
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '14.3px', color: colors.textSecondary, marginBottom: '8px', fontWeight: '600' }}>Activity Type *</label>
                  <select value={activityType} onChange={e => { setActivityType(e.target.value); if (errors.activityType) setErrors({ ...errors, activityType: null }); }}
                    style={{ ...fieldStyle('activityType'), backgroundColor: 'white', cursor: 'pointer' }}
                    onFocus={onFocus('activityType')} onBlur={onBlur('activityType')}
                  >
                    <option value="">Select a type…</option>
                    {ACTIVITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {errors.activityType && <p style={{ margin: '6px 0 0', fontSize: '13.2px', color: colors.danger }}>{errors.activityType}</p>}
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '14.3px', color: colors.textSecondary, marginBottom: '4px', fontWeight: '600' }}>Instructions *</label>
                  <p style={{ fontSize: '12.5px', color: '#9ca3af', marginBottom: '8px', fontStyle: 'italic' }}>
                    Step-by-step guide for teachers — setup, grouping, what students do, timing, debrief question.
                  </p>
                  <textarea
                    value={instructions}
                    onChange={e => { setInstructions(e.target.value); if (errors.instructions) setErrors({ ...errors, instructions: null }); }}
                    placeholder="e.g. 1. Divide class into teams of 4. 2. Each team gets a set of robot part cards. 3. Students race to assemble the robot in the correct order. 4. Debrief: which part was hardest to place, and why?"
                    rows={5}
                    style={{ ...fieldStyle('instructions'), resize: 'vertical', lineHeight: '1.6' }}
                    onFocus={onFocus('instructions')} onBlur={onBlur('instructions')}
                  />
                  {errors.instructions && <p style={{ margin: '6px 0 0', fontSize: '13.2px', color: colors.danger }}>{errors.instructions}</p>}
                </div>
              </>
            )}

            {/* ── Links (all types) ── */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '14.3px', color: colors.textSecondary, marginBottom: '4px', fontWeight: '600' }}>
                Links <span style={{ fontWeight: '400', color: '#9ca3af' }}>(optional)</span>
              </label>
              <p style={{ fontSize: '12.5px', color: '#9ca3af', marginBottom: '10px', fontStyle: 'italic' }}>
                Videos, PDFs, articles, or any supporting resources — add as many as you like.
              </p>
              <LinkListInput links={links} onChange={setLinks} />
              {errors.links && <p style={{ margin: '6px 0 0', fontSize: '13.2px', color: colors.danger }}>{errors.links}</p>}
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button" onClick={handleClose}
                style={{ flex: 1, padding: '10px 16px', backgroundColor: '#f3f4f6', color: colors.textPrimary, border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '15.4px', fontWeight: '600', fontFamily: 'inherit' }}
                onMouseEnter={e => { e.target.style.backgroundColor = '#e5e7eb'; }}
                onMouseLeave={e => { e.target.style.backgroundColor = '#f3f4f6'; }}
              >Cancel</button>
              <button
                type="submit"
                style={{ flex: 1, padding: '10px 16px', backgroundColor: colors.accent, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '15.4px', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontFamily: 'inherit' }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#B8A888'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = colors.accent; }}
              >
                {mode === 'edit' ? <Check size={16} /> : <Plus size={16} />}
                {mode === 'edit' ? 'Save Changes' : `Add ${typeLabel} Block`}
              </button>
            </div>
          </form>
        </div>
      </div>

      <LibraryPickerModal
        isOpen={showLibraryPicker}
        onClose={() => setShowLibraryPicker(false)}
        onSelect={handleLibrarySelect}
        currentUser={currentUser}
      />
    </>
  );
};

export default AddResourceModal;
