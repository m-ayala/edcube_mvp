// src/components/courses/CourseViewPage.jsx
//
// Redesign note (2026-08-22, frontend-agent): this page's Outline view was reskinned
// to match the confirmed Figma "Course Outline" screen (file W6EmBQhcVXKgFQa9kMwZID,
// node 28:139), validated with the user as a click-through HTML prototype before this
// port. The Course Outline / Description / Synopsis / Course Information control
// (node 28:1345) is an in-page 4-way switcher, not navigation — see `activeView`
// below, unchanged in spirit from the pre-existing tab implementation, just reskinned.
// Section accordions are per-section expand/collapse only (see `collapsedSections`) —
// all sections always render stacked on this same page; the chevron never swaps which
// section's content is visible.
import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  FileText, AlignLeft, ScrollText, Info, ChevronDown, ChevronRight,
  Clock, Grid2x2, Pencil,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { generateSynopsis, generateCourseDescription } from '../../utils/curriculumApi';
import html2pdf from 'html2pdf.js';

const SERIF = "'DM Serif Display', serif";
const SERIF_TEXT = "'DM Serif Text', Georgia, serif";
const SANS  = "'DM Sans', sans-serif";
const API_BASE = import.meta.env.VITE_API_BASE_URL;

// ── Palette — pulled from the confirmed Figma design context (node 28:139) ────
const BLUE            = '#3e62bc';
const BLUE_SOFT_BG    = '#edf2fe';
const BLUE_BORDER     = '#dce6ff';
const MAGENTA_BTN_BG  = '#954baf';
const MAGENTA_SOFT_BG = '#f4edf7';
const PURPLE_TEXT     = '#954baf';
const GREEN_TEXT      = '#249800';
const GREEN_BG        = '#eef5f0';
const CARD_HIGHLIGHT  = 'rgba(234,240,255,0.6)';
const CARD_BORDER     = '#eaf0ff';
const TEXT_BODY       = '#5c5c62';
const TEXT_MUTE       = '#8e8e8e';
const PILL_NEUTRAL_BG   = '#f7f7f7';
const PILL_NEUTRAL_TEXT = '#8e8e8e';

// ── Palette ───────────────────────────────────────────────────────────────────
const SECTION_GRADIENTS = [
  'linear-gradient(90deg,#B2E8C8,#ACD8F0)',
  'linear-gradient(90deg,#F2C0D4,#F7E4A0)',
  'linear-gradient(90deg,#ACD8F0,#B2E8C8)',
  'linear-gradient(90deg,#F7E4A0,#F2C0D4)',
];

const BADGE_STYLES = {
  video:     { bg: '#EDE9F8', color: '#4B3899', label: 'Video' },
  content:   { bg: '#EAF0FF', color: '#3B5FBB', label: 'Content' },
  worksheet: { bg: '#EAF3DE', color: '#27500A', label: 'Worksheet' },
  activity:  { bg: '#FAEEDA', color: '#633806', label: 'Activity' },
};

const BLOCK_CONFIG = {
  content:   { label: 'Content',   bg: '#EAF0FF', color: '#6B8FE8' },
  worksheet: { label: 'Worksheet', bg: '#FFF3E8', color: '#E8A55C' },
  activity:  { label: 'Activity',  bg: '#EDFFF3', color: '#5CC97C' },
};

