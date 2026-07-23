// Admin Settings Service — Elite Force (EForce)
// Real-time Firestore-backed global configuration

import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';

export interface AdminSettings {
  // Economy
  swapRate: number;          // EForce points per 1 EST token
  eforceTokenValue: number;  // USD value of 1 EST token
  tapReward: number;         // EForce per tap
  comboReward: number;       // bonus multiplier at combo 10
  energyMax: number;

  // Daily Check-in rewards per day (Day 1–7, then cycles)
  dailyClaimRewards: number[];  // [100, 150, 200, 300, 500, 750, 1000]

  // Auto Miner
  autoMinerDuration: number;    // seconds (default 300 = 5min)
  autoMinerReward: number;      // EForce per session
  autoMinerCooldown: number;    // seconds (default 86400 = 24h)
  autoMinerPremiumOnly: boolean;

  // Referral
  referralRewardUsdt: number;   // USDT per valid referral
  referralRewardToken: number;  // EST tokens per valid referral (kept for compatibility)
  referralRewardPoints: number; // EFC points per valid referral
  withdrawMinReferrals: number; // min referrals to unlock withdraw
  withdrawMinAmount: number;    // min USDT to withdraw
  referralBaseLimit: number;    // Base max points claim limit for 0 referrals (default 5000)
  referralStepLimit: number;    // Points added per 5 referrals (default 5000)

  // Ads / Monetag
  adEnabled: boolean;
  adDailyLimit: number;
  adRewardAmount: number;   // EForce per ad watch
  monetagZoneId: string;    // Monetag Zone ID (e.g. '11271101')
  monetagDirectLink?: string; // Optional Monetag Direct Smartlink fallback URL
  adRequireDailyClaim: boolean;
  adRequireTasks: boolean;
  adRequireAutoMiner: boolean;
  adTokenReward: number;         // Tokens reward per ad watch task
  adDailyLimitNormal: number;    // Ad watch limit normal
  adDailyLimitPremium: number;   // Ad watch limit premium

  // Bot Notifications
  botApiUrl: string;             // Backend bot API URL for push notifications

  // Token Sale
  tokenSaleActive: boolean;
  tokenSalePrice: number;
  tokenSaleTotalSupply: number;
  tokenSaleMinPurchase: number;
  tokenSaleMaxPurchase: number;

  // Swap
  swapOpen: boolean;
  withdrawOpen: boolean;
  withdrawRequireReferrals: boolean;
  dailyWithdrawLimit: number;
  dailyTokenWithdrawLimit: number; // EForce token daily withdraw limit
  humanVerificationOpen: boolean;

  // Bot & Admin Username
  botUsername: string;
  adminUsername: string;

  // Social Connections & OAuth
  discordClientId?: string;
  discordAuthUrl?: string;
  xClientId?: string;
  xAuthUrl?: string;
  whatsappNumber?: string;

  // Custom Top Miners (shown as pinned entries on Leaderboard)
  customTopMiners: { name: string; score: number; badge: string }[];

  // App Customization / Branding Images
  loadingLogoUrl: string;
  coinIconUrl: string;
  faviconUrl: string;
  appHeaderLogoUrl: string;
  appHeaderRightLogoUrl: string;
  welcomeBannerUrl: string;
  heroBanners?: { id: string; imageUrl: string; linkUrl?: string; title?: string }[];
  referralBannerUrl: string;
  tasksBannerUrl: string;
  walletBannerUrl: string;
  leaderboardBannerUrl: string;
  usdtIconUrl: string;
  eforceTokenIconUrl: string;
}

