// src/components/courses/CourseViewer.jsx
// Read-only viewer for public courses — no editing, no drag-and-drop
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import TopicDetailsModal from '../modals/TopicDetailsModal';

const CourseViewer = ({
  courseName,
  sections,
  videosByTopic,
  handsOnResources,
  ownerName,
  navigate
}) => {
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [collapsedSections, setCollapsedSections] = useState({});
  const [collapsedSubsections, setCollapsedSubsections] = useState({});

  const toggleSection = (id) => setCollapsedSections(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleSubsection = (id) => setCollapsedSubsections(prev => ({ ...prev, [id]: !prev[id] }));

  // ── Colors (matches CourseEditor theme) ──────────────────────────────
  const colors = {
    bg: '#FAF9F6',
    card: '#FFFFFF',
    sectionBorder: '#E8E6E1',
    sectionBg: '#E8E0D5',
    subsectionBg: '#F0EBE3',
    topicBg: '#F7F9FC',
    accent: '#D4C4A8',
    textPrimary: '#2C2A26',
    textSecondary: '#6B6760',
    pillBg: '#F5F3EE',
    pillText: '#6B6760',
    pla: {
      'Personal Growth': '#E8A5A5',
      'Core Learning': '#A5C9E8',
      'Critical Thinking': '#B8E8A5',
      'Application & Impact': '#E8D5A5'
    }
  };

  const Pill = ({ label, color }) => (
    <span style={{
      display: 'inline-block',
      padding: '4px 10px',
      borderRadius: '12px',
      fontSize: '11px',
      fontWeight: '500',
      backgroundColor: color?.bg || colors.pillBg,
      color: color?.text || colors.pillText
    }}>
      {label}
    </span>
  );

  // ── Topic Box (read-only) ────────────────────────────────────────────
  const TopicBoxCard = ({ topicBox }) => {
    const videos = videosByTopic[topicBox.id] || [];
    const allResources = handsOnResources[topicBox.id] || [];
    const worksheets = allResources.filter(r => r.type === 'worksheet');
    const activities = allResources.filter(r => r.type === 'activity');
    const totalResources = videos.length + worksheets.length + activities.length;

    const resourceSummary = [
      videos.length > 0 && `${videos.length} video${videos.length > 1 ? 's' : ''}`,
      worksheets.length > 0 && `${worksheets.length} worksheet${worksheets.length > 1 ? 's' : ''}`,
      activities.length > 0 && `${activities.length} activit${activities.length > 1 ? 'ies' : 'y'}`
    ].filter(Boolean).join(' \u2022 ');

    return (
      <div
        onClick={() => setSelectedTopic(topicBox)}
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: '10px',
          backgroundColor: colors.topicBg,
          padding: '16px',
          marginBottom: '12px',
          cursor: 'pointer',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          transition: 'box-shadow 0.2s'
        }}
        onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)'}
        onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'}
      >
        <h4 style={{ margin: '0 0 10px', fontSize: '15px', fontWeight: '600', color: colors.textPrimary }}>
          {topicBox.title}
        </h4>

        {(topicBox.learning_objectives || []).length > 0 && (
          <ul style={{
            margin: '0 0 12px', paddingLeft: '20px',
            fontSize: '13px', color: colors.textSecondary, lineHeight: '1.6'
          }}>
            {topicBox.learning_objectives.slice(0, 3).map((obj, i) => (
              <li key={i} style={{ marginBottom: '4px' }}>{obj}</li>
            ))}
            {topicBox.learning_objectives.length > 3 && (
              <li style={{ color: '#9ca3af', fontStyle: 'italic' }}>
                +{topicBox.learning_objectives.length - 3} more...
              </li>
            )}
          </ul>
        )}

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: totalResources > 0 ? '12px' : '0' }}>
          <Pill label={`${topicBox.duration_minutes || 0} min`} color={{ bg: '#F5F3EE', text: colors.textSecondary }} />
          {(topicBox.pla_pillars || []).map((pillar, idx) => (
            <Pill key={idx} label={pillar} color={{ bg: colors.pla[pillar] || colors.pillBg, text: colors.textPrimary }} />
          ))}
        </div>

        {totalResources > 0 && (
          <div style={{
            padding: '10px 14px', backgroundColor: '#F9FAFB',
            borderRadius: '6px', border: '1px solid #E5E7EB',
            fontSize: '12px', color: colors.textSecondary
          }}>
            <span style={{ fontWeight: '600', color: colors.textPrimary }}>Resources:</span>{' '}
            {resourceSummary}
            <span style={{ marginLeft: '8px', fontStyle: 'italic', color: '#9ca3af', fontSize: '11px' }}>
              (click to view details)
            </span>
          </div>
        )}
      </div>
    );
  };

  // ── Section (read-only) ──────────────────────────────────────────────
  const SectionView = ({ section, index }) => {
    if (section.type === 'break') {
      return (
        <div style={{
          padding: '12px 16px', marginBottom: '16px',
          backgroundColor: '#FFF9E6', border: '1px solid #E8E6E1',
          borderRadius: '8px'
        }}>
          <span style={{ fontWeight: '500', fontSize: '14px' }}>Break — {section.duration}</span>
        </div>
      );
    }

    const isCollapsed = collapsedSections[section.id];

    return (
      <div style={{
        border: `1px solid ${colors.sectionBorder}`,
        borderRadius: '12px',
        marginBottom: '20px',
        backgroundColor: colors.card,
        overflow: 'hidden'
      }}>
        {/* Section header */}
        <div style={{
          backgroundColor: colors.sectionBg,
          padding: '10px 16px',
          display: 'flex', alignItems: 'center', gap: '10px',
          cursor: 'pointer'
        }} onClick={() => toggleSection(section.id)}>
          <span style={{ fontSize: '14px', color: colors.accent }}>
            {isCollapsed ? '\u25B6' : '\u25BC'}
          </span>
          <span style={{ fontSize: '12px', fontWeight: '700', color: colors.accent }}>
            Section {index + 1}
          </span>
          <span style={{ fontSize: '15px', fontWeight: '600', color: colors.textPrimary, flex: 1 }}>
            {section.title}
          </span>
        </div>

        {/* Section description */}
        {!isCollapsed && section.description && (
          <div style={{
            backgroundColor: '#FAFAFA',
            padding: '10px 16px',
            borderBottom: '1px solid #E8E6E1'
          }}>
            <span style={{ fontSize: '12px', color: colors.textSecondary }}>
              {section.description}
            </span>
          </div>
        )}

        {/* Subsections */}
        {!isCollapsed && (
          <div style={{ padding: '14px 16px' }}>
            {(section.subsections || []).map((sub, subIdx) => {
              const isSubCollapsed = collapsedSubsections[sub.id];

              return (
                <div key={sub.id} style={{
                  marginBottom: '16px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  backgroundColor: '#fafafa',
                  overflow: 'hidden'
                }}>
                  {/* Subsection header */}
                  <div
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '8px 12px', backgroundColor: colors.subsectionBg,
                      cursor: 'pointer'
                    }}
                    onClick={() => toggleSubsection(sub.id)}
                  >
                    <span style={{ fontSize: '12px', color: colors.accent }}>
                      {isSubCollapsed ? '\u25B6' : '\u25BC'}
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: colors.accent }}>
                      Subsection {index + 1}.{subIdx + 1}
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: colors.textPrimary, flex: 1 }}>
                      {sub.title}
                    </span>
                  </div>

                  {/* Subsection description */}
                  {!isSubCollapsed && sub.description && (
                    <div style={{
                      backgroundColor: '#FAFAFA',
                      padding: '8px 12px',
                      borderBottom: '1px solid #e5e7eb'
                    }}>
                      <span style={{ fontSize: '12px', color: colors.textSecondary }}>
                        {sub.description}
                      </span>
                    </div>
                  )}

                  {/* Topic boxes */}
                  {!isSubCollapsed && (
                    <div style={{ padding: '12px' }}>
                      {(sub.topicBoxes || []).length === 0 ? (
                        <div style={{
                          textAlign: 'center', padding: '20px',
                          color: colors.textSecondary, fontSize: '13px',
                          fontStyle: 'italic'
                        }}>
                          No topic boxes in this subsection
                        </div>
                      ) : (
                        (sub.topicBoxes || []).map(topic => (
                          <TopicBoxCard key={topic.id} topicBox={topic} />
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {(section.subsections || []).length === 0 && (
              <div style={{
                textAlign: 'center', padding: '20px',
                color: colors.textSecondary, fontSize: '13px',
                fontStyle: 'italic'
              }}>
                No subsections in this section
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // ── Stats ────────────────────────────────────────────────────────────
  const sectionCount = sections.filter(s => s.type !== 'break').length;
  const subsectionCount = sections.reduce((acc, s) => acc + (s.subsections?.length || 0), 0);
  const topicCount = sections.reduce((acc, s) =>
    acc + (s.subsections?.reduce((t, sub) => t + (sub.topicBoxes?.length || 0), 0) || 0), 0
  );

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <>
      {/* Top Bar */}
      <div style={{
        padding: '12px 28px', borderBottom: '1px solid #e5e7eb',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        backgroundColor: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', color: colors.textPrimary }}>EdCube</h2>
          <span style={{ fontSize: '17px', fontWeight: '600', color: colors.textPrimary }}>
            {courseName}
          </span>
          {ownerName && (
            <span style={{
              fontSize: '12px', color: '#6b7280', backgroundColor: '#f3f4f6',
              padding: '4px 10px', borderRadius: '12px', fontWeight: '500'
            }}>
              By {ownerName}
            </span>
          )}
          <span style={{
            fontSize: '11px', color: '#059669', backgroundColor: '#ECFDF5',
            padding: '3px 8px', borderRadius: '10px', fontWeight: '600'
          }}>
            View Only
          </span>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '7px 14px', backgroundColor: '#6b7280', color: 'white',
              border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px'
            }}
          >
            <ArrowLeft size={14} /> Back
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{
        padding: '10px 28px', backgroundColor: 'white',
        borderBottom: '1px solid #f3f4f6',
        display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'center'
      }}>
        <span style={{ fontSize: '12px', color: '#9ca3af' }}>
          {sectionCount} section{sectionCount !== 1 ? 's' : ''} {'\u2022'}{' '}
          {subsectionCount} subsection{subsectionCount !== 1 ? 's' : ''} {'\u2022'}{' '}
          {topicCount} topic box{topicCount !== 1 ? 'es' : ''}
        </span>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
        {sections.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '80px 20px',
            border: `1px solid ${colors.sectionBorder}`, borderRadius: '16px',
            backgroundColor: 'white'
          }}>
            <p style={{ fontSize: '16px', color: colors.textPrimary, fontWeight: '600', margin: '0 0 4px' }}>
              This course has no sections yet
            </p>
          </div>
        ) : (
          sections.map((section, idx) => (
            <SectionView key={section.id} section={section} index={idx} />
          ))
        )}
      </div>

      {/* Topic detail modal (view-only) */}
      {selectedTopic && (
        <TopicDetailsModal
          topic={selectedTopic}
          onClose={() => setSelectedTopic(null)}
          readOnly
        />
      )}
    </>
  );
};

export default CourseViewer;
