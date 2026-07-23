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

  // Custom Top Miners (shown as pinned entries on Leaderboard)
  customTopMiners: { name: string; score: number; badge: string }[];

  // App Customization / Branding
  loadingLogoUrl: string;
  coinIconUrl: string;
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
  botApiUrl: '',
  customTopMiners: [],
  loadingLogoUrl: '/loading-logo.png',
  coinIconUrl: '/coin.png',
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
  return onSnapshot(ref, (snap) => {
    if (snap.exists()) {
      callback({ ...DEFAULT_ADMIN_SETTINGS, ...snap.data() } as AdminSettings);
    } else {
      callback(DEFAULT_ADMIN_SETTINGS);
    }
  }, () => callback(DEFAULT_ADMIN_SETTINGS));
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
