// src/components/modals/TopicDetailsModal.jsx
import { useState } from 'react';
import { X, Check, Trash2, Plus, Sparkles, ExternalLink } from 'lucide-react';
import AddResourceModal from './AddResourceModal';

const TopicDetailsModal = ({
  topic,
  sectionId,
  subsectionId,
  onClose,
  onSave,
  actions,
  videosByTopic,
  handsOnResources,
  readOnly,
  currentUser
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTopic, setEditedTopic] = useState({
    title: topic.title,
    description: topic.description || '',
    duration_minutes: topic.duration_minutes || 20,
    learning_objectives: [...(topic.learning_objectives || [])],
    content_keywords: [...(topic.content_keywords || [])],
    pla_pillars: [...(topic.pla_pillars || [])]
  });

  const [resourceModal, setResourceModal] = useState(null);
  const [newObjective, setNewObjective] = useState('');

  const videos = videosByTopic?.[topic.id] || [];
  const allResources = handsOnResources?.[topic.id] || [];
  const worksheets = allResources.filter(r => r.type === 'worksheet');
  const activities = allResources.filter(r => r.type === 'activity');

  const colors = {
    bg: '#FAF9F6',
    card: '#FFFFFF',
    accent: '#D4C4A8',
    accentLight: '#F5F3EE',
    textPrimary: '#2C2A26',
    textSecondary: '#6B6760',
    border: '#E8E6E1',
    dangerBtn: '#E57373',
    pla: {
      'Personal Growth': '#E8A5A5',
      'Core Learning': '#A5C9E8',
      'Critical Thinking': '#B8E8A5',
      'Application & Impact': '#E8D5A5'
    },
    stripe: {
      content:   '#6B8FE8',
      worksheet: '#E8A55C',
      activity:  '#5CC97C'
    }
  };

  const handleSave = () => {
    onSave({ sectionId, subsectionId, topicId: topic.id, updatedData: editedTopic });
    setIsEditing(false);
  };

  const handleClose = () => {
    if (!readOnly) {
      onSave({ sectionId, subsectionId, topicId: topic.id, updatedData: editedTopic });
    }
    onClose();
  };

  const handleAddObjective = () => {
    if (newObjective.trim()) {
      setEditedTopic({ ...editedTopic, learning_objectives: [...editedTopic.learning_objectives, newObjective.trim()] });
      setNewObjective('');
    }
  };

  const handleRemoveObjective = (index) => {
    setEditedTopic({ ...editedTopic, learning_objectives: editedTopic.learning_objectives.filter((_, i) => i !== index) });
  };

  const handleUpdateObjective = (index, value) => {
    const updated = [...editedTopic.learning_objectives];
    updated[index] = value;
    setEditedTopic({ ...editedTopic, learning_objectives: updated });
  };

  const handleResourceModalSubmit = (resourceData) => {
    if (resourceModal?.mode === 'edit') {
      if (actions?.updateResource) {
        actions.updateResource(topic.id, resourceModal.type, resourceModal.index, resourceData);
      }
    } else {
      if (actions?.addManualResource) {
        actions.addManualResource(topic.id, resourceData.type, resourceData);
      }
    }
    setResourceModal(null);
  };

  const handleDeleteResource = (resourceType, index) => {
    if (actions?.removeResource) {
      actions.removeResource(topic.id, resourceType, index);
    }
  };

  const handleGenerateVideos = () => {
    if (actions?.generateVideosFromBackend) actions.generateVideosFromBackend(topic);
  };

  const handleGenerateResource = (type) => {
    if (actions?.generateResource) actions.generateResource(topic.id, type);
  };

  /* ── Small reusable components ── */

  const Pill = ({ label, color }) => (
    <span style={{
      display: 'inline-block',
      padding: '5px 12px',
      borderRadius: '12px',
      fontSize: '13.2px',
      fontWeight: '500',
      backgroundColor: color?.bg || colors.accentLight,
      color: color?.text || colors.textSecondary
    }}>
      {label}
    </span>
  );

  const Spinner = () => (
    <div style={{
      width: '12px', height: '12px',
      border: '2px solid rgba(255,255,255,0.4)',
      borderTopColor: '#fff',
      borderRadius: '50%',
      animation: 'tdm-spin 0.7s linear infinite',
      flexShrink: 0
    }} />
  );

  /* ── Block card for content / worksheet / activity ── */
  const BlockCard = ({ item, actualIdx, resourceType, stripeColor }) => {
    const notes = item.notes || item.description || '';
    const url   = item.url || item.sourceUrl || '';

    const initialDataForEdit = {
      title: item.title,
      notes,
      url
    };

    return (
      <div style={{
        borderRadius: '12px',
        border: `1.5px solid ${colors.border}`,
        borderLeft: `4px solid ${stripeColor}`,
        marginBottom: '10px',
        overflow: 'hidden',
        backgroundColor: '#fff'
      }}>
        <div style={{ padding: '16px 16px 14px' }}>
          {/* Top row: title + edit/delete */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
            <p style={{ margin: 0, fontSize: '15.4px', fontWeight: '700', color: colors.textPrimary, flex: 1 }}>
              {item.title}
            </p>
            {!readOnly && (
              <div style={{ display: 'flex', gap: '4px', marginLeft: '12px', flexShrink: 0 }}>
                <button
                  onClick={() => setResourceModal({ type: resourceType, mode: 'edit', index: actualIdx, initialData: initialDataForEdit })}
                  style={{ padding: '3px 9px', backgroundColor: '#fff', color: colors.textSecondary, border: `1px solid ${colors.border}`, borderRadius: '5px', cursor: 'pointer', fontSize: '12.1px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '3px', fontFamily: "inherit" }}
                >
                  ✏️ Edit
                </button>
                <button
                  onClick={() => handleDeleteResource(resourceType, actualIdx)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', color: colors.dangerBtn }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            )}
          </div>

          {/* Teaching notes */}
          {notes && (
            <p style={{ margin: '0 0 10px', fontSize: '14.3px', color: '#4B4945', lineHeight: '1.65', whiteSpace: 'pre-wrap' }}>
              {notes}
            </p>
          )}

          {/* Optional link row */}
          {url && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 11px',
              backgroundColor: colors.accentLight,
              borderRadius: '7px'
            }}>
              <span style={{ fontSize: '13px', flexShrink: 0 }}>🔗</span>
              <span style={{ fontSize: '11.5px', color: '#9ca3af', flexShrink: 0 }}>Reference:</span>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: '13px', fontWeight: '600', color: colors.accent, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
              >
                {url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}… <ExternalLink size={11} />
              </a>
            </div>
          )}
        </div>
      </div>
    );
  };

  /* ── YouTube video card (legacy / AI-generated content) ── */
  const VideoCard = ({ video, idx }) => (
    <div style={{
      borderRadius: '12px',
      border: `1.5px solid ${colors.border}`,
      borderLeft: `4px solid ${colors.stripe.content}`,
      marginBottom: '10px',
      overflow: 'hidden',
      backgroundColor: '#fff'
    }}>
      <div style={{ padding: '14px 16px', display: 'flex', gap: '14px', alignItems: 'flex-start', position: 'relative' }}>
        {!readOnly && (
          <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '4px' }}>
            <button
              onClick={() => setResourceModal({ type: 'video', mode: 'edit', index: idx, initialData: { title: video.title, url: video.url || `https://www.youtube.com/watch?v=${video.videoId}`, notes: video.notes || '' } })}
              style={{ padding: '3px 8px', backgroundColor: '#fff', color: colors.textSecondary, border: `1px solid ${colors.border}`, borderRadius: '5px', cursor: 'pointer', fontSize: '12.1px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '3px', fontFamily: 'inherit' }}
            >
              ✏️ Edit
            </button>
            <button
              onClick={() => handleDeleteResource('video', idx)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', color: colors.dangerBtn }}
            >
              <Trash2 size={15} />
            </button>
          </div>
        )}
        {video.thumbnailUrl && (
          <img src={video.thumbnailUrl} alt={video.title} style={{ width: '110px', height: '82px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0 }} />
        )}
        <div style={{ flex: 1, minWidth: 0, paddingRight: !readOnly ? '80px' : 0 }}>
          <p style={{ margin: '0 0 4px', fontSize: '15.4px', fontWeight: '700', color: colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {video.title}
          </p>
          {video.channelName && (
            <p style={{ margin: '0 0 6px', fontSize: '13.2px', color: colors.textSecondary }}>
              {video.channelName}{video.duration ? ` · ${video.duration}` : ''}
            </p>
          )}
          {video.notes && (
            <p style={{ margin: '0 0 8px', fontSize: '13.5px', color: '#4B4945', lineHeight: '1.55' }}>{video.notes}</p>
          )}
          <a
            href={video.url || `https://www.youtube.com/watch?v=${video.videoId}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: '13.2px', color: colors.accent, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px', fontWeight: '600' }}
          >
            Open <ExternalLink size={11} />
          </a>
        </div>
      </div>
    </div>
  );

  /* ── Section header ── */
  const SectionHeader = ({ icon, title, subtitle, onAdd, onGenerate, isGenerating }) => (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <div style={{
          width: '30px', height: '30px', borderRadius: '8px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '15px', flexShrink: 0,
          backgroundColor: title === 'CONTENT' ? '#EAF0FF' : title === 'WORKSHEET' ? '#FFF3E8' : '#EDFFF3'
        }}>
          {icon}
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '12.1px', color: colors.textSecondary, fontWeight: '700', letterSpacing: '0.5px' }}>
            {title}
          </label>
          <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af', fontStyle: 'italic', marginTop: '2px' }}>{subtitle}</p>
        </div>
      </div>
      {!readOnly && (
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          <button
            onClick={onAdd}
            style={{ padding: '6px 12px', backgroundColor: 'transparent', color: colors.accent, border: `1px solid ${colors.border}`, borderRadius: '6px', cursor: 'pointer', fontSize: '13.2px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'inherit' }}
          >
            <Plus size={14} /> Add block
          </button>
          <button
            onClick={onGenerate}
            disabled={isGenerating}
            style={{ padding: '6px 12px', backgroundColor: colors.accent, color: '#fff', border: 'none', borderRadius: '6px', cursor: isGenerating ? 'not-allowed' : 'pointer', fontSize: '13.2px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px', opacity: isGenerating ? 0.7 : 1, fontFamily: 'inherit' }}
          >
            {isGenerating ? <Spinner /> : <Sparkles size={14} />}
            {isGenerating ? 'Generating…' : 'AI'}
          </button>
        </div>
      )}
    </div>
  );

  /* ── Empty state ── */
  const EmptyState = ({ message }) => (
    <div style={{ padding: '22px', textAlign: 'center', backgroundColor: colors.accentLight, borderRadius: '10px', border: `1.5px dashed ${colors.border}` }}>
      <p style={{ margin: 0, fontSize: '14.3px', color: colors.textSecondary, fontStyle: 'italic' }}>{message}</p>
    </div>
  );

  /* ── Add another block button ── */
  const AddBlockButton = ({ label, onClick }) => !readOnly ? (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '10px 14px',
        border: `1.5px dashed ${colors.border}`,
        borderRadius: '10px',
        cursor: 'pointer',
        fontSize: '13.5px',
        color: '#9ca3af',
        fontWeight: '600',
        backgroundColor: 'transparent',
        fontFamily: 'inherit',
        width: '100%',
        marginTop: '4px'
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = colors.accent; e.currentTarget.style.backgroundColor = colors.accentLight; e.currentTarget.style.color = colors.textSecondary; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = colors.border; e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#9ca3af'; }}
    >
      <Plus size={15} /> {label}
    </button>
  ) : null;

  const hasContent = videos.length > 0;

  return (
    <>
      <style>{`@keyframes tdm-spin { to { transform: rotate(360deg); } }`}</style>
      <div
        style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}
        onClick={handleClose}
      >
        <div
          style={{ backgroundColor: 'white', borderRadius: '16px', padding: '32px', maxWidth: '900px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Header ── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <label style={{ fontSize: '12.1px', color: colors.textSecondary, fontWeight: '700', letterSpacing: '0.5px' }}>TOPIC TITLE</label>
                {!readOnly && (
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', color: colors.accent }}
                    title={isEditing ? 'Done editing' : 'Edit topic'}
                  >
                    {isEditing ? <Check size={16} /> : '✏️'}
                  </button>
                )}
              </div>
              {isEditing ? (
                <input
                  type="text"
                  value={editedTopic.title}
                  onChange={(e) => setEditedTopic({ ...editedTopic, title: e.target.value })}
                  style={{ fontSize: '28.6px', fontWeight: '700', color: colors.textPrimary, border: '2px solid #000', background: '#fff', padding: '10px 14px', borderRadius: '8px', width: '100%', outline: 'none' }}
                />
              ) : (
                <h2 style={{ margin: 0, fontSize: '28.6px', fontWeight: '700', color: colors.textPrimary }}>{editedTopic.title}</h2>
              )}
            </div>
            <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', marginLeft: '16px', display: 'flex', alignItems: 'center' }}>
              <X size={28} style={{ color: colors.textSecondary }} />
            </button>
          </div>

          {/* ── Description ── */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '12.1px', color: colors.textSecondary, marginBottom: '8px', fontWeight: '700', letterSpacing: '0.5px' }}>DESCRIPTION</label>
            {isEditing ? (
              <textarea
                value={editedTopic.description}
                onChange={(e) => setEditedTopic({ ...editedTopic, description: e.target.value })}
                style={{ width: '100%', minHeight: '100px', padding: '12px 16px', border: '2px solid #000', borderRadius: '8px', fontSize: '15.4px', color: colors.textPrimary, resize: 'vertical', outline: 'none', fontFamily: 'inherit', lineHeight: '1.6' }}
                placeholder="Add a description..."
              />
            ) : (
              <p style={{ margin: 0, fontSize: '15.4px', color: colors.textSecondary, lineHeight: '1.6', fontStyle: editedTopic.description ? 'normal' : 'italic' }}>
                {editedTopic.description || 'No description yet'}
              </p>
            )}
          </div>

          {/* ── Meta row ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '20px', marginBottom: '28px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12.1px', color: colors.textSecondary, marginBottom: '8px', fontWeight: '700', letterSpacing: '0.5px' }}>DURATION</label>
              {isEditing ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="number"
                    value={editedTopic.duration_minutes}
                    onChange={(e) => setEditedTopic({ ...editedTopic, duration_minutes: parseInt(e.target.value) || 0 })}
                    min="0"
                    style={{ width: '70px', padding: '8px 12px', border: '2px solid #000', borderRadius: '6px', fontSize: '15.4px', outline: 'none' }}
                  />
                  <span style={{ fontSize: '15.4px', color: colors.textSecondary }}>min</span>
                </div>
              ) : (
                <Pill label={`${editedTopic.duration_minutes} min`} />
              )}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12.1px', color: colors.textSecondary, marginBottom: '8px', fontWeight: '700', letterSpacing: '0.5px' }}>PLA PILLARS</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {editedTopic.pla_pillars.length > 0 ? (
                  editedTopic.pla_pillars.map((pillar, idx) => (
                    <Pill key={idx} label={pillar} color={{ bg: colors.pla[pillar] || colors.accentLight, text: colors.textPrimary }} />
                  ))
                ) : (
                  <span style={{ fontSize: '14.3px', color: '#9ca3af', fontStyle: 'italic' }}>No pillars assigned</span>
                )}
              </div>
            </div>
          </div>

          {/* ── Learning Objectives ── */}
          <div style={{ marginBottom: '28px' }}>
            <label style={{ display: 'block', fontSize: '12.1px', color: colors.textSecondary, marginBottom: '12px', fontWeight: '700', letterSpacing: '0.5px' }}>LEARNING OBJECTIVES</label>
            {editedTopic.learning_objectives.length > 0 ? (
              <ul style={{ margin: '0 0 12px', paddingLeft: '24px', listStyle: 'disc' }}>
                {editedTopic.learning_objectives.map((obj, idx) => (
                  <li key={idx} style={{ marginBottom: '10px', color: colors.textPrimary, fontSize: '15.4px', lineHeight: '1.5' }}>
                    {isEditing ? (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input
                          type="text"
                          value={obj}
                          onChange={(e) => handleUpdateObjective(idx, e.target.value)}
                          style={{ flex: 1, padding: '8px 12px', border: `1px solid ${colors.border}`, borderRadius: '6px', fontSize: '14.3px', outline: 'none' }}
                        />
                        <button
                          onClick={() => handleRemoveObjective(idx)}
                          style={{ padding: '6px', background: 'none', border: 'none', cursor: 'pointer', color: colors.dangerBtn, display: 'flex', alignItems: 'center' }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ) : obj}
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ margin: '0 0 12px', fontSize: '14.3px', color: '#9ca3af', fontStyle: 'italic' }}>No learning objectives yet</p>
            )}
            {isEditing && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={newObjective}
                  onChange={(e) => setNewObjective(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddObjective()}
                  placeholder="Add a new learning objective..."
                  style={{ flex: 1, padding: '8px 12px', border: `1px solid ${colors.border}`, borderRadius: '6px', fontSize: '14.3px', outline: 'none' }}
                />
                <button
                  onClick={handleAddObjective}
                  style={{ padding: '8px 14px', backgroundColor: colors.accentLight, color: colors.textSecondary, border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14.3px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'inherit' }}
                >
                  <Plus size={14} /> Add
                </button>
              </div>
            )}
          </div>

          <div style={{ height: '1px', backgroundColor: colors.border, marginBottom: '28px' }} />

          {/* ════════════════ CONTENT ════════════════ */}
          <div style={{ marginBottom: '32px' }}>
            <SectionHeader
              icon="📹"
              title="CONTENT"
              subtitle="How to deliver the content — teaching approach, videos, readings, demonstrations"
              generatingKey={`videos-${topic.id}`}
              onAdd={() => setResourceModal({ type: 'video', mode: 'add' })}
              onGenerate={handleGenerateVideos}
              isGenerating={!!actions?.generatingStates?.[`videos-${topic.id}`]}
            />

            {/* YouTube / AI-generated video cards */}
            {videos.map((video, idx) => (
              <VideoCard key={idx} video={video} idx={idx} />
            ))}

            {/* Manually added content blocks */}
            {allResources.filter(r => r.type === 'video').map((item) => {
              const actualIdx = allResources.indexOf(item);
              return (
                <BlockCard
                  key={actualIdx}
                  item={item}
                  actualIdx={actualIdx}
                  resourceType="video"
                  stripeColor={colors.stripe.content}
                />
              );
            })}

            {!hasContent && allResources.filter(r => r.type === 'video').length === 0 && (
              <EmptyState message="No content blocks yet. Describe how to teach this topic, or add a reference." />
            )}

            <AddBlockButton
              label="Add another content block"
              onClick={() => setResourceModal({ type: 'video', mode: 'add' })}
            />
          </div>

          {/* ════════════════ WORKSHEET ════════════════ */}
          <div style={{ marginBottom: '32px' }}>
            <SectionHeader
              icon="📄"
              title="WORKSHEET"
              subtitle="What to include, how to structure it, differentiation ideas, and any reference materials"
              onAdd={() => setResourceModal({ type: 'worksheet', mode: 'add' })}
              onGenerate={() => handleGenerateResource('worksheet')}
              isGenerating={!!actions?.generatingStates?.[`worksheet-${topic.id}`]}
            />

            {worksheets.length === 0 ? (
              <EmptyState message="No worksheet blocks yet. Describe what to include and how to structure it." />
            ) : (
              worksheets.map((ws) => {
                const actualIdx = allResources.indexOf(ws);
                return (
                  <BlockCard
                    key={actualIdx}
                    item={ws}
                    actualIdx={actualIdx}
                    resourceType="worksheet"
                    stripeColor={colors.stripe.worksheet}
                  />
                );
              })
            )}

            <AddBlockButton
              label="Add another worksheet block"
              onClick={() => setResourceModal({ type: 'worksheet', mode: 'add' })}
            />
          </div>

          {/* ════════════════ ACTIVITY ════════════════ */}
          <div style={{ marginBottom: '32px' }}>
            <SectionHeader
              icon="🎯"
              title="ACTIVITY"
              subtitle="How to run it — setup, grouping, step-by-step facilitation, timing, debrief prompts"
              onAdd={() => setResourceModal({ type: 'activity', mode: 'add' })}
              onGenerate={() => handleGenerateResource('activity')}
              isGenerating={!!actions?.generatingStates?.[`activity-${topic.id}`]}
            />

            {activities.length === 0 ? (
              <EmptyState message="No activity blocks yet. Describe how to run a hands-on task or group activity." />
            ) : (
              activities.map((act) => {
                const actualIdx = allResources.indexOf(act);
                return (
                  <BlockCard
                    key={actualIdx}
                    item={act}
                    actualIdx={actualIdx}
                    resourceType="activity"
                    stripeColor={colors.stripe.activity}
                  />
                );
              })
            )}

            <AddBlockButton
              label="Add another activity block"
              onClick={() => setResourceModal({ type: 'activity', mode: 'add' })}
            />
          </div>

          {/* ── Footer ── */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '20px', borderTop: `1px solid ${colors.border}` }}>
            <button
              onClick={handleClose}
              style={{ padding: '10px 24px', backgroundColor: '#f3f4f6', color: colors.textPrimary, border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '15.4px', fontWeight: '600', fontFamily: 'inherit' }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#e5e7eb'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#f3f4f6'}
            >
              Close
            </button>
            {isEditing && (
              <button
                onClick={handleSave}
                style={{ padding: '10px 24px', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '15.4px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'inherit' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#15803d'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#16a34a'}
              >
                <Check size={16} /> Save Changes
              </button>
            )}
          </div>
        </div>
      </div>

      <AddResourceModal
        isOpen={resourceModal !== null}
        onClose={() => setResourceModal(null)}
        onAdd={handleResourceModalSubmit}
        resourceType={resourceModal?.type || 'video'}
        mode={resourceModal?.mode || 'add'}
        initialData={resourceModal?.initialData || null}
        currentUser={currentUser}
      />
    </>
  );
};

export default TopicDetailsModal;
