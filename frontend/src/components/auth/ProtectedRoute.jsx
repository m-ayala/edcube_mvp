// frontend/src/components/auth/ProtectedRoute.jsx

import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { currentUser } = useAuth();

  if (!currentUser) {
    // User not logged in, redirect to login
    return <Navigate to="/login" replace />;
  }

  // REMOVED email verification check since VerifyEmail component doesn't exist

  // User is authenticated, show the protected content
  return children;
};

export default ProtectedRoute;