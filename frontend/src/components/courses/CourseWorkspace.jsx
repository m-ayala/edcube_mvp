// src/components/courses/CourseWorkspace.jsx
import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import TopicDetailsModal from '../modals/TopicDetailsModal';
import BreakModal from '../modals/BreakModal';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { GripVertical, Edit2, Check, Trash2 } from 'lucide-react';

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

  // ─── Mount: hydrate video + hands-on caches from saved subsections ───
  useEffect(() => {
    console.log('📦 CourseWorkspace loaded with:', {
      courseName,
      sectionsCount: sections.length,
      isEditing,
      curriculumId
    });

    const loadedVideos = {};
    const loadedHandsOn = {};

    sections.forEach(section => {
      (section.subsections || []).forEach(sub => {
        if (sub.video_resources && sub.video_resources.length > 0) {
          loadedVideos[sub.id] = sub.video_resources;
        }
        const resources = [
          ...(sub.worksheets || []),
          ...(sub.activities || [])
        ];
        if (resources.length > 0) {
          loadedHandsOn[sub.id] = resources;
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
  }, []);

  // ─── Drag and Drop Handler ────────────────────────────────────────────
  const handleDragEnd = (result) => {
    const { source, destination, type } = result;

    if (!destination) return;

    // If dropped in the same position, do nothing
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    // Handle SECTION reordering (including breaks)
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

    // Handle TOPIC BOX reordering (topic boxes include resources and hands-on as one unit)
    if (type === 'TOPICBOX') {
      const sourceSubId = source.droppableId.replace('topicbox-', '');
      const destSubId = destination.droppableId.replace('topicbox-', '');

      // Since each subsection is essentially one topic box, we're moving the entire subsection
      // This allows topic boxes to move across subsections and sections
      
      // Find source section and subsection
      let sourceSection = null;
      let sourceSub = null;
      let sourceSubIndex = -1;
      
      for (const section of sections) {
        const subIndex = (section.subsections || []).findIndex(sub => sub.id === sourceSubId);
        if (subIndex !== -1) {
          sourceSection = section;
          sourceSub = section.subsections[subIndex];
          sourceSubIndex = subIndex;
          break;
        }
      }

      // Find destination section and subsection
      let destSection = null;
      let destSubIndex = -1;
      
      for (const section of sections) {
        const subIndex = (section.subsections || []).findIndex(sub => sub.id === destSubId);
        if (subIndex !== -1) {
          destSection = section;
          destSubIndex = subIndex;
          break;
        }
      }

      if (!sourceSection || !sourceSub || !destSection) return;

      // If moving within the same subsection area (same destination), do nothing
      if (sourceSubId === destSubId) return;

      // Remove from source
      const updatedSections = sections.map(section => {
        if (section.id === sourceSection.id) {
          return {
            ...section,
            subsections: section.subsections.filter(sub => sub.id !== sourceSubId)
          };
        }
        return section;
      });

      // Add to destination - insert after the destination subsection
      const finalSections = updatedSections.map(section => {
        if (section.id === destSection.id) {
          const newSubsections = [...section.subsections];
          newSubsections.splice(destSubIndex + 1, 0, sourceSub);
          return {
            ...section,
            subsections: newSubsections
          };
        }
        return section;
      });

      setSections(finalSections);
      return;
    }
  };

  // ─── Course Picker ────────────────────────────────────────────────────
  const handlePickCourse = (curriculum) => {
    const transformed = (curriculum.outline?.sections || curriculum.sections || []).map(section => ({
      id: section.id,
      title: section.title,
      description: section.description || '',
      subsections: (section.subsections || []).map(sub => ({
        id: sub.id,
        title: sub.title,
        description: sub.description || '',
        duration_minutes: sub.duration_minutes || 0,
        pla_pillars: sub.pla_pillars || [],
        learning_objectives: sub.learning_objectives || [],
        content_keywords: sub.content_keywords || [],
        what_must_be_covered: sub.what_must_be_covered || '',
        video_resources: sub.video_resources || [],
        worksheets: sub.worksheets || [],
        activities: sub.activities || []
      }))
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

  // ─── Section / Subsection CRUD ────────────────────────────────────────
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
          duration_minutes: 15,
          pla_pillars: [],
          learning_objectives: [],
          content_keywords: [],
          what_must_be_covered: '',
          video_resources: [],
          worksheets: [],
          activities: []
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

  const toggleSection = (sectionId) => {
    setCollapsedSections(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };
  const toggleSubsection = (subId) => {
      setCollapsedSubsections(prev => ({ ...prev, [subId]: !prev[subId] }));
    };

  // Delete handlers with confirmation
  const confirmDeleteSection = (sectionId) => {
    const section = sections.find(s => s.id === sectionId);
    setDeleteConfirm({
      type: 'section',
      id: sectionId,
      title: 'Delete Section?',
      message: `Are you sure you want to delete "${section?.title || 'this section'}"? This will also delete all subsections and resources within it.`
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
      message: `Are you sure you want to delete "${subsection?.title || 'this subsection'}"? This will also delete all resources within it.`
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

  // ─── Topic Details Modal ──────────────────────────────────────────────
  const handleTopicClick = (sub) => {
    setSelectedTopic(sub);
    setIsModalOpen(true);
  };

  // ─── Video Generation ─────────────────────────────────────────────────
  const generateVideosFromBackend = async (subsection) => {
    try {
      console.log('🎬 Generating videos for:', subsection.title);
      const response = await fetch('http://localhost:8000/api/generate-videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicId: subsection.id,
          topicTitle: subsection.title,
          topicData: {
            title: subsection.title,
            duration: `${subsection.duration_minutes} min`,
            description: subsection.description,
            learningObjectives: subsection.learning_objectives || [],
            subtopics: subsection.content_keywords || [],
            subject: formData.subject,
            courseName: formData.courseName,
            courseTopic: formData.topic
          },
          sectionId: subsection.id,
          gradeLevel: formData.class,
          courseId: curriculumId || 'new-course'
        })
      });
      const result = await response.json();
      if (result.success) {
        setVideosByTopic(prev => ({ ...prev, [subsection.id]: result.videos }));
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
  const generateResource = async (subsectionId, resourceType) => {
    const allSubs = sections.flatMap(s => s.subsections || []);
    const sub = allSubs.find(s => s.id === subsectionId);
    if (!sub) return;

    try {
      console.log(`🔨 Generating ${resourceType} for:`, sub.title);
      const response = await fetch('http://localhost:8000/api/generate-resource', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicId: subsectionId,
          resourceType,
          gradeLevel: formData.class,
          topicTitle: sub.title,
          topicDescription: sub.description || '',
          learningObjectives: sub.learning_objectives || []
        })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const resource = await response.json();
      console.log(`✅ ${resourceType} generated:`, resource);
      setHandsOnResources(prev => ({
        ...prev,
        [subsectionId]: [...(prev[subsectionId] || []), resource]
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
          video_resources: videosByTopic[sub.id] || sub.video_resources || [],
          worksheets: handsOnResources[sub.id]?.filter(r => r.type === 'worksheet') || sub.worksheets || [],
          activities: handsOnResources[sub.id]?.filter(r => r.type === 'activity') || sub.activities || []
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
    bg: '#f5f3ff',
    card: '#ffffff',
    sectionBorder: '#c4b5fd',
    sectionBg: '#ede9fe',
    subBorder: '#a78bfa',
    accent: '#7c3aed',
    accentLight: '#ddd6fe',
    textPrimary: '#1e1b4b',
    textSecondary: '#6b7280',
    pillBg: '#ede9fe',
    pillText: '#7c3aed',
    videoBtn: '#dc2626',
    worksheetBtn: '#2563eb',
    activityBtn: '#16a34a',
    dangerBtn: '#ef4444'
  };

  // ─── SUB-COMPONENTS (inline, scoped) ──────────────────────────────────

  // Pill tag
  const Pill = ({ label, color }) => (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: '12px',
      fontSize: '11px',
      fontWeight: '600',
      backgroundColor: color?.bg || colors.pillBg,
      color: color?.text || colors.pillText
    }}>
      {label}
    </span>
  );

  // Small icon button (trash / collapse)
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

  // Editable field with click-to-edit functionality
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

  // Descriptor box (editable description area)
  const DescriptorBox = ({ value, onChange, placeholder, fieldKey }) => (
    <div style={{
      border: '2px dashed #c4b5fd',
      borderRadius: '8px',
      padding: '10px 14px',
      marginBottom: '12px',
      backgroundColor: '#faf5ff',
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

  // Confirmation dialog for deletions
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

  // ─── 3-col row for one subsection (TOPIC BOX) ─────────────────────────
  const SubsectionRow = ({ sub, sectionId, dragHandleProps }) => {
    const videos = videosByTopic[sub.id] || [];
    const worksheets = (handsOnResources[sub.id] || []).filter(r => r.type === 'worksheet');
    const activities = (handsOnResources[sub.id] || []).filter(r => r.type === 'activity');

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
        position: 'relative'
      }}>
        {/* Drag handle for entire topic box */}
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

        {/* ── Col 1: Topic Name ── */}
        <div style={{ padding: '14px', borderRight: '1px solid #f3f4f6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
            <p style={{ margin: 0, fontWeight: '600', fontSize: '14px', color: colors.textPrimary, cursor: 'pointer', flex: 1, paddingLeft: '24px' }}
              onClick={() => handleTopicClick(sub)}
            >
              {sub.title}
            </p>
            <button
              onClick={() => confirmDeleteSubsection(sectionId, sub.id)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
                color: colors.dangerBtn
              }}
              title="Delete subsection"
            >
              <Trash2 size={14} />
            </button>
          </div>

          {(sub.learning_objectives || []).length > 0 && (
            <ul style={{ margin: '8px 0 8px 24px', paddingLeft: '16px', fontSize: '12px', color: colors.textSecondary }}>
              {sub.learning_objectives.map((obj, i) => (
                <li key={i} style={{ marginBottom: '2px' }}>{obj}</li>
              ))}
            </ul>
          )}

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px', paddingLeft: '24px' }}>
            <Pill label={`${sub.duration_minutes || 0} min`} color={{ bg: '#f3e8ff', text: '#7c3aed' }} />
            <Pill label={(sub.pla_pillars || [])[0] || 'Knowledge'} />
          </div>
        </div>

        {/* ── Col 2: Video Resources ── */}
        <div style={{ padding: '14px', borderRight: '1px solid #f3f4f6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <p style={{ margin: 0, fontSize: '12px', fontWeight: '600', color: colors.textSecondary }}>📹 Resources</p>
            {videos.length > 0 && (
              <button onClick={() => generateVideosFromBackend(sub)} style={{
                padding: '3px 8px', backgroundColor: 'transparent', color: colors.videoBtn,
                border: `1px solid ${colors.videoBtn}`, borderRadius: '4px',
                cursor: 'pointer', fontSize: '11px', fontWeight: '600'
              }}>↻ Redo</button>
            )}
          </div>

          {videos.length === 0 ? (
            <button onClick={() => generateVideosFromBackend(sub)} style={{
              width: '100%', padding: '8px', backgroundColor: colors.videoBtn,
              color: 'white', border: 'none', borderRadius: '6px',
              cursor: 'pointer', fontSize: '13px', fontWeight: '600'
            }}>
              🎬 Generate Videos
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
                <Pill label={`${videos.length} video${videos.length > 1 ? 's' : ''}`} color={{ bg: '#fef2f2', text: '#dc2626' }} />
              </div>
            </div>
          )}

          <div style={{ marginTop: '10px' }}>
            <Pill label={`${sub.duration_minutes || 0} min`} color={{ bg: '#f3e8ff', text: '#7c3aed' }} />
            {(sub.pla_pillars || [])[0] && <Pill label={(sub.pla_pillars || [])[0]} />}
          </div>
        </div>

        {/* ── Col 3: Hands-On Resources ── */}
        <div style={{ padding: '14px' }}>
          <p style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: '600', color: colors.textSecondary }}>📝 Hands-On resources</p>

          {/* Worksheets */}
          <div style={{ marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <p style={{ margin: 0, fontSize: '11px', color: colors.textSecondary }}>📄 Worksheets</p>
              <button onClick={() => generateResource(sub.id, 'worksheet')} style={{
                padding: '2px 8px', backgroundColor: colors.worksheetBtn,
                color: 'white', border: 'none', borderRadius: '4px',
                cursor: 'pointer', fontSize: '11px', fontWeight: '600'
              }}>+ Add</button>
            </div>
            {worksheets.length === 0 ? (
              <p style={{ fontSize: '11px', color: '#9ca3af', fontStyle: 'italic', margin: '4px 0' }}>None yet</p>
            ) : worksheets.map((ws, i) => (
              <div key={i} style={{ padding: '5px 8px', marginBottom: '4px', backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '4px' }}>
                <p style={{ margin: 0, fontSize: '12px', fontWeight: '500', color: colors.textPrimary }}>{ws.title}</p>
                {ws.sourceUrl && <a href={ws.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: colors.worksheetBtn }}>View Source</a>}
              </div>
            ))}
          </div>

          {/* Activities */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <p style={{ margin: 0, fontSize: '11px', color: colors.textSecondary }}>🎯 Activities</p>
              <button onClick={() => generateResource(sub.id, 'activity')} style={{
                padding: '2px 8px', backgroundColor: colors.activityBtn,
                color: 'white', border: 'none', borderRadius: '4px',
                cursor: 'pointer', fontSize: '11px', fontWeight: '600'
              }}>+ Add</button>
            </div>
            {activities.length === 0 ? (
              <p style={{ fontSize: '11px', color: '#9ca3af', fontStyle: 'italic', margin: '4px 0' }}>None yet</p>
            ) : activities.map((act, i) => (
              <div key={i} style={{ padding: '5px 8px', marginBottom: '4px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '4px' }}>
                <p style={{ margin: '0 0 2px', fontSize: '12px', fontWeight: '500', color: colors.textPrimary }}>{act.title}</p>
                <p style={{ margin: 0, fontSize: '11px', color: colors.textSecondary }}>{act.description}</p>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '10px' }}>
            <Pill label={`${sub.duration_minutes || 0} min`} color={{ bg: '#f3e8ff', text: '#7c3aed' }} />
            {(sub.pla_pillars || [])[0] && <Pill label={(sub.pla_pillars || [])[0]} />}
          </div>
        </div>
      </div>
    );
  };

  // ─── Full Section block ───────────────────────────────────────────────
  const SectionBlock = ({ section, index, dragHandleProps }) => {
    if (section.type === 'break') {
      return (
        <div style={{
          padding: '12px 16px', marginBottom: '16px',
          backgroundColor: '#fff3cd', border: '1px dashed #ffc107',
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
        border: `2px solid ${colors.sectionBorder}`,
        borderRadius: '12px',
        marginBottom: '20px',
        backgroundColor: colors.card,
        overflow: 'hidden'
      }}>
        {/* Section header row */}
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
            {/* Section descriptor box */}
            <DescriptorBox
              value={section.description}
              onChange={val => updateSectionDescription(section.id, val)}
              placeholder="Section description…"
              fieldKey={`section-desc-${section.id}`}
            />

            {/* Subsections droppable area */}
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
                              {/* Subsection header with collapse button */}
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

                              {/* Collapsible content */}
                              {!isSubCollapsed && (
                                <div style={{ padding: '12px' }}>
                                  {/* Subsection descriptor box */}
                                  <DescriptorBox
                                    value={sub.description}
                                    onChange={val => updateSubsectionDescription(section.id, sub.id, val)}
                                    placeholder="Subsection description…"
                                    fieldKey={`subsection-desc-${sub.id}`}
                                  />

                                  {/* Droppable area for topic box */}
                                  <Droppable droppableId={`topicbox-${sub.id}`} type="TOPICBOX">
                                    {(provided) => (
                                      <div
                                        ref={provided.innerRef}
                                        {...provided.droppableProps}
                                      >
                                        <Draggable
                                          draggableId={`topicbox-${sub.id}`}
                                          index={0}
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
                                              {/* 3-column topic row */}
                                              <SubsectionRow 
                                                sub={sub} 
                                                sectionId={section.id}
                                                dragHandleProps={provided.dragHandleProps}
                                              />
                                            </div>
                                          )}
                                        </Draggable>
                                        {provided.placeholder}
                                      </div>
                                    )}
                                  </Droppable>
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

            {/* + Add Subsection button */}
            <button onClick={() => addSubsection(section.id)} style={{
              width: '100%', padding: '8px', marginTop: '4px',
              backgroundColor: 'transparent', color: colors.accent,
              border: `1px dashed ${colors.sectionBorder}`, borderRadius: '6px',
              cursor: 'pointer', fontSize: '13px', fontWeight: '600'
            }}>
              ⊕ Add Subsection
            </button>
          </div>
        )}
      </div>
    );
  };

  // ─── RENDER ───────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: colors.bg }}>

      {/* ── Top Bar ── */}
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

      {/* ── Action bar: + Section / + Break ── */}
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
          border: `1px dashed ${colors.sectionBorder}`, borderRadius: '6px',
          cursor: 'pointer', fontWeight: '600', fontSize: '13px'
        }}>⏸️ Break</button>

        <span style={{ fontSize: '12px', color: '#9ca3af', marginLeft: '12px' }}>
          {sections.filter(s => s.type !== 'break').length} section{sections.filter(s => s.type !== 'break').length !== 1 ? 's' : ''} •{' '}
          {sections.reduce((acc, s) => acc + (s.subsections?.length || 0), 0)} subsections
        </span>
      </div>

      {/* ── Main scrollable content ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
        {sections.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '80px 20px',
            border: '2px dashed #c4b5fd', borderRadius: '16px',
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
      </div>  

      {/* ── Modals ── */}
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
                  <button onClick={() => navigate('/course-designer')} style={{ padding: '8px 18px', backgroundColor: '#c4b5fd', color: colors.textPrimary, border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Create a New Course</button>
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