export const DEFAULT_ADMIN_SETTINGS: AdminSettings = {
  swapRate: 1000,
  eforceTokenValue: 0.05,
  tapReward: 1,
  comboReward: 3,
  energyMax: 1000,
  dailyClaimRewards: [100, 150, 200, 300, 500, 750, 1000],
  autoMinerDuration: 300,
  autoMinerReward: 500,
  autoMinerCooldown: 86400,
  autoMinerPremiumOnly: false,
  referralRewardUsdt: 0.05,
  referralRewardToken: 0,
  referralRewardPoints: 250,
  withdrawMinReferrals: 10,
  withdrawMinAmount: 0.20,
  referralBaseLimit: 5000,
  referralStepLimit: 5000,
  adEnabled: true,
  adDailyLimit: 5,
  adRewardAmount: 100,
  monetagZoneId: '11271101',
  monetagDirectLink: '',
  adRequireDailyClaim: false,
  adRequireTasks: false,
  adRequireAutoMiner: false,
  adTokenReward: 1,
  adDailyLimitNormal: 10,
  adDailyLimitPremium: 20,
  tokenSaleActive: false,
  tokenSalePrice: 0.05,
  tokenSaleTotalSupply: 500000,
  tokenSaleMinPurchase: 10,
  tokenSaleMaxPurchase: 1000,
  swapOpen: false,
  withdrawOpen: true,
  withdrawRequireReferrals: true,
  dailyWithdrawLimit: 50.00,
  dailyTokenWithdrawLimit: 1000,
  humanVerificationOpen: false,
  botUsername: 'EliteForceBot',
  adminUsername: '',
  discordClientId: '',
  discordAuthUrl: 'https://discord.com/oauth2/authorize?client_id=',
  xClientId: '',
  xAuthUrl: 'https://x.com/oauth2/authorize?client_id=',
  whatsappNumber: '+9613578241',
  botApiUrl: '',
  customTopMiners: [],
  loadingLogoUrl: '/loading-logo.png',
  coinIconUrl: '/coin.png',
  faviconUrl: '/loading-logo.png',
  appHeaderLogoUrl: '/loading-logo.png',
  appHeaderRightLogoUrl: '/coin.png',
  welcomeBannerUrl: '/coin-logo.jpg',
  heroBanners: [],
  referralBannerUrl: '/coin-logo.jpg',
  tasksBannerUrl: '/coin-logo.jpg',
  walletBannerUrl: '/coin.jpg',
  leaderboardBannerUrl: '/coin-logo.jpg',
  usdtIconUrl: 'https://cryptologos.cc/logos/tether-usdt-logo.png',
  eforceTokenIconUrl: '/coin.png',
};

const SETTINGS_DOC = 'adminSettings/config';

/**
 * Subscribe to real-time admin settings.
 */
export const subscribeToAdminSettings = (
  callback: (settings: AdminSettings) => void
): (() => void) => {
  if (!isFirebaseConfigured()) {
    callback(DEFAULT_ADMIN_SETTINGS);
    return () => {};
  }
  const ref = doc(db, 'adminSettings', 'config');
  return onSnapshot(ref, { includeMetadataChanges: true }, (snap) => {
    if (snap.exists()) {
      callback({ ...DEFAULT_ADMIN_SETTINGS, ...snap.data() } as AdminSettings);
    } else {
      callback(DEFAULT_ADMIN_SETTINGS);
    }
  }, (err) => {
    console.warn('[AdminSettings] Firestore listener error:', err);
    callback(DEFAULT_ADMIN_SETTINGS);
  });
};

/**
 * Get admin settings once (non-realtime).
 */
export const getAdminSettings = async (): Promise<AdminSettings> => {
  if (!isFirebaseConfigured()) return DEFAULT_ADMIN_SETTINGS;
  try {
    const snap = await getDoc(doc(db, 'adminSettings', 'config'));
    if (snap.exists()) return { ...DEFAULT_ADMIN_SETTINGS, ...snap.data() } as AdminSettings;
  } catch { /* noop */ }
  return DEFAULT_ADMIN_SETTINGS;
};

/**
 * Admin: Save updated settings to Firestore.
 */
export const saveAdminSettings = async (settings: Partial<AdminSettings>): Promise<boolean> => {
  if (!isFirebaseConfigured()) return false;
  try {
    await setDoc(doc(db, 'adminSettings', 'config'), settings, { merge: true });
    return true;
  } catch {
    return false;
  }
};

void SETTINGS_DOC; // suppress unused warning

/**
 * Calculate Referral Tier Limit for EFC Points claim / withdrawal:
 * 0 Referrals: Base Limit (default 5,000 EFC, configurable by Admin)
 * 5 Referrals: +5,000 EFC (10,000 EFC)
 * 10 Referrals: +5,000 EFC (15,000 EFC)
 * ... up to 50 Referrals (55,000 EFC max)
 */
export const getReferralTierLimit = (
  referralCount: number = 0,
  baseLimit: number = 5000,
  stepLimit: number = 5000
) => {
  const tierIndex = Math.min(10, Math.floor(Math.max(0, referralCount) / 5)); // 0 to 10 tiers (50 refs max)
  const maxPoints = baseLimit + tierIndex * stepLimit;
  const currentTierRefs = tierIndex * 5;
  const nextTierRefs = Math.min(50, (tierIndex + 1) * 5);
  const nextTierMaxPoints = baseLimit + Math.min(10, tierIndex + 1) * stepLimit;

  return {
    maxPoints,
    tierIndex,
    currentTierRefs,
    nextTierRefs,
    nextTierMaxPoints,
    isMaxTier: tierIndex >= 10,
  };
};
