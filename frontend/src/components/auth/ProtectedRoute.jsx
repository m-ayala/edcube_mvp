import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { currentUser } = useAuth();

  if (!currentUser) {
    // User not logged in, redirect to login
    return <Navigate to="/login" replace />;
  }

  if (!currentUser.emailVerified) {
    // Email not verified, redirect to verification page
    return <Navigate to="/verify-email" replace />;
  }

  // User is authenticated and verified, show the protected content
  return children;
};

export default ProtectedRoute;