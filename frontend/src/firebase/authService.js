import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  updateProfile,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider
} from 'firebase/auth';
import { setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './config';
import { orgSubDoc } from './paths';
import { authFetch, errorFromResponse } from '../services/authFetch';

const API_BASE_URL = `${import.meta.env.VITE_API_BASE_URL}/api/orgs`;

/**
 * Check whether an email is registered with an org, via the public
 * `GET /api/orgs/check-email` backend endpoint (backed by the `Users/{org}`
 * registry docs -- there is no frontend DOMAIN_ORG_MAP and no default org,
 * tasks/firestore-reorg-spec.md Round 2, sections A and G). Returns
 * `{ allowed, org_id, org_name, space, waitlisted? }` (non-org emails get
 * `space: 'public'` once public signups are open).
 */
export const checkEmailOrg = async (email) => {
  const res = await fetch(`${API_BASE_URL}/check-email?email=${encodeURIComponent(email)}`);
  if (!res.ok) {
    throw new Error('Could not verify your organization. Please try again.');
  }
  return res.json();
};

export const WAITLIST_MESSAGE =
  "EdCube is at capacity right now \u2014 you're on the waitlist and we'll email you.";
const NOT_OPEN_MESSAGE = 'Public signups are not open yet';

const ACCOUNT_URL = `${import.meta.env.VITE_API_BASE_URL}/api/account`;

// Error for a failed /api/account/* response. `.status` is the HTTP status and
// `.code` is 'waitlisted' when the backend says so (detail is an object then).
const accountError = async (res) => {
  let detail = null;
  try { detail = (await res.clone().json()).detail; } catch { /* non-JSON body */ }
  const err = await errorFromResponse(res, 'Account request failed');
  if (detail && typeof detail === 'object' && detail.code) err.code = detail.code;
  return err;
};

export const isNotRegisteredError = (err) =>
  err?.status === 403 && /not registered/i.test(err.message || '');

// Waitlisted / not open / not registered: the user definitively has no space (as
// opposed to a transient failure where we shouldn't lock anyone out).
export const isNoSpaceError = (err) =>
  err?.code === 'waitlisted' || err?.status === 503 || isNotRegisteredError(err);

/**
 * `POST /api/account/bootstrap`: idempotent, creates the user's teacher doc in
 * their space (org or public) and returns `{ space, org_id, org_name, plan }`.
 * Requires a verified email. Calls for the same uid share one in-flight request
 * (login and the AuthContext listener can both fire it). Refreshes the ID token
 * afterwards so the new `org` custom claim is picked up.
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

/** `GET /api/account/me` -> `{ space, org_id, org_name, plan }`. */
export const fetchAccount = async () => {
  const res = await authFetch(`${ACCOUNT_URL}/me`);
  if (!res.ok) throw await accountError(res);
  return res.json();
};

/**
 * Sign up a new teacher with email/password. Anyone can sign up: org emails are
 * connected to their org, everything else lands in the public space. The
 * account's space + teacher doc are created by the backend at first verified
 * login (bootstrap) -- the client never writes `teachers/{uid}` here, since that
 * would bypass the signup cap.
 */
export const signupTeacher = async (email, password, displayName) => {
  try {
    const orgCheck = await checkEmailOrg(email);
    if (orgCheck.waitlisted) {
      const err = new Error(WAITLIST_MESSAGE);
      err.code = 'waitlisted';
      throw err;
    }
    if (!orgCheck.allowed) {
      throw new Error('Your organization is not registered with EdCube. Contact us to get added.');
    }

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

/**
 * Login teacher with email/password. Requires a verified email, then bootstraps
 * the account (idempotent) so the user has a space + teacher doc.
 */
export const loginTeacher = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    if (!user.emailVerified) {
      await signOut(auth);
      throw new Error('Please verify your email before logging in. Check your inbox for the verification link.');
    }

    let account;
    try {
      account = await bootstrapAccount(user, user.displayName);
    } catch (err) {
      if (err.code === 'waitlisted') {
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
      // Transient failure (network / 5xx). Don't lock out an existing org member.
      console.warn('Bootstrap failed, falling back to org check:', err);
      let orgCheck;
      try {
        orgCheck = await checkEmailOrg(email);
      } catch {
        orgCheck = null;
      }
      if (orgCheck?.allowed && orgCheck.space !== 'public') {
        account = { space: 'org', org_id: orgCheck.org_id, org_name: orgCheck.org_name, plan: null };
      } else {
        await signOut(auth);
        throw new Error('Could not sign you in right now. Please try again.');
      }
    }

    // Update last login timestamp (best effort)
    try {
      await setDoc(orgSubDoc(db, account.org_id, 'teachers', user.uid), {
        lastLogin: serverTimestamp()
      }, { merge: true });
    } catch (err) {
      console.warn('lastLogin update failed:', err);
    }

    return { success: true, user: user, account };
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
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