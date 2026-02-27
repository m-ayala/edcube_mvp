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
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './config';

/**
 * Maps email domains to organization IDs.
 * Add a new entry here to onboard a new organization.
 *
 * 'gmail.com': 'icc'  ← temporary for local testing; remove before production
 */
export const DOMAIN_ORG_MAP = {
  'indiacc.org': 'icc',
  'gmail.com':   'icc',  // TODO: remove after testing
};

/**
 * Returns the org_id for a given email, or null if the domain is not allowed.
 */
export const getOrgFromEmail = (email) => {
  const domain = email.split('@')[1]?.toLowerCase();
  return DOMAIN_ORG_MAP[domain] ?? null;
};

/**
 * Sign up a new teacher with email/password.
 * Allowed domains are defined in DOMAIN_ORG_MAP above.
 */
export const signupTeacher = async (email, password, displayName) => {
  try {
    const orgId = getOrgFromEmail(email);
    if (!orgId) {
      const allowed = Object.keys(DOMAIN_ORG_MAP).map(d => `@${d}`).join(', ');
      throw new Error(`Email domain not allowed. Accepted: ${allowed}`);
    }

    // Create user account
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Update display name
    await updateProfile(user, { displayName });

    // Send email verification
    await sendEmailVerification(user);

    // Create teacher profile in Firestore
    await setDoc(doc(db, 'teachers', user.uid), {
      email: user.email,
      displayName: displayName,
      organization: orgId,
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
 * Checks if email is verified before allowing access
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

    // Update last login timestamp
    await setDoc(doc(db, 'teachers', user.uid), {
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