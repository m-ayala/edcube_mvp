// frontend/src/App.jsx

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Login from './components/auth/Login';
import Signup from './components/auth/Signup';
import LandingPage from './components/pages/LandingPage';
import Layout from './components/layout/Layout';
import MyCourses from './components/courses/MyCourses';
import CourseDesigner from './components/courses/CourseDesigner';
import CourseWorkspace from './components/courses/CourseWorkspace';
import CourseViewPage from './components/courses/CourseViewPage';
import TeacherProfile from './components/teacherProfile/TeacherProfile';
import Search from './components/search/Search';

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

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
            <Route path="/course-workspace" element={<CourseWorkspace />} />
            <Route path="/course-view" element={<CourseViewPage />} />
            <Route path="/profile" element={<TeacherProfile />} />
            <Route path="/profile/:teacherUid" element={<TeacherProfile />} />
            <Route path="/search" element={<Search />} />
          </Route>

          {/* Catch all - redirect to landing */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;