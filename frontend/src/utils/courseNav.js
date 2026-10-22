// frontend/src/utils/courseNav.js
// Navigation state for opening a saved course document (GET /api/curricula/{id}) in the course view,
// the same shape the profile's "Shared with me" list builds. Course Builder courses keep every field.
import { navSectionsFromDoc, outlineExtrasOf } from './builderCourse';

const legacySections = (course) => (course.outline?.sections || course.sections || []).map((section) => ({
  id: section.id,
  title: section.title,
  description: section.description || '',
  type: section.type,
  duration: section.duration,
  subsections: (section.subsections || []).map((sub) => ({
    id: sub.id,
    title: sub.title,
    description: sub.description || '',
    learning_objectives: sub.learning_objectives || [],
    duration_minutes: sub.duration_minutes ?? 20,
    content_blocks: sub.content_blocks || [],
    worksheets: sub.worksheets || [],
    activities: sub.activities || [],
    video_resources: sub.video_resources || [],
  })),
}));

export const courseViewState = (doc, { courseId, isOwner = false, accessType = 'view', ownerName = '' } = {}) => {
  const built = navSectionsFromDoc(doc);
  return {
    formData: {
      courseName: doc.courseName,
      subject: doc.subject || '',
      topic: doc.topic || '',
      class: doc.class,
      timeDuration: doc.timeDuration,
      objectives: doc.objectives || '',
      ...(built ? { numDays: doc.numDays, hoursPerDay: doc.hoursPerDay } : {}),
    },
    sections: built || legacySections(doc),
    curriculumId: courseId || doc.courseId || doc.id,
    isPublic: false,
    isOwner,
    ownerName,
    isCollaborator: !isOwner && accessType === 'collaborate',
    ...(built && doc.outline ? { outlineExtras: outlineExtrasOf(doc) } : {}),
  };
};
