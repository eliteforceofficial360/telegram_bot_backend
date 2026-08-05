import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, updateDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyA3flAWMnQiYeVAOCv_je0SLExI5Vxol4Y",
  authDomain: "mini-telegram-app-c0fb4.firebaseapp.com",
  databaseURL: "https://mini-telegram-app-c0fb4-default-rtdb.firebaseio.com",
  projectId: "mini-telegram-app-c0fb4",
  storageBucket: "mini-telegram-app-c0fb4.firebasestorage.app",
  messagingSenderId: "1025915018170",
  appId: "1:1025915018170:web:f31a5fcfc923f908ecdb83",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function resetAllUsers() {
  console.log('🔄 Fetching all users from Firestore collection "users"...');
  const snap = await getDocs(collection(db, 'users'));
  console.log(`📊 Found ${snap.size} user documents in database.`);

  let updatedCount = 0;
  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    console.log(`Updating User ID ${docSnap.id} (@${data.username || 'N/A'}) - Old Points: ${data.points || 0}, Tokens: ${data.tokens || 0}`);

    await updateDoc(docSnap.ref, {
      points: 0,
      tokens: 0,
      wallet: 0,
      depositBalance: 0,
      referrals: 0,
      referralCount: 0,
      totalDailyPoints: 0,
      claimedReferralTiers: [],
    });
    updatedCount++;
  }

  console.log(`\n🎉 SUCCESS! Reset points, tokens, USDT wallet, and referrals to 0 for all ${updatedCount} users in Firestore.`);
  process.exit(0);
}

resetAllUsers().catch((err) => {
  console.error('❌ Reset error:', err);
  process.exit(1);
});
