import { logEvent } from 'firebase/analytics';
import { analytics } from './config';

export const trackCourseCreated = ({ courseName, subject, grade, sections_count, duration_minutes }) =>
  logEvent(analytics, 'course_created', { courseName, subject, grade, sections_count, duration_minutes });

export const trackCourseUpdated = ({ course_id, sections_count }) =>
  logEvent(analytics, 'course_updated', { course_id, sections_count });

export const trackAiOutlineGenerated = ({ courseName, subject, grade, sections_count }) =>
  logEvent(analytics, 'ai_outline_generated', { courseName, subject, grade, sections_count });

export const trackEdoMessageSent = ({ context_type, prompt_length }) =>
  logEvent(analytics, 'edo_message_sent', { context_type, prompt_length });

export const trackResourceAdded = ({ resource_type, section_id, source }) =>
  logEvent(analytics, 'resource_added', { resource_type, section_id, source });

export const trackPublicCourseViewed = ({ course_id, courseName, grade }) =>
  logEvent(analytics, 'public_course_viewed', { course_id, courseName, grade });
