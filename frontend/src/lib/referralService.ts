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
  runTransaction,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { checkAndAutoClaimReferralTiers } from './referralTierService';

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
export const getReferralLink = (telegramId: number, botUsername = 'Elite_Force_Official_Mining_bot'): string => {
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

    let hashParams: URLSearchParams | null = null;
    try {
      const hashStr = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
      if (hashStr) hashParams = new URLSearchParams(hashStr);
    } catch { /* ignore */ }

    const rawParam = (
      tg?.initDataUnsafe?.start_param ||
      searchParams.get('tgWebAppStartParam') ||
      searchParams.get('start_param') ||
      searchParams.get('startapp') ||
      searchParams.get('start_app') ||
      searchParams.get('ref') ||
      searchParams.get('start') ||
      (hashParams ? (
        hashParams.get('tgWebAppStartParam') ||
        hashParams.get('start_param') ||
        hashParams.get('startapp') ||
        hashParams.get('start_app') ||
        hashParams.get('ref') ||
        hashParams.get('start')
      ) : '') ||
      ''
    ).trim();

    if (rawParam) {
      const digitsMatch = rawParam.match(/\d+/);
      if (digitsMatch) {
        const id = parseInt(digitsMatch[0], 10);
        if (!isNaN(id) && id > 0) {
          try {
            sessionStorage.setItem('savedReferrerId', String(id));
            localStorage.setItem('savedReferrerId', String(id));
          } catch { /* noop */ }
          return id;
        }
      }
    }

    // Fallback: check session/local storage
    const saved = sessionStorage.getItem('savedReferrerId') || localStorage.getItem('savedReferrerId');
    if (saved) {
      const id = parseInt(saved, 10);
      if (!isNaN(id) && id > 0) return id;
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

  // Check device fingerprint match (flag for security audit log, but do not block distinct Telegram accounts)
  const fp1 = (deviceFingerprint || '').trim();
  const fp2 = (referrerDeviceFingerprint || '').trim();
  const isGeneric = fp1 === '' || fp1 === 'unknown' || fp1.length < 5;
  const deviceMatch = !isGeneric && !!(fp1 && fp2 && fp1 === fp2);

  // Valid for all distinct Telegram accounts
  const isValid = referrerId !== referredId;

  const rewardUsdt = (settings.referralRewardUsdt !== undefined && settings.referralRewardUsdt !== null) ? settings.referralRewardUsdt : 0.05;
  const rewardTokens = settings.referralRewardToken ?? 0;
  const rewardPoints = (settings.referralRewardPoints !== undefined && settings.referralRewardPoints !== null) ? settings.referralRewardPoints : 250;

  await setDoc(ref, {
    referrerId,
    referredId,
    createdAt: serverTimestamp(),
    isValid,
    rewardPaid: true,
    deviceMatch,
    networkSuspicion: false,
    rewardUsdt,
    rewardTokens,
    rewardPoints,
  } satisfies Omit<ReferralRecord, 'id'>);

  // Update referrer's referral count, wallet, points, and tokens atomically
  try {
    const userRef = doc(db, 'users', String(referrerId));
    await runTransaction(db, async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) return;
      const data = userSnap.data();
      const currentReferrals = Number(data.referrals || 0);
      const currentReferralCount = Number(data.referralCount || 0);
      const currentWallet = Number(data.wallet || 0);
      const currentPoints = Number(data.points || 0);
      const currentTokens = Number(data.tokens || 0);

      const updatedWallet = Number((currentWallet + rewardUsdt).toFixed(4));
      const updatedPoints = currentPoints + rewardPoints;
      const updatedTokens = currentTokens + rewardTokens;

      transaction.update(userRef, {
        referrals: currentReferrals + 1,
        referralCount: currentReferralCount + 1,
        wallet: updatedWallet,
        points: updatedPoints,
        tokens: updatedTokens,
      });
    });

    // Auto-claim any unlocked referral tiers for the referrer and dispatch Telegram bot notification
    if (isValid) {
      checkAndAutoClaimReferralTiers(referrerId).catch(() => {});
    }

    // Clear savedReferrerId once successfully recorded
    try {
      sessionStorage.removeItem('savedReferrerId');
      localStorage.removeItem('savedReferrerId');
    } catch { /* noop */ }

    // Notify referrer via bot API if enabled
    const targetApi = settings.botApiUrl || import.meta.env.VITE_BOT_API_URL || 'https://telegram-bot-backend-zbvn.onrender.com';
    const notifySecret = settings.botApiUrl ? (settings as any).botApiSecret || '' : '';
    fetch(`${targetApi.replace(/\/$/, '')}/notify/referral`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(notifySecret ? { 'Authorization': `Bearer ${notifySecret}` } : {}),
      },
      body: JSON.stringify({ referrerId, refereeName: `User #${referredId}`, rewardAmount: rewardPoints })
    }).catch(() => {});
  } catch (err) {
    console.error("Error updating referrer rewards:", err);
  }

  return { recorded: true, valid: isValid };
};

import { DEFAULT_REFERRAL_TIERS, type ReferralClaimTier } from './referralTierService';
import { writeBatch, orderBy } from 'firebase/firestore';

/**
 * Retroactively syncs, validates, and claims all referral rewards and tier USDT bonuses for a user.
 * Ensures user gets paid all missing USDT and EFC points for valid referrals.
 */
