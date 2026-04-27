// src/components/courses/CourseWorkspace.jsx
import { useState, useEffect, useRef, useMemo } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import CourseEditor, { EditableField } from './CourseEditor';
import CourseViewer from './CourseViewer';
import SubsectionView from './SubsectionView';
import TopicDetailsModal from '../modals/TopicDetailsModal';
import BlockView from './BlockView';
import EdoChatbot from './EdoChatbot';
import useCourseActions from './useCourseActions';
import useAutosave from './useAutosave';
import BreakModal from '../modals/BreakModal';
import ShareCourseModal from '../modals/ShareCourseModal';
import { getOwnProfile } from '../../services/teacherService';
import { generateBlockLinks } from '../../utils/curriculumApi';

const CourseWorkspace = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const {
    formData,
    sections: incomingSections,
    isEditing,
    curriculumId: initialCurriculumId,
    isPublic: incomingIsPublic,
    readOnly: incomingReadOnly,
    ownerName: incomingOwnerName,
    isOwner: incomingIsOwner,
    isCollaborator: incomingIsCollaborator,
  } = location.state || {};

  const [curriculumId, setCurriculumId] = useState(initialCurriculumId);

  // ── Core State ────────────────────────────────────────────────────────
  const [courseName, setCourseName] = useState(formData?.courseName || '');
  const [courseClass, setCourseClass] = useState(formData?.class || '');
  const [sections, setSections] = useState(incomingSections || []);
  const [showBreakModal, setShowBreakModal] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [videosByTopic, setVideosByTopic] = useState({});
  const [handsOnResources, setHandsOnResources] = useState({});
  const [organizationId, setOrganizationId] = useState(null);
  const [isPublic, setIsPublic] = useState(incomingIsPublic || false);
  const [readOnly] = useState(incomingReadOnly || false);
  const [isOwner] = useState(incomingIsOwner || false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [isEdoOpen, setIsEdoOpen] = useState(false);
  const [trayItems, setTrayItems] = useState([]);
  const [linkGenJobs, setLinkGenJobs] = useState({}); // { [blockId]: 'generating'|'done'|'error' }

  // ── Page Navigation ───────────────────────────────────────────────────
  const [navPage, setNavPage] = useState('outline'); // 'outline'|'subsection'|'topic'|'block'
  const [navPath, setNavPath] = useState({ sectionId: null, subsectionId: null, topicId: null, blockId: null });

  const navigateToSubsection = (sectionId, subsectionId) => {
    setNavPage('subsection');
    setNavPath({ sectionId, subsectionId, topicId: null, blockId: null });
    setTrayItems([]);
  };
  const navigateToTopic = (sectionId, subsectionId, topicId) => {
    setNavPage('topic');
    setNavPath({ sectionId, subsectionId, topicId, blockId: null });
    setTrayItems([]);
  };
  const navigateToBlock = (sectionId, subsectionId, topicId, blockId) => {
    setNavPage('block');
    setNavPath({ sectionId, subsectionId, topicId, blockId });
    setTrayItems([]);
  };
  const navigateBack = () => {
    if (navPage === 'block') { setNavPage('topic'); setNavPath(p => ({ ...p, blockId: null })); }
    else if (navPage === 'topic') { setNavPage('subsection'); setNavPath(p => ({ ...p, topicId: null })); }
    else if (navPage === 'subsection') { setNavPage('outline'); setNavPath({ sectionId: null, subsectionId: null, topicId: null, blockId: null }); }
    setTrayItems([]);
  };

  const generateLinksForBlock = async (blockId, topicId, blockData) => {
    console.log('[generateLinksForBlock] called', { blockId, topicId, blockType: blockData?.type });
    setLinkGenJobs(prev => ({ ...prev, [blockId]: 'generating' }));
    try {
      const { links: generated } = await generateBlockLinks({
        blockType: blockData.type || 'content',
        blockTitle: blockData.title || '',
        blockContent: blockData.content || '',
        topicTitle: activeTopic?.title || '',
        topicDescription: activeTopic?.description || '',
        gradeLevel: formData?.class || '',
        subject: formData?.subject || '',
        teacherUid: currentUser?.uid || null,
      });
      if (generated?.length > 0) {
        const existing = (handsOnResources[topicId] || [])
          .find(b => b.id === blockId)?.links || [];
        const merged = [
          ...existing,
          ...generated.map(l => ({ id: `link-${Date.now()}-${Math.random().toString(36).slice(2)}`, ...l })),
        ];
        actions.updateBlock(topicId, blockId, { links: merged });
      }
      setLinkGenJobs(prev => ({ ...prev, [blockId]: 'done' }));
    } catch (err) {
      console.error('Link generation failed:', err);
      setLinkGenJobs(prev => ({ ...prev, [blockId]: 'error' }));
    }
  };

  // Derived active objects from navigation path
  const activeSection = sections.find(s => s.id === navPath.sectionId) || null;
  const activeSubsection = activeSection?.subsections?.find(ss => ss.id === navPath.subsectionId) || null;
  const sectionIndex = activeSection ? sections.indexOf(activeSection) : -1;
  const subsectionIndex = activeSubsection ? (activeSection?.subsections?.indexOf(activeSubsection) ?? -1) : -1;
  const activeTopic = activeSubsection?.topicBoxes?.find(t => t.id === navPath.topicId) || null;
  const topicIndex = activeTopic ? (activeSubsection?.topicBoxes?.indexOf(activeTopic) ?? -1) : -1;
  const activeBlock = (handsOnResources[navPath.topicId] || []).find(b => b.id === navPath.blockId) || null;

  // Derived Edo context from navigation state (replaces activeTopicContext)
  const currentPageContext = useMemo(() => {
    const sec = sections.find(s => s.id === navPath.sectionId);
    const sub = sec?.subsections?.find(ss => ss.id === navPath.subsectionId);
    const topic = sub?.topicBoxes?.find(t => t.id === navPath.topicId);
    const block = (handsOnResources[navPath.topicId] || []).find(b => b.id === navPath.blockId);
    return {
      page: navPage,
      sectionId: navPath.sectionId, sectionTitle: sec?.title,
      subsectionId: navPath.subsectionId, subsectionTitle: sub?.title,
      topicId: navPath.topicId, topicTitle: topic?.title,
      blockId: navPath.blockId, blockTitle: block?.title,
    };
  }, [navPage, navPath, sections, handsOnResources]);

  // ── Initialize Actions Hook ───────────────────────────────────────────
  const actions = useCourseActions({
    sections,
    setSections,
    videosByTopic,
    setVideosByTopic,
    handsOnResources,
    setHandsOnResources,
    formData,
    currentUser,
    curriculumId
  });

  // ── Fetch teacher profile to get organizationId ──────────────────────
  useEffect(() => {
    const fetchProfile = async () => {
      if (currentUser) {
        try {
          const profile = await getOwnProfile(currentUser);
          setOrganizationId(profile.org_id);
        } catch (error) {
          console.error('Error fetching teacher profile:', error);
        }
      }
    };
    fetchProfile();
  }, [currentUser]);

  // ── Mount: Transform data + hydrate caches ────────────────────────────
  useEffect(() => {
    console.log('📦 CourseWorkspace loaded');

    // Transform old structure to new
    const transformedSections = sections.map(section => {
      if (section.type === 'break') return section;

      return {
        ...section,
        subsections: (section.subsections || []).map(sub => {
          // Only preserve topicBoxes if they are actually populated.
          // An empty array [] is truthy but means no boxes — fall through to rebuild.
          if (sub.topicBoxes && Array.isArray(sub.topicBoxes) && sub.topicBoxes.length > 0) {
            return sub;
          }

          const hasResources =
            (sub.video_resources && sub.video_resources.length > 0) ||
            (sub.worksheets && sub.worksheets.length > 0) ||
            (sub.activities && sub.activities.length > 0) ||
            (sub.learning_objectives && sub.learning_objectives.length > 0);

          if (hasResources) {
            return {
              id: sub.id,
              title: sub.title,
              description: sub.description,
              topicBoxes: [{
                id: `topic-${sub.id}-migrated`,
                title: sub.title,
                description: sub.description || '',
                duration_minutes: sub.duration_minutes || 20,
                pla_pillars: sub.pla_pillars || [],
                learning_objectives: sub.learning_objectives || [],
                content_keywords: sub.content_keywords || [],
                video_resources: sub.video_resources || [],
                worksheets: sub.worksheets || [],
                activities: sub.activities || []
              }]
            };
          } else {
            return {
              id: sub.id,
              title: sub.title,
              description: sub.description,
              topicBoxes: []
            };
          }
        })
      };
    });

    setSections(transformedSections);

    // Hydrate video + hands-on caches
    const loadedVideos = {};
    const loadedHandsOn = {};

    transformedSections.forEach(section => {
      (section.subsections || []).forEach(sub => {
        (sub.topicBoxes || []).forEach(topic => {
          if (topic.video_resources && topic.video_resources.length > 0) {
            loadedVideos[topic.id] = topic.video_resources;
          }
          const resources = [
            ...(topic.worksheets || []),
            ...(topic.activities || [])
          ];
          if (resources.length > 0) {
            loadedHandsOn[topic.id] = resources;
          }
        });
      });
    });

    if (Object.keys(loadedVideos).length > 0) {
      console.log('🎥 Loaded videos:', loadedVideos);
      setVideosByTopic(loadedVideos);
    }
    if (Object.keys(loadedHandsOn).length > 0) {
      console.log('📝 Loaded hands-on:', loadedHandsOn);
      setHandsOnResources(loadedHandsOn);
    }
  }, []);

  // ── History ───────────────────────────────────────────────────────────
  const isUndoingRef = useRef(false);
  const historyMountedRef = useRef(false);

  // Skip mount hydration, then start tracking history
  useEffect(() => {
    const id = setTimeout(() => { historyMountedRef.current = true; }, 1200);
    return () => clearTimeout(id);
  }, []);

  // Auto-snapshot on every state change (skips undo-triggered and mount changes)
  useEffect(() => {
    if (!historyMountedRef.current) return;
    if (isUndoingRef.current) {
      isUndoingRef.current = false;
      return;
    }

    setHistory(prev => {
      const trimmed = prev.slice(0, historyIndex + 1);
      return [...trimmed, { sections, handsOnResources, videosByTopic }];
    });
    setHistoryIndex(prev => prev + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections, handsOnResources, videosByTopic]);

  const undo = () => {
    if (historyIndex > 0) {
      isUndoingRef.current = true;
      const prev = history[historyIndex - 1];
      setSections(prev.sections);
      setHandsOnResources(prev.handsOnResources);
      setVideosByTopic(prev.videosByTopic);
      setHistoryIndex(historyIndex - 1);
    }
  };

  // ── Break Modal ───────────────────────────────────────────────────────
  const handleBreakCreate = (duration, unit) => {
    setSections([...sections, {
      id: `break-${Date.now()}`,
      type: 'break',
      duration: `${duration} ${unit}`
    }]);
    setShowBreakModal(false);
  };

  // ── Toggle Visibility ──────────────────────────────────────────────────
  const handleToggleVisibility = async () => {
    if (!curriculumId || curriculumId === 'new-course') {
      alert('Please save the course first before changing visibility.');
      return;
    }

    try {
      const newIsPublic = !isPublic;
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/curricula/${curriculumId}/visibility?teacherUid=${currentUser.uid}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isPublic: newIsPublic })
        }
      );
      const result = await response.json();
      if (result.success) {
        setIsPublic(newIsPublic);
      } else {
        alert('Failed to update visibility');
      }
    } catch (error) {
      console.error('Error toggling visibility:', error);
      alert('Failed to update visibility');
    }
  };

  // ── Save Course ───────────────────────────────────────────────────────
  const saveCourse = async () => {
    const idToken = await currentUser.getIdToken();

    const sectionsForSave = sections.map(section => ({
      ...section,
      subsections: (section.subsections || []).map(sub => ({
        ...sub,
        topicBoxes: (sub.topicBoxes || []).map(topic => ({
          ...topic,
          video_resources: videosByTopic[topic.id] || topic.video_resources || [],
          worksheets: handsOnResources[topic.id]?.filter(r => r.type === 'worksheet') || topic.worksheets || [],
          activities: handsOnResources[topic.id]?.filter(r => r.type === 'activity') || topic.activities || []
        }))
      }))
    }));

    const courseData = {
      courseName,
      class: courseClass,
      subject: formData?.subject || '',
      topic: formData?.topic || '',
      timeDuration: formData?.timeDuration || '',
      objectives: formData?.objectives || '',
      sections: sectionsForSave,
      outline: { sections: sectionsForSave }
    };

    const hasExistingId = curriculumId && curriculumId !== 'new-course';
    if (hasExistingId) courseData.courseId = curriculumId;

    const endpoint = hasExistingId
      ? `${import.meta.env.VITE_API_BASE_URL}/api/update-course?teacherUid=${currentUser.uid}`
      : `${import.meta.env.VITE_API_BASE_URL}/api/save-course?teacherUid=${currentUser.uid}&organizationId=${organizationId}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify(courseData)
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Unknown error');
    }

    // Capture the new courseId for subsequent saves
    if (!hasExistingId && result.courseId) {
      setCurriculumId(result.courseId);
    }
  };

  // ── Back to Course View ───────────────────────────────────────────────
  const handleBack = () => {
    navigate('/course-view', {
      state: {
        formData,
        sections,
        curriculumId,
        isPublic,
        isOwner,
        ownerName: incomingOwnerName,
        isCollaborator: incomingIsCollaborator || false,
      }
    });
  };

  // ── Edit in Workspace (from view mode) ───────────────────────────────
  const handleEditInWorkspace = () => {
    navigate('/course-workspace', {
      state: {
        formData,
        sections,
        isEditing: true,
        curriculumId,
        isPublic,
        readOnly: false,
        isOwner: false
      }
    });
  };

  // ── Edit as Collaborator (from view mode) ────────────────────────────
  const handleEditAsCollaborator = () => {
    navigate('/course-workspace', {
      state: {
        formData,
        sections,
        isEditing: true,
        curriculumId,
        isPublic,
        readOnly: false,
        isOwner: false,
        isCollaborator: true,
      }
    });
  };

  // ── Autosave ─────────────────────────────────────────────────────────
  const saveStatus = useAutosave({
    performSave: saveCourse,
    deps: [sections, courseName, videosByTopic, handsOnResources],
    delay: 2000,
    enabled: !!organizationId && !!currentUser && !readOnly
  });

  // ── Drag and Drop ─────────────────────────────────────────────────────
  const handleDragEnd = (result) => {
    const { source, destination, draggableId, type } = result;

    if (!destination) return;
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) return;

    // Tray → Course drop
    if (source.droppableId.startsWith('edo-tray-')) {
      const trayItem = trayItems.find(i => i.id === draggableId);
      if (!trayItem) return;

      if (type === 'SECTION' && destination.droppableId === 'all-sections') {
        actions.insertSectionAt(trayItem.data, destination.index);
        setTrayItems(prev => prev.filter(i => i.id !== draggableId));
        return;
      }
      if (type === 'SUBSECTION' && destination.droppableId.startsWith('subsections-')) {
        const sectionId = destination.droppableId.replace('subsections-', '');
        actions.insertSubsectionAt(sectionId, trayItem.data, destination.index);
        setTrayItems(prev => prev.filter(i => i.id !== draggableId));
        return;
      }
      if (type === 'TOPICBOX' && destination.droppableId.startsWith('topicboxes-')) {
        const subsectionId = destination.droppableId.replace('topicboxes-', '');
        let parentSectionId = null;
        for (const s of sections) {
          if ((s.subsections || []).some(ss => ss.id === subsectionId)) {
            parentSectionId = s.id;
            break;
          }
        }
        if (!parentSectionId) return;
        actions.insertTopicBoxAt(parentSectionId, subsectionId, trayItem.data, destination.index);
        setTrayItems(prev => prev.filter(i => i.id !== draggableId));
        return;
      }
      return;
    }

    // Within-course reorder
    if (type === 'SECTION') {
      const reorderedSections = Array.from(sections);
      const [movedSection] = reorderedSections.splice(source.index, 1);
      reorderedSections.splice(destination.index, 0, movedSection);
      setSections(reorderedSections);
      return;
    }

    if (type === 'SUBSECTION') {
      const sectionId = source.droppableId.replace('subsections-', '');
      const section = sections.find(s => s.id === sectionId);
      if (section && section.subsections) {
        const reorderedSubsections = Array.from(section.subsections);
        const [movedSubsection] = reorderedSubsections.splice(source.index, 1);
        reorderedSubsections.splice(destination.index, 0, movedSubsection);
        setSections(sections.map(s =>
          s.id === sectionId ? { ...s, subsections: reorderedSubsections } : s
        ));
      }
      return;
    }

    if (type === 'TOPICBOX') {
      const sourceSubId = source.droppableId.replace('topicboxes-', '');
      const destSubId = destination.droppableId.replace('topicboxes-', '');

      let sourceSection = null, sourceSub = null, sourceTopicBox = null;
      for (const section of sections) {
        const sub = (section.subsections || []).find(s => s.id === sourceSubId);
        if (sub) { sourceSection = section; sourceSub = sub; sourceTopicBox = sub.topicBoxes[source.index]; break; }
      }
      let destSection = null, destSub = null;
      for (const section of sections) {
        const sub = (section.subsections || []).find(s => s.id === destSubId);
        if (sub) { destSection = section; destSub = sub; break; }
      }
      if (!sourceSection || !sourceSub || !sourceTopicBox || !destSection || !destSub) return;

      if (sourceSubId === destSubId) {
        setSections(sections.map(section => {
          if (section.id !== sourceSection.id) return section;
          return {
            ...section,
            subsections: section.subsections.map(sub => {
              if (sub.id !== sourceSubId) return sub;
              const reorderedTopicBoxes = Array.from(sub.topicBoxes);
              const [moved] = reorderedTopicBoxes.splice(source.index, 1);
              reorderedTopicBoxes.splice(destination.index, 0, moved);
              return { ...sub, topicBoxes: reorderedTopicBoxes };
            })
          };
        }));
      } else if (sourceSection.id === destSection.id) {
        setSections(sections.map(section => {
          if (section.id !== sourceSection.id) return section;
          return {
            ...section,
            subsections: section.subsections.map(sub => {
              if (sub.id === sourceSubId) return { ...sub, topicBoxes: sub.topicBoxes.filter((_, idx) => idx !== source.index) };
              if (sub.id === destSubId) {
                const newTopicBoxes = [...sub.topicBoxes];
                newTopicBoxes.splice(destination.index, 0, sourceTopicBox);
                return { ...sub, topicBoxes: newTopicBoxes };
              }
              return sub;
            })
          };
        }));
      } else {
        setSections(sections.map(section => {
          if (section.id === sourceSection.id) {
            return {
              ...section,
              subsections: section.subsections.map(sub => {
                if (sub.id === sourceSubId) return { ...sub, topicBoxes: sub.topicBoxes.filter((_, idx) => idx !== source.index) };
                return sub;
              })
            };
          }
          if (section.id === destSection.id) {
            return {
              ...section,
              subsections: section.subsections.map(sub => {
                if (sub.id === destSubId) {
                  const newTopicBoxes = [...sub.topicBoxes];
                  newTopicBoxes.splice(destination.index, 0, sourceTopicBox);
                  return { ...sub, topicBoxes: newTopicBoxes };
                }
                return sub;
              })
            };
          }
          return section;
        }));
      }
    }
  };

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {readOnly ? (
        <CourseViewer
          courseName={courseName}
          sections={sections}
          videosByTopic={videosByTopic}
          handsOnResources={handsOnResources}
          ownerName={incomingOwnerName}
          isOwner={isOwner}
          isCollaborator={incomingIsCollaborator || false}
          onEditInWorkspace={isOwner ? handleEditInWorkspace : null}
          onEditAsCollaborator={incomingIsCollaborator ? handleEditAsCollaborator : null}
          navigate={navigate}
        />
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <style>{`
            @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
            @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          `}</style>

          {/* ── Persistent workspace top bar ── */}
          <div style={{
            padding: '0 28px', height: '68px',
            display: 'flex', alignItems: 'center', gap: '8px',
            background: '#FFFFFF', borderBottom: '1px solid rgba(0,0,0,0.08)',
            flexShrink: 0, zIndex: 10,
          }}>
            <button
              onClick={handleBack}
              style={{
                fontFamily: "'DM Sans', sans-serif", fontSize: '13.8px', fontWeight: '500',
                padding: '6px 13px', borderRadius: '8px', cursor: 'pointer',
                background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.12)',
                color: '#111', whiteSpace: 'nowrap', flexShrink: 0,
              }}
            >
              ← Course View
            </button>

            {/* Centre: editable course title */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 0 }}>
              <EditableField
                value={courseName}
                onChange={val => setCourseName(val)}
                placeholder="Course name"
                accentColor="#666"
                maxLength={60}
                style={{ display: 'flex', alignItems: 'center' }}
                inputStyle={{ fontFamily: "'DM Serif Display', serif", fontSize: '20.9px', color: '#111', letterSpacing: '-0.3px' }}
              />
            </div>

            {/* Undo */}
            <button
              onClick={undo}
              disabled={historyIndex <= 0}
              style={{
                fontFamily: "'DM Sans', sans-serif", fontSize: '13.8px', fontWeight: '500',
                padding: '6px 13px', borderRadius: '8px', cursor: historyIndex <= 0 ? 'not-allowed' : 'pointer',
                background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.12)',
                color: historyIndex <= 0 ? '#999' : '#111', whiteSpace: 'nowrap', flexShrink: 0,
              }}
            >
              ↶ Undo
            </button>

            {/* Save status */}
            <div style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: '13.8px', fontWeight: '500',
              padding: '6px 13px', borderRadius: '8px',
              background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.12)',
              color: saveStatus === 'saving' ? '#6B7280' : '#1C5C35',
              whiteSpace: 'nowrap', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '5px',
            }}>
              {saveStatus === 'saving' && (
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#9CA3AF', display: 'inline-block', animation: 'pulse 1.5s ease-in-out infinite', flexShrink: 0 }} />
              )}
              {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'error' ? '✕ Error' : '✓ Saved'}
            </div>

            {/* Link generation background indicator */}
            {Object.values(linkGenJobs).some(s => s === 'generating') && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '5px 11px', borderRadius: '8px',
                background: '#F0F4FF', border: '1px solid rgba(99,102,241,0.25)',
                color: '#4338CA', fontSize: '13px', fontWeight: '500',
                fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap', flexShrink: 0,
              }}>
                <span style={{
                  animation: 'pulse 1.5s ease-in-out infinite', display: 'inline-block',
                  width: '7px', height: '7px', borderRadius: '50%', background: '#6366F1',
                }} />
                Generating links…
              </div>
            )}

            {/* Public / Private toggle */}
            <div
              onClick={handleToggleVisibility}
              style={{
                display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer',
                padding: '5px 11px', borderRadius: '8px',
                background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.12)',
                whiteSpace: 'nowrap', flexShrink: 0,
                fontFamily: "'DM Sans', sans-serif", fontSize: '13.8px', fontWeight: '500', color: '#111',
              }}
            >
              <div style={{
                width: '28px', height: '16px', borderRadius: '8px',
                background: isPublic ? '#86EFAC' : '#D1D5DB',
                position: 'relative', transition: 'background 0.2s', flexShrink: 0,
              }}>
                <div style={{
                  position: 'absolute', top: '2px',
                  left: isPublic ? '14px' : '2px',
                  width: '12px', height: '12px', borderRadius: '50%',
                  background: 'white', transition: 'left 0.2s',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                }} />
              </div>
              <span>{isPublic ? 'Public' : 'Private'}</span>
            </div>

            {/* Share */}
            <button
              onClick={() => setShowShareModal(true)}
              style={{
                fontFamily: "'DM Sans', sans-serif", fontSize: '13.8px', fontWeight: '500',
                padding: '6px 13px', borderRadius: '8px', cursor: 'pointer',
                background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.12)',
                color: '#111', whiteSpace: 'nowrap', flexShrink: 0,
                display: 'flex', alignItems: 'center', gap: '5px',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                <polyline points="16 6 12 2 8 6"/>
                <line x1="12" y1="2" x2="12" y2="15"/>
              </svg>
              Share
            </button>

            {/* Divider */}
            <div style={{ width: '1px', height: '22px', background: 'rgba(0,0,0,0.08)', flexShrink: 0 }} />

            {/* Edo toggle */}
            <button
              onClick={() => setIsEdoOpen(p => !p)}
              title={isEdoOpen ? 'Close Edo AI' : 'Open Edo AI'}
              style={{
                fontFamily: "'DM Sans', sans-serif", fontSize: '13.8px', fontWeight: '500',
                padding: '6px 13px', borderRadius: '8px', cursor: 'pointer',
                background: isEdoOpen ? 'rgba(247,228,160,0.85)' : 'rgba(247,228,160,0.6)',
                border: '1px solid rgba(180,150,30,0.25)',
                color: '#5C460A', whiteSpace: 'nowrap', flexShrink: 0,
                display: 'flex', alignItems: 'center', gap: '5px',
              }}
            >
              ✦ Edo
            </button>
          </div>

          {/* ── Page + Edo row ── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>
          <DragDropContext onDragEnd={handleDragEnd}>
            {/* Page column — shrinks to make room for Edo */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

              {/* ── Course Outline Page ── */}
              {navPage === 'outline' && (
                <CourseEditor
                  courseClass={courseClass}
                  setCourseClass={setCourseClass}
                  sections={sections}
                  setSections={setSections}
                  videosByTopic={videosByTopic}
                  handsOnResources={handsOnResources}
                  formData={formData}
                  currentUser={currentUser}
                  actions={actions}
                  onAddBreak={() => setShowBreakModal(true)}
                  navigate={navigate}
                  onNavigateToSubsection={navigateToSubsection}
                />
              )}

              {/* ── Subsection Page ── */}
              {navPage === 'subsection' && activeSubsection && (
                <SubsectionView
                  subsection={activeSubsection}
                  sectionId={navPath.sectionId}
                  sectionTitle={activeSection?.title}
                  sectionNumber={sectionIndex + 1}
                  subsectionNumber={subsectionIndex + 1}
                  videosByTopic={videosByTopic}
                  handsOnResources={handsOnResources}
                  actions={actions}
                  onBack={navigateBack}
                  onNavigateToTopic={navigateToTopic}
                  trayTopics={trayItems.filter(i => i.type === 'TOPICBOX')}
                  onAddTopicFromTray={(item) => {
                    actions.addTopicBoxWithContent(navPath.sectionId, navPath.subsectionId, item.data.title, item.data.description, item.data.learning_objectives);
                    setTrayItems(prev => prev.filter(i => i.id !== item.id));
                  }}
                />
              )}

              {/* ── Topic Page ── */}
              {navPage === 'topic' && activeTopic && (
                <TopicDetailsModal
                  topic={activeTopic}
                  sectionId={navPath.sectionId}
                  subsectionId={navPath.subsectionId}
                  sectionTitle={activeSection?.title}
                  subsectionTitle={activeSubsection?.title}
                  sectionNumber={sectionIndex + 1}
                  subsectionNumber={subsectionIndex + 1}
                  topicNumber={topicIndex + 1}
                  onBack={navigateBack}
                  onNavigateToBlock={navigateToBlock}
                  actions={actions}
                  videosByTopic={videosByTopic}
                  handsOnResources={handsOnResources}
                  currentUser={currentUser}
                  trayBlocks={trayItems.filter(i => i.type === 'BLOCK')}
                  onAddBlockFromTray={(item) => {
                    actions.addBlock(navPath.topicId, item.data);
                    setTrayItems(prev => prev.filter(i => i.id !== item.id));
                  }}
                />
              )}

              {/* ── Block Page ── */}
              {navPage === 'block' && activeBlock && (
                <BlockView
                  block={activeBlock}
                  topicId={navPath.topicId}
                  topicTitle={activeTopic?.title}
                  subsectionTitle={activeSubsection?.title}
                  sectionTitle={activeSection?.title}
                  sectionId={navPath.sectionId}
                  subsectionId={navPath.subsectionId}
                  onBack={navigateBack}
                  actions={actions}
                  currentUser={currentUser}
                  onGenerateLinks={generateLinksForBlock}
                  linkGenStatus={linkGenJobs[navPath.blockId]}
                />
              )}
            </div>

            {/* Edo side panel */}
            {isEdoOpen && (
              <EdoChatbot
                sections={sections}
                courseName={courseName}
                formData={formData}
                actions={actions}
                currentUser={currentUser}
                onClose={() => { setIsEdoOpen(false); setTrayItems([]); }}
                trayItems={trayItems}
                setTrayItems={setTrayItems}
                handsOnResources={handsOnResources}
                currentPage={currentPageContext}
              />
            )}
          </DragDropContext>
          </div>{/* end Page + Edo row */}

          {/* Modals */}
          {showBreakModal && (
            <BreakModal onConfirm={handleBreakCreate} onCancel={() => setShowBreakModal(false)} />
          )}
          <ShareCourseModal
            isOpen={showShareModal}
            onClose={() => setShowShareModal(false)}
            courseId={curriculumId}
            courseName={courseName}
          />
        </div>
      )}
    </div>
  );
};

export default CourseWorkspace;
