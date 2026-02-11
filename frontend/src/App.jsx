// frontend/src/App.jsx

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Login from './components/auth/Login';
import Signup from './components/auth/Signup';
import Layout from './components/layout/Layout';
import MyCourses from './components/courses/MyCourses';
import CourseDesignerLanding from './components/pages/CourseDesignerLanding';
import CourseDesigner from './components/courses/CourseDesigner';
import CourseUpload from './components/pages/CourseUpload';
import CourseWorkspace from './components/courses/CourseWorkspace';
import TeacherProfile from './components/teacherProfile/TeacherProfile';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* Protected Routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            {/* Default redirect to My Courses */}
            <Route index element={<Navigate to="/my-courses" replace />} />
            
            {/* Existing Routes */}
            <Route path="my-courses" element={<MyCourses />} />
            <Route path="course-designer" element={<CourseDesignerLanding />} />
            <Route path="course-designer/create" element={<CourseDesigner />} />
            <Route path="course-designer/upload" element={<CourseUpload />} />
            <Route path="course-workspace" element={<CourseWorkspace />} />
            
            {/* Teacher Profile Routes */}
            <Route path="profile" element={<TeacherProfile />} />
            <Route path="profile/:teacherUid" element={<TeacherProfile />} />
          </Route>

          {/* Catch all - redirect to login */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;