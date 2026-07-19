// src/components/courses/CourseInfoPanel.jsx
import { useState, useRef } from 'react';
import {
  X, FileText, FileSpreadsheet, Image as ImageIcon, Presentation,
  Paperclip, Trash2, ChevronDown, ChevronUp, Eye, EyeOff,
} from 'lucide-react';
import {
  uploadCourseAttachment,
  updateCourseAttachment,
  deleteCourseAttachment,
  updateCourseInfoNotes,
} from '../../utils/curriculumApi';

const FILE_TYPE_META = {
  pdf:  { icon: FileText,        color: '#e53e3e', label: 'PDF' },
  doc:  { icon: FileText,        color: '#2b6cb0', label: 'Word' },
  docx: { icon: FileText,        color: '#2b6cb0', label: 'Word' },
  xls:  { icon: FileSpreadsheet, color: '#276749', label: 'Excel' },
  xlsx: { icon: FileSpreadsheet, color: '#276749', label: 'Excel' },
  ppt:  { icon: Presentation,    color: '#c05621', label: 'PPT' },
  pptx: { icon: Presentation,    color: '#c05621', label: 'PPT' },
  jpg:  { icon: ImageIcon,       color: '#805ad5', label: 'Image' },
  jpeg: { icon: ImageIcon,       color: '#805ad5', label: 'Image' },
  png:  { icon: ImageIcon,       color: '#805ad5', label: 'Image' },
  gif:  { icon: ImageIcon,       color: '#805ad5', label: 'Image' },
  webp: { icon: ImageIcon,       color: '#805ad5', label: 'Image' },
};

const ACCEPTED_EXTENSIONS = Object.keys(FILE_TYPE_META);
const ACCEPT_ATTR = ACCEPTED_EXTENSIONS.map(e => `.${e}`).join(',');

const DetailRow = ({ label, value }) => {
  if (!value && value !== 0) return null;
  return (
    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
      <span style={{ fontSize: '12px', color: '#718096', minWidth: '110px', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: '12px', color: '#2d3748', fontWeight: '500', wordBreak: 'break-word' }}>{value}</span>
    </div>
  );
};

