import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const serviceAccount = require('./mini-telegram-app-c0fb4-firebase-adminsdk-fbsvc-ec20076d4c.json');

initializeApp({ credential: cert(serviceAccount) });

const auth = getAuth();

const ADMIN_UID = process.env.ADMIN_UID || '3504353451';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'sourav.sanyal.dev@gmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '01307460389';
const ADMIN_NAME = 'Sourav Sanyal (EForce Admin)';

console.log('🔧 Setting up Firebase Admin user...\n');

try {
  let user;
  try {
    user = await auth.getUser(ADMIN_UID);
    console.log('ℹ️  User already exists — updating credentials...');
    user = await auth.updateUser(ADMIN_UID, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      displayName: ADMIN_NAME,
    });
    console.log('✅ Admin user updated!');
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      console.log('➕ Creating new admin user...');
      user = await auth.createUser({
        uid: ADMIN_UID,
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        displayName: ADMIN_NAME,
      });
      console.log('✅ Admin user created!');
    } else {
      throw err;
    }
  }

  console.log('\n📋 Admin Account Details:');
  console.log('   UID      :', user.uid);
  console.log('   Email    :', user.email);
  console.log('   Name     :', user.displayName);
  console.log('\n🔑 Login Credentials:');
  console.log('   Email    :', ADMIN_EMAIL);
  console.log('   Password :', ADMIN_PASSWORD);
  console.log('\n🌐 Admin Panel: https://telite-force-telegram-app.vercel.app/admin-login');

} catch (err) {
  console.error('❌ Error:', err.message);
}

process.exit(0);
