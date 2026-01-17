import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyB57JGSQrLa-tdnfBzh4exuU-XxoxDzgco",
  authDomain: "edcube-8fe7d.firebaseapp.com",
  projectId: "edcube-8fe7d",
  storageBucket: "edcube-8fe7d.firebasestorage.app",
  messagingSenderId: "890930502654",
  appId: "1:890930502654:web:fcec2d031ae340b9467eaf",
  measurementId: "G-BJ8KYVFK2B"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;