import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Login from './components/auth/Login';
import Signup from './components/auth/Signup';
import MyCourses from './components/courses/MyCourses';
import CourseDesigner from './components/courses/CourseDesigner';
import CourseWorkspace from './components/courses/CourseWorkspace';
import ProtectedRoute from './components/auth/ProtectedRoute';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* Protected Routes */}
          <Route
            path="/my-courses"
            element={
              <ProtectedRoute>
                <MyCourses />
              </ProtectedRoute>
            }
          />

          <Route
            path="/course-designer"
            element={
              <ProtectedRoute>
                <CourseDesigner />
              </ProtectedRoute>
            }
          />

          <Route
            path="/course-workspace"
            element={
              <ProtectedRoute>
                <CourseWorkspace />
              </ProtectedRoute>
            }
          />

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/my-courses" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;