import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: "AIzaSyDd_LmlhSK7OyEKOtn3ZwRhECwVlXFHuV0",
  authDomain: "edcubeai-fdba7.firebaseapp.com",
  projectId: "edcubeai-fdba7",
  storageBucket: "edcubeai-fdba7.firebasestorage.app",
  messagingSenderId: "356089354206",
  appId: "1:356089354206:web:21b1200a2cb7226fe26f4f",
  measurementId: "G-3G704S82R3"
};

// edcubeai-fdba7's database is the named database `default`, not the implicit
// `(default)` the SDK picks when no ID is given. Must match the backend's
// FIRESTORE_DATABASE (backend/firebase/project.py) and firebase.json.
const FIRESTORE_DATABASE = 'default';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app, FIRESTORE_DATABASE);
export const analytics = getAnalytics(app);
export default app;

// Prevent Vite HMR from re-running this module — Firebase init is stateful
if (import.meta.hot) import.meta.hot.decline();