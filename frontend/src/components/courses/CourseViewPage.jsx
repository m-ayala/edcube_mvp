// src/components/courses/CourseViewPage.jsx
import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { generateSynopsis, generateCourseDescription } from '../../utils/curriculumApi';
import html2pdf from 'html2pdf.js';

const SERIF = "'DM Serif Display', serif";
const SANS  = "'DM Sans', sans-serif";
const API_BASE = import.meta.env.VITE_API_BASE_URL;

// ── Palette ───────────────────────────────────────────────────────────────────
const SECTION_GRADIENTS = [
  'linear-gradient(90deg,#B2E8C8,#ACD8F0)',
  'linear-gradient(90deg,#F2C0D4,#F7E4A0)',
  'linear-gradient(90deg,#ACD8F0,#B2E8C8)',
  'linear-gradient(90deg,#F7E4A0,#F2C0D4)',
];

const LESSON_GRADIENTS = [
  'linear-gradient(180deg,#ACD8F0,#B2E8C8)',
  'linear-gradient(180deg,#B2E8C8,#F7E4A0)',
  'linear-gradient(180deg,#F2C0D4,#F7E4A0)',
  'linear-gradient(180deg,#F7E4A0,#F2C0D4)',
  'linear-gradient(180deg,#ACD8F0,#F2C0D4)',
  '#ACD8F0',
  '#B2E8C8',
  '#F7E4A0',
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
const ResourceItem = ({ resource, type }) => {
  const thumb = type === 'video' ? getYouTubeThumbnail(resource.url) : null;
  const badge = BADGE_STYLES[type] || BADGE_STYLES.video;
  const [hovered, setHovered] = useState(false);

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

// ── Lesson row (subsection) ───────────────────────────────────────────────────
const LessonRow = ({ sub, gradient, handsOnResources, isLast }) => {
  const blocks = handsOnResources[sub.id] || [];
  const allVideos     = sub.video_resources || [];
  const allWorksheets = blocks.filter(b => b.type === 'worksheet');
  const allActivities = blocks.filter(b => b.type === 'activity');
  const allContent    = blocks.filter(b => b.type === 'content');
  const hasResources = allVideos.length > 0 || allContent.length > 0 || allWorksheets.length > 0 || allActivities.length > 0;

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: '16px',
      padding: '20px 0',
      borderTop: '1px solid rgba(0,0,0,0.06)',
      ...(isLast ? { borderBottom: '1px solid rgba(0,0,0,0.06)' } : {}),
    }}>
      <div style={{ width: '2px', flexShrink: 0, borderRadius: '2px', alignSelf: 'stretch', minHeight: '40px', background: gradient }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '15.5px', fontWeight: '500', color: '#111', marginBottom: '5px', lineHeight: '1.35', fontFamily: SANS }}>
          {sub.title}
        </div>
        {sub.description && (
          <div style={{ fontSize: '13.5px', color: '#666', lineHeight: '1.65', marginBottom: '12px', fontFamily: SANS }}>
            {sub.description}
          </div>
        )}
        {sub.duration_minutes > 0 && (
          <div style={{ fontSize: '12px', color: '#AAA', marginBottom: hasResources ? '14px' : 0, fontFamily: SANS }}>
            🕐 {sub.duration_minutes} min
          </div>
        )}
        {(sub.learning_objectives || []).length > 0 && (
          <ul style={{ margin: '0 0 14px', paddingLeft: '18px', fontSize: '13px', color: '#555', lineHeight: '1.65', fontFamily: SANS }}>
            {sub.learning_objectives.map((obj, i) => <li key={i}>{obj}</li>)}
          </ul>
        )}
        {hasResources && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ fontSize: '10.5px', fontWeight: '600', letterSpacing: '0.8px', textTransform: 'uppercase', color: '#C0BAB0', marginBottom: '4px', fontFamily: SANS }}>
              Resources
            </div>
            {allVideos.map((v, i)     => <ResourceItem key={`v${i}`} resource={v} type="video"     />)}
            {allContent.map((c, i)    => <ResourceItem key={`c${i}`} resource={c} type="content"   />)}
            {allWorksheets.map((w, i) => <ResourceItem key={`w${i}`} resource={w} type="worksheet" />)}
            {allActivities.map((a, i) => <ResourceItem key={`a${i}`} resource={a} type="activity"  />)}
          </div>
        )}
      </div>
    </div>
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
      setDownloading(false);
    }
  };

  const currentFormData = () => ({ ...incomingFormData, ...editableFormData, courseDescription, synopsis });

  const handleEditInWorkspace = () =>
    navigate('/course-workspace', {
      state: { formData: currentFormData(), sections, isEditing: true, curriculumId, isPublic, readOnly: false, isOwner: true }
    });

  const handleEditAsCollaborator = () =>
    navigate('/course-workspace', {
      state: { formData: currentFormData(), sections, isEditing: true, curriculumId, isPublic, readOnly: false, isOwner: false, isCollaborator: true }
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
        subject: editableFormData.subject,
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
    setDescriptionLoading(true);
    try {
      const result = await generateCourseDescription({
        courseName,
        subject:       editableFormData.subject,
        topic:         editableFormData.topic,
        ageRangeStart: editableFormData.ageRangeStart,
        ageRangeEnd:   editableFormData.ageRangeEnd,
        numStudents:   editableFormData.numStudents,
        timeDuration:  editableFormData.timeDuration,
        timeUnit:      editableFormData.timeUnit,
        objectives:    editableFormData.objectives,
        teacherUid:    currentUser?.uid || null,
      });
      if (result.description) {
        setCourseDescription(result.description);
        await saveField({ courseDescription: result.description });
      }
    } catch (err) {
      console.error('Description generation error:', err);
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

  let lessonGIdx = 0;

  const tabs = [
    { id: 'outline',     label: 'Course Outline' },
    { id: 'description', label: 'Description' },
    { id: 'synopsis',    label: 'Synopsis' },
    { id: 'course-info', label: 'Course Info' },
  ];

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

      {/* ── Sticky topbar ────────────────────────────────────────────────── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 9,
        background: 'rgba(255,255,255,0.7)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
        padding: '0 32px', height: '58px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            onClick={() => navigate('/my-courses')}
            style={{ fontFamily: SANS, fontSize: '12.5px', fontWeight: '500', padding: '6px 13px', borderRadius: '8px', cursor: 'pointer', background: 'transparent', border: '1px solid rgba(0,0,0,0.12)', color: '#555', transition: 'background 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            ← My Courses
          </button>
          <span style={{ fontSize: '14px', fontWeight: '500', color: '#111', fontFamily: SANS }}>{courseName}</span>
          {!isOwner && ownerName && (
            <span style={{ fontSize: '12.5px', color: '#888', fontFamily: SANS }}>by {ownerName}</span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {isOwner && (
            <button
              onClick={handleEditInWorkspace}
              style={{ fontFamily: SANS, fontSize: '12.5px', fontWeight: '500', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', background: '#111', border: '1px solid #111', color: '#fff' }}
            >
              ✎ Edit in Workspace
            </button>
          )}
          {isCollaborator && (
            <button
              onClick={handleEditAsCollaborator}
              style={{ fontFamily: SANS, fontSize: '12.5px', fontWeight: '500', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', background: '#111', border: '1px solid #111', color: '#fff' }}
            >
              ✎ Edit as Collaborator
            </button>
          )}
        </div>
      </div>

      {/* ── Tab bar ──────────────────────────────────────────────────────── */}
      <div style={{
        position: 'sticky', top: '58px', zIndex: 8,
        background: 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
        padding: '0 32px',
        display: 'flex', gap: '0',
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveView(tab.id)}
            style={{
              fontFamily: SANS, fontSize: '13px', fontWeight: activeView === tab.id ? '600' : '400',
              padding: '12px 18px',
              background: 'transparent', border: 'none',
              borderBottom: activeView === tab.id ? '2px solid #111' : '2px solid transparent',
              color: activeView === tab.id ? '#111' : '#888',
              cursor: 'pointer', transition: 'color 0.15s',
              marginBottom: '-1px',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Document body ─────────────────────────────────────────────────── */}
      <div style={{ maxWidth: '740px', margin: '0 auto', padding: '40px 24px 100px' }}>

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
                  {courseDescription && !descriptionLoading && (
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
                { label: 'Subject',      key: 'subject',     multiline: false },
                { label: 'Topic',        key: 'topic',       multiline: false },
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
          <div ref={docRef} style={{ background: '#fff', borderRadius: '16px', padding: '48px 48px 64px', boxShadow: '0 2px 16px rgba(0,0,0,0.07)', border: '1px solid rgba(0,0,0,0.05)' }}>

            {(editableFormData.subject || (editableFormData.ageRangeStart && editableFormData.ageRangeEnd)) && (
              <div style={{ fontSize: '11.5px', fontWeight: '500', letterSpacing: '0.8px', textTransform: 'uppercase', color: '#999', marginBottom: '10px', fontFamily: SANS }}>
                {[
                  editableFormData.subject,
                  editableFormData.ageRangeStart && editableFormData.ageRangeEnd
                    ? `Ages ${editableFormData.ageRangeStart}–${editableFormData.ageRangeEnd}`
                    : null
                ].filter(Boolean).join(' · ')}
              </div>
            )}

            <h1 style={{ fontFamily: SERIF, fontSize: '40px', color: '#111', letterSpacing: '-1px', lineHeight: '1.1', margin: '0 0 16px' }}>
              {courseName}
            </h1>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', marginBottom: '40px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '13px', color: '#888', flexWrap: 'wrap', fontFamily: SANS }}>
                <span>{sectionCount} section{sectionCount !== 1 ? 's' : ''}</span>
                <Dot />
                <span>{lessonCount} lesson{lessonCount !== 1 ? 's' : ''}</span>
                {totalMins > 0 && (
                  <>
                    <Dot />
                    <span>{durationLabel} total</span>
                  </>
                )}
                {!isOwner && (
                  <>
                    <Dot />
                    <span style={{ background: '#f3f4f6', padding: '2px 8px', borderRadius: '8px', fontSize: '11.5px' }}>
                      {isCollaborator ? 'Collaborator' : 'View Only'}
                    </span>
                  </>
                )}
              </div>
              {isOwner && (
                <button
                  onClick={handleDownloadPdf}
                  disabled={downloading}
                  style={{ fontFamily: SANS, fontSize: '12.5px', fontWeight: '500', padding: '6px 14px', borderRadius: '8px', cursor: downloading ? 'default' : 'pointer', background: 'transparent', border: '1px solid rgba(0,0,0,0.12)', color: '#555', opacity: downloading ? 0.6 : 1, flexShrink: 0 }}
                >
                  {downloading ? 'Generating…' : '↓ Download PDF'}
                </button>
              )}
            </div>

            <div style={{ height: '1px', background: 'rgba(0,0,0,0.07)', marginBottom: '48px' }} />

            {sections.length === 0 ? (
              <p style={{ color: '#aaa', fontSize: '15px', fontFamily: SANS }}>This course has no sections yet.</p>
            ) : sections.map((section, sIdx) => {

              if (section.type === 'break') {
                return (
                  <div key={section.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '48px' }}>
                    <div style={{ flex: 1, height: '1px', background: 'rgba(0,0,0,0.07)' }} />
                    <span style={{ fontSize: '13px', color: '#aaa', fontFamily: SANS, whiteSpace: 'nowrap' }}>⏸ Break — {section.duration}</span>
                    <div style={{ flex: 1, height: '1px', background: 'rgba(0,0,0,0.07)' }} />
                  </div>
                );
              }

              const secGrad = SECTION_GRADIENTS[sIdx % SECTION_GRADIENTS.length];

              return (
                <div key={section.id} style={{ marginBottom: '52px' }}>
                  <div style={{ fontSize: '10px', fontWeight: '600', letterSpacing: '1.2px', textTransform: 'uppercase', color: '#B0A898', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: SANS }}>
                    <span style={{ display: 'inline-block', width: '24px', height: '2px', borderRadius: '1px', background: secGrad }} />
                    Section {sIdx + 1}
                  </div>

                  <h2 style={{ fontFamily: SERIF, fontSize: '26px', color: '#111', letterSpacing: '-0.4px', lineHeight: '1.2', margin: '0 0 10px' }}>
                    {section.title}
                  </h2>

                  {section.description && (
                    <p style={{ fontSize: '14px', color: '#666', lineHeight: '1.7', margin: '0 0 28px', fontFamily: SANS }}>
                      {section.description}
                    </p>
                  )}

                  {(section.subsections || []).length === 0 ? (
                    <p style={{ fontSize: '14px', color: '#aaa', fontStyle: 'italic', fontFamily: SANS }}>No lessons in this section.</p>
                  ) : (section.subsections || []).map((sub, subIdx) => {
                    const gradient = LESSON_GRADIENTS[lessonGIdx++ % LESSON_GRADIENTS.length];
                    const isLast = subIdx === (section.subsections.length - 1);
                    return (
                      <LessonRow
                        key={sub.id}
                        sub={sub}
                        gradient={gradient}
                        handsOnResources={handsOnResources}
                        isLast={isLast}
                      />
                    );
                  })}
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

const Dot = () => (
  <div style={{ width: '3px', height: '3px', borderRadius: '50%', background: '#CCC', flexShrink: 0 }} />
);

export default CourseViewPage;
