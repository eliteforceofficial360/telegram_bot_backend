// Firestore User Service — Elite Force (EForce)
// Handles creating, reading, and updating user documents

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  onSnapshot,
  collection,
  query,
  where,
  getCountFromServer,
  getDocs,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import type { TelegramUser } from './telegramUser';

import { recordReferral } from './referralService';

export interface FirestoreUser {
  telegramId: number;
  username: string;
  firstName: string;
  lastName: string;
  photoUrl: string;
  isTelegramPremium: boolean;
  country: string;
  joinDate: unknown;
  lastSeen: unknown;
  isOnline: boolean;
  createdAt: unknown;

  /**
   * hasStarted: true only after the user clicks the START mining button.
   * Admin panel counts only users where hasStarted === true.
   */
  hasStarted: boolean;

  // Balances
  points: number;
  tokens: number;        // EST token balance
  wallet: number;        // USDT balance
  walletAddress: string; // BEP-20 address

  // Referrals
  referrals: number;
  referralCount: number; // valid only
  referredBy: number | null;

  // Daily Check-in
  dailyClaimStreak: number;
  lastClaimDate: string | null; // ISO date "YYYY-MM-DD"
  dailyAdWatchDate?: string | null;
  dailyAdWatchCount?: number;

  // Auto Miner
  autoMinerLastUsed: unknown | null;
  autoMinerActive: boolean;

  // Security / Anti-fraud
  flagCount: number;
  banStatus: 'none' | 'temp' | 'permanent';
  banUntil: unknown | null;
  riskLevel: 'safe' | 'medium' | 'high';
  deviceFingerprint: string;
  ipHistory: string[];

  // Device
  device: {
    platform: string;
    browser: string;
    os: string;
    resolution: string;
    language: string;
    timezone: string;
  };

  totalDailyPoints: number;
  leaderboardPinned?: boolean;
  leaderboardHidden?: boolean;
  isVerified?: boolean;
}

const USERS_COLLECTION = 'users';

/**
 * Creates or updates a user document in Firestore on app load.
 */
