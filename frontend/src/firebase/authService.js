import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './config';

/**
 * Sign up a new teacher with email/password
 * Restricted to @indiacc.org emails only
 */
export const signupTeacher = async (email, password, displayName) => {
  try {
    // Validate ICC email domain
    if (!email.endsWith('@indiacc.org')) {
      throw new Error('Only @indiacc.org email addresses are allowed');
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
      organization: 'ICC',
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