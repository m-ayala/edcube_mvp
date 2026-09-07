// src/components/courses/CourseWorkspace.jsx
import { useState, useEffect, useRef, useMemo } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import { ChevronLeft, Undo2, Check as CheckIcon, ToggleLeft, ToggleRight, Share2, Info, Sparkles } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import CourseEditor, { EditableField } from './CourseEditor';
import CourseViewer from './CourseViewer';
import SubsectionView from './SubsectionView';
import BlockView from './BlockView';
import SubsectionSelectionMatrix from './SubsectionSelectionMatrix';
import ContentLibraryPanel from './ContentLibraryPanel';
import EdoChatbot from './EdoChatbot';
import CourseInfoPanel from './CourseInfoPanel';
import useCourseActions from './useCourseActions';
import useAutosave from './useAutosave';
import { useGeneration } from '../../contexts/GenerationContext';
import BreakModal from '../modals/BreakModal';
import ShareCourseModal from '../modals/ShareCourseModal';
import { getOwnProfile } from '../../services/teacherService';
import { generateBlockLinks } from '../../utils/curriculumApi';
import { addCourseToFolder } from '../../firebase/dbService';
import { trackCourseCreated, trackCourseUpdated, trackPublicCourseViewed } from '../../firebase/analytics';

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
    targetFolderId,
    handsOnResources: incomingHandsOnResources,
    isGenerating: incomingIsGenerating,
    isSelectingSubsections: incomingIsSelectingSubsections,
  } = location.state || {};

  const { genState, submitSelectionsAndGenerateBlocks, clearGeneration } = useGeneration();
  const [isGenerating, setIsGenerating] = useState(!!incomingIsGenerating);
  const [isSelectingSubsections, setIsSelectingSubsections] = useState(!!incomingIsSelectingSubsections);

  const [curriculumId, setCurriculumId] = useState(initialCurriculumId);

  // ── Core State ────────────────────────────────────────────────────────
  const [courseName, setCourseName] = useState(formData?.courseName || '');
  const [courseClass, setCourseClass] = useState(formData?.class || '');
  const [courseTimeDuration, setCourseTimeDuration] = useState(formData?.timeDuration || '');
  const [courseObjectives, setCourseObjectives] = useState(formData?.objectives || '');
  const [courseDescription, setCourseDescription] = useState(formData?.courseDescription || '');
  const [synopsis, setSynopsis] = useState(formData?.synopsis || '');
  const [sections, setSections] = useState(incomingSections || []);
  const [showBreakModal, setShowBreakModal] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [videosByTopic, setVideosByTopic] = useState({});
  const [handsOnResources, setHandsOnResources] = useState(incomingHandsOnResources || {});
  const [organizationId, setOrganizationId] = useState(null);
  const [isPublic, setIsPublic] = useState(incomingIsPublic || false);
  const [readOnly] = useState(incomingReadOnly || false);
  const [isOwner] = useState(incomingIsOwner || false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [isEdoOpen, setIsEdoOpen] = useState(false);
  const [showCourseInfo, setShowCourseInfo] = useState(false);
  const [courseAttachments, setCourseAttachments] = useState([]);
  const [courseInfoNotes, setCourseInfoNotes] = useState('');
  const [trayItems, setTrayItems] = useState([]);
  const [linkGenJobs, setLinkGenJobs] = useState({}); // { [blockId]: 'generating'|'done'|'error' }

  // Phase 1.5 redesign (TASK-002/003/004) — content library + day lanes view.
  // Local feature flag only: gates the new panel alongside the existing
  // CourseEditor render so the current flow keeps working untouched when off.
  const [showLibraryView, setShowLibraryView] = useState(false);

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
    console.log('[generateLinksForBlock] START', { blockId, subsectionId, blockType: blockData?.type });
    setLinkGenJobs(prev => ({ ...prev, [blockId]: 'generating' }));
    console.log('[generateLinksForBlock] state set to generating');
    try {
      const payload = {
        blockType: blockData.type || 'content',
        blockTitle: blockData.title || '',
        blockContent: blockData.content || '',
        topicTitle: activeSubsection?.title || '',
        topicDescription: activeSubsection?.description || '',
        subject: formData?.subject || '',
        topic: formData?.topic || '',
        gradeLevel: formData?.class || '',
        teacherUid: currentUser?.uid || null,
      };
      console.log('[generateLinksForBlock] sending payload to backend:', payload);
      let raw;
      try {
        raw = await generateBlockLinks(payload);
        console.log('[generateLinksForBlock] raw response from backend:', raw);
      } catch (fetchErr) {
        console.error('[generateLinksForBlock] fetch/parse error:', fetchErr);
        throw fetchErr;
      }
      const { links: generated } = raw;
      console.log('[generateLinksForBlock] links count:', generated?.length, 'links:', generated);
      if (generated?.length > 0) {
        const existing = (handsOnResources[subsectionId] || [])
          .find(b => b.id === blockId)?.links || [];
        const merged = [
          ...existing,
          ...generated.map(l => ({ id: `link-${Date.now()}-${Math.random().toString(36).slice(2)}`, ...l })),
        ];
        actions.updateBlock(subsectionId, blockId, { links: merged });
        setLinkGenJobs(prev => ({ ...prev, [blockId]: 'done' }));
      } else {
        setLinkGenJobs(prev => ({ ...prev, [blockId]: 'empty' }));
      }
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

  // ── Fetch course info (attachments + notes) once curriculumId is known ─
  useEffect(() => {
    if (!curriculumId || curriculumId === 'new-course' || !currentUser) return;
    const fetchCourseInfo = async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_BASE_URL}/api/curricula/${curriculumId}?teacherUid=${currentUser.uid}`
        );
        if (!res.ok) return;
        const data = await res.json();
        setCourseAttachments(data.courseAttachments || []);
        setCourseInfoNotes(data.courseInfoNotes || '');
      } catch (e) {
        console.error('Failed to fetch course info:', e);
      }
    };
    fetchCourseInfo();
  }, [curriculumId, currentUser]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handle Phase 1.5 selection submission ─────────────────────────────
  const handleSelectionSubmit = (selections) => {
    // Merge the teacher-approved subsections into the visible outline immediately
    // so CourseEditor can show "Generating…" badges while Stage 2 streams in.
    const selectionsBySection = {};
    selections.forEach(sel => {
      selectionsBySection[sel.sectionId] = [...(selectionsBySection[sel.sectionId] || []), sel];
    });
    const order = { Basics: 0, Intermediate: 1, Advanced: 2 };
    setSections(prev => prev.map(section => {
      const sels = (selectionsBySection[section.id] || [])
        .slice()
        .sort((a, b) => (order[a.depthLevel] ?? 9) - (order[b.depthLevel] ?? 9));
      return {
        ...section,
        subsections: sels.map(sel => ({
          id: sel.subsectionId,
          title: sel.title,
          description: sel.description,
          core_concept: sel.coreConcept,
          depth_level: sel.depthLevel,
          prerequisite_subsection_id: sel.prerequisiteSubsectionId,
          chain_id: sel.chainId,
          duration_minutes: sel.durationMinutes,
          learning_objectives: sel.learningObjectives,
        })),
      };
    }));

    setIsSelectingSubsections(false);
    setIsGenerating(true);
    submitSelectionsAndGenerateBlocks(selections);
  };

  // ── Subscribe to live generation updates ─────────────────────────────
  useEffect(() => {
    if (!isGenerating) return;
    if (genState.status === 'generating-blocks' || genState.status === 'outline-ready') {
      // Merge newly arrived subsection blocks without overwriting manual edits
      setHandsOnResources(prev => ({ ...prev, ...genState.handsOnResources }));
    }
    if (genState.status === 'complete') {
      if (genState.curriculumId) setCurriculumId(genState.curriculumId);
      setHandsOnResources(prev => ({ ...prev, ...genState.handsOnResources }));
      setIsGenerating(false);
      if (targetFolderId && genState.curriculumId) {
        addCourseToFolder(currentUser.uid, targetFolderId, genState.curriculumId).catch(() => {});
      }
    }
    if (genState.status === 'error') {
      setIsGenerating(false);
    }
  }, [genState.status, genState.handsOnResources, genState.curriculumId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mount: Transform old data (topicBoxes) → new flat structure ───────
  useEffect(() => {
    console.log('📦 CourseWorkspace loaded');
    if (readOnly && !isOwner && initialCurriculumId) {
      trackPublicCourseViewed({ course_id: initialCurriculumId, courseName, grade: courseClass });
    }

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
              // Preserve the "suggested" origin tag (set when an Edo tray item is
              // merged in — see handleDragEnd) across this migration/hydration pass.
              ...(sub.source ? { source: sub.source } : {}),
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
            ...(sub.source ? { source: sub.source } : {}),
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
        // "Suggested" origin tag (content library badge) — additive field, backend
        // stores/returns curricula.sections as a passthrough dict so this survives
        // save/reload without needing a schema change.
        ...(sub.source ? { source: sub.source } : {}),
      }))
    }));

    const courseData = {
      courseName,
      subject: formData?.subject || '',
      topic: formData?.topic || '',
      class: courseClass,
      timeDuration: courseTimeDuration,
      objectives: courseObjectives,
      courseDescription,
      synopsis,
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
      if (targetFolderId) {
        await addCourseToFolder(currentUser.uid, targetFolderId, result.courseId);
      }
      const totalDuration = sectionsForSave.reduce((acc, s) =>
        acc + (s.subsections || []).reduce((a, ss) => a + (ss.duration_minutes || 0), 0), 0);
      trackCourseCreated({ courseName, subject: formData?.subject || '', grade: courseClass, sections_count: sections.length, duration_minutes: totalDuration });
    } else if (hasExistingId) {
      trackCourseUpdated({ course_id: curriculumId, sections_count: sections.length });
    }
  };

  // ── Embed blocks into sections for navigation state ─────────────────
  const sectionsWithBlocks = () => sections.map(section => ({
    ...section,
    subsections: (section.subsections || []).map(sub => ({
      ...sub, // includes sub.source (suggested badge tag) if present, unchanged
      content_blocks: (handsOnResources[sub.id] || []).filter(r => r.type === 'content'),
      worksheets:     (handsOnResources[sub.id] || []).filter(r => r.type === 'worksheet'),
      activities:     (handsOnResources[sub.id] || []).filter(r => r.type === 'activity'),
      video_resources: videosByTopic[sub.id] || [],
    }))
  }));

  // ── Back to Course View ───────────────────────────────────────────────
  const updatedFormData = () => ({
    ...formData,
    courseName,
    class: courseClass,
    timeDuration: courseTimeDuration,
    objectives: courseObjectives,
    courseDescription,
    synopsis,
  });

  const handleBack = () => {
    navigate('/course-view', {
      state: {
        formData: updatedFormData(),
        sections: sectionsWithBlocks(),
        curriculumId,
        isPublic,
        isOwner,
        ownerName: incomingOwnerName,
        isCollaborator: incomingIsCollaborator || false,
      }
    });
  };

  // ── Back to Phase 1 (course generation) from the Phase 1.5 selection screen ──
  // Nothing has been saved yet at this point, so there's no course to view —
  // just return to the generation form. Clears the in-flight candidates so a
  // fresh Phase 1 run starts clean.
  const handleBackToGeneration = () => {
    clearGeneration();
    navigate('/course-designer');
  };

  const handleEditInWorkspace = () => {
    navigate('/course-workspace', {
      state: {
        formData: updatedFormData(),
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
        formData: updatedFormData(),
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
    enabled: !!organizationId && !!currentUser && !readOnly && !isGenerating && !isSelectingSubsections
  });

  // ── Drag and Drop ──────────────────────────────��──────────────────────
  // ── Redesigned top-bar pill styles (Figma "Edit workspace") ──────────
  const pillStyle = (variant, disabled = false) => {
    const base = {
      display: 'flex', alignItems: 'center', gap: '6px',
      height: '34px', padding: '0 12px', borderRadius: '10px',
      background: '#FFFFFF', cursor: disabled ? 'not-allowed' : 'pointer',
      fontFamily: "'DM Sans', sans-serif", fontSize: '13.5px', fontWeight: '500',
      whiteSpace: 'nowrap', flexShrink: 0, opacity: disabled ? 0.5 : 1,
    };
    if (variant === 'pink') return { ...base, border: '1px solid #eecff8', color: '#954baf' };
    if (variant === 'blueActive') return { ...base, border: '1px solid #3e62bc', color: '#3e62bc', background: '#f2f5ff' };
    if (variant === 'plain') return { ...base, border: '1px solid rgba(0,0,0,0.12)', color: '#333' };
    return { ...base, border: '1px solid #dce6ff', color: '#3e62bc' }; // blue
  };

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
        // Tag origin so the content library panel can show a "Suggested" badge —
        // there's no persistent source/origin field on subsections today, so this
        // is the one place we can reliably stamp it: the moment an Edo-suggested
        // subsection (previously only living in transient trayItems) gets merged
        // into the real sections[] state.
        actions.insertSubsectionAt(sectionId, { ...trayItem.data, source: 'edo-suggested' }, destination.index);
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
      const sourceSectionId = source.droppableId.replace('subsections-', '');
      const destSectionId = destination.droppableId.replace('subsections-', '');

      if (sourceSectionId === destSectionId) {
        const section = sections.find(s => s.id === sourceSectionId);
        if (section && section.subsections) {
          const reordered = Array.from(section.subsections);
          const [moved] = reordered.splice(source.index, 1);
          reordered.splice(destination.index, 0, moved);
          setSections(sections.map(s =>
            s.id === sourceSectionId ? { ...s, subsections: reordered } : s
          ));
        }
      } else {
        const sourceSection = sections.find(s => s.id === sourceSectionId);
        const destSection = sections.find(s => s.id === destSectionId);
        if (sourceSection && destSection) {
          const sourceSubs = Array.from(sourceSection.subsections || []);
          const destSubs = Array.from(destSection.subsections || []);
          const [moved] = sourceSubs.splice(source.index, 1);
          destSubs.splice(destination.index, 0, moved);
          setSections(sections.map(s => {
            if (s.id === sourceSectionId) return { ...s, subsections: sourceSubs };
            if (s.id === destSectionId) return { ...s, subsections: destSubs };
            return s;
          }));
        }
      }
      return;
    }

    if (type === 'BLOCK') {
      const sourceSubId = source.droppableId.replace('blocks-', '');
      const destSubId = destination.droppableId.replace('blocks-', '');
      if (sourceSubId === destSubId) {
        const currentBlocks = [...(handsOnResources[sourceSubId] || [])];
        const [movedBlock] = currentBlocks.splice(source.index, 1);
        currentBlocks.splice(destination.index, 0, movedBlock);
        setHandsOnResources(prev => ({ ...prev, [sourceSubId]: currentBlocks }));
      } else {
        const sourceBlocks = [...(handsOnResources[sourceSubId] || [])];
        const destBlocks = [...(handsOnResources[destSubId] || [])];
        const [movedBlock] = sourceBlocks.splice(source.index, 1);
        destBlocks.splice(destination.index, 0, movedBlock);
        setHandsOnResources(prev => ({
          ...prev,
          [sourceSubId]: sourceBlocks,
          [destSubId]: destBlocks,
        }));
      }
      return;
    }

    // SubsectionView: reorder content blocks within the left column
    if (type.startsWith('CONTENT_COL_')) {
      const subId = source.droppableId.replace('content-col-', '');
      const allBlocks = [...(handsOnResources[subId] || [])];
      const contentBlocks = allBlocks.filter(b => b.type === 'content');
      const others = allBlocks.filter(b => b.type !== 'content');
      const [moved] = contentBlocks.splice(source.index, 1);
      contentBlocks.splice(destination.index, 0, moved);
      setHandsOnResources(prev => ({ ...prev, [subId]: [...contentBlocks, ...others] }));
      return;
    }

    // SubsectionView: move a linked worksheet/activity between content block groups
    if (type.startsWith('LINKED_')) {
      const subId = type.replace('LINKED_', '');
      const srcContentBlockId = source.droppableId.replace('linked-col-', '');
      const dstContentBlockId = destination.droppableId.replace('linked-col-', '');
      if (srcContentBlockId === dstContentBlockId) return; // same group, no-op (single item per slot)

      // Update parentContentBlockId on the moved block
      const blocks = [...(handsOnResources[subId] || [])];
      const blockIdx = blocks.findIndex(b => b.id === draggableId);
      if (blockIdx === -1) return;
      let updatedBlock;
      if (dstContentBlockId === 'unlinked') {
        // Dropping into the unlinked zone removes the parent link
        const { parentContentBlockId: _removed, ...rest } = blocks[blockIdx];
        updatedBlock = rest;
      } else {
        updatedBlock = { ...blocks[blockIdx], parentContentBlockId: dstContentBlockId };
      }
      const newBlocks = [...blocks];
      newBlocks[blockIdx] = updatedBlock;
      setHandsOnResources(prev => ({ ...prev, [subId]: newBlocks }));
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
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#FFFFFF' }}>
          <style>{`
            @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
            @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          `}</style>

          {/* ── Generation progress banner ── */}
          {isGenerating && (
            <div style={{
              padding: '8px 28px', display: 'flex', alignItems: 'center', gap: '10px',
              background: 'linear-gradient(90deg, #ebf8ff 0%, #e0f7ef 100%)',
              borderBottom: '1px solid rgba(66,153,225,0.2)', flexShrink: 0,
            }}>
              <span style={{
                width: '8px', height: '8px', borderRadius: '50%', background: '#38A169',
                flexShrink: 0, animation: 'pulse 1.2s ease-in-out infinite', display: 'inline-block',
              }} />
              <span style={{ fontSize: '13px', fontWeight: '500', color: '#2b6cb0', fontFamily: "'DM Sans', sans-serif" }}>
                {genState.progress.message || 'Generating content blocks…'}
              </span>
              {genState.pendingSubsectionIds?.size > 0 && (
                <span style={{ fontSize: '12px', color: '#4A90D9', fontFamily: "'DM Sans', sans-serif" }}>
                  {genState.pendingSubsectionIds.size} remaining
                </span>
              )}
            </div>
          )}

          {/* ── Persistent workspace top bar (Figma "Edit workspace") ── */}
          <div style={{
            padding: '0 22px', minHeight: '58px',
            display: 'flex', alignItems: 'center', gap: '9px',
            background: '#FFFFFF', borderBottom: '1px solid #EEF1F6',
            flexShrink: 0, zIndex: 10, fontFamily: "'DM Sans', sans-serif",
          }}>
            <button
              onClick={isSelectingSubsections ? handleBackToGeneration : (navPage === 'outline' ? handleBack : navigateBack)}
              title={isSelectingSubsections ? 'Back to course generation' : navPage === 'outline' ? 'Back to course view' : navPage === 'block' ? 'Back to topic' : 'Back to sections'}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '32px', height: '32px', borderRadius: '9px', flexShrink: 0,
                background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.10)', cursor: 'pointer', color: '#333',
              }}
            >
              <ChevronLeft size={18} />
            </button>

            {/* Breadcrumb */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1 }}>
              <span onClick={() => navigate('/my-courses')} style={{ color: '#8a8a8a', fontSize: '13.5px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' }}>My courses</span>
              <ChevronLeft size={13} style={{ color: '#c7c7c7', flexShrink: 0 }} />
              <span onClick={handleBack} style={{ color: '#8a8a8a', fontSize: '13.5px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' }}>Course Outline</span>
              <ChevronLeft size={13} style={{ color: '#c7c7c7', flexShrink: 0 }} />
              <EditableField
                value={courseName}
                onChange={val => setCourseName(val)}
                placeholder="Course name"
                accentColor="#3e62bc"
                maxLength={60}
                style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}
                inputStyle={{ fontFamily: "'DM Sans', sans-serif", fontWeight: '600', fontSize: '15px', color: '#3e62bc' }}
              />
            </div>

            {!isSelectingSubsections && (
              <>
                <button onClick={undo} disabled={historyIndex <= 0} style={pillStyle('pink', historyIndex <= 0)}>
                  <Undo2 size={15} /> Undo
                </button>

                <div style={{ ...pillStyle('pink'), cursor: 'default', color: saveStatus === 'error' ? '#d64545' : saveStatus === 'saving' ? '#8a8a8a' : '#954baf' }}>
                  {saveStatus === 'saving'
                    ? <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#9CA3AF', display: 'inline-block', animation: 'pulse 1.5s ease-in-out infinite' }} />
                    : saveStatus === 'error' ? null : <CheckIcon size={15} />}
                  {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'error' ? 'Error' : 'Saved'}
                </div>

                {Object.values(linkGenJobs).some(s => s === 'generating') && (
                  <div style={{ ...pillStyle('blueActive'), cursor: 'default' }}>
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#6366F1', display: 'inline-block', animation: 'pulse 1.5s ease-in-out infinite' }} />
                    Links…
                  </div>
                )}

                <div onClick={handleToggleVisibility} style={pillStyle('blue')}>
                  {isPublic ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                  {isPublic ? 'Public' : 'Private'}
                </div>

                <button onClick={() => setShowShareModal(true)} style={pillStyle('blue')}>
                  <Share2 size={15} /> Share
                </button>

                {navPage === 'outline' && (
                  <button
                    onClick={() => setShowLibraryView(p => !p)}
                    title={showLibraryView ? 'Switch back to the classic outline view' : 'Try the content library view (beta)'}
                    style={pillStyle(showLibraryView ? 'blueActive' : 'plain')}
                  >
                    {showLibraryView ? 'Outline' : 'Library'}
                  </button>
                )}

                <button onClick={() => setShowCourseInfo(p => !p)} title="Course Info" style={pillStyle(showCourseInfo ? 'blueActive' : 'blue')}>
                  <Info size={15} /> Info
                </button>

                <button
                  onClick={() => setIsEdoOpen(p => !p)}
                  title={isEdoOpen ? 'Close Edo AI' : 'Open Edo AI'}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    height: '34px', padding: '0 13px', borderRadius: '10px', flexShrink: 0,
                    border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                    color: '#FFFFFF', fontFamily: "'DM Sans', sans-serif", fontSize: '13.5px', fontWeight: '600',
                    background: isEdoOpen
                      ? 'linear-gradient(104deg, #a51b58 2%, #34549f 100%)'
                      : 'linear-gradient(104deg, #bf2066 2%, #3e62bc 100%)',
                  }}
                >
                  <Sparkles size={15} /> Edo
                </button>

                <div style={{
                  width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0, marginLeft: '2px',
                  background: '#d1deff', color: '#3e62bc',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: "'DM Sans', sans-serif", fontSize: '15px', fontWeight: '600',
                }}>
                  {(currentUser?.displayName || currentUser?.email || 'T').slice(0, 1).toUpperCase()}
                </div>
              </>
            )}
          </div>

          {/* ── Page + Edo row ── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>
          <DragDropContext onDragEnd={handleDragEnd}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

              {/* ── Subsection Selection Matrix (Phase 1.5 review) ── */}
              {navPage === 'outline' && isSelectingSubsections && (
                <SubsectionSelectionMatrix
                  sections={sections}
                  candidatesBySection={genState.candidatesBySection}
                  onSubmit={handleSelectionSubmit}
                />
              )}

              {/* ── Course Outline Page ── */}
              {navPage === 'outline' && !isSelectingSubsections && !showLibraryView && (
                <CourseEditor
                  courseClass={courseClass}
                  setCourseClass={setCourseClass}
                  courseName={courseName}
                  onBack={handleBack}
                  onNavigateToBlock={navigateToBlock}
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
                  pendingSubsectionIds={isGenerating ? genState.pendingSubsectionIds : null}
                />
              )}

              {/* ── Course Outline Page — Phase 1.5 redesign (TASK-002), gated by
                    the local `showLibraryView` toggle. Built as a separate
                    sibling view so the existing CourseEditor flow above is
                    untouched when this is off. ── */}
              {navPage === 'outline' && !isSelectingSubsections && showLibraryView && (
                <ContentLibraryPanel
                  sections={sections}
                  handsOnResources={handsOnResources}
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
                  handsOnResources={handsOnResources}
                  onNavigateToBlock={navigateToBlock}
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
                curriculumId={curriculumId}
              />
            )}
          </DragDropContext>
          </div>

          {/* Course Info Panel */}
          {showCourseInfo && (
            <CourseInfoPanel
              curriculumId={curriculumId}
              formData={{
                ...formData,
                courseName,
                objectives: courseObjectives,
              }}
              courseAttachments={courseAttachments}
              courseInfoNotes={courseInfoNotes}
              currentUser={currentUser}
              readOnly={readOnly && !isOwner}
              onClose={() => setShowCourseInfo(false)}
              onAttachmentsChange={setCourseAttachments}
            />
          )}

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
