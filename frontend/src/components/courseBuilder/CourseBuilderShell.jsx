// frontend/src/components/courseBuilder/CourseBuilderShell.jsx
// Parent of the Course Builder pages (/course-builder/outline, /course-builder/plan).
// Responsibilities: (1) send the teacher back to the course form with a message when
// there is no builder state (refresh, direct URL, stale tab), and (2) clear builder
// state when the teacher leaves the Course Builder entirely.
import { useEffect, useRef } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useGeneration } from '../../contexts/GenerationContext';

const CourseBuilderShell = () => {
  const { genState, clearGeneration } = useGeneration();

  // Always call the latest clearGeneration / genState from the unmount cleanup.
  const clearRef = useRef(clearGeneration);
  const stateRef = useRef(genState);
  useEffect(() => { clearRef.current = clearGeneration; stateRef.current = genState; });

  useEffect(() => {
    return () => {
      // Moving between /course-builder/* pages keeps this shell mounted, so an unmount
      // means the teacher left. Check the URL on the next tick so a same-commit
      // remount (dev double-invoke) is not mistaken for leaving.
      setTimeout(() => {
        if (window.location.pathname.startsWith('/course-builder')) return;
        // Clear only FINISHED builder state (the teacher is parked on a Course Builder page
        // that has results). A generation still in flight (e.g. a stray visit was redirected
        // to the course form while outlines are generating) or a course build in progress
        // must not be wiped.
        const g = stateRef.current;
        const finished = g.builder && (g.status === 'outlines-ready' || g.status === 'builder-planning');
        if (finished && g.builder.build?.phase !== 'building') clearRef.current();
      }, 0);
    };
  }, []);

  if (!genState.builder) {
    return (
      <Navigate
        to="/course-designer"
        replace
        state={{ notice: 'Your course outline was not saved, so the Course Builder could not be reopened. Please enter the course details again.' }}
      />
    );
  }
  return <Outlet />;
};

export default CourseBuilderShell;
