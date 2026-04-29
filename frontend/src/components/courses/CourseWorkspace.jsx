// src/components/courses/CourseWorkspace.jsx
import { useState, useEffect, useRef, useMemo } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import CourseEditor, { EditableField } from './CourseEditor';
import CourseViewer from './CourseViewer';
import SubsectionView from './SubsectionView';
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
  // navPage: 'outline' | 'subsection' | 'block'
  const [navPage, setNavPage] = useState('outline');
  const [navPath, setNavPath] = useState({ sectionId: null, subsectionId: null, blockId: null });

  const navigateToSubsection = (sectionId, subsectionId) => {
    setNavPage('subsection');
    setNavPath({ sectionId, subsectionId, blockId: null });
    setTrayItems([]);
  };
  const navigateToBlock = (sectionId, subsectionId, blockId) => {
    setNavPage('block');
    setNavPath({ sectionId, subsectionId, blockId });
    setTrayItems([]);
  };
  const navigateBack = () => {
    if (navPage === 'block') {
      setNavPage('subsection');
      setNavPath(p => ({ ...p, blockId: null }));
    } else if (navPage === 'subsection') {
      setNavPage('outline');
      setNavPath({ sectionId: null, subsectionId: null, blockId: null });
    }
    setTrayItems([]);
  };

  // Derived active objects from navigation path
  const activeSection = sections.find(s => s.id === navPath.sectionId) || null;
  const activeSubsection = activeSection?.subsections?.find(ss => ss.id === navPath.subsectionId) || null;
  const sectionIndex = activeSection ? sections.indexOf(activeSection) : -1;
  const subsectionIndex = activeSubsection ? (activeSection?.subsections?.indexOf(activeSubsection) ?? -1) : -1;
  const activeBlock = (handsOnResources[navPath.subsectionId] || []).find(b => b.id === navPath.blockId) || null;

  const generateLinksForBlock = async (blockId, subsectionId, blockData) => {
    console.log('[generateLinksForBlock] called', { blockId, subsectionId, blockType: blockData?.type });
    setLinkGenJobs(prev => ({ ...prev, [blockId]: 'generating' }));
    try {
      const { links: generated } = await generateBlockLinks({
        blockType: blockData.type || 'content',
        blockTitle: blockData.title || '',
        blockContent: blockData.content || '',
        topicTitle: activeSubsection?.title || '',
        topicDescription: activeSubsection?.description || '',
        gradeLevel: formData?.class || '',
        subject: formData?.subject || '',
        teacherUid: currentUser?.uid || null,
      });
      if (generated?.length > 0) {
        const existing = (handsOnResources[subsectionId] || [])
          .find(b => b.id === blockId)?.links || [];
        const merged = [
          ...existing,
          ...generated.map(l => ({ id: `link-${Date.now()}-${Math.random().toString(36).slice(2)}`, ...l })),
        ];
        actions.updateBlock(subsectionId, blockId, { links: merged });
      }
      setLinkGenJobs(prev => ({ ...prev, [blockId]: 'done' }));
    } catch (err) {
      console.error('Link generation failed:', err);
      setLinkGenJobs(prev => ({ ...prev, [blockId]: 'error' }));
    }
  };

  // Derived Edo context from navigation state
  const currentPageContext = useMemo(() => {
    const sec = sections.find(s => s.id === navPath.sectionId);
    const sub = sec?.subsections?.find(ss => ss.id === navPath.subsectionId);
    const block = (handsOnResources[navPath.subsectionId] || []).find(b => b.id === navPath.blockId);
    return {
      page: navPage,
      sectionId: navPath.sectionId, sectionTitle: sec?.title,
      subsectionId: navPath.subsectionId, subsectionTitle: sub?.title,
      blockId: navPath.blockId, blockTitle: block?.title,
    };
  }, [navPage, navPath, sections, handsOnResources]);

  // ── Initialize Actions Hook ────────────────────────────────���──────────
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

  // ── Mount: Transform old data (topicBoxes) → new flat structure ───────
  useEffect(() => {
    console.log('📦 CourseWorkspace loaded');

    // Flatten old topicBoxes into subsection-level structure
    const transformedSections = sections.map(section => {
      if (section.type === 'break') return section;
      return {
        ...section,
        subsections: (section.subsections || []).map(sub => {
          const topicBoxes = sub.topicBoxes || [];
          // Already migrated — just ensure required fields
          if (topicBoxes.length === 0) {
            return {
              id: sub.id,
              title: sub.title,
              description: sub.description || '',
              learning_objectives: sub.learning_objectives || [],
              duration_minutes: sub.duration_minutes ?? 20,
            };
          }
          // Migrate: pull metadata from first topic box
          const first = topicBoxes[0];
          return {
            id: sub.id,
            title: sub.title,
            description: sub.description || first.description || '',
            learning_objectives: sub.learning_objectives?.length
              ? sub.learning_objectives
              : (first.learning_objectives || []),
            duration_minutes: sub.duration_minutes ?? first.duration_minutes ?? 20,
          };
        })
      };
    });

    setSections(transformedSections);

    // Hydrate handsOnResources and videos by subsectionId
    // (flattening any old topicBox resources up to the subsection)
    const loadedVideos = {};
    const loadedHandsOn = {};

    sections.forEach(section => {
      (section.subsections || []).forEach(sub => {
        const allResources = [];

        // From old topicBoxes
        (sub.topicBoxes || []).forEach(topic => {
          const resources = [
            ...(topic.content_blocks || []).map(r => ({ ...r, type: r.type || 'content' })),
            ...(topic.worksheets || []).map(r => ({ ...r, type: 'worksheet' })),
            ...(topic.activities || []).map(r => ({ ...r, type: 'activity' })),
          ];
          allResources.push(...resources);
          if ((topic.video_resources || []).length > 0) {
            loadedVideos[sub.id] = [...(loadedVideos[sub.id] || []), ...topic.video_resources];
          }
        });

        // From subsection-level (already migrated format)
        const subResources = [
          ...(sub.content_blocks || []).map(r => ({ ...r, type: r.type || 'content' })),
          ...(sub.worksheets || []).map(r => ({ ...r, type: 'worksheet' })),
          ...(sub.activities || []).map(r => ({ ...r, type: 'activity' })),
        ];
        allResources.push(...subResources);

        if (allResources.length > 0) {
          loadedHandsOn[sub.id] = allResources;
        }
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── History ───────────────────────────────────────────────────────────
  const isUndoingRef = useRef(false);
  const historyMountedRef = useRef(false);

  useEffect(() => {
    const id = setTimeout(() => { historyMountedRef.current = true; }, 1200);
    return () => clearTimeout(id);
  }, []);

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
        id: sub.id,
        title: sub.title,
        description: sub.description || '',
        learning_objectives: sub.learning_objectives || [],
        duration_minutes: sub.duration_minutes ?? 20,
        content_blocks: (handsOnResources[sub.id] || []).filter(r => r.type === 'content'),
        worksheets: (handsOnResources[sub.id] || []).filter(r => r.type === 'worksheet'),
        activities: (handsOnResources[sub.id] || []).filter(r => r.type === 'activity'),
        video_resources: videosByTopic[sub.id] || [],
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
      throw new Error(result.error || result.detail || 'Unknown error');
    }

    if (!hasExistingId && result.courseId) {
      setCurriculumId(result.courseId);
    }
  };

  // ── Embed blocks into sections for navigation state ─────────────────
  const sectionsWithBlocks = () => sections.map(section => ({
    ...section,
    subsections: (section.subsections || []).map(sub => ({
      ...sub,
      content_blocks: (handsOnResources[sub.id] || []).filter(r => r.type === 'content'),
      worksheets:     (handsOnResources[sub.id] || []).filter(r => r.type === 'worksheet'),
      activities:     (handsOnResources[sub.id] || []).filter(r => r.type === 'activity'),
      video_resources: videosByTopic[sub.id] || [],
    }))
  }));

  // ── Back to Course View ───────────────────────────────────────────────
  const handleBack = () => {
    navigate('/course-view', {
      state: {
        formData,
        sections: sectionsWithBlocks(),
        curriculumId,
        isPublic,
        isOwner,
        ownerName: incomingOwnerName,
        isCollaborator: incomingIsCollaborator || false,
      }
    });
  };

  const handleEditInWorkspace = () => {
    navigate('/course-workspace', {
      state: {
        formData,
        sections: sectionsWithBlocks(),
        isEditing: true,
        curriculumId,
        isPublic,
        readOnly: false,
        isOwner: false
      }
    });
  };

  const handleEditAsCollaborator = () => {
    navigate('/course-workspace', {
      state: {
        formData,
        sections: sectionsWithBlocks(),
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

  // ── Drag and Drop ──────────────────────────────��──────────────────────
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

    if (type === 'BLOCK') {
      const subsectionId = source.droppableId.replace('blocks-', '');
      const currentBlocks = [...(handsOnResources[subsectionId] || [])];
      const [movedBlock] = currentBlocks.splice(source.index, 1);
      currentBlocks.splice(destination.index, 0, movedBlock);
      setHandsOnResources(prev => ({ ...prev, [subsectionId]: currentBlocks }));
      return;
    }
  };

  // ── Render ──────────────────────────────────────────────────────────���─
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {readOnly ? (
        <CourseViewer
          courseName={courseName}
          sections={sections}
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

            <div style={{ width: '1px', height: '22px', background: 'rgba(0,0,0,0.08)', flexShrink: 0 }} />

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
                  handsOnResources={handsOnResources}
                  actions={actions}
                  onBack={navigateBack}
                  onNavigateToBlock={navigateToBlock}
                  trayBlocks={trayItems.filter(i => i.type === 'BLOCK')}
                  onAddBlockFromTray={(item) => {
                    actions.addBlock(navPath.subsectionId, item.data);
                    setTrayItems(prev => prev.filter(i => i.id !== item.id));
                  }}
                />
              )}

              {/* ── Block Page ── */}
              {navPage === 'block' && activeBlock && (
                <BlockView
                  block={activeBlock}
                  topicId={navPath.subsectionId}
                  topicTitle={null}
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
          </div>

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
