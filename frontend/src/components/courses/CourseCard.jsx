import { useState } from 'react';
import { Eye, EyeOff, Trash2 } from 'lucide-react';

const CARD_COLORS = ['#B2E8C8', '#ACD8F0', '#F2C0D4', '#F7E4A0'];

// Pick a consistent color per course name
const cardColor = (name = '') => CARD_COLORS[name.charCodeAt(0) % CARD_COLORS.length];

const CourseCard = ({ curriculum, onCardClick, onDelete, onToggleVisibility }) => {
  const [hovered, setHovered] = useState(false);

  const handleDelete = (e) => {
    e.stopPropagation();
    onDelete(curriculum.id, curriculum.courseName);
  };

  const handleToggle = (e) => {
    e.stopPropagation();
    onToggleVisibility(curriculum);
  };

  const isPublic = curriculum.isPublic || false;
  const accent = cardColor(curriculum.courseName);

  return (
    <div
      onClick={() => onCardClick(curriculum)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '12px',
        background: 'rgba(255,255,255,0.72)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.88)',
        boxShadow: hovered
          ? '0 6px 24px rgba(0,0,0,0.10)'
          : '0 1px 4px rgba(0,0,0,0.05)',
        cursor: 'pointer',
        transition: 'box-shadow 0.18s',
        overflow: 'hidden',
      }}
    >
      {/* Coloured top strip */}
      <div style={{ height: '6px', background: accent }} />

      {/* Body */}
      <div style={{ flex: 1, padding: '16px 16px 12px' }}>
        <h3 style={{
          margin: '0 0 10px',
          fontSize: '19px',
          fontWeight: '600',
          color: '#111',
          lineHeight: '1.35',
          fontFamily: "'DM Serif Display', serif",
        }}>
          {curriculum.courseName}
        </h3>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {curriculum.subject && (
            <span style={chip}>{curriculum.subject}</span>
          )}
          {curriculum.class && (
            <span style={chip}>Grade {curriculum.class}</span>
          )}
          {curriculum.timeDuration && (
            <span style={chip}>⏱ {curriculum.timeDuration}</span>
          )}
        </div>
      </div>

      {/* Footer row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        borderTop: '1px solid rgba(0,0,0,0.05)',
        background: 'rgba(255,255,255,0.4)',
      }}>
        {/* Visibility toggle */}
        <button
          onClick={handleToggle}
          title={isPublic ? 'Public — click to make Private' : 'Private — click to make Public'}
          style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '4px 9px',
            background: isPublic ? 'rgba(178,232,200,0.45)' : 'rgba(0,0,0,0.04)',
            color: isPublic ? '#1C5C35' : '#888',
            border: `1px solid ${isPublic ? 'rgba(178,232,200,0.8)' : 'rgba(0,0,0,0.1)'}`,
            borderRadius: '6px', cursor: 'pointer',
            fontSize: '12.1px', fontWeight: '500',
            fontFamily: "'DM Sans', sans-serif",
            transition: 'all 0.15s',
          }}
        >
          {isPublic ? <Eye size={12} /> : <EyeOff size={12} />}
          {isPublic ? 'Public' : 'Private'}
        </button>

        {/* Delete */}
        <button
          onClick={handleDelete}
          style={{
            display: 'flex', alignItems: 'center',
            background: 'none', border: 'none',
            color: '#F87171', cursor: 'pointer',
            padding: '4px 5px', borderRadius: '5px',
            opacity: hovered ? 1 : 0,
            transition: 'opacity 0.15s',
          }}
          title="Delete course"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
};

const chip = {
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: '20px',
  fontSize: '11px',
  fontWeight: '500',
  background: 'rgba(0,0,0,0.05)',
  color: '#555',
};

export default CourseCard;
