// src/components/courses/useCourseActions.js
import { useState } from 'react';
import { generateCurriculumContent } from '../../utils/curriculumApi';

const useCourseActions = ({
  sections,
  setSections,
  videosByTopic,
  setVideosByTopic,
  handsOnResources,
  setHandsOnResources,
  formData,
  currentUser,
  curriculumId
}) => {
  // ── UI State ──────────────────────────────────────────────────────────
  const [collapsedSections, setCollapsedSections] = useState({});
  const [collapsedSubsections, setCollapsedSubsections] = useState({});
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // ── Section CRUD ──────────────────────────────────────────────────────
  const addSection = () => {
    setSections(prev => [...prev, {
      id: `section-${Date.now()}`,
      title: `Section ${prev.filter(s => s.type !== 'break').length + 1}`,
      description: '',
      subsections: []
    }]);
  };

  const updateSectionTitle = (sectionId, newTitle) => {
    setSections(prev => prev.map(s => s.id === sectionId ? { ...s, title: newTitle } : s));
  };

  const updateSectionDescription = (sectionId, newDesc) => {
    setSections(prev => prev.map(s => s.id === sectionId ? { ...s, description: newDesc } : s));
  };

  const removeSection = (sectionId) => {
    setSections(prev => prev.filter(s => s.id !== sectionId));
  };

  // ── Subsection CRUD ───────────────────────────────────────────────────
  const addSubsection = (sectionId) => {
    setSections(prev => prev.map(section => {
      if (section.id !== sectionId) return section;
      const idx = (section.subsections || []).length + 1;
      return {
        ...section,
        subsections: [...(section.subsections || []), {
          id: `sub-${Date.now()}-${idx}`,
          title: `Subsection ${idx}`,
          description: '',
          topicBoxes: []
        }]
      };
    }));
  };

  const updateSubsectionTitle = (sectionId, subId, newTitle) => {
    setSections(prev => prev.map(section => {
      if (section.id !== sectionId) return section;
      return {
        ...section,
        subsections: (section.subsections || []).map(sub =>
          sub.id === subId ? { ...sub, title: newTitle } : sub
        )
      };
    }));
  };

  const updateSubsectionDescription = (sectionId, subId, newDesc) => {
    setSections(prev => prev.map(section => {
      if (section.id !== sectionId) return section;
      return {
        ...section,
        subsections: (section.subsections || []).map(sub =>
          sub.id === subId ? { ...sub, description: newDesc } : sub
        )
      };
    }));
  };

  const removeSubsection = (sectionId, subId) => {
    setSections(prev => prev.map(section => {
      if (section.id !== sectionId) return section;
      return {
        ...section,
        subsections: (section.subsections || []).filter(s => s.id !== subId)
      };
    }));
  };

  // ── Topic Box CRUD ────────────────────────────────────────────────────
  const addTopicBox = (sectionId, subsectionId) => {
    setSections(prev => prev.map(section => {
      if (section.id !== sectionId) return section;

      return {
        ...section,
        subsections: (section.subsections || []).map(sub => {
          if (sub.id !== subsectionId) return sub;

          const idx = (sub.topicBoxes || []).length + 1;
          return {
            ...sub,
            topicBoxes: [...(sub.topicBoxes || []), {
              id: `topic-${Date.now()}-${idx}`,
              title: `Topic ${idx}`,
              description: '',
              duration_minutes: 20,
              pla_pillars: [],
              learning_objectives: [],
              content_keywords: [],
              video_resources: [],
              worksheets: [],
              activities: []
            }]
          };
        })
      };
    }));
  };

  const updateTopicBoxTitle = (sectionId, subsectionId, topicBoxId, newTitle) => {
    setSections(prev => prev.map(section => {
      if (section.id !== sectionId) return section;

      return {
        ...section,
        subsections: (section.subsections || []).map(sub => {
          if (sub.id !== subsectionId) return sub;

          return {
            ...sub,
            topicBoxes: (sub.topicBoxes || []).map(topic =>
              topic.id === topicBoxId ? { ...topic, title: newTitle } : topic
            )
          };
        })
      };
    }));
  };

  const removeTopicBox = (sectionId, subsectionId, topicBoxId) => {
    setSections(prev => prev.map(section => {
      if (section.id !== sectionId) return section;

      return {
        ...section,
        subsections: (section.subsections || []).map(sub => {
          if (sub.id !== subsectionId) return sub;

          return {
            ...sub,
            topicBoxes: (sub.topicBoxes || []).filter(t => t.id !== topicBoxId)
          };
        })
      };
    }));
  };

  // ── Collapse Toggles ──────────────────────────────────────────────────
  const toggleSection = (sectionId) => {
    setCollapsedSections(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };
  
  const toggleSubsection = (subId) => {
    setCollapsedSubsections(prev => ({ ...prev, [subId]: !prev[subId] }));
  };

  // ── Delete Confirmation ───────────────────────────────────────────────
  const confirmDeleteSection = (sectionId) => {
    const section = sections.find(s => s.id === sectionId);
    setDeleteConfirm({
      type: 'section',
      id: sectionId,
      title: 'Delete Section?',
      message: `Are you sure you want to delete "${section?.title || 'this section'}"? This will also delete all subsections and topic boxes within it.`
    });
  };

  const confirmDeleteSubsection = (sectionId, subId) => {
    const section = sections.find(s => s.id === sectionId);
    const subsection = section?.subsections?.find(s => s.id === subId);
    setDeleteConfirm({
      type: 'subsection',
      id: subId,
      sectionId: sectionId,
      title: 'Delete Subsection?',
      message: `Are you sure you want to delete "${subsection?.title || 'this subsection'}"? This will also delete all topic boxes within it.`
    });
  };

  const confirmDeleteTopicBox = (sectionId, subsectionId, topicBoxId) => {
    setDeleteConfirm({
      type: 'topicBox',
      id: topicBoxId,
      sectionId: sectionId,
      subsectionId: subsectionId,
      title: 'Delete Topic Box?',
      message: `Are you sure you want to delete this topic box? This will also delete all resources within it.`
    });
  };

  const handleConfirmDelete = () => {
    if (!deleteConfirm) return;
    
    if (deleteConfirm.type === 'section') {
      removeSection(deleteConfirm.id);
    } else if (deleteConfirm.type === 'subsection') {
      removeSubsection(deleteConfirm.sectionId, deleteConfirm.id);
    } else if (deleteConfirm.type === 'topicBox') {
      removeTopicBox(deleteConfirm.sectionId, deleteConfirm.subsectionId, deleteConfirm.id);
    }
    
    setDeleteConfirm(null);
  };

  // ── AI Generation ─────────────────────────────────────────────────────
  const handleGenerateSections = async ({ level, context, userGuidance, count }) => {
    try {
      const result = await generateCurriculumContent({
        level,
        context,
        userGuidance,
        count,
        teacherUid: currentUser.uid
      });

      if (result.success && result.items) {
        const newSections = result.items.map(item => ({
          id: item.id,
          title: item.title,
          description: item.description,
          subsections: []
        }));
        
        setSections(prev => [...prev, ...newSections]);
        console.log(`✅ Generated ${result.items.length} sections`);
      }
    } catch (error) {
      console.error('Failed to generate sections:', error);
      alert('Failed to generate sections. Please try again.');
    }
  };

  const handleGenerateSubsections = async (sectionId, { level, context, userGuidance, count }) => {
    try {
      const result = await generateCurriculumContent({
        level,
        context,
        userGuidance,
        count,
        teacherUid: currentUser.uid
      });

      if (result.success && result.items) {
        setSections(prev => prev.map(section => {
          if (section.id !== sectionId) return section;

          const newSubsections = result.items.map(item => ({
            id: item.id,
            title: item.title,
            description: item.description,
            topicBoxes: []
          }));

          return {
            ...section,
            subsections: [...(section.subsections || []), ...newSubsections]
          };
        }));

        console.log(`✅ Generated ${result.items.length} subsections for section ${sectionId}`);
      }
    } catch (error) {
      console.error('Failed to generate subsections:', error);
      alert('Failed to generate subsections. Please try again.');
    }
  };

  const handleGenerateTopicBoxes = async (sectionId, subsectionId, { level, context, userGuidance, count }) => {
    try {
      const result = await generateCurriculumContent({
        level,
        context,
        userGuidance,
        count,
        teacherUid: currentUser.uid
      });

      if (result.success && result.items) {
        setSections(prev => prev.map(section => {
          if (section.id !== sectionId) return section;

          return {
            ...section,
            subsections: (section.subsections || []).map(sub => {
              if (sub.id !== subsectionId) return sub;

              const newTopicBoxes = result.items.map(item => ({
                id: item.id,
                title: item.title,
                description: item.description,
                duration_minutes: item.duration_minutes || 20,
                pla_pillars: item.pla_pillars || [],
                learning_objectives: item.learning_objectives || [],
                content_keywords: item.content_keywords || [],
                video_resources: [],
                worksheets: [],
                activities: []
              }));

              return {
                ...sub,
                topicBoxes: [...(sub.topicBoxes || []), ...newTopicBoxes]
              };
            })
          };
        }));

        console.log(`✅ Generated ${result.items.length} topic boxes for subsection ${subsectionId}`);
      }
    } catch (error) {
      console.error('Failed to generate topic boxes:', error);
      alert('Failed to generate topic boxes. Please try again.');
    }
  };

  // ── Video Generation ──────────────────────────────────────────────────
  const generateVideosFromBackend = async (topicBox) => {
    try {
      console.log('🎬 Generating videos for:', topicBox.title);
      const response = await fetch('http://localhost:8000/api/generate-videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicId: topicBox.id,
          topicTitle: topicBox.title,
          topicData: {
            title: topicBox.title,
            duration: `${topicBox.duration_minutes} min`,
            description: topicBox.description,
            learningObjectives: topicBox.learning_objectives || [],
            subtopics: topicBox.content_keywords || [],
            subject: formData.subject,
            courseName: formData.courseName,
            courseTopic: formData.topic
          },
          sectionId: topicBox.id,
          gradeLevel: formData.class,
          courseId: curriculumId || 'new-course'
        })
      });
      const result = await response.json();
      if (result.success) {
        setVideosByTopic(prev => ({ ...prev, [topicBox.id]: result.videos }));
        console.log('✅ Videos received:', result.videos.length);
      } else {
        alert('Failed to generate videos');
      }
    } catch (error) {
      console.error('❌ Error:', error);
      alert('Error generating videos');
    }
  };

  // ── Hands-On Resource Generation ──────────────────────────────────────
  const generateResource = async (topicBoxId, resourceType) => {
    // Find the topic box
    let topicBox = null;
    for (const section of sections) {
      for (const sub of section.subsections || []) {
        topicBox = (sub.topicBoxes || []).find(t => t.id === topicBoxId);
        if (topicBox) break;
      }
      if (topicBox) break;
    }
    
    if (!topicBox) return;

    try {
      console.log(`🔨 Generating ${resourceType} for:`, topicBox.title);
      const response = await fetch('http://localhost:8000/api/generate-resource', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicId: topicBoxId,
          resourceType,
          gradeLevel: formData.class,
          topicTitle: topicBox.title,
          topicDescription: topicBox.description || '',
          learningObjectives: topicBox.learning_objectives || []
        })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const resource = await response.json();
      console.log(`✅ ${resourceType} generated:`, resource);
      setHandsOnResources(prev => ({
        ...prev,
        [topicBoxId]: [...(prev[topicBoxId] || []), resource]
      }));
      alert(`${resourceType.charAt(0).toUpperCase() + resourceType.slice(1)} generated!`);
    } catch (error) {
      console.error(`Error generating ${resourceType}:`, error);
      alert(`Failed to generate ${resourceType}`);
    }
  };

  // ── Manual Resource Management ───────────────────────────────────────
  const addManualResource = (topicId, resourceType, resourceData) => {
    console.log(`➕ Adding manual ${resourceType} to topic ${topicId}:`, resourceData);
    
    if (resourceType === 'video') {
      // Add to videos
      const currentVideos = videosByTopic[topicId] || [];
      setVideosByTopic(prev => ({
        ...prev,
        [topicId]: [...currentVideos, {
          videoId: `manual-${Date.now()}`,
          title: resourceData.title,
          url: resourceData.url,
          thumbnailUrl: 'https://via.placeholder.com/120x90?text=Video',
          channelName: 'Manual',
          duration: 'N/A',
          source: 'manual'
        }]
      }));
    } else {
      // Add to hands-on resources (worksheet or activity)
      const currentResources = handsOnResources[topicId] || [];
      setHandsOnResources(prev => ({
        ...prev,
        [topicId]: [...currentResources, {
          type: resourceType,
          title: resourceData.title,
          url: resourceData.url,
          description: resourceData.description || '',
          source: 'manual'
        }]
      }));
    }
  };

  const removeResource = (topicId, resourceType, resourceIndex) => {
    if (resourceType === 'video') {
      const currentVideos = videosByTopic[topicId] || [];
      setVideosByTopic(prev => ({
        ...prev,
        [topicId]: currentVideos.filter((_, idx) => idx !== resourceIndex)
      }));
    } else {
      const currentResources = handsOnResources[topicId] || [];
      setHandsOnResources(prev => ({
        ...prev,
        [topicId]: currentResources.filter((_, idx) => idx !== resourceIndex)
      }));
    }
  };

  const updateResource = (topicId, resourceType, resourceIndex, updatedData) => {
    if (resourceType === 'video') {
      setVideosByTopic(prev => ({
        ...prev,
        [topicId]: (prev[topicId] || []).map((item, idx) =>
          idx === resourceIndex
            ? { ...item, title: updatedData.title, url: updatedData.url }
            : item
        )
      }));
    } else {
      setHandsOnResources(prev => ({
        ...prev,
        [topicId]: (prev[topicId] || []).map((item, idx) =>
          idx === resourceIndex
            ? { ...item, title: updatedData.title, url: updatedData.url, description: updatedData.description || '' }
            : item
        )
      }));
    }
  };

  const updateTopicBoxFull = ({ sectionId, subsectionId, topicId, updatedData }) => {
    console.log('📝 Updating full topic box:', topicId, updatedData);
    
    setSections(prev => prev.map(section => {
      if (section.id !== sectionId) return section;

      return {
        ...section,
        subsections: (section.subsections || []).map(sub => {
          if (sub.id !== subsectionId) return sub;

          return {
            ...sub,
            topicBoxes: (sub.topicBoxes || []).map(topic =>
              topic.id === topicId ? {
                ...topic,
                title: updatedData.title,
                description: updatedData.description,
                duration_minutes: updatedData.duration_minutes,
                learning_objectives: updatedData.learning_objectives,
                content_keywords: updatedData.content_keywords,
                pla_pillars: updatedData.pla_pillars
              } : topic
            )
          };
        })
      };
    }));
  };

  // ── Return All Actions ────────────────────────────────────────────────
  return {
    // Section
    addSection,
    updateSectionTitle,
    updateSectionDescription,
    removeSection,
    
    // Subsection
    addSubsection,
    updateSubsectionTitle,
    updateSubsectionDescription,
    removeSubsection,
    
    // TopicBox
    addTopicBox,
    updateTopicBoxTitle,
    removeTopicBox,
    updateTopicBoxFull,
    
    // Toggles
    toggleSection,
    toggleSubsection,
    collapsedSections,
    collapsedSubsections,
    
    // Delete
    confirmDeleteSection,
    confirmDeleteSubsection,
    confirmDeleteTopicBox,
    handleConfirmDelete,
    deleteConfirm,
    setDeleteConfirm,
    
    // AI
    handleGenerateSections,
    handleGenerateSubsections,
    handleGenerateTopicBoxes,
    
    // Resources
    generateVideosFromBackend,
    generateResource,
    addManualResource,
    removeResource,
    updateResource,
    
    // State setters (for modals)
    setVideosByTopic,
    setHandsOnResources
  };
};

export default useCourseActions;