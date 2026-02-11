// src/components/modals/AddResourceModal.jsx
import { useState } from 'react';
import { X, Plus } from 'lucide-react';

const AddResourceModal = ({ isOpen, onClose, onAdd, resourceType = 'video' }) => {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState({});

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
    
    if (!url.trim()) {
      newErrors.url = 'URL is required';
    } else if (!validateUrl(url)) {
      newErrors.url = 'Please enter a valid URL (e.g., https://example.com)';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const resourceData = {
      type: resourceType,
      title: title.trim(),
      url: url.trim(),
      description: description.trim(),
      source: 'manual',
      addedAt: new Date().toISOString()
    };

    onAdd(resourceData);
    
    // Reset form
    setTitle('');
    setUrl('');
    setDescription('');
    setErrors({});
  };

  const handleClose = () => {
    setTitle('');
    setUrl('');
    setDescription('');
    setErrors({});
    onClose();
  };

  const getResourceTypeLabel = () => {
    switch (resourceType) {
      case 'video':
        return 'Video';
      case 'worksheet':
        return 'Worksheet';
      case 'activity':
        return 'Activity';
      default:
        return 'Resource';
    }
  };

  const getPlaceholderUrl = () => {
    switch (resourceType) {
      case 'video':
        return 'https://www.youtube.com/watch?v=...';
      case 'worksheet':
        return 'https://example.com/worksheet.pdf';
      case 'activity':
        return 'https://example.com/activity-guide';
      default:
        return 'https://...';
    }
  };

  return (
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
          maxWidth: '520px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
          maxHeight: '90vh',
          overflowY: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h3 style={{ margin: 0, fontSize: '20px', color: '#2C2A26', fontWeight: '700' }}>
            Add {getResourceTypeLabel()} Link
          </h3>
          <button
            onClick={handleClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              color: '#6B6760'
            }}
          >
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {/* Title Field */}
          <div style={{ marginBottom: '20px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                color: '#6B6760',
                marginBottom: '8px',
                fontWeight: '600'
              }}
            >
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (errors.title) setErrors({ ...errors, title: null });
              }}
              placeholder={`e.g., Introduction to ${getResourceTypeLabel()}`}
              style={{
                width: '100%',
                padding: '10px 14px',
                border: errors.title ? '2px solid #E57373' : '1px solid #E8E6E1',
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none',
                transition: 'border 0.2s'
              }}
              onFocus={(e) => {
                if (!errors.title) e.target.style.borderColor = '#D4C4A8';
              }}
              onBlur={(e) => {
                if (!errors.title) e.target.style.borderColor = '#E8E6E1';
              }}
            />
            {errors.title && (
              <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#E57373' }}>
                {errors.title}
              </p>
            )}
          </div>

          {/* URL Field */}
          <div style={{ marginBottom: '20px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                color: '#6B6760',
                marginBottom: '8px',
                fontWeight: '600'
              }}
            >
              URL *
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (errors.url) setErrors({ ...errors, url: null });
              }}
              placeholder={getPlaceholderUrl()}
              style={{
                width: '100%',
                padding: '10px 14px',
                border: errors.url ? '2px solid #E57373' : '1px solid #E8E6E1',
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none',
                transition: 'border 0.2s'
              }}
              onFocus={(e) => {
                if (!errors.url) e.target.style.borderColor = '#D4C4A8';
              }}
              onBlur={(e) => {
                if (!errors.url) e.target.style.borderColor = '#E8E6E1';
              }}
            />
            {errors.url && (
              <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#E57373' }}>
                {errors.url}
              </p>
            )}
          </div>

          {/* Description Field (optional) */}
          {resourceType !== 'video' && (
            <div style={{ marginBottom: '24px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  color: '#6B6760',
                  marginBottom: '8px',
                  fontWeight: '600'
                }}
              >
                Description (optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a brief description..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: '1px solid #E8E6E1',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  transition: 'border 0.2s'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#D4C4A8';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#E8E6E1';
                }}
              />
            </div>
          )}

          {/* Helper Text */}
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: '#F5F3EE',
              borderRadius: '8px',
              marginBottom: '24px'
            }}
          >
            <p style={{ margin: 0, fontSize: '12px', color: '#6B6760', lineHeight: '1.5' }}>
              <strong>Tip:</strong> You can add links to YouTube videos, Google Docs, PDFs, websites, or any other online resource that supports your lesson.
            </p>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              type="button"
              onClick={handleClose}
              style={{
                flex: 1,
                padding: '10px 16px',
                backgroundColor: '#f3f4f6',
                color: '#2C2A26',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#e5e7eb';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = '#f3f4f6';
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                flex: 1,
                padding: '10px 16px',
                backgroundColor: '#D4C4A8',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#B8A888';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = '#D4C4A8';
              }}
            >
              <Plus size={16} />
              Add {getResourceTypeLabel()}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddResourceModal;