// src/components/modals/AddResourceModal.jsx
import { useState, useEffect } from 'react';
import { X, Plus, Check, BookMarked } from 'lucide-react';
import LibraryPickerModal from './LibraryPickerModal';

const AddResourceModal = ({ isOpen, onClose, onAdd, resourceType = 'video', initialData = null, mode = 'add', currentUser = null }) => {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState({});
  const [showLibraryPicker, setShowLibraryPicker] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTitle(initialData?.title || '');
      setUrl(initialData?.url || '');
      setNotes(initialData?.notes || initialData?.description || '');
      setErrors({});
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const validateUrl = (urlString) => {
    try {
      new URL(urlString);
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const newErrors = {};

    if (!title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!notes.trim()) {
      newErrors.notes = 'Teaching notes are required';
    }

    if (url.trim() && !validateUrl(url)) {
      newErrors.url = 'Please enter a valid URL (e.g., https://example.com)';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const resourceData = {
      type: resourceType,
      title: title.trim(),
      notes: notes.trim(),
      url: url.trim(),
      source: 'manual',
      addedAt: new Date().toISOString()
    };

    onAdd(resourceData);

    setTitle('');
    setUrl('');
    setNotes('');
    setErrors({});
  };

  const handleClose = () => {
    setTitle('');
    setUrl('');
    setNotes('');
    setErrors({});
    onClose();
  };

  const handleLibrarySelect = (link) => {
    setTitle(link.title || '');
    setUrl(link.url || '');
    setNotes(link.description || link.notes || '');
    setErrors({});
    setShowLibraryPicker(false);
  };

  const getResourceTypeLabel = () => {
    switch (resourceType) {
      case 'video':    return 'Content';
      case 'worksheet': return 'Worksheet';
      case 'activity':  return 'Activity';
      default:          return 'Resource';
    }
  };

  const getNotesPlaceholder = () => {
    switch (resourceType) {
      case 'video':
        return 'Describe how to deliver this content — teaching approach, key points to emphasise, analogies to use, how to check for understanding…';
      case 'worksheet':
        return 'Describe what to include, how to structure it, differentiation tips, what students should be able to do by the end…';
      case 'activity':
        return 'Explain how to run the activity — setup, grouping, step-by-step facilitation, timing, discussion prompts, debrief questions…';
      default:
        return 'Add teaching notes…';
    }
  };

  const getUrlPlaceholder = () => {
    switch (resourceType) {
      case 'video':    return 'https://www.youtube.com/watch?v=... (optional)';
      case 'worksheet': return 'https://example.com/worksheet.pdf (optional)';
      case 'activity':  return 'https://example.com/activity-guide (optional)';
      default:          return 'https://... (optional)';
    }
  };

  const colors = {
    accent: '#D4C4A8',
    border: '#E8E6E1',
    textSecondary: '#6B6760',
    textPrimary: '#2C2A26',
    accentLight: '#F5F3EE',
    danger: '#E57373',
    stripe: {
      video:     '#6B8FE8',
      worksheet: '#E8A55C',
      activity:  '#5CC97C'
    }
  };

  const stripe = colors.stripe[resourceType] || colors.accent;

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
          padding: '20px'
        }}
        onClick={handleClose}
      >
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '28px',
            width: '100%',
            maxWidth: '560px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
            maxHeight: '90vh',
            overflowY: 'auto',
            borderTop: `4px solid ${stripe}`
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h3 style={{ margin: 0, fontSize: '22px', color: colors.textPrimary, fontWeight: '700' }}>
              {mode === 'edit' ? 'Edit' : 'Add'} {getResourceTypeLabel()} Block
            </h3>
            <button
              onClick={handleClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', color: colors.textSecondary }}
            >
              <X size={24} />
            </button>
          </div>

          {/* Pick from Library — only in add mode */}
          {mode === 'add' && currentUser && (
            <button
              type="button"
              onClick={() => setShowLibraryPicker(true)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '10px 16px',
                marginBottom: '20px',
                backgroundColor: colors.accentLight,
                color: '#8b7355',
                border: `1px solid ${colors.border}`,
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14.3px',
                fontWeight: '600',
                fontFamily: 'inherit'
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#EDE8DF'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = colors.accentLight}
            >
              <BookMarked size={15} />
              Pick from Resource Library
            </button>
          )}

          {mode === 'add' && currentUser && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div style={{ flex: 1, height: '1px', backgroundColor: colors.border }} />
              <span style={{ fontSize: '13.2px', color: '#9ca3af', flexShrink: 0 }}>or enter manually</span>
              <div style={{ flex: 1, height: '1px', backgroundColor: colors.border }} />
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Title */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '14.3px', color: colors.textSecondary, marginBottom: '8px', fontWeight: '600' }}>
                Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => { setTitle(e.target.value); if (errors.title) setErrors({ ...errors, title: null }); }}
                placeholder={`e.g., Guided explanation of ${getResourceTypeLabel().toLowerCase()} concept`}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: errors.title ? `2px solid ${colors.danger}` : `1px solid ${colors.border}`,
                  borderRadius: '8px',
                  fontSize: '15.4px',
                  outline: 'none'
                }}
                onFocus={(e) => { if (!errors.title) e.target.style.borderColor = colors.accent; }}
                onBlur={(e) => { if (!errors.title) e.target.style.borderColor = colors.border; }}
              />
              {errors.title && <p style={{ margin: '6px 0 0', fontSize: '13.2px', color: colors.danger }}>{errors.title}</p>}
            </div>

            {/* Teaching Notes — primary field */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '14.3px', color: colors.textSecondary, marginBottom: '4px', fontWeight: '600' }}>
                Teaching Notes *
              </label>
              <p style={{ fontSize: '12.5px', color: '#9ca3af', marginBottom: '8px', fontStyle: 'italic' }}>
                Methods, techniques, facilitation tips — the <em>how</em> to teach this
              </p>
              <textarea
                value={notes}
                onChange={(e) => { setNotes(e.target.value); if (errors.notes) setErrors({ ...errors, notes: null }); }}
                placeholder={getNotesPlaceholder()}
                rows={5}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: errors.notes ? `2px solid ${colors.danger}` : `1px solid ${colors.border}`,
                  borderRadius: '8px',
                  fontSize: '14.3px',
                  outline: 'none',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  lineHeight: '1.6'
                }}
                onFocus={(e) => { if (!errors.notes) e.target.style.borderColor = colors.accent; }}
                onBlur={(e) => { if (!errors.notes) e.target.style.borderColor = colors.border; }}
              />
              {errors.notes && <p style={{ margin: '6px 0 0', fontSize: '13.2px', color: colors.danger }}>{errors.notes}</p>}
            </div>

            {/* URL — optional */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '14.3px', color: colors.textSecondary, marginBottom: '4px', fontWeight: '600' }}>
                Reference Link <span style={{ fontWeight: '400', color: '#9ca3af' }}>(optional)</span>
              </label>
              <p style={{ fontSize: '12.5px', color: '#9ca3af', marginBottom: '8px', fontStyle: 'italic' }}>
                Video, PDF, article, or any supporting resource
              </p>
              <input
                type="url"
                value={url}
                onChange={(e) => { setUrl(e.target.value); if (errors.url) setErrors({ ...errors, url: null }); }}
                placeholder={getUrlPlaceholder()}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: errors.url ? `2px solid ${colors.danger}` : `1px solid ${colors.border}`,
                  borderRadius: '8px',
                  fontSize: '15.4px',
                  outline: 'none'
                }}
                onFocus={(e) => { if (!errors.url) e.target.style.borderColor = colors.accent; }}
                onBlur={(e) => { if (!errors.url) e.target.style.borderColor = colors.border; }}
              />
              {errors.url && <p style={{ margin: '6px 0 0', fontSize: '13.2px', color: colors.danger }}>{errors.url}</p>}
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={handleClose}
                style={{ flex: 1, padding: '10px 16px', backgroundColor: '#f3f4f6', color: colors.textPrimary, border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '15.4px', fontWeight: '600', fontFamily: 'inherit' }}
                onMouseEnter={(e) => { e.target.style.backgroundColor = '#e5e7eb'; }}
                onMouseLeave={(e) => { e.target.style.backgroundColor = '#f3f4f6'; }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{ flex: 1, padding: '10px 16px', backgroundColor: colors.accent, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '15.4px', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontFamily: 'inherit' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#B8A888'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = colors.accent; }}
              >
                {mode === 'edit' ? <Check size={16} /> : <Plus size={16} />}
                {mode === 'edit' ? 'Save Changes' : `Add ${getResourceTypeLabel()} Block`}
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
