// src/components/courses/BlockView.jsx
import { useState, useEffect } from 'react';
import { BLOCK_CATEGORIES, getSubcategoriesForType } from '../../constants/blockCategories';
import { ExternalLink, Trash2, Plus, Edit3, Eye, Sparkles, Loader2, Library, Check, X, Pencil } from 'lucide-react';
import { getLibraryFolders } from '../../firebase/dbService';

const TYPE_COLORS = {
  content:   { bg: '#EAF0FF', text: '#2A4A9A', border: '#BFD0FF', label: 'Content' },
  worksheet: { bg: '#FFF3E8', text: '#9A5C12', border: '#F5C98A', label: 'Worksheet' },
  activity:  { bg: '#EDFFF3', text: '#1E7C43', border: '#86EFAC', label: 'Activity' },
};

const BlockView = ({
  block,
  topicId,
  topicTitle,
  subsectionTitle,
  sectionTitle,
  sectionId,
  subsectionId,
  actions,
  onBack,
  currentUser,
  onGenerateLinks,
  linkGenStatus,
}) => {
  const [localTitle, setLocalTitle] = useState(block?.title || '');
  const [localContent, setLocalContent] = useState(block?.content || '');
  const [localCategory, setLocalCategory] = useState(block?.category || '');
  const [localSubcategory, setLocalSubcategory] = useState(block?.subcategory || '');
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [links, setLinks] = useState(block?.links || []);
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [showLinkInput, setShowLinkInput] = useState(false);

  // Feature 1: inline label edit
  const [editingLinkId, setEditingLinkId] = useState(null);
  const [editingLinkLabel, setEditingLinkLabel] = useState('');
  const [hoveredLinkId, setHoveredLinkId] = useState(null);

  // Feature 2: library picker
  const [showLibraryPicker, setShowLibraryPicker] = useState(false);
  const [libraryFolders, setLibraryFolders] = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [expandedLibFolders, setExpandedLibFolders] = useState({});

  // Sync if block prop changes (e.g. on navigation)
  useEffect(() => {
    setLocalTitle(block?.title || '');
    setLocalContent(block?.content || '');
    setLocalCategory(block?.category || '');
    setLocalSubcategory(block?.subcategory || '');
    setLinks(block?.links || []);
    setIsEditingContent(false);
  }, [block?.id]);

  // Sync links when background generation completes (block.links gets a new array ref)
  useEffect(() => {
    setLinks(block?.links || []);
  }, [block?.links]);

  const blockType = block?.type || 'content';
  const typeStyle = TYPE_COLORS[blockType] || TYPE_COLORS.content;

  const categoryOptions = BLOCK_CATEGORIES.filter(c => c.allowedTypes.includes(blockType));
  const subcategoryGroups = getSubcategoriesForType(blockType).find(g => g.categoryId === localCategory);
  const subcategoryOptions = subcategoryGroups?.subcategories || [];

  const save = (overrides = {}) => {
    actions?.updateBlock?.(topicId, block.id, {
      title: localTitle,
      content: localContent,
      category: localCategory,
      subcategory: localSubcategory,
      links,
      ...overrides,
    });
  };

  const handleCategoryChange = (catId) => {
    setLocalCategory(catId);
    const firstSub = getSubcategoriesForType(blockType).find(g => g.categoryId === catId)?.subcategories?.[0] || '';
    setLocalSubcategory(firstSub);
    actions?.updateBlock?.(topicId, block.id, { category: catId, subcategory: firstSub });
  };

  const handleSubcategoryChange = (sub) => {
    setLocalSubcategory(sub);
    actions?.updateBlock?.(topicId, block.id, { subcategory: sub });
  };

  const handleAddLink = () => {
    const url = newLinkUrl.trim();
    if (!url) return;
    const label = newLinkLabel.trim() || url;
    const updatedLinks = [...links, { id: `link-${Date.now()}`, url, label }];
    setLinks(updatedLinks);
    setNewLinkUrl('');
    setNewLinkLabel('');
    setShowLinkInput(false);
    actions?.updateBlock?.(topicId, block.id, { links: updatedLinks });
  };

  const handleRemoveLink = (linkId) => {
    const updatedLinks = links.filter(l => l.id !== linkId);
    setLinks(updatedLinks);
    actions?.updateBlock?.(topicId, block.id, { links: updatedLinks });
  };

  // Feature 1: inline label edit
  const handleStartEditLabel = (link) => {
    setEditingLinkId(link.id);
    setEditingLinkLabel(link.label);
  };

  const handleSaveLinkLabel = (linkId) => {
    const label = editingLinkLabel.trim();
    if (!label) { setEditingLinkId(null); return; }
    const updated = links.map(l => l.id === linkId ? { ...l, label } : l);
    setLinks(updated);
    actions?.updateBlock?.(topicId, block.id, { links: updated });
    setEditingLinkId(null);
  };

  // Feature 2: library
  const loadLibrary = async () => {
    if (!currentUser?.uid) return;
    setLibraryLoading(true);
    try {
      const folders = await getLibraryFolders(currentUser.uid);
      setLibraryFolders(folders);
    } catch (e) {
      console.error('Library load failed:', e);
    } finally {
      setLibraryLoading(false);
    }
  };

  const handleToggleLibrary = async () => {
    if (!showLibraryPicker && libraryFolders.length === 0) {
      await loadLibrary();
    }
    setShowLibraryPicker(p => !p);
  };

  const handleAddLibraryLink = (libLink) => {
    const newLink = { id: `link-${Date.now()}`, url: libLink.url, label: libLink.title || libLink.url };
    const updated = [...links, newLink];
    setLinks(updated);
    actions?.updateBlock?.(topicId, block.id, { links: updated });
    setShowLibraryPicker(false);
  };

  const inputStyle = {
    fontFamily: "'DM Sans', sans-serif",
    border: '1px solid rgba(0,0,0,0.15)',
    borderRadius: '7px',
    padding: '7px 12px',
    fontSize: '13.5px',
    color: '#111',
    background: '#FAFAFA',
    outline: 'none',
    cursor: 'pointer',
  };

  const renderContentPreview = (text) => {
    if (!text) return <span style={{ color: '#AAA', fontStyle: 'italic' }}>No content yet — click Edit to add content.</span>;
    return text.split('\n').map((line, i) => {
      const isBold = line.match(/^\*\*(.+)\*\*$/);
      if (isBold) return <p key={i} style={{ margin: '12px 0 4px', fontWeight: '700', fontSize: '14px', color: '#222' }}>{isBold[1]}</p>;
      if (line.startsWith('- ')) return <li key={i} style={{ margin: '2px 0', fontSize: '13.5px', color: '#444', marginLeft: '16px' }}>{line.slice(2)}</li>;
      if (line.trim() === '') return <br key={i} />;
      return <p key={i} style={{ margin: '3px 0', fontSize: '13.5px', color: '#374151', lineHeight: '1.65' }}>{line}</p>;
    });
  };

  const btnBase = {
    display: 'flex', alignItems: 'center', gap: '5px',
    padding: '5px 12px', borderRadius: '7px', cursor: 'pointer',
    fontSize: '12.7px', fontWeight: '600',
    background: '#F5F3EE', color: '#555',
    border: '1px solid rgba(0,0,0,0.12)',
    fontFamily: "'DM Sans', sans-serif",
  };

  const isGenerating = linkGenStatus === 'generating';

  const BLOB_BG = `
    radial-gradient(circle at 15% 20%,  rgba(178,232,200,0.22)  0%, transparent 40%),
    radial-gradient(circle at 85% 8%,   rgba(172,216,240,0.22)  0%, transparent 38%),
    radial-gradient(circle at 50% 85%,  rgba(242,192,212,0.18)  0%, transparent 42%),
    radial-gradient(circle at 90% 60%,  rgba(247,228,160,0.18)  0%, transparent 35%),
    radial-gradient(circle at 20% 65%,  rgba(172,216,240,0.15)  0%, transparent 35%),
    #FAFAF9
  `;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: BLOB_BG, overflow: 'hidden' }}>

      {/* ── Top bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 24px', background: '#FFFFFF',
        borderBottom: '1px solid rgba(0,0,0,0.08)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', fontSize: '13px' }}>
          <button
            onClick={onBack}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', fontFamily: "'DM Sans', sans-serif", fontSize: '15px', fontWeight: '500', padding: '4px 0', lineHeight: 1 }}
          >
            ←
          </button>
          {sectionTitle && subsectionTitle && (
            <span style={{ color: '#777', fontSize: '13px' }}>
              {sectionTitle} <span style={{ color: '#BBB' }}>›</span> {subsectionTitle} <span style={{ color: '#BBB' }}>›</span> <strong style={{ color: '#444', fontWeight: '600' }}>{localTitle || 'Untitled Block'}</strong>
            </span>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px 60px' }}>

        {/* Block metadata card */}
        <div style={{ background: 'rgba(255,255,255,0.88)', border: '1.5px solid rgba(255,255,255,0.95)', borderRadius: '12px', padding: '20px 24px', marginBottom: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>

          {/* Type badge */}
          <div style={{ marginBottom: '16px' }}>
            <span style={{
              padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700',
              background: typeStyle.bg, color: typeStyle.text, border: `1px solid ${typeStyle.border}`,
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              {typeStyle.label}
            </span>
          </div>

          {/* Title */}
          <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
            Block Title
          </label>
          <input
            type="text"
            value={localTitle}
            onChange={e => setLocalTitle(e.target.value)}
            onBlur={() => save()}
            placeholder="Enter block title…"
            maxLength={120}
            style={{
              width: '100%', boxSizing: 'border-box',
              fontFamily: "'DM Sans', sans-serif", fontSize: '18px', fontWeight: '700', color: '#111',
              border: '1.5px solid rgba(0,0,0,0.12)', borderRadius: '8px',
              padding: '10px 14px', outline: 'none', background: '#FAFAFA',
            }}
          />
        </div>

        {/* Content area */}
        <div style={{ background: 'rgba(255,255,255,0.88)', border: '1.5px solid rgba(255,255,255,0.95)', borderRadius: '12px', padding: '20px 24px', marginBottom: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Content
              {blockType === 'content' && !isEditingContent && (
                <span style={{ marginLeft: '8px', fontWeight: '400', color: '#BBB', textTransform: 'none', fontSize: '11px' }}>
                  **Header** format
                </span>
              )}
            </label>
            <button
              onClick={() => {
                if (isEditingContent) save();
                setIsEditingContent(p => !p);
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '5px 12px', borderRadius: '7px', cursor: 'pointer',
                fontSize: '12.7px', fontWeight: '600',
                background: isEditingContent ? '#111' : '#F5F3EE',
                color: isEditingContent ? '#FFF' : '#555',
                border: isEditingContent ? 'none' : '1px solid rgba(0,0,0,0.12)',
                fontFamily: "'DM Sans', sans-serif",
                transition: 'all 0.15s',
              }}
            >
              {isEditingContent ? <><Eye size={13} /> Done</> : <><Edit3 size={13} /> Edit</>}
            </button>
          </div>

          {isEditingContent ? (
            <textarea
              autoFocus
              value={localContent}
              onChange={e => setLocalContent(e.target.value)}
              onBlur={() => save()}
              placeholder={
                blockType === 'content'
                  ? '**What is X?**\nWrite a clear, age-appropriate explanation here…\n\n**Key Parts**\n- Part 1\n- Part 2\n\n**How to teach it**\nDescribe the teaching approach…\n\n**Things to consider**\nAny notes for the teacher…\n\n**Example**\nA concrete example…'
                  : blockType === 'worksheet'
                    ? 'Describe the worksheet: type, what students do, key prompts or questions…'
                    : 'Describe the activity: setup, grouping, step-by-step facilitation, timing, debrief…'
              }
              style={{
                width: '100%', boxSizing: 'border-box',
                fontFamily: "'DM Mono', 'Courier New', monospace", fontSize: '13.5px', color: '#222',
                lineHeight: '1.7', border: '1.5px solid #111', borderRadius: '8px',
                padding: '14px 16px', outline: 'none', resize: 'vertical',
                background: '#FAFAFA', minHeight: '320px',
              }}
            />
          ) : (
            <div
              onClick={() => setIsEditingContent(true)}
              title="Click to edit"
              style={{
                minHeight: '120px', padding: '14px 16px',
                border: '1.5px solid rgba(0,0,0,0.08)', borderRadius: '8px',
                background: '#FAFAFA', cursor: 'text',
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              {renderContentPreview(localContent)}
            </div>
          )}
        </div>

        {/* Links section */}
        <div style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '12px', padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', position: 'relative' }}>

          {/* Header row: label + three buttons */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', gap: '8px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
              Links & Resources
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              {/* Add Link */}
              <button onClick={() => setShowLinkInput(p => !p)} style={btnBase}>
                <Plus size={13} /> Add Link
              </button>

              {/* From Library */}
              <button onClick={handleToggleLibrary} style={btnBase}>
                <Library size={13} /> Library
              </button>

              {/* AI Generate */}
              <button
                onClick={() => {
                  console.log('[Generate click]', { blockId: block?.id, topicId, hasHandler: !!onGenerateLinks, isGenerating });
                  onGenerateLinks?.(block.id, topicId, block);
                }}
                disabled={isGenerating || !onGenerateLinks}
                style={{
                  ...btnBase,
                  background: isGenerating ? '#F0F4FF' : '#F5F3EE',
                  color: isGenerating ? '#4338CA' : '#555',
                  border: isGenerating ? '1px solid rgba(99,102,241,0.3)' : '1px solid rgba(0,0,0,0.12)',
                  cursor: isGenerating ? 'default' : 'pointer',
                  opacity: (!onGenerateLinks && !isGenerating) ? 0.5 : 1,
                }}
              >
                {isGenerating
                  ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Generating…</>
                  : <><Sparkles size={13} /> Generate</>
                }
              </button>
            </div>
          </div>

          {/* Library picker panel */}
          {showLibraryPicker && (
            <>
              {/* Transparent backdrop to dismiss */}
              <div
                onClick={() => setShowLibraryPicker(false)}
                style={{ position: 'fixed', inset: 0, zIndex: 0 }}
              />
              <div style={{
                position: 'relative', zIndex: 1,
                background: '#F9FAFB', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '8px',
                marginBottom: '12px', maxHeight: '220px', overflowY: 'auto',
              }}>
                {libraryLoading && (
                  <p style={{ margin: 0, padding: '12px 14px', fontSize: '13px', color: '#999', fontFamily: "'DM Sans', sans-serif" }}>
                    Loading library…
                  </p>
                )}
                {!libraryLoading && libraryFolders.length === 0 && (
                  <p style={{ margin: 0, padding: '12px 14px', fontSize: '13px', color: '#AAA', fontStyle: 'italic', fontFamily: "'DM Sans', sans-serif" }}>
                    No library folders yet. Add links in your profile's Resource Library.
                  </p>
                )}
                {libraryFolders.map(folder => (
                  <div key={folder.id}>
                    <div
                      onClick={() => setExpandedLibFolders(p => ({ ...p, [folder.id]: !p[folder.id] }))}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '8px 14px', cursor: 'pointer',
                        fontWeight: '600', fontSize: '13px', color: '#333',
                        fontFamily: "'DM Sans', sans-serif",
                        borderBottom: '1px solid rgba(0,0,0,0.05)',
                        userSelect: 'none',
                      }}
                    >
                      <span>{expandedLibFolders[folder.id] ? '▾' : '▸'}</span>
                      <span style={{ flex: 1 }}>{folder.name}</span>
                      <span style={{ color: '#AAA', fontWeight: '400', fontSize: '12px' }}>({folder.links?.length || 0})</span>
                    </div>
                    {expandedLibFolders[folder.id] && (folder.links || []).map(libLink => (
                      <div
                        key={libLink.id}
                        onClick={() => handleAddLibraryLink(libLink)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '8px',
                          padding: '6px 14px 6px 30px', cursor: 'pointer',
                          fontSize: '13px', color: '#444',
                          fontFamily: "'DM Sans', sans-serif",
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#EEF2FF'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <ExternalLink size={11} color="#6B7280" style={{ flexShrink: 0 }} />
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {libLink.title}
                        </span>
                        <Plus size={11} color="#4F46E5" style={{ flexShrink: 0 }} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Existing links */}
          {links.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: showLinkInput ? '12px' : 0 }}>
              {links.map(link => (
                <div
                  key={link.id}
                  onMouseEnter={() => setHoveredLinkId(link.id)}
                  onMouseLeave={() => setHoveredLinkId(null)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px 12px', background: '#FAFAF8',
                    border: '1px solid rgba(0,0,0,0.08)', borderRadius: '8px',
                  }}
                >
                  <ExternalLink size={13} color="#6B7280" style={{ flexShrink: 0 }} />

                  {editingLinkId === link.id ? (
                    /* Edit mode */
                    <>
                      <input
                        autoFocus
                        type="text"
                        value={editingLinkLabel}
                        onChange={e => setEditingLinkLabel(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleSaveLinkLabel(link.id);
                          if (e.key === 'Escape') setEditingLinkId(null);
                        }}
                        style={{
                          flex: 1, fontSize: '13.5px', color: '#111',
                          fontFamily: "'DM Sans', sans-serif",
                          border: '1px solid rgba(99,102,241,0.4)', borderRadius: '5px',
                          padding: '2px 8px', outline: 'none', background: '#fff',
                        }}
                      />
                      <button
                        onClick={() => handleSaveLinkLabel(link.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2C5F3A', padding: '2px', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                        title="Save label"
                      >
                        <Check size={13} />
                      </button>
                      <button
                        onClick={() => setEditingLinkId(null)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: '2px', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                        title="Cancel"
                      >
                        <X size={13} />
                      </button>
                    </>
                  ) : (
                    /* View mode */
                    <>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          flex: 1, fontSize: '13.5px', color: '#2563EB',
                          fontFamily: "'DM Sans', sans-serif", textDecoration: 'none',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}
                        onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                        onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                      >
                        {link.label}
                      </a>
                      {hoveredLinkId === link.id && (
                        <button
                          onClick={() => handleStartEditLabel(link)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: '2px', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                          title="Edit label"
                        >
                          <Pencil size={12} />
                        </button>
                      )}
                      <button
                        onClick={() => handleRemoveLink(link.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#F87171', padding: '2px', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                        title="Remove link"
                      >
                        <Trash2 size={12} />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {links.length === 0 && !showLinkInput && !showLibraryPicker && (
            <p style={{ margin: 0, fontSize: '13.5px', color: '#AAA', fontStyle: 'italic', fontFamily: "'DM Sans', sans-serif" }}>
              No links yet — add a URL, pick from your library, or generate with AI.
            </p>
          )}

          {/* Add link form */}
          {showLinkInput && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: links.length > 0 ? '0' : '0' }}>
              <input
                type="url"
                value={newLinkUrl}
                onChange={e => setNewLinkUrl(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddLink(); if (e.key === 'Escape') { setShowLinkInput(false); setNewLinkUrl(''); setNewLinkLabel(''); } }}
                placeholder="https://…"
                autoFocus
                style={{
                  fontFamily: "'DM Sans', sans-serif", fontSize: '13.5px', color: '#111',
                  border: '1.5px solid rgba(0,0,0,0.15)', borderRadius: '7px',
                  padding: '8px 12px', outline: 'none', background: '#FAFAFA',
                  width: '100%', boxSizing: 'border-box',
                }}
              />
              <input
                type="text"
                value={newLinkLabel}
                onChange={e => setNewLinkLabel(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddLink(); if (e.key === 'Escape') { setShowLinkInput(false); setNewLinkUrl(''); setNewLinkLabel(''); } }}
                placeholder="Label (optional, e.g. 'YouTube video')"
                style={{
                  fontFamily: "'DM Sans', sans-serif", fontSize: '13.5px', color: '#111',
                  border: '1.5px solid rgba(0,0,0,0.15)', borderRadius: '7px',
                  padding: '8px 12px', outline: 'none', background: '#FAFAFA',
                  width: '100%', boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={handleAddLink}
                  disabled={!newLinkUrl.trim()}
                  style={{
                    padding: '7px 16px', borderRadius: '7px', cursor: newLinkUrl.trim() ? 'pointer' : 'default',
                    fontSize: '13px', fontWeight: '600',
                    background: newLinkUrl.trim() ? '#111' : '#E5E7EB',
                    color: newLinkUrl.trim() ? '#FFF' : '#9CA3AF',
                    border: 'none', fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  Add Link
                </button>
                <button
                  onClick={() => { setShowLinkInput(false); setNewLinkUrl(''); setNewLinkLabel(''); }}
                  style={{
                    padding: '7px 16px', borderRadius: '7px', cursor: 'pointer',
                    fontSize: '13px', fontWeight: '500',
                    background: 'transparent', color: '#6B7280',
                    border: '1px solid rgba(0,0,0,0.12)', fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BlockView;
