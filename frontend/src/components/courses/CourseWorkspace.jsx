// src/components/courses/CourseWorkspace.jsx
import { useState, useEffect, useRef } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import CourseEditor from './CourseEditor';
import CourseViewer from './CourseViewer';
import EdoChatbot from './EdoChatbot';
import useCourseActions from './useCourseActions';
import useAutosave from './useAutosave';
import BreakModal from '../modals/BreakModal';
import TopicDetailsModal from '../modals/TopicDetailsModal';
import ShareCourseModal from '../modals/ShareCourseModal';
import { getOwnProfile } from '../../services/teacherService';

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
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [videosByTopic, setVideosByTopic] = useState({});
  const [handsOnResources, setHandsOnResources] = useState({});
  const [organizationId, setOrganizationId] = useState(null);
  const [isPublic, setIsPublic] = useState(incomingIsPublic || false);
  const [readOnly] = useState(incomingReadOnly || false);
  const [isOwner] = useState(incomingIsOwner || false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [isEdoOpen, setIsEdoOpen] = useState(false);
  const [trayItems, setTrayItems] = useState([]);
  const [activeTopicContext, setActiveTopicContext] = useState(null);

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

  // ── Topic Details Modal ───────────────────────────────────────────────
  const handleTopicClick = (topic) => {
    setSelectedTopic(topic);
    setIsModalOpen(true);
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
        <div style={{ flex: 1, display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>
          <DragDropContext onDragEnd={handleDragEnd}>
            {/* Editor column — shrinks to make room for Edo */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
              <CourseEditor
                courseName={courseName}
                setCourseName={setCourseName}
                courseClass={courseClass}
                setCourseClass={setCourseClass}
                sections={sections}
                setSections={setSections}
                videosByTopic={videosByTopic}
                handsOnResources={handsOnResources}
                formData={formData}
                currentUser={currentUser}
                actions={actions}
                saveStatus={saveStatus}
                onUndo={undo}
                canUndo={historyIndex > 0}
                onAddBreak={() => setShowBreakModal(true)}
                onTopicClick={handleTopicClick}
                navigate={navigate}
                onBack={handleBack}
                isPublic={isPublic}
                onToggleVisibility={handleToggleVisibility}
                onShare={() => setShowShareModal(true)}
                isEdoOpen={isEdoOpen}
                onToggleEdo={() => setIsEdoOpen(p => !p)}
                onTopicDetailOpen={(ctx) => { setActiveTopicContext(ctx); if (ctx) setIsEdoOpen(true); }}
              />
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
                videosByTopic={videosByTopic}
                handsOnResources={handsOnResources}
                activeTopicContext={activeTopicContext}
              />
            )}
          </DragDropContext>

          {/* Modals — outside DragDropContext to avoid coordinate interference */}
          {showBreakModal && (
            <BreakModal onConfirm={handleBreakCreate} onCancel={() => setShowBreakModal(false)} />
          )}
          {isModalOpen && selectedTopic && (
            <TopicDetailsModal topic={selectedTopic} onClose={() => { setIsModalOpen(false); setSelectedTopic(null); }} />
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