export const syncAndClaimAllReferralRewards = async (
  telegramId: number
): Promise<{
  totalValid: number;
  usdtEarned: number;
  pointsEarned: number;
  tierUsdtBonus: number;
  tierPointsBonus: number;
  totalUsdtAdded: number;
}> => {
  if (!telegramId || !isFirebaseConfigured()) {
    return { totalValid: 0, usdtEarned: 0, pointsEarned: 0, tierUsdtBonus: 0, tierPointsBonus: 0, totalUsdtAdded: 0 };
  }

  try {
    const settings = await getAdminSettings();
    const perRefUsdt = settings.referralRewardUsdt !== undefined ? settings.referralRewardUsdt : 0.05;
    const perRefPoints = settings.referralRewardPoints !== undefined ? settings.referralRewardPoints : 250;
    const perRefTokens = settings.referralRewardToken ?? 0;

    // Fetch all referral records where referrerId == telegramId
    const q = query(
      collection(db, REFERRALS_COLLECTION),
      where('referrerId', '==', telegramId)
    );
    const snap = await getDocs(q);

    let totalValid = 0;
    let totalRaw = 0;
    const batch = writeBatch(db);
    let batchNeedsCommit = false;

    snap.forEach((docSnap) => {
      totalRaw++;
      const data = docSnap.data();
      if (data.referredId && data.referredId !== telegramId) {
        totalValid++;
        if (!data.isValid) {
          batch.update(docSnap.ref, { isValid: true, rewardPaid: true });
          batchNeedsCommit = true;
        }
      }
    });

    if (batchNeedsCommit) {
      await batch.commit().catch(() => {});
    }

    // Fetch referral claim tiers
    let liveTiers = DEFAULT_REFERRAL_TIERS;
    try {
      const tierSnap = await getDocs(query(collection(db, 'referral_claim_tiers'), orderBy('sortOrder', 'asc')));
      if (!tierSnap.empty) {
        liveTiers = tierSnap.docs
          .map((d) => ({ id: d.id, ...d.data() } as ReferralClaimTier))
          .filter((t) => t.isActive !== false);
      }
    } catch { /* fallback */ }

    const userRef = doc(db, 'users', String(telegramId));
    let usdtEarned = 0;
    let pointsEarned = 0;
    let tierUsdtBonus = 0;
    let tierPointsBonus = 0;
    let totalUsdtAdded = 0;

    await runTransaction(db, async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) return;

      const data = userSnap.data();
      const currentWallet = Number(data.wallet || 0);
      const currentPoints = Number(data.points || 0);
      const currentTokens = Number(data.tokens || 0);
      const userDocReferralCount = Number(data.referralCount ?? data.referrals ?? 0);
      const userDocRawReferrals = Number(data.referrals ?? data.referralCount ?? 0);

      const effectiveValid = Math.max(totalValid, userDocReferralCount);
      const effectiveRaw = Math.max(totalRaw, userDocRawReferrals);

      const claimedTiers: string[] = Array.isArray(data.claimedReferralTiers)
        ? [...data.claimedReferralTiers]
        : [];

      // Calculate total expected base referral USDT, EFC points & EForce tokens
      usdtEarned = Number((effectiveValid * perRefUsdt).toFixed(4));
      pointsEarned = effectiveValid * perRefPoints;
      const tokensEarned = effectiveValid * perRefTokens;

      // Check all unlocked tiers and calculate missing tier bonuses
      const newlyClaimedTiers: string[] = [...claimedTiers];
      for (const tier of liveTiers) {
        if (effectiveValid >= tier.requiredReferrals) {
          tierUsdtBonus += Number(tier.bonusUSDT || 0);
          tierPointsBonus += Number(tier.claimLimit || 0);
          if (!newlyClaimedTiers.includes(tier.id)) {
            newlyClaimedTiers.push(tier.id);
          }
        }
      }

      // Expected total wallet = at least (usdtEarned + tierUsdtBonus)
      const totalReferralUsdt = Number((usdtEarned + tierUsdtBonus).toFixed(4));
      const minExpectedWallet = Math.max(currentWallet, totalReferralUsdt);
      totalUsdtAdded = Number((minExpectedWallet - currentWallet).toFixed(4));

      const minExpectedPoints = Math.max(currentPoints, pointsEarned + tierPointsBonus);
      const minExpectedTokens = Math.max(currentTokens, tokensEarned);

      transaction.update(userRef, {
        referrals: effectiveRaw,
        referralCount: effectiveValid,
        wallet: Number(minExpectedWallet.toFixed(4)),
        points: minExpectedPoints,
        tokens: minExpectedTokens,
        claimedReferralTiers: newlyClaimedTiers,
        updatedAt: new Date().toISOString(),
      });

      totalValid = effectiveValid;
    });

    return { totalValid, usdtEarned, pointsEarned, tierUsdtBonus, tierPointsBonus, totalUsdtAdded };
  } catch (err) {
    console.error('[syncAndClaimAllReferralRewards] Error:', err);
    return { totalValid: 0, usdtEarned: 0, pointsEarned: 0, tierUsdtBonus: 0, tierPointsBonus: 0, totalUsdtAdded: 0 };
  }
};

/**
 * Gets all referrals made by a specific user.
 */
export const getUserReferrals = async (telegramId: number): Promise<ReferralRecord[]> => {
  if (!isFirebaseConfigured()) return [];
  try {
    const q1 = query(collection(db, REFERRALS_COLLECTION), where('referrerId', '==', telegramId));
    let snap = await getDocs(q1);
    if (snap.empty) {
      const q2 = query(collection(db, REFERRALS_COLLECTION), where('referrerId', '==', String(telegramId)));
      snap = await getDocs(q2);
    }
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
