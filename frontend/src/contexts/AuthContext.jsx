import { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase/config';
import { checkEmailOrg, logoutTeacher } from '../firebase/authService';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // Org is resolved once here (via the public check-email endpoint) and
  // exposed to every component through useAuth(), instead of each component
  // re-deriving it from a teacher profile fetch (tasks/firestore-reorg-spec.md
  // TASK-008). There is no default org -- `org` stays null until resolved,
  // and stays null forever for an email that isn't registered with any org.
  const [org, setOrg] = useState(null);
  const [orgName, setOrgName] = useState(null);
  // Set when a signed-in user's email isn't registered with any org (e.g. an
  // org's allowed_emails/domains changed after they last logged in). Login
  // and Signup already guard against this at sign-in time, but a persisted
  // session can reach this state on page reload -- surfaced here so the
  // post-sign-out redirect can explain why.
  const [orgError, setOrgError] = useState(null);

  useEffect(() => {
    // Subscribe to auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);

      if (user?.email) {
        try {
          const result = await checkEmailOrg(user.email);
          if (result.allowed) {
            setOrg(result.org_id);
            setOrgName(result.org_name);
            setOrgError(null);
          } else {
            setOrg(null);
            setOrgName(null);
            setOrgError('Your organization is not registered with EdCube');
            await logoutTeacher();
            setCurrentUser(null);
          }
        } catch (err) {
          console.error('Org resolution failed:', err);
          setOrg(null);
          setOrgName(null);
        }
      } else {
        setOrg(null);
        setOrgName(null);
      }

      setLoading(false);
    });

    // Cleanup subscription
    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    loading,
    org,
    orgName,
    orgError
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};