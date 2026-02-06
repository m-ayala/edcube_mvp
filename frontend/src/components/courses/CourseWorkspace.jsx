// src/components/courses/CourseWorkspace.jsx
import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import TopicDetailsModal from '../modals/TopicDetailsModal';
import BreakModal from '../modals/BreakModal';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { GripVertical, Edit2, Check, Trash2 } from 'lucide-react';
import AIGenerateButton from '../AIGenerateButton';
import { generateCurriculumContent } from '../../utils/curriculumApi';

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

  const [courseName, setCourseName] = useState(formData?.courseName || '');
  const [sections, setSections] = useState(incomingSections || []);
  const [showBreakModal, setShowBreakModal] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [videosByTopic, setVideosByTopic] = useState({});
  const [handsOnResources, setHandsOnResources] = useState({});
  // Track which sections/subsections are collapsed
  const [collapsedSections, setCollapsedSections] = useState({});
  const [collapsedSubsections, setCollapsedSubsections] = useState({});
  // Track which fields are being edited
  const [editingField, setEditingField] = useState(null);
  // Track delete confirmation dialog
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // ── course-picker state ──
  const [showCoursePicker, setShowCoursePicker] = useState(false);
  const [pickerCourses, setPickerCourses] = useState([]);
  const [pickerLoading, setPickerLoading] = useState(false);

  // ─── Mount: Transform old data structure to new + hydrate caches ─────
  useEffect(() => {
    console.log('📦 CourseWorkspace loaded');

    // Transform old structure (subsection with resources) to new structure (subsection with topicBoxes)
    const transformedSections = sections.map(section => {
      if (section.type === 'break') return section;

      return {
        ...section,
        subsections: (section.subsections || []).map(sub => {
          // If already has topicBoxes, leave as-is
          if (sub.topicBoxes && Array.isArray(sub.topicBoxes)) {
            return sub;
          }

          // OLD STRUCTURE: subsection has resources directly
          // Transform to NEW STRUCTURE: subsection has topicBoxes array
          const hasResources = 
            (sub.video_resources && sub.video_resources.length > 0) ||
            (sub.worksheets && sub.worksheets.length > 0) ||
            (sub.activities && sub.activities.length > 0) ||
            (sub.learning_objectives && sub.learning_objectives.length > 0);

          if (hasResources) {
            // Migrate old structure: create one topic box with existing resources
            return {
              id: sub.id,
              title: sub.title,
              description: sub.description,
              topicBoxes: [{
                id: `topic-${sub.id}-migrated`,
                title: sub.title, // Use subsection title
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
            // New empty subsection
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

    // Hydrate video + hands-on caches from topic boxes
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

  // ─── Drag and Drop Handler ────────────────────────────────────────────
  const handleDragEnd = (result) => {
    const { source, destination, type } = result;

    if (!destination) return;

    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    // Handle SECTION reordering
    if (type === 'SECTION') {
      const reorderedSections = Array.from(sections);
      const [movedSection] = reorderedSections.splice(source.index, 1);
      reorderedSections.splice(destination.index, 0, movedSection);
      setSections(reorderedSections);
      return;
    }

    // Handle SUBSECTION reordering within a section
    if (type === 'SUBSECTION') {
      const sectionId = source.droppableId.replace('subsections-', '');
      const section = sections.find(s => s.id === sectionId);
      
      if (section && section.subsections) {
        const reorderedSubsections = Array.from(section.subsections);
        const [movedSubsection] = reorderedSubsections.splice(source.index, 1);
        reorderedSubsections.splice(destination.index, 0, movedSubsection);
        
        const updatedSections = sections.map(s =>
          s.id === sectionId
            ? { ...s, subsections: reorderedSubsections }
            : s
        );
        setSections(updatedSections);
      }
      return;
    }

    // Handle TOPICBOX reordering within a subsection
    if (type === 'TOPICBOX') {
      const sourceSubId = source.droppableId.replace('topicboxes-', '');
      const destSubId = destination.droppableId.replace('topicboxes-', '');

      // Find source subsection and topic box
      let sourceSection = null;
      let sourceSub = null;
      let sourceTopicBox = null;
      
      for (const section of sections) {
        const sub = (section.subsections || []).find(s => s.id === sourceSubId);
        if (sub) {
          sourceSection = section;
          sourceSub = sub;
          sourceTopicBox = sub.topicBoxes[source.index];
          break;
        }
      }

      // Find destination subsection
      let destSection = null;
      let destSub = null;
      
      for (const section of sections) {
        const sub = (section.subsections || []).find(s => s.id === destSubId);
        if (sub) {
          destSection = section;
          destSub = sub;
          break;
        }
      }

      if (!sourceSection || !sourceSub || !sourceTopicBox || !destSection || !destSub) return;

      // Same subsection - just reorder
      if (sourceSubId === destSubId) {
        const updatedSections = sections.map(section => {
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
        });
        setSections(updatedSections);
      } else {
        // Different subsections - move topic box
        const updatedSections = sections.map(section => {
          // Remove from source
          if (section.id === sourceSection.id) {
            return {
              ...section,
              subsections: section.subsections.map(sub => {
                if (sub.id === sourceSubId) {
                  return {
                    ...sub,
                    topicBoxes: sub.topicBoxes.filter((_, idx) => idx !== source.index)
                  };
                }
                return sub;
              })
            };
          }
          // Add to destination
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
        });
        setSections(updatedSections);
      }
      return;
    }
  };

  // ─── Course Picker ────────────────────────────────────────────────────
  const handlePickCourse = (curriculum) => {
    // Transform curriculum data
    const transformed = (curriculum.outline?.sections || curriculum.sections || []).map(section => ({
      id: section.id,
      title: section.title,
      description: section.description || '',
      subsections: (section.subsections || []).map(sub => {
        // Check if already has topicBoxes structure
        if (sub.topicBoxes && Array.isArray(sub.topicBoxes)) {
          return sub;
        }
        
        // Old structure - migrate to topicBoxes
        return {
          id: sub.id,
          title: sub.title,
          description: sub.description || '',
          topicBoxes: [{
            id: `topic-${sub.id}-loaded`,
            title: sub.title,
            description: sub.description || '',
            duration_minutes: sub.duration_minutes || 0,
            pla_pillars: sub.pla_pillars || [],
            learning_objectives: sub.learning_objectives || [],
            content_keywords: sub.content_keywords || [],
            video_resources: sub.video_resources || [],
            worksheets: sub.worksheets || [],
            activities: sub.activities || []
          }]
        };
      })
    }));
    setCourseName(curriculum.courseName || '');
    setSections(transformed);
    setShowCoursePicker(false);
  };

  // ─── Undo / History ───────────────────────────────────────────────────
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

  // ─── Section CRUD ─────────────────────────────────────────────────────
  const addSection = () => {
    setSections([...sections, {
      id: `section-${Date.now()}`,
      title: `Section ${sections.length + 1}`,
      description: '',
      subsections: []
    }]);
  };

  const addBreak = () => setShowBreakModal(true);

  const handleBreakCreate = (duration, unit) => {
    setSections([...sections, {
      id: `break-${Date.now()}`,
      type: 'break',
      duration: `${duration} ${unit}`
    }]);
    setShowBreakModal(false);
  };

  const updateSectionTitle = (sectionId, newTitle) => {
    setSections(sections.map(s => s.id === sectionId ? { ...s, title: newTitle } : s));
  };

  const updateSectionDescription = (sectionId, newDesc) => {
    setSections(sections.map(s => s.id === sectionId ? { ...s, description: newDesc } : s));
  };

  const removeSection = (sectionId) => {
    setSections(sections.filter(s => s.id !== sectionId));
  };

  // ─── Subsection CRUD ──────────────────────────────────────────────────
  const addSubsection = (sectionId) => {
    setSections(sections.map(section => {
      if (section.id !== sectionId) return section;
      const idx = (section.subsections || []).length + 1;
      return {
        ...section,
        subsections: [...(section.subsections || []), {
          id: `sub-${Date.now()}-${idx}`,
          title: `Subsection ${idx}`,
          description: '',
          topicBoxes: []  // NEW: Empty array for topic boxes
        }]
      };
    }));
  };

  const updateSubsectionTitle = (sectionId, subId, newTitle) => {
    setSections(sections.map(section => {
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
    setSections(sections.map(section => {
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
    setSections(sections.map(section => {
      if (section.id !== sectionId) return section;
      return {
        ...section,
        subsections: (section.subsections || []).filter(s => s.id !== subId)
      };
    }));
  };

  // ─── Topic Box CRUD ───────────────────────────────────────────────────
  const addTopicBox = (sectionId, subsectionId) => {
    setSections(sections.map(section => {
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
    setSections(sections.map(section => {
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
    setSections(sections.map(section => {
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

  const toggleSection = (sectionId) => {
    setCollapsedSections(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };
  
  const toggleSubsection = (subId) => {
    setCollapsedSubsections(prev => ({ ...prev, [subId]: !prev[subId] }));
  };

  // ─── Delete Confirmation ──────────────────────────────────────────────
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

  // ─── AI Generation Handlers ───────────────────────────────────────────
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
        
        setSections([...sections, ...newSections]);
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
        setSections(sections.map(section => {
          if (section.id !== sectionId) return section;
          
          const newSubsections = result.items.map(item => ({
            id: item.id,
            title: item.title,
            description: item.description,
            topicBoxes: []  // NEW: Start with empty topic boxes
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
        setSections(sections.map(section => {
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

  // ─── Topic Details Modal ──────────────────────────────────────────────
  const handleTopicClick = (topic) => {
    setSelectedTopic(topic);
    setIsModalOpen(true);
  };

  // ─── Video Generation ─────────────────────────────────────────────────
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

  // ─── Hands-On Resource Generation ─────────────────────────────────────
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

  // ─── Save Course ──────────────────────────────────────────────────────
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

      const endpoint = hasExistingId
        ? `http://localhost:8000/api/update-course?teacherUid=${currentUser.uid}`
        : `http://localhost:8000/api/save-course?teacherUid=${currentUser.uid}`;

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

  // ─── Shared inline styles ─────────────────────────────────────────────
  const colors = {
    bg: '#FAF9F6',              // Warm off-white
    card: '#FFFFFF',            // Pure white
    sectionBorder: '#E8E6E1',   // Subtle beige border
    sectionBg: '#F5F3EE',       // Light beige background
    subBorder: '#D4D0C8',       // Medium beige
    accent: '#D4C4A8',          // Main beige accent
    accentLight: '#F5F3EE',     // Light beige
    textPrimary: '#2C2A26',     // Dark brown-gray
    textSecondary: '#6B6760',   // Medium gray
    pillBg: '#F5F3EE',          // Light beige
    pillText: '#6B6760',        // Medium gray
    videoBtn: '#D4C4A8',        // Beige (was red)
    worksheetBtn: '#D4C4A8',    // Beige (was blue)
    activityBtn: '#D4C4A8',     // Beige (was green)
    dangerBtn: '#E57373',       // Soft red
    
    // PLA Pillars - ONLY colorful elements
    pla: {
      'Personal Growth': '#E8A5A5',
      'Core Learning': '#A5C9E8',
      'Critical Thinking': '#B8E8A5',
      'Application & Impact': '#E8D5A5'
    }
  };

  // ─── SUB-COMPONENTS (inline, scoped) ──────────────────────────────────

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

  const IconBtn = ({ onClick, children, color = colors.dangerBtn, title }) => (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color, fontSize: '16px', padding: '2px 6px', borderRadius: '4px',
        lineHeight: 1
      }}
    >
      {children}
    </button>
  );

  const EditableField = ({ 
    value, 
    onChange, 
    fieldKey, 
    placeholder = 'Click to edit',
    style = {},
    inputStyle = {}
  }) => {
    const isEditing = editingField?.key === fieldKey;
    
    const handleEdit = () => {
      setEditingField({ key: fieldKey, value });
    };
    
    const handleSave = () => {
      if (editingField?.value !== undefined) {
        onChange(editingField.value);
      }
      setEditingField(null);
    };
    
    const handleKeyDown = (e) => {
      if (e.key === 'Enter') {
        handleSave();
      } else if (e.key === 'Escape') {
        setEditingField(null);
      }
    };
    
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '6px', 
        position: 'relative',
        flex: 1,
        ...style 
      }}>
        <input
          type="text"
          value={isEditing ? (editingField.value || '') : value}
          onChange={e => isEditing && setEditingField({ ...editingField, value: e.target.value })}
          onKeyDown={handleKeyDown}
          disabled={!isEditing}
          placeholder={placeholder}
          style={{
            flex: 1,
            border: 'none',
            background: 'transparent',
            outline: 'none',
            cursor: isEditing ? 'text' : 'default',
            paddingRight: '28px',
            ...inputStyle
          }}
        />
        <button
          onClick={isEditing ? handleSave : handleEdit}
          style={{
            position: 'absolute',
            right: '4px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '2px',
            display: 'flex',
            alignItems: 'center',
            color: isEditing ? colors.accent : '#9ca3af'
          }}
          title={isEditing ? 'Save' : 'Edit'}
        >
          {isEditing ? <Check size={14} /> : <Edit2 size={14} />}
        </button>
      </div>
    );
  };

  const DescriptorBox = ({ value, onChange, placeholder, fieldKey }) => (
    <div style={{
      border: '1px solid #E8E6E1',
      borderRadius: '8px',
      padding: '10px 14px',
      marginBottom: '12px',
      backgroundColor: '#F5F3EE',
      position: 'relative'
    }}>
      <EditableField
        value={value}
        onChange={onChange}
        fieldKey={fieldKey}
        placeholder={placeholder || 'Add a description…'}
        inputStyle={{
          fontSize: '13px',
          color: colors.textSecondary,
          fontStyle: value ? 'normal' : 'italic'
        }}
      />
    </div>
  );

  const ConfirmDialog = ({ isOpen, onConfirm, onCancel, title, message }) => {
    if (!isOpen) return null;
    
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '24px',
          maxWidth: '400px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
        }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '18px', color: colors.textPrimary }}>
            {title}
          </h3>
          <p style={{ margin: '0 0 20px', fontSize: '14px', color: colors.textSecondary }}>
            {message}
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button
              onClick={onCancel}
              style={{
                padding: '8px 16px',
                backgroundColor: '#f3f4f6',
                color: colors.textPrimary,
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              style={{
                padding: '8px 16px',
                backgroundColor: colors.dangerBtn,
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ─── Topic Box Row Component ──────────────────────────────────────────
  const TopicBoxRow = ({ topicBox, sectionId, subsectionId, dragHandleProps }) => {
    const videos = videosByTopic[topicBox.id] || [];
    const worksheets = (handsOnResources[topicBox.id] || []).filter(r => r.type === 'worksheet');
    const activities = (handsOnResources[topicBox.id] || []).filter(r => r.type === 'activity');

    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: '12px',
        border: '1px solid #e5e7eb',
        borderRadius: '10px',
        overflow: 'hidden',
        backgroundColor: colors.card,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        position: 'relative',
        marginBottom: '12px'
      }}>
        {/* Drag handle */}
        <div
          {...dragHandleProps}
          style={{
            position: 'absolute',
            top: '8px',
            left: '8px',
            cursor: 'grab',
            zIndex: 10,
            padding: '4px',
            background: 'rgba(255, 255, 255, 0.9)',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <GripVertical size={16} style={{ color: '#9ca3af' }} />
        </div>

        {/* Col 1: Topic Info */}
        <div style={{ padding: '14px', borderRight: '1px solid #f3f4f6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
            <EditableField
              value={topicBox.title}
              onChange={val => updateTopicBoxTitle(sectionId, subsectionId, topicBox.id, val)}
              fieldKey={`topic-title-${topicBox.id}`}
              placeholder="Topic title"
              style={{ flex: 1, paddingLeft: '24px' }}
              inputStyle={{
                fontSize: '14px',
                fontWeight: '600',
                color: colors.textPrimary
              }}
            />
            <button
              onClick={() => confirmDeleteTopicBox(sectionId, subsectionId, topicBox.id)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
                color: colors.dangerBtn
              }}
              title="Delete topic box"
            >
              <Trash2 size={14} />
            </button>
          </div>

          {(topicBox.learning_objectives || []).length > 0 && (
            <ul style={{ margin: '8px 0 8px 24px', paddingLeft: '16px', fontSize: '12px', color: colors.textSecondary }}>
              {topicBox.learning_objectives.map((obj, i) => (
                <li key={i} style={{ marginBottom: '2px' }}>{obj}</li>
              ))}
            </ul>
          )}

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px', paddingLeft: '24px' }}>
            <Pill label={`${topicBox.duration_minutes || 0} min`} color={{ bg: '#F5F3EE', text: colors.textSecondary }} />
            {(topicBox.pla_pillars || []).map((pillar, idx) => (
              <Pill 
                key={idx}
                label={pillar} 
                color={{ 
                  bg: colors.pla[pillar] || colors.pillBg, 
                  text: colors.textPrimary 
                }} 
              />
            ))}
          </div>
        </div>

        {/* Col 2: Videos */}
        <div style={{ padding: '14px', borderRight: '1px solid #f3f4f6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <p style={{ margin: 0, fontSize: '11px', fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Videos</p>
            {videos.length > 0 && (
              <button onClick={() => generateVideosFromBackend(topicBox)} style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: 'transparent',
                color: colors.videoBtn,
                border: `1px solid ${colors.videoBtn}`,
                cursor: 'pointer',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0
              }}>↻</button>
            )}
          </div>

          {videos.length === 0 ? (
            <button onClick={() => generateVideosFromBackend(topicBox)} style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: colors.videoBtn,
              color: '#2C2A26',
              border: 'none',
              cursor: 'pointer',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.2s',
              padding: 0
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#B8A888'}
            onMouseLeave={(e) => e.target.style.backgroundColor = colors.videoBtn}
            >
              ✨
            </button>
          ) : (
            <div>
              {videos.map((video, idx) => (
                <a key={idx}
                  href={`https://www.youtube.com/watch?v=${video.videoId}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{
                    display: 'flex', gap: '8px', padding: '6px',
                    marginBottom: '6px', backgroundColor: '#fafafa',
                    border: '1px solid #eee', borderRadius: '6px',
                    textDecoration: 'none', color: 'inherit', cursor: 'pointer'
                  }}
                >
                  <img src={video.thumbnailUrl} alt={video.title}
                    style={{ width: '56px', height: '42px', objectFit: 'cover', borderRadius: '3px', flexShrink: 0 }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: '12px', fontWeight: '500', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: colors.textPrimary }}>
                      {video.title}
                    </p>
                    <p style={{ fontSize: '10px', color: colors.textSecondary, margin: 0 }}>
                      {video.channelName} • {video.duration}
                    </p>
                  </div>
                </a>
              ))}
              <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                <Pill label={`${videos.length} video${videos.length > 1 ? 's' : ''}`} color={{ bg: '#F5F3EE', text: colors.textSecondary }} />
              </div>
            </div>
          )}
        </div>

        {/* Col 3: Hands-On */}
        <div style={{ padding: '14px' }}>
          <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Hands-On</p>

          <div style={{ marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <p style={{ margin: 0, fontSize: '11px', color: colors.textSecondary }}>Worksheets</p>
              <button onClick={() => generateResource(topicBox.id, 'worksheet')} style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: colors.worksheetBtn,
                color: '#2C2A26',
                border: 'none',
                cursor: 'pointer',
                fontSize: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0
              }}>✨</button>
            </div>
            {worksheets.length === 0 ? (
              <p style={{ fontSize: '11px', color: '#9ca3af', fontStyle: 'italic', margin: '4px 0' }}>None yet</p>
            ) : worksheets.map((ws, i) => (
              <div key={i} style={{ padding: '5px 8px', marginBottom: '4px', backgroundColor: '#F5F3EE', border: '1px solid #E8E6E1', borderRadius: '4px' }}>
                <p style={{ margin: 0, fontSize: '12px', fontWeight: '500', color: colors.textPrimary }}>{ws.title}</p>
                {ws.sourceUrl && <a href={ws.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: colors.accent }}>View Source</a>}
              </div>
            ))}
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <p style={{ margin: 0, fontSize: '11px', color: colors.textSecondary }}>Activities</p>
              <button onClick={() => generateResource(topicBox.id, 'activity')} style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: colors.activityBtn,
                color: '#2C2A26',
                border: 'none',
                cursor: 'pointer',
                fontSize: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0
              }}>✨</button>
            </div>
            {activities.length === 0 ? (
              <p style={{ fontSize: '11px', color: '#9ca3af', fontStyle: 'italic', margin: '4px 0' }}>None yet</p>
            ) : activities.map((act, i) => (
              <div key={i} style={{ padding: '5px 8px', marginBottom: '4px', backgroundColor: '#F5F3EE', border: '1px solid #E8E6E1', borderRadius: '4px' }}>
                <p style={{ margin: '0 0 2px', fontSize: '12px', fontWeight: '500', color: colors.textPrimary }}>{act.title}</p>
                <p style={{ margin: 0, fontSize: '11px', color: colors.textSecondary }}>{act.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ─── Section Block Component ──────────────────────────────────────────
  const SectionBlock = ({ section, index, dragHandleProps }) => {
    if (section.type === 'break') {
      return (
        <div style={{
          padding: '12px 16px', marginBottom: '16px',
          backgroundColor: '#FFF9E6', border: '1px solid #E8E6E1',
          borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div {...dragHandleProps} style={{ cursor: 'grab', display: 'flex', alignItems: 'center' }}>
              <GripVertical size={18} style={{ color: '#9ca3af' }} />
            </div>
            <span style={{ fontWeight: '500', fontSize: '14px' }}>⏸️ Break — {section.duration}</span>
          </div>
          <button
            onClick={() => confirmDeleteSection(section.id)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              color: colors.dangerBtn
            }}
            title="Delete break"
          >
            <Trash2 size={16} />
          </button>
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
          display: 'flex', alignItems: 'center', gap: '10px'
        }}>
          <div {...dragHandleProps} style={{ cursor: 'grab', display: 'flex', alignItems: 'center' }}>
            <GripVertical size={18} style={{ color: colors.accent }} />
          </div>

          <button onClick={() => toggleSection(section.id)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '14px', color: colors.accent, padding: 0
          }}>
            {isCollapsed ? '▶' : '▼'}
          </button>

          <span style={{ fontSize: '12px', fontWeight: '700', color: colors.accent }}>
            Section {index + 1}
          </span>

          <EditableField
            value={section.title}
            onChange={val => updateSectionTitle(section.id, val)}
            fieldKey={`section-title-${section.id}`}
            placeholder="Section title"
            inputStyle={{
              fontSize: '15px',
              fontWeight: '600',
              color: colors.textPrimary
            }}
          />

          <button
            onClick={() => confirmDeleteSection(section.id)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              color: colors.dangerBtn,
              fontSize: '13px',
              fontWeight: '600'
            }}
            title="Delete section"
          >
            <Trash2 size={16} />
          </button>
        </div>

        {!isCollapsed && (
          <div style={{ padding: '14px 16px' }}>
            <DescriptorBox
              value={section.description}
              onChange={val => updateSectionDescription(section.id, val)}
              placeholder="Section description…"
              fieldKey={`section-desc-${section.id}`}
            />

            {/* Subsections */}
            <Droppable droppableId={`subsections-${section.id}`} type="SUBSECTION">
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                >
                  {(section.subsections || []).map((sub, subIdx) => (
                    <Draggable
                      key={sub.id}
                      draggableId={sub.id}
                      index={subIdx}
                    >
                      {(provided, snapshot) => {
                        const isSubCollapsed = collapsedSubsections[sub.id];
    
                        return (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            style={{
                              ...provided.draggableProps.style,
                              marginBottom: '16px',
                              opacity: snapshot.isDragging ? 0.8 : 1,
                              border: '1px solid #e5e7eb',
                              borderRadius: '8px',
                              backgroundColor: '#fafafa',
                              overflow: 'hidden'
                            }}
                          >
                            {/* Subsection header */}
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '8px 12px',
                              backgroundColor: '#f9fafb',
                              borderBottom: isSubCollapsed ? 'none' : '1px solid #e5e7eb'
                            }}>
                              <div {...provided.dragHandleProps} style={{ cursor: 'grab', display: 'flex', alignItems: 'center' }}>
                                <GripVertical size={16} style={{ color: '#9ca3af' }} />
                              </div>

                              <button onClick={() => toggleSubsection(sub.id)} style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                fontSize: '12px', color: colors.accent, padding: 0
                              }}>
                                {isSubCollapsed ? '▶' : '▼'}
                              </button>

                              <span style={{ fontSize: '11px', fontWeight: '700', color: colors.accent }}>
                                Subsection {index + 1}.{subIdx + 1}
                              </span>

                              <EditableField
                                value={sub.title}
                                onChange={val => updateSubsectionTitle(section.id, sub.id, val)}
                                fieldKey={`subsection-title-${sub.id}`}
                                placeholder="Subsection title"
                                inputStyle={{
                                  fontSize: '13px',
                                  fontWeight: '600',
                                  color: colors.textPrimary
                                }}
                              />

                              <button
                                onClick={() => confirmDeleteSubsection(section.id, sub.id)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  padding: '4px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  color: colors.dangerBtn,
                                  marginLeft: 'auto'
                                }}
                                title="Delete subsection"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>

                            {/* Subsection content */}
                            {!isSubCollapsed && (
                              <div style={{ padding: '12px' }}>
                                <DescriptorBox
                                  value={sub.description}
                                  onChange={val => updateSubsectionDescription(section.id, sub.id, val)}
                                  placeholder="Subsection description…"
                                  fieldKey={`subsection-desc-${sub.id}`}
                                />

                                {/* Topic Boxes Droppable */}
                                <Droppable droppableId={`topicboxes-${sub.id}`} type="TOPICBOX">
                                  {(provided) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.droppableProps}
                                      style={{ minHeight: '20px' }}
                                    >
                                      {(sub.topicBoxes || []).length === 0 ? (
                                        <div style={{
                                          textAlign: 'center',
                                          padding: '20px',
                                          border: '1px solid #e5e7eb',
                                          borderRadius: '8px',
                                          backgroundColor: '#fafafa',
                                          color: colors.textSecondary,
                                          fontSize: '13px',
                                          marginBottom: '12px'
                                        }}>
                                          No topic boxes yet. Click "+ Add Topic Box" or use AI to generate.
                                        </div>
                                      ) : (
                                        (sub.topicBoxes || []).map((topic, topicIdx) => (
                                          <Draggable
                                            key={topic.id}
                                            draggableId={topic.id}
                                            index={topicIdx}
                                          >
                                            {(provided, snapshot) => (
                                              <div
                                                ref={provided.innerRef}
                                                {...provided.draggableProps}
                                                style={{
                                                  ...provided.draggableProps.style,
                                                  opacity: snapshot.isDragging ? 0.9 : 1
                                                }}
                                              >
                                                <TopicBoxRow
                                                  topicBox={topic}
                                                  sectionId={section.id}
                                                  subsectionId={sub.id}
                                                  dragHandleProps={provided.dragHandleProps}
                                                />
                                              </div>
                                            )}
                                          </Draggable>
                                        ))
                                      )}
                                      {provided.placeholder}
                                    </div>
                                  )}
                                </Droppable>

                                {/* Add Topic Box Buttons */}
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <button onClick={() => addTopicBox(section.id, sub.id)} style={{
                                    flex: 1, padding: '8px',
                                    backgroundColor: 'transparent', color: colors.accent,
                                    border: `1px solid ${colors.sectionBorder}`, borderRadius: '6px',
                                    cursor: 'pointer', fontSize: '13px', fontWeight: '600'
                                  }}>
                                    ⊕ Add Topic Box
                                  </button>
                                  
                                  <div style={{ flex: 1 }}>
                                    <AIGenerateButton
                                      level="topics"
                                      context={{
                                        course: {
                                          title: courseName,
                                          grade: formData?.class || ''
                                        },
                                        current_section: {
                                          title: section.title,
                                          description: section.description
                                        },
                                        subsection: {
                                          title: sub.title,
                                          description: sub.description,
                                          existingTopics: (sub.topicBoxes || []).map(t => ({
                                            title: t.title,
                                            description: t.description
                                          }))
                                        }
                                      }}
                                      onGenerate={(params) => handleGenerateTopicBoxes(section.id, sub.id, params)}
                                      count={1}
                                      buttonText="✨ Generate Topic Box"
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      }}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>

            {/* Add Subsection Buttons */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button onClick={() => addSubsection(section.id)} style={{
                flex: 1, padding: '8px',
                backgroundColor: 'transparent', color: colors.accent,
                border: `1px solid ${colors.sectionBorder}`, borderRadius: '6px',
                cursor: 'pointer', fontSize: '13px', fontWeight: '600'
              }}>
                ⊕ Add Subsection
              </button>
              
              <div style={{ flex: 1 }}>
                <AIGenerateButton
                  level="subsections"
                  context={{
                    course: {
                      title: courseName,
                      description: formData?.objectives || '',
                      grade: formData?.class || ''
                    },
                    all_section_names: sections
                      .filter(s => s.type !== 'break')
                      .map(s => s.title),
                    current_section: {
                      title: section.title,
                      description: section.description,
                      existingSubsections: (section.subsections || []).map(sub => ({
                        title: sub.title,
                        description: sub.description
                      }))
                    }
                  }}
                  onGenerate={(params) => handleGenerateSubsections(section.id, params)}
                  count={1}
                  buttonText="✨ Generate Subsection"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─── RENDER ───────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: colors.bg }}>

      {/* Top Bar */}
      <div style={{
        padding: '12px 28px', borderBottom: '1px solid #e5e7eb',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        backgroundColor: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', color: colors.textPrimary }}>🎓 EdCube</h2>
          <input
            type="text" value={courseName}
            onChange={e => setCourseName(e.target.value)}
            style={{
              fontSize: '17px', padding: '6px 12px',
              border: '1px solid #ddd', borderRadius: '6px', minWidth: '280px',
              outline: 'none'
            }}
            onFocus={e => e.target.style.borderColor = colors.accent}
            onBlur={e => e.target.style.borderColor = '#ddd'}
          />
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button onClick={undo} disabled={historyIndex <= 0} style={{
            padding: '7px 14px', backgroundColor: historyIndex <= 0 ? '#e5e7eb' : '#6b7280',
            color: historyIndex <= 0 ? '#9ca3af' : 'white', border: 'none',
            borderRadius: '6px', cursor: historyIndex <= 0 ? 'not-allowed' : 'pointer', fontSize: '13px'
          }}>↶ Undo</button>

          <button onClick={saveCourse} style={{
            padding: '8px 18px', backgroundColor: '#16a34a', color: 'white',
            border: 'none', borderRadius: '6px', cursor: 'pointer',
            fontWeight: '600', fontSize: '14px'
          }}>💾 Save Course</button>

          <span style={{ color: '#6b7280', fontSize: '13px' }}>{currentUser?.displayName}</span>

          <button onClick={() => navigate('/my-courses')} style={{
            padding: '7px 14px', backgroundColor: '#6b7280', color: 'white',
            border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px'
          }}>← My Courses</button>
        </div>
      </div>

      {/* Action bar */}
      <div style={{
        padding: '10px 28px', backgroundColor: 'white',
        borderBottom: '1px solid #f3f4f6',
        display: 'flex', gap: '10px', alignItems: 'center'
      }}>
        <button onClick={addSection} style={{
          padding: '7px 16px', backgroundColor: colors.accent, color: 'white',
          border: 'none', borderRadius: '6px', cursor: 'pointer',
          fontWeight: '600', fontSize: '13px'
        }}>➕ Section</button>

        <button onClick={addBreak} style={{
          padding: '7px 16px', backgroundColor: 'white', color: colors.accent,
          border: `1px solid ${colors.sectionBorder}`, borderRadius: '6px',
          cursor: 'pointer', fontWeight: '600', fontSize: '13px'
        }}>⏸️ Break</button>

        <span style={{ fontSize: '12px', color: '#9ca3af', marginLeft: '12px' }}>
          {sections.filter(s => s.type !== 'break').length} section{sections.filter(s => s.type !== 'break').length !== 1 ? 's' : ''} •{' '}
          {sections.reduce((acc, s) => acc + (s.subsections?.length || 0), 0)} subsections •{' '}
          {sections.reduce((acc, s) => acc + (s.subsections?.reduce((total, sub) => total + (sub.topicBoxes?.length || 0), 0) || 0), 0)} topic boxes
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
            <p style={{ fontSize: '24px', marginBottom: '8px' }}>📚</p>
            <p style={{ fontSize: '16px', color: colors.textPrimary, fontWeight: '600', margin: '0 0 4px' }}>No sections yet</p>
            <p style={{ fontSize: '14px', color: colors.textSecondary, margin: 0 }}>Click "+ Section" above to start building your course</p>
          </div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="all-sections" type="SECTION">
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                >
                  {sections.map((section, idx) => (
                    <Draggable
                      key={section.id}
                      draggableId={section.id}
                      index={idx}
                    >
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          style={{
                            ...provided.draggableProps.style,
                            opacity: snapshot.isDragging ? 0.8 : 1
                          }}
                        >
                          <SectionBlock 
                            section={section} 
                            index={idx}
                            dragHandleProps={provided.dragHandleProps}
                          />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}

        {/* Generate More Sections */}
        {sections.length > 0 && (
          <div style={{ marginTop: '20px' }}>
            <AIGenerateButton
              level="sections"
              context={{
                course: {
                  title: courseName,
                  description: formData?.objectives || '',
                  grade: formData?.class || '',
                  subject: formData?.subject || '',
                  duration: formData?.timeDuration ? `${formData.timeDuration} ${formData.timeUnit}` : ''
                },
                existing_sections: sections.filter(s => s.type !== 'break').map(s => ({
                  title: s.title,
                  description: s.description
                }))
              }}
              onGenerate={handleGenerateSections}
              count={1}
              buttonText="✨ Generate More Sections with AI"
            />
          </div>
        )}
      </div>

      {/* Modals */}
      <ConfirmDialog
        isOpen={deleteConfirm !== null}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirm(null)}
        title={deleteConfirm?.title || ''}
        message={deleteConfirm?.message || ''}
      />

      {isModalOpen && selectedTopic && (
        <TopicDetailsModal topic={selectedTopic} onClose={() => { setIsModalOpen(false); setSelectedTopic(null); }} />
      )}

      {showBreakModal && (
        <BreakModal onConfirm={handleBreakCreate} onCancel={() => setShowBreakModal(false)} />
      )}

      {showCoursePicker && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#fff', borderRadius: '12px', width: '480px',
            maxHeight: '60vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
          }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: colors.textPrimary }}>Open a Course</h3>
              <button onClick={() => navigate('/my-courses')} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#888' }}>✕</button>
            </div>
            <div style={{ padding: '16px 24px 24px', overflowY: 'auto', flex: 1 }}>
              {pickerLoading && <p style={{ color: '#888', textAlign: 'center', padding: '24px 0' }}>Loading…</p>}
              {!pickerLoading && pickerCourses.length === 0 && (
                <div style={{ textAlign: 'center', padding: '32px 0', color: '#888' }}>
                  <p>No courses yet.</p>
                  <button onClick={() => navigate('/course-designer')} style={{ padding: '8px 18px', backgroundColor: colors.accent, color: colors.textPrimary, border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Create a New Course</button>
                </div>
              )}
              {!pickerLoading && pickerCourses.map(course => (
                <button key={course.courseId || course.id} onClick={() => handlePickCourse(course)} style={{
                  width: '100%', textAlign: 'left', padding: '12px 14px', marginBottom: '8px',
                  backgroundColor: '#fafafa', border: '1px solid #e8e8e8', borderRadius: '8px', cursor: 'pointer'
                }}>
                  <div style={{ fontWeight: '600', fontSize: '15px', color: colors.textPrimary }}>{course.courseName || 'Untitled'}</div>
                  <div style={{ fontSize: '13px', color: '#888' }}>{course.class || ''}{course.subject ? ` • ${course.subject}` : ''}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CourseWorkspace;