// Referral Claim Limit Tier Service — Elite Force (EForce)
// Fully dynamic, real-time Firestore-backed referral tier management.

import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  writeBatch,
  runTransaction,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';

export interface ReferralClaimTier {
  id: string;
  requiredReferrals: number;
  claimLimit: number;
  bonusUSDT: number;
  badge?: string;
  badgeIconUrl?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export const DEFAULT_REFERRAL_TIERS: ReferralClaimTier[] = [
  {
    id: 'tier_0',
    requiredReferrals: 0,
    claimLimit: 5000,
    bonusUSDT: 0.00,
    badge: '⚡ Starter',
    isActive: true,
    sortOrder: 1,
  },
  {
    id: 'tier_5',
    requiredReferrals: 5,
    claimLimit: 10000,
    bonusUSDT: 0.05,
    badge: '🥉 Bronze',
    isActive: true,
    sortOrder: 2,
  },
  {
    id: 'tier_10',
    requiredReferrals: 10,
    claimLimit: 15000,
    bonusUSDT: 0.10,
    badge: '🥈 Silver',
    isActive: true,
    sortOrder: 3,
  },
  {
    id: 'tier_15',
    requiredReferrals: 15,
    claimLimit: 20000,
    bonusUSDT: 0.15,
    badge: '🥇 Gold',
    isActive: true,
    sortOrder: 4,
  },
  {
    id: 'tier_20',
    requiredReferrals: 20,
    claimLimit: 25000,
    bonusUSDT: 0.20,
    badge: '💎 Platinum',
    isActive: true,
    sortOrder: 5,
  },
  {
    id: 'tier_25',
    requiredReferrals: 25,
    claimLimit: 30000,
    bonusUSDT: 0.25,
    badge: '👑 Diamond',
    isActive: true,
    sortOrder: 6,
  },
  {
    id: 'tier_50',
    requiredReferrals: 50,
    claimLimit: 55000,
    bonusUSDT: 0.50,
    badge: '🔥 Master Elite',
    isActive: true,
    sortOrder: 7,
  },
];

const COLLECTION_NAME = 'referral_claim_tiers';

/**
 * Auto-seed default tiers into Firestore if collection is empty.
 */
export const seedDefaultReferralTiers = async (): Promise<boolean> => {
  if (!isFirebaseConfigured()) return false;
  try {
    const colRef = collection(db, COLLECTION_NAME);
    const snap = await getDocs(colRef);
    if (snap.empty) {
      const batch = writeBatch(db);
      const now = new Date().toISOString();
      for (const tier of DEFAULT_REFERRAL_TIERS) {
        const ref = doc(db, COLLECTION_NAME, tier.id);
        batch.set(ref, {
          ...tier,
          createdAt: now,
          updatedAt: now,
        });
      }
      await batch.commit();
      console.log('[ReferralTierService] Default referral tiers seeded successfully.');
      return true;
    }
  } catch (err) {
    console.warn('[ReferralTierService] Seed error:', err);
  }
  return false;
};

/**
 * Subscribe to real-time referral claim tiers from Firestore.
 * Automatically pushes updates to all connected clients when Admin makes any changes.
 */
export const subscribeToReferralTiers = (
  callback: (tiers: ReferralClaimTier[]) => void
): (() => void) => {
  if (!isFirebaseConfigured()) {
    callback(DEFAULT_REFERRAL_TIERS);
    return () => {};
  }

  const colRef = collection(db, COLLECTION_NAME);
  const q = query(colRef, orderBy('sortOrder', 'asc'));

  return onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        // Seed default tiers if empty
        seedDefaultReferralTiers().then(() => callback(DEFAULT_REFERRAL_TIERS));
      } else {
        const list: ReferralClaimTier[] = snap.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            requiredReferrals: Number(data.requiredReferrals ?? 0),
            claimLimit: Number(data.claimLimit ?? 5000),
            bonusUSDT: Number(data.bonusUSDT ?? 0),
            badge: data.badge || '',
            badgeIconUrl: data.badgeIconUrl || '',
            isActive: data.isActive ?? true,
            sortOrder: Number(data.sortOrder ?? 0),
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          };
        });
        // Secondary sort by requiredReferrals if sortOrders are tied
        list.sort((a, b) => a.sortOrder - b.sortOrder || a.requiredReferrals - b.requiredReferrals);
        callback(list);
      }
    },
    (err) => {
      console.warn('[ReferralTierService] Realtime listener error:', err);
      callback(DEFAULT_REFERRAL_TIERS);
    }
  );
};