// ── Course Outline / Description / Synopsis / Course Information switcher ──────
// Source: Figma node 28:1345 — a single control with 4 variants; whichever is
// "active" renders filled-blue on top, the other 3 as bordered options below.
// This swaps `activeView` in place — it is not navigation (no route change).
const TAB_ITEMS = {
  outline:       { key: 'outline',       label: 'Course Outline',      icon: FileText },
  description:   { key: 'description',   label: 'Description',        icon: AlignLeft },
  synopsis:      { key: 'synopsis',      label: 'Synopsis',           icon: ScrollText },
  'course-info': { key: 'course-info',   label: 'Course Information', icon: Info },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const getYouTubeThumbnail = (url) => {
  try {
    const u = new URL(url);
    let vid = null;
    if (u.hostname.includes('youtube.com'))   vid = u.searchParams.get('v');
    else if (u.hostname.includes('youtu.be')) vid = u.pathname.slice(1).split('?')[0];
    if (vid) return `https://img.youtube.com/vi/${vid}/mqdefault.jpg`;
  } catch {}
  return null;
};

// ── Resource row ──────────────────────────────────────────────────────────────
const ResourceItem = ({ resource, type, tile = false }) => {
  const thumb = type === 'video' ? getYouTubeThumbnail(resource.url) : null;
  const badge = BADGE_STYLES[type] || BADGE_STYLES.video;
  const [hovered, setHovered] = useState(false);

  if (tile) {
    return (
      <a
        href={resource.url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: '7px', aspectRatio: '1 / 1', padding: '12px 8px', textAlign: 'center',
          background: hovered ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.7)',
          border: `1px solid ${hovered ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.07)'}`,
          borderRadius: '10px',
          textDecoration: 'none',
          transition: 'background 0.15s, border-color 0.15s',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div style={{
          width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0,
          background: type === 'worksheet' ? '#EAF3DE' : type === 'activity' ? '#FFF3DC' : badge.bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px',
        }}>
          {type === 'worksheet' ? '📄' : type === 'activity' ? '🔧' : '📘'}
        </div>
        <div style={{
          fontSize: '11px', color: '#222', fontFamily: SANS, lineHeight: '1.3',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {resource.title}
        </div>
        <span style={{ fontSize: '9px', fontWeight: '500', fontFamily: SANS, padding: '1px 7px', borderRadius: '5px', flexShrink: 0, background: badge.bg, color: badge.color }}>
          {badge.label}
        </span>
      </a>
    );
  }

  return (
    <a
      href={resource.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '10px 14px',
        background: hovered ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.7)',
        border: `1px solid ${hovered ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.07)'}`,
        borderRadius: '9px',
        textDecoration: 'none',
        transition: 'background 0.15s, border-color 0.15s',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {thumb ? (
        <div style={{ width: '48px', height: '34px', borderRadius: '5px', flexShrink: 0, overflow: 'hidden', position: 'relative' }}>
          <img src={thumb} alt={resource.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '16px', height: '16px', background: 'rgba(0,0,0,0.4)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '7px', color: '#fff', paddingLeft: '1px' }}>▶</div>
          </div>
        </div>
      ) : type === 'video' ? (
        <div style={{ width: '48px', height: '34px', borderRadius: '5px', background: '#B2E8C8', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '16px', height: '16px', background: 'rgba(0,0,0,0.22)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '7px', color: '#fff', paddingLeft: '1px' }}>▶</div>
        </div>
      ) : (
        <div style={{ width: '34px', height: '34px', borderRadius: '7px', background: type === 'worksheet' ? '#EAF3DE' : '#FFF3DC', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>
          {type === 'worksheet' ? '📄' : '🔧'}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', color: '#222', fontFamily: SANS, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {resource.title}
        </div>
        <div style={{ fontSize: '11px', color: '#AAA', marginTop: '1px', fontFamily: SANS }}>
          {type === 'video' ? 'YouTube' : type === 'worksheet' ? 'PDF' : 'Hands-on'}
        </div>
      </div>
      <span style={{ fontSize: '10.5px', fontWeight: '500', fontFamily: SANS, padding: '2px 8px', borderRadius: '6px', flexShrink: 0, background: badge.bg, color: badge.color }}>
        {badge.label}
      </span>
    </a>
  );
};

// ── Lesson card (subsection) ────────────────────────────────────────────────
// Single-column layout: title + duration, then Summary and Objectives sharing
// one row (Objectives on the right), then the "Content" dropdown (that
// lesson's content/worksheet/activity blocks), then video resources.
const LessonCard = ({ sub, handsOnResources, modulesExpanded, onToggleModules }) => {
  const blocks = handsOnResources[sub.id] || [];
  const allVideos     = sub.video_resources || [];
  const allWorksheets = blocks.filter(b => b.type === 'worksheet');
  const allActivities = blocks.filter(b => b.type === 'activity');
  const allContent    = blocks.filter(b => b.type === 'content');
  const hasVideos = allVideos.length > 0;
  const hasContentBlocks = allContent.length > 0 || allWorksheets.length > 0 || allActivities.length > 0;

  const hasSummary = !!sub.description;
  const hasObjectives = (sub.learning_objectives || []).length > 0;

  return (
    <article style={{
      background: '#fff',
      border: `1.5px solid ${CARD_BORDER}`,
      borderRadius: '16px',
      padding: '24px 28px',
      boxShadow: '0 1px 2px rgba(20,20,30,0.04)',
      fontFamily: SANS,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '14px' }}>
        <h3 style={{ fontSize: '24px', fontWeight: '600', margin: 0, color: '#111' }}>{sub.title}</h3>
        {sub.duration_minutes > 0 && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px', height: '27px',
            padding: '0 12px', borderRadius: '7px', background: BLUE_SOFT_BG, color: '#3083ff',
            fontSize: '13px', fontWeight: '600', flexShrink: 0, whiteSpace: 'nowrap',
          }}>
            <Clock size={13} /> {sub.duration_minutes} Mins
          </span>
        )}
      </div>

      {/* Summary and Objectives share one row — Objectives on the right of Summary. */}
      {(hasSummary || hasObjectives) && (
        <div style={{ display: 'flex', gap: '28px', marginBottom: '16px', flexWrap: 'wrap' }}>
          {hasSummary && (
            <div style={{ flex: '1 1 300px', minWidth: 0 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', height: '25px', padding: '0 11px',
                borderRadius: '7px', fontSize: '11px', fontWeight: '600', letterSpacing: '0.04em',
                textTransform: 'uppercase', background: GREEN_BG, color: GREEN_TEXT, marginBottom: '8px',
              }}>
                Summary
              </span>
              <p style={{ margin: '8px 0 0', fontSize: '13.5px', lineHeight: '1.65', color: TEXT_BODY }}>
                {sub.description}
              </p>
            </div>
          )}
          {hasObjectives && (
            <div style={{ flex: '1 1 240px', minWidth: 0 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', height: '25px', padding: '0 11px',
                borderRadius: '7px', fontSize: '11px', fontWeight: '600', letterSpacing: '0.04em',
                textTransform: 'uppercase', background: MAGENTA_SOFT_BG, color: PURPLE_TEXT, marginBottom: '8px',
              }}>
                Objectives
              </span>
              <ul style={{ margin: '8px 0 0', paddingLeft: '18px', fontSize: '13.5px', lineHeight: '1.75', color: TEXT_BODY }}>
                {sub.learning_objectives.map((obj, i) => <li key={i} style={{ marginBottom: '2px' }}>{obj}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {/*
        "Content" dropdown — the content/worksheet/activity blocks generated for
        this lesson (video stays below, since it comes from a separate source —
        video search — not the generated block set).
      */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ background: '#fff', border: `1px solid ${CARD_BORDER}`, borderRadius: '12px', padding: '6px', maxWidth: '373px' }}>
          <button
            onClick={() => onToggleModules(sub.id)}
            aria-expanded={!!modulesExpanded}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
              background: '#fbf4ec', color: '#d28e3c', fontSize: '11px', fontWeight: '600',
              letterSpacing: '0.04em', textTransform: 'uppercase', padding: '8px 14px',
              borderRadius: '7px', cursor: 'pointer', border: 'none', width: '100%', fontFamily: SANS,
            }}
          >
            Content
            <ChevronDown size={12} style={{ transform: modulesExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease', flexShrink: 0 }} />
          </button>
          {modulesExpanded && (
            <div style={{ padding: '10px 4px 4px' }}>
              {hasContentBlocks ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))', gap: '8px' }}>
                  {allContent.map((c, i)    => <ResourceItem key={`c${i}`} resource={c} type="content"   tile />)}
                  {allWorksheets.map((w, i) => <ResourceItem key={`w${i}`} resource={w} type="worksheet" tile />)}
                  {allActivities.map((a, i) => <ResourceItem key={`a${i}`} resource={a} type="activity"  tile />)}
                </div>
              ) : (
                <div style={{ padding: '4px 10px', fontSize: '12.5px', color: TEXT_MUTE, lineHeight: '1.6' }}>
                  No content, worksheet, or activity blocks generated yet for this lesson.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {hasVideos && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ fontSize: '10.5px', fontWeight: '600', letterSpacing: '0.8px', textTransform: 'uppercase', color: '#C0BAB0', marginBottom: '4px' }}>
            Resources
          </div>
          {allVideos.map((v, i) => <ResourceItem key={`v${i}`} resource={v} type="video" />)}
        </div>
      )}
    </article>
  );
};

// ── Inline editable field ─────────────────────────────────────────────────────
const InlineField = ({ value, onChange, onSave, multiline = false, placeholder = 'Click to edit', disabled = false }) => {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value);
  const ref = useRef(null);

  useEffect(() => { if (!editing) setLocal(value); }, [value, editing]);
  useEffect(() => { if (editing && ref.current) ref.current.focus(); }, [editing]);

  const commit = () => {
    setEditing(false);
    if (local !== value) { onChange(local); onSave(local); }
  };

  const handleKey = (e) => {
    if (!multiline && e.key === 'Enter') { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { setLocal(value); setEditing(false); }
  };

  if (disabled) {
    return (
      <span style={{ fontSize: '15px', color: '#111', fontFamily: SANS, lineHeight: multiline ? '1.7' : '1.4', whiteSpace: multiline ? 'pre-wrap' : 'normal' }}>
        {value || <span style={{ color: '#bbb', fontStyle: 'italic' }}>—</span>}
      </span>
    );
  }

  const sharedStyle = {
    fontFamily: SANS, fontSize: '15px', color: '#111', background: 'transparent',
    border: 'none', outline: 'none', padding: 0, width: '100%',
    borderBottom: editing ? '1.5px solid #111' : '1.5px solid transparent',
    transition: 'border-color 0.15s', cursor: editing ? 'text' : 'pointer',
    lineHeight: multiline ? '1.7' : '1.4',
  };

  return multiline ? (
    <textarea
      ref={ref}
      value={local}
      rows={editing ? 5 : Math.max(2, (local || '').split('\n').length)}
      onChange={e => setLocal(e.target.value)}
      onFocus={() => setEditing(true)}
      onBlur={commit}
      onKeyDown={handleKey}
      placeholder={placeholder}
      style={{ ...sharedStyle, resize: 'vertical', whiteSpace: 'pre-wrap' }}
    />
  ) : (
    <input
      ref={ref}
      type="text"
      value={local}
      onChange={e => setLocal(e.target.value)}
      onFocus={() => setEditing(true)}
      onBlur={commit}
      onKeyDown={handleKey}
      placeholder={placeholder}
      style={sharedStyle}
    />
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────
const CourseViewPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();

  const {
    formData: incomingFormData,
    sections: incomingSections = [],
    curriculumId,
    isPublic,
    isOwner       = false,
    ownerName     = '',
    isCollaborator = false,
  } = location.state || {};

  const [sections]             = useState(incomingSections);
  const [handsOnResources, setHandsOnResources] = useState({});
  const [downloading, setDownloading] = useState(false);
  const [activeView, setActiveView] = useState('outline');
  const docRef = useRef(null);

  // ── Course Outline / Description / Synopsis / Course Information switcher ──
  // Node 28:1345 — a single control, not navigation. `activeView` above already
  // drives which panel renders; `switcherOpen` just controls the dropdown itself.
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const switcherRef = useRef(null);
  useEffect(() => {
    const onDocClick = (e) => {
      if (switcherRef.current && !switcherRef.current.contains(e.target)) setSwitcherOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  // ── Section accordions — per-section expand/collapse only. All sections always
  // render stacked on this page; toggling one never hides/switches any other. ──
  const [collapsedSections, setCollapsedSections] = useState({});
  const toggleSection = (id) => setCollapsedSections(prev => ({ ...prev, [id]: !prev[id] }));

  // ── Per-lesson "Information modules" expand/collapse (placeholder body — see
  // LessonCard for the TODO on real content). ──
  const [expandedModules, setExpandedModules] = useState({});
  const toggleModules = (id) => setExpandedModules(prev => ({ ...prev, [id]: !prev[id] }));

  // ── Editable formData fields ──────────────────────────────────────────
  const [editableFormData, setEditableFormData] = useState({
    courseName:    incomingFormData?.courseName    || '',
    subject:       incomingFormData?.subject       || '',
    topic:         incomingFormData?.topic         || '',
    ageRangeStart: incomingFormData?.ageRangeStart || '',
    ageRangeEnd:   incomingFormData?.ageRangeEnd   || '',
    numStudents:   incomingFormData?.numStudents   || '',
    timeDuration:  incomingFormData?.timeDuration  || '',
    timeUnit:      incomingFormData?.timeUnit      || '',
    objectives:    incomingFormData?.objectives    || '',
  });

  // ── Description state ─────────────────────────────────────────────────
  const [courseDescription, setCourseDescription] = useState(incomingFormData?.courseDescription || '');
  const [descriptionLoading, setDescriptionLoading] = useState(false);
  const [descriptionError, setDescriptionError] = useState(null);

  // ── Synopsis state ────────────────────────────────────────────────────
  const [synopsis, setSynopsis] = useState(incomingFormData?.synopsis || '');
  const [selectedBlockIds, setSelectedBlockIds] = useState(new Set());
  const [synopsisLoading, setSynopsisLoading] = useState(false);
  const [showSelectionUI, setShowSelectionUI] = useState(false);

  const courseName = editableFormData.courseName || incomingFormData?.courseName || '';

  // Hydrate resource cache from subsection-level blocks
  useEffect(() => {
    const ho = {};
    sections.forEach(section => {
      (section.subsections || []).forEach(sub => {
        const blocks = [
          ...(sub.content_blocks || []).map(b => ({ ...b, type: 'content' })),
          ...(sub.worksheets     || []).map(b => ({ ...b, type: 'worksheet' })),
          ...(sub.activities     || []).map(b => ({ ...b, type: 'activity' })),
        ];
        if (blocks.length > 0) ho[sub.id] = blocks;
      });
    });
    setHandsOnResources(ho);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save a partial update to Firestore ───────────────────────────────
  const saveField = async (updates) => {
    if (!curriculumId || !currentUser) return;
    try {
      const idToken = await currentUser.getIdToken();
      await fetch(`${API_BASE}/api/update-course?teacherUid=${currentUser.uid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({ courseId: curriculumId, ...updates }),
      });
    } catch (err) {
      console.error('Save field error:', err);
    }
  };

  const handleDownloadPdf = async () => {
    if (!docRef.current) return;
    setDownloading(true);

    // The PDF should always capture the full course, not just whatever the
    // user currently has expanded on screen — sections and each lesson's
    // Content dropdown only render their contents into the DOM when open, so
    // force everything open first and restore the user's view afterward.
    const prevCollapsedSections = collapsedSections;
    const prevExpandedModules = expandedModules;
    const allSubsectionIds = sections.flatMap(s => (s.subsections || []).map(sub => sub.id));
    setCollapsedSections({});
    setExpandedModules(Object.fromEntries(allSubsectionIds.map(id => [id, true])));

    // Wait for that state change to actually paint before snapshotting the DOM.
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    try {
      await html2pdf()
        .set({
          margin: [14, 14, 14, 14],
          filename: `${courseName.replace(/[^a-z0-9]/gi, '_')}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, letterRendering: true, windowWidth: 900 },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
        })
        .from(docRef.current)
        .save();
    } finally {
      setCollapsedSections(prevCollapsedSections);
      setExpandedModules(prevExpandedModules);
      setDownloading(false);
    }
  };

  const currentFormData = () => ({ ...incomingFormData, ...editableFormData, courseDescription, synopsis });

  const handleEditInWorkspace = () =>
    navigate('/course-workspace', {
      state: { formData: currentFormData(), sections, handsOnResources, isEditing: true, curriculumId, isPublic, readOnly: false, isOwner: true }
    });

  const handleEditAsCollaborator = () =>
    navigate('/course-workspace', {
      state: { formData: currentFormData(), sections, handsOnResources, isEditing: true, curriculumId, isPublic, readOnly: false, isOwner: false, isCollaborator: true }
    });

  // ── Synopsis: collect all selectable blocks ───────────────────────────
  const allSelectableBlocks = [];
  sections.forEach(section => {
    if (section.type === 'break') return;
    (section.subsections || []).forEach(sub => {
      const blocks = handsOnResources[sub.id] || [];
      blocks.forEach(block => {
        allSelectableBlocks.push({
          id: block.id,
          sectionTitle: section.title,
          subsectionTitle: sub.title,
          blockType: block.type,
          blockTitle: block.title,
          blockContent: block.content || '',
        });
      });
    });
  });

  const toggleBlock = (id) => {
    setSelectedBlockIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedBlockIds(new Set(allSelectableBlocks.map(b => b.id)));
  const clearAll  = () => setSelectedBlockIds(new Set());

  const handleGenerateSynopsis = async () => {
    const selected = allSelectableBlocks.filter(b => selectedBlockIds.has(b.id));
    if (selected.length === 0) return;
    setSynopsisLoading(true);
    try {
      const result = await generateSynopsis({
        courseName,
        subject: editableFormData.subject || '',
        topic: editableFormData.topic || '',
        classLevel: editableFormData.ageRangeStart && editableFormData.ageRangeEnd
          ? `${editableFormData.ageRangeStart}–${editableFormData.ageRangeEnd}`
          : incomingFormData?.class || '',
        teacherUid: currentUser?.uid || null,
        selectedBlocks: selected,
      });
      if (result.synopsis) {
        setSynopsis(result.synopsis);
        setShowSelectionUI(false);
        await saveField({ synopsis: result.synopsis });
      }
    } catch (err) {
      console.error('Synopsis generation error:', err);
    } finally {
      setSynopsisLoading(false);
    }
  };

  const handleGenerateDescription = async () => {
    console.log('[desc] clicked, courseName=', courseName, 'formData=', editableFormData);
    setDescriptionLoading(true);
    setDescriptionError(null);
    try {
      const result = await generateCourseDescription({
        courseName,
        subject: editableFormData.subject || '',
        topic: editableFormData.topic || '',
        ageRangeStart: editableFormData.ageRangeStart,
        ageRangeEnd:   editableFormData.ageRangeEnd,
        numStudents:   editableFormData.numStudents,
        timeDuration:  editableFormData.timeDuration,
        timeUnit:      editableFormData.timeUnit,
        objectives:    editableFormData.objectives,
        teacherUid:    currentUser?.uid || null,
      });
      console.log('[desc] result=', result);
      if (result.description) {
        setCourseDescription(result.description);
        await saveField({ courseDescription: result.description });
      } else {
        setDescriptionError('No description returned. Please try again.');
      }
    } catch (err) {
      console.error('[desc] error:', err);
      setDescriptionError(err.message || 'Generation failed. Please try again.');
    } finally {
      setDescriptionLoading(false);
    }
  };

  // ── Stats ─────────────────────────────────────────────────────────────
  const sectionCount = sections.filter(s => s.type !== 'break').length;
  const lessonCount  = sections.reduce((a, s) => a + (s.subsections?.length || 0), 0);
  const totalMins    = sections.reduce((a, s) =>
    a + (s.subsections?.reduce((t, sub) => t + (sub.duration_minutes || 0), 0) || 0), 0);
  const durationLabel = totalMins < 60
    ? `${totalMins} min`
    : totalMins % 60 === 0
      ? `${totalMins / 60} hr`
      : `${Math.floor(totalMins / 60)} hr ${totalMins % 60} min`;

  const ActiveTabIcon = TAB_ITEMS[activeView]?.icon || FileText;

  return (
    <div style={{
      minHeight: '100vh',
      background: `
        radial-gradient(circle at 15% 20%,  rgba(178,232,200,0.22)  0%, transparent 40%),
        radial-gradient(circle at 85% 8%,   rgba(172,216,240,0.22)  0%, transparent 38%),
        radial-gradient(circle at 50% 85%,  rgba(242,192,212,0.18)  0%, transparent 42%),
        radial-gradient(circle at 90% 60%,  rgba(247,228,160,0.18)  0%, transparent 35%),
        radial-gradient(circle at 20% 65%,  rgba(172,216,240,0.15)  0%, transparent 35%),
        #FAFAF9
      `,
      fontFamily: SANS,
    }}>

      {/*
        ── Action row: breadcrumb + Course Outline/Description/Synopsis/Course
        Information switcher + Edit Workspace ──────────────────────────────
        Persists identically across all 4 switcher states, per the confirmed
        Figma design (node 28:139) — only the panel below it swaps.
      */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 9,
        background: 'rgba(255,255,255,0.88)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
        padding: '14px 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px', fontWeight: '600', fontFamily: SANS, flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('/my-courses')}
            style={{ color: '#a3a3a3', background: 'none', border: 'none', font: 'inherit', fontWeight: '600', cursor: 'pointer', padding: 0 }}
          >
            My courses
          </button>
          <span style={{ color: '#c6c6c6' }}>‹</span>
          <span style={{ color: BLUE }}>Course Outline</span>
          {!isOwner && ownerName && (
            <span style={{ fontSize: '12.5px', fontWeight: '400', color: '#888', marginLeft: '4px' }}>by {ownerName}</span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Course Outline / Description / Synopsis / Course Information switcher */}
          <div style={{ position: 'relative' }} ref={switcherRef}>
            <button
              onClick={() => setSwitcherOpen(o => !o)}
              aria-expanded={switcherOpen}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '9px', height: '37px', padding: '0 16px',
                borderRadius: '10px', fontSize: '14px', fontWeight: '500', border: 'none', cursor: 'pointer',
                whiteSpace: 'nowrap', background: BLUE, color: '#fff', fontFamily: SANS,
              }}
            >
              <ActiveTabIcon size={17} />
              {TAB_ITEMS[activeView]?.label}
              <ChevronDown size={13} style={{ transform: switcherOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease', marginLeft: '2px' }} />
            </button>
            {switcherOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: '234px', background: '#fff',
                border: `1px solid ${CARD_BORDER}`, borderRadius: '12px', padding: '8px',
                boxShadow: '0 12px 28px rgba(20,20,40,0.14)', display: 'flex', flexDirection: 'column', gap: '8px', zIndex: 20,
              }}>
                {Object.values(TAB_ITEMS).filter(t => t.key !== activeView).map(t => {
                  const OptIcon = t.icon;
                  return (
                    <button
                      key={t.key}
                      onClick={() => { setActiveView(t.key); setSwitcherOpen(false); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '12px', height: '37px', padding: '0 12px',
                        borderRadius: '10px', border: `1px solid ${BLUE_BORDER}`, background: '#fff', color: BLUE,
                        fontSize: '14px', fontWeight: '500', cursor: 'pointer', width: '100%', fontFamily: SANS,
                      }}
                    >
                      <OptIcon size={18} />
                      {t.label}
                      <ChevronRight size={14} style={{ marginLeft: 'auto', flexShrink: 0 }} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {isOwner && (
            <button
              onClick={handleEditInWorkspace}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '9px', height: '37px', padding: '0 16px',
                borderRadius: '10px', fontSize: '14px', fontWeight: '500', border: 'none', cursor: 'pointer',
                whiteSpace: 'nowrap', background: MAGENTA_BTN_BG, color: '#fff', fontFamily: SANS,
              }}
            >
              <Pencil size={15} /> Edit Workspace
            </button>
          )}
          {isCollaborator && (
            <button
              onClick={handleEditAsCollaborator}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '9px', height: '37px', padding: '0 16px',
                borderRadius: '10px', fontSize: '14px', fontWeight: '500', border: 'none', cursor: 'pointer',
                whiteSpace: 'nowrap', background: MAGENTA_BTN_BG, color: '#fff', fontFamily: SANS,
              }}
            >
              <Pencil size={15} /> Edit as Collaborator
            </button>
          )}
        </div>
      </div>

      {/* ── Panel body — swaps in place based on `activeView`, no navigation ── */}
      <div style={{
        maxWidth: activeView === 'outline' ? '1400px' : '740px',
        margin: '0 auto',
        padding: activeView === 'outline' ? '26px 40px 60px' : '40px 24px 100px',
      }}>

        {/* ── Description tab ──────────────────────────────────────────────── */}
        {activeView === 'description' && (
          <div style={{ background: '#fff', borderRadius: '16px', padding: '48px', boxShadow: '0 2px 16px rgba(0,0,0,0.07)', border: '1px solid rgba(0,0,0,0.05)' }}>
            <h2 style={{ fontFamily: SERIF, fontSize: '28px', color: '#111', letterSpacing: '-0.4px', margin: '0 0 8px' }}>
              About this Course
            </h2>
            <p style={{ fontSize: '13px', color: '#aaa', fontFamily: SANS, margin: '0 0 28px' }}>
              {isOwner ? 'A brief overview for parents to understand what this course covers.' : 'A brief overview of this course.'}
            </p>

            {isOwner ? (
              <div>
                <div style={{ position: 'relative' }}>
                  <textarea
                    value={courseDescription}
                    onChange={e => setCourseDescription(e.target.value)}
                    placeholder="Write a short description of what this course covers — its key objectives, what students will learn, and why parents should sign their child up…"
                    rows={8}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      fontFamily: SANS, fontSize: '15.5px', color: '#111',
                      lineHeight: '1.75', letterSpacing: '0.01em',
                      border: '1.5px solid rgba(0,0,0,0.1)',
                      borderRadius: '10px', padding: '16px 18px',
                      outline: 'none', resize: 'vertical',
                      background: '#FAFAFA',
                      transition: 'border-color 0.15s',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.3)'; e.currentTarget.style.background = '#fff'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.1)'; e.currentTarget.style.background = '#FAFAFA'; saveField({ courseDescription: e.currentTarget.value }); }}
                  />
                  {courseDescription && (
                    <span style={{ position: 'absolute', bottom: '10px', right: '14px', fontSize: '11px', color: '#ccc', fontFamily: SANS }}>
                      auto-saved
                    </span>
                  )}
                </div>
                <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    onClick={handleGenerateDescription}
                    disabled={descriptionLoading}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '7px',
                      padding: '9px 18px',
                      background: descriptionLoading ? '#f0f0f0' : '#111',
                      color: descriptionLoading ? '#aaa' : '#fff',
                      border: 'none', borderRadius: '8px',
                      fontFamily: SANS, fontSize: '13.5px', fontWeight: '500',
                      cursor: descriptionLoading ? 'not-allowed' : 'pointer',
                      transition: 'background 0.15s, color 0.15s',
                    }}
                  >
                    {descriptionLoading ? (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 0.8s linear infinite' }}>
                          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                        </svg>
                        Generating…
                      </>
                    ) : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
                        </svg>
                        {courseDescription ? 'Regenerate Description' : 'Generate Description'}
                      </>
                    )}
                  </button>
                  {descriptionError && (
                    <span style={{ fontSize: '12px', color: '#c0392b', fontFamily: SANS }}>
                      {descriptionError}
                    </span>
                  )}
                  {!descriptionError && courseDescription && !descriptionLoading && (
                    <span style={{ fontSize: '12px', color: '#aaa', fontFamily: SANS }}>
                      You can edit the generated text directly above.
                    </span>
                  )}
                </div>
              </div>
            ) : (
              courseDescription ? (
                <p style={{ fontFamily: SANS, fontSize: '15.5px', color: '#333', lineHeight: '1.75', whiteSpace: 'pre-wrap', margin: 0 }}>
                  {courseDescription}
                </p>
              ) : (
                <p style={{ fontFamily: SANS, fontSize: '14px', color: '#bbb', fontStyle: 'italic', margin: 0 }}>
                  No description has been added yet.
                </p>
              )
            )}
          </div>
        )}

        {/* ── Synopsis tab ─────────────────────────────────────────────────── */}
        {activeView === 'synopsis' && (
          <div>
            {/* Owner — show synopsis or selection UI */}
            {isOwner && (synopsis && !showSelectionUI) ? (
              // Synopsis exists: show it with a regenerate button
              <div style={{ background: '#fff', borderRadius: '16px', padding: '48px', boxShadow: '0 2px 16px rgba(0,0,0,0.07)', border: '1px solid rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px', gap: '16px' }}>
                  <div>
                    <h2 style={{ fontFamily: SERIF, fontSize: '28px', color: '#111', letterSpacing: '-0.4px', margin: '0 0 6px' }}>
                      Course Synopsis
                    </h2>
                    <p style={{ fontSize: '13px', color: '#aaa', fontFamily: SANS, margin: 0 }}>
                      A detailed summary of what was covered — for parents.
                    </p>
                  </div>
                  <button
                    onClick={() => { setShowSelectionUI(true); setSelectedBlockIds(new Set()); }}
                    style={{
                      fontFamily: SANS, fontSize: '12.5px', fontWeight: '500',
                      padding: '7px 14px', borderRadius: '8px', cursor: 'pointer',
                      background: 'transparent', border: '1px solid rgba(0,0,0,0.15)',
                      color: '#555', whiteSpace: 'nowrap', flexShrink: 0,
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    ↻ Generate New Synopsis
                  </button>
                </div>
                <div style={{ height: '1px', background: 'rgba(0,0,0,0.06)', marginBottom: '28px' }} />
                <p style={{ fontFamily: SANS, fontSize: '15.5px', color: '#333', lineHeight: '1.85', whiteSpace: 'pre-wrap', margin: 0 }}>
                  {synopsis}
                </p>
              </div>
            ) : isOwner ? (
              // Owner — show block selection UI
              <div>
                <div style={{ background: '#fff', borderRadius: '16px', padding: '32px 40px', boxShadow: '0 2px 16px rgba(0,0,0,0.07)', border: '1px solid rgba(0,0,0,0.05)', marginBottom: '16px' }}>
                  <h2 style={{ fontFamily: SERIF, fontSize: '26px', color: '#111', letterSpacing: '-0.4px', margin: '0 0 8px' }}>
                    Generate Synopsis
                  </h2>
                  <p style={{ fontSize: '13.5px', color: '#666', fontFamily: SANS, margin: '0 0 24px', lineHeight: '1.6' }}>
                    Select the content, worksheets, and activities that were completed during this course. EdCube will generate a detailed parent-facing synopsis.
                  </p>

                  {allSelectableBlocks.length === 0 ? (
                    <p style={{ fontFamily: SANS, fontSize: '14px', color: '#bbb', fontStyle: 'italic' }}>
                      No blocks found in this course. Add content, worksheets, or activities in the workspace first.
                    </p>
                  ) : (
                    <>
                      {/* Controls row */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={selectAll} style={{ fontFamily: SANS, fontSize: '12px', padding: '5px 12px', borderRadius: '6px', cursor: 'pointer', background: 'transparent', border: '1px solid rgba(0,0,0,0.15)', color: '#555' }}>
                            Select All
                          </button>
                          <button onClick={clearAll} style={{ fontFamily: SANS, fontSize: '12px', padding: '5px 12px', borderRadius: '6px', cursor: 'pointer', background: 'transparent', border: '1px solid rgba(0,0,0,0.15)', color: '#555' }}>
                            Clear All
                          </button>
                        </div>
                        <span style={{ fontSize: '13px', color: '#888', fontFamily: SANS }}>
                          {selectedBlockIds.size} of {allSelectableBlocks.length} block{allSelectableBlocks.length !== 1 ? 's' : ''} selected
                        </span>
                      </div>

                      {/* Block selection list grouped by section/subsection */}
                      {sections.filter(s => s.type !== 'break').map((section, sIdx) => {
                        const sectionBlocks = allSelectableBlocks.filter(b => b.sectionTitle === section.title);
                        if (sectionBlocks.length === 0) return null;

                        // Group by subsection
                        const bySubsection = {};
                        sectionBlocks.forEach(b => {
                          if (!bySubsection[b.subsectionTitle]) bySubsection[b.subsectionTitle] = [];
                          bySubsection[b.subsectionTitle].push(b);
                        });

                        return (
                          <div key={section.id} style={{ marginBottom: '20px' }}>
                            {/* Section header */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                              <div style={{ width: '20px', height: '2px', borderRadius: '1px', background: SECTION_GRADIENTS[sIdx % SECTION_GRADIENTS.length], flexShrink: 0 }} />
                              <span style={{ fontSize: '10.5px', fontWeight: '700', letterSpacing: '0.8px', textTransform: 'uppercase', color: '#999', fontFamily: SANS }}>
                                Section {sIdx + 1} — {section.title}
                              </span>
                            </div>

                            {Object.entries(bySubsection).map(([subTitle, blocks]) => (
                              <div key={subTitle} style={{ marginBottom: '14px', paddingLeft: '12px' }}>
                                <div style={{ fontSize: '13px', fontWeight: '500', color: '#555', fontFamily: SANS, marginBottom: '8px' }}>
                                  {subTitle}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '8px' }}>
                                  {blocks.map(block => {
                                    const cfg = BLOCK_CONFIG[block.blockType] || BLOCK_CONFIG.content;
                                    const selected = selectedBlockIds.has(block.id);
                                    return (
                                      <button
                                        key={block.id}
                                        onClick={() => toggleBlock(block.id)}
                                        style={{
                                          position: 'relative',
                                          aspectRatio: '1/1',
                                          backgroundColor: selected ? cfg.bg : '#F9F9F9',
                                          border: selected ? `2px solid ${cfg.color}` : '2px solid #e5e7eb',
                                          borderRadius: '10px',
                                          padding: '12px',
                                          display: 'flex',
                                          flexDirection: 'column',
                                          justifyContent: 'space-between',
                                          cursor: 'pointer',
                                          textAlign: 'left',
                                          transition: 'border-color 0.15s, background-color 0.15s',
                                        }}
                                      >
                                        {/* Checkmark */}
                                        <div style={{
                                          position: 'absolute', top: '8px', right: '8px',
                                          width: '18px', height: '18px', borderRadius: '50%',
                                          background: selected ? cfg.color : '#e5e7eb',
                                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                                          transition: 'background 0.15s',
                                          fontSize: '10px', color: 'white', flexShrink: 0,
                                        }}>
                                          {selected ? '✓' : ''}
                                        </div>
                                        <div>
                                          <span style={{
                                            fontSize: '10px', fontWeight: '700', textTransform: 'uppercase',
                                            letterSpacing: '0.5px', color: cfg.color,
                                            backgroundColor: `${cfg.color}22`,
                                            padding: '2px 6px', borderRadius: '4px',
                                            display: 'inline-block', marginBottom: '8px',
                                          }}>
                                            {cfg.label}
                                          </span>
                                          <p style={{
                                            margin: 0, fontSize: '12.5px', fontWeight: '500',
                                            color: '#111', lineHeight: '1.35', fontFamily: SANS,
                                            overflow: 'hidden',
                                            display: '-webkit-box',
                                            WebkitLineClamp: 3,
                                            WebkitBoxOrient: 'vertical',
                                          }}>
                                            {block.blockTitle}
                                          </p>
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })}

                      {/* Generate button */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
                        <button
                          onClick={handleGenerateSynopsis}
                          disabled={selectedBlockIds.size === 0 || synopsisLoading}
                          style={{
                            fontFamily: SANS, fontSize: '14px', fontWeight: '600',
                            padding: '10px 24px', borderRadius: '10px', cursor: selectedBlockIds.size === 0 || synopsisLoading ? 'not-allowed' : 'pointer',
                            background: selectedBlockIds.size === 0 ? '#e5e7eb' : '#111',
                            border: 'none',
                            color: selectedBlockIds.size === 0 ? '#aaa' : '#fff',
                            transition: 'background 0.15s',
                            display: 'flex', alignItems: 'center', gap: '8px',
                          }}
                        >
                          {synopsisLoading ? (
                            <>
                              <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                              Generating…
                            </>
                          ) : (
                            `Generate Synopsis`
                          )}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              // Non-owner: show synopsis read-only
              <div style={{ background: '#fff', borderRadius: '16px', padding: '48px', boxShadow: '0 2px 16px rgba(0,0,0,0.07)', border: '1px solid rgba(0,0,0,0.05)' }}>
                <h2 style={{ fontFamily: SERIF, fontSize: '28px', color: '#111', letterSpacing: '-0.4px', margin: '0 0 28px' }}>
                  Course Synopsis
                </h2>
                {synopsis ? (
                  <p style={{ fontFamily: SANS, fontSize: '15.5px', color: '#333', lineHeight: '1.85', whiteSpace: 'pre-wrap', margin: 0 }}>
                    {synopsis}
                  </p>
                ) : (
                  <p style={{ fontFamily: SANS, fontSize: '14px', color: '#bbb', fontStyle: 'italic', margin: 0 }}>
                    The teacher hasn&apos;t generated a synopsis yet.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Course Info tab ───────────────────────────────────────────────── */}
        {activeView === 'course-info' && (
          <div style={{ background: '#fff', borderRadius: '16px', padding: '48px', boxShadow: '0 2px 16px rgba(0,0,0,0.07)', border: '1px solid rgba(0,0,0,0.05)' }}>
            <h2 style={{ fontFamily: SERIF, fontSize: '28px', color: '#111', letterSpacing: '-0.4px', margin: '0 0 8px' }}>
              Course Details
            </h2>
            {isOwner && (
              <p style={{ fontSize: '13px', color: '#aaa', fontFamily: SANS, margin: '0 0 28px' }}>
                Click any field to edit. Changes are saved automatically.
              </p>
            )}
            {!isOwner && <div style={{ marginBottom: '28px' }} />}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {[
                { label: 'Course Name',  key: 'courseName',  multiline: false },
                { label: 'Subject', key: 'subject', multiline: false },
                { label: 'Topic',   key: 'topic',   multiline: false },
                { label: 'Age Range (Start)', key: 'ageRangeStart', multiline: false },
                { label: 'Age Range (End)',   key: 'ageRangeEnd',   multiline: false },
                { label: 'No. of Students',  key: 'numStudents',   multiline: false },
                { label: 'Time Duration',    key: 'timeDuration',  multiline: false },
                { label: 'Time Unit',        key: 'timeUnit',      multiline: false },
                { label: 'Objectives / Notes', key: 'objectives', multiline: true },
              ].map(row => (
                <div key={row.key} style={{ display: 'flex', gap: '24px', paddingBottom: '20px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                  <div style={{ width: '160px', flexShrink: 0, fontSize: '12px', fontWeight: '600', letterSpacing: '0.6px', textTransform: 'uppercase', color: '#999', paddingTop: '2px', fontFamily: SANS }}>
                    {row.label}
                  </div>
                  <div style={{ flex: 1 }}>
                    <InlineField
                      value={editableFormData[row.key] || ''}
                      onChange={val => setEditableFormData(prev => ({ ...prev, [row.key]: val }))}
                      onSave={val => saveField({ [row.key]: val })}
                      multiline={row.multiline}
                      placeholder={isOwner ? `Add ${row.label.toLowerCase()}…` : '—'}
                      disabled={!isOwner}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Outline view ─────────────────────────────────────────────────── */}
        {activeView === 'outline' && (
          <div ref={docRef}>

            {/* ── Course head: title + subject/age pills + section/lesson/duration stats ── */}
            <div style={{ marginBottom: '18px' }}>
              <h1 style={{ fontFamily: SERIF_TEXT, fontWeight: '400', fontSize: '36px', color: '#111', margin: '0 0 12px', lineHeight: '1.15' }}>
                {courseName}
              </h1>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  {(editableFormData.subject || editableFormData.topic) && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', height: '32px', padding: '0 16px',
                      borderRadius: '32px', fontSize: '13px', fontWeight: '600', letterSpacing: '0.03em',
                      textTransform: 'uppercase', whiteSpace: 'nowrap', background: GREEN_BG, color: GREEN_TEXT,
                    }}>
                      {[editableFormData.subject, editableFormData.topic].filter(Boolean).join(' · ')}
                    </span>
                  )}
                  {(editableFormData.ageRangeStart && editableFormData.ageRangeEnd) && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', height: '32px', padding: '0 16px',
                      borderRadius: '32px', fontSize: '13px', fontWeight: '600', letterSpacing: '0.03em',
                      textTransform: 'uppercase', whiteSpace: 'nowrap', background: BLUE_SOFT_BG, color: '#3083ff',
                    }}>
                      {`Ages ${editableFormData.ageRangeStart}–${editableFormData.ageRangeEnd}`}
                    </span>
                  )}
                  {!isOwner && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', height: '32px', padding: '0 16px',
                      borderRadius: '32px', fontSize: '12px', fontWeight: '500', background: '#f3f4f6', color: '#666',
                    }}>
                      {isCollaborator ? 'Collaborator' : 'View Only'}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', height: '34px', padding: '0 14px', borderRadius: '30px', background: PILL_NEUTRAL_BG, color: PILL_NEUTRAL_TEXT, fontSize: '13px', fontWeight: '500', whiteSpace: 'nowrap' }}>
                    <Grid2x2 size={16} color="#a3a3a3" /> {sectionCount} Section{sectionCount !== 1 ? 's' : ''}
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', height: '34px', padding: '0 14px', borderRadius: '30px', background: PILL_NEUTRAL_BG, color: PILL_NEUTRAL_TEXT, fontSize: '13px', fontWeight: '500', whiteSpace: 'nowrap' }}>
                    <FileText size={16} color="#a3a3a3" /> {lessonCount} Lesson{lessonCount !== 1 ? 's' : ''}
                  </span>
                  {totalMins > 0 && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', height: '34px', padding: '0 14px', borderRadius: '30px', background: PILL_NEUTRAL_BG, color: PILL_NEUTRAL_TEXT, fontSize: '13px', fontWeight: '500', whiteSpace: 'nowrap' }}>
                      <Clock size={16} color="#a3a3a3" /> {durationLabel}
                    </span>
                  )}
                  {isOwner && (
                    <button
                      onClick={handleDownloadPdf}
                      disabled={downloading}
                      style={{ fontFamily: SANS, fontSize: '12.5px', fontWeight: '500', padding: '0 14px', height: '34px', borderRadius: '30px', cursor: downloading ? 'default' : 'pointer', background: 'transparent', border: '1px solid rgba(0,0,0,0.12)', color: '#555', opacity: downloading ? 0.6 : 1, flexShrink: 0, whiteSpace: 'nowrap' }}
                    >
                      {downloading ? 'Generating…' : '↓ Download PDF'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* ── Sections — all render stacked here. Each "Section N ▾" toggle only
                 expands/collapses that section's own day-card + lesson list; it never
                 switches which section is visible (confirmed behavior, not a switcher). ── */}
            {sections.length === 0 ? (
              <p style={{ color: '#aaa', fontSize: '15px', fontFamily: SANS, marginTop: '22px' }}>This course has no sections yet.</p>
            ) : sections.map((section, sIdx) => {

              if (section.type === 'break') {
                return (
                  <div key={section.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', margin: '22px 0' }}>
                    <div style={{ flex: 1, height: '1px', background: 'rgba(0,0,0,0.07)' }} />
                    <span style={{ fontSize: '13px', color: '#aaa', fontFamily: SANS, whiteSpace: 'nowrap' }}>⏸ Break — {section.duration}</span>
                    <div style={{ flex: 1, height: '1px', background: 'rgba(0,0,0,0.07)' }} />
                  </div>
                );
              }

              const isCollapsed = !!collapsedSections[section.id];

              return (
                <div key={section.id} style={{ marginBottom: '26px' }}>
                  <button
                    onClick={() => toggleSection(section.id)}
                    aria-expanded={!isCollapsed}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px', color: BLUE, fontSize: '15px',
                      fontWeight: '600', letterSpacing: '0.03em', textTransform: 'uppercase', margin: '22px 0 16px',
                      cursor: 'pointer', background: 'none', border: 'none', padding: 0, fontFamily: SANS,
                    }}
                  >
                    Section {sIdx + 1}
                    <ChevronDown size={13} style={{ transform: isCollapsed ? 'none' : 'rotate(180deg)', transition: 'transform 0.15s ease' }} />
                  </button>

                  {/*
                    Highlighted section summary card — section.title / section.description.
                    Always visible, even when the section is collapsed: collapsing only
                    hides the lesson cards below, not the section's own day info.
                  */}
                  <div style={{ background: CARD_HIGHLIGHT, borderRadius: '16px', padding: '26px 32px', marginBottom: isCollapsed ? 0 : '22px' }}>
                    <h2 style={{ fontFamily: SANS, fontWeight: '600', fontSize: '26px', color: '#111', margin: '0 0 10px', lineHeight: '1.25' }}>
                      {section.title}
                    </h2>
                    {section.description && (
                      <p style={{ margin: 0, fontSize: '16px', lineHeight: '1.65', color: TEXT_BODY, maxWidth: '78ch' }}>
                        {section.description}
                      </p>
                    )}
                  </div>

                  {!isCollapsed && (
                    (section.subsections || []).length === 0 ? (
                      <p style={{ fontSize: '14px', color: '#aaa', fontStyle: 'italic', fontFamily: SANS }}>No lessons in this section.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                        {(section.subsections || []).map(sub => (
                          <LessonCard
                            key={sub.id}
                            sub={sub}
                            handsOnResources={handsOnResources}
                            modulesExpanded={!!expandedModules[sub.id]}
                            onToggleModules={toggleModules}
                          />
                        ))}
                      </div>
                    )
                  )}
                </div>
              );
            })}
          </div>
        )}

      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default CourseViewPage;
