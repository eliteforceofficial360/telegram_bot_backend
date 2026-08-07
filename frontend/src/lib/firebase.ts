// Firebase SDK initialization — Elite Force (EForce)
import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { getAnalytics, isSupported } from 'firebase/analytics';

// Firebase web config — these are public client-side keys (safe per Google docs).
// Env variable overrides are supported for local development flexibility.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDMsN_z5Wn6fZkHeWt5dsfHIJt8bJb3czg',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'elite-force-844d0.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'elite-force-844d0',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'elite-force-844d0.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '230856129702',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:230856129702:web:1baa7bd1bf0af496be4867',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || 'https://elite-force-844d0-default-rtdb.firebaseio.com',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-Q1S2FGG94T',
};

// Prevent duplicate app initialization in hot-reload environments
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);
export const rtdb = getDatabase(app);

// Analytics — only in browser environments that support it
isSupported().then((supported) => {
  if (supported) getAnalytics(app);
}).catch(() => {});

export default app;

// Check if Firebase is properly configured (not placeholder values)
export const isFirebaseConfigured = (): boolean => {
  return !!(firebaseConfig.apiKey && firebaseConfig.projectId);
};
