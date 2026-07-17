// Firebase SDK initialization — Elite Force (EForce)
import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { getAnalytics, isSupported } from 'firebase/analytics';

// Firebase web config — these are public client-side keys (safe per Google docs).
// Env variable overrides are supported for local development flexibility.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyA3flAWMnQiYeVAOCv_je0SLExI5Vxol4Y',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'mini-telegram-app-c0fb4.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'mini-telegram-app-c0fb4',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'mini-telegram-app-c0fb4.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1025915018170',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:1025915018170:web:f31a5fcfc923f908ecdb83',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || 'https://mini-telegram-app-c0fb4-default-rtdb.firebaseio.com',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-QBB1K2WGFB',
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
