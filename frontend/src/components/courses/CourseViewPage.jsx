// src/components/courses/CourseViewPage.jsx
import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import html2pdf from 'html2pdf.js';

const SERIF = "'DM Serif Display', serif";
const SANS  = "'DM Sans', sans-serif";

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

const PLA_STYLES = {
  'Personal Growth':      { bg: '#F2C0D4', color: '#7A1A3A' },
  'Core Learning':        { bg: '#ACD8F0', color: '#0C3A5A' },
  'Critical Thinking':    { bg: '#F7E4A0', color: '#5C3A08' },
  'Application & Impact': { bg: '#B2E8C8', color: '#1C5C35' },
};

const BADGE_STYLES = {
  video:     { bg: '#EDE9F8', color: '#4B3899', label: 'Video' },
  worksheet: { bg: '#EAF3DE', color: '#27500A', label: 'Worksheet' },
  activity:  { bg: '#FAEEDA', color: '#633806', label: 'Activity' },
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
      {/* Thumbnail / icon */}
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

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', color: '#222', fontFamily: SANS, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {resource.title}
        </div>
        <div style={{ fontSize: '11px', color: '#AAA', marginTop: '1px', fontFamily: SANS }}>
          {type === 'video' ? 'YouTube' : type === 'worksheet' ? 'PDF' : 'Hands-on'}
        </div>
      </div>

      {/* Badge */}
      <span style={{ fontSize: '10.5px', fontWeight: '500', fontFamily: SANS, padding: '2px 8px', borderRadius: '6px', flexShrink: 0, background: badge.bg, color: badge.color }}>
        {badge.label}
      </span>
    </a>
  );
};

// ── Lesson row (subsection) ───────────────────────────────────────────────────
const LessonRow = ({ sub, gradient, videosByTopic, handsOnResources, isLast }) => {
  // Aggregate from all topic boxes in this subsection
  const allVideos = [];
  const allWorksheets = [];
  const allActivities = [];
  const allPillars = new Set();

  (sub.topicBoxes || []).forEach(topic => {
    (videosByTopic[topic.id] || []).forEach(v => allVideos.push(v));
    (handsOnResources[topic.id] || []).forEach(r => {
      if (r.type === 'worksheet') allWorksheets.push(r);
      else allActivities.push(r);
    });
    (topic.pla_pillars || []).forEach(p => allPillars.add(p));
  });

  const hasResources = allVideos.length > 0 || allWorksheets.length > 0 || allActivities.length > 0;

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: '16px',
      padding: '20px 0',
      borderTop: '1px solid rgba(0,0,0,0.06)',
      ...(isLast ? { borderBottom: '1px solid rgba(0,0,0,0.06)' } : {}),
    }}>
      {/* Left gradient bar */}
      <div style={{ width: '2px', flexShrink: 0, borderRadius: '2px', alignSelf: 'stretch', minHeight: '40px', background: gradient }} />

      {/* Body */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '15.5px', fontWeight: '500', color: '#111', marginBottom: '5px', lineHeight: '1.35', fontFamily: SANS }}>
          {sub.title}
        </div>
        {sub.description && (
          <div style={{ fontSize: '13.5px', color: '#666', lineHeight: '1.65', marginBottom: '12px', fontFamily: SANS }}>
            {sub.description}
          </div>
        )}

        {/* PLA tags */}
        {allPillars.size > 0 && (
          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: hasResources ? '16px' : 0 }}>
            {[...allPillars].map(p => {
              const s = PLA_STYLES[p] || { bg: '#F5F5F4', color: '#78716C' };
              return (
                <span key={p} style={{ fontSize: '10.5px', fontWeight: '500', fontFamily: SANS, padding: '2px 9px', borderRadius: '20px', background: s.bg, color: s.color }}>
                  {p}
                </span>
              );
            })}
          </div>
        )}

        {/* Resources */}
        {hasResources && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ fontSize: '10.5px', fontWeight: '600', letterSpacing: '0.8px', textTransform: 'uppercase', color: '#C0BAB0', marginBottom: '4px', fontFamily: SANS }}>
              Resources
            </div>
            {allVideos.map((v, i)     => <ResourceItem key={`v${i}`} resource={v} type="video"     />)}
            {allWorksheets.map((w, i) => <ResourceItem key={`w${i}`} resource={w} type="worksheet" />)}
            {allActivities.map((a, i) => <ResourceItem key={`a${i}`} resource={a} type="activity"  />)}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────
const CourseViewPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    formData,
    sections: incomingSections = [],
    curriculumId,
    isPublic,
    isOwner       = false,
    ownerName     = '',
    isCollaborator = false,
  } = location.state || {};

  const [sections]             = useState(incomingSections);
  const [videosByTopic,    setVideosByTopic]    = useState({});
  const [handsOnResources, setHandsOnResources] = useState({});
  const [downloading, setDownloading] = useState(false);
  const [activeView, setActiveView] = useState('outline');
  const docRef = useRef(null);
  const courseName = formData?.courseName || '';

  // Hydrate resource caches from embedded topic data
  useEffect(() => {
    const vids = {};
    const ho   = {};
    sections.forEach(section => {
      (section.subsections || []).forEach(sub => {
        (sub.topicBoxes || []).forEach(topic => {
          if (topic.video_resources?.length) vids[topic.id] = topic.video_resources;
          const res = [...(topic.worksheets || []), ...(topic.activities || [])];
          if (res.length) ho[topic.id] = res;
        });
      });
    });
    setVideosByTopic(vids);
    setHandsOnResources(ho);
  }, []);

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

  const handleEditInWorkspace = () =>
    navigate('/course-workspace', { state: { formData, sections, isEditing: true, curriculumId, isPublic, readOnly: false, isOwner: true } });

  const handleEditAsCollaborator = () =>
    navigate('/course-workspace', { state: { formData, sections, isEditing: true, curriculumId, isPublic, readOnly: false, isOwner: false, isCollaborator: true } });

  // Stats
  const sectionCount = sections.filter(s => s.type !== 'break').length;
  const lessonCount  = sections.reduce((a, s) => a + (s.subsections?.length || 0), 0);
  const totalMins    = sections.reduce((a, s) =>
    a + (s.subsections?.reduce((t, sub) =>
      t + (sub.topicBoxes?.reduce((m, tp) => m + (tp.duration_minutes || 0), 0) || 0), 0) || 0), 0);
  const durationLabel = totalMins < 60
    ? `${totalMins} min`
    : totalMins % 60 === 0
      ? `${totalMins / 60} hr`
      : `${Math.floor(totalMins / 60)} hr ${totalMins % 60} min`;

  // Gradient counter — increments per lesson across the whole document
  let lessonGIdx = 0;

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
              onClick={handleDownloadPdf}
              disabled={downloading}
              style={{ fontFamily: SANS, fontSize: '12.5px', fontWeight: '500', padding: '6px 14px', borderRadius: '8px', cursor: downloading ? 'default' : 'pointer', background: 'transparent', border: '1px solid rgba(0,0,0,0.12)', color: '#555', opacity: downloading ? 0.6 : 1 }}
            >
              {downloading ? 'Generating…' : '↓ Download PDF'}
            </button>
          )}
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
        {[
          { id: 'outline',     label: 'Course Outline' },
          { id: 'course-info', label: 'Course Info' },
        ].map(tab => (
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

      {/* ── Course Info view ─────────────────────────────────────────────── */}
      {activeView === 'course-info' && (
        <div style={{ background: '#fff', borderRadius: '16px', padding: '48px', boxShadow: '0 2px 16px rgba(0,0,0,0.07)', border: '1px solid rgba(0,0,0,0.05)' }}>
          <h2 style={{ fontFamily: SERIF, fontSize: '28px', color: '#111', letterSpacing: '-0.4px', margin: '0 0 32px' }}>
            Course Details
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {[
              { label: 'Course Name',        value: formData?.courseName },
              { label: 'Subject',            value: formData?.subject },
              { label: 'Topic',              value: formData?.topic },
              {
                label: 'Student Age Range',
                value: formData?.ageRangeStart && formData?.ageRangeEnd
                  ? `${formData.ageRangeStart}–${formData.ageRangeEnd} years old`
                  : null
              },
              {
                label: 'Number of Students',
                value: formData?.numStudents ? String(formData.numStudents) : null
              },
              {
                label: 'Time Duration',
                value: formData?.timeDuration
                  ? `${formData.timeDuration}${formData?.timeUnit ? ' ' + formData.timeUnit : ''}`
                  : null
              },
              { label: 'Objectives / Notes', value: formData?.objectives, multiline: true },
            ].filter(row => row.value).map(row => (
              <div key={row.label} style={{ display: 'flex', gap: '24px', paddingBottom: '20px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                <div style={{ width: '160px', flexShrink: 0, fontSize: '12px', fontWeight: '600', letterSpacing: '0.6px', textTransform: 'uppercase', color: '#999', paddingTop: '2px', fontFamily: SANS }}>
                  {row.label}
                </div>
                <div style={{ flex: 1, fontSize: '15px', color: '#111', fontFamily: SANS, lineHeight: row.multiline ? '1.7' : '1.4', whiteSpace: row.multiline ? 'pre-wrap' : 'normal' }}>
                  {row.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Outline view ─────────────────────────────────────────────────── */}
      {activeView === 'outline' && (
      <div ref={docRef} style={{ background: '#fff', borderRadius: '16px', padding: '48px 48px 64px', boxShadow: '0 2px 16px rgba(0,0,0,0.07)', border: '1px solid rgba(0,0,0,0.05)' }}>

        {/* Eyebrow */}
        {(formData?.subject || (formData?.ageRangeStart && formData?.ageRangeEnd)) && (
          <div style={{ fontSize: '11.5px', fontWeight: '500', letterSpacing: '0.8px', textTransform: 'uppercase', color: '#999', marginBottom: '10px', fontFamily: SANS }}>
            {[
              formData?.subject,
              formData?.ageRangeStart && formData?.ageRangeEnd
                ? `Ages ${formData.ageRangeStart}–${formData.ageRangeEnd}`
                : null
            ].filter(Boolean).join(' · ')}
          </div>
        )}

        {/* Course title */}
        <h1 style={{ fontFamily: SERIF, fontSize: '40px', color: '#111', letterSpacing: '-1px', lineHeight: '1.1', margin: '0 0 16px' }}>
          {courseName}
        </h1>

        {/* Meta */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '13px', color: '#888', marginBottom: '40px', flexWrap: 'wrap', fontFamily: SANS }}>
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

        {/* Divider */}
        <div style={{ height: '1px', background: 'rgba(0,0,0,0.07)', marginBottom: '48px' }} />

        {/* Sections */}
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

              {/* Section eyebrow */}
              <div style={{ fontSize: '10px', fontWeight: '600', letterSpacing: '1.2px', textTransform: 'uppercase', color: '#B0A898', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: SANS }}>
                <span style={{ display: 'inline-block', width: '24px', height: '2px', borderRadius: '1px', background: secGrad }} />
                Section {sIdx + 1}
              </div>

              {/* Section title */}
              <h2 style={{ fontFamily: SERIF, fontSize: '26px', color: '#111', letterSpacing: '-0.4px', lineHeight: '1.2', margin: '0 0 10px' }}>
                {section.title}
              </h2>

              {/* Section description */}
              {section.description && (
                <p style={{ fontSize: '14px', color: '#666', lineHeight: '1.7', margin: '0 0 28px', fontFamily: SANS }}>
                  {section.description}
                </p>
              )}

              {/* Lessons (subsections) */}
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
                    videosByTopic={videosByTopic}
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
    </div>
  );
};

const Dot = () => (
  <div style={{ width: '3px', height: '3px', borderRadius: '50%', background: '#CCC', flexShrink: 0 }} />
);

export default CourseViewPage;
