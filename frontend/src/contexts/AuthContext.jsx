import { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase/config';
import {
  checkEmailOrg,
  logoutTeacher,
  fetchAccount,
  bootstrapAccount,
  isNotRegisteredError,
  isNoSpaceError
} from '../firebase/authService';

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
  // 'org' | 'public' | null. Public users (anyone not matching a registered org)
  // live in the shared "public" space (org id 'public', name 'EdCube') on a plan.
  const [space, setSpace] = useState(null);
  const [plan, setPlan] = useState(null);

  useEffect(() => {
    const applyAccount = (acct) => {
      setSpace(acct.space);
      setOrg(acct.org_id);
      setOrgName(acct.org_name);
      setPlan(acct.plan ?? null);
      setOrgError(null);
    };
    const clearAccount = () => {
      setSpace(null);
      setOrg(null);
      setOrgName(null);
      setPlan(null);
    };

    // Subscribe to auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      // Unverified accounts aren't usable yet (bootstrap needs a verified
      // email); treat them as signed out until they verify and log in.
      if (user && !user.emailVerified) {
        setCurrentUser(null);
        clearAccount();
        setLoading(false);
        return;
      }

      setCurrentUser(user);

      if (user?.email) {
        try {
          let acct;
          try {
            acct = await fetchAccount();
          } catch (err) {
            // Verified via the email link and landed on a signed-in session
            // that was never bootstrapped: bootstrap once.
            if (!isNotRegisteredError(err)) throw err;
            acct = await bootstrapAccount(user, user.displayName);
          }
          applyAccount(acct);
        } catch (err) {
          if (isNoSpaceError(err)) {
            // Truly no space (waitlisted, public signups not open, not allowed)
            clearAccount();
            setOrgError(err.message || 'Your organization is not registered with EdCube');
            await logoutTeacher();
            setCurrentUser(null);
          } else {
            // Transient failure: don't lock out an org member the old
            // check-email path still recognizes.
            console.error('Account resolution failed:', err);
            try {
              const result = await checkEmailOrg(user.email);
              if (result.allowed && result.space !== 'public') {
                applyAccount({ space: 'org', org_id: result.org_id, org_name: result.org_name, plan: null });
              } else {
                clearAccount();
              }
            } catch {
              clearAccount();
            }
          }
        }
      } else {
        clearAccount();
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
    orgError,
    space,
    plan,
    isPublicUser: space === 'public'
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};