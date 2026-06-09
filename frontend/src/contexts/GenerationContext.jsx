import { createContext, useContext, useRef, useState } from 'react';

const GenerationContext = createContext(null);

const IDLE = {
  status: 'idle',
  formData: null,
  targetFolderId: null,
  sections: [],
  handsOnResources: {},
  curriculumId: null,
  progress: { message: '', percent: 0 },
  pendingSubsectionIds: new Set(),
};

function mapOutlineToSections(outline) {
  return (outline?.sections || []).map(section => ({
    id: section.id,
    title: section.title,
    description: section.description,
    subsections: (section.subsections || []).map(sub => ({
      id: sub.id,
      title: sub.title,
      description: sub.description,
      topicBoxes: [{
        id: `topic-${sub.id}-initial`,
        title: sub.title,
        description: sub.description || '',
        duration_minutes: sub.duration_minutes || 60,
        pla_pillars: sub.pla_pillars || [],
        learning_objectives: sub.learning_objectives || [],
        content_keywords: sub.content_keywords || [],
        video_resources: sub.video_resources || [],
        worksheets: sub.worksheets || [],
        activities: sub.activities || [],
      }],
    })),
  }));
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
      progress: { message: 'Starting...', percent: 0 },
    });

    const body = new FormData();
    body.append('course_name',      formData.courseName);
    body.append('age_range_start',  String(parseInt(formData.ageRangeStart)));
    body.append('age_range_end',    String(parseInt(formData.ageRangeEnd)));
    body.append('num_students',     String(parseInt(formData.numStudents)));
    body.append('subject',          formData.subject);
    body.append('topic',            formData.topic);
    body.append('num_days',         String(parseInt(formData.numDays)));
    body.append('hours_per_day',    String(parseFloat(formData.hoursPerDay)));
    body.append('num_worksheets',   String(parseInt(formData.numWorksheets)));
    body.append('num_activities',   String(parseInt(formData.numActivities)));
    body.append('objectives',       formData.objectives || '');
    body.append('teacherUid',       teacherUid);
    body.append('organizationId',   organizationId);
    body.append('file_descriptions', JSON.stringify(attachedFiles.map(f => f.description || '')));
    attachedFiles.forEach(({ file }) => body.append('files', file));

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/generate-curriculum`,
        { method: 'POST', body }
      );

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const processLine = (line) => {
        if (!line.startsWith('data: ')) return;
        try {
          const data = JSON.parse(line.slice(6));

          if (data.error) {
            setGenState(prev => ({ ...prev, status: 'error', progress: { message: data.message || 'Generation failed', percent: 0 } }));
            return;
          }

          if (data.type === 'outline_ready') {
            const sections = mapOutlineToSections(data.outline);
            const pendingSubsectionIds = new Set(
              sections.flatMap(s => s.subsections.map(ss => ss.id))
            );
            setGenState(prev => ({
              ...prev,
              status: 'outline-ready',
              sections,
              pendingSubsectionIds,
              progress: { message: data.message || 'Outline ready!', percent: data.progress || 50 },
            }));
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
                progress: { message: prev.progress.message, percent: data.progress || prev.progress.percent },
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

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) processLine(line);
      }
      if (buffer.trim()) processLine(buffer.trim());

    } catch (err) {
      console.error('GenerationContext: fetch error', err);
      setGenState(prev => ({ ...prev, status: 'error', progress: { message: 'Failed to generate course. Please try again.', percent: 0 } }));
    }
  };

  const clearGeneration = () => {
    handsOnRef.current = {};
    setGenState(IDLE);
  };

  return (
    <GenerationContext.Provider value={{ genState, startGeneration, clearGeneration }}>
      {children}
    </GenerationContext.Provider>
  );
}

export function useGeneration() {
  return useContext(GenerationContext);
}
