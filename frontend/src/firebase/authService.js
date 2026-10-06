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

const API_BASE_URL = `${import.meta.env.VITE_API_BASE_URL}/api/orgs`;

/**
 * Check whether an email is registered with an org, via the public
 * `GET /api/orgs/check-email` backend endpoint (backed by the `Users/{org}`
 * registry docs -- there is no frontend DOMAIN_ORG_MAP and no default org,
 * tasks/firestore-reorg-spec.md Round 2, sections A and G). Returns
 * `{ allowed, org_id, org_name }`.
 */
export const checkEmailOrg = async (email) => {
  const res = await fetch(`${API_BASE_URL}/check-email?email=${encodeURIComponent(email)}`);
  if (!res.ok) {
    throw new Error('Could not verify your organization. Please try again.');
  }
  return res.json();
};

/**
 * Sign up a new teacher with email/password. The org is resolved server-side
 * from the email via `checkEmailOrg` -- there's no client-side org picker or
 * domain map to keep in sync.
 */
export const signupTeacher = async (email, password, displayName) => {
  try {
    const orgCheck = await checkEmailOrg(email);
    if (!orgCheck.allowed) {
      throw new Error('Your organization is not registered with EdCube. Contact us to get added.');
    }

    // Create user account
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Update display name
    await updateProfile(user, { displayName });

    // Send email verification
    await sendEmailVerification(user);

    // Create teacher profile in Firestore, under the resolved org
    await setDoc(orgSubDoc(db, orgCheck.org_id, 'teachers', user.uid), {
      email: user.email,
      displayName: displayName,
      organization: orgCheck.org_id,
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp()
    });

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
 * Login teacher with email/password
 * Checks if email is verified before allowing access, then confirms the
 * email is still registered with an org before touching Firestore.
 */
export const loginTeacher = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Check if email is verified
    if (!user.emailVerified) {
      await signOut(auth);
      throw new Error('Please verify your email before logging in. Check your inbox for the verification link.');
    }

    const orgCheck = await checkEmailOrg(email);
    if (!orgCheck.allowed) {
      await signOut(auth);
      throw new Error('Your organization is not registered with EdCube');
    }

    // Update last login timestamp
    await setDoc(orgSubDoc(db, orgCheck.org_id, 'teachers', user.uid), {
      lastLogin: serverTimestamp()
    }, { merge: true });

    return {
      success: true,
      user: user
    };
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