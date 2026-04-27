// src/components/courses/SubsectionView.jsx
import { useState } from 'react';
import { Plus, FileText, Zap, PlayCircle, Trash2, GripVertical } from 'lucide-react';
import { Droppable, Draggable } from '@hello-pangea/dnd';

const TOPIC_BORDER_COLORS = ['#ACD8F0', '#F2C0D4', '#B2E8C8', '#F7E4A0'];
const TOPIC_TINTS = [
  'rgba(172,216,240,0.14)',
  'rgba(242,192,212,0.14)',
  'rgba(178,232,200,0.14)',
  'rgba(247,228,160,0.14)',
];
const TOPIC_DEEP_COLORS = ['#2A6A8A', '#7A2A4A', '#1C5C35', '#5C3A08'];

const SubsectionView = ({
  subsection,
  sectionId,
  sectionTitle,
  sectionNumber,
  subsectionNumber,
  videosByTopic,
  handsOnResources,
  actions,
  onBack,
  onNavigateToTopic,
  // Tray
  trayTopics,
  onAddTopicFromTray,
}) => {
  const [hoveredTopic, setHoveredTopic] = useState(null);

  // Inline editing state for title & description
  const [editingTitle, setEditingTitle] = useState(false);
  const [localTitle, setLocalTitle] = useState(subsection.title || '');
  const [editingDesc, setEditingDesc] = useState(false);
  const [localDesc, setLocalDesc] = useState(subsection.description || '');

  const topicBoxes = subsection?.topicBoxes || [];

  const handleTitleBlur = () => {
    setEditingTitle(false);
    if (localTitle.trim() !== (subsection.title || '')) {
      actions.updateSubsectionTitle(sectionId, subsection.id, localTitle.trim() || 'Untitled Subsection');
    }
  };

  const handleDescBlur = () => {
    setEditingDesc(false);
    if (localDesc !== (subsection.description || '')) {
      actions.updateSubsectionDescription(sectionId, subsection.id, localDesc);
    }
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px 80px', position: 'relative', zIndex: 1 }}>

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={onBack}
            style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: '13.8px', fontWeight: '500',
              padding: '6px 13px', borderRadius: '8px', cursor: 'pointer',
              background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.12)',
              color: '#111', whiteSpace: 'nowrap',
            }}
          >
            ← Outline
          </button>
          {sectionNumber && sectionTitle && (
            <span style={{ color: '#555', fontSize: '13px', fontWeight: '500' }}>
              Section {sectionNumber}: {sectionTitle}
            </span>
          )}
        </div>
      </div>

      {/* Tray: pending topic box drafts from Edo */}
      {(trayTopics || []).length > 0 && (
        <div style={{
          marginBottom: '16px', padding: '12px 16px',
          background: 'rgba(247,228,160,0.15)', border: '1px solid rgba(180,150,30,0.2)',
          borderRadius: '10px',
        }}>
          <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: '700', color: '#5C460A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Edo Tray — Topic Drafts
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {trayTopics.map(item => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', background: '#FFF', borderRadius: '7px', padding: '8px 12px', border: '1px solid rgba(0,0,0,0.08)' }}>
                <div>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#111' }}>{item.data?.title || 'Untitled Topic'}</p>
                  {item.data?.description && <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: '#666' }}>{item.data.description.slice(0, 80)}{item.data.description.length > 80 ? '…' : ''}</p>}
                </div>
                <button
                  onClick={() => onAddTopicFromTray?.(item)}
                  style={{
                    fontFamily: "'DM Sans', sans-serif", fontSize: '12.5px', fontWeight: '600',
                    padding: '5px 12px', borderRadius: '7px', cursor: 'pointer',
                    background: '#111', color: '#FFF', border: 'none', whiteSpace: 'nowrap',
                  }}
                >
                  + Add
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Subsection info card */}
      <div style={{
        background: '#FFFFFF',
        border: '1px solid rgba(0,0,0,0.08)',
        borderRadius: '12px',
        padding: '20px 24px',
        marginBottom: '24px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: '0 0 2px', fontSize: '12px', fontWeight: '600', color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Subsection {sectionNumber}.{subsectionNumber}
            </p>

            {/* Editable title */}
            {editingTitle ? (
              <input
                autoFocus
                value={localTitle}
                onChange={e => setLocalTitle(e.target.value)}
                onBlur={handleTitleBlur}
                onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setLocalTitle(subsection.title || ''); setEditingTitle(false); } }}
                maxLength={80}
                style={{
                  fontSize: '22px', fontWeight: '700', color: '#111',
                  fontFamily: "'DM Sans', sans-serif", lineHeight: '1.3',
                  border: '2px solid #111', borderRadius: '6px',
                  padding: '4px 8px', width: '100%', outline: 'none',
                  marginBottom: '8px', background: '#FAFAFA',
                }}
              />
            ) : (
              <h2
                onClick={() => setEditingTitle(true)}
                title="Click to edit title"
                style={{
                  margin: '0 0 8px', fontSize: '22px', fontWeight: '700',
                  color: '#111', fontFamily: "'DM Sans', sans-serif", lineHeight: '1.3',
                  cursor: 'text', borderRadius: '4px',
                  padding: '2px 4px', marginLeft: '-4px',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#F5F3EE'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {localTitle || 'Untitled Subsection'}
              </h2>
            )}

            {/* Editable description */}
            {editingDesc ? (
              <textarea
                autoFocus
                value={localDesc}
                onChange={e => setLocalDesc(e.target.value)}
                onBlur={handleDescBlur}
                onKeyDown={e => { if (e.key === 'Escape') { setLocalDesc(subsection.description || ''); setEditingDesc(false); } }}
                maxLength={400}
                rows={3}
                style={{
                  fontSize: '14.5px', color: '#555', lineHeight: '1.55',
                  border: '2px solid #111', borderRadius: '6px',
                  padding: '6px 8px', width: '100%', outline: 'none',
                  resize: 'vertical', fontFamily: "'DM Sans', sans-serif",
                  background: '#FAFAFA',
                }}
              />
            ) : (
              <p
                onClick={() => setEditingDesc(true)}
                title="Click to edit description"
                style={{
                  margin: 0, fontSize: '14.5px', color: localDesc ? '#555' : '#AAA',
                  lineHeight: '1.55', cursor: 'text', borderRadius: '4px',
                  padding: '2px 4px', marginLeft: '-4px',
                  fontStyle: localDesc ? 'normal' : 'italic',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#F5F3EE'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {localDesc || 'Add a description…'}
              </p>
            )}
          </div>
          <div style={{
            flexShrink: 0,
            background: '#F5F3EE',
            border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: '8px',
            padding: '8px 14px',
            textAlign: 'center',
            minWidth: '64px',
          }}>
            <p style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: '#333' }}>{topicBoxes.length}</p>
            <p style={{ margin: 0, fontSize: '11px', color: '#777', fontWeight: '600' }}>
              {topicBoxes.length === 1 ? 'Topic' : 'Topics'}
            </p>
          </div>
        </div>
      </div>

      {/* Topic boxes */}
      <Droppable droppableId={`topicboxes-${subsection.id}`} type="TOPICBOX">
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            style={{
              minHeight: '80px',
              borderRadius: '12px',
              border: snapshot.isDraggingOver ? '2px dashed #ACD8F0' : '2px dashed transparent',
              background: snapshot.isDraggingOver ? 'rgba(172,216,240,0.08)' : 'transparent',
              transition: 'border 0.15s, background 0.15s',
              marginBottom: topicBoxes.length === 0 ? 0 : '16px',
              ...(topicBoxes.length > 0 ? {
                display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'flex-start',
              } : {}),
            }}
          >
      {topicBoxes.length === 0 ? (
        <div style={{
          width: '100%', textAlign: 'center', padding: '60px 20px',
          border: snapshot.isDraggingOver ? 'none' : '1px dashed rgba(0,0,0,0.12)', borderRadius: '12px',
          background: '#FFFFFF',
        }}>
          <p style={{ fontSize: '28px', marginBottom: '8px' }}>📦</p>
          <p style={{ fontSize: '18px', color: '#111', fontWeight: '600', margin: '0 0 4px' }}>No topic boxes yet</p>
          <p style={{ fontSize: '14px', color: '#777', margin: '0 0 16px' }}>Add your first topic box or drag one from the Edo tray</p>
          <button
            onClick={() => actions.addTopicBox(sectionId, subsection.id)}
            style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: '14px', fontWeight: '600',
              padding: '8px 20px', borderRadius: '8px', cursor: 'pointer',
              background: '#111', color: '#FFF', border: 'none',
              display: 'inline-flex', alignItems: 'center', gap: '6px',
            }}
          >
            <Plus size={14} /> Add Topic Box
          </button>
          {provided.placeholder}
        </div>
      ) : (
        <>
            {topicBoxes.map((topic, idx) => {
              const accentColor = TOPIC_BORDER_COLORS[idx % 4];
              const tint = TOPIC_TINTS[idx % 4];
              const deepColor = TOPIC_DEEP_COLORS[idx % 4];
              const videos = videosByTopic?.[topic.id] || [];
              const allResources = handsOnResources?.[topic.id] || [];
              const worksheets = allResources.filter(r => r.type === 'worksheet');
              const activities = allResources.filter(r => r.type === 'activity');

              return (
                <Draggable key={topic.id} draggableId={topic.id} index={idx}>
                  {(dragProvided, dragSnapshot) => (
                <div
                  ref={dragProvided.innerRef}
                  {...dragProvided.draggableProps}
                  onMouseEnter={() => setHoveredTopic(topic.id)}
                  onMouseLeave={() => setHoveredTopic(null)}
                  onClick={() => onNavigateToTopic?.(sectionId, subsection.id, topic.id)}
                  style={{
                    ...dragProvided.draggableProps.style,
                    flex: '0 0 260px',
                    width: '260px',
                    border: '1px solid rgba(0,0,0,0.09)',
                    borderTop: `3px solid ${accentColor}`,
                    borderRadius: '10px',
                    background: '#FFFFFF',
                    boxShadow: dragSnapshot.isDragging
                      ? '0 8px 24px rgba(0,0,0,0.18)'
                      : hoveredTopic === topic.id
                        ? '0 4px 12px rgba(0,0,0,0.12)'
                        : '0 1px 4px rgba(0,0,0,0.06)',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    transition: dragSnapshot.isDragging ? 'none' : 'box-shadow 0.15s',
                    opacity: dragSnapshot.isDragging ? 0.92 : 1,
                  }}
                >
                  {/* Card header tinted strip */}
                  <div style={{
                    background: tint, padding: '8px 14px 8px',
                    borderBottom: '1px solid rgba(0,0,0,0.05)',
                    display: 'flex', alignItems: 'center', gap: '6px'
                  }}>
                    {/* Drag handle */}
                    <div
                      {...dragProvided.dragHandleProps}
                      onClick={e => e.stopPropagation()}
                      style={{
                        cursor: 'grab', display: 'flex', alignItems: 'center',
                        flexShrink: 0, color: '#AAA', padding: '2px',
                      }}
                    >
                      <GripVertical size={13} />
                    </div>
                    <span style={{
                      fontSize: '11px', fontWeight: '700', color: deepColor,
                      textTransform: 'uppercase', letterSpacing: '0.05em', flex: 1
                    }}>
                      Topic {sectionNumber}.{subsectionNumber}.{idx + 1}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12.5px', color: '#777' }}>
                        ⏱ {topic.duration_minutes || 0} min
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); actions.removeTopicBox(sectionId, subsection.id, topic.id); }}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          padding: '2px 4px', display: 'flex', alignItems: 'center',
                          color: '#F87171', borderRadius: '4px',
                          opacity: hoveredTopic === topic.id ? 1 : 0,
                          transition: 'opacity 0.15s',
                          pointerEvents: hoveredTopic === topic.id ? 'auto' : 'none',
                        }}
                        title="Delete topic"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Card body */}
                  <div style={{ padding: '12px 14px' }}>
                    <h4 style={{
                      margin: '0 0 8px', fontSize: '15px', fontWeight: '600',
                      color: '#111', fontFamily: "'DM Sans', sans-serif", lineHeight: '1.35',
                    }}>
                      {topic.title || 'Untitled Topic'}
                    </h4>

                    {(topic.learning_objectives || []).length > 0 && (
                      <ul style={{ margin: '0 0 10px', padding: 0, listStyle: 'none', fontSize: '13px', color: '#444', lineHeight: '1.5' }}>
                        {topic.learning_objectives.slice(0, 2).map((obj, i) => (
                          <li key={i} style={{ marginBottom: '2px', paddingLeft: '12px', position: 'relative' }}>
                            <span style={{ position: 'absolute', left: 0, top: '7px', width: '4px', height: '4px', borderRadius: '50%', background: '#D1D5DB', display: 'inline-block' }} />
                            {obj}
                          </li>
                        ))}
                        {topic.learning_objectives.length > 2 && (
                          <li style={{ color: '#888', fontStyle: 'italic', paddingLeft: '12px' }}>
                            +{topic.learning_objectives.length - 2} more…
                          </li>
                        )}
                      </ul>
                    )}

                    {/* Resource counts */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {videos.length > 0 && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '11.5px', color: '#2A6A8A', background: '#EBF5FB', borderRadius: '5px', padding: '2px 7px', border: '1px solid #ACD8F0' }}>
                          <PlayCircle size={10} /> {videos.length} video{videos.length > 1 ? 's' : ''}
                        </span>
                      )}
                      {worksheets.length > 0 && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '11.5px', color: '#C47A1A', background: '#FFF8EC', borderRadius: '5px', padding: '2px 7px', border: '1px solid #F5C98A' }}>
                          <FileText size={10} /> {worksheets.length} sheet{worksheets.length > 1 ? 's' : ''}
                        </span>
                      )}
                      {activities.length > 0 && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '11.5px', color: '#1E7C43', background: '#EDFFF3', borderRadius: '5px', padding: '2px 7px', border: '1px solid #86EFAC' }}>
                          <Zap size={10} /> {activities.length} activit{activities.length > 1 ? 'ies' : 'y'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Open arrow */}
                  <div style={{
                    padding: '6px 14px',
                    borderTop: '1px solid rgba(0,0,0,0.05)',
                    background: tint,
                    display: 'flex',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '12px',
                    color: deepColor,
                    fontWeight: '600',
                    opacity: hoveredTopic === topic.id ? 1 : 0.6,
                    transition: 'opacity 0.15s',
                  }}>
                    Open →
                  </div>
                </div>
                  )}
                </Draggable>
              );
            })}
          {provided.placeholder}
        </>
      )}
          </div>
        )}
      </Droppable>

      {/* Add topic box button — outside flex container so it spans full width */}
      {topicBoxes.length > 0 && (
        <button
          onClick={() => actions.addTopicBox(sectionId, subsection.id)}
          style={{
            fontFamily: "'DM Sans', sans-serif", fontSize: '14px', color: '#444',
            background: '#FFFFFF', border: '1px dashed rgba(0,0,0,0.2)',
            borderRadius: '8px', padding: '9px 20px', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            marginTop: '4px',
          }}
        >
          <Plus size={13} /> Add Topic Box
        </button>
      )}
    </div>
  );
};

export default SubsectionView;
