const admin = require("firebase-admin");
const serviceAccount = require("./mini-telegram-app-c0fb4-firebase-adminsdk-fbsvc-ec20076d4c.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://mini-telegram-app-c0fb4-default-rtdb.firebaseio.com"
});

const ADMIN_UID = process.env.ADMIN_UID || "3504353451";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "sourav.sanyal.dev@gmail.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "01307460389";
const ADMIN_DISPLAY = "Sourav Sanyal (EForce Admin)";

async function createOrUpdateAdmin() {
  console.log("🔧 Setting up Firebase Admin user...\n");

  try {
    // Try to get existing user first
    let user;
    try {
      user = await admin.auth().getUser(ADMIN_UID);
      console.log("✅ User already exists. Updating...");
      user = await admin.auth().updateUser(ADMIN_UID, {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        displayName: ADMIN_DISPLAY,
      });
      console.log("✅ Admin user updated successfully!");
    } catch (err) {
      if (err.code === "auth/user-not-found") {
        // Create new user
        console.log("➕ Creating new admin user...");
        user = await admin.auth().createUser({
          uid: ADMIN_UID,
          email: ADMIN_EMAIL,
          password: ADMIN_PASSWORD,
          displayName: ADMIN_DISPLAY,
        });
        console.log("✅ Admin user created successfully!");
      } else {
        throw err;
      }
    }

    console.log("\n📋 Admin Account Details:");
    console.log("   UID        :", user.uid);
    console.log("   Email      :", user.email);
    console.log("   Display    :", user.displayName);
    console.log("\n🔑 Login Credentials:");
    console.log("   Email      :", ADMIN_EMAIL);
    console.log("   Password   :", ADMIN_PASSWORD);
    console.log("\n🌐 Admin Panel URL: https://telite-force-telegram-app.vercel.app/advance-admin-login");

  } catch (err) {
    console.error("❌ Error:", err.message);
  }

  process.exit(0);
}

createOrUpdateAdmin();
