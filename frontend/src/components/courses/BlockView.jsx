// src/components/courses/BlockView.jsx
import { useState } from 'react';
import { ExternalLink, X, Clock, ChevronRight, BookOpen } from 'lucide-react';

import { tidyBlockContent } from '../../utils/contentFormat';

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
  subsectionTitle,
  sectionTitle,
  sectionId,
  subsectionId,
  actions,
  onBack,
  handsOnResources,
  onNavigateToBlock,
}) => {
  const [localTitle, setLocalTitle] = useState(block?.title || '');
  const [localContent, setLocalContent] = useState(tidyBlockContent(block?.content || ''));
  const [localCategory] = useState(block?.category || '');
  const [localSubcategory] = useState(block?.subcategory || '');
  const [localDuration, setLocalDuration] = useState(block?.duration_minutes ?? 15);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDuration, setEditingDuration] = useState(false);
  const [isEditingContent, setIsEditingContent] = useState(false);
  // The pop-up is keyed by block id (see CourseWorkspace), so local state starts fresh per block.
  const blockType = block?.type || 'content';
  const typeStyle = TYPE_COLORS[blockType] || TYPE_COLORS.content;

  const save = (overrides = {}) => {
    actions?.updateBlock?.(topicId, block.id, {
      title: localTitle,
      content: localContent,
      category: localCategory,
      subcategory: localSubcategory,
      ...overrides,
    });
  };

  // Resolve parent content block title for the breadcrumb
  const parentContentBlock = block?.parentContentBlockId
    ? (handsOnResources?.[subsectionId] || []).find(b => b.id === block.parentContentBlockId)
    : null;

  const renderContentPreview = (raw) => {
    const text = tidyBlockContent(raw);
    if (!text) return <span style={{ color: '#AAA', fontStyle: 'italic' }}>Add content…</span>;
    // Inline **bold** inside a line.
    const inline = (line) => line.split(/(\*\*[^*]+\*\*)/g).map((part, j) => (
      /^\*\*[^*]+\*\*$/.test(part) ? <strong key={j} style={{ fontWeight: 600, color: '#111' }}>{part.slice(2, -2)}</strong> : part
    ));
    const out = [];
    let list = null; // { ordered, items: [] }
    const flush = () => {
      if (!list) return;
      const Tag = list.ordered ? 'ol' : 'ul';
      out.push(
        <Tag key={`l${out.length}`} style={{ margin: '4px 0 10px', paddingLeft: '22px', color: '#374151', fontSize: '14px', lineHeight: '1.65' }}>
          {list.items.map((it, j) => <li key={j} style={{ margin: '3px 0' }}>{inline(it)}</li>)}
        </Tag>
      );
      list = null;
    };
    text.split('\n').forEach((line, i) => {
      const t = line.trim();
      const heading = t.match(/^\*\*(.+?)\*\*:?$/);
      const bullet = t.match(/^[-•*]\s+(.*)$/);
      const numbered = t.match(/^\d+[.)]\s+(.*)$/);
      if (bullet || numbered) {
        const ordered = !!numbered;
        if (list && list.ordered !== ordered) flush();
        if (!list) list = { ordered, items: [] };
        list.items.push((bullet || numbered)[1]);
        return;
      }
      flush();
      if (!t) return;
      if (heading) {
        out.push(
          <h4 key={i} style={{ margin: out.length ? '20px 0 6px' : '0 0 6px', fontSize: '15px', fontWeight: 700, color: '#1F2937', fontFamily: "'DM Sans', sans-serif" }}>
            {heading[1]}
          </h4>
        );
        return;
      }
      out.push(<p key={i} style={{ margin: '0 0 10px', fontSize: '14px', color: '#374151', lineHeight: '1.7' }}>{inline(t)}</p>);
    });
    flush();
    return out;
  };

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
            aria-label="Close"
          ><X size={15} style={{ verticalAlign: 'middle' }} /></button>
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
              onKeyDown={e => { if (e.key === 'Escape') { setLocalContent(tidyBlockContent(block?.content || '')); setIsEditingContent(false); } }}
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

      </div>
    </div>
  );
};

export default BlockView;
