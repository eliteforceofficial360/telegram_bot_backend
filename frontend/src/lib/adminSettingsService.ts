// Admin Settings Service — Elite Force (EForce)
// Real-time Firestore-backed global configuration

import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  onSnapshot,
  QuerySnapshot,
  DocumentData,
  QueryDocumentSnapshot,
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
  dailyClaimRewards: number[];          // Standard users [100, 150, 200, 300, 500, 750, 1000]
  premiumDailyClaimRewards: number[];   // Telegram Premium users [200, 300, 400, 600, 1000, 1500, 2000]

  // Auto Miner (Standard vs Telegram Premium)
  autoMinerDuration: number;            // Standard seconds (default 300 = 5min)
  autoMinerReward: number;              // Standard EForce per session
  premiumAutoMinerDuration: number;     // Telegram Premium seconds (default 300 = 5min or custom)
  premiumAutoMinerReward: number;       // Telegram Premium EForce per session
  autoMinerCooldown: number;            // seconds (default 86400 = 24h)
  autoMinerPremiumOnly: boolean;

  // Referral
  referralRewardUsdt: number;   // USDT per valid referral
  referralRewardToken: number;  // EST tokens per valid referral (kept for compatibility)
  referralRewardPoints: number; // EFC points per valid referral
  withdrawMinReferrals: number; // min referrals to unlock withdraw
  withdrawMinAmount: number;    // min USDT to withdraw
  withdrawMinTokenAmount: number; // min EForce tokens (EST) to withdraw
  referralBaseLimit: number;    // Base max points claim limit for 0 referrals (default 5000)
  referralStepLimit: number;    // Points added per 5 referrals (default 5000)

  // Ads / Monetag
  adEnabled: boolean;
  adDailyLimit: number;
  adRewardAmount: number;        // Standard EForce per ad watch
  premiumAdRewardAmount: number; // Telegram Premium EForce per ad watch
  monetagZoneId: string;         // Monetag Zone ID (e.g. '11271101')
  monetagDirectLink?: string;    // Optional Monetag Direct Smartlink fallback URL
  adRequireDailyClaim: boolean;
  adRequireTasks: boolean;
  adRequireAutoMiner: boolean;
  adTokenReward: number;         // Tokens reward per ad watch task
  adDailyLimitNormal: number;    // Ad watch limit normal
  adDailyLimitPremium: number;   // Ad watch limit premium

  // Bot Notifications & App Configuration
  botApiUrl: string;             // Backend bot API URL for push notifications
  miniAppUrl: string;            // Telegram Mini App Web URL (e.g. https://mini-telegram-app-c0fb4.web.app)
  botStartMessage: string;       // Custom welcome text sent when user runs /start in Telegram
  botStartButtonText: string;    // Custom text for launch app inline button (e.g. 🔥 Launch Elite Force App 🔥)

  // Notification Center Settings
  notificationSettings?: {
    enabled: boolean;
    events: Record<string, {
      enabled: boolean;
      template: string;
      buttonText: string;
      buttonTab: string;
    }>;
  };

  // Force Join & Community Verification Gate
  forceJoinEnabled: boolean;
  telegramChannelUrl: string;
  telegramChannelId: string;
  telegramGroupUrl: string;
  telegramGroupId: string;
  verificationCooldownSeconds: number;

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

  // Desktop/Web Telegram Block
  blockDesktopWeb: boolean; // Block users accessing from web.telegram.org or Telegram Desktop

  // Universal Reward Reversal System
  rewardReversalEnabled?: boolean;
  reversalIntervalHours?: number;
  gracePeriodHours?: number;
  reversalDeductionType?: 'full' | 'partial';
  autoReVerificationEnabled?: boolean;

  // Bot & Admin Username & Private Notification Target
  botUsername: string;
  adminUsername: string;
  adminTelegramId?: string;
  apiSecret?: string;

  // Social Connections & OAuth
  discordClientId?: string;
  discordAuthUrl?: string;
  xClientId?: string;
  xAuthUrl?: string;
  whatsappNumber?: string;

  // Custom Top Miners (shown as pinned entries on Leaderboard)
  customTopMiners: { name: string; score: number; badge: string }[];

  // Market Fees & Escrow Settings
  marketServiceFeePercent?: number;       // default 25%
  marketReviewFee?: number;              // default 10 EFC
  marketVerificationFeeManual?: number;   // default 1.5 EFC
  marketVerificationFeeAuto?: number;     // default 0.5 EFC

  // BEP-20 Deposit System
  bep20DepositAddress?: string;           // Admin BEP-20 Wallet Deposit Address
  bep20DepositRate?: number;              // EFC Points granted per 1 USDT (default 100)
  bep20DepositMinAmount?: number;         // Min USDT deposit amount (default 1.0)
  bep20DepositInstructions?: string;      // Custom instructions for depositors

  // Market Maintenance & Access Control
  marketStatus?: 'on' | 'off' | 'maintenance';
  marketMaintenanceUntil?: string;
  marketLockReason?: string;

  // App Customization / Branding Images
  loadingLogoUrl: string;
  coinIconUrl: string;
  faviconUrl: string;
  appHeaderLogoUrl?: string;
  appHeaderRightLogoUrl?: string;
  welcomeBannerUrl?: string;
  heroBanners?: { id: string; imageUrl: string; linkUrl?: string; title?: string }[];
  referralBannerUrl?: string;
  tasksBannerUrl?: string;
  walletBannerUrl?: string;
  leaderboardBannerUrl?: string;
  usdtIconUrl?: string;
  eforceTokenIconUrl?: string;

  // Official Mini App Developer Information Sector
  devAppShowCard?: boolean;
  devAppName?: string;
  devAppRole?: string;
  devAppBio?: string;
  devAppTelegram?: string;
  devAppPortfolioUrl?: string;
  devAppVerifiedBadge?: string;
  devAppContactUrl?: string;
  devAppButtonText?: string;
  devAppVerifiedTag?: string;
  devAppTechStack?: string[];
}