/**
 * Create a new Referral Claim Tier.
 */
export const createReferralTier = async (
  tierData: Omit<ReferralClaimTier, 'id'>
): Promise<string | null> => {
  if (!isFirebaseConfigured()) return null;
  try {
    const colRef = collection(db, COLLECTION_NAME);
    const newDocRef = doc(colRef);
    const now = new Date().toISOString();
    const payload: ReferralClaimTier = {
      id: newDocRef.id,
      requiredReferrals: Number(tierData.requiredReferrals || 0),
      claimLimit: Number(tierData.claimLimit || 5000),
      bonusUSDT: Number(tierData.bonusUSDT || 0),
      badge: tierData.badge || '',
      badgeIconUrl: tierData.badgeIconUrl || '',
      isActive: tierData.isActive ?? true,
      sortOrder: Number(tierData.sortOrder || 1),
      createdAt: now,
      updatedAt: now,
    };
    await setDoc(newDocRef, payload);
    return newDocRef.id;
  } catch (err) {
    console.error('[ReferralTierService] Create error:', err);
    return null;
  }
};

/**
 * Update an existing Referral Claim Tier.
 * Uses setDoc with merge:true to ensure updates succeed even if doc was loaded from defaults.
 */
export const updateReferralTier = async (
  id: string,
  tierData: Partial<ReferralClaimTier>
): Promise<boolean> => {
  if (!isFirebaseConfigured() || !id) return false;
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    const now = new Date().toISOString();
    const cleanData: Record<string, any> = { updatedAt: now };

    if (tierData.requiredReferrals !== undefined) cleanData.requiredReferrals = Number(tierData.requiredReferrals);
    if (tierData.claimLimit !== undefined) cleanData.claimLimit = Number(tierData.claimLimit);
    if (tierData.bonusUSDT !== undefined) cleanData.bonusUSDT = Number(tierData.bonusUSDT);
    if (tierData.badge !== undefined) cleanData.badge = String(tierData.badge).trim();
    if (tierData.badgeIconUrl !== undefined) cleanData.badgeIconUrl = String(tierData.badgeIconUrl).trim();
    if (tierData.isActive !== undefined) cleanData.isActive = Boolean(tierData.isActive);
    if (tierData.sortOrder !== undefined) cleanData.sortOrder = Number(tierData.sortOrder);

    await setDoc(docRef, cleanData, { merge: true });
    return true;
  } catch (err) {
    console.error('[ReferralTierService] Update error:', err);
    return false;
  }
};

/**
 * Delete a Referral Claim Tier.
 */
export const deleteReferralTier = async (id: string): Promise<boolean> => {
  if (!isFirebaseConfigured() || !id) return false;
  try {
    await deleteDoc(doc(db, COLLECTION_NAME, id));
    return true;
  } catch (err) {
    console.error('[ReferralTierService] Delete error:', err);
    return false;
  }
};

/**
 * Reorder Tiers Batch Update.
 */
