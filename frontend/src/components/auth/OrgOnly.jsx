// frontend/src/components/auth/OrgOnly.jsx
// Pages that only exist in an organization workspace (the teacher directory). In the personal
// workspace they are retired, so the visitor goes back to My Courses.
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const OrgOnly = ({ children }) => {
  const { isPersonalWorkspace } = useAuth();
  return isPersonalWorkspace ? <Navigate to="/my-courses" replace /> : children;
};

export default OrgOnly;
