// src/components/teacherProfile/ResourceLibrary.jsx
import { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Plus, Trash2, FolderOpen, Folder, BookMarked, ExternalLink, Check, X, Edit2, Star, PlayCircle, Image as ImageIcon, FileText } from 'lucide-react';
import {
  getLibraryFolders,
  createLibraryFolder,
  deleteLibraryFolder,
  addLinkToFolder,
  deleteLinkFromFolder,
  renameLibraryFolder
} from '../../firebase/dbService';
import { useAuth } from '../../contexts/AuthContext';
import { useFavoriteLinks } from '../../hooks/useFavoriteLinks';
import { typeFromUrl } from '../../utils/blockLinks';
import FavoriteStar from '../common/FavoriteStar';

const colors = {
  bg: '#FFFFFF',
  card: '#FFFFFF',
  accent: '#222',
  accentLight: '#F5F5F5',
  border: '#E5E7EB',
  textPrimary: '#111',
  textSecondary: '#444',
  danger: '#E57373',
  success: '#2C5F3A'
};

const inputStyle = {
  padding: '8px 12px',
  border: `1px solid ${colors.border}`,
  borderRadius: '6px',
  fontSize: '14.3px',
  outline: 'none',
  fontFamily: 'inherit',
  color: colors.textPrimary,
  backgroundColor: '#fff'
};

