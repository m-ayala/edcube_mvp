// src/components/courses/LinksPanel.jsx
// A list of links grouped into Articles / Images / Videos, with optional Add link,
// Library and Discover controls. Used by the section's Resources column (all controls)
// and by the topic-box pop-up (links already saved on a box: rename / favorite / remove only).
import { useState, useEffect, useRef } from 'react';
import { ExternalLink, Trash2, Plus, Sparkles, Loader2, Library, Check, X, Pencil, FileText, Image as ImageIcon, PlayCircle } from 'lucide-react';
import { linkGroupOf, manualLink, mergeLinks } from '../../utils/blockLinks';
import { getLibraryFolders } from '../../firebase/dbService';
import { useAuth } from '../../contexts/AuthContext';
import { useAiGate } from '../../contexts/usageContextCore';
import AiPausedHint from '../AiPausedHint';
import FavoriteStar from '../common/FavoriteStar';
import { useFavoriteLinks } from '../../hooks/useFavoriteLinks';

const FONT = "'DM Sans', sans-serif";

const btnBase = {
  display: 'flex', alignItems: 'center', gap: '5px',
  padding: '5px 12px', borderRadius: '7px', cursor: 'pointer',
  fontSize: '12.7px', fontWeight: '600',
  background: '#F5F3EE', color: '#555',
  border: '1px solid rgba(0,0,0,0.12)',
  fontFamily: FONT,
};
const iconBtn = { background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', flexShrink: 0 };
const fieldStyle = { fontFamily: FONT, fontSize: '13.5px', color: '#111', border: '1.5px solid rgba(0,0,0,0.15)', borderRadius: '7px', padding: '8px 12px', outline: 'none', background: '#FAFAFA', width: '100%', boxSizing: 'border-box' };

const LinksPanel = ({
  links = [],
  onChange,                 // (nextLinks) => void
  heading = 'Links & Resources',
  controls = true,          // show Add link / Library / Discover
  onDiscover = null,        // () => void; Discover is hidden when null
  discoverStatus,           // 'generating' | 'done' | 'empty' | 'error' | undefined
  searchingText = 'Finding articles, images and videos. This can take up to a minute.',
  emptyText = 'No links yet — add a URL, pick from your library, or press Discover.',
  imageMinWidth = 150,
  readOnly = false,
  boxTitleOf = null,        // (link) => title of the topic box the link was found for, or null
  onOpenBox = null,         // (link) => open that topic box
}) => {
  const genPaused = useAiGate('generates');
  const { currentUser, org } = useAuth();
  const { isFavorite, toggleFavorite } = useFavoriteLinks();

  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [editingLinkId, setEditingLinkId] = useState(null);
  const [editingLinkLabel, setEditingLinkLabel] = useState('');
  const [hoveredLinkId, setHoveredLinkId] = useState(null);
  // Image links whose picture failed to load (e.g. hotlinking blocked) show as a plain link row.
  const [brokenImageIds, setBrokenImageIds] = useState(() => new Set());

  const [showLibraryPicker, setShowLibraryPicker] = useState(false);
  const [libraryFolders, setLibraryFolders] = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [expandedLibFolders, setExpandedLibFolders] = useState({});
  const libraryRef = useRef(null);

  useEffect(() => {
    if (!showLibraryPicker) return;
    const handleOutside = (e) => {
      if (libraryRef.current && !libraryRef.current.contains(e.target)) setShowLibraryPicker(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [showLibraryPicker]);

  const favLink = (link) => ({
    url: link.url,
    title: link.label || link.caption || link.url,
    description: link.reason || '',
    kind: linkGroupOf(link),
    source: link.reason ? 'discover' : 'block',   // Discover results carry a `reason`
    ...(link.imageUrl ? { imageUrl: link.imageUrl } : {}),
  });

  const closeLinkInput = () => { setShowLinkInput(false); setNewLinkUrl(''); setNewLinkLabel(''); };

  const handleAddLink = () => {
    const url = newLinkUrl.trim();
    if (!url) return;
    onChange?.(mergeLinks(links, [manualLink(url, newLinkLabel.trim())]));
    closeLinkInput();
  };

  const handleRemoveLink = (linkId) => onChange?.(links.filter(l => l.id !== linkId));

  const handleSaveLinkLabel = (linkId) => {
    const label = editingLinkLabel.trim();
    if (label) onChange?.(links.map(l => l.id === linkId ? { ...l, label } : l));
    setEditingLinkId(null);
  };

  const handleToggleLibrary = async () => {
    if (!showLibraryPicker && libraryFolders.length === 0 && currentUser?.uid && org) {
      setLibraryLoading(true);
      try {
        setLibraryFolders(await getLibraryFolders(currentUser.uid, org));
      } catch (e) {
        console.error('Library load failed:', e);
      } finally {
        setLibraryLoading(false);
      }
    }
    setShowLibraryPicker(p => !p);
  };

  const handleAddLibraryLink = (libLink) => {
    onChange?.(mergeLinks(links, [manualLink(libLink.url, libLink.title)]));
    setShowLibraryPicker(false);
  };

  // "For: <box>" tag on a link Discover found for a specific topic box.
  const boxTag = (link, style = {}) => {
    const title = boxTitleOf?.(link);
    if (!title) return null;
    return (
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onOpenBox?.(link); }}
        title={`Found for the box "${title}"${onOpenBox ? ' — click to open it' : ''}`}
        style={{
          display: 'inline-block', maxWidth: '100%', boxSizing: 'border-box', overflow: 'hidden', textOverflow: 'ellipsis',
          whiteSpace: 'nowrap', padding: '1px 8px', borderRadius: '10px', border: '1px solid #DBE3F7',
          background: '#EEF3FF', color: '#3E5BA9', fontSize: '11px', fontWeight: 600, fontFamily: FONT,
          cursor: onOpenBox ? 'pointer' : 'default', textAlign: 'left', ...style,
        }}
      >For: {title}</button>
    );
  };

  const isGenerating = discoverStatus === 'generating';
  const genEmpty = discoverStatus === 'empty';
  const genError = discoverStatus === 'error';

  const groupedLinks = { article: [], image: [], video: [] };
  links.forEach(link => groupedLinks[linkGroupOf(link)].push(link));

  const renderLinkRow = (link) => (
    <div
      key={link.id}
      onMouseEnter={() => setHoveredLinkId(link.id)}
      onMouseLeave={() => setHoveredLinkId(null)}
      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: '#FAFAF8', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '8px', minWidth: 0 }}
    >
      <ExternalLink size={13} color="#6B7280" style={{ flexShrink: 0 }} />
      {editingLinkId === link.id ? (
        <>
          <input
            autoFocus type="text" value={editingLinkLabel}
            onChange={e => setEditingLinkLabel(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSaveLinkLabel(link.id); if (e.key === 'Escape') setEditingLinkId(null); }}
            style={{ flex: 1, minWidth: 0, fontSize: '13.5px', color: '#111', fontFamily: FONT, border: '1px solid rgba(99,102,241,0.4)', borderRadius: '5px', padding: '2px 8px', outline: 'none', background: '#fff' }}
          />
          <button onClick={() => handleSaveLinkLabel(link.id)} style={{ ...iconBtn, color: '#2C5F3A' }}><Check size={13} /></button>
          <button onClick={() => setEditingLinkId(null)} style={{ ...iconBtn, color: '#9CA3AF' }}><X size={13} /></button>
        </>
      ) : (
        <>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'flex-start' }}>
            <a href={link.url} target="_blank" rel="noopener noreferrer"
              title={link.reason || link.url}
              style={{ maxWidth: '100%', fontSize: '13.5px', color: '#2563EB', fontFamily: FONT, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
              onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
            >{link.label || link.caption || link.url}</a>
            {boxTag(link)}
          </div>
          {!readOnly && hoveredLinkId === link.id && (
            <button onClick={() => { setEditingLinkId(link.id); setEditingLinkLabel(link.label || ''); }} style={{ ...iconBtn, color: '#9CA3AF' }}><Pencil size={12} /></button>
          )}
          <FavoriteStar active={isFavorite(link.url)} onToggle={() => toggleFavorite(favLink(link))} size={13} />
          {!readOnly && (
            <button onClick={() => handleRemoveLink(link.id)} title="Delete link" style={{ ...iconBtn, color: '#F87171' }}><Trash2 size={12} /></button>
          )}
        </>
      )}
    </div>
  );

  const renderImageCard = (link) => (
    <div key={link.id} style={{ position: 'relative', background: '#FAFAF8', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '8px', overflow: 'hidden', minWidth: 0 }}>
      <a href={link.url} target="_blank" rel="noopener noreferrer" title={link.reason || link.url} style={{ display: 'block' }}>
        <img
          src={link.imageUrl || link.url}
          alt={link.caption || link.label || ''}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setBrokenImageIds(prev => new Set(prev).add(link.id))}
          style={{ display: 'block', width: '100%', height: '110px', objectFit: 'cover', background: '#EEE' }}
        />
      </a>
      <div style={{ padding: '6px 48px 7px 9px' }}>
        <p style={{ margin: 0, fontSize: '12px', color: '#4B5563', lineHeight: 1.35, fontFamily: FONT, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {link.caption || link.label}
        </p>
        {boxTag(link, { marginTop: '4px' })}
      </div>
      <FavoriteStar
        active={isFavorite(link.url)}
        onToggle={() => toggleFavorite(favLink(link))}
        size={13}
        style={{ position: 'absolute', right: '26px', bottom: '6px' }}
      />
      {!readOnly && (
        <button
          onClick={() => handleRemoveLink(link.id)}
          aria-label="Remove image"
          style={{ ...iconBtn, position: 'absolute', right: '6px', bottom: '6px', color: '#F87171' }}
        ><Trash2 size={12} /></button>
      )}
    </div>
  );

  const renderGroup = (key, title, icon) => {
    const items = groupedLinks[key];
    if (items.length === 0 && !isGenerating) return null;
    const images = key === 'image' ? items.filter(l => !brokenImageIds.has(l.id)) : [];
    const rows = key === 'image' ? items.filter(l => brokenImageIds.has(l.id)) : items;
    return (
      <div key={key} style={{ marginTop: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontSize: '12px', fontWeight: '700', color: '#6B7280', fontFamily: FONT }}>
          {icon} {title}
          {items.length > 0 && <span style={{ fontWeight: '500', color: '#AAA' }}>({items.length})</span>}
        </div>
        {items.length === 0 && (
          <p style={{ margin: 0, fontSize: '13px', color: '#AAA', fontStyle: 'italic', fontFamily: FONT }}>Searching…</p>
        )}
        {images.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${imageMinWidth}px, 1fr))`, gap: '8px', marginBottom: rows.length ? '8px' : 0 }}>
            {images.map(renderImageCard)}
          </div>
        )}
        {rows.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {rows.map(renderLinkRow)}
          </div>
        )}
      </div>
    );
  };

  const showControls = controls && !readOnly;

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: FONT }}>
          {heading}
        </label>
        {showControls && (
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
            {onDiscover && (
              <button
                onClick={onDiscover}
                disabled={isGenerating || genPaused.blocked}
                title={genPaused.blocked ? genPaused.message : 'Find articles, images and videos for every topic in this section'}
                style={{ ...btnBase, background: isGenerating ? '#F0F4FF' : '#EEF2FF', color: isGenerating ? '#4338CA' : '#3730A3', border: '1px solid rgba(99,102,241,0.3)', cursor: isGenerating ? 'default' : 'pointer' }}
              >
                {isGenerating ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Discovering…</> : <><Sparkles size={13} /> Discover</>}
              </button>
            )}
            <button onClick={() => setShowLinkInput(p => !p)} style={btnBase}>
              <Plus size={13} /> Add link
            </button>
            <button onClick={handleToggleLibrary} style={btnBase}>
              <Library size={13} /> Library
            </button>
          </div>
        )}
        {showControls && onDiscover && <AiPausedHint kind="generates" style={{ width: '100%' }} />}
        {(genEmpty || genError) && (
          <p style={{ margin: 0, fontSize: '12px', color: genError ? '#B91C1C' : '#888', fontFamily: FONT }}>
            {genError ? 'Discover failed. Try again.' : 'No results found. Try giving the section or its topics clearer titles.'}
          </p>
        )}
      </div>

      {/* Add link form */}
      {showControls && showLinkInput && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
          <input
            type="url" value={newLinkUrl} autoFocus placeholder="https://…"
            onChange={e => setNewLinkUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddLink(); if (e.key === 'Escape') closeLinkInput(); }}
            style={fieldStyle}
          />
          <input
            type="text" value={newLinkLabel} placeholder="Label (optional)"
            onChange={e => setNewLinkLabel(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddLink(); if (e.key === 'Escape') closeLinkInput(); }}
            style={fieldStyle}
          />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleAddLink} disabled={!newLinkUrl.trim()}
              style={{ padding: '7px 16px', borderRadius: '7px', cursor: newLinkUrl.trim() ? 'pointer' : 'default', fontSize: '13px', fontWeight: '600', background: newLinkUrl.trim() ? '#111' : '#E5E7EB', color: newLinkUrl.trim() ? '#FFF' : '#9CA3AF', border: 'none', fontFamily: FONT }}
            >Add link</button>
            <button
              onClick={closeLinkInput}
              style={{ padding: '7px 16px', borderRadius: '7px', cursor: 'pointer', fontSize: '13px', fontWeight: '500', background: 'transparent', color: '#6B7280', border: '1px solid rgba(0,0,0,0.12)', fontFamily: FONT }}
            >Cancel</button>
          </div>
        </div>
      )}

      {/* Library picker */}
      {showControls && showLibraryPicker && (
        <div ref={libraryRef} style={{ background: '#F9FAFB', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '8px', marginTop: '12px', maxHeight: '240px', overflowY: 'auto' }}>
          {libraryLoading && <p style={{ margin: 0, padding: '12px 14px', fontSize: '13px', color: '#999', fontFamily: FONT }}>Loading library…</p>}
          {!libraryLoading && libraryFolders.length === 0 && <p style={{ margin: 0, padding: '12px 14px', fontSize: '13px', color: '#AAA', fontStyle: 'italic', fontFamily: FONT }}>No library folders yet.</p>}
          {libraryFolders.map(folder => (
            <div key={folder.id}>
              <div
                onClick={() => setExpandedLibFolders(p => ({ ...p, [folder.id]: !p[folder.id] }))}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', color: '#333', fontFamily: FONT, borderBottom: '1px solid rgba(0,0,0,0.05)', userSelect: 'none' }}
              >
                <span>{expandedLibFolders[folder.id] ? '▾' : '▸'}</span>
                <span style={{ flex: 1 }}>{folder.name}</span>
                <span style={{ color: '#AAA', fontWeight: '400', fontSize: '12px' }}>({folder.links?.length || 0})</span>
              </div>
              {expandedLibFolders[folder.id] && (folder.links || []).map(libLink => (
                <div
                  key={libLink.id}
                  onClick={() => handleAddLibraryLink(libLink)}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 14px 6px 30px', cursor: 'pointer', fontSize: '13px', color: '#444', fontFamily: FONT }}
                  onMouseEnter={e => e.currentTarget.style.background = '#EEF2FF'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <ExternalLink size={11} color="#6B7280" style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{libLink.title}</span>
                  <Plus size={11} color="#4F46E5" style={{ flexShrink: 0 }} />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {isGenerating && (
        <p style={{ margin: '12px 0 0', fontSize: '12.5px', color: '#4338CA', fontFamily: FONT }}>{searchingText}</p>
      )}

      {links.length === 0 && !isGenerating && !showLinkInput && !showLibraryPicker && (
        <p style={{ margin: '12px 0 0', fontSize: '13px', color: '#AAA', fontStyle: 'italic', fontFamily: FONT, lineHeight: 1.5 }}>{emptyText}</p>
      )}

      {renderGroup('article', 'Articles', <FileText size={13} />)}
      {renderGroup('image', 'Images', <ImageIcon size={13} />)}
      {renderGroup('video', 'Videos', <PlayCircle size={13} />)}
    </div>
  );
};

export default LinksPanel;
