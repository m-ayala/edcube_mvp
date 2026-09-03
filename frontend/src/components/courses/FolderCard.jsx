import { useState } from 'react';
import { Pencil, Trash2, ChevronRight, FolderOpen } from 'lucide-react';
import { resolveFolderColor } from './folderColors';

const getInitials = (name) => {
  if (!name) return '?';
  const p = name.trim().split(/\s+/);
  return (p.length === 1 ? p[0][0] : p[0][0] + p[p.length - 1][0]).toUpperCase();
};

const FolderCard = ({
  folder,
  courseCount = 0,
  subFolderCount = 0,
  isDragOver,
  onOpen,
  onEdit,
  onDelete,
  onDragOver,
  onDragLeave,
  onDrop,
}) => {
  const [hovered, setHovered] = useState(false);
  const c = resolveFolderColor(folder.color);

  const collaborators = folder.collaborators || [];
  const labels = folder.labels || [];
  const countLine =
    courseCount > 0
      ? `${courseCount} ${courseCount === 1 ? 'course' : 'courses'}`
      : subFolderCount > 0
        ? `${subFolderCount} ${subFolderCount === 1 ? 'folder' : 'folders'}`
        : 'Empty';

  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) onDragLeave();
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onDragOver={(e) => { e.preventDefault(); onDragOver(folder.id); }}
      onDragLeave={handleDragLeave}
      onDrop={(e) => { e.preventDefault(); onDrop(folder.id); }}
      onClick={() => onOpen(folder.id)}
      style={{
        position: 'relative',
        flex: 'none',
        width: '340px',
        borderRadius: '16px',
        background: '#fff',
        border: isDragOver ? '2px dashed #2C5F3A' : '1px solid #EFE7EC',
        boxShadow: isDragOver
          ? '0 0 0 3px rgba(44,95,58,0.15)'
          : hovered ? '0 10px 28px rgba(30,20,35,0.12)' : '0 1px 4px rgba(0,0,0,0.05)',
        cursor: 'pointer',
        transition: 'box-shadow 0.18s',
        overflow: 'hidden',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {/* Tinted panel */}
      <div style={{ margin: '13px 13px 0', borderRadius: '12px', padding: '18px 20px 20px', background: c.panel }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <h3 style={{
            margin: 0, flex: 1, fontSize: '26px', fontWeight: 500, lineHeight: 1.1,
            letterSpacing: '-0.01em', color: c.title, wordBreak: 'break-word',
          }}>
            {folder.name}
          </h3>
          {collaborators.length > 0 && (
            <div style={{ display: 'flex', flexShrink: 0 }}>
              {collaborators.slice(0, 3).map((p, i) => (
                p.profile_picture_url ? (
                  <img
                    key={p.uid || i}
                    src={p.profile_picture_url}
                    alt={p.display_name}
                    style={{
                      width: '27px', height: '27px', borderRadius: '50%', objectFit: 'cover',
                      border: '2px solid #fff', marginLeft: i ? '-9px' : 0,
                    }}
                  />
                ) : (
                  <span key={p.uid || i} style={{
                    width: '27px', height: '27px', borderRadius: '50%',
                    display: 'grid', placeItems: 'center',
                    background: c.chipBg, color: c.chipText, fontSize: '10px', fontWeight: 700,
                    border: '2px solid #fff', marginLeft: i ? '-9px' : 0,
                  }}>{getInitials(p.display_name)}</span>
                )
              ))}
              {collaborators.length > 3 && (
                <span style={{
                  width: '27px', height: '27px', borderRadius: '50%', display: 'grid', placeItems: 'center',
                  background: '#fff', color: c.chipText, fontSize: '10px', fontWeight: 700,
                  border: '2px solid #fff', marginLeft: '-9px',
                }}>+{collaborators.length - 3}</span>
              )}
            </div>
          )}
        </div>

        <p style={{
          margin: '10px 0 14px', fontSize: '14.5px', lineHeight: 1.4, color: '#7A7580',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {folder.description?.trim() || countLine}
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {labels.map((l) => (
            <span key={l} style={{
              fontSize: '13px', fontWeight: 500, padding: '5px 12px', borderRadius: '20px',
              background: c.chipBg, color: c.chipText,
            }}>{l}</span>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '15px 18px 16px', fontSize: '18px', fontWeight: 500, color: '#383838',
      }}>
        {isDragOver ? <><FolderOpen size={18} color="#2C5F3A" /> Drop here</> : 'View Folder'}
        <span style={{
          marginLeft: 'auto', width: '30px', height: '30px', borderRadius: '8px',
          background: 'rgba(0,0,0,0.05)', display: 'grid', placeItems: 'center', color: '#6B7280',
        }}>
          <ChevronRight size={16} />
        </span>
      </div>

      {/* Hover controls */}
      {hovered && !isDragOver && (
        <div
          style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', gap: '4px' }}
          onClick={(e) => e.stopPropagation()}
        >
          <button className="mc-btn" onClick={() => onEdit(folder)} style={actionBtn} title="Edit folder">
            <Pencil size={12} color="#6B7280" />
          </button>
          <button className="mc-btn" onClick={() => onDelete(folder.id, folder.name)} style={actionBtn} title="Delete folder">
            <Trash2 size={12} color="#F87171" />
          </button>
        </div>
      )}
    </div>
  );
};

const actionBtn = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: '24px', height: '24px',
  background: 'rgba(255,255,255,0.96)', border: '1px solid rgba(0,0,0,0.1)',
  borderRadius: '6px', padding: '0', cursor: 'pointer',
};

export default FolderCard;
