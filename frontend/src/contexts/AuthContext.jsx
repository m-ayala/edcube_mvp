import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
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
import { setActiveWorkspaceHeader } from '../services/authFetch';

const AuthContext = createContext();

export const PERSONAL_WORKSPACE = 'personal';

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Active workspace choice is remembered per uid. localStorage can throw
// (private mode, blocked storage), so every access is wrapped.
const wsKey = (uid) => `edcube.activeWorkspace.${uid}`;
const readStoredWorkspace = (uid) => {
  try { return window.localStorage.getItem(wsKey(uid)); } catch { return null; }
};
const writeStoredWorkspace = (uid, ws) => {
  try { window.localStorage.setItem(wsKey(uid), ws); } catch { /* best effort */ }
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // `org` is the Firestore path id of the ACTIVE workspace: an org id, or
  // 'personal'. Every direct Firestore read builds its path from it, so it
  // follows the workspace switcher. null until resolved.
  const [org, setOrg] = useState(null);
  const [orgName, setOrgName] = useState(null);
  // Set when a signed-in user can't be given an account (deactivated, signups not
  // open, not registered). Surfaced on the login page after the sign-out.
  const [orgError, setOrgError] = useState(null);
  // 'org' | 'personal' | null -- the kind of the active workspace.
  const [space, setSpace] = useState(null);
  const [plan, setPlan] = useState(null);
  const [memberships, setMemberships] = useState([]);
  const [activeWorkspace, setActiveWorkspaceState] = useState(null);
  const [account, setAccount] = useState(null);
  // True while a signed-in user's account is still being resolved. ProtectedRoute waits on
  // it so no page makes a call before the active-workspace header is set.
  const [resolving, setResolving] = useState(false);
  // Last raw account response, so a workspace switch can recompute without a refetch.
  const rawRef = useRef(null);
  const uidRef = useRef(null);

  const resolveWorkspace = (data, uid) => {
    const list = Array.isArray(data.memberships) && data.memberships.length
      ? data.memberships
      : [{ workspace: data.org_id, type: data.space === 'org' ? 'org' : 'personal', name: data.org_name }];
    const valid = (ws) => ws && list.some((m) => m.workspace === ws);
    const stored = readStoredWorkspace(uid);
    const fallback = data.default_workspace || data.workspace || data.org_id;
    return { list, ws: valid(stored) ? stored : (valid(fallback) ? fallback : list[0].workspace) };
  };

  const applyWorkspace = (data, list, ws) => {
    const isPersonal = ws === PERSONAL_WORKSPACE;
    const member = list.find((m) => m.workspace === ws);
    // The top-level plan is for the workspace the response was resolved in.
    // The personal plan always sits on account.plan; an org plan is only known
    // when the response was resolved in that org.
    const inThatOrg = data.space === 'org' && data.org_id === ws;
    setActiveWorkspaceHeader(ws);
    setActiveWorkspaceState(ws);
    setOrg(ws);
    setOrgName(isPersonal ? (member?.name || 'EdCube') : (member?.name || (inThatOrg ? data.org_name : null)));
    setSpace(isPersonal ? 'personal' : 'org');
    setPlan(isPersonal ? (data.account?.plan ?? (data.space === 'personal' ? data.plan : null) ?? null)
                        : (inThatOrg ? (data.plan ?? null) : null));
  };

  const applyAccount = useCallback((data, uid) => {
    rawRef.current = data;
    uidRef.current = uid;
    const { list, ws } = resolveWorkspace(data, uid);
    setMemberships(list);
    setAccount(data.account ?? null);
    applyWorkspace(data, list, ws);
    setOrgError(null);
  }, []);

  const clearAccount = useCallback(() => {
    rawRef.current = null;
    uidRef.current = null;
    setActiveWorkspaceHeader(null);
    setSpace(null);
    setOrg(null);
    setOrgName(null);
    setPlan(null);
    setMemberships([]);
    setActiveWorkspaceState(null);
    setAccount(null);
  }, []);

  useEffect(() => {
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

      if (user?.email) {
        setActiveWorkspaceHeader(null);
        setResolving(true);
        setCurrentUser(user);
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
          applyAccount(acct, user.uid);
        } catch (err) {
          if (isNoSpaceError(err)) {
            // Deactivated, signups not open, or not registered.
            clearAccount();
            setOrgError(err.message || 'We could not find an account for this email');
            await logoutTeacher();
            setCurrentUser(null);
          } else {
            // Transient failure: don't lock out an org member the old
            // check-email path still recognizes.
            console.error('Account resolution failed:', err);
            try {
              const result = await checkEmailOrg(user.email);
              if (result.allowed && result.space === 'org') {
                applyAccount({
                  space: 'org', org_id: result.org_id, org_name: result.org_name, plan: null,
                  default_workspace: result.org_id,
                  memberships: [{ workspace: result.org_id, type: 'org', name: result.org_name }]
                }, user.uid);
              } else {
                clearAccount();
              }
            } catch {
              clearAccount();
            }
          }
        }
      } else {
        setCurrentUser(user);
        clearAccount();
      }

      setResolving(false);
      setLoading(false);
    });

    // Cleanup subscription
    return unsubscribe;
  }, [applyAccount, clearAccount]);

  const setActiveWorkspace = useCallback(async (ws) => {
    const raw = rawRef.current;
    const uid = uidRef.current;
    if (!raw || !uid) return;
    const list = Array.isArray(raw.memberships) && raw.memberships.length ? raw.memberships : [];
    if (!list.some((m) => m.workspace === ws)) return;
    writeStoredWorkspace(uid, ws);
    applyWorkspace(raw, list, ws);
    // Best effort: re-read the account in the new workspace so the plan (an org's
    // own plan in an org workspace) is exact. The header is already switched.
    try {
      const fresh = await fetchAccount();
      if (uidRef.current === uid && fresh && fresh.account) {
        rawRef.current = { ...raw, ...fresh, memberships: raw.memberships };
        const { list: l2 } = resolveWorkspace(rawRef.current, uid);
        setAccount(fresh.account);
        if (fresh.space === (ws === PERSONAL_WORKSPACE ? 'personal' : 'org')) {
          setPlan(fresh.plan ?? fresh.account?.plan ?? null);
        }
        setMemberships(l2);
      }
    } catch { /* keep the optimistic values */ }
  }, []);

  const isPersonalWorkspace = space === 'personal';

  const value = {
    currentUser,
    loading,
    org,
    orgName,
    orgError,
    space,
    plan,
    memberships,
    activeWorkspace,
    setActiveWorkspace,
    account,
    resolving,
    isAdmin: !!account?.is_admin,
    // "Acting in the personal workspace". Kept under its original name for
    // existing consumers; isPersonalWorkspace is the clearer alias.
    isPublicUser: isPersonalWorkspace,
    isPersonalWorkspace
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
