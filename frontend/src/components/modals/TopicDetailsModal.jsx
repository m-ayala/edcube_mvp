// src/components/modals/TopicDetailsModal.jsx
import { useState } from 'react';
import { Check, Trash2, Plus, ExternalLink } from 'lucide-react';
import AddResourceModal from './AddResourceModal';

const TopicDetailsModal = ({
  topic,
  sectionId,
  subsectionId,
  // Page mode props
  onBack,
  onNavigateToBlock,
  sectionTitle,
  subsectionTitle,
  sectionNumber,
  subsectionNumber,
  topicNumber,
  trayBlocks,
  onAddBlockFromTray,
  // Kept for backward compat
  onClose,
  onSave,
  actions,
  videosByTopic,
  handsOnResources,
  readOnly,
  currentUser,
  accentColor = '#ACD8F0',
  accentDeepColor = '#2A6A8A',
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
  // 'content' is the new type; 'video' is legacy — both show in CONTENT section
  const contentBlocks = allResources.filter(r => r.type === 'content' || r.type === 'video');
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
    if (actions?.updateTopicBoxFull) {
      actions.updateTopicBoxFull({ sectionId, subsectionId, topicId: topic.id, updatedData: editedTopic });
    } else {
      onSave?.({ sectionId, subsectionId, topicId: topic.id, updatedData: editedTopic });
    }
    setIsEditing(false);
  };

  const handleClose = () => {
    if (!readOnly) handleSave();
    (onBack || onClose)?.();
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


  /* ── Structured text renderer — parses **Header** sections ── */
  const renderStructuredText = (text) => {
    if (!text) return null;
    // Check if text uses the structured **Header** format
    if (!text.includes('**')) {
      // Plain text: render with bullet support
      return text.split('\n').map((line, i) => {
        const t = line.trim();
        if (!t) return null;
        if (t.startsWith('- ') || t.startsWith('• ')) {
          return <li key={i} style={{ marginBottom: '3px', color: '#4B4945', fontSize: '14.3px' }}>{t.replace(/^[-•]\s*/, '')}</li>;
        }
        return <span key={i} style={{ display: 'block', marginBottom: '4px', fontSize: '14.3px', color: '#4B4945', lineHeight: '1.65' }}>{t}</span>;
      });
    }

    // Structured format: split on **Header** lines
    const sections = [];
    let currentHeader = null;
    let currentLines = [];

    for (const rawLine of text.split('\n')) {
      const headerMatch = rawLine.trim().match(/^\*\*(.+?)\*\*\s*:?\s*$/);
      if (headerMatch) {
        if (currentHeader !== null || currentLines.length > 0) {
          sections.push({ header: currentHeader, lines: currentLines });
        }
        currentHeader = headerMatch[1].trim();
        currentLines = [];
      } else {
        if (rawLine.trim()) currentLines.push(rawLine.trim());
      }
    }
    if (currentHeader !== null || currentLines.length > 0) {
      sections.push({ header: currentHeader, lines: currentLines });
    }

    return sections.map((sec, si) => (
      <div key={si} style={{ marginBottom: si < sections.length - 1 ? '12px' : 0 }}>
        {sec.header && (
          <div style={{ fontSize: '12.1px', fontWeight: '700', color: '#6B6760', letterSpacing: '0.3px', textTransform: 'uppercase', marginBottom: '5px', fontFamily: "'DM Sans', sans-serif" }}>
            {sec.header}
          </div>
        )}
        {sec.lines.length > 0 && (
          sec.lines.some(l => l.startsWith('- ') || l.startsWith('• ')) ? (
            <ul style={{ margin: 0, paddingLeft: '18px', listStyleType: 'disc' }}>
              {sec.lines.map((l, li) => (
                <li key={li} style={{ marginBottom: '3px', fontSize: '14.3px', color: '#4B4945', lineHeight: '1.6' }}>
                  {l.replace(/^[-•]\s*/, '')}
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ margin: 0, fontSize: '14.3px', color: '#4B4945', lineHeight: '1.65' }}>
              {sec.lines.join(' ')}
            </p>
          )
        )}
      </div>
    ));
  };

  /* ── Shared link list renderer ── */
  const LinkList = ({ links = [], singleUrl = '' }) => {
    const allLinks = links.length > 0 ? links : (singleUrl ? [singleUrl] : []);
    if (allLinks.length === 0) return null;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '10px' }}>
        {allLinks.map((item, i) => {
          const urlStr = typeof item === 'string' ? item : item?.url;
          const label = typeof item === 'string' ? null : item?.label;
          if (!urlStr) return null;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', backgroundColor: colors.accentLight, borderRadius: '7px' }}>
              <span style={{ fontSize: '12px', flexShrink: 0 }}>🔗</span>
              <a
                href={urlStr}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: '12.7px', fontWeight: '600', color: colors.accent, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '3px', flex: 1 }}
              >
                {label || urlStr.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}… <ExternalLink size={11} />
              </a>
            </div>
          );
        })}
      </div>
    );
  };

  /* ── Block card for content / worksheet / activity ── */
  const BlockCard = ({ item, actualIdx, resourceType, stripeColor }) => {
    // Support both new schema fields and old/legacy fields
    const information = item.information || item.notes || item.description || '';
    const instructions = item.instructions || item.notes || '';
    const links = Array.isArray(item.links) ? item.links : [];
    const singleUrl = item.url || item.sourceUrl || '';

    const initialDataForEdit = { ...item };

    const editBtn = !readOnly && (
      <div style={{ display: 'flex', gap: '4px', marginLeft: '12px', flexShrink: 0 }}>
        <button
          onClick={() => onNavigateToBlock
            ? onNavigateToBlock(sectionId, subsectionId, topic.id, item.id)
            : setResourceModal({ type: resourceType, mode: 'edit', index: actualIdx, initialData: initialDataForEdit })}
          style={{ padding: '3px 9px', backgroundColor: '#fff', color: colors.textSecondary, border: `1px solid ${colors.border}`, borderRadius: '5px', cursor: 'pointer', fontSize: '12.1px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '3px', fontFamily: 'inherit' }}
        >✏️ Edit</button>
        <button
          onClick={() => handleDeleteResource(resourceType, actualIdx)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', color: colors.dangerBtn }}
        ><Trash2 size={15} /></button>
      </div>
    );

    /* Content block */
    if (resourceType === 'content' || resourceType === 'video') {
      return (
        <div style={{ borderRadius: '12px', border: `1.5px solid ${colors.border}`, borderLeft: `4px solid ${stripeColor}`, marginBottom: '10px', overflow: 'hidden', backgroundColor: '#fff' }}>
          <div style={{ padding: '16px 16px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: information ? '10px' : 0 }}>
              {item.title && <p style={{ margin: 0, fontSize: '15.4px', fontWeight: '700', color: colors.textPrimary, flex: 1 }}>{item.title}</p>}
              {editBtn}
            </div>
            {information && renderStructuredText(information)}
            <LinkList links={links} singleUrl={singleUrl} />
          </div>
        </div>
      );
    }

    /* Worksheet block */
    if (resourceType === 'worksheet') {
      return (
        <div style={{ borderRadius: '12px', border: `1.5px solid ${colors.border}`, borderLeft: `4px solid ${stripeColor}`, marginBottom: '10px', overflow: 'hidden', backgroundColor: '#fff' }}>
          <div style={{ padding: '16px 16px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
              <p style={{ margin: 0, fontSize: '15.4px', fontWeight: '700', color: colors.textPrimary, flex: 1 }}>{item.title || 'Worksheet'}</p>
              {editBtn}
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: (item.contentKeywords || information) ? '8px' : 0 }}>
              {item.worksheetType && (
                <span style={{ padding: '3px 10px', backgroundColor: '#FFF3E8', border: '1px solid #F5C98A', borderRadius: '20px', fontSize: '12.1px', fontWeight: '600', color: '#9A5C12' }}>{item.worksheetType}</span>
              )}
              {item.contentKeywords && (
                <span style={{ padding: '3px 10px', backgroundColor: colors.accentLight, border: `1px solid ${colors.border}`, borderRadius: '20px', fontSize: '12.1px', color: colors.textSecondary }}>{item.contentKeywords}</span>
              )}
            </div>
            {information && (
              <p style={{ margin: 0, fontSize: '14.3px', color: '#4B4945', lineHeight: '1.65', whiteSpace: 'pre-wrap' }}>{information}</p>
            )}
            <LinkList links={links} singleUrl={singleUrl} />
          </div>
        </div>
      );
    }

    /* Activity block */
    return (
      <div style={{ borderRadius: '12px', border: `1.5px solid ${colors.border}`, borderLeft: `4px solid ${stripeColor}`, marginBottom: '10px', overflow: 'hidden', backgroundColor: '#fff' }}>
        <div style={{ padding: '16px 16px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
            <p style={{ margin: 0, fontSize: '15.4px', fontWeight: '700', color: colors.textPrimary, flex: 1 }}>{item.title || 'Activity'}</p>
            {editBtn}
          </div>
          {item.activityType && (
            <span style={{ display: 'inline-block', padding: '3px 10px', backgroundColor: '#EDFFF3', border: '1px solid #86EFAC', borderRadius: '20px', fontSize: '12.1px', fontWeight: '600', color: '#1E7C43', marginBottom: instructions ? '8px' : 0 }}>{item.activityType}</span>
          )}
          {instructions && (
            <p style={{ margin: item.activityType ? '0' : 0, fontSize: '14.3px', color: '#4B4945', lineHeight: '1.65', whiteSpace: 'pre-wrap' }}>{instructions}</p>
          )}
          <LinkList links={links} singleUrl={singleUrl} />
        </div>
      </div>
    );
  };

  /* ── YouTube video card displayed as a content block ── */
  const VideoCard = ({ video, idx }) => {
    const videoUrl = video.url || (video.videoId ? `https://www.youtube.com/watch?v=${video.videoId}` : '');
    return (
      <div style={{ borderRadius: '12px', border: `1.5px solid ${colors.border}`, borderLeft: `4px solid ${colors.stripe.content}`, marginBottom: '10px', overflow: 'hidden', backgroundColor: '#fff' }}>
        <div style={{ padding: '14px 16px', display: 'flex', gap: '14px', alignItems: 'flex-start', position: 'relative' }}>
          {!readOnly && (
            <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '4px' }}>
              <button
                onClick={() => setResourceModal({ type: 'video', mode: 'edit', index: idx, initialData: { title: video.title, url: videoUrl, notes: video.notes || '' } })}
                style={{ padding: '3px 8px', backgroundColor: '#fff', color: colors.textSecondary, border: `1px solid ${colors.border}`, borderRadius: '5px', cursor: 'pointer', fontSize: '12.1px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '3px', fontFamily: 'inherit' }}
              >✏️ Edit</button>
              <button
                onClick={() => handleDeleteResource('video', idx)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', color: colors.dangerBtn }}
              ><Trash2 size={15} /></button>
            </div>
          )}
          {video.thumbnailUrl && (
            <img src={video.thumbnailUrl} alt={video.title} style={{ width: '100px', height: '75px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0 }} />
          )}
          <div style={{ flex: 1, minWidth: 0, paddingRight: !readOnly ? '80px' : 0 }}>
            <p style={{ margin: '0 0 3px', fontSize: '15.4px', fontWeight: '700', color: colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{video.title}</p>
            {video.channelName && (
              <p style={{ margin: '0 0 5px', fontSize: '12.7px', color: colors.textSecondary }}>{video.channelName}{video.duration ? ` · ${video.duration}` : ''}</p>
            )}
            {video.notes && (
              <p style={{ margin: '0 0 7px', fontSize: '13.5px', color: '#4B4945', lineHeight: '1.55' }}>{video.notes}</p>
            )}
            {videoUrl && (
              <a href={videoUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '13.2px', color: colors.accent, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px', fontWeight: '600' }}>
                Open <ExternalLink size={11} />
              </a>
            )}
          </div>
        </div>
      </div>
    );
  };

  /* ── Section header ── */
  const SectionHeader = ({ icon, title, subtitle, onAdd }) => (
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
        <button
          onClick={onAdd}
          style={{ padding: '6px 12px', backgroundColor: 'transparent', color: colors.accent, border: `1px solid ${colors.border}`, borderRadius: '6px', cursor: 'pointer', fontSize: '13.2px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'inherit', flexShrink: 0 }}
        >
          <Plus size={14} /> Add block
        </button>
      )}
    </div>
  );



  // Helper: add a new empty block and navigate to it
  const handleAddBlock = (type) => {
    const newId = `block-${Date.now()}`;
    actions?.addBlock?.(topic.id, { id: newId, type, title: '', content: '' });
    onNavigateToBlock?.(sectionId, subsectionId, topic.id, newId);
  };

  return (
    <>
      {/* ── Pastel gradient backdrop ── */}
      <div style={{
        height: '100%', overflowY: 'auto',
        background: 'linear-gradient(135deg, rgba(178,232,200,0.55) 0%, rgba(172,216,240,0.45) 35%, rgba(242,192,212,0.45) 65%, rgba(247,228,160,0.50) 100%)',
        backgroundColor: '#F0EDE8',
        padding: '0 28px 60px',
      }}>

        {/* ── Page top bar ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0 8px' }}>
          {/* Breadcrumb / back */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <button
              onClick={handleClose}
              style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '8px', cursor: 'pointer', padding: '6px 12px', fontSize: '13px', fontWeight: '600', color: '#444', fontFamily: 'inherit' }}
            >
              ← {subsectionTitle || 'Subsection'}
            </button>
            {sectionNumber && subsectionNumber && topicNumber && (
              <span style={{ fontSize: '13px', color: '#888' }}>
                {sectionNumber}.{subsectionNumber}.{topicNumber} · {topic.title}
              </span>
            )}
          </div>
        </div>

        {/* ── Tray: pending block drafts from Edo ── */}
        {(trayBlocks || []).length > 0 && (
          <div style={{ marginBottom: '16px', padding: '12px 16px', background: 'rgba(247,228,160,0.15)', border: '1px solid rgba(180,150,30,0.2)', borderRadius: '10px' }}>
            <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: '700', color: '#5C460A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Edo Tray — Block Drafts
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {trayBlocks.map(item => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', background: '#FFF', borderRadius: '7px', padding: '8px 12px', border: '1px solid rgba(0,0,0,0.08)' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#111' }}>{item.data?.title || 'Untitled Block'}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#888' }}>{item.data?.type} · {item.data?.subcategory || item.data?.category || ''}</p>
                  </div>
                  <button
                    onClick={() => onAddBlockFromTray?.(item)}
                    style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12.5px', fontWeight: '600', padding: '5px 12px', borderRadius: '7px', cursor: 'pointer', background: '#111', color: '#FFF', border: 'none', whiteSpace: 'nowrap' }}
                  >
                    + Add
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ CARD 1: Topic info ══ */}
        <div style={{ backgroundColor: '#fff', borderRadius: '16px', boxShadow: '0 4px 24px rgba(0,0,0,0.10)', overflow: 'hidden', marginBottom: '16px' }}>
          <div style={{ height: '5px', backgroundColor: accentColor }} />
          <div style={{ padding: '28px 32px 32px' }}>

            {/* Title row */}
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
                style={{ fontSize: '28.6px', fontWeight: '700', color: colors.textPrimary, border: '2px solid #000', background: '#fff', padding: '10px 14px', borderRadius: '8px', width: '100%', outline: 'none', marginBottom: '24px' }}
              />
            ) : (
              <h2 style={{ margin: '0 0 24px', fontSize: '28.6px', fontWeight: '700', color: colors.textPrimary }}>{editedTopic.title}</h2>
            )}

            {/* Description */}
            <label style={{ display: 'block', fontSize: '12.1px', color: colors.textSecondary, marginBottom: '8px', fontWeight: '700', letterSpacing: '0.5px' }}>DESCRIPTION</label>
            {isEditing ? (
              <textarea
                value={editedTopic.description}
                onChange={(e) => setEditedTopic({ ...editedTopic, description: e.target.value })}
                style={{ width: '100%', minHeight: '100px', padding: '12px 16px', border: '2px solid #000', borderRadius: '8px', fontSize: '15.4px', color: colors.textPrimary, resize: 'vertical', outline: 'none', fontFamily: 'inherit', lineHeight: '1.6', marginBottom: '24px' }}
                placeholder="Add a description..."
              />
            ) : (
              <p style={{ margin: '0 0 24px', fontSize: '15.4px', color: colors.textSecondary, lineHeight: '1.6', fontStyle: editedTopic.description ? 'normal' : 'italic' }}>
                {editedTopic.description || 'No description yet'}
              </p>
            )}

            {/* Duration */}
            <label style={{ display: 'block', fontSize: '12.1px', color: colors.textSecondary, marginBottom: '8px', fontWeight: '700', letterSpacing: '0.5px' }}>DURATION</label>
            {isEditing ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
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
              <div style={{ marginBottom: '24px' }}><Pill label={`${editedTopic.duration_minutes} min`} /></div>
            )}

            {/* Learning Objectives */}
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
                        <button onClick={() => handleRemoveObjective(idx)} style={{ padding: '6px', background: 'none', border: 'none', cursor: 'pointer', color: colors.dangerBtn, display: 'flex', alignItems: 'center' }}>
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
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input
                  type="text"
                  value={newObjective}
                  onChange={(e) => setNewObjective(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddObjective()}
                  placeholder="Add a new learning objective..."
                  style={{ flex: 1, padding: '8px 12px', border: `1px solid ${colors.border}`, borderRadius: '6px', fontSize: '14.3px', outline: 'none' }}
                />
                <button onClick={handleAddObjective} style={{ padding: '8px 14px', backgroundColor: colors.accentLight, color: colors.textSecondary, border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14.3px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'inherit' }}>
                  <Plus size={14} /> Add
                </button>
              </div>
            )}

            {/* Save footer — only inside this card when editing */}
            {isEditing && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '20px', borderTop: `1px solid ${colors.border}`, marginTop: '12px' }}>
                <button
                  onClick={handleSave}
                  style={{ padding: '10px 24px', backgroundColor: accentDeepColor, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '15.4px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'inherit' }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '0.88'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                >
                  <Check size={16} /> Save Changes
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ══ CARD 2: Content ══ */}
        <div style={{ backgroundColor: '#fff', borderRadius: '16px', boxShadow: '0 4px 24px rgba(0,0,0,0.10)', overflow: 'hidden', marginBottom: '16px' }}>
          <div style={{ height: '5px', backgroundColor: '#6B8FE8' }} />
          <div style={{ padding: '24px 32px 28px' }}>
            <SectionHeader
              icon="📖"
              title="CONTENT"
              subtitle="Age-appropriate subject information and how the teacher can deliver it — theory, analogies, key concepts"
              onAdd={() => onNavigateToBlock ? handleAddBlock('content') : setResourceModal({ type: 'content', mode: 'add' })}
            />
            {videos.map((video, idx) => (
              <VideoCard key={`vid-${idx}`} video={video} idx={idx} />
            ))}
            {contentBlocks.map((item) => {
              const actualIdx = allResources.indexOf(item);
              return <BlockCard key={actualIdx} item={item} actualIdx={actualIdx} resourceType={item.type} stripeColor={colors.stripe.content} />;
            })}
          </div>
        </div>

        {/* ══ CARD 3: Worksheet ══ */}
        <div style={{ backgroundColor: '#fff', borderRadius: '16px', boxShadow: '0 4px 24px rgba(0,0,0,0.10)', overflow: 'hidden', marginBottom: '16px' }}>
          <div style={{ height: '5px', backgroundColor: '#E8A55C' }} />
          <div style={{ padding: '24px 32px 28px' }}>
            <SectionHeader
              icon="📄"
              title="WORKSHEET"
              subtitle="What to include, how to structure it, differentiation ideas, and any reference materials"
              onAdd={() => onNavigateToBlock ? handleAddBlock('worksheet') : setResourceModal({ type: 'worksheet', mode: 'add' })}
            />
            {worksheets.map((ws) => {
              const actualIdx = allResources.indexOf(ws);
              return <BlockCard key={actualIdx} item={ws} actualIdx={actualIdx} resourceType="worksheet" stripeColor={colors.stripe.worksheet} />;
            })}
          </div>
        </div>

        {/* ══ CARD 4: Activity ══ */}
        <div style={{ backgroundColor: '#fff', borderRadius: '16px', boxShadow: '0 4px 24px rgba(0,0,0,0.10)', overflow: 'hidden', marginBottom: '16px' }}>
          <div style={{ height: '5px', backgroundColor: '#5CC97C' }} />
          <div style={{ padding: '24px 32px 28px' }}>
            <SectionHeader
              icon="🎯"
              title="ACTIVITY"
              subtitle="How to run it — setup, grouping, step-by-step facilitation, timing, debrief prompts"
              onAdd={() => onNavigateToBlock ? handleAddBlock('activity') : setResourceModal({ type: 'activity', mode: 'add' })}
            />
            {activities.map((act) => {
              const actualIdx = allResources.indexOf(act);
              return <BlockCard key={actualIdx} item={act} actualIdx={actualIdx} resourceType="activity" stripeColor={colors.stripe.activity} />;
            })}
          </div>
        </div>

      </div>{/* end backdrop */}

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
