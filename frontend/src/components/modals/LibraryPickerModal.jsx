// src/components/modals/LibraryPickerModal.jsx
import { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronDown, FolderOpen, Folder, ExternalLink, BookMarked } from 'lucide-react';
import { getLibraryFolders } from '../../firebase/dbService';

const colors = {
  accent: '#8b7355',
  accentLight: '#F5F3EE',
  border: '#E8E6E1',
  textPrimary: '#2C2A26',
  textSecondary: '#6B6760'
};

const LibraryPickerModal = ({ isOpen, onClose, onSelect, currentUser }) => {
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState({});

  useEffect(() => {
    if (isOpen && currentUser?.uid) {
      loadFolders();
    }
  }, [isOpen, currentUser]);

  const loadFolders = async () => {
    setLoading(true);
    try {
      const data = await getLibraryFolders(currentUser.uid);
      setFolders(data);
      // Auto-expand first folder that has links
      const firstWithLinks = data.find(f => f.links?.length > 0);
      if (firstWithLinks) {
        setExpandedFolders({ [firstWithLinks.id]: true });
      }
    } catch (err) {
      console.error('Error loading library:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const toggleFolder = (folderId) => {
    setExpandedFolders(prev => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  const handleSelect = (link) => {
    onSelect({ title: link.title, url: link.url, description: link.description || '' });
    onClose();
  };

  const totalLinks = folders.reduce((sum, f) => sum + (f.links?.length || 0), 0);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 3000,
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '14px',
          padding: '0',
          width: '100%',
          maxWidth: '480px',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.25)',
          maxHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '18px 24px',
          borderBottom: `1px solid ${colors.border}`,
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BookMarked size={18} color={colors.accent} />
            <div>
              <h3 style={{ margin: 0, fontSize: '17.6px', color: colors.textPrimary, fontWeight: '700' }}>
                Pick from Library
              </h3>
              <p style={{ margin: 0, fontSize: '13.2px', color: colors.textSecondary }}>
                {totalLinks} saved {totalLinks === 1 ? 'link' : 'links'} across {folders.length} {folders.length === 1 ? 'folder' : 'folders'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', color: colors.textSecondary }}
          >
            <X size={22} />
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: colors.textSecondary, fontSize: '15.4px' }}>
              Loading your library…
            </div>
          ) : folders.length === 0 ? (
            <div style={{ padding: '40px 24px', textAlign: 'center' }}>
              <BookMarked size={36} color={colors.border} style={{ marginBottom: '12px' }} />
              <p style={{ margin: '0 0 6px', fontSize: '16.5px', fontWeight: '600', color: colors.textPrimary }}>
                No saved links yet
              </p>
              <p style={{ margin: 0, fontSize: '14.3px', color: colors.textSecondary }}>
                Add links to your Resource Library on your profile page, then pick them here.
              </p>
            </div>
          ) : (
            <div>
              {folders.map(folder => {
                const isExpanded = expandedFolders[folder.id];
                const linkCount = folder.links?.length || 0;

                return (
                  <div key={folder.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                    {/* Folder row */}
                    <button
                      onClick={() => toggleFolder(folder.id)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '13px 20px',
                        backgroundColor: isExpanded ? colors.accentLight : 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'background-color 0.15s'
                      }}
                    >
                      {isExpanded
                        ? <ChevronDown size={15} color={colors.accent} />
                        : <ChevronRight size={15} color={colors.textSecondary} />}
                      {isExpanded
                        ? <FolderOpen size={16} color={colors.accent} />
                        : <Folder size={16} color={colors.textSecondary} />}
                      <span style={{ flex: 1, fontSize: '15.4px', fontWeight: '600', color: colors.textPrimary }}>
                        {folder.name}
                      </span>
                      <span style={{ fontSize: '13.2px', color: colors.textSecondary }}>
                        {linkCount} {linkCount === 1 ? 'link' : 'links'}
                      </span>
                    </button>

                    {/* Links */}
                    {isExpanded && (
                      <div>
                        {linkCount === 0 ? (
                          <div style={{ padding: '12px 20px 12px 52px', fontSize: '14.3px', color: colors.textSecondary, fontStyle: 'italic' }}>
                            No links in this folder.
                          </div>
                        ) : (
                          folder.links.map((link, idx) => (
                            <button
                              key={link.id || idx}
                              onClick={() => handleSelect(link)}
                              style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '10px',
                                padding: '11px 20px 11px 52px',
                                backgroundColor: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                textAlign: 'left',
                                borderTop: `1px solid ${colors.border}`,
                                transition: 'background-color 0.15s'
                              }}
                              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#F0ECE5'}
                              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ margin: '0 0 2px', fontSize: '14.3px', fontWeight: '600', color: colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {link.title}
                                </p>
                                <p style={{ margin: 0, fontSize: '12.1px', color: colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                  <ExternalLink size={10} />
                                  {link.url.length > 45 ? link.url.slice(0, 45) + '…' : link.url}
                                </p>
                                {link.description && (
                                  <p style={{ margin: '3px 0 0', fontSize: '12.1px', color: colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {link.description}
                                  </p>
                                )}
                              </div>
                              <span style={{
                                flexShrink: 0,
                                fontSize: '12.1px',
                                fontWeight: '600',
                                color: colors.accent,
                                backgroundColor: colors.accentLight,
                                padding: '3px 8px',
                                borderRadius: '10px',
                                marginTop: '2px'
                              }}>
                                Use
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div style={{
          padding: '12px 20px',
          borderTop: `1px solid ${colors.border}`,
          backgroundColor: colors.accentLight,
          flexShrink: 0
        }}>
          <p style={{ margin: 0, fontSize: '13.2px', color: colors.textSecondary }}>
            Manage your library from your profile page.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LibraryPickerModal;
