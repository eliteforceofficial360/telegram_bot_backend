import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const serviceAccount = require('./mini-telegram-app-c0fb4-firebase-adminsdk-fbsvc-ec20076d4c.json');

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function resetAllUserBalances() {
  console.log('🔄 Starting full reset of all user balances to 0 in Firestore...');
  const usersRef = db.collection('users');
  const snap = await usersRef.get();

  if (snap.empty) {
    console.log('⚠️ No users found in Firestore.');
    process.exit(0);
  }

  console.log(`📊 Found ${snap.size} user documents. Resetting points, tokens, wallet, referrals to 0...`);

  let updatedCount = 0;
  const batchSize = 400;
  let batch = db.batch();
  let countInBatch = 0;

  for (const doc of snap.docs) {
    batch.update(doc.ref, {
      points: 0,
      tokens: 0,
      wallet: 0,
      depositBalance: 0,
      referrals: 0,
      referralCount: 0,
      totalDailyPoints: 0,
      claimedReferralTiers: [],
    });

    countInBatch++;
    updatedCount++;

    if (countInBatch >= batchSize) {
      await batch.commit();
      console.log(`✅ Committed batch of ${countInBatch} user updates.`);
      batch = db.batch();
      countInBatch = 0;
    }
  }

  if (countInBatch > 0) {
    await batch.commit();
    console.log(`✅ Committed final batch of ${countInBatch} user updates.`);
  }

  console.log(`🎉 Success! Reset all balances to 0 for ${updatedCount} users.`);
  process.exit(0);
}

resetAllUserBalances().catch((err) => {
  console.error('❌ Error resetting user balances:', err);
  process.exit(1);
});
