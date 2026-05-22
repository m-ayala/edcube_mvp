import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: "AIzaSyB57JGSQrLa-tdnfBzh4exuU-XxoxDzgco",
  authDomain: "edcube-8fe7d.firebaseapp.com",
  projectId: "edcube-8fe7d",
  storageBucket: "edcube-8fe7d.firebasestorage.app",
  messagingSenderId: "890930502654",
  appId: "1:890930502654:web:fcec2d031ae340b9467eaf",
  measurementId: "G-BJ8KVYFK2B"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const analytics = getAnalytics(app);
export default app;

// Prevent Vite HMR from re-running this module — Firebase init is stateful
if (import.meta.hot) import.meta.hot.decline();