export const reorderReferralTiers = async (
  orderedTiers: ReferralClaimTier[]
): Promise<boolean> => {
  if (!isFirebaseConfigured() || !orderedTiers.length) return false;
  try {
    const batch = writeBatch(db);
    const now = new Date().toISOString();
    orderedTiers.forEach((tier, idx) => {
      const docRef = doc(db, COLLECTION_NAME, tier.id);
      batch.update(docRef, { sortOrder: idx + 1, updatedAt: now });
    });
    await batch.commit();
    return true;
  } catch (err) {
    console.error('[ReferralTierService] Reorder error:', err);
    return false;
  }
};

/**
 * Server / Pure calculation logic:
 * Given a user's referral count and active tier list from database,
 * calculates current unlocked tier, next locked tier, current max claim capacity, and bonus.
 */
export const calculateUserReferralTier = (
  referralCount: number = 0,
  tiers: ReferralClaimTier[] = DEFAULT_REFERRAL_TIERS
) => {
  // Filter active tiers and sort ascending by requiredReferrals
  const activeTiers = (tiers && tiers.length > 0 ? tiers : DEFAULT_REFERRAL_TIERS)
    .filter((t) => t.isActive)
    .sort((a, b) => a.requiredReferrals - b.requiredReferrals);

  if (activeTiers.length === 0) {
    return {
      unlockedTier: DEFAULT_REFERRAL_TIERS[0],
      nextTier: null,
      maxPoints: 5000,
      currentBonus: 0,
      remainingReferrals: 0,
      progressPct: 100,
      isMaxTier: true,
    };
  }

  // Find the highest unlocked tier where referralCount >= requiredReferrals
  let unlockedTierIndex = 0;
  for (let i = 0; i < activeTiers.length; i++) {
    if (referralCount >= activeTiers[i].requiredReferrals) {
      unlockedTierIndex = i;
    } else {
      break;
    }
  }

  const unlockedTier = activeTiers[unlockedTierIndex];
  const nextTier = unlockedTierIndex < activeTiers.length - 1 ? activeTiers[unlockedTierIndex + 1] : null;

  const maxPoints = unlockedTier.claimLimit;
  const currentBonus = unlockedTier.bonusUSDT;
  const remainingReferrals = nextTier ? Math.max(0, nextTier.requiredReferrals - referralCount) : 0;

  // Calculate progress percentage to next tier
  let progressPct = 100;
  if (nextTier) {
    const range = nextTier.requiredReferrals - unlockedTier.requiredReferrals;
    const currentProgress = referralCount - unlockedTier.requiredReferrals;
    progressPct = range > 0 ? Math.min(100, Math.max(0, (currentProgress / range) * 100)) : 100;
  }

  return {
    unlockedTier,
    nextTier,
    maxPoints,
    currentBonus,
    remainingReferrals,
    progressPct,
    isMaxTier: !nextTier,
  };
};

/**
 * Formats a tier badge string to guarantee clean full rank names instead of single letters or broken badges.
 * E.g., '⚡ S' -> 'Starter', '🏅 B' -> 'Bronze', '🥈 S' -> 'Silver', '🎗 G' -> 'Gold', '🔷 P' -> 'Platinum', '👑 D' -> 'Diamond', '🔥 ME' -> 'Master Elite'
 */
export const formatTierBadgeName = (badge?: string, requiredReferrals: number = 0): string => {
  if (!badge || !badge.trim()) {
    if (requiredReferrals === 0) return 'Starter';
    if (requiredReferrals <= 5) return 'Bronze';
    if (requiredReferrals <= 10) return 'Silver';
    if (requiredReferrals <= 15) return 'Gold';
    if (requiredReferrals <= 20) return 'Platinum';
    if (requiredReferrals <= 25) return 'Diamond';
    return 'Master Elite';
  }

  return badge.trim();
};

/**
 * Returns formatted rank badge metadata with matching icon, name, and full label string.
 */
