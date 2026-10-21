// frontend/src/App.jsx

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { UsageProvider } from './contexts/UsageContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { GenerationProvider } from './contexts/GenerationContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Login from './components/auth/Login';
import Signup from './components/auth/Signup';
import Waitlist from './components/auth/Waitlist';
import LandingPage from './components/pages/LandingPage';
import Layout from './components/layout/Layout';
import MyCourses from './components/courses/MyCourses';
import CourseDesigner from './components/courses/CourseDesigner';
import CourseWorkspace from './components/courses/CourseWorkspace';
import CourseViewPage from './components/courses/CourseViewPage';
import TeacherProfile from './components/teacherProfile/TeacherProfile';
import Search from './components/search/Search';
import ContactPage from './components/pages/ContactPage';
import SynopsisPage from './components/synopsis/SynopsisPage';
import AfterschoolSynopsisPage from './components/afterschoolSynopsis/AfterschoolSynopsisPage';
import CourseBuilderShell from './components/courseBuilder/CourseBuilderShell';
import OutlineStage from './components/courseBuilder/OutlineStage';
import PlanStage from './components/courseBuilder/PlanStage';
import { COURSE_BUILDER_ENABLED } from './constants/featureFlags';

function App() {
  return (
    <AuthProvider>
      <UsageProvider>
      <NotificationProvider>
      <GenerationProvider>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/waitlist" element={<Waitlist />} />
          <Route path="/contact" element={<ContactPage />} />

          {/* Protected Routes — pathless layout wrapper */}
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/my-courses" element={<MyCourses />} />
            <Route path="/course-designer" element={<CourseDesigner />} />
            {/* Course Builder (behind COURSE_BUILDER_ENABLED, see constants/featureFlags.js) */}
            {COURSE_BUILDER_ENABLED && (
              <Route path="/course-builder" element={<CourseBuilderShell />}>
                <Route path="outline" element={<OutlineStage />} />
                <Route path="plan" element={<PlanStage />} />
              </Route>
            )}
            <Route path="/course-workspace" element={<CourseWorkspace />} />
            <Route path="/course-view" element={<CourseViewPage />} />
            <Route path="/profile" element={<TeacherProfile />} />
            <Route path="/profile/:teacherUid" element={<TeacherProfile />} />
            <Route path="/search" element={<Search />} />
          </Route>

          {/* Standalone public routes — no sidebar, no auth required */}
          <Route path="/synopsis" element={<SynopsisPage />} />
          <Route path="/synopsis/:campSlug" element={<SynopsisPage />} />
          <Route path="/afterschool-synopsis" element={<AfterschoolSynopsisPage />} />

          {/* Catch all - redirect to landing */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
      </GenerationProvider>
      </NotificationProvider>
      </UsageProvider>
    </AuthProvider>
  );
}

export default App;