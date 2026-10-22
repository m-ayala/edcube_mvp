// frontend/src/components/auth/ProtectedRoute.jsx

import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { currentUser, orgError, resolving } = useAuth();

  // Account still resolving after a sign-in: wait so no page calls the API before
  // the active-workspace header is set.
  if (currentUser && resolving) return null;

  if (!currentUser) {
    // Signed out because their org isn't registered (see AuthContext) ->
    // send them to Login, which reads orgError and explains why. Otherwise
    // just not logged in, redirect to landing page.
    return <Navigate to={orgError ? '/login' : '/'} replace />;
  }

  // REMOVED email verification check since VerifyEmail component doesn't exist

  // User is authenticated, show the protected content
  return children;
};

export default ProtectedRoute;