export const getTierBadgeWithIcon = (badge?: string, requiredReferrals: number = 0): { icon: string; name: string; full: string } => {
  const fullBadge = badge && badge.trim() ? badge.trim() : formatTierBadgeName(badge, requiredReferrals);
  
  // Try matching leading emoji icon if present
  const emojiMatch = fullBadge.match(/^([\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F1E6}-\u{1F1FF}])/u);
  let icon = emojiMatch ? emojiMatch[0] : '';
  
  if (!icon) {
    const lower = fullBadge.toLowerCase();
    if (lower.includes('bronze')) icon = '🥉';
    else if (lower.includes('silver')) icon = '🥈';
    else if (lower.includes('gold')) icon = '🥇';
    else if (lower.includes('platinum')) icon = '💎';
    else if (lower.includes('diamond')) icon = '👑';
    else if (lower.includes('master') || lower.includes('grand')) icon = '🪽';
    else if (lower.includes('starter')) icon = '⚡';
    else icon = '🎖️';
  }

  const name = fullBadge.replace(/^([\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F1E6}-\u{1F1FF}])\s*/u, '').trim() || fullBadge;

  return {
    icon,
    name,
    full: fullBadge.includes(icon) ? fullBadge : `${icon} ${fullBadge}`,
  };
};

const getBotApiUrl = () => {
  const stored = localStorage.getItem('adminSettings');
  if (stored) {
    try {
      const s = JSON.parse(stored);
      if (s.botApiUrl) return s.botApiUrl.replace(/\/$/, '');
    } catch { /* ignore */ }
  }
  return (import.meta.env.VITE_BOT_API_URL || '').trim() || 'https://telegram-bot-backend-zbvn.onrender.com';
};

/**
 * Triggers a bot notification to the user via Telegram when a referral tier is unlocked.
 */
export const triggerTierUnlockedNotification = async (
  telegramId: number,
  tier: ReferralClaimTier
) => {
  try {
    const targetApi = getBotApiUrl();
    const tierName = formatTierBadgeName(tier.badge, tier.requiredReferrals);
    await fetch(`${targetApi}/notify/tier-unlocked`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telegramId,
        tierBadge: tier.badge || '',
        tierName,
        requiredReferrals: tier.requiredReferrals,
        pointsAdded: tier.claimLimit,
        usdtAdded: tier.bonusUSDT,
      }),
    });
  } catch (err) {
    console.warn('[ReferralTierService] Notification send warning:', err);
  }
};

/**
 * Automatically checks all active referral tiers for a user and auto-claims any unlocked rewards.
 * Credited directly to user's points & wallet, and sends a Telegram bot message notification.
 */
export const checkAndAutoClaimReferralTiers = async (
  telegramId: number,
  tiersList?: ReferralClaimTier[]
): Promise<{ claimedCount: number; pointsAdded: number; usdtAdded: number; newlyClaimed: ReferralClaimTier[] }> => {
  if (!telegramId || !isFirebaseConfigured()) {
    return { claimedCount: 0, pointsAdded: 0, usdtAdded: 0, newlyClaimed: [] };
  }

  try {
    let activeTiers = tiersList || [];
    if (activeTiers.length === 0) {
      const colRef = collection(db, COLLECTION_NAME);
      const snap = await getDocs(query(colRef, orderBy('sortOrder', 'asc')));
      if (!snap.empty) {
        activeTiers = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as ReferralClaimTier))
          .filter((t) => t.isActive !== false);
      } else {
        activeTiers = DEFAULT_REFERRAL_TIERS;
      }
    }

    const userRef = doc(db, 'users', String(telegramId));
    let totalPointsAdded = 0;
    let totalUsdtAdded = 0;
    const newlyClaimed: ReferralClaimTier[] = [];

    await runTransaction(db, async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) return;

      const data = userSnap.data();
      const currentReferralCount = Number(data.referralCount ?? data.referrals ?? 0);
      const claimedTiers: string[] = Array.isArray(data.claimedReferralTiers)
        ? [...data.claimedReferralTiers]
        : [];

      let currentPoints = Number(data.points || 0);
      let currentWallet = Number(data.wallet || 0);
      let updated = false;

      for (const tier of activeTiers) {
        if (currentReferralCount >= tier.requiredReferrals && !claimedTiers.includes(tier.id)) {
          const pts = Number(tier.claimLimit || 0);
          const usdt = Number(tier.bonusUSDT || 0);

          currentPoints += pts;
          currentWallet += usdt;
          claimedTiers.push(tier.id);
          newlyClaimed.push(tier);

          totalPointsAdded += pts;
          totalUsdtAdded += usdt;
          updated = true;
        }
      }

      if (updated) {
        transaction.update(userRef, {
          points: currentPoints,
          wallet: Number(currentWallet.toFixed(4)),
          claimedReferralTiers: claimedTiers,
          updatedAt: new Date().toISOString(),
        });
      }
    });

    // Send Telegram Bot notifications for all newly auto-claimed tiers
    for (const tier of newlyClaimed) {
      triggerTierUnlockedNotification(telegramId, tier).catch(() => {});
    }

    return {
      claimedCount: newlyClaimed.length,
      pointsAdded: totalPointsAdded,
      usdtAdded: totalUsdtAdded,
      newlyClaimed,
    };
  } catch (err) {
    console.error('[ReferralTierService] checkAndAutoClaimReferralTiers error:', err);
    return { claimedCount: 0, pointsAdded: 0, usdtAdded: 0, newlyClaimed: [] };
  }
};

