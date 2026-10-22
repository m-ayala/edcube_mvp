// frontend/src/components/share/PendingInviteRedirect.jsx
// Renders nothing. When someone who opened an invite link while signed out has now signed in (after
// signup + email verification + login, or Google), sends them back to /invite/:token to accept it.
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { pendingInviteToken } from '../../utils/pendingInvite';

const PendingInviteRedirect = () => {
  const { currentUser, resolving } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser || resolving) return;
    if (pathname.startsWith('/invite/') || pathname.startsWith('/share/')) return;
    const token = pendingInviteToken();
    if (token) navigate(`/invite/${encodeURIComponent(token)}`, { replace: true });
  }, [currentUser, resolving, pathname, navigate]);

  return null;
};

export default PendingInviteRedirect;
