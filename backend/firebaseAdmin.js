import fs from 'fs';
import path from 'path';
import { initializeApp, cert, getApps, getApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

function getFirebaseAdminCredential() {
  // 1. Check for FIREBASE_SERVICE_ACCOUNT (raw JSON string or Base64 encoded JSON string)
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
      const parsed = raw.startsWith('{')
        ? JSON.parse(raw)
        : JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
      return cert(parsed);
    } catch (e) {
      console.warn('[Firebase Admin] Failed to parse FIREBASE_SERVICE_ACCOUNT:', e.message);
    }
  }

  // 2. Check for individual environment variables
  if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    try {
      return cert({
        projectId: process.env.FIREBASE_PROJECT_ID || 'elite-force-844d0',
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      });
    } catch (e) {
      console.warn('[Firebase Admin] Failed to parse FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY:', e.message);
    }
  }

  // 3. Fallback: Search for local Service Account JSON file in workspace root or backend dir
  try {
    const searchDirs = [process.cwd(), path.join(process.cwd(), 'backend')];
    for (const dir of searchDirs) {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        const saFile = files.find(f => f.includes('firebase-adminsdk') && f.endsWith('.json'));
        if (saFile) {
          const content = fs.readFileSync(path.join(dir, saFile), 'utf8');
          return cert(JSON.parse(content));
        }
      }
    }
  } catch (e) {
    /* silent */
  }

  return null;
}

let app;
if (!getApps().length) {
  const credential = getFirebaseAdminCredential();
  if (credential) {
    app = initializeApp({ credential });
    console.log('✅ [Firebase Admin] Initialized with Service Account Credentials!');
  } else {
    app = initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || 'elite-force-844d0' });
    console.warn('⚠️ [Firebase Admin] WARNING: Service Account credentials not found in env or local files.');
    console.warn('⚠️ [Firebase Admin] Please set FIREBASE_SERVICE_ACCOUNT or (FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, FIREBASE_PROJECT_ID) in your environment variables.');
  }
} else {
  app = getApp();
}

export const db = getFirestore();
export { FieldValue };