/**
 * Claim a specific Dynamic Referral Tier Reward manually if ever needed.
 * Atomically checks referral count, ensures not double claimed,
 * and adds claimLimit (EFC points) and bonusUSDT (USDT wallet) to user's Firestore record.
 */
export const claimReferralTierReward = async (
  telegramId: number,
  tier: ReferralClaimTier
): Promise<{ success: boolean; reason?: string; pointsAdded?: number; usdtAdded?: number }> => {
  if (!telegramId || !tier || !tier.id) {
    return { success: false, reason: 'Invalid parameters or user ID.' };
  }

  if (!isFirebaseConfigured()) {
    return {
      success: true,
      pointsAdded: Number(tier.claimLimit || 0),
      usdtAdded: Number(tier.bonusUSDT || 0),
    };
  }

  try {
    const userRef = doc(db, 'users', String(telegramId));
    let pointsAdded = 0;
    let usdtAdded = 0;

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(userRef);
      if (!snap.exists()) {
        throw new Error('User profile not found in database.');
      }

      const data = snap.data();
      const claimedTiers: string[] = Array.isArray(data.claimedReferralTiers)
        ? data.claimedReferralTiers
        : [];

      if (claimedTiers.includes(tier.id)) {
        throw new Error('You have already claimed this tier reward!');
      }

      const totalRef = Number(data.referralCount ?? data.referrals ?? 0);
      if (totalRef < tier.requiredReferrals) {
        throw new Error(`You need at least ${tier.requiredReferrals} valid referrals to claim this tier.`);
      }

      pointsAdded = Number(tier.claimLimit || 0);
      usdtAdded = Number(tier.bonusUSDT || 0);

      const currentPoints = Number(data.points || 0);
      const currentWallet = Number(data.wallet || 0);

      const updatedPoints = currentPoints + pointsAdded;
      const updatedWallet = Number((currentWallet + usdtAdded).toFixed(4));
      const updatedClaimedTiers = [...claimedTiers, tier.id];

      transaction.update(userRef, {
        points: updatedPoints,
        wallet: updatedWallet,
        claimedReferralTiers: updatedClaimedTiers,
        updatedAt: new Date().toISOString(),
      });
    });

    triggerTierUnlockedNotification(telegramId, tier).catch(() => {});

    return { success: true, pointsAdded, usdtAdded };
  } catch (err: any) {
    console.error('[ReferralTierService] claimReferralTierReward error:', err);
    return { success: false, reason: err.message || 'Failed to claim tier reward.' };
  }
};


