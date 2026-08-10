import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const serviceAccount = require('./elite-force-844d0-firebase-adminsdk-fbsvc-4937845c22.json');

initializeApp({ credential: cert(serviceAccount) });

const db = getFirestore();

async function updateSettings() {
  console.log("Updating adminSettings/config in Firestore...");
  await db.collection("adminSettings").doc("config").set({
    blockDesktopWeb: true
  }, { merge: true });
  console.log("✅ Successfully set blockDesktopWeb: true in Firestore!");
  process.exit(0);
}

updateSettings().catch(err => {
  console.error("❌ Error:", err);
  process.exit(1);
});
