// src/components/courses/BlockView.jsx
import { useState, useEffect, useRef } from 'react';
import { ExternalLink, Trash2, Plus, Sparkles, Loader2, Library, Check, X, Pencil, Clock, ChevronRight, BookOpen } from 'lucide-react';
import { getLibraryFolders } from '../../firebase/dbService';

const TYPE_COLORS = {
  content:   { bg: '#EAF0FF', text: '#2A4A9A', border: '#BFD0FF', label: 'Content' },
  worksheet: { bg: '#FFF3E8', text: '#9A5C12', border: '#F5C98A', label: 'Worksheet' },
  activity:  { bg: '#EDFFF3', text: '#1E7C43', border: '#86EFAC', label: 'Activity' },
};

const DURATION_OPTIONS = [5, 10, 15, 20, 30, 45];

// ── Teacher Notes collapsible panel (content blocks only) ─────────────────────
const TeacherNotesPanel = ({ block }) => {
  const [open, setOpen] = useState(false);
  const pedagogy = block?.pedagogy;
  const sources = block?.sources;

  if (!pedagogy && (!sources || sources.length === 0)) return null;

  const pedagogyRows = pedagogy ? [
    { key: 'Teaching approach', val: pedagogy.teaching_approach },
    { key: 'Memory device', val: pedagogy.memory_device },
    { key: 'Misconception', val: pedagogy.misconception },
    { key: 'Guided questions', val: Array.isArray(pedagogy.guided_questions) ? pedagogy.guided_questions.join(' · ') : pedagogy.guided_questions },
    { key: 'Mastery signal', val: pedagogy.mastery_signal },
  ].filter(r => r.val) : [];

  return (
    <div style={{
      background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '12px',
      marginBottom: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', overflow: 'hidden',
    }}>
      {/* Toggle header */}
      <div
        onClick={() => setOpen(p => !p)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '13px 22px', cursor: 'pointer', userSelect: 'none',
          transition: 'background .15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = '#FAFAF8'}
        onMouseLeave={e => e.currentTarget.style.background = '#fff'}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BookOpen size={14} color="#6B7280" />
          <span style={{ fontSize: '13px', fontWeight: '700', color: '#374151', fontFamily: "'DM Sans', sans-serif" }}>
            Teacher Notes
          </span>
          <span style={{ fontSize: '11px', fontWeight: '500', color: '#9CA3AF', fontFamily: "'DM Sans', sans-serif" }}>
            Pedagogy & suggested references
          </span>
        </div>
        <ChevronRight
          size={14} color="#9CA3AF"
          style={{ transition: 'transform .2s', transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
        />
      </div>

      {/* Body */}
      {open && (
        <div style={{ padding: '0 22px 18px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>

          {/* Pedagogy */}
          {pedagogyRows.length > 0 && (
            <div style={{ marginTop: '16px' }}>
              <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: '700', color: '#AAA', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: "'DM Sans', sans-serif" }}>
                Pedagogy
              </p>
              {pedagogyRows.map(({ key, val }) => (
                <div key={key} style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '4px 14px', marginBottom: '7px', alignItems: 'baseline' }}>
                  <span style={{ fontSize: '12.5px', fontWeight: '600', color: '#6B7280', fontFamily: "'DM Sans', sans-serif" }}>{key}</span>
                  <span style={{ fontSize: '13px', color: '#374151', lineHeight: '1.55', fontFamily: "'DM Sans', sans-serif" }}>{val}</span>
                </div>
              ))}
            </div>
          )}

          {/* Suggested References */}
          {sources && sources.length > 0 && (
            <div style={{ marginTop: '16px' }}>
              <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: '700', color: '#AAA', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: "'DM Sans', sans-serif" }}>
                Suggested References
              </p>
              {sources.map((src, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
                  padding: '10px 14px', background: '#FAFAF8',
                  border: '1px solid rgba(0,0,0,0.07)', borderRadius: '8px', marginBottom: '7px',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: '600', color: '#111', fontFamily: "'DM Sans', sans-serif" }}>
                      📚 {src.name}
                    </p>
                    <p style={{ margin: 0, fontSize: '12px', color: '#9CA3AF', fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      Search: {src.search_query}
                    </p>
                  </div>
                  <a
                    href={`https://www.google.com/search?q=${encodeURIComponent(src.name + ' ' + src.search_query)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                      padding: '4px 11px', background: '#EAF0FF',
                      border: '1px solid #BFD0FF', borderRadius: '6px',
                      fontSize: '12px', fontWeight: '600', color: '#2A4A9A',
                      textDecoration: 'none', flexShrink: 0, fontFamily: "'DM Sans', sans-serif",
                      transition: 'background .15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#D6E4FF'}
                    onMouseLeave={e => e.currentTarget.style.background = '#EAF0FF'}
                  >
                    Search <ExternalLink size={10} />
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Main BlockView ────────────────────────────────────────────────────────────
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
  handsOnResources,
  onNavigateToBlock,
}) => {
  const [localTitle, setLocalTitle] = useState(block?.title || '');
  const [localContent, setLocalContent] = useState(block?.content || '');
  const [localCategory] = useState(block?.category || '');
  const [localSubcategory] = useState(block?.subcategory || '');
  const [localDuration, setLocalDuration] = useState(block?.duration_minutes ?? 15);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDuration, setEditingDuration] = useState(false);
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [links, setLinks] = useState(block?.links || []);
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [showLinkInput, setShowLinkInput] = useState(false);

  const [editingLinkId, setEditingLinkId] = useState(null);
  const [editingLinkLabel, setEditingLinkLabel] = useState('');
  const [hoveredLinkId, setHoveredLinkId] = useState(null);

  const [showLibraryPicker, setShowLibraryPicker] = useState(false);
  const [libraryFolders, setLibraryFolders] = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [expandedLibFolders, setExpandedLibFolders] = useState({});
  const libraryRef = useRef(null);

  useEffect(() => {
    if (!showLibraryPicker) return;
    const handleOutside = (e) => {
      if (libraryRef.current && !libraryRef.current.contains(e.target)) {
        setShowLibraryPicker(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [showLibraryPicker]);

  useEffect(() => {
    setLocalTitle(block?.title || '');
    setLocalContent(block?.content || '');
    setLocalDuration(block?.duration_minutes ?? 15);
    setLinks(block?.links || []);
    setEditingTitle(false);
    setIsEditingContent(false);
    setEditingDuration(false);
  }, [block?.id]);

  useEffect(() => { setLinks(block?.links || []); }, [block?.links]);

  const blockType = block?.type || 'content';
  const typeStyle = TYPE_COLORS[blockType] || TYPE_COLORS.content;

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

  // Resolve parent content block title for the breadcrumb
  const parentContentBlock = block?.parentContentBlockId
    ? (handsOnResources?.[subsectionId] || []).find(b => b.id === block.parentContentBlockId)
    : null;

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
    if (!showLibraryPicker && libraryFolders.length === 0) await loadLibrary();
    setShowLibraryPicker(p => !p);
  };

  const handleAddLibraryLink = (libLink) => {
    const newLink = { id: `link-${Date.now()}`, url: libLink.url, label: libLink.title || libLink.url };
    const updated = [...links, newLink];
    setLinks(updated);
    actions?.updateBlock?.(topicId, block.id, { links: updated });
    setShowLibraryPicker(false);
  };

  const renderContentPreview = (text) => {
    if (!text) return <span style={{ color: '#AAA', fontStyle: 'italic' }}>Add content…</span>;
    return text.split('\n').map((line, i) => {
      const isBold = line.match(/^\*\*(.+)\*\*$/);
      if (isBold) return <p key={i} style={{ margin: '14px 0 5px', fontWeight: '700', fontSize: '12px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.06em' }}>{isBold[1]}</p>;
      if (line.startsWith('- ')) return <li key={i} style={{ margin: '2px 0', fontSize: '13.5px', color: '#374151', marginLeft: '16px' }}>{line.slice(2)}</li>;
      if (/^\d+\.\s/.test(line)) return <li key={i} style={{ margin: '2px 0', fontSize: '13.5px', color: '#374151', marginLeft: '16px', listStyle: 'decimal' }}>{line.replace(/^\d+\.\s/, '')}</li>;
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
  const genEmpty = linkGenStatus === 'empty';
  const genError = linkGenStatus === 'error';

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px 48px 80px', position: 'relative', zIndex: 1 }}>
      <div style={{ maxWidth: '860px', margin: '0 auto' }}>

        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <button
            onClick={onBack}
            style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: '13.8px', fontWeight: '500',
              padding: '8px 20px', borderRadius: '8px', cursor: 'pointer',
              background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.12)', color: '#111',
              whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >←</button>
          {sectionTitle && subsectionTitle && (
            <span style={{ color: '#555', fontSize: '13px', fontWeight: '500', fontFamily: "'DM Sans', sans-serif" }}>
              {sectionTitle} <span style={{ color: '#BBB' }}>›</span>{' '}
              {subsectionTitle} <span style={{ color: '#BBB' }}>›</span>{' '}
              <strong style={{ color: '#333', fontWeight: '600' }}>{localTitle || 'Untitled Block'}</strong>
            </span>
          )}
        </div>

        {/* Block header card */}
        <div style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '12px', padding: '18px 24px', marginBottom: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          {/* Type label + duration */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <p style={{ margin: 0, fontSize: '11.5px', fontWeight: '700', color: typeStyle.text, textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: "'DM Sans', sans-serif" }}>
              {typeStyle.label}{block?.subcategory ? ` · ${block.subcategory}` : ''}
            </p>

            {editingDuration ? (
              <select
                autoFocus value={localDuration}
                onChange={e => { const val = Number(e.target.value); setLocalDuration(val); setEditingDuration(false); save({ duration_minutes: val }); }}
                onBlur={() => setEditingDuration(false)}
                style={{ fontSize: '12px', fontWeight: '600', color: '#555', border: '1px solid #CBD5E1', borderRadius: '20px', padding: '3px 8px', outline: 'none', background: '#FFF', cursor: 'pointer' }}
              >
                {DURATION_OPTIONS.map(opt => <option key={opt} value={opt}>{opt} min</option>)}
              </select>
            ) : (
              <button
                onClick={() => setEditingDuration(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: '600', color: '#666', background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: '20px', padding: '3px 10px', cursor: 'pointer', transition: 'background .15s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#E2E8F0'}
                onMouseLeave={e => e.currentTarget.style.background = '#F1F5F9'}
              >
                <Clock size={11} /> {localDuration} min
              </button>
            )}
          </div>

          {/* Parent content block breadcrumb (worksheet/activity only) */}
          {parentContentBlock && blockType !== 'content' && (
            <div style={{ marginBottom: '6px' }}>
              <button
                onClick={() => onNavigateToBlock?.(sectionId, subsectionId, parentContentBlock.id)}
                style={{
                  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                  fontSize: '12.5px', color: '#6B7280', fontFamily: "'DM Sans', sans-serif",
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#2A4A9A'}
                onMouseLeave={e => e.currentTarget.style.color = '#6B7280'}
              >
                ↳ Reinforces:{' '}
                <span style={{ fontWeight: '600', color: '#2A4A9A' }}>
                  {parentContentBlock.title || 'Untitled Block'}
                </span>
              </button>
            </div>
          )}

          {/* Title */}
          {editingTitle ? (
            <input
              autoFocus value={localTitle}
              onChange={e => setLocalTitle(e.target.value)}
              onBlur={() => { setEditingTitle(false); save(); }}
              onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setLocalTitle(block?.title || ''); setEditingTitle(false); } }}
              maxLength={120}
              style={{ fontSize: '22px', fontWeight: '700', color: '#111', fontFamily: "'DM Sans', sans-serif", border: '2px solid #111', borderRadius: '6px', padding: '4px 8px', width: '100%', outline: 'none', background: '#FAFAFA', boxSizing: 'border-box' }}
            />
          ) : (
            <h2
              onClick={() => setEditingTitle(true)}
              style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: '#111', fontFamily: "'DM Sans', sans-serif", lineHeight: '1.3', cursor: 'text', borderRadius: '4px', padding: '2px 4px', marginLeft: '-4px' }}
              onMouseEnter={e => e.currentTarget.style.background = '#F5F3EE'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {localTitle || <span style={{ color: '#AAA', fontStyle: 'italic', fontWeight: '400' }}>Untitled Block</span>}
            </h2>
          )}
        </div>

        {/* Content card */}
        <div style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '12px', padding: '20px 24px', marginBottom: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          {isEditingContent ? (
            <textarea
              autoFocus value={localContent}
              onChange={e => setLocalContent(e.target.value)}
              onBlur={() => { setIsEditingContent(false); save(); }}
              onKeyDown={e => { if (e.key === 'Escape') { setLocalContent(block?.content || ''); setIsEditingContent(false); } }}
              placeholder={
                blockType === 'content'
                  ? '**Explain It**\nWrite a clear explanation here...\n\n**In Real Life**\n- Example 1\n- Example 2\n\n**Why It Matters**\nWhy students should care...'
                  : blockType === 'worksheet'
                    ? '**Learning Objective:**\n...\n\n**Worksheet Content:**\n...\n\n**Answer Key:**\n...'
                    : '**Learning Objective:**\n...\n\n**Steps to Conduct:**\n1. ...\n2. ...'
              }
              style={{ width: '100%', boxSizing: 'border-box', fontFamily: "'DM Sans', sans-serif", fontSize: '13.5px', color: '#222', lineHeight: '1.7', border: '2px solid #111', borderRadius: '6px', padding: '14px 16px', outline: 'none', resize: 'vertical', background: '#FAFAFA', minHeight: '320px' }}
            />
          ) : (
            <div
              onClick={() => setIsEditingContent(true)}
              style={{ minHeight: '120px', cursor: 'text', fontFamily: "'DM Sans', sans-serif", borderRadius: '4px', padding: '2px 4px', marginLeft: '-4px' }}
              onMouseEnter={e => e.currentTarget.style.background = '#F5F3EE'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {renderContentPreview(localContent)}
            </div>
          )}
        </div>

        {/* Teacher Notes (content blocks only) */}
        {blockType === 'content' && <TeacherNotesPanel block={block} />}

        {/* Links & Resources */}
        <div style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '12px', padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', gap: '8px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: '.06em', whiteSpace: 'nowrap' }}>
              Links & Resources
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              <button onClick={() => setShowLinkInput(p => !p)} style={btnBase}>
                <Plus size={13} /> Add Link
              </button>
              <button onClick={handleToggleLibrary} style={btnBase}>
                <Library size={13} /> Library
              </button>
              <button
                onClick={() => onGenerateLinks?.(block.id, topicId, block)}
                disabled={isGenerating || !onGenerateLinks}
                style={{ ...btnBase, background: isGenerating ? '#F0F4FF' : '#F5F3EE', color: isGenerating ? '#4338CA' : '#555', border: isGenerating ? '1px solid rgba(99,102,241,0.3)' : '1px solid rgba(0,0,0,0.12)', cursor: isGenerating ? 'default' : 'pointer', opacity: (!onGenerateLinks && !isGenerating) ? 0.5 : 1 }}
              >
                {isGenerating ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Generating…</> : <><Sparkles size={13} /> Generate</>}
              </button>
            </div>
            {(genEmpty || genError) && (
              <p style={{ margin: '6px 0 0', fontSize: '12px', color: genError ? '#B91C1C' : '#888', fontFamily: "'DM Sans', sans-serif" }}>
                {genError ? 'Generation failed. Try again.' : 'No results found. Try adding a title or description first.'}
              </p>
            )}
          </div>

          {/* Library picker */}
          {showLibraryPicker && (
            <div ref={libraryRef} style={{ background: '#F9FAFB', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '8px', marginBottom: '12px', maxHeight: '220px', overflowY: 'auto' }}>
              {libraryLoading && <p style={{ margin: 0, padding: '12px 14px', fontSize: '13px', color: '#999', fontFamily: "'DM Sans', sans-serif" }}>Loading library…</p>}
              {!libraryLoading && libraryFolders.length === 0 && <p style={{ margin: 0, padding: '12px 14px', fontSize: '13px', color: '#AAA', fontStyle: 'italic', fontFamily: "'DM Sans', sans-serif" }}>No library folders yet.</p>}
              {libraryFolders.map(folder => (
                <div key={folder.id}>
                  <div
                    onClick={() => setExpandedLibFolders(p => ({ ...p, [folder.id]: !p[folder.id] }))}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', color: '#333', fontFamily: "'DM Sans', sans-serif", borderBottom: '1px solid rgba(0,0,0,0.05)', userSelect: 'none' }}
                  >
                    <span>{expandedLibFolders[folder.id] ? '▾' : '▸'}</span>
                    <span style={{ flex: 1 }}>{folder.name}</span>
                    <span style={{ color: '#AAA', fontWeight: '400', fontSize: '12px' }}>({folder.links?.length || 0})</span>
                  </div>
                  {expandedLibFolders[folder.id] && (folder.links || []).map(libLink => (
                    <div
                      key={libLink.id}
                      onClick={() => handleAddLibraryLink(libLink)}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 14px 6px 30px', cursor: 'pointer', fontSize: '13px', color: '#444', fontFamily: "'DM Sans', sans-serif", transition: 'background 0.1s' }}
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

          {/* Existing links */}
          {links.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: showLinkInput ? '12px' : 0 }}>
              {links.map(link => (
                <div
                  key={link.id}
                  onMouseEnter={() => setHoveredLinkId(link.id)}
                  onMouseLeave={() => setHoveredLinkId(null)}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: '#FAFAF8', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '8px' }}
                >
                  <ExternalLink size={13} color="#6B7280" style={{ flexShrink: 0 }} />
                  {editingLinkId === link.id ? (
                    <>
                      <input
                        autoFocus type="text" value={editingLinkLabel}
                        onChange={e => setEditingLinkLabel(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveLinkLabel(link.id); if (e.key === 'Escape') setEditingLinkId(null); }}
                        style={{ flex: 1, fontSize: '13.5px', color: '#111', fontFamily: "'DM Sans', sans-serif", border: '1px solid rgba(99,102,241,0.4)', borderRadius: '5px', padding: '2px 8px', outline: 'none', background: '#fff' }}
                      />
                      <button onClick={() => handleSaveLinkLabel(link.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2C5F3A', padding: '2px', display: 'flex', alignItems: 'center', flexShrink: 0 }}><Check size={13} /></button>
                      <button onClick={() => setEditingLinkId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: '2px', display: 'flex', alignItems: 'center', flexShrink: 0 }}><X size={13} /></button>
                    </>
                  ) : (
                    <>
                      <a href={link.url} target="_blank" rel="noopener noreferrer"
                        style={{ flex: 1, fontSize: '13.5px', color: '#2563EB', fontFamily: "'DM Sans', sans-serif", textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                        onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                      >{link.label}</a>
                      {hoveredLinkId === link.id && (
                        <button onClick={() => handleStartEditLabel(link)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: '2px', display: 'flex', alignItems: 'center', flexShrink: 0 }}><Pencil size={12} /></button>
                      )}
                      <button onClick={() => handleRemoveLink(link.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#F87171', padding: '2px', display: 'flex', alignItems: 'center', flexShrink: 0 }}><Trash2 size={12} /></button>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <input
                type="url" value={newLinkUrl}
                onChange={e => setNewLinkUrl(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddLink(); if (e.key === 'Escape') { setShowLinkInput(false); setNewLinkUrl(''); setNewLinkLabel(''); } }}
                placeholder="https://…"
                autoFocus
                style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '13.5px', color: '#111', border: '1.5px solid rgba(0,0,0,0.15)', borderRadius: '7px', padding: '8px 12px', outline: 'none', background: '#FAFAFA', width: '100%', boxSizing: 'border-box' }}
              />
              <input
                type="text" value={newLinkLabel}
                onChange={e => setNewLinkLabel(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddLink(); if (e.key === 'Escape') { setShowLinkInput(false); setNewLinkUrl(''); setNewLinkLabel(''); } }}
                placeholder="Label (optional)"
                style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '13.5px', color: '#111', border: '1.5px solid rgba(0,0,0,0.15)', borderRadius: '7px', padding: '8px 12px', outline: 'none', background: '#FAFAFA', width: '100%', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={handleAddLink} disabled={!newLinkUrl.trim()}
                  style={{ padding: '7px 16px', borderRadius: '7px', cursor: newLinkUrl.trim() ? 'pointer' : 'default', fontSize: '13px', fontWeight: '600', background: newLinkUrl.trim() ? '#111' : '#E5E7EB', color: newLinkUrl.trim() ? '#FFF' : '#9CA3AF', border: 'none', fontFamily: "'DM Sans', sans-serif" }}
                >Add Link</button>
                <button
                  onClick={() => { setShowLinkInput(false); setNewLinkUrl(''); setNewLinkLabel(''); }}
                  style={{ padding: '7px 16px', borderRadius: '7px', cursor: 'pointer', fontSize: '13px', fontWeight: '500', background: 'transparent', color: '#6B7280', border: '1px solid rgba(0,0,0,0.12)', fontFamily: "'DM Sans', sans-serif" }}
                >Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BlockView;