const ResourceLibrary = ({ currentUser }) => {
  const { org } = useAuth();
  const { favorites, loading: favLoading, isFavorite, toggleFavorite } = useFavoriteLinks();
  const [tab, setTab] = useState('library'); // 'library' | 'favorites'
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState({});

  // New folder state
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [savingFolder, setSavingFolder] = useState(false);

  // Rename folder state: { folderId, name }
  const [renamingFolder, setRenamingFolder] = useState(null);

  // Add link state: { folderId } | null
  const [addingLinkTo, setAddingLinkTo] = useState(null);
  const [newLink, setNewLink] = useState({ title: '', url: '', description: '' });
  const [linkError, setLinkError] = useState('');
  const [savingLink, setSavingLink] = useState(false);

  useEffect(() => {
    if (currentUser?.uid && org) loadFolders();
  }, [currentUser, org]);

  const loadFolders = async () => {
    try {
      setLoading(true);
      const data = await getLibraryFolders(currentUser.uid, org);
      setFolders(data);
    } catch (err) {
      console.error('Error loading library folders:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleFolder = (folderId) => {
    setExpandedFolders(prev => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  // ── Folder CRUD ────────────────────────────────────────────────────────

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    setSavingFolder(true);
    try {
      const id = await createLibraryFolder(currentUser.uid, org, name);
      setFolders(prev => [...prev, { id, name, links: [] }]);
      setExpandedFolders(prev => ({ ...prev, [id]: true }));
      setNewFolderName('');
      setShowNewFolder(false);
    } catch (err) {
      console.error('Error creating folder:', err);
    } finally {
      setSavingFolder(false);
    }
  };

  const handleDeleteFolder = async (folder) => {
    if (!confirm(`Delete folder "${folder.name}" and all ${folder.links?.length || 0} links inside?`)) return;
    try {
      await deleteLibraryFolder(currentUser.uid, org, folder.id);
      setFolders(prev => prev.filter(f => f.id !== folder.id));
    } catch (err) {
      console.error('Error deleting folder:', err);
    }
  };

  const handleRenameFolder = async (folderId) => {
    const name = renamingFolder?.name?.trim();
    if (!name) { setRenamingFolder(null); return; }
    try {
      await renameLibraryFolder(currentUser.uid, org, folderId, name);
      setFolders(prev => prev.map(f => f.id === folderId ? { ...f, name } : f));
      setRenamingFolder(null);
    } catch (err) {
      console.error('Error renaming folder:', err);
    }
  };

  // ── Link CRUD ──────────────────────────────────────────────────────────

  const openAddLink = (folderId) => {
    setAddingLinkTo(folderId);
    setNewLink({ title: '', url: '', description: '' });
    setLinkError('');
    setExpandedFolders(prev => ({ ...prev, [folderId]: true }));
  };

  const handleAddLink = async () => {
    const { title, url, description } = newLink;
    if (!title.trim()) { setLinkError('Title is required'); return; }
    if (!url.trim()) { setLinkError('URL is required'); return; }
    try { new URL(url); } catch { setLinkError('Enter a valid URL (e.g. https://…)'); return; }

    setSavingLink(true);
    try {
      const link = await addLinkToFolder(currentUser.uid, org, addingLinkTo, { title: title.trim(), url: url.trim(), description: description.trim() });
      setFolders(prev => prev.map(f =>
        f.id === addingLinkTo ? { ...f, links: [...(f.links || []), link] } : f
      ));
      setAddingLinkTo(null);
    } catch (err) {
      console.error('Error adding link:', err);
      setLinkError('Failed to save link. Try again.');
    } finally {
      setSavingLink(false);
    }
  };

  const handleDeleteLink = async (folder, link) => {
    try {
      await deleteLinkFromFolder(currentUser.uid, org, folder.id, link);
      setFolders(prev => prev.map(f =>
        f.id === folder.id ? { ...f, links: (f.links || []).filter(l => l.id !== link.id) } : f
      ));
    } catch (err) {
      console.error('Error deleting link:', err);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div style={{ marginTop: '48px' }}>
      {/* Section Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '6px'
      }}>
        <div role="tablist" aria-label="Saved links" style={{ display: 'flex', alignItems: 'center', gap: '22px' }}>
          {[
            { id: 'library', label: 'Resource Library', Icon: BookMarked },
            { id: 'favorites', label: 'Favorites', Icon: Star, count: favorites.length },
          ].map((t) => {
            const { id, label, count } = t;
            const TabIcon = t.Icon;
            const active = tab === id;
            return (
              <button
                key={id}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '9px',
                  background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 6px',
                  borderBottom: `2.5px solid ${active ? colors.accent : 'transparent'}`,
                  color: active ? colors.textPrimary : '#9CA3AF', fontFamily: 'inherit',
                }}
              >
                <TabIcon size={20} color={active ? (id === 'favorites' ? '#F59E0B' : colors.accent) : '#9CA3AF'}
                  fill={id === 'favorites' && active ? '#F59E0B' : 'none'} />
                <span style={{ fontSize: '24.2px', fontWeight: '700' }}>{label}</span>
                {count > 0 && (
                  <span style={{
                    fontSize: '12.5px', fontWeight: '700', color: active ? '#92400E' : '#6B7280',
                    background: active ? '#FEF3C7' : '#F3F4F6', borderRadius: '999px', padding: '2px 8px',
                  }}>{count}</span>
                )}
              </button>
            );
          })}
        </div>
        {tab === 'library' && (
        <button
          onClick={() => { setShowNewFolder(true); setNewFolderName(''); }}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 16px',
            backgroundColor: colors.accent,
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14.3px',
            fontWeight: '600'
          }}
        >
          <Plus size={15} /> New Folder
        </button>
        )}
      </div>

      {/* Private badge */}
      <p style={{
        margin: '0 0 20px',
        fontSize: '13.2px',
        color: colors.textSecondary,
        fontStyle: 'italic'
      }}>
        {tab === 'library'
          ? 'Only visible to you — save links here to quickly reuse them in your courses.'
          : 'Only visible to you — star any link in your library or in a course block to keep it here.'}
      </p>

      {tab === 'favorites' && (
        <FavoritesList favorites={favorites} loading={favLoading} onToggle={toggleFavorite} />
      )}

      {tab === 'library' && (<>

      {/* New Folder Input */}
      {showNewFolder && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '12px 16px',
          backgroundColor: colors.accentLight,
          borderRadius: '10px',
          border: `1px solid ${colors.border}`,
          marginBottom: '12px'
        }}>
          <Folder size={16} color={colors.accent} />
          <input
            autoFocus
            type="text"
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') setShowNewFolder(false); }}
            placeholder="Folder name (e.g. Grade 8 Science)"
            style={{ ...inputStyle, flex: 1 }}
          />
          <button
            onClick={handleCreateFolder}
            disabled={savingFolder || !newFolderName.trim()}
            style={{
              padding: '8px 14px', backgroundColor: colors.accent, color: '#fff',
              border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14.3px', fontWeight: '600',
              opacity: savingFolder || !newFolderName.trim() ? 0.6 : 1
            }}
          >
            {savingFolder ? 'Creating…' : 'Create'}
          </button>
          <button
            onClick={() => setShowNewFolder(false)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary, display: 'flex', alignItems: 'center' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div style={{ padding: '32px', textAlign: 'center', color: colors.textSecondary, fontSize: '15.4px' }}>
          Loading library…
        </div>
      ) : folders.length === 0 ? (
        <div style={{
          padding: '40px 24px',
          textAlign: 'center',
          backgroundColor: colors.accentLight,
          borderRadius: '12px',
          border: `1px dashed ${colors.border}`
        }}>
          <BookMarked size={32} color="#bbb" style={{ marginBottom: '12px' }} />
          <p style={{ margin: '0 0 6px', fontSize: '16.5px', fontWeight: '600', color: colors.textPrimary }}>
            Your library is empty
          </p>
          <p style={{ margin: 0, fontSize: '14.3px', color: colors.textSecondary }}>
            Create a folder and start saving links to videos, worksheets, and activities.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {folders.map(folder => {
            const isExpanded = expandedFolders[folder.id];
            const linkCount = folder.links?.length || 0;
            const isAddingHere = addingLinkTo === folder.id;
            const isRenamingThis = renamingFolder?.id === folder.id;

            return (
              <div
                key={folder.id}
                style={{
                  backgroundColor: colors.card,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '10px',
                  overflow: 'hidden'
                }}
              >
                {/* Folder Header Row */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '12px 16px',
                    cursor: 'pointer',
                    backgroundColor: isExpanded ? colors.accentLight : 'transparent',
                    transition: 'background-color 0.15s'
                  }}
                  onClick={() => toggleFolder(folder.id)}
                >
                  {isExpanded ? <ChevronDown size={16} color={colors.accent} /> : <ChevronRight size={16} color={colors.textSecondary} />}
                  {isExpanded ? <FolderOpen size={17} color={colors.accent} /> : <Folder size={17} color={colors.textSecondary} />}

                  {isRenamingThis ? (
                    <input
                      autoFocus
                      type="text"
                      value={renamingFolder.name}
                      onChange={e => setRenamingFolder({ ...renamingFolder, name: e.target.value })}
                      onKeyDown={e => {
                        e.stopPropagation();
                        if (e.key === 'Enter') handleRenameFolder(folder.id);
                        if (e.key === 'Escape') setRenamingFolder(null);
                      }}
                      onClick={e => e.stopPropagation()}
                      style={{ ...inputStyle, flex: 1, fontSize: '15.4px', fontWeight: '600' }}
                    />
                  ) : (
                    <span style={{ flex: 1, fontSize: '15.4px', fontWeight: '600', color: colors.textPrimary }}>
                      {folder.name}
                    </span>
                  )}

                  <span style={{ fontSize: '13.2px', color: colors.textSecondary, flexShrink: 0 }}>
                    {linkCount} {linkCount === 1 ? 'link' : 'links'}
                  </span>

                  {/* Folder actions */}
                  <div style={{ display: 'flex', gap: '4px' }} onClick={e => e.stopPropagation()}>
                    {isRenamingThis ? (
                      <>
                        <button
                          onClick={() => handleRenameFolder(folder.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.success, display: 'flex', alignItems: 'center', padding: '4px' }}
                          title="Save name"
                        >
                          <Check size={15} />
                        </button>
                        <button
                          onClick={() => setRenamingFolder(null)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary, display: 'flex', alignItems: 'center', padding: '4px' }}
                        >
                          <X size={15} />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setRenamingFolder({ id: folder.id, name: folder.name })}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary, display: 'flex', alignItems: 'center', padding: '4px' }}
                        title="Rename folder"
                      >
                        <Edit2 size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => openAddLink(folder.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '4px',
                        padding: '4px 10px',
                        backgroundColor: 'transparent',
                        color: colors.accent,
                        border: `1px solid ${colors.border}`,
                        borderRadius: '5px',
                        cursor: 'pointer',
                        fontSize: '13.2px',
                        fontWeight: '600'
                      }}
                      title="Add link"
                    >
                      <Plus size={13} /> Add Link
                    </button>
                    <button
                      onClick={() => handleDeleteFolder(folder)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.danger, display: 'flex', alignItems: 'center', padding: '4px' }}
                      title="Delete folder"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Expanded: Links + Add-link form */}
                {isExpanded && (
                  <div style={{ borderTop: `1px solid ${colors.border}` }}>
                    {/* Links list */}
                    {(folder.links || []).length === 0 && !isAddingHere && (
                      <div style={{ padding: '16px 20px', fontSize: '14.3px', color: colors.textSecondary, fontStyle: 'italic' }}>
                        No links yet. Click "Add Link" to save one.
                      </div>
                    )}

                    {(folder.links || []).map((link, idx) => (
                      <div
                        key={link.id || idx}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '10px',
                          padding: '12px 20px',
                          borderBottom: `1px solid ${colors.border}`,
                          backgroundColor: '#FAFAFA'
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: '0 0 3px', fontSize: '14.3px', fontWeight: '600', color: colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {link.title}
                          </p>
                          {link.description && (
                            <p style={{ margin: '0 0 4px', fontSize: '13.2px', color: colors.textSecondary }}>
                              {link.description}
                            </p>
                          )}
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: '13.2px', color: '#007bff', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px', fontWeight: '500' }}
                          >
                            {link.url.length > 50 ? link.url.slice(0, 50) + '…' : link.url}
                            <ExternalLink size={11} />
                          </a>
                        </div>
                        <FavoriteStar
                          active={isFavorite(link.url)}
                          onToggle={() => toggleFavorite({ url: link.url, title: link.title, description: link.description, kind: typeFromUrl(link.url), source: 'library' })}
                          size={15}
                        />
                        <button
                          onClick={() => handleDeleteLink(folder, link)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.danger, display: 'flex', alignItems: 'center', padding: '2px', flexShrink: 0 }}
                          title="Delete link"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}

                    {/* Add-link inline form */}
                    {isAddingHere && (
                      <div style={{ padding: '16px 20px', backgroundColor: colors.accentLight, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <p style={{ margin: 0, fontSize: '13.2px', fontWeight: '700', color: colors.textSecondary, letterSpacing: '0.4px' }}>
                          ADD LINK TO "{folder.name.toUpperCase()}"
                        </p>
                        <input
                          autoFocus
                          type="text"
                          placeholder="Title *"
                          value={newLink.title}
                          onChange={e => { setNewLink(l => ({ ...l, title: e.target.value })); setLinkError(''); }}
                          style={{ ...inputStyle, width: '100%' }}
                        />
                        <input
                          type="url"
                          placeholder="URL * (https://…)"
                          value={newLink.url}
                          onChange={e => { setNewLink(l => ({ ...l, url: e.target.value })); setLinkError(''); }}
                          style={{ ...inputStyle, width: '100%' }}
                        />
                        <input
                          type="text"
                          placeholder="Description (optional)"
                          value={newLink.description}
                          onChange={e => setNewLink(l => ({ ...l, description: e.target.value }))}
                          style={{ ...inputStyle, width: '100%' }}
                        />
                        {linkError && (
                          <p style={{ margin: 0, fontSize: '13.2px', color: colors.danger }}>{linkError}</p>
                        )}
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={handleAddLink}
                            disabled={savingLink}
                            style={{
                              padding: '8px 16px', backgroundColor: colors.accent, color: '#fff',
                              border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14.3px', fontWeight: '600',
                              opacity: savingLink ? 0.6 : 1
                            }}
                          >
                            {savingLink ? 'Saving…' : 'Save Link'}
                          </button>
                          <button
                            onClick={() => { setAddingLinkTo(null); setLinkError(''); }}
                            style={{
                              padding: '8px 16px', backgroundColor: '#f3f4f6', color: colors.textPrimary,
                              border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14.3px', fontWeight: '600'
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      </>)}
    </div>
  );
};

// ── Favorites tab ─────────────────────────────────────────────────────────────
const KIND_ICON = { video: PlayCircle, image: ImageIcon, article: FileText };
const SOURCE_LABEL = { library: 'Library', discover: 'Discover', block: 'Course block' };

const FavoritesList = ({ favorites, loading, onToggle }) => {
  if (loading) {
    return <div style={{ padding: '32px', textAlign: 'center', color: colors.textSecondary, fontSize: '15.4px' }}>Loading favorites…</div>;
  }
  if (favorites.length === 0) {
    return (
      <div style={{
        padding: '40px 24px', textAlign: 'center', backgroundColor: colors.accentLight,
        borderRadius: '12px', border: `1px dashed ${colors.border}`,
      }}>
        <Star size={32} color="#E5C46B" style={{ marginBottom: '12px' }} />
        <p style={{ margin: '0 0 6px', fontSize: '16.5px', fontWeight: '600', color: colors.textPrimary }}>No favorites yet</p>
        <p style={{ margin: 0, fontSize: '14.3px', color: colors.textSecondary }}>
          Click the ☆ next to any link — in a library folder or in a course block&apos;s links — to add it here.
        </p>
      </div>
    );
  }
  return (
    <div style={{ border: `1px solid ${colors.border}`, borderRadius: '10px', overflow: 'hidden' }}>
      {favorites.map((fav, idx) => {
        const kind = fav.kind || typeFromUrl(fav.url);
        const Icon = KIND_ICON[kind] || FileText;
        return (
          <div key={fav.id} style={{
            display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 18px',
            borderTop: idx === 0 ? 'none' : `1px solid ${colors.border}`, backgroundColor: '#FAFAFA',
          }}>
            {kind === 'image' && (fav.imageUrl || fav.url) ? (
              <img src={fav.imageUrl || fav.url} alt="" loading="lazy" referrerPolicy="no-referrer"
                style={{ width: '44px', height: '44px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0, background: '#EEE' }} />
            ) : (
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={16} color="#6B7280" />
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: '0 0 3px', fontSize: '14.3px', fontWeight: '600', color: colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {fav.title || fav.url}
              </p>
              {fav.description && (
                <p style={{ margin: '0 0 4px', fontSize: '13.2px', color: colors.textSecondary }}>{fav.description}</p>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <a href={fav.url} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: '13.2px', color: '#007bff', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px', fontWeight: '500' }}>
                  {fav.url.length > 50 ? fav.url.slice(0, 50) + '…' : fav.url}
                  <ExternalLink size={11} />
                </a>
                {SOURCE_LABEL[fav.source] && (
                  <span style={{ fontSize: '11.5px', fontWeight: '600', color: '#6B7280', background: '#F3F4F6', borderRadius: '999px', padding: '1px 8px' }}>
                    {SOURCE_LABEL[fav.source]}
                  </span>
                )}
              </div>
            </div>
            <FavoriteStar active onToggle={() => onToggle(fav)} size={15} />
          </div>
        );
      })}
    </div>
  );
};

export default ResourceLibrary;
