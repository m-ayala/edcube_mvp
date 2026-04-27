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
  const [generatingStates, setGeneratingStates] = useState({});

  const setGenerating = (key, value) =>
    setGeneratingStates(prev => ({ ...prev, [key]: value }));

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

  const addSectionWithContent = (title, description) => {
    setSections(prev => [...prev, {
      id: `section-${Date.now()}`,
      title,
      description,
      subsections: []
    }]);
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

  const addSubsectionWithContent = (sectionId, title, description) => {
    setSections(prev => prev.map(section => {
      if (section.id !== sectionId) return section;
      const idx = (section.subsections || []).length + 1;
      return {
        ...section,
        subsections: [...(section.subsections || []), {
          id: `sub-${Date.now()}-${idx}`,
          title,
          description,
          topicBoxes: []
        }]
      };
    }));
  };

  const addTopicBoxWithContent = (sectionId, subsectionId, title, description) => {
    // Validate inside the functional update so we always check against the latest state (prev),
    // not the potentially-stale closure value of `sections`.
    setSections(prev => {
      const targetSection = prev.find(s => s.id === sectionId);
      if (!targetSection) {
        console.warn(`[Edo] addTopicBoxWithContent: section "${sectionId}" not found`, prev.map(s => s.id));
        return prev; // no-op
      }
      const targetSub = (targetSection.subsections || []).find(ss => ss.id === subsectionId);
      if (!targetSub) {
        console.warn(`[Edo] addTopicBoxWithContent: subsection "${subsectionId}" not found`, (targetSection.subsections || []).map(ss => ss.id));
        return prev; // no-op
      }
      return prev.map(section => {
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
                title,
                description,
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
      });
    });

    // Auto-expand so the user can see the new topic box.
    // Always expand optimistically — if IDs were wrong the no-op is harmless.
    setCollapsedSections(prev => ({ ...prev, [sectionId]: false }));
    setCollapsedSubsections(prev => ({ ...prev, [subsectionId]: false }));
    return true;
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

  // ── Insert-at-index (for tray drops) ─────────────────────────────────
  const insertSectionAt = (section, index) => {
    setSections(prev => {
      const next = [...prev];
      next.splice(Math.min(Math.max(0, index), next.length), 0, section);
      return next;
    });
  };

  const insertSubsectionAt = (sectionId, subsection, index) => {
    setSections(prev => prev.map(s => {
      if (s.id !== sectionId) return s;
      const subs = [...(s.subsections || [])];
      subs.splice(Math.min(Math.max(0, index), subs.length), 0, subsection);
      return { ...s, subsections: subs };
    }));
  };

  const insertTopicBoxAt = (sectionId, subsectionId, topicBox, index) => {
    setSections(prev => prev.map(s => {
      if (s.id !== sectionId) return s;
      return {
        ...s,
        subsections: (s.subsections || []).map(sub => {
          if (sub.id !== subsectionId) return sub;
          const boxes = [...(sub.topicBoxes || [])];
          boxes.splice(Math.min(Math.max(0, index), boxes.length), 0, topicBox);
          return { ...sub, topicBoxes: boxes };
        })
      };
    }));
    setCollapsedSections(prev => ({ ...prev, [sectionId]: false }));
    setCollapsedSubsections(prev => ({ ...prev, [subsectionId]: false }));
  };

  // ── AI Generation ─────────────────────────────────────────────────────
  const handleGenerateSections = async ({ level, context, userGuidance, count }) => {
    setGenerating('sections', true);
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
        return { success: true, count: result.items.length };
      }
      return { success: false, error: 'No items returned' };
    } catch (error) {
      console.error('Failed to generate sections:', error);
      return { success: false, error: error.message };
    } finally {
      setGenerating('sections', false);
    }
  };

  const handleGenerateSubsections = async (sectionId, { level, context, userGuidance, count }) => {
    setGenerating(`subsections-${sectionId}`, true);
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
        return { success: true, count: result.items.length };
      }
      return { success: false, error: 'No items returned' };
    } catch (error) {
      console.error('Failed to generate subsections:', error);
      return { success: false, error: error.message };
    } finally {
      setGenerating(`subsections-${sectionId}`, false);
    }
  };

  const handleGenerateTopicBoxes = async (sectionId, subsectionId, { level, context, userGuidance, count }) => {
    setGenerating(`topics-${sectionId}-${subsectionId}`, true);
    try {
      const result = await generateCurriculumContent({
        level,
        context,
        userGuidance,
        count,
        teacherUid: currentUser.uid
      });

      if (result.success && result.items && result.items.length > 0) {
        // Validate and update inside the functional update so we always use latest state.
        const newTopicBoxes = result.items.map((item, i) => ({
          id: item.id || `topic-${Date.now()}-${i + 1}`,
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

        setSections(prev => {
          const hasSection = prev.some(s => s.id === sectionId);
          if (!hasSection) {
            console.warn(`[Edo] handleGenerateTopicBoxes: section "${sectionId}" not found in latest state`);
            return prev;
          }
          return prev.map(section => {
            if (section.id !== sectionId) return section;
            return {
              ...section,
              subsections: (section.subsections || []).map(sub => {
                if (sub.id !== subsectionId) return sub;
                return {
                  ...sub,
                  topicBoxes: [...(sub.topicBoxes || []), ...newTopicBoxes]
                };
              })
            };
          });
        });

        // Auto-expand so the user sees the new topic boxes
        setCollapsedSections(prev => ({ ...prev, [sectionId]: false }));
        setCollapsedSubsections(prev => ({ ...prev, [subsectionId]: false }));

        console.log(`✅ Generated ${result.items.length} topic boxes for subsection ${subsectionId}`);
        return { success: true, count: result.items.length };
      }
      return { success: false, error: 'No items returned' };
    } catch (error) {
      console.error('Failed to generate topic boxes:', error);
      return { success: false, error: error.message };
    } finally {
      setGenerating(`topics-${sectionId}-${subsectionId}`, false);
    }
  };

  // ── Generate-for-Tray (returns items without inserting) ───────────────
  const generateSectionsForTray = async ({ level, context, count }) => {
    setGenerating('sections-tray', true);
    try {
      const result = await generateCurriculumContent({
        level, context, count, teacherUid: currentUser.uid
      });
      if (result.success && result.items) {
        return {
          success: true,
          items: result.items.map(item => ({
            id: item.id || `section-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            title: item.title,
            description: item.description,
            subsections: []
          }))
        };
      }
      return { success: false, error: 'No items returned' };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      setGenerating('sections-tray', false);
    }
  };

  const generateSubsectionsForTray = async ({ level, context, count }) => {
    setGenerating('subsections-tray', true);
    try {
      const result = await generateCurriculumContent({
        level, context, count, teacherUid: currentUser.uid
      });
      if (result.success && result.items) {
        return {
          success: true,
          items: result.items.map(item => ({
            id: item.id || `sub-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            title: item.title,
            description: item.description,
            topicBoxes: []
          }))
        };
      }
      return { success: false, error: 'No items returned' };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      setGenerating('subsections-tray', false);
    }
  };

  const generateTopicBoxesForTray = async ({ level, context, count }) => {
    setGenerating('topics-tray', true);
    try {
      const result = await generateCurriculumContent({
        level, context, count, teacherUid: currentUser.uid
      });
      if (result.success && result.items) {
        return {
          success: true,
          items: result.items.map((item, i) => ({
            id: item.id || `topic-${Date.now()}-${i + 1}`,
            title: item.title,
            description: item.description,
            duration_minutes: item.duration_minutes || 20,
            pla_pillars: item.pla_pillars || [],
            learning_objectives: item.learning_objectives || [],
            content_keywords: item.content_keywords || [],
            video_resources: [],
            worksheets: [],
            activities: []
          }))
        };
      }
      return { success: false, error: 'No items returned' };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      setGenerating('topics-tray', false);
    }
  };

  // ── Video Generation ──────────────────────────────────────────────────
  const generateVideosFromBackend = async (topicBox) => {
    setGenerating(`videos-${topicBox.id}`, true);
    try {
      console.log('🎬 Generating videos for:', topicBox.title);
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/generate-videos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicId: topicBox.id,
          topicTitle: topicBox.title,
          topicData: {
            title: topicBox.title,
            duration: `${topicBox.duration_minutes || 20} min`,
            description: topicBox.description || '',
            learningObjectives: topicBox.learning_objectives || [],
            subtopics: topicBox.content_keywords || [],
            subject: formData?.subject || '',
            courseName: formData?.courseName || '',
            courseTopic: formData?.topic || ''
          },
          sectionId: topicBox.id,
          gradeLevel: formData.class,
          courseId: curriculumId || 'new-course'
        })
      });
      const result = await response.json();
      if (!response.ok) {
        const detail = result.detail || result.error || `Server error ${response.status}`;
        console.error('❌ Video generation failed:', detail);
        return { success: false, error: detail };
      }
      if (result.success) {
        setVideosByTopic(prev => ({ ...prev, [topicBox.id]: result.videos }));
        console.log('✅ Videos received:', result.videos.length);
        return { success: true, count: result.videos.length };
      } else {
        return { success: false, error: result.error || 'No videos returned' };
      }
    } catch (error) {
      console.error('❌ Error:', error);
      return { success: false, error: error.message || 'Network error' };
    } finally {
      setGenerating(`videos-${topicBox.id}`, false);
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

    setGenerating(`${resourceType}-${topicBoxId}`, true);
    try {
      console.log(`🔨 Generating ${resourceType} for:`, topicBox.title);
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/generate-resource`, {
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
      const resource = await response.json();
      if (!response.ok) {
        throw new Error(resource.detail || resource.error || `Server error ${response.status}`);
      }
      console.log(`✅ ${resourceType} generated:`, resource);
      setHandsOnResources(prev => ({
        ...prev,
        [topicBoxId]: [...(prev[topicBoxId] || []), resource]
      }));
      return { success: true, title: resource.title };
    } catch (error) {
      console.error(`Error generating ${resourceType}:`, error);
      return { success: false, error: error.message || 'Unknown error' };
    } finally {
      setGenerating(`${resourceType}-${topicBoxId}`, false);
    }
  };

  // ── Manual Resource Management ───────────────────────────────────────
  const addManualResource = (topicId, resourceType, resourceData) => {
    console.log(`➕ Adding manual ${resourceType} to topic ${topicId}:`, resourceData);

    if (resourceType === 'video') {
      // Legacy: add to videosByTopic as a YouTube-style card
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
          source: 'manual',
        }],
      }));
    } else {
      // content, worksheet, activity — store full resourceData so all schema fields are preserved
      const currentResources = handsOnResources[topicId] || [];
      setHandsOnResources(prev => ({
        ...prev,
        [topicId]: [...currentResources, {
          ...resourceData,
          type: resourceType,
          source: resourceData.source || 'manual',
          addedAt: resourceData.addedAt || new Date().toISOString(),
        }],
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
          idx === resourceIndex ? { ...item, ...updatedData } : item
        ),
      }));
    } else {
      setHandsOnResources(prev => ({
        ...prev,
        [topicId]: (prev[topicId] || []).map((item, idx) =>
          idx === resourceIndex ? { ...item, ...updatedData } : item
        ),
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

  // ── Block CRUD (handsOnResources, id-based) ───────────────────────────
  const addBlock = (topicId, blockData) => {
    const block = {
      ...blockData,
      id: blockData.id || `block-${Date.now()}`,
      addedAt: blockData.addedAt || new Date().toISOString(),
    };
    setHandsOnResources(prev => ({
      ...prev,
      [topicId]: [...(prev[topicId] || []), block],
    }));
  };

  const removeBlock = (topicId, blockId) => {
    setHandsOnResources(prev => ({
      ...prev,
      [topicId]: (prev[topicId] || []).filter(b => b.id !== blockId),
    }));
  };

  const updateBlock = (topicId, blockId, updatedFields) => {
    setHandsOnResources(prev => ({
      ...prev,
      [topicId]: (prev[topicId] || []).map(b =>
        b.id === blockId ? { ...b, ...updatedFields } : b
      ),
    }));
  };

  // ── Return All Actions ────────────────────────────────────────────────
  return {
    // Section
    addSection,
    addSectionWithContent,
    updateSectionTitle,
    updateSectionDescription,
    removeSection,

    // Subsection
    addSubsection,
    addSubsectionWithContent,
    updateSubsectionTitle,
    updateSubsectionDescription,
    removeSubsection,
    
    // TopicBox
    addTopicBox,
    addTopicBoxWithContent,
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
    generateSectionsForTray,
    generateSubsectionsForTray,
    generateTopicBoxesForTray,

    // Insert-at-index (for tray drops)
    insertSectionAt,
    insertSubsectionAt,
    insertTopicBoxAt,
    
    // Block CRUD (id-based)
    addBlock,
    removeBlock,
    updateBlock,

    // Resources
    generateVideosFromBackend,
    generateResource,
    addManualResource,
    removeResource,
    updateResource,
    
    // State setters (for modals)
    setVideosByTopic,
    setHandsOnResources,

    // Loading states
    generatingStates
  };
};

export default useCourseActions;