export const upsertUser = async (
  telegramUser: TelegramUser,
  deviceInfo: { platform: string; browser: string; os: string; resolution: string; language: string; timezone: string },
  _localPoints: number,
  deviceFingerprint = '',
  clientIp = 'Unknown'
): Promise<void> => {
  if (!isFirebaseConfigured()) return;

  const userRef = doc(db, USERS_COLLECTION, String(telegramUser.id));
  const snap = await getDoc(userRef);

  // Cloudinary profile photo upload proxy integration
  const existing = snap.exists() ? snap.data() as FirestoreUser : null;
  let finalPhotoUrl = telegramUser.photoUrl || '';

  if (existing && existing.photoUrl && existing.photoUrl.includes('cloudinary.com')) {
    // Already uploaded previously
    finalPhotoUrl = existing.photoUrl;
  } else if (finalPhotoUrl && !finalPhotoUrl.includes('cloudinary.com')) {
    try {
      const settingsSnap = await getDoc(doc(db, 'adminSettings', 'config'));
      const botApiUrl = settingsSnap.exists() ? settingsSnap.data().botApiUrl || '' : '';
      
      if (botApiUrl) {
        const uploadRes = await fetch(`${botApiUrl.replace(/\/$/, '')}/upload-profile-photo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ telegramId: telegramUser.id, photoUrl: finalPhotoUrl }),
        });
        if (uploadRes.ok) {
          const data = await uploadRes.json();
          if (data.secureUrl) {
            finalPhotoUrl = data.secureUrl;
          }
        }
      }
    } catch (err) {
      console.warn('[Cloudinary] Failed to upload via backend proxy:', err);
    }
  }

  // Check if this device fingerprint is already used by another account (Multi-account detection)
  let isMultiAccount = false;
  if (deviceFingerprint) {
    try {
      const q = query(
        collection(db, USERS_COLLECTION),
        where('deviceFingerprint', '==', deviceFingerprint)
      );
      const fpQuerySnap = await getDocs(q);
      const matches = fpQuerySnap.docs.filter(d => d.id !== String(telegramUser.id));
      if (matches.length > 0) {
        isMultiAccount = true;
        // Write security event for audit log
        await setDoc(doc(db, 'securityEvents', `${telegramUser.id}_fp_overlap_${Date.now()}`), {
          telegramId: telegramUser.id,
          type: 'fingerprint_overlap',
          reason: `Device Fingerprint Overlap detected on ${deviceFingerprint} with account(s): ${matches.map(m => m.id).join(', ')}`,
          severity: 'high',
          createdAt: serverTimestamp(),
        }).catch(() => {});
      }
    } catch { /* ignore query errors if rules block it, fallback to safe */ }
  }

  // Check if this IP is already used by another account (Log only, no auto-ban)
  if (clientIp !== 'Unknown') {
    try {
      const q = query(
        collection(db, USERS_COLLECTION),
        where('ipHistory', 'array-contains', clientIp)
      );
      const ipQuerySnap = await getDocs(q);
      const matches = ipQuerySnap.docs.filter(d => d.id !== String(telegramUser.id));
      if (matches.length > 0) {
        // Just log the IP overlap, no isMultiAccount flag setting
        await setDoc(doc(db, 'securityEvents', `${telegramUser.id}_ip_overlap_${Date.now()}`), {
          telegramId: telegramUser.id,
          type: 'ip_overlap',
          reason: `IP Overlap detected on ${clientIp} with account(s): ${matches.map(m => m.id).join(', ')}`,
          severity: 'low',
          createdAt: serverTimestamp(),
        }).catch(() => {});
      }
    } catch { /* ignore */ }
  }

  if (!snap.exists()) {
    // Parse referral code from WebApp start param
    let referredBy: number | null = null;
    try {
      const tg = (window as any).Telegram?.WebApp;
      const startParam = tg?.initDataUnsafe?.start_param || '';
      if (startParam.startsWith('ref_')) {
        const id = parseInt(startParam.replace('ref_', ''), 10);
        if (!isNaN(id) && id !== telegramUser.id) {
          referredBy = id;
        }
      }
    } catch { /* noop */ }

    // If multi-account, start with 1 flag and temporary ban (24h)
    const initialFlags = isMultiAccount ? 1 : 0;
    const initialBanStatus = isMultiAccount ? 'temp' : 'none';
    const initialBanUntil = isMultiAccount ? Timestamp.fromDate(new Date(Date.now() + 24 * 3600 * 1000)) : null;
    const initialRiskLevel = isMultiAccount ? 'high' : 'safe';

    // Save user doc
    await setDoc(userRef, {
      telegramId: telegramUser.id,
      username: telegramUser.username || '',
      firstName: telegramUser.firstName || '',
      lastName: telegramUser.lastName || '',
      photoUrl: finalPhotoUrl,
      isTelegramPremium: telegramUser.isPremium,
      country: 'Unknown',
      joinDate: serverTimestamp(),
      isOnline: true,
      createdAt: serverTimestamp(),
      lastSeen: serverTimestamp(),
      hasStarted: false,
      points: 0,
      tokens: 0,
      wallet: 0,
      walletAddress: '',
      referrals: 0,
      referralCount: 0,
      referredBy,
      dailyClaimStreak: 0,
      lastClaimDate: null,
      autoMinerLastUsed: null,
      autoMinerActive: false,
      flagCount: initialFlags,
      banStatus: initialBanStatus,
      banUntil: initialBanUntil,
      riskLevel: initialRiskLevel,
      deviceFingerprint,
      ipHistory: clientIp !== 'Unknown' ? [clientIp] : [],
      device: deviceInfo,
      totalDailyPoints: 0,
      isVerified: false,
    });

    // Record referral if present
    if (referredBy) {
      let referrerFp = '';
      try {
        const referrerSnap = await getDoc(doc(db, USERS_COLLECTION, String(referredBy)));
        if (referrerSnap.exists()) {
          referrerFp = referrerSnap.data().deviceFingerprint || '';
        }
      } catch { /* noop */ }
      await recordReferral(referredBy, telegramUser.id, deviceFingerprint, referrerFp).catch(() => {});
    }
  } else {
    const user = snap.data() as FirestoreUser;
    const ipHistory = user.ipHistory || [];
    if (clientIp !== 'Unknown' && !ipHistory.includes(clientIp)) {
      ipHistory.push(clientIp);
    }

    // If new overlap detected, increment flags and apply temporary ban
    let updateFields: any = {
      firstName: telegramUser.firstName || '',
      lastName: telegramUser.lastName || '',
      photoUrl: finalPhotoUrl,
      isTelegramPremium: telegramUser.isPremium,
      isOnline: true,
      lastSeen: serverTimestamp(),
      device: deviceInfo,
      ipHistory,
      ...(deviceFingerprint ? { deviceFingerprint } : {}),
    };

    if (isMultiAccount && user.banStatus === 'none') {
      const newFlags = (user.flagCount || 0) + 1;
      let newBanStatus: 'none' | 'temp' | 'permanent' = 'none';
      let newBanUntil = null;
      if (newFlags === 1) {
        newBanStatus = 'temp';
        newBanUntil = Timestamp.fromDate(new Date(Date.now() + 24 * 3600 * 1000));
      } else if (newFlags === 2) {
        newBanStatus = 'temp';
        newBanUntil = Timestamp.fromDate(new Date(Date.now() + 48 * 3600 * 1000));
      } else {
        newBanStatus = 'permanent';
      }
      updateFields = {
        ...updateFields,
        flagCount: newFlags,
        banStatus: newBanStatus,
        banUntil: newBanUntil,
        riskLevel: 'high',
      };
    }

    await updateDoc(userRef, updateFields);
  }
};

/**
 * Sets the user offline on window close.
 */
export const setUserOffline = async (telegramId: number): Promise<void> => {
  if (!isFirebaseConfigured()) return;
  const userRef = doc(db, USERS_COLLECTION, String(telegramId));
  try {
    await updateDoc(userRef, { isOnline: false, lastSeen: serverTimestamp() });
  } catch { /* ignore */ }
};

/**
 * Syncs local points to Firestore.
 */
export const syncPointsToFirestore = async (telegramId: number, points: number): Promise<void> => {
  if (!isFirebaseConfigured()) return;
  const userRef = doc(db, USERS_COLLECTION, String(telegramId));
  try {
    await updateDoc(userRef, { points });
  } catch { /* noop */ }
};

/**
 * Claims a rewarded ad watch tokens reward.
 * Normal limit is 10, premium is 20. Reward token count is loaded from settings.
 */
export const claimDailyAdVideoReward = async (
  telegramId: number,
  isPremium: boolean,
  tokenReward: number,
  limitNormal: number,
  limitPremium: number
): Promise<{ success: boolean; countToday: number; reason?: string }> => {
  if (!isFirebaseConfigured()) {
    return { success: true, countToday: 1 };
  }

  const userRef = doc(db, USERS_COLLECTION, String(telegramId));
  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      return { success: false, countToday: 0, reason: 'User not initialized.' };
    }

    const userData = snap.data() as any;
    const todayStr = new Date().toISOString().slice(0, 10);
    const lastAdDate = userData.dailyAdWatchDate || '';
    let adCount = userData.dailyAdWatchCount || 0;

    if (lastAdDate !== todayStr) {
      adCount = 0;
    }

    const limit = isPremium ? limitPremium : limitNormal;
    if (adCount >= limit) {
      return { success: false, countToday: adCount, reason: `Daily limit of ${limit} video ads reached.` };
    }

    const nextAdCount = adCount + 1;
    const currentTokens = userData.tokens || 0;
    const updatedTokens = currentTokens + tokenReward;

    await updateDoc(userRef, {
      tokens: updatedTokens,
      dailyAdWatchDate: todayStr,
      dailyAdWatchCount: nextAdCount,
    });

    return { success: true, countToday: nextAdCount };
  } catch (err) {
    console.error("Error in claimDailyAdVideoReward:", err);
    return { success: false, countToday: 0, reason: 'Network error. Please try again.' };
  }
};

/**
 * Gets the real-time count of online users.
 */
export const getOnlineUserCount = async (): Promise<number> => {
  if (!isFirebaseConfigured()) return 0;
  const q = query(collection(db, USERS_COLLECTION), where('isOnline', '==', true));
  const snapshot = await getCountFromServer(q);
  return snapshot.data().count;
};

/**
 * Subscribe to real-time user document updates.
 */
export const subscribeToUser = (
  telegramId: number,
  callback: (data: FirestoreUser | null) => void
): (() => void) => {
  if (!isFirebaseConfigured()) return () => {};
  const userRef = doc(db, USERS_COLLECTION, String(telegramId));
  return onSnapshot(userRef, (snap) => {
    callback(snap.exists() ? (snap.data() as FirestoreUser) : null);
  });
};

/**
 * Updates the risk level of a user.
 */
export const updateRiskLevel = async (
  telegramId: number,
  riskLevel: 'safe' | 'medium' | 'high'
): Promise<void> => {
  if (!isFirebaseConfigured()) return;
  const userRef = doc(db, USERS_COLLECTION, String(telegramId));
  try {
    await updateDoc(userRef, { riskLevel });
  } catch { /* noop */ }
};

/**
 * Flag a user (increment flag count, apply ban if needed).
 */
export const flagUser = async (telegramId: number, reason: string): Promise<void> => {
  if (!isFirebaseConfigured()) return;
  const userRef = doc(db, USERS_COLLECTION, String(telegramId));
  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) return;
    const user = snap.data() as FirestoreUser;
    const newFlagCount = (user.flagCount || 0) + 1;

    const now = new Date();
    let banStatus: 'none' | 'temp' | 'permanent' = 'none';
    let banUntil = null;

    if (newFlagCount === 1) {
      banStatus = 'temp';
      const until = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      banUntil = Timestamp.fromDate(until);
    } else if (newFlagCount === 2) {
      banStatus = 'temp';
      const until = new Date(now.getTime() + 48 * 60 * 60 * 1000);
      banUntil = Timestamp.fromDate(until);
    } else {
      banStatus = 'permanent';
    }

    await updateDoc(userRef, { flagCount: newFlagCount, banStatus, banUntil, riskLevel: 'high' });

    // Write security event
    await setDoc(doc(db, 'securityEvents', `${telegramId}_flag_${Date.now()}`), {
      telegramId,
      type: 'flag',
      reason,
      severity: newFlagCount >= 3 ? 'critical' : 'high',
      banStatus,
      createdAt: serverTimestamp(),
    });
  } catch { /* noop */ }
};

/**
 * Admin: Manually ban or unban a user.
 */
export const adminSetBan = async (
  telegramId: number,
  banStatus: 'none' | 'temp' | 'permanent',
  durationHours?: number
): Promise<boolean> => {
  if (!isFirebaseConfigured()) return false;
  const userRef = doc(db, USERS_COLLECTION, String(telegramId));
  try {
    let banUntil: any = null; // always clear banUntil by default
    if (banStatus === 'temp' && durationHours) {
      banUntil = Timestamp.fromDate(new Date(Date.now() + durationHours * 3600 * 1000));
    }
    // When unbanning: set banStatus to 'none', clear banUntil, clear flagCount
    const updateData: Record<string, any> = { banStatus, banUntil };
    if (banStatus === 'none') {
      updateData.banUntil = null;
    }
    await updateDoc(userRef, updateData);
    return true;
  } catch {
    return false;
  }
};

/**
 * Check if a user is currently banned.
 */
export const checkUserBan = (user: FirestoreUser): { banned: boolean; until?: Date; permanent?: boolean } => {
  if (user.banStatus === 'permanent') return { banned: true, permanent: true };
  if (user.banStatus === 'temp' && user.banUntil) {
    const until = user.banUntil instanceof Timestamp
      ? user.banUntil.toDate()
      : new Date(user.banUntil as string);
    if (until > new Date()) return { banned: true, until };
  }
  return { banned: false };
};

export const getAllUsers = async (): Promise<FirestoreUser[]> => {
  if (!isFirebaseConfigured()) return [];
  try {
    const querySnapshot = await getDocs(collection(db, USERS_COLLECTION));
    const users: FirestoreUser[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data() as FirestoreUser;
      users.push(data);
    });
    // Sort in-memory by points descending
    users.sort((a, b) => (b.points || 0) - (a.points || 0));
    return users;
  } catch (err) {
    console.error("Error in getAllUsers:", err);
    return [];
  }
};


export const subscribeToAllUsers = (
  callback: (users: FirestoreUser[]) => void
): (() => void) => {
  if (!isFirebaseConfigured()) return () => {};
  const usersRef = collection(db, USERS_COLLECTION);
  return onSnapshot(usersRef, (querySnapshot) => {
    const users: FirestoreUser[] = [];
    querySnapshot.forEach((docSnap) => {
      users.push(docSnap.data() as FirestoreUser);
    });
    users.sort((a, b) => (b.points || 0) - (a.points || 0));
    callback(users);
  }, (err) => {
    console.error("Error in subscribeToAllUsers:", err);
  });
};

export const getTotalUserCount = async (): Promise<number> => {
  if (!isFirebaseConfigured()) return 0;
  try {
    const q = query(collection(db, USERS_COLLECTION));
    const snapshot = await getCountFromServer(q);
    return snapshot.data().count;
  } catch (err) {
    console.error("Error in getTotalUserCount:", err);
    return 0;
  }
};

/**
 * Gets count of today's new users.
 */
export const getTodayNewUsersCount = async (): Promise<number> => {
  if (!isFirebaseConfigured()) return 0;
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const q = query(
      collection(db, USERS_COLLECTION),
      where('createdAt', '>=', Timestamp.fromDate(today))
    );
    const snap = await getCountFromServer(q);
    return snap.data().count;
  } catch (err) {
    console.error("Error in getTodayNewUsersCount:", err);
    return 0;
  }
};

/**
 * Marks a user as "started" — called when they click the START mining button.
 * This is when they are counted in admin KPIs.
 */
export const markUserStarted = async (telegramId: number): Promise<void> => {
  if (!isFirebaseConfigured()) return;
  const userRef = doc(db, USERS_COLLECTION, String(telegramId));
  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) return;
    const data = snap.data() as FirestoreUser;
    // Only write if not already started (avoid unnecessary writes)
    if (!data.hasStarted) {
      await updateDoc(userRef, { hasStarted: true });
    }
  } catch { /* noop */ }
};

/**
 * Gets count of flagged users.
 */
export const getFlaggedUsersCount = async (): Promise<number> => {
  if (!isFirebaseConfigured()) return 0;
  try {
    const q = query(collection(db, USERS_COLLECTION), where('flagCount', '>', 0));
    const snap = await getCountFromServer(q);
    return snap.data().count;
  } catch (err) {
    console.error("Error in getFlaggedUsersCount:", err);
    return 0;
  }
};

/**
 * Gets count of banned users.
 */
export const getBannedUsersCount = async (): Promise<number> => {
  if (!isFirebaseConfigured()) return 0;
  try {
    const q = query(
      collection(db, USERS_COLLECTION),
      where('banStatus', 'in', ['temp', 'permanent'])
    );
    const snap = await getCountFromServer(q);
    return snap.data().count;
  } catch (err) {
    console.error("Error in getBannedUsersCount:", err);
    return 0;
  }
};

/**
 * Gets count of premium users.
 */
export const getPremiumUsersCount = async (): Promise<number> => {
  if (!isFirebaseConfigured()) return 0;
  try {
    const q = query(collection(db, USERS_COLLECTION), where('isTelegramPremium', '==', true));
    const snap = await getCountFromServer(q);
    return snap.data().count;
  } catch (err) {
    console.error("Error in getPremiumUsersCount:", err);
    return 0;
  }
};

/**
 * Gets count of active auto miner users.
 */
export const getAutoMinerUsersCount = async (): Promise<number> => {
  if (!isFirebaseConfigured()) return 0;
  try {
    const q = query(collection(db, USERS_COLLECTION), where('autoMinerActive', '==', true));
    const snap = await getCountFromServer(q);
    return snap.data().count;
  } catch (err) {
    console.error("Error in getAutoMinerUsersCount:", err);
    return 0;
  }
};

/**
 * Admin: Directly updates any user's fields in Firestore.
 */
export const updateUserDatabaseValues = async (
  telegramId: number,
  updates: {
    points?: number;
    tokens?: number;
    wallet?: number;
    referrals?: number;
    riskLevel?: 'safe' | 'medium' | 'high';
    flagCount?: number;
    banStatus?: 'none' | 'temp' | 'permanent';
    banUntil?: Timestamp | null;
    walletAddress?: string;
    autoMinerActive?: boolean;
    leaderboardPinned?: boolean;
    leaderboardHidden?: boolean;
    isVerified?: boolean;
  }
): Promise<boolean> => {
  if (!isFirebaseConfigured()) return false;
  const userRef = doc(db, USERS_COLLECTION, String(telegramId));
  try {
    await updateDoc(userRef, updates);
    return true;
  } catch {
    return false;
  }
};

/**
 * Updates wallet address (BEP-20 only).
 */
export const updateWalletAddress = async (telegramId: number, address: string): Promise<boolean> => {
  if (!isFirebaseConfigured()) return false;
  const userRef = doc(db, USERS_COLLECTION, String(telegramId));
  try {
    await updateDoc(userRef, { walletAddress: address });
    return true;
  } catch {
    return false;
  }
};

/**
 * Records a daily check-in and returns the reward.
 * Uses setDoc with merge so it works even if the user doc doesn't exist yet.
 */
export const recordDailyCheckin = async (
  telegramId: number,
  claimRewards: number[]
): Promise<{ success: boolean; reward: number; newStreak: number; reason?: string }> => {
  if (!isFirebaseConfigured()) {
    return { success: true, reward: 100, newStreak: 1 };
  }
  const userRef = doc(db, USERS_COLLECTION, String(telegramId));
  // Retry up to 3 times on transient failures
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        // Doc missing — silently return: user must open app first
        return { success: false, reward: 0, newStreak: 0, reason: 'User not initialized. Open the app first.' };
      }
      const user = snap.data() as FirestoreUser;

      const today = new Date().toISOString().slice(0, 10);
      if (user.lastClaimDate === today) {
        return { success: false, reward: 0, newStreak: user.dailyClaimStreak, reason: 'Already claimed today.' };
      }

      // Check streak continuity
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const newStreak = user.lastClaimDate === yesterday
        ? (user.dailyClaimStreak || 0) + 1
        : 1;

      const rewardIndex = (newStreak - 1) % claimRewards.length;
      const reward = claimRewards[rewardIndex] || 100;
      const newPoints = (user.points || 0) + reward;

      await setDoc(userRef, {
        dailyClaimStreak: newStreak,
        lastClaimDate: today,
        points: newPoints,
      }, { merge: true });

      return { success: true, reward, newStreak };
    } catch (err: unknown) {
      const isNetworkError = err instanceof Error && (
        err.message.includes('network') ||
        err.message.includes('offline') ||
        err.message.includes('unavailable')
      );
      if (isNetworkError && attempt < 2) {
        // Wait then retry
        await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
        continue;
      }
      return { success: false, reward: 0, newStreak: 0, reason: 'Network error. Please try again.' };
    }
  }
  return { success: false, reward: 0, newStreak: 0, reason: 'Network error after retries.' };
};


/**
 * Records auto miner session start.
 */
export const startAutoMinerSession = async (
  telegramId: number,
  cooldownSeconds: number
): Promise<{ success: boolean; reason?: string }> => {
  if (!isFirebaseConfigured()) return { success: true };
  const userRef = doc(db, USERS_COLLECTION, String(telegramId));
  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) return { success: false, reason: 'User not found.' };
    const user = snap.data() as FirestoreUser;

    if (user.autoMinerLastUsed) {
      const lastUsed = user.autoMinerLastUsed instanceof Timestamp
        ? user.autoMinerLastUsed.toDate()
        : new Date(user.autoMinerLastUsed as string);
      const elapsed = (Date.now() - lastUsed.getTime()) / 1000;
      if (elapsed < cooldownSeconds) {
        const remaining = Math.ceil(cooldownSeconds - elapsed);
        const hrs = Math.floor(remaining / 3600);
        const mins = Math.floor((remaining % 3600) / 60);
        return { success: false, reason: `Cooldown: ${hrs}h ${mins}m remaining.` };
      }
    }

    await updateDoc(userRef, { autoMinerActive: true, autoMinerLastUsed: serverTimestamp() });
    return { success: true };
  } catch {
    return { success: false, reason: 'Network error.' };
  }
};

/**
 * Records auto miner session end and credits reward.
 */
export const endAutoMinerSession = async (
  telegramId: number,
  reward: number,
  completionTime?: Date
): Promise<void> => {
  if (!isFirebaseConfigured()) return;
  const userRef = doc(db, USERS_COLLECTION, String(telegramId));
  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) return;
    const user = snap.data() as FirestoreUser;
    if (!user.autoMinerActive) return; // Prevent duplicate payouts
    await updateDoc(userRef, {
      autoMinerActive: false,
      autoMinerLastUsed: completionTime ? Timestamp.fromDate(completionTime) : serverTimestamp(),
      points: (user.points || 0) + reward,
    });
  } catch { /* noop */ }
};

export const getLeaderboardUsers = async (limitCount = 100): Promise<FirestoreUser[]> => {
  if (!isFirebaseConfigured()) return [];
  try {
    const q = query(
      collection(db, USERS_COLLECTION),
      orderBy('points', 'desc'),
      limit(limitCount)
    );
    const querySnapshot = await getDocs(q);
    const users: FirestoreUser[] = [];
    querySnapshot.forEach((docSnap) => {
      const u = docSnap.data() as FirestoreUser;
      if (!u.leaderboardHidden) {
        users.push(u);
      }
    });

    // Pinned users first, then sort by points descending
    users.sort((a, b) => {
      const pinA = a.leaderboardPinned ? 1 : 0;
      const pinB = b.leaderboardPinned ? 1 : 0;
      if (pinA !== pinB) {
        return pinB - pinA;
      }
      return (b.points || 0) - (a.points || 0);
    });

    return users;
  } catch {
    return [];
  }
};

/**
 * Gets the total USDT amount withdrawn by a user today.
 */
export const getUserTodayWithdrawalAmount = async (telegramId: number): Promise<number> => {
  if (!isFirebaseConfigured()) return 0;
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const q = query(
      collection(db, 'withdrawRequests'),
      where('telegramId', '==', telegramId),
      where('createdAt', '>=', Timestamp.fromDate(today))
    );
    const snap = await getDocs(q);
    let sum = 0;
    snap.forEach((d) => {
      const data = d.data();
      // Only count non-rejected, non-banned USDT withdrawals
      if (data.status !== 'Rejected' && data.status !== 'Banned' && data.type === 'usdt') {
        sum += data.amount || 0;
      }
    });
    return sum;
  } catch (err) {
    console.error("Error in getUserTodayWithdrawalAmount:", err);
    return 0;
  }
};

/**
 * Gets the total EForce Token amount withdrawn by a user today.
 */
export const getUserTodayWithdrawalTokens = async (telegramId: number): Promise<number> => {
  if (!isFirebaseConfigured()) return 0;
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const q = query(
      collection(db, 'withdrawRequests'),
      where('telegramId', '==', telegramId),
      where('createdAt', '>=', Timestamp.fromDate(today))
    );
    const snap = await getDocs(q);
    let sum = 0;
    snap.forEach((d) => {
      const data = d.data();
      // Only count non-rejected, non-banned Token withdrawals
      if (data.status !== 'Rejected' && data.status !== 'Banned' && data.type === 'token') {
        sum += data.amount || 0;
      }
    });
    return sum;
  } catch (err) {
    console.error("Error in getUserTodayWithdrawalTokens:", err);
    return 0;
  }
};

/**
 * Withdraw requests management.
 */
export const submitWithdrawRequest = async (
  telegramId: number,
  username: string,
  walletAddress: string,
  amount: number,
  type: 'usdt' | 'token' = 'usdt'
): Promise<{ success: boolean; reason?: string }> => {
  if (!isFirebaseConfigured()) return { success: true };
  try {
    const reqId = `${telegramId}_${Date.now()}`;
    await setDoc(doc(db, 'withdrawRequests', reqId), {
      telegramId,
      username,
      walletAddress,
      amount,
      type,
      status: 'Pending',
      createdAt: serverTimestamp(),
      processedAt: null,
      adminNote: '',
    });
    return { success: true };
  } catch {
    return { success: false, reason: 'Failed to submit request.' };
  }
};

export const getAllWithdrawRequests = async (): Promise<any[]> => {
  if (!isFirebaseConfigured()) return [];
  try {
    const q = query(
      collection(db, 'withdrawRequests'),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    const reqs: any[] = [];
    snap.forEach((d) => reqs.push({ id: d.id, ...d.data() }));
    return reqs;
  } catch {
    return [];
  }
};

export const updateWithdrawRequest = async (
  reqId: string,
  status: 'Approved' | 'Rejected' | 'Banned',
  adminNote = ''
): Promise<boolean> => {
  if (!isFirebaseConfigured()) return false;
  try {
    await updateDoc(doc(db, 'withdrawRequests', reqId), {
      status,
      adminNote,
      processedAt: serverTimestamp(),
    });
    return true;
  } catch {
    return false;
  }
};

export const subscribeToWithdrawRequests = (
  callback: (requests: any[]) => void
): (() => void) => {
  if (!isFirebaseConfigured()) return () => {};
  const q = query(collection(db, 'withdrawRequests'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    const reqs: any[] = [];
    snap.forEach((d) => reqs.push({ id: d.id, ...d.data() }));
    callback(reqs);
  });
};

/**
 * Log admin administrative actions.
 */
export const logAdminAction = async (
  adminTelegramId: number,
  adminUsername: string,
  actionType: string,
  targetTelegramId: number,
  details: string
): Promise<boolean> => {
  if (!isFirebaseConfigured()) return false;
  try {
    const logId = `audit_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    await setDoc(doc(db, 'auditLogs', logId), {
      adminTelegramId,
      adminUsername,
      actionType,
      targetTelegramId,
      details,
      createdAt: serverTimestamp(),
    });
    return true;
  } catch (err) {
    console.error("Error in logAdminAction:", err);
    return false;
  }
};

/**
 * Writes an audit log entry, reading admin session from localStorage automatically.
 */
export const writeAuditLog = async (
  actionType: string,
  targetTelegramId: number,
  details: string
): Promise<void> => {
  try {
    const sessionRaw = localStorage.getItem('admin_session');
    let adminId = 0;
    let adminUser = 'admin';
    if (sessionRaw) {
      const session = JSON.parse(sessionRaw);
      adminId = session.telegramId || session.id || 0;
      adminUser = session.username || session.adminUsername || 'admin';
    }
    await logAdminAction(adminId, adminUser, actionType, targetTelegramId, details);
  } catch { /* noop */ }
};

/**
 * Pin or unpin a user on the leaderboard.
 */
export const adminPinUser = async (
  telegramId: number,
  pinned: boolean
): Promise<void> => {
  if (!isFirebaseConfigured()) return;
  const userRef = doc(db, USERS_COLLECTION, String(telegramId));
  await updateDoc(userRef, { leaderboardPinned: pinned });
  await writeAuditLog(
    pinned ? 'LEADERBOARD_PIN' : 'LEADERBOARD_UNPIN',
    telegramId,
    `User ${telegramId} ${pinned ? 'pinned' : 'unpinned'} on leaderboard`
  );
};

/**
 * Hide or unhide a user from the leaderboard.
 */
export const adminHideUser = async (
  telegramId: number,
  hidden: boolean
): Promise<void> => {
  if (!isFirebaseConfigured()) return;
  const userRef = doc(db, USERS_COLLECTION, String(telegramId));
  await updateDoc(userRef, { leaderboardHidden: hidden });
  await writeAuditLog(
    hidden ? 'LEADERBOARD_HIDE' : 'LEADERBOARD_UNHIDE',
    telegramId,
    `User ${telegramId} ${hidden ? 'hidden from' : 'restored to'} leaderboard`
  );
};

/**
 * Permanently remove a user account from Firestore.
 */
export const adminRemoveUser = async (
  telegramId: number
): Promise<void> => {
  if (!isFirebaseConfigured()) return;
  await writeAuditLog('USER_DELETE', telegramId, `User ${telegramId} deleted by admin`);
  const userRef = doc(db, USERS_COLLECTION, String(telegramId));
  await deleteDoc(userRef);
};

/**
 * Manually add a stub user entry (for admin-created accounts).
 */
export const adminAddUser = async (
  telegramId: number,
  username: string,
  firstName: string,
  points = 0
): Promise<void> => {
  if (!isFirebaseConfigured()) return;
  const userRef = doc(db, USERS_COLLECTION, String(telegramId));
  const existing = await getDoc(userRef);
  if (existing.exists()) throw new Error('User already exists');
  await setDoc(userRef, {
    telegramId,
    username,
    firstName,
    lastName: '',
    points,
    tokens: 0,
    wallet: 0,
    referredBy: 0,
    referralCount: 0,
    hasUnlockedWithdrawal: false,
    walletAddress: '',
    isPremium: false,
    isVerified: false,
    isBanned: false,
    banStatus: 'none',
    banUntil: null,
    flagCount: 0,
    riskLevel: 'safe',
    deviceFingerprint: '',
    ipHistory: [],
    autoMinerActive: false,
    autoMinerLastUsed: null,
    dailyStreak: 0,
    lastDailyClaim: null,
    totalDailyPoints: 0,
    leaderboardPinned: false,
    leaderboardHidden: false,
    createdAt: serverTimestamp(),
    lastActive: serverTimestamp(),
    device: { platform: 'manual', browser: 'manual', os: 'manual', resolution: 'manual', language: 'en', timezone: 'UTC' },
  });
  await writeAuditLog('USER_ADD', telegramId, `User ${telegramId} (@${username}) manually added by admin`);
};

/**
 * Reset all users' leaderboard points to 0.
 */
export const adminResetLeaderboard = async (): Promise<number> => {
  if (!isFirebaseConfigured()) return 0;
  const q = query(collection(db, USERS_COLLECTION), orderBy('points', 'desc'), limit(500));
  const snap = await getDocs(q);
  let count = 0;
  const batch: Promise<void>[] = [];
  snap.forEach((docSnap) => {
    batch.push(updateDoc(docSnap.ref, { points: 0, totalDailyPoints: 0 }));
    count++;
  });
  await Promise.all(batch);
  await writeAuditLog('LEADERBOARD_RESET', 0, `Leaderboard reset — ${count} users cleared`);
  return count;
};