const CourseInfoPanel = ({
  curriculumId,
  formData,
  courseAttachments: initialAttachments = [],
  courseInfoNotes: initialNotes = '',
  currentUser,
  onClose,
  onAttachmentsChange,
  readOnly = false,
}) => {
  const [attachments, setAttachments] = useState(initialAttachments);
  const [notes, setNotes] = useState(initialNotes);
  const [notesDirty, setNotesDirty] = useState(false);
  const [notesSaving, setNotesSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadDesc, setUploadDesc] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [expandedDescs, setExpandedDescs] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(null);
  const fileInputRef = useRef(null);

  const teacherUid = currentUser?.uid;

  const syncAttachments = (updated) => {
    setAttachments(updated);
    onAttachmentsChange?.(updated);
  };

  // ── Notes ──────────────────────────────────────────────────────────────
  const handleNotesSave = async () => {
    if (!curriculumId || readOnly) return;
    setNotesSaving(true);
    try {
      await updateCourseInfoNotes(curriculumId, notes, teacherUid);
      setNotesDirty(false);
    } catch (e) {
      console.error('Notes save failed', e);
    } finally {
      setNotesSaving(false);
    }
  };

  // ── Upload ─────────────────────────────────────────────────────────────
  const handleUpload = async (file) => {
    if (!curriculumId || readOnly) return;
    setUploading(true);
    try {
      const result = await uploadCourseAttachment(curriculumId, file, uploadDesc, teacherUid);
      if (result.success) {
        const updated = [...attachments, result.attachment];
        syncAttachments(updated);
        setUploadDesc('');
      }
    } catch (e) {
      console.error('Upload failed', e);
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = Array.from(e.dataTransfer.files).find(f => {
      const ext = f.name.split('.').pop().toLowerCase();
      return ACCEPTED_EXTENSIONS.includes(ext);
    });
    if (file) handleUpload(file);
  };

  // ── Attachment CRUD ────────────────────────────────────────────────────
  const handleToggleActive = async (att) => {
    if (readOnly) return;
    const newVal = !att.isActive;
    try {
      await updateCourseAttachment(curriculumId, att.id, { isActive: newVal }, teacherUid);
      syncAttachments(attachments.map(a => a.id === att.id ? { ...a, isActive: newVal } : a));
    } catch (e) {
      console.error('Toggle failed', e);
    }
  };

  const handleDescriptionBlur = async (att, newDesc) => {
    if (readOnly || newDesc === att.description) return;
    try {
      await updateCourseAttachment(curriculumId, att.id, { description: newDesc }, teacherUid);
      syncAttachments(attachments.map(a => a.id === att.id ? { ...a, description: newDesc } : a));
    } catch (e) {
      console.error('Description update failed', e);
    }
  };

  const handleDelete = async (attId) => {
    if (readOnly) return;
    try {
      await deleteCourseAttachment(curriculumId, attId, teacherUid);
      syncAttachments(attachments.filter(a => a.id !== attId));
      setConfirmDelete(null);
    } catch (e) {
      console.error('Delete failed', e);
    }
  };

  const toggleDescExpanded = (id) => {
    setExpandedDescs(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // ── Course param display ───────────────────────────────────────────────
  const ageRange = formData?.ageRangeStart && formData?.ageRangeEnd
    ? `${formData.ageRangeStart}–${formData.ageRangeEnd} years old`
    : formData?.ageRangeStart ? `${formData.ageRangeStart}+ years old` : null;

  const duration = formData?.numDays && formData?.hoursPerDay
    ? `${formData.numDays} day${Number(formData.numDays) !== 1 ? 's' : ''} × ${formData.hoursPerDay}h`
    : null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.18)',
          zIndex: 1000,
        }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: '400px',
        background: '#fff',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
        zIndex: 1001,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'DM Sans', sans-serif",
      }}>

        {/* Header */}
        <div style={{
          padding: '18px 20px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#1a202c' }}>
              Course Info
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#718096' }}>
              Project context used by Edo in every conversation
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#718096' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

          {/* ── Course Details ── */}
          <section style={{ marginBottom: '24px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '12px', fontWeight: '700', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Course Details
            </h3>
            <div style={{ background: '#f7fafc', borderRadius: '10px', padding: '14px 16px' }}>
              <DetailRow label="Course name" value={formData?.courseName} />
              <DetailRow label="Age range" value={ageRange} />
              <DetailRow label="Students" value={formData?.numStudents} />
              <DetailRow label="Duration" value={duration} />
              <DetailRow label="Worksheets" value={formData?.numWorksheets} />
              <DetailRow label="Activities" value={formData?.numActivities} />
            </div>

            {/* Objectives */}
            {formData?.objectives && (
              <div style={{ marginTop: '12px' }}>
                <p style={{ margin: '0 0 6px', fontSize: '12px', fontWeight: '600', color: '#4a5568' }}>Objectives / Notes</p>
                <p style={{
                  margin: 0, fontSize: '12px', color: '#2d3748',
                  background: '#f7fafc', borderRadius: '8px', padding: '10px 12px',
                  lineHeight: '1.6', whiteSpace: 'pre-wrap',
                }}>
                  {formData.objectives}
                </p>
              </div>
            )}
          </section>

          {/* ── Project Notes ── */}
          <section style={{ marginBottom: '24px' }}>
            <h3 style={{ margin: '0 0 6px', fontSize: '12px', fontWeight: '700', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Project Notes
            </h3>
            <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#718096' }}>
              Anything Edo should always keep in mind — teaching philosophy, constraints, school context.
            </p>
            <textarea
              value={notes}
              onChange={e => { setNotes(e.target.value); setNotesDirty(true); }}
              onBlur={handleNotesSave}
              disabled={readOnly}
              placeholder="e.g. 'This course is for a mixed-ability class. Keep explanations simple and hands-on.'"
              rows={4}
              style={{
                width: '100%', padding: '10px 12px', fontSize: '12px',
                border: '1px solid #e2e8f0', borderRadius: '8px',
                background: readOnly ? '#f7fafc' : '#fff',
                resize: 'vertical', lineHeight: '1.6', boxSizing: 'border-box',
                outline: 'none', fontFamily: "'DM Sans', sans-serif",
                color: '#2d3748',
              }}
            />
            {notesDirty && !readOnly && (
              <button
                onClick={handleNotesSave}
                disabled={notesSaving}
                style={{
                  marginTop: '6px', padding: '5px 14px', fontSize: '12px', fontWeight: '600',
                  border: 'none', borderRadius: '6px', cursor: 'pointer',
                  background: '#2C5F3A', color: '#fff',
                }}
              >
                {notesSaving ? 'Saving…' : 'Save notes'}
              </button>
            )}
          </section>

          {/* ── Attached Materials ── */}
          <section>
            <h3 style={{ margin: '0 0 6px', fontSize: '12px', fontWeight: '700', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Attached Materials
            </h3>
            <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#718096' }}>
              Files used as background context for Edo. Toggle the eye icon to include/exclude from conversations.
            </p>

            {/* File list */}
            {attachments.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                {attachments.map(att => {
                  const ext = att.fileType || 'pdf';
                  const meta = FILE_TYPE_META[ext] || FILE_TYPE_META['pdf'];
                  const Icon = meta.icon;
                  const isExpanded = expandedDescs[att.id];
                  const charCount = att.characterCount || att.extractedText?.length || 0;

                  return (
                    <div
                      key={att.id}
                      style={{
                        background: att.isActive ? '#fff' : '#f7fafc',
                        border: `1px solid ${att.isActive ? '#e2e8f0' : '#edf2f7'}`,
                        borderRadius: '8px',
                        opacity: att.isActive ? 1 : 0.65,
                      }}
                    >
                      {/* Top row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px' }}>
                        <div style={{
                          width: '32px', height: '32px', borderRadius: '6px',
                          background: `${meta.color}18`, display: 'flex',
                          alignItems: 'center', justifyContent: 'center', flexShrink: 0
                        }}>
                          <Icon size={16} color={meta.color} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: '12px', fontWeight: '600', color: '#2d3748', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {att.filename}
                          </p>
                          <p style={{ margin: 0, fontSize: '11px', color: '#a0aec0' }}>
                            {meta.label} {charCount > 0 ? `· ${(charCount / 1000).toFixed(1)}k chars` : ''}
                          </p>
                        </div>

                        {/* Toggle include in Edo */}
                        {!readOnly && (
                          <button
                            onClick={() => handleToggleActive(att)}
                            title={att.isActive ? 'Exclude from Edo context' : 'Include in Edo context'}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                              color: att.isActive ? '#2C5F3A' : '#a0aec0', flexShrink: 0,
                            }}
                          >
                            {att.isActive ? <Eye size={15} /> : <EyeOff size={15} />}
                          </button>
                        )}

                        {/* Expand description */}
                        <button
                          onClick={() => toggleDescExpanded(att.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#a0aec0', flexShrink: 0 }}
                          title="Add/edit description"
                        >
                          {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        </button>

                        {/* Delete */}
                        {!readOnly && (
                          <button
                            onClick={() => setConfirmDelete(att.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#fc8181', flexShrink: 0 }}
                            title="Remove attachment"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>

                      {/* Expanded description */}
                      {isExpanded && (
                        <div style={{ padding: '0 12px 10px' }}>
                          <input
                            type="text"
                            defaultValue={att.description || ''}
                            onBlur={e => handleDescriptionBlur(att, e.target.value)}
                            disabled={readOnly}
                            placeholder="What does this file contain? (helps Edo understand it)"
                            style={{
                              width: '100%', padding: '7px 10px', fontSize: '12px',
                              border: '1px solid #e2e8f0', borderRadius: '6px',
                              background: readOnly ? '#f7fafc' : '#fff', outline: 'none',
                              boxSizing: 'border-box', color: '#4a5568',
                              fontFamily: "'DM Sans', sans-serif",
                            }}
                          />
                        </div>
                      )}

                      {/* Confirm delete */}
                      {confirmDelete === att.id && (
                        <div style={{ padding: '8px 12px', background: '#fff5f5', borderTop: '1px solid #fed7d7', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                          <span style={{ fontSize: '12px', color: '#c53030' }}>Remove this attachment?</span>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              onClick={() => setConfirmDelete(null)}
                              style={{ padding: '4px 10px', fontSize: '12px', borderRadius: '5px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', color: '#4a5568' }}
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleDelete(att.id)}
                              style={{ padding: '4px 10px', fontSize: '12px', borderRadius: '5px', border: 'none', background: '#fc8181', color: '#fff', cursor: 'pointer', fontWeight: '600' }}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add more files */}
            {!readOnly && (
              <>
                <input
                  type="text"
                  value={uploadDesc}
                  onChange={e => setUploadDesc(e.target.value)}
                  placeholder="Note about the next file you add (optional)"
                  style={{
                    width: '100%', padding: '8px 10px', fontSize: '12px',
                    border: '1px solid #e2e8f0', borderRadius: '7px',
                    background: '#fff', outline: 'none', boxSizing: 'border-box',
                    marginBottom: '8px', color: '#4a5568',
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                />
                <div
                  onClick={() => !uploading && fileInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  style={{
                    border: `2px dashed ${dragOver ? '#667eea' : '#cbd5e0'}`,
                    borderRadius: '8px', padding: '16px',
                    textAlign: 'center', cursor: uploading ? 'not-allowed' : 'pointer',
                    background: dragOver ? '#f0f0ff' : '#f7fafc',
                    transition: 'all 0.15s',
                  }}
                >
                  <Paperclip size={18} style={{ color: '#a0aec0', marginBottom: '6px' }} />
                  <p style={{ margin: '0 0 2px', color: '#4a5568', fontSize: '13px', fontWeight: '500' }}>
                    {uploading ? 'Uploading…' : 'Drop a file or click to browse'}
                  </p>
                  <p style={{ margin: 0, color: '#a0aec0', fontSize: '11px' }}>
                    PDF, Word, Excel, PowerPoint, Images
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPT_ATTR}
                    style={{ display: 'none' }}
                    onChange={handleFileSelect}
                    disabled={uploading}
                  />
                </div>
              </>
            )}

            {attachments.length === 0 && readOnly && (
              <p style={{ margin: 0, fontSize: '12px', color: '#a0aec0', fontStyle: 'italic' }}>
                No attachments added to this course.
              </p>
            )}
          </section>
        </div>
      </div>
    </>
  );
};

export default CourseInfoPanel;
