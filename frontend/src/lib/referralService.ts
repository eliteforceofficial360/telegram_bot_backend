// Referral Service — Elite Force (EForce)
// Handles referral tracking, validation, and reward logic

import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';

export interface ReferralRecord {
  id: string;
  referrerId: number;      // Telegram ID who referred
  referredId: number;      // Telegram ID who was referred
  createdAt: unknown;
  isValid: boolean;
  rewardPaid: boolean;
  deviceMatch: boolean;    // true = same device fingerprint (suspicious)
  networkSuspicion: boolean; // true = flagged for network-level issues
  rewardUsdt: number;
  rewardTokens: number;
  rewardPoints?: number;
}

const REFERRALS_COLLECTION = 'referrals';

/**
 * Generates the referral link for a user.
 */
export const getReferralLink = (telegramId: number, botUsername = 'EliteForceBot'): string => {
  return `https://t.me/${botUsername}?start=ref_${telegramId}`;
};

/**
 * Parses the referrer ID from Telegram WebApp start param or URL params.
 * Returns null if no referral param found.
 */
export const parseReferralFromStartParam = (): number | null => {
  try {
    const tg = (window as any).Telegram?.WebApp;
    const searchParams = new URLSearchParams(window.location.search);
    const startParam = (
      tg?.initDataUnsafe?.start_param ||
      searchParams.get('tgWebAppStartParam') ||
      searchParams.get('start_param') ||
      searchParams.get('ref') ||
      ''
    ).trim();

    if (startParam) {
      const cleanParam = startParam.replace(/^ref_/, '');
      const id = parseInt(cleanParam, 10);
      return !isNaN(id) && id > 0 ? id : null;
    }
  } catch { /* noop */ }
  return null;
};

import { getAdminSettings } from './adminSettingsService';

/**
 * Records a referral relationship in Firestore after multi-signal validation.
 */
export const recordReferral = async (
  referrerId: number,
  referredId: number,
  deviceFingerprint: string,
  referrerDeviceFingerprint?: string
): Promise<{ recorded: boolean; valid: boolean; reason?: string }> => {
  if (!isFirebaseConfigured()) return { recorded: false, valid: false };
  if (!referrerId || !referredId || referrerId === referredId) {
    return { recorded: false, valid: false, reason: 'Self-referral or invalid IDs.' };
  }

  const docId = `${referrerId}_${referredId}`;
  const ref = doc(db, REFERRALS_COLLECTION, docId);

  // Check if already recorded
  const existing = await getDoc(ref);
  if (existing.exists()) return { recorded: false, valid: false, reason: 'Referral already recorded.' };

  // Check if referred user already has a referrer
  const existingReferral = await getDocs(
    query(collection(db, REFERRALS_COLLECTION), where('referredId', '==', referredId))
  );
  if (!existingReferral.empty) {
    return { recorded: false, valid: false, reason: 'User already has a referrer.' };
  }

  // Fetch admin settings for dynamic rewards
  const settings = await getAdminSettings();

  // Check device fingerprint match (suspicious ONLY if non-empty and matching)
  const fp1 = (deviceFingerprint || '').trim();
  const fp2 = (referrerDeviceFingerprint || '').trim();
  const deviceMatch = !!(fp1 && fp2 && fp1 === fp2);

  // Mark valid if non-matching device
  const isValid = !deviceMatch;

  const rewardUsdt = isValid ? (settings.referralRewardUsdt ?? 0.05) : 0;
  const rewardTokens = 0;
  const rewardPoints = isValid ? (settings.referralRewardPoints ?? 250) : 0;

  await setDoc(ref, {
    referrerId,
    referredId,
    createdAt: serverTimestamp(),
    isValid,
    rewardPaid: isValid,
    deviceMatch,
    networkSuspicion: false,
    rewardUsdt,
    rewardTokens,
    rewardPoints,
  } satisfies Omit<ReferralRecord, 'id'>);

  // Update referrer's referral count, wallet, and points in users collection
  if (isValid) {
    try {
      const userRef = doc(db, 'users', String(referrerId));
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const data = userSnap.data();
        const currentReferrals = Number(data.referrals || data.referralCount || 0);
        const currentWallet = Number(data.wallet || 0);
        const currentPoints = Number(data.points || 0);

        await updateDoc(userRef, {
          referrals: currentReferrals + 1,
          referralCount: currentReferrals + 1,
          wallet: Number((currentWallet + rewardUsdt).toFixed(4)),
          points: currentPoints + rewardPoints,
        });

        // Notify referrer via bot API if enabled
        if (settings.botApiUrl) {
          fetch(`${settings.botApiUrl.replace(/\/$/, '')}/notify/referral`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer elite_force_secret_2024`
            },
            body: JSON.stringify({ referrerId, refereeName: `User #${referredId}` })
          }).catch(() => {});
        }
      }
    } catch (err) {
      console.error("Error updating referrer rewards:", err);
    }
  }

  return { recorded: true, valid: isValid };
};

/**
 * Gets all referrals made by a specific user.
 */
export const getUserReferrals = async (telegramId: number): Promise<ReferralRecord[]> => {
  if (!isFirebaseConfigured()) return [];
  try {
    const q = query(
      collection(db, REFERRALS_COLLECTION),
      where('referrerId', '==', telegramId)
    );
    const snap = await getDocs(q);
    const records: ReferralRecord[] = [];
    snap.forEach((d) => records.push({ id: d.id, ...d.data() } as ReferralRecord));
    return records;
  } catch {
    return [];
  }
};

/**
 * Subscribe to real-time referral count for a user.
 */
export const subscribeToReferralCount = (
  telegramId: number,
  callback: (count: number, validCount: number) => void
): (() => void) => {
  if (!isFirebaseConfigured()) return () => {};
  const q = query(
    collection(db, REFERRALS_COLLECTION),
    where('referrerId', '==', telegramId)
  );
  return onSnapshot(q, (snap) => {
    let total = 0;
    let valid = 0;
    snap.forEach((d) => {
      total++;
      if ((d.data() as ReferralRecord).isValid) valid++;
    });
    callback(total, valid);
  });
};

/**
 * Admin: Get all referrals (for fraud detection).
 */
export const getAllReferrals = async (): Promise<ReferralRecord[]> => {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(collection(db, REFERRALS_COLLECTION));
    const records: ReferralRecord[] = [];
    snap.forEach((d) => records.push({ id: d.id, ...d.data() } as ReferralRecord));
    return records;
  } catch {
    return [];
  }
};
