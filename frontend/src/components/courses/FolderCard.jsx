import { useState } from 'react';
import { Folder, FolderOpen, Pencil, Trash2 } from 'lucide-react';

const FolderCard = ({
  folder,
  courseCount,
  subFolderCount = 0,
  isDragOver,
  onOpen,
  onRename,
  onDelete,
  onDragOver,
  onDragLeave,
  onDrop,
}) => {
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(folder.name);

  const commitRename = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== folder.name) onRename(folder.id, trimmed);
    setEditing(false);
  };

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
      onClick={() => !editing && onOpen(folder.id)}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        padding: '20px 16px 14px',
        borderRadius: '12px',
        background: isDragOver ? 'rgba(44,95,58,0.08)' : 'rgba(255,255,255,0.72)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: isDragOver ? '2px dashed #2C5F3A' : '1px solid rgba(255,255,255,0.88)',
        boxShadow: isDragOver
          ? '0 0 0 3px rgba(44,95,58,0.15)'
          : hovered ? '0 6px 24px rgba(0,0,0,0.10)' : '0 1px 6px rgba(0,0,0,0.07)',
        cursor: 'pointer',
        transition: 'all 0.18s',
        width: '130px',
        minHeight: '110px',
        textAlign: 'center',
        userSelect: 'none',
        boxSizing: 'border-box',
      }}
    >
      {isDragOver
        ? <FolderOpen size={36} color="#2C5F3A" />
        : <Folder size={36} color={hovered ? '#2C5F3A' : '#9CA3AF'} />
      }

      {editing ? (
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: '5px', width: '100%' }}
          onClick={e => e.stopPropagation()}
        >
          <input
            autoFocus
            value={editName}
            onChange={e => setEditName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') { setEditing(false); setEditName(folder.name); }
            }}
            onBlur={commitRename}
            style={{
              width: '100%', padding: '3px 6px', fontSize: '12px',
              borderRadius: '4px', border: '1px solid #2C5F3A',
              outline: 'none', textAlign: 'center', boxSizing: 'border-box',
              fontFamily: "'DM Sans', sans-serif",
            }}
          />
        </div>
      ) : (
        <span style={{ fontSize: '13px', fontWeight: '600', color: '#111', lineHeight: '1.3', wordBreak: 'break-word' }}>
          {folder.name}
        </span>
      )}

      <span style={{ fontSize: '11px', color: '#9CA3AF' }}>
        {courseCount > 0
          ? `${courseCount} ${courseCount === 1 ? 'course' : 'courses'}`
          : subFolderCount > 0
            ? `${subFolderCount} ${subFolderCount === 1 ? 'folder' : 'folders'}`
            : 'Empty'
        }
      </span>

      {hovered && !editing && (
        <div
          style={{ position: 'absolute', top: '7px', right: '7px', display: 'flex', gap: '3px' }}
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={() => { setEditing(true); setEditName(folder.name); }}
            style={actionBtn}
            title="Rename folder"
          >
            <Pencil size={10} color="#6B7280" />
          </button>
          <button
            onClick={() => onDelete(folder.id, folder.name)}
            style={actionBtn}
            title="Delete folder"
          >
            <Trash2 size={10} color="#F87171" />
          </button>
        </div>
      )}

      {isDragOver && (
        <span style={{ fontSize: '11px', color: '#2C5F3A', fontWeight: '500', marginTop: '2px' }}>
          Drop here
        </span>
      )}
    </div>
  );
};

const actionBtn = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: '20px', height: '20px',
  background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(0,0,0,0.1)',
  borderRadius: '4px', padding: '0', cursor: 'pointer',
};

export default FolderCard;
