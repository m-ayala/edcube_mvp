// src/components/courses/CourseWorkspace.jsx
import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import CourseEditor from './CourseEditor';
import useCourseActions from './useCourseActions';
import BreakModal from '../modals/BreakModal';
import TopicDetailsModal from '../modals/TopicDetailsModal';
import { getOwnProfile } from '../../services/teacherService';

const CourseWorkspace = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const {
    formData,
    sections: incomingSections,
    isEditing,
    curriculumId
  } = location.state || {};

  // ── Core State ────────────────────────────────────────────────────────
  const [courseName, setCourseName] = useState(formData?.courseName || '');
  const [sections, setSections] = useState(incomingSections || []);
  const [showBreakModal, setShowBreakModal] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [videosByTopic, setVideosByTopic] = useState({});
  const [handsOnResources, setHandsOnResources] = useState({});
  const [organizationId, setOrganizationId] = useState(null);

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
          if (sub.topicBoxes && Array.isArray(sub.topicBoxes)) {
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
  const saveToHistory = () => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ sections: [...sections], handsOnResources: { ...handsOnResources } });
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setSections(prev.sections);
      setHandsOnResources(prev.handsOnResources);
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

  // ── Save Course ───────────────────────────────────────────────────────
  const saveCourse = async () => {
    try {
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
        class: formData?.class || '',
        subject: formData?.subject || '',
        topic: formData?.topic || '',
        timeDuration: formData?.timeDuration || '',
        objectives: formData?.objectives || '',
        sections: sectionsForSave,
        outline: { sections: sectionsForSave }
      };

      const hasExistingId = curriculumId && curriculumId !== 'new-course';
      if (hasExistingId) courseData.courseId = curriculumId;

      // Ensure organizationId is available before saving
      if (!organizationId) {
        alert('Unable to save: Organization ID not found. Please try refreshing the page.');
        return;
      }

      const endpoint = hasExistingId
        ? `http://localhost:8000/api/update-course?teacherUid=${currentUser.uid}`
        : `http://localhost:8000/api/save-course?teacherUid=${currentUser.uid}&organizationId=${organizationId}`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify(courseData)
      });

      const result = await response.json();
      if (result.success) {
        alert(hasExistingId ? 'Course updated!' : 'Course saved!');
      } else {
        alert('Failed to save: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error saving course:', error);
      alert('Failed to save course');
    }
  };

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#FAF9F6' }}>
      <CourseEditor
        courseName={courseName}
        setCourseName={setCourseName}
        sections={sections}
        setSections={setSections}
        videosByTopic={videosByTopic}
        handsOnResources={handsOnResources}
        formData={formData}
        currentUser={currentUser}
        actions={actions}
        onSave={saveCourse}
        onUndo={undo}
        canUndo={historyIndex > 0}
        onAddBreak={() => setShowBreakModal(true)}
        onTopicClick={handleTopicClick}
        navigate={navigate}
      />

      {/* Modals */}
      {showBreakModal && (
        <BreakModal onConfirm={handleBreakCreate} onCancel={() => setShowBreakModal(false)} />
      )}

      {isModalOpen && selectedTopic && (
        <TopicDetailsModal topic={selectedTopic} onClose={() => { setIsModalOpen(false); setSelectedTopic(null); }} />
      )}
    </div>
  );
};

export default CourseWorkspace;