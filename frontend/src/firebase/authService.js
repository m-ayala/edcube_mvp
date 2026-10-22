import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  updateProfile,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect
} from 'firebase/auth';
import { setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './config';
import { orgSubDoc } from './paths';
import { authFetch, errorFromResponse } from '../services/authFetch';

const API_BASE_URL = `${import.meta.env.VITE_API_BASE_URL}/api/orgs`;

/**
 * Check whether an email belongs to a registered org, via the public
 * `GET /api/orgs/check-email` backend endpoint. Returns
 * `{ allowed, org_id, org_name, space }`: `space` is 'org' for a registered
 * org email, 'personal' for everyone else (nobody is blocked).
 */
export const checkEmailOrg = async (email) => {
  const res = await fetch(`${API_BASE_URL}/check-email?email=${encodeURIComponent(email)}`);
  if (!res.ok) {
    throw new Error('Could not verify your organization. Please try again.');
  }
  return res.json();
};

const NOT_OPEN_MESSAGE = 'Public signups are not open yet';

const ACCOUNT_URL = `${import.meta.env.VITE_API_BASE_URL}/api/account`;

export const deactivatedMessage = (deleteAfter) => {
  const d = deleteAfter ? new Date(deleteAfter) : null;
  const date = d && !Number.isNaN(d.getTime())
    ? d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
    : null;
  return date
    ? `This account is deactivated. You can restore it until ${date}.`
    : 'This account is deactivated. You can restore it for a limited time.';
};

// Error for a failed /api/account/* response. `.status` is the HTTP status and
// `.code` is the backend's detail code (e.g. 'account_deactivated') when the
// detail is an object.
const accountError = async (res) => {
  let detail = null;
  try { detail = (await res.clone().json()).detail; } catch { /* non-JSON body */ }
  const err = await errorFromResponse(res, 'Account request failed');
  if (detail && typeof detail === 'object' && detail.code) {
    err.code = detail.code;
    if (detail.code === 'account_deactivated') {
      err.deleteAfter = detail.delete_after || null;
      err.message = deactivatedMessage(detail.delete_after);
    }
  }
  return err;
};

export const isNotRegisteredError = (err) =>
  err?.status === 403 && /not registered/i.test(err.message || '');

export const isDeactivatedError = (err) => err?.code === 'account_deactivated';

// Deactivated / not open / not registered: the user definitively has no usable
// account (as opposed to a transient failure where we shouldn't lock anyone out).
export const isNoSpaceError = (err) =>
  isDeactivatedError(err) || err?.status === 503 || isNotRegisteredError(err);

/**
 * `POST /api/account/bootstrap`: idempotent, creates the user's teacher doc in
 * their space and returns `{ space, org_id, org_name, plan, default_workspace,
 * memberships, account }`. Requires a verified email. Calls for the same uid
 * share one in-flight request (login and the AuthContext listener can both fire
 * it). Refreshes the ID token afterwards so the new `org` claim is picked up.
 */
const inflightBootstrap = new Map();
export const bootstrapAccount = (user, displayName) => {
  const key = user.uid;
  if (inflightBootstrap.has(key)) return inflightBootstrap.get(key);
  const p = (async () => {
    const res = await authFetch(`${ACCOUNT_URL}/bootstrap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(displayName ? { display_name: displayName } : {})
    });
    if (!res.ok) throw await accountError(res);
    const data = await res.json();
    await user.getIdToken(true);
    return data;
  })().finally(() => inflightBootstrap.delete(key));
  inflightBootstrap.set(key, p);
  return p;
};

/** `GET /api/account/me` -> account summary for the active workspace. */
export const fetchAccount = async () => {
  const res = await authFetch(`${ACCOUNT_URL}/me`);
  if (!res.ok) throw await accountError(res);
  return res.json();
};

/**
 * `POST /api/waitlist` (no sign-in needed). Resolves `{ success: true }`; rejects
 * with an Error whose `.kind` is 'invalid' (422), 'rate_limited' (429) or 'failed'.
 */
export const submitWaitlist = async (payload) => {
  const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/waitlist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (res.ok) return res.json().catch(() => ({ success: true }));
  const err = new Error('Something went wrong. Please try again in a moment.');
  err.kind = 'failed';
  if (res.status === 422) {
    err.kind = 'invalid';
    err.message = 'Please check the details you entered and try again.';
  } else if (res.status === 429) {
    err.kind = 'rate_limited';
    err.message = "You've sent a few requests already. Please wait a little while and try again.";
  }
  throw err;
};

/**
 * Sign up a new teacher with email/password. Anyone can sign up with any email;
 * the account's workspace + teacher doc are created by the backend at first
 * verified login (bootstrap) -- the client never writes `teachers/{uid}`.
 */
export const signupTeacher = async (email, password, displayName) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    await updateProfile(user, { displayName });
    await sendEmailVerification(user);
    // Not usable until verified; start clean at the login screen afterwards.
    await signOut(auth);

    return {
      success: true,
      user: user,
      message: 'Account created! Please check your email to verify your account.'
    };
  } catch (error) {
    console.error('Signup error:', error);
    throw error;
  }
};

// Bootstrap right after a sign-in. Definitive refusals (deactivated, not open,
// 401/403) sign the user out and throw; a transient failure falls back to the
// old org check so an org member isn't locked out by a network blip.
const bootstrapAfterSignIn = async (user) => {
  try {
    return await bootstrapAccount(user, user.displayName);
  } catch (err) {
    if (isDeactivatedError(err)) {
      await signOut(auth);
      throw err;
    }
    if (err.status === 503) {
      await signOut(auth);
      throw new Error(NOT_OPEN_MESSAGE);
    }
    if (err.status === 401 || err.status === 403) {
      await signOut(auth);
      throw err;
    }
    console.warn('Bootstrap failed, falling back to org check:', err);
    let orgCheck;
    try {
      orgCheck = await checkEmailOrg(user.email);
    } catch {
      orgCheck = null;
    }
    if (orgCheck?.allowed && orgCheck.space === 'org') {
      return {
        space: 'org', org_id: orgCheck.org_id, org_name: orgCheck.org_name, plan: null,
        default_workspace: orgCheck.org_id,
        memberships: [{ workspace: orgCheck.org_id, type: 'org', name: orgCheck.org_name }]
      };
    }
    await signOut(auth);
    throw new Error('Could not sign you in right now. Please try again.');
  }
};

const touchLastLogin = async (user, account) => {
  try {
    await setDoc(orgSubDoc(db, account.org_id, 'teachers', user.uid), {
      lastLogin: serverTimestamp()
    }, { merge: true });
  } catch (err) {
    console.warn('lastLogin update failed:', err);
  }
};

/**
 * Login teacher with email/password. Requires a verified email, then bootstraps
 * the account (idempotent) so the user has a workspace + teacher doc.
 */
export const loginTeacher = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    if (!user.emailVerified) {
      await signOut(auth);
      throw new Error('Please verify your email before logging in. Check your inbox for the verification link.');
    }

    const account = await bootstrapAfterSignIn(user);
    touchLastLogin(user, account); // best effort, not awaited: must not stall sign-in
    return { success: true, user: user, account };
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};

/**
 * Continue with Google (login and signup are the same). Uses a popup and falls
 * back to a full-page redirect when the browser blocks it. A Google account is
 * already verified, so this goes straight to bootstrap. On the redirect path the
 * page leaves; AuthContext's listener bootstraps when it comes back.
 */
export const signInWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  let userCredential;
  try {
    userCredential = await signInWithPopup(auth, provider);
  } catch (error) {
    if (error?.code === 'auth/popup-blocked') {
      await signInWithRedirect(auth, provider);
      return { success: true, redirected: true };
    }
    if (error?.code === 'auth/popup-closed-by-user' || error?.code === 'auth/cancelled-popup-request') {
      return { success: false, cancelled: true };
    }
    console.error('Google sign-in error:', error);
    throw error;
  }
  const user = userCredential.user;
  const account = await bootstrapAfterSignIn(user);
  touchLastLogin(user, account); // best effort, not awaited: must not stall sign-in
  return { success: true, user, account };
};

/**
 * Logout current teacher
 */
export const logoutTeacher = async () => {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    console.error('Logout error:', error);
    throw error;
  }
};

/**
 * Resend email verification
 */
export const resendVerificationEmail = async () => {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('No user is currently logged in');
    }
    
    await sendEmailVerification(user);
    return {
      success: true,
      message: 'Verification email sent! Please check your inbox.'
    };
  } catch (error) {
    console.error('Resend verification error:', error);
    throw error;
  }
};

/**
 * Change user password
 * Requires current password for security
 */
export const changePassword = async (currentPassword, newPassword) => {
  try {
    const user = auth.currentUser;
    
    if (!user || !user.email) {
      throw new Error('No user is currently logged in');
    }

    // Step 1: Re-authenticate user with current password
    const credential = EmailAuthProvider.credential(
      user.email,
      currentPassword
    );
    
    await reauthenticateWithCredential(user, credential);

    // Step 2: Update to new password
    await updatePassword(user, newPassword);

    return {
      success: true,
      message: 'Password changed successfully!'
    };
  } catch (error) {
    console.error('Change password error:', error);
    
    // Handle specific error cases
    if (error.code === 'auth/wrong-password') {
      throw new Error('Current password is incorrect');
    } else if (error.code === 'auth/weak-password') {
      throw new Error('New password is too weak. Must be at least 6 characters.');
    } else {
      throw new Error(error.message || 'Failed to change password');
    }
  }
};