export const DEFAULT_ADMIN_SETTINGS: AdminSettings = {
  marketServiceFeePercent: 25,
  marketReviewFee: 10,
  marketVerificationFeeManual: 1.5,
  marketVerificationFeeAuto: 0.5,
  bep20DepositAddress: '0x0000000000000000000000000000000000000000',
  bep20DepositRate: 100,
  bep20DepositMinAmount: 1.0,
  bep20DepositInstructions: 'Send USDT (BEP-20 / BSC Network) to the address below, then submit your transaction hash (TxHash) for verification.',
  swapRate: 100,
  eforceTokenValue: 0.05,
  tapReward: 1,
  comboReward: 2,
  energyMax: 1000,
  dailyClaimRewards: [100, 150, 200, 300, 500, 750, 1000],
  premiumDailyClaimRewards: [200, 300, 400, 600, 1000, 1500, 2000],
  autoMinerDuration: 300,
  autoMinerReward: 500,
  premiumAutoMinerDuration: 300,
  premiumAutoMinerReward: 1000,
  autoMinerCooldown: 86400,
  autoMinerPremiumOnly: false,
  referralRewardUsdt: 0.05,
  referralRewardToken: 0,
  referralRewardPoints: 250,
  withdrawMinReferrals: 10,
  withdrawMinAmount: 0.20,
  withdrawMinTokenAmount: 5.0,
  referralBaseLimit: 5000,
  referralStepLimit: 5000,
  adEnabled: true,
  adDailyLimit: 5,
  adRewardAmount: 100,
  premiumAdRewardAmount: 200,
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
  tokenSaleTotalSupply: 1000000,
  tokenSaleMinPurchase: 10,
  tokenSaleMaxPurchase: 1000,
  swapOpen: false,
  withdrawOpen: true,
  withdrawRequireReferrals: true,
  dailyWithdrawLimit: 50.00,
  dailyTokenWithdrawLimit: 1000,
  humanVerificationOpen: false,
  blockDesktopWeb: true,
  rewardReversalEnabled: true,
  reversalIntervalHours: 12,
  gracePeriodHours: 24,
  reversalDeductionType: 'full',
  autoReVerificationEnabled: true,
  botUsername: 'Elite_Force_Official_Mining_bot',
  adminUsername: '',
  adminTelegramId: '',
  discordClientId: '',
  discordAuthUrl: 'https://discord.com/oauth2/authorize?client_id=',
  xClientId: '',
  xAuthUrl: 'https://x.com/oauth2/authorize?client_id=',
  whatsappNumber: '+9613578241',
  botApiUrl: 'https://telegram-bot-backend-zbvn.onrender.com',
  apiSecret: 'elite_force_secret_2024',
  miniAppUrl: 'https://elite-force-844d0.web.app',
  botStartMessage: `🔥 <b>ELITE FORCE — EForce Token</b> 🔥\n\n👋 Welcome, <b>{name}</b>!\n\nYou've just entered the <b>next-generation Web3 mining ecosystem</b>. Elite Force rewards you for every action.\n\n━━━━━━━━━━━━━━━━━━━━\n⛏️  <b>Mine</b> EForce tokens passively\n✅  <b>Complete missions</b> & earn rewards\n🏆  <b>Climb</b> the global leaderboard\n👥  <b>Refer friends</b> and earn commissions\n💸  <b>Withdraw</b> USDT to your BEP-20 wallet\n━━━━━━━━━━━━━━━━━━━━\n\n🚀 Tap the button below to launch your dashboard!`,
  botStartButtonText: '🔥 Launch Elite Force App 🔥',
  forceJoinEnabled: true,
  telegramChannelUrl: 'https://t.me/EliteForceChannel',
  telegramChannelId: '@EliteForceChannel',
  telegramGroupUrl: 'https://t.me/EliteForceGroup',
  telegramGroupId: '@EliteForceGroup',
  verificationCooldownSeconds: 30,
  marketStatus: 'on',
  marketMaintenanceUntil: '',
  marketLockReason: 'Task Market is currently undergoing system maintenance and campaign security audits.',
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
  usdtIconUrl: 'https://assets.coingecko.com/coins/images/325/large/Tether.png',
  eforceTokenIconUrl: '/coin.png',
  devAppShowCard: true,
  devAppName: 'Elite Force Dev Team',
  devAppRole: 'Full-Stack Telegram Mini App & Systems Developer',
  devAppBio: 'Lead System Creator of Elite Force Telegram Mini App & Ecosystem. Specialist in React, Node.js, Web3 Bot Automation, Realtime Firebase Architecture & Custom Mini Apps.',
  devAppTelegram: '@EliteForceDev',
  devAppPortfolioUrl: 'https://t.me/EliteForceDev',
  devAppVerifiedBadge: '⚡ OFFICIAL MINI APP CREATOR',
  devAppContactUrl: 'https://t.me/EliteForceDev',
  devAppButtonText: '💬 Contact Developer (@EliteForceDev)',
  devAppVerifiedTag: 'VERIFIED SYSTEM',
  devAppTechStack: [
    '🚀 Mini App Specialist',
    '⚡ Node.js & Bot Engines',
    '🔐 Web3 & Smart Contracts',
    '📊 Realtime Firebase Architecture',
  ],
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

  let currentConfig: Partial<AdminSettings> = {};
  let currentBannersFromColl: { id: string; imageUrl: string; linkUrl?: string; title?: string }[] = [];

  const emit = () => {
    const combinedBanners = [...(currentConfig.heroBanners || [])];
    currentBannersFromColl.forEach((b) => {
      if (!combinedBanners.some((existing) => existing.id === b.id)) {
        combinedBanners.push(b);
      }
    });
    const finalSettings = {
      ...DEFAULT_ADMIN_SETTINGS,
      ...currentConfig,
      heroBanners: combinedBanners,
    } as AdminSettings;

    if (!finalSettings.botApiUrl || !finalSettings.botApiUrl.trim()) {
      finalSettings.botApiUrl = 'https://telegram-bot-backend-zbvn.onrender.com';
    }
    if (!finalSettings.miniAppUrl || !finalSettings.miniAppUrl.trim()) {
      finalSettings.miniAppUrl = 'https://elite-force-844d0.web.app';
    }
    if (!finalSettings.devAppName || !finalSettings.devAppName.trim()) {
      finalSettings.devAppName = DEFAULT_ADMIN_SETTINGS.devAppName;
    }
    if (!finalSettings.devAppRole || !finalSettings.devAppRole.trim()) {
      finalSettings.devAppRole = DEFAULT_ADMIN_SETTINGS.devAppRole;
    }
    if (!finalSettings.devAppBio || !finalSettings.devAppBio.trim()) {
      finalSettings.devAppBio = DEFAULT_ADMIN_SETTINGS.devAppBio;
    }
    if (!finalSettings.devAppVerifiedBadge || !finalSettings.devAppVerifiedBadge.trim()) {
      finalSettings.devAppVerifiedBadge = DEFAULT_ADMIN_SETTINGS.devAppVerifiedBadge;
    }
    if (!finalSettings.devAppContactUrl || !finalSettings.devAppContactUrl.trim()) {
      finalSettings.devAppContactUrl = DEFAULT_ADMIN_SETTINGS.devAppContactUrl;
    }
    if (!finalSettings.devAppButtonText || !finalSettings.devAppButtonText.trim()) {
      finalSettings.devAppButtonText = DEFAULT_ADMIN_SETTINGS.devAppButtonText;
    }
    if (!finalSettings.devAppVerifiedTag || !finalSettings.devAppVerifiedTag.trim()) {
      finalSettings.devAppVerifiedTag = DEFAULT_ADMIN_SETTINGS.devAppVerifiedTag;
    }
    if (!finalSettings.devAppTechStack || !Array.isArray(finalSettings.devAppTechStack) || finalSettings.devAppTechStack.length === 0) {
      finalSettings.devAppTechStack = DEFAULT_ADMIN_SETTINGS.devAppTechStack;
    }

    callback(finalSettings);
  };

  const refConfig = doc(db, 'adminSettings', 'config');
  const unsubConfig = onSnapshot(refConfig, (snap) => {
    if (snap.exists()) {
      currentConfig = snap.data() || {};
    } else {
      currentConfig = {};
    }
    emit();
  }, (err: any) => {
    console.warn('[AdminSettings] Firestore listener error:', err);
    callback({
      ...DEFAULT_ADMIN_SETTINGS,
      botApiUrl: 'https://telegram-bot-backend-zbvn.onrender.com',
      miniAppUrl: 'https://elite-force-844d0.web.app',
    });
  });

  const refBanners = collection(db, 'heroBanners');
  const unsubBanners = onSnapshot(refBanners, (snap: QuerySnapshot<DocumentData>) => {
    const banners: any[] = [];
    snap.forEach((docSnap: QueryDocumentSnapshot<DocumentData>) => {
      banners.push({ id: docSnap.id, ...docSnap.data() });
    });
    currentBannersFromColl = banners;
    emit();
  }, (err: any) => {
    console.warn('[AdminSettings] Hero banners collection listener warning:', err.message);
  });

  return () => {
    unsubConfig();
    unsubBanners();
  };
};

/**
 * Save a single Hero Banner to dedicated heroBanners collection in Firestore
 */
export const saveHeroBannerToFirestore = async (banner: { id: string; imageUrl: string; linkUrl?: string; title?: string }): Promise<boolean> => {
  if (!isFirebaseConfigured()) return false;
  try {
    const bannerRef = doc(db, 'heroBanners', banner.id);
    const cleanBanner = JSON.parse(JSON.stringify(banner));
    await setDoc(bannerRef, cleanBanner, { merge: true });
    return true;
  } catch (err) {
    console.error('[AdminSettingsService] saveHeroBanner failed:', err);
    return false;
  }
};

/**
 * Delete a Hero Banner from dedicated heroBanners collection in Firestore
 */
export const deleteHeroBannerFromFirestore = async (bannerId: string): Promise<boolean> => {
  if (!isFirebaseConfigured()) return false;
  try {
    const bannerRef = doc(db, 'heroBanners', bannerId);
    await deleteDoc(bannerRef);
    return true;
  } catch (err) {
    console.error('[AdminSettingsService] deleteHeroBanner failed:', err);
    return false;
  }
};

/**
 * Get admin settings once (non-realtime).
 */
export const getAdminSettings = async (): Promise<AdminSettings> => {
  if (!isFirebaseConfigured()) return DEFAULT_ADMIN_SETTINGS;
  try {
    const snap = await getDoc(doc(db, 'adminSettings', 'config'));
    if (snap.exists()) {
      const res = { ...DEFAULT_ADMIN_SETTINGS, ...snap.data() } as AdminSettings;
      if (!res.botApiUrl || !res.botApiUrl.trim()) res.botApiUrl = 'https://telegram-bot-backend-zbvn.onrender.com';
      if (!res.miniAppUrl || !res.miniAppUrl.trim()) res.miniAppUrl = 'https://elite-force-844d0.web.app';
      return res;
    }
  } catch { /* noop */ }
  return DEFAULT_ADMIN_SETTINGS;
};

/**
 * Admin: Save updated settings to Firestore.
 */
export const saveAdminSettings = async (settings: Partial<AdminSettings>): Promise<boolean> => {
  if (!isFirebaseConfigured()) return false;
  try {
    const cleanData = JSON.parse(JSON.stringify(settings));
    await setDoc(doc(db, 'adminSettings', 'config'), cleanData, { merge: true });
    return true;
  } catch (err) {
    console.error('[AdminSettingsService] Save failed:', err);
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
