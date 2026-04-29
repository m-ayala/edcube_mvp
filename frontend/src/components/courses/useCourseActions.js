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
          learning_objectives: [],
          duration_minutes: 20,
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

  const updateSubsectionFull = (sectionId, subId, updatedData) => {
    setSections(prev => prev.map(section => {
      if (section.id !== sectionId) return section;
      return {
        ...section,
        subsections: (section.subsections || []).map(sub =>
          sub.id === subId ? { ...sub, ...updatedData } : sub
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
          learning_objectives: [],
          duration_minutes: 20,
        }]
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
      message: `Are you sure you want to delete "${section?.title || 'this section'}"? This will also delete all subsections and blocks within it.`
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
      message: `Are you sure you want to delete "${subsection?.title || 'this subsection'}"? This will also delete all blocks within it.`
    });
  };

  const handleConfirmDelete = () => {
    if (!deleteConfirm) return;

    if (deleteConfirm.type === 'section') {
      removeSection(deleteConfirm.id);
    } else if (deleteConfirm.type === 'subsection') {
      removeSubsection(deleteConfirm.sectionId, deleteConfirm.id);
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
            description: item.description || '',
            learning_objectives: item.learning_objectives || [],
            duration_minutes: item.duration_minutes || 20,
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
            description: item.description || '',
            learning_objectives: item.learning_objectives || [],
            duration_minutes: item.duration_minutes || 20,
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

  // ── Video Generation ──────────────────────────────────────────────────
  const generateVideosFromBackend = async (subsection) => {
    setGenerating(`videos-${subsection.id}`, true);
    try {
      console.log('🎬 Generating videos for:', subsection.title);
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/generate-videos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicId: subsection.id,
          topicTitle: subsection.title,
          topicData: {
            title: subsection.title,
            duration: `${subsection.duration_minutes || 20} min`,
            description: subsection.description || '',
            learningObjectives: subsection.learning_objectives || [],
            subject: formData?.subject || '',
            courseName: formData?.courseName || '',
            courseTopic: formData?.topic || ''
          },
          sectionId: subsection.id,
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
        setVideosByTopic(prev => ({ ...prev, [subsection.id]: result.videos }));
        console.log('✅ Videos received:', result.videos.length);
        return { success: true, count: result.videos.length };
      } else {
        return { success: false, error: result.error || 'No videos returned' };
      }
    } catch (error) {
      console.error('❌ Error:', error);
      return { success: false, error: error.message || 'Network error' };
    } finally {
      setGenerating(`videos-${subsection.id}`, false);
    }
  };

  // ── Hands-On Resource Generation ──────────────────────────────────────
  const generateResource = async (subsectionId, resourceType) => {
    let subsection = null;
    for (const section of sections) {
      subsection = (section.subsections || []).find(s => s.id === subsectionId);
      if (subsection) break;
    }

    if (!subsection) return;

    setGenerating(`${resourceType}-${subsectionId}`, true);
    try {
      console.log(`🔨 Generating ${resourceType} for:`, subsection.title);
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/generate-resource`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicId: subsectionId,
          resourceType,
          gradeLevel: formData.class,
          topicTitle: subsection.title,
          topicDescription: subsection.description || '',
          learningObjectives: subsection.learning_objectives || []
        })
      });
      const resource = await response.json();
      if (!response.ok) {
        throw new Error(resource.detail || resource.error || `Server error ${response.status}`);
      }
      console.log(`✅ ${resourceType} generated:`, resource);
      setHandsOnResources(prev => ({
        ...prev,
        [subsectionId]: [...(prev[subsectionId] || []), resource]
      }));
      return { success: true, title: resource.title };
    } catch (error) {
      console.error(`Error generating ${resourceType}:`, error);
      return { success: false, error: error.message || 'Unknown error' };
    } finally {
      setGenerating(`${resourceType}-${subsectionId}`, false);
    }
  };

  // ── Manual Resource Management ───────────────────────────────────────
  const addManualResource = (subsectionId, resourceType, resourceData) => {
    console.log(`➕ Adding manual ${resourceType} to subsection ${subsectionId}:`, resourceData);

    if (resourceType === 'video') {
      const currentVideos = videosByTopic[subsectionId] || [];
      setVideosByTopic(prev => ({
        ...prev,
        [subsectionId]: [...currentVideos, {
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
      const currentResources = handsOnResources[subsectionId] || [];
      setHandsOnResources(prev => ({
        ...prev,
        [subsectionId]: [...currentResources, {
          ...resourceData,
          type: resourceType,
          source: resourceData.source || 'manual',
          addedAt: resourceData.addedAt || new Date().toISOString(),
        }],
      }));
    }
  };

  const removeResource = (subsectionId, resourceType, resourceIndex) => {
    if (resourceType === 'video') {
      const currentVideos = videosByTopic[subsectionId] || [];
      setVideosByTopic(prev => ({
        ...prev,
        [subsectionId]: currentVideos.filter((_, idx) => idx !== resourceIndex)
      }));
    } else {
      const currentResources = handsOnResources[subsectionId] || [];
      setHandsOnResources(prev => ({
        ...prev,
        [subsectionId]: currentResources.filter((_, idx) => idx !== resourceIndex)
      }));
    }
  };

  const updateResource = (subsectionId, resourceType, resourceIndex, updatedData) => {
    if (resourceType === 'video') {
      setVideosByTopic(prev => ({
        ...prev,
        [subsectionId]: (prev[subsectionId] || []).map((item, idx) =>
          idx === resourceIndex ? { ...item, ...updatedData } : item
        ),
      }));
    } else {
      setHandsOnResources(prev => ({
        ...prev,
        [subsectionId]: (prev[subsectionId] || []).map((item, idx) =>
          idx === resourceIndex ? { ...item, ...updatedData } : item
        ),
      }));
    }
  };

  // ── Block CRUD (handsOnResources, id-based, keyed by subsectionId) ────
  const addBlock = (subsectionId, blockData) => {
    const block = {
      ...blockData,
      id: blockData.id || `block-${Date.now()}`,
      addedAt: blockData.addedAt || new Date().toISOString(),
    };
    setHandsOnResources(prev => ({
      ...prev,
      [subsectionId]: [...(prev[subsectionId] || []), block],
    }));
  };

  const removeBlock = (subsectionId, blockId) => {
    setHandsOnResources(prev => ({
      ...prev,
      [subsectionId]: (prev[subsectionId] || []).filter(b => b.id !== blockId),
    }));
  };

  const updateBlock = (subsectionId, blockId, updatedFields) => {
    setHandsOnResources(prev => ({
      ...prev,
      [subsectionId]: (prev[subsectionId] || []).map(b =>
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
    updateSubsectionFull,
    removeSubsection,

    // Toggles
    toggleSection,
    toggleSubsection,
    collapsedSections,
    collapsedSubsections,

    // Delete
    confirmDeleteSection,
    confirmDeleteSubsection,
    handleConfirmDelete,
    deleteConfirm,
    setDeleteConfirm,

    // AI
    handleGenerateSections,
    handleGenerateSubsections,
    generateSectionsForTray,
    generateSubsectionsForTray,

    // Insert-at-index (for tray drops)
    insertSectionAt,
    insertSubsectionAt,

    // Block CRUD (id-based, keyed by subsectionId)
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
