import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Login from './components/auth/Login';
import Signup from './components/auth/Signup';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Layout from './components/layout/Layout';
import Home from './components/pages/Home';
import MyCourses from './components/courses/MyCourses';
import CourseDesigner from './components/courses/CourseDesigner';
import CourseWorkspace from './components/courses/CourseWorkspace';
import CourseDesignerLanding from './components/pages/CourseDesignerLanding';
import CourseUpload from './components/pages/CourseUpload';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/login"  element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* Protected Routes — all share the Sidebar via Layout */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/home" replace />} />
            <Route path="home"              element={<Home />} />
            <Route path="my-courses"        element={<MyCourses />} />
            <Route path="/course-designer" element={<CourseDesignerLanding />} />
            <Route path="/course-designer/create" element={<CourseDesigner />} />
            <Route path="/course-designer/upload" element={<CourseUpload />} />
            <Route path="course-workspace"  element={<CourseWorkspace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;