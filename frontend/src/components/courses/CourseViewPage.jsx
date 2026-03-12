// src/components/courses/CourseViewPage.jsx
// Full-page read-only view — no box outlines, pure indentation hierarchy
import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ArrowLeft, PencilLine, Edit2, PlayCircle, FileText, Zap, Download } from 'lucide-react';
import TopicDetailsModal from '../modals/TopicDetailsModal';

// ── Design tokens ─────────────────────────────────────────────────────────────
const SERIF = "'Fraunces', serif";

const colors = {
  bg: '#F7F5F0',
  sectionStripe:    '#52A67A',
  subsectionStripe: '#5B8FBD',
  topicStripe:      '#C2547A',
  border:           '#E7E5E4',
  textPrimary:      '#1C1917',
  textSecondary:    '#78716C',
  pillBg:           '#F5F5F4',
  pla: {
    'Personal Growth':      '#FEF3C7',
    'Core Learning':        '#E0F2FE',
    'Critical Thinking':    '#FDF4FF',
    'Application & Impact': '#F0FDF4'
  },
  plaText: {
    'Personal Growth':      '#92400E',
    'Core Learning':        '#0369A1',
    'Critical Thinking':    '#7E22CE',
    'Application & Impact': '#166534'
  }
};

// ── Resource card strip ───────────────────────────────────────────────────────
const getYouTubeThumbnail = (url) => {
  try {
    const u = new URL(url);
    let vid = null;
    if (u.hostname.includes('youtube.com'))  vid = u.searchParams.get('v');
    else if (u.hostname.includes('youtu.be')) vid = u.pathname.slice(1).split('?')[0];
    if (vid) return `https://img.youtube.com/vi/${vid}/mqdefault.jpg`;
  } catch {}
  return null;
};

const ResourceCards = ({ resources, type }) => {
  if (resources.length === 0) {
    return (
      <div style={{ padding: '12px 0', color: '#9ca3af', fontSize: '14px', fontStyle: 'italic', fontFamily: SERIF }}>
        No {type} added for this topic.
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', padding: '12px 0', scrollbarWidth: 'thin' }}>
      {resources.map((resource, idx) => {
        const thumb   = type === 'video' ? getYouTubeThumbnail(resource.url) : null;
        const icon    = type === 'video'      ? <PlayCircle size={22} color="#9ca3af" />
                      : type === 'worksheet'  ? <FileText   size={22} color="#9ca3af" />
                      :                        <Zap         size={22} color="#9ca3af" />;
        const iconBg  = type === 'video' ? '#E8E6E1' : type === 'worksheet' ? '#E4EEE4' : '#E8E4EE';

        return (
          <a
            key={idx}
            href={resource.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            title={resource.title}
            style={{
              display: 'flex', flexDirection: 'column', width: '140px', flexShrink: 0,
              border: `1px solid ${colors.border}`, borderRadius: '8px', overflow: 'hidden',
              textDecoration: 'none', backgroundColor: '#fff',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              transition: 'box-shadow 0.2s, transform 0.15s'
            }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 10px rgba(0,0,0,0.14)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'; e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            {thumb
              ? <img src={thumb} alt={resource.title} style={{ width: '100%', height: '76px', objectFit: 'cover' }} />
              : <div style={{ width: '100%', height: '76px', backgroundColor: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
            }
            <div style={{ padding: '7px 9px' }}>
              <p style={{
                margin: 0, fontSize: '12px', fontWeight: '600', color: colors.textPrimary,
                fontFamily: SERIF, lineHeight: '1.4',
                overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical'
              }}>{resource.title}</p>
            </div>
          </a>
        );
      })}
    </div>
  );
};

// ── Topic Box: pink left stripe + folder tabs, no outer card border ───────────
const TopicBoxCard = ({ topicBox, videosByTopic, handsOnResources, onDetails }) => {
  const [activeTab, setActiveTab] = useState('topic');

  const videos     = videosByTopic[topicBox.id] || [];
  const allRes     = handsOnResources[topicBox.id] || [];
  const worksheets = allRes.filter(r => r.type === 'worksheet');
  const activities = allRes.filter(r => r.type === 'activity');

  const tabs = [
    { id: 'topic',      label: 'Topic' },
    { id: 'videos',     label: videos.length     > 0 ? `Videos (${videos.length})`          : 'Videos'     },
    { id: 'activities', label: activities.length  > 0 ? `Activities (${activities.length})`  : 'Activities' },
    { id: 'worksheets', label: worksheets.length  > 0 ? `Worksheets (${worksheets.length})`  : 'Worksheets' },
  ];

  return (
    <div style={{ display: 'flex', marginBottom: '18px' }}>
      {/* Pink left stripe */}
      <div style={{ width: '3px', backgroundColor: colors.topicStripe, flexShrink: 0, borderRadius: '2px', marginRight: '14px' }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Tab bar */}
        <div style={{ display: 'flex', alignItems: 'center', borderBottom: `1px solid ${colors.border}`, paddingRight: '6px' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={e => { e.stopPropagation(); setActiveTab(tab.id); }}
              style={{
                padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer',
                fontSize: '13px', whiteSpace: 'nowrap', fontFamily: SERIF,
                fontWeight: activeTab === tab.id ? '600' : '400',
                color:  activeTab === tab.id ? colors.topicStripe : colors.textSecondary,
                borderBottom: activeTab === tab.id ? `2px solid ${colors.topicStripe}` : '2px solid transparent',
                transition: 'all 0.15s'
              }}
            >
              {tab.label}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <button
            onClick={e => { e.stopPropagation(); onDetails(topicBox); }}
            style={{
              padding: '5px 10px', backgroundColor: '#fff', color: colors.textSecondary,
              border: `1px solid ${colors.border}`, borderRadius: '5px',
              cursor: 'pointer', fontSize: '12px', fontWeight: '600', fontFamily: SERIF,
              display: 'flex', alignItems: 'center', gap: '4px'
            }}
            title="View topic details"
          >
            <Edit2 size={11} /> Details
          </button>
        </div>

        {/* Topic tab content */}
        {activeTab === 'topic' && (
          <div onClick={() => onDetails(topicBox)} style={{ padding: '13px 2px 14px', cursor: 'pointer' }}>
            <h4 style={{ margin: '0 0 8px', fontSize: '15.5px', fontWeight: '500', color: colors.textPrimary, fontFamily: SERIF }}>
              {topicBox.title}
            </h4>
            {(topicBox.learning_objectives || []).length > 0 && (
              <ul style={{ margin: '0 0 10px', paddingLeft: '20px', fontSize: '13.5px', color: colors.textSecondary, lineHeight: '1.65', fontFamily: SERIF }}>
                {topicBox.learning_objectives.slice(0, 3).map((obj, i) => (
                  <li key={i} style={{ marginBottom: '3px' }}>{obj}</li>
                ))}
                {topicBox.learning_objectives.length > 3 && (
                  <li style={{ color: '#9CA3AF', fontStyle: 'italic' }}>+{topicBox.learning_objectives.length - 3} more…</li>
                )}
              </ul>
            )}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', padding: '3px 9px', borderRadius: '4px', backgroundColor: colors.pillBg, color: colors.textSecondary, fontFamily: SERIF }}>
                🕐 {topicBox.duration_minutes || 0} min
              </span>
              {(topicBox.pla_pillars || []).map((pillar, idx) => (
                <span key={idx} style={{
                  fontSize: '12px', padding: '3px 9px', borderRadius: '4px', fontFamily: SERIF,
                  backgroundColor: colors.pla[pillar]  || colors.pillBg,
                  color:           colors.plaText[pillar] || colors.textSecondary
                }}>{pillar}</span>
              ))}
            </div>
          </div>
        )}
        {activeTab === 'videos'     && <ResourceCards resources={videos}     type="video"     />}
        {activeTab === 'activities' && <ResourceCards resources={activities} type="activity"  />}
        {activeTab === 'worksheets' && <ResourceCards resources={worksheets} type="worksheet" />}
      </div>
    </div>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────
const CourseViewPage = () => {
  const { currentUser } = useAuth();
  const navigate        = useNavigate();
  const location        = useLocation();

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
  const [selectedTopic,    setSelectedTopic]    = useState(null);
  const [collapsedSections,    setCollapsedSections]    = useState({});
  const [collapsedSubsections, setCollapsedSubsections] = useState({});
  const courseName = formData?.courseName || '';

  // Hydrate resource caches
  useEffect(() => {
    const vids = {};
    const ho   = {};
    sections.forEach(section => {
      (section.subsections || []).forEach(sub => {
        (sub.topicBoxes || []).forEach(topic => {
          if (topic.video_resources?.length)                           vids[topic.id] = topic.video_resources;
          const res = [...(topic.worksheets || []), ...(topic.activities || [])];
          if (res.length)                                              ho[topic.id]   = res;
        });
      });
    });
    setVideosByTopic(vids);
    setHandsOnResources(ho);
  }, []);

  const toggleSection    = id => setCollapsedSections(prev    => ({ ...prev, [id]: !prev[id] }));
  const toggleSubsection = id => setCollapsedSubsections(prev => ({ ...prev, [id]: !prev[id] }));

  const handleDownloadTxt = () => {
    const lines = [];
    lines.push(`COURSE: ${courseName}`);
    lines.push('Generated by EdCube');
    lines.push('');

    sections.forEach((section, sIdx) => {
      if (section.type === 'break') {
        lines.push(`--- BREAK: ${section.duration} ---`);
        lines.push('');
        return;
      }

      lines.push('='.repeat(60));
      lines.push(`SECTION ${sIdx + 1}: ${section.title}`);
      if (section.description) lines.push(section.description);
      lines.push('');

      (section.subsections || []).forEach((sub, subIdx) => {
        lines.push(`  ${sIdx + 1}.${subIdx + 1} ${sub.title}`);
        if (sub.description) lines.push(`  ${sub.description}`);
        lines.push('');

        (sub.topicBoxes || []).forEach(topic => {
          lines.push(`    TOPIC: ${topic.title}`);
          lines.push(`    Duration: ${topic.duration_minutes || 0} min`);
          if ((topic.pla_pillars || []).length > 0) {
            lines.push(`    PLA Pillars: ${topic.pla_pillars.join(', ')}`);
          }
          if ((topic.learning_objectives || []).length > 0) {
            lines.push('    Learning Objectives:');
            topic.learning_objectives.forEach(obj => lines.push(`      - ${obj}`));
          }

          const videos = videosByTopic[topic.id] || [];
          if (videos.length > 0) {
            lines.push('    Videos:');
            videos.forEach(v => lines.push(`      - ${v.title}: ${v.url}`));
          }

          const allRes = handsOnResources[topic.id] || [];
          const worksheets = allRes.filter(r => r.type === 'worksheet');
          const activities = allRes.filter(r => r.type === 'activity');
          if (worksheets.length > 0) {
            lines.push('    Worksheets:');
            worksheets.forEach(w => lines.push(`      - ${w.title}: ${w.url}`));
          }
          if (activities.length > 0) {
            lines.push('    Activities:');
            activities.forEach(a => lines.push(`      - ${a.title}: ${a.url}`));
          }

          lines.push('');
        });
      });
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${courseName.replace(/[^a-z0-9]/gi, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleEditInWorkspace = () => {
    navigate('/course-workspace', {
      state: { formData, sections, isEditing: true, curriculumId, isPublic, readOnly: false, isOwner: true }
    });
  };

  const handleEditAsCollaborator = () => {
    navigate('/course-workspace', {
      state: { formData, sections, isEditing: true, curriculumId, isPublic, readOnly: false, isOwner: false, isCollaborator: true }
    });
  };

  // Stats
  const sectionCount    = sections.filter(s => s.type !== 'break').length;
  const subsectionCount = sections.reduce((a, s) => a + (s.subsections?.length || 0), 0);
  const topicCount      = sections.reduce((a, s) =>
    a + (s.subsections?.reduce((t, sub) => t + (sub.topicBoxes?.length || 0), 0) || 0), 0);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.bg, display: 'flex', flexDirection: 'column', fontFamily: SERIF }}>

      {/* ── Top bar ── */}
      <div style={{
        padding: '13px 28px', borderBottom: `1px solid ${colors.border}`,
        backgroundColor: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '7px 14px', backgroundColor: '#F3F4F6', color: '#374151',
              border: `1px solid ${colors.border}`, borderRadius: '6px',
              cursor: 'pointer', fontSize: '13px', fontWeight: '500', fontFamily: SERIF
            }}
          >
            <ArrowLeft size={14} /> Back
          </button>

          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '500', color: colors.textPrimary, fontFamily: SERIF, letterSpacing: '-0.3px' }}>
              {courseName}
            </h2>
            {(formData?.subject || formData?.class || formData?.timeDuration) && (
              <p style={{ margin: '2px 0 0', fontSize: '13px', color: colors.textSecondary, fontFamily: SERIF }}>
                {[formData?.subject, formData?.class, formData?.timeDuration].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>

          {!isOwner && (
            <span style={{
              fontSize: '11px',
              color: isCollaborator ? '#059669' : '#6b7280',
              backgroundColor: isCollaborator ? '#ECFDF5' : '#f3f4f6',
              padding: '3px 10px', borderRadius: '12px', fontWeight: '600', fontFamily: SERIF
            }}>
              {isCollaborator ? 'Collaborator' : 'View Only'}
            </span>
          )}
          {!isOwner && ownerName && (
            <span style={{
              fontSize: '13px', color: '#6b7280', backgroundColor: '#f3f4f6',
              padding: '3px 10px', borderRadius: '12px', fontWeight: '500', fontFamily: SERIF
            }}>
              By {ownerName}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {isOwner && (
            <button
              onClick={handleDownloadTxt}
              style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                padding: '8px 16px', backgroundColor: '#fff', color: '#374151',
                border: `1px solid ${colors.border}`, borderRadius: '6px',
                cursor: 'pointer', fontSize: '14px', fontWeight: '500',
                fontFamily: SERIF, transition: 'background-color 0.15s'
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f9fafb'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#fff'; }}
              title="Download course as TXT"
            >
              <Download size={14} /> Download
            </button>
          )}
          {isOwner && (
            <button
              onClick={handleEditInWorkspace}
              style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                padding: '8px 18px', backgroundColor: '#1d4ed8', color: 'white',
                border: 'none', borderRadius: '6px', cursor: 'pointer',
                fontSize: '14px', fontWeight: '500', fontFamily: SERIF, transition: 'background-color 0.15s'
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#1e40af'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#1d4ed8'; }}
            >
              <PencilLine size={14} /> Edit in Course Workspace
            </button>
          )}
          {isCollaborator && (
            <button
              onClick={handleEditAsCollaborator}
              style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                padding: '8px 18px', backgroundColor: '#059669', color: 'white',
                border: 'none', borderRadius: '6px', cursor: 'pointer',
                fontSize: '14px', fontWeight: '500', fontFamily: SERIF, transition: 'background-color 0.15s'
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#047857'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#059669'; }}
            >
              <PencilLine size={14} /> Edit as Collaborator
            </button>
          )}
        </div>
      </div>

      {/* ── Stats bar ── */}
      <div style={{ padding: '8px 48px', backgroundColor: '#fff', borderBottom: `1px solid #f3f4f6` }}>
        <span style={{ fontSize: '13px', color: '#9ca3af', fontFamily: SERIF }}>
          {sectionCount} section{sectionCount !== 1 ? 's' : ''} · {subsectionCount} subsection{subsectionCount !== 1 ? 's' : ''} · {topicCount} topic box{topicCount !== 1 ? 'es' : ''}
        </span>
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, padding: '48px 52px 48px 48px', boxSizing: 'border-box' }}>
        {sections.length === 0 ? (
          <p style={{ textAlign: 'center', color: colors.textSecondary, fontSize: '16px', fontFamily: SERIF }}>
            This course has no sections yet.
          </p>
        ) : sections.map((section, idx) => {

          // ── Break ──
          if (section.type === 'break') {
            return (
              <div key={section.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '32px' }}>
                <div style={{ flex: 1, height: '1px', backgroundColor: colors.border }} />
                <span style={{ fontSize: '14px', color: colors.textSecondary, fontWeight: '500', whiteSpace: 'nowrap', fontFamily: SERIF }}>
                  ⏸️ Break — {section.duration}
                </span>
                <div style={{ flex: 1, height: '1px', backgroundColor: colors.border }} />
              </div>
            );
          }

          const isCollapsed = collapsedSections[section.id];

          return (
            <div key={section.id} style={{ marginBottom: '52px' }}>

              {/* ── Section header — green left stripe, no box ── */}
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  cursor: 'pointer', marginBottom: '12px',
                  borderLeft: `5px solid ${colors.sectionStripe}`, paddingLeft: '16px'
                }}
                onClick={() => toggleSection(section.id)}
              >
                <span style={{
                  fontSize: '11px', color: colors.sectionStripe,
                  display: 'inline-block', transition: 'transform 0.2s',
                  transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)'
                }}>▶</span>
                <span style={{
                  fontSize: '10px', fontWeight: '700', textTransform: 'uppercase',
                  letterSpacing: '0.7px', color: colors.sectionStripe,
                  backgroundColor: '#DCFCE7', padding: '2px 8px', borderRadius: '4px'
                }}>
                  Section {idx + 1}
                </span>
                <span style={{ fontSize: '19px', fontWeight: '500', color: colors.textPrimary, fontFamily: SERIF, letterSpacing: '-0.3px' }}>
                  {section.title}
                </span>
              </div>

              {!isCollapsed && section.description && (
                <p style={{ margin: '0 0 18px', paddingLeft: '37px', fontSize: '14px', color: colors.textSecondary, lineHeight: '1.65', fontFamily: SERIF }}>
                  {section.description}
                </p>
              )}

              {/* ── Subsections ── */}
              {!isCollapsed && (
                <div style={{ paddingLeft: '40px' }}>
                  {(section.subsections || []).length === 0 ? (
                    <p style={{ fontSize: '14px', color: colors.textSecondary, fontStyle: 'italic', paddingLeft: '14px', fontFamily: SERIF }}>
                      No subsections
                    </p>
                  ) : (section.subsections || []).map((sub, subIdx) => {

                    const isSubCollapsed = collapsedSubsections[sub.id];
                    const pillarSet = new Set();
                    (sub.topicBoxes || []).forEach(t => (t.pla_pillars || []).forEach(p => pillarSet.add(p)));
                    const subPillars = [...pillarSet].slice(0, 2);

                    return (
                      <div key={sub.id} style={{ marginBottom: '36px' }}>

                        {/* ── Subsection header — blue left stripe, no box ── */}
                        <div
                          style={{
                            display: 'flex', alignItems: 'center', gap: '9px',
                            cursor: 'pointer', marginBottom: '10px',
                            borderLeft: `4px solid ${colors.subsectionStripe}`, paddingLeft: '14px'
                          }}
                          onClick={() => toggleSubsection(sub.id)}
                        >
                          <span style={{
                            fontSize: '10px', color: colors.subsectionStripe,
                            display: 'inline-block', transition: 'transform 0.2s',
                            transform: isSubCollapsed ? 'rotate(0deg)' : 'rotate(90deg)'
                          }}>▶</span>
                          <span style={{
                            fontSize: '10px', fontWeight: '700', textTransform: 'uppercase',
                            letterSpacing: '0.6px', color: colors.subsectionStripe
                          }}>
                            {idx + 1}.{subIdx + 1}
                          </span>
                          <span style={{ fontSize: '16px', fontWeight: '500', color: colors.textPrimary, fontFamily: SERIF, flex: 1 }}>
                            {sub.title}
                          </span>
                          {subPillars.map(pillar => (
                            <span key={pillar} style={{
                              fontSize: '11px', fontWeight: '500', fontFamily: SERIF,
                              padding: '2px 8px', borderRadius: '4px',
                              backgroundColor: colors.pla[pillar]     || colors.pillBg,
                              color:           colors.plaText[pillar] || colors.textSecondary
                            }}>{pillar}</span>
                          ))}
                        </div>

                        {!isSubCollapsed && sub.description && (
                          <p style={{ margin: '0 0 14px', paddingLeft: '31px', fontSize: '13.5px', color: colors.textSecondary, lineHeight: '1.65', fontFamily: SERIF }}>
                            {sub.description}
                          </p>
                        )}

                        {/* ── Topic boxes ── */}
                        {!isSubCollapsed && (
                          <div style={{ paddingLeft: '36px' }}>
                            {(sub.topicBoxes || []).length === 0 ? (
                              <p style={{ fontSize: '14px', color: colors.textSecondary, fontStyle: 'italic', paddingLeft: '14px', fontFamily: SERIF }}>
                                No topic boxes
                              </p>
                            ) : (sub.topicBoxes || []).map(topic => (
                              <TopicBoxCard
                                key={topic.id}
                                topicBox={topic}
                                videosByTopic={videosByTopic}
                                handsOnResources={handsOnResources}
                                onDetails={setSelectedTopic}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selectedTopic && (
        <TopicDetailsModal topic={selectedTopic} onClose={() => setSelectedTopic(null)} readOnly />
      )}
    </div>
  );
};

export default CourseViewPage;
