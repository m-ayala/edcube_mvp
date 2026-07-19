import { createContext, useContext, useRef, useState } from 'react';

const GenerationContext = createContext(null);

const IDLE = {
  status: 'idle',
  formData: null,
  targetFolderId: null,
  teacherUid: null,
  organizationId: null,
  sections: [],
  rawOutline: null,
  interpretedRequirements: null,
  presetCourseId: null,
  courseAttachments: [],
  candidatesBySection: {},
  handsOnResources: {},
  curriculumId: null,
  progress: { message: '', percent: 0 },
  pendingSubsectionIds: new Set(),
};

function mapOutlineToSections(outline) {
  // Phase 1 no longer produces subsections — each section starts empty and is
  // filled in once Phase 1.5 candidates are proposed and the teacher selects.
  return (outline?.sections || []).map(section => ({
    id: section.id,
    title: section.title,
    description: section.description,
    depthCeiling: section.depth_ceiling,
    subsections: [],
  }));
}

// Shared SSE line-by-line reader used by both the Stage 1 (outline + candidates)
// and Stage 2 (approved block generation) streams.
async function consumeSSE(response, onLine) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) onLine(line);
  }
  if (buffer.trim()) onLine(buffer.trim());
}

export function GenerationProvider({ children }) {
  const [genState, setGenState] = useState(IDLE);
  // Keep a stable ref for handsOnResources so we can merge without re-rendering the whole object
  const handsOnRef = useRef({});

  const startGeneration = async (formData, attachedFiles, teacherUid, organizationId, targetFolderId) => {
    handsOnRef.current = {};

    setGenState({
      ...IDLE,
      status: 'generating-outline',
      formData,
      targetFolderId,
      teacherUid,
      organizationId,
      progress: { message: 'Starting...', percent: 0 },
    });

    const body = new FormData();
    body.append('course_name',      formData.courseName);
    body.append('age_range_start',  String(parseInt(formData.ageRangeStart)));
    body.append('age_range_end',    String(parseInt(formData.ageRangeEnd)));
    body.append('num_students',     String(parseInt(formData.numStudents)));
    body.append('num_days',         String(parseInt(formData.numDays)));
    body.append('hours_per_day',    String(parseFloat(formData.hoursPerDay)));
    body.append('num_worksheets',   String(parseInt(formData.numWorksheets)));
    body.append('num_activities',   String(parseInt(formData.numActivities)));
    body.append('objectives',       formData.objectives || '');
    body.append('teacherUid',       teacherUid);
    body.append('organizationId',   organizationId);
    body.append('file_descriptions', JSON.stringify(attachedFiles.map(f => f.description || '')));
    attachedFiles.forEach(({ file }) => body.append('files', file));

    const processLine = (line) => {
      if (!line.startsWith('data: ')) return;
      try {
        const data = JSON.parse(line.slice(6));

        if (data.error) {
          setGenState(prev => ({ ...prev, status: 'error', progress: { message: data.message || 'Generation failed', percent: 0 } }));
          return;
        }

        if (data.type === 'requirements_interpreted') {
          // Stage 1: surfaced for review only — not yet consumed by generation.
          console.log('Requirements Interpreter output:', data.interpretation);
          setGenState(prev => ({ ...prev, interpretedRequirements: data.interpretation }));
          return;
        }

        if (data.type === 'outline_ready') {
          const sections = mapOutlineToSections(data.outline);
          setGenState(prev => ({
            ...prev,
            status: 'generating-candidates',
            sections,
            rawOutline: data.outline,
            progress: { message: data.message || 'Outline ready!', percent: data.progress || 50 },
          }));
          return;
        }

        if (data.type === 'subsections_ready') {
          setGenState(prev => ({
            ...prev,
            status: 'generating-candidates',
            candidatesBySection: { ...prev.candidatesBySection, [data.section_id]: data.chains || [] },
            progress: { message: prev.progress.message, percent: data.progress ?? prev.progress.percent },
          }));
          return;
        }

        if (data.type === 'candidates_complete') {
          setGenState(prev => ({
            ...prev,
            status: 'selection-pending',
            presetCourseId: data.preset_course_id || prev.presetCourseId,
            courseAttachments: data.course_attachments || prev.courseAttachments,
            progress: { message: data.message || 'Candidates ready!', percent: data.progress ?? 70 },
          }));
          return;
        }

        // Generic progress update
        if (data.message || data.progress != null) {
          setGenState(prev => ({
            ...prev,
            progress: { message: data.message || prev.progress.message, percent: data.progress ?? prev.progress.percent },
          }));
        }
      } catch (err) {
        console.error('GenerationContext: error parsing SSE line', err);
      }
    };

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/generate-curriculum`,
        { method: 'POST', body }
      );
      await consumeSSE(response, processLine);
    } catch (err) {
      console.error('GenerationContext: fetch error', err);
      setGenState(prev => ({ ...prev, status: 'error', progress: { message: 'Failed to generate course. Please try again.', percent: 0 } }));
    }
  };

  // Called once the teacher submits their Phase 1.5 selection in the matrix UI.
  // `selections` is an array of { subsectionId, sectionId, sectionTitle, title,
  // description, coreConcept, depthLevel, prerequisiteSubsectionId, chainId,
  // durationMinutes, learningObjectives, blocks, included, excludedBlockIds }.
  const submitSelectionsAndGenerateBlocks = async (selections) => {
    handsOnRef.current = {};

    const includedIds = new Set(selections.filter(s => s.included).map(s => s.subsectionId));

    setGenState(prev => ({
      ...prev,
      status: 'generating-blocks',
      pendingSubsectionIds: includedIds,
      progress: { message: 'Generating content blocks...', percent: 0 },
    }));

    const { formData, teacherUid, organizationId, presetCourseId, courseAttachments, rawOutline } = genState;

    const requestBody = {
      presetCourseId,
      teacherUid,
      organizationId,
      courseName: formData.courseName,
      ageRangeStart: parseInt(formData.ageRangeStart),
      ageRangeEnd: parseInt(formData.ageRangeEnd),
      numStudents: parseInt(formData.numStudents),
      numDays: parseInt(formData.numDays),
      hoursPerDay: parseFloat(formData.hoursPerDay),
      objectives: formData.objectives || '',
      courseAttachments,
      outline: rawOutline,
      selections,
    };

    const processLine = (line) => {
      if (!line.startsWith('data: ')) return;
      try {
        const data = JSON.parse(line.slice(6));

        if (data.error) {
          setGenState(prev => ({ ...prev, status: 'error', progress: { message: data.message || 'Generation failed', percent: 0 } }));
          return;
        }

        if (data.type === 'subsection_blocks') {
          handsOnRef.current = { ...handsOnRef.current, [data.subsection_id]: data.blocks };
          setGenState(prev => {
            const next = new Set(prev.pendingSubsectionIds);
            next.delete(data.subsection_id);
            return {
              ...prev,
              status: 'generating-blocks',
              handsOnResources: { ...handsOnRef.current },
              pendingSubsectionIds: next,
              progress: { message: prev.progress.message, percent: data.progress ?? prev.progress.percent },
            };
          });
          return;
        }

        if (data.done && data.curriculum_id) {
          setGenState(prev => ({
            ...prev,
            status: 'complete',
            curriculumId: data.curriculum_id,
            progress: { message: 'Complete!', percent: 100 },
          }));
          return;
        }

        if (data.message || data.progress != null) {
          setGenState(prev => ({
            ...prev,
            progress: { message: data.message || prev.progress.message, percent: data.progress ?? prev.progress.percent },
          }));
        }
      } catch (err) {
        console.error('GenerationContext: error parsing SSE line', err);
      }
    };

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/generate-blocks`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        }
      );
      await consumeSSE(response, processLine);
    } catch (err) {
      console.error('GenerationContext: fetch error', err);
      setGenState(prev => ({ ...prev, status: 'error', progress: { message: 'Failed to generate blocks. Please try again.', percent: 0 } }));
    }
  };

  // Called when the teacher clicks "+" on a depth-level row in the matrix UI to
  // request one more independent chain for a section. Returns the new chains
  // (also merged into genState.candidatesBySection) so the caller can await it.
  const generateMoreSubsections = async (sectionId) => {
    const section = genState.sections.find(s => s.id === sectionId);
    if (!section) throw new Error(`Unknown section: ${sectionId}`);

    // Dedup context: every subsection already proposed anywhere in the course,
    // including this section's own existing chains.
    const existingSubsections = Object.entries(genState.candidatesBySection).flatMap(([secId, chains]) => {
      const secTitle = genState.sections.find(s => s.id === secId)?.title || '';
      return chains.flatMap(chain => chain.subsections.map(sub => ({ section: secTitle, subsection: sub.title })));
    });

    const { formData } = genState;
    const dayNumber = genState.sections.findIndex(s => s.id === sectionId) + 1;
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/generate-more-subsections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sectionId: section.id,
        sectionTitle: section.title,
        sectionDescription: section.description || '',
        depthCeiling: section.depthCeiling || 'Basics',
        courseName: formData.courseName,
        ageRangeStart: parseInt(formData.ageRangeStart),
        ageRangeEnd: parseInt(formData.ageRangeEnd),
        objectives: formData.objectives || '',
        hoursPerDay: parseFloat(formData.hoursPerDay),
        numDays: parseInt(formData.numDays),
        dayNumber: dayNumber > 0 ? dayNumber : null,
        numWorksheets: parseInt(formData.numWorksheets) || 0,
        numActivities: parseInt(formData.numActivities) || 0,
        existingSubsections,
      }),
    });

    if (!response.ok) {
      throw new Error(`generate-more-subsections failed: ${response.status}`);
    }
    const data = await response.json();
    const newChains = data.chains || [];

    setGenState(prev => ({
      ...prev,
      candidatesBySection: {
        ...prev.candidatesBySection,
        [sectionId]: [...(prev.candidatesBySection[sectionId] || []), ...newChains],
      },
    }));

    return newChains;
  };

  const clearGeneration = () => {
    handsOnRef.current = {};
    setGenState(IDLE);
  };

  return (
    <GenerationContext.Provider value={{ genState, startGeneration, submitSelectionsAndGenerateBlocks, generateMoreSubsections, clearGeneration }}>
      {children}
    </GenerationContext.Provider>
  );
}

export function useGeneration() {
  return useContext(GenerationContext);
}
