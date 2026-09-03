import { useState } from 'react';
import { Trash2, X, Pencil, Lock } from 'lucide-react';
import {
  descriptionText,
  durationText,
  lastModifiedText,
  lessonCount,
  levelLine,
} from '../../utils/courseCardMeta';

// Placeholder thumbnail palette — no course cover images exist yet, so the
// thumbnail is a gradient keyed to the course name plus a subject glyph.
const THUMBS = [
  ['#F6A8BC', '#E15C7E'],
  ['#4E7FB5', '#274C7A'],
  ['#8FC64A', '#4C942E'],
  ['#58C3BE', '#2C8683'],
  ['#E79A46', '#C05F1E'],
  ['#B79AE0', '#6F52C2'],
];
const thumbFor = (name = '') => THUMBS[(name.charCodeAt(0) || 0) % THUMBS.length];

const SUBJECT_GLYPH = {
  math: '∑', mathematics: '∑', science: '⚗', biology: '🧬', chemistry: '⚗',
  physics: '⚛', geography: '🌍', history: '📜', english: '✍', language: '✍',
  art: '🎨', arts: '🎨', music: '♪', computer: '💻', 'computer science': '💻',
};
const glyphFor = (c) => {
  const key = String(c.subject || c.topic || '').toLowerCase().trim();
  return SUBJECT_GLYPH[key] || Object.entries(SUBJECT_GLYPH).find(([k]) => key.includes(k))?.[1] || '📘';
};

const getCourseId = (c) => c.courseId || c.id;

const CourseCard = ({
  curriculum,
  onCardClick,
  onDelete,
  draggable: isDraggable,
  onDragStart,
  onDragEnd,
  isDragging,
  onRemoveFromFolder,
}) => {
  const [hovered, setHovered] = useState(false);

  const isPublic = !!curriculum.isPublic;
  const [c1, c2] = thumbFor(curriculum.courseName);
  const desc = descriptionText(curriculum);
  const duration = durationText(curriculum);
  const lessons = lessonCount(curriculum);
  const modified = lastModifiedText(curriculum);
  const level = isPublic ? levelLine(curriculum) : '';
  const shared = curriculum.sharedWith || [];

  return (
    <div
      draggable={!!isDraggable}
      onDragStart={isDraggable ? (e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart?.(); } : undefined}
      onDragEnd={onDragEnd}
      onClick={() => onCardClick(curriculum)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        flex: 'none',
        width: '340px',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '16px',
        background: '#fff',
        border: '1px solid #ECE6EB',
        boxShadow: hovered ? '0 10px 28px rgba(30,20,35,0.12)' : '0 1px 4px rgba(0,0,0,0.05)',
        cursor: isDraggable ? 'grab' : 'pointer',
        transition: 'box-shadow 0.18s, opacity 0.18s',
        overflow: 'hidden',
        opacity: isDragging ? 0.45 : 1,
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {/* Thumbnail */}
      <div style={{
        position: 'relative',
        height: '176px',
        margin: '12px 12px 0',
        borderRadius: '12px',
        overflow: 'hidden',
        display: 'grid',
        placeItems: 'center',
        background: `linear-gradient(140deg, ${c1}, ${c2})`,
      }}>
        <span style={{ fontSize: '84px', color: 'rgba(255,255,255,0.42)', lineHeight: 1 }}>
          {glyphFor(curriculum)}
        </span>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(0,0,0,0.28))' }} />

        {shared.length > 0 && (
          <div style={{ position: 'absolute', top: '12px', left: '12px', display: 'flex' }}>
            {shared.slice(0, 3).map((s, i) => (
              <span key={s.uid || i} style={{
                width: '26px', height: '26px', borderRadius: '50%',
                background: '#CBB9C6', border: '2px solid rgba(255,255,255,0.9)',
                marginLeft: i ? '-9px' : 0,
              }} />
            ))}
            {shared.length > 3 && (
              <span style={{
                display: 'grid', placeItems: 'center',
                width: '26px', height: '26px', borderRadius: '50%',
                background: 'rgba(255,255,255,0.92)', border: '2px solid rgba(255,255,255,0.9)',
                marginLeft: '-9px', fontSize: '10px', fontWeight: 700, color: '#6B5566',
              }}>+{shared.length - 3}</span>
            )}
          </div>
        )}

        {!isPublic && (
          <div style={{
            position: 'absolute', top: '11px', right: '11px',
            width: '28px', height: '28px', borderRadius: '8px',
            background: 'rgba(255,255,255,0.92)', display: 'grid', placeItems: 'center', color: '#6B7280',
          }}>
            <Pencil size={14} />
          </div>
        )}

        {onRemoveFromFolder && hovered && (
          <button
            onClick={(e) => { e.stopPropagation(); onRemoveFromFolder(); }}
            title="Remove from folder"
            style={{
              position: 'absolute', top: '11px', right: isPublic ? '11px' : '47px', zIndex: 2,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '26px', height: '26px',
              background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(0,0,0,0.12)',
              borderRadius: '50%', cursor: 'pointer', color: '#6B7280',
            }}
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '14px 16px 16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '10px' }}>
          <span style={{
            width: '26px', height: '26px', borderRadius: '7px', background: '#F4ECF1',
            display: 'grid', placeItems: 'center', fontSize: '13px',
          }}>{glyphFor(curriculum)}</span>
          <span style={{
            fontSize: '13px', fontWeight: 500, padding: '4px 11px', borderRadius: '7px',
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            background: isPublic ? '#F0F4FF' : '#EDEDF1',
            color: isPublic ? '#3E62BC' : '#4E4E4E',
          }}>
            {!isPublic && <Lock size={11} />}
            {isPublic ? 'Published' : 'Unpublished'}
          </span>
        </div>

        <h3 style={{
          margin: '0 0 8px', fontSize: '20px', fontWeight: 500, lineHeight: 1.25, color: '#0E1620',
        }}>
          {curriculum.courseName}
        </h3>

        {desc && (
          <p style={{
            margin: '0 0 14px', fontSize: '14.5px', lineHeight: 1.4, color: '#878787',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {desc}
          </p>
        )}

        <div style={{ marginTop: 'auto', display: 'grid', gap: '5px', fontSize: '14px' }}>
          {isPublic && duration && <div style={metaRow}><b style={metaLabel}>Duration:</b> {duration}</div>}
          {modified && <div style={metaRow}><b style={metaLabel}>Last Modified:</b> {modified}</div>}
          {isPublic && lessons > 0 && <div style={metaRow}><b style={metaLabel}>Lessons:</b> {lessons}</div>}
        </div>

        {level && (
          <div style={{
            marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #F1EBF0',
            fontSize: '14.5px', fontWeight: 500, color: '#6E7F1B',
          }}>
            {level}
          </div>
        )}
      </div>

      {/* Delete (hover) */}
      <button
        className="mc-btn"
        onClick={(e) => { e.stopPropagation(); onDelete(getCourseId(curriculum), curriculum.courseName); }}
        title="Delete course"
        style={{
          position: 'absolute', bottom: '10px', right: '10px',
          display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.9)',
          border: '1px solid rgba(0,0,0,0.08)', borderRadius: '7px',
          color: '#F87171', cursor: 'pointer', padding: '5px',
          opacity: hovered ? 1 : 0, transition: 'opacity 0.15s',
        }}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
};

const metaRow = { color: '#878787' };
const metaLabel = { color: '#122E75', fontWeight: 600 };

export default CourseCard;
