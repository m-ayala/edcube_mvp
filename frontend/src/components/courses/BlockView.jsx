// src/components/courses/BlockView.jsx
import { useState, useEffect } from 'react';
import { BLOCK_CATEGORIES, getSubcategoriesForType } from '../../constants/blockCategories';
import { ExternalLink, Trash2, Plus, Edit3, Eye } from 'lucide-react';

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

  // Sync if block prop changes (e.g. on navigation)
  useEffect(() => {
    setLocalTitle(block?.title || '');
    setLocalContent(block?.content || '');
    setLocalCategory(block?.category || '');
    setLocalSubcategory(block?.subcategory || '');
    setLinks(block?.links || []);
    setIsEditingContent(false);
  }, [block?.id]);

  const blockType = block?.type || 'content';
  const typeStyle = TYPE_COLORS[blockType] || TYPE_COLORS.content;

  // Categories available for this block type
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

  // Render content as formatted text in view mode
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

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#FAFAF9', overflow: 'hidden' }}>

      {/* ── Top bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 24px', background: '#FFFFFF',
        borderBottom: '1px solid rgba(0,0,0,0.08)', flexShrink: 0,
      }}>
        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', fontSize: '13px' }}>
          <button
            onClick={onBack}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', fontFamily: "'DM Sans', sans-serif", fontSize: '13px', fontWeight: '600', padding: '4px 0' }}
          >
            ← {topicTitle || 'Topic'}
          </button>
          {sectionTitle && subsectionTitle && (
            <span style={{ color: '#BBB' }}>·</span>
          )}
          {topicTitle && (
            <span style={{ color: '#AAA' }}>
              {sectionTitle} › {subsectionTitle} › {topicTitle} › <strong style={{ color: '#555' }}>{localTitle || 'Untitled Block'}</strong>
            </span>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px 60px' }}>

        {/* Block metadata card */}
        <div style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '12px', padding: '20px 24px', marginBottom: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>

          {/* Type badge + meta row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <span style={{
              padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700',
              background: typeStyle.bg, color: typeStyle.text, border: `1px solid ${typeStyle.border}`,
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              {typeStyle.label}
            </span>

            {/* Category selector */}
            <select
              value={localCategory}
              onChange={e => handleCategoryChange(e.target.value)}
              style={inputStyle}
            >
              <option value="">— Category —</option>
              {categoryOptions.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.label}</option>
              ))}
            </select>

            {/* Subcategory selector */}
            {subcategoryOptions.length > 0 && (
              <select
                value={localSubcategory}
                onChange={e => handleSubcategoryChange(e.target.value)}
                style={inputStyle}
              >
                <option value="">— Subcategory —</option>
                {subcategoryOptions.map(sub => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            )}
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
        <div style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '12px', padding: '20px 24px', marginBottom: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
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
        <div style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '12px', padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Links & Resources
            </label>
            <button
              onClick={() => setShowLinkInput(p => !p)}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '5px 12px', borderRadius: '7px', cursor: 'pointer',
                fontSize: '12.7px', fontWeight: '600',
                background: '#F5F3EE', color: '#555',
                border: '1px solid rgba(0,0,0,0.12)',
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              <Plus size={13} /> Add Link
            </button>
          </div>

          {/* Existing links */}
          {links.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: showLinkInput ? '12px' : 0 }}>
              {links.map(link => (
                <div key={link.id} style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '8px 12px', background: '#FAFAF8',
                  border: '1px solid rgba(0,0,0,0.08)', borderRadius: '8px',
                }}>
                  <ExternalLink size={13} color="#6B7280" style={{ flexShrink: 0 }} />
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
                  <button
                    onClick={() => handleRemoveLink(link.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#F87171', padding: '2px', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                    title="Remove link"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {links.length === 0 && !showLinkInput && (
            <p style={{ margin: 0, fontSize: '13.5px', color: '#AAA', fontStyle: 'italic', fontFamily: "'DM Sans', sans-serif" }}>
              No links yet — add a URL to a video, article, or resource.
            </p>
          )}

          {/* Add link form */}
          {showLinkInput && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
