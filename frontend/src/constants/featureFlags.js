// frontend/src/constants/featureFlags.js
// Single home for client feature flags.
//
// COURSE_BUILDER_ENABLED: route course creation through the Course Builder
// (Stage 1 outline page -> Stage 2 day planner) instead of the old Phase 1.5
// subsection selection matrix. OFF by default until the Stage 2 page ships
// (TASK-010 flips the default). To try it locally set in frontend/.env.local:
//   VITE_COURSE_BUILDER=true
// and restart `npm run dev`.
export const COURSE_BUILDER_ENABLED = import.meta.env.VITE_COURSE_BUILDER === 'true';
