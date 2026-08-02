import React, { useState, useEffect } from 'react';
import { Copy, Share2, Users, Check, Award, Lock, Sparkles, Zap, Medal, Diamond, Crown, Flame } from 'lucide-react';
import { UsdtIcon } from '../components/UsdtIcon';
import { getReferralLink, getUserReferrals, syncAndClaimAllReferralRewards, type ReferralRecord } from '../lib/referralService';
import { type AdminSettings } from '../lib/adminSettingsService';
import {
  subscribeToReferralTiers,
  calculateUserReferralTier,
  formatTierBadgeName,
  checkAndAutoClaimReferralTiers,
  type ReferralClaimTier,
} from '../lib/referralTierService';
import type { TelegramUser } from '../lib/telegramUser';
import type { FirestoreUser } from '../lib/userService';

interface ReferralProps {
  showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  setEfcBalance: React.Dispatch<React.SetStateAction<number>>;
  setUsdtBalance?: React.Dispatch<React.SetStateAction<number>>;
  dbUser?: FirestoreUser | null;
  hasUnlockedWithdrawal: boolean;
  setHasUnlockedWithdrawal: (unlocked: boolean) => void;
  referralsCount: number;
  setReferralsCount: React.Dispatch<React.SetStateAction<number>>;
  telegramUser: TelegramUser | null;
  adminSettings: AdminSettings;
}

export const Referral: React.FC<ReferralProps> = ({
  showToast,
  setEfcBalance,
  setUsdtBalance,
  dbUser,
  hasUnlockedWithdrawal,
  setHasUnlockedWithdrawal,
  referralsCount,
  telegramUser,
  adminSettings,
}) => {
  const [copied, setCopied] = useState(false);
  const [referralRecords, setReferralRecords] = useState<ReferralRecord[]>([]);
  const [_loadingReferrals, setLoadingReferrals] = useState(false);
  void _loadingReferrals;

  // Real-time Referral Claim Tiers from Firestore backend (never hardcoded)
  const [liveTiers, setLiveTiers] = useState<ReferralClaimTier[]>([]);
  const [claimedTiers, setClaimedTiers] = useState<string[]>(() => dbUser?.claimedReferralTiers || []);

  useEffect(() => {
    if (dbUser?.claimedReferralTiers) {
      setClaimedTiers(dbUser.claimedReferralTiers);
    }
  }, [dbUser?.claimedReferralTiers]);

  useEffect(() => {
    const unsub = subscribeToReferralTiers(setLiveTiers);
    return unsub;
  }, []);

  // Automatically check, sync, and claim all unlocked referral rewards & USDT bonuses
  useEffect(() => {
    if (!telegramUser) return;
    syncAndClaimAllReferralRewards(telegramUser.id).then((syncRes) => {
      if (syncRes.totalUsdtAdded > 0 && setUsdtBalance) {
        setUsdtBalance((prev) => prev + syncRes.totalUsdtAdded);
        showToast(`🎉 +$${syncRes.totalUsdtAdded.toFixed(2)} USDT Referral Reward Credited!`, 'success');
      }
    }).catch(() => {});

    checkAndAutoClaimReferralTiers(telegramUser.id, liveTiers).then((res) => {
      if (res.claimedCount > 0) {
        if (res.pointsAdded > 0) {
          setEfcBalance((prev) => {
            const next = prev + res.pointsAdded;
            try { localStorage.setItem('efcBalance', JSON.stringify(next)); } catch { /* ignore */ }
            return next;
          });
        }
        if (res.usdtAdded > 0 && setUsdtBalance) {
          setUsdtBalance((prev) => prev + res.usdtAdded);
        }
        setClaimedTiers((prev) => Array.from(new Set([...prev, ...res.newlyClaimed.map((t) => t.id)])));

        const tierNames = res.newlyClaimed.map((t) => formatTierBadgeName(t.badge, t.requiredReferrals)).join(', ');
        showToast(
          `🎉 Auto-unlocked ${tierNames}! +${res.pointsAdded.toLocaleString()} EFC ${res.usdtAdded > 0 ? `& +$${res.usdtAdded.toFixed(2)} USDT` : ''} auto-credited!`,
          'success'
        );
      }
    }).catch(() => {});
  }, [telegramUser, liveTiers, referralsCount]);

  const renderPremiumIcon = (badge: string, requiredReferrals: number = 0) => {
    const name = formatTierBadgeName(badge, requiredReferrals).toLowerCase();
    if (name.includes('starter')) return <Zap size={14} className="text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]" />;
    if (name.includes('bronze')) return <Medal size={14} className="text-orange-400 drop-shadow-[0_0_8px_rgba(251,146,60,0.6)]" />;
    if (name.includes('silver')) return <Medal size={14} className="text-slate-300 drop-shadow-[0_0_8px_rgba(203,213,225,0.6)]" />;
    if (name.includes('gold')) return <Award size={14} className="text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.6)]" />;
    if (name.includes('platinum')) return <Diamond size={14} className="text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]" />;
    if (name.includes('diamond')) return <Crown size={14} className="text-fuchsia-400 drop-shadow-[0_0_8px_rgba(232,121,249,0.6)]" />;
    if (name.includes('master') || name.includes('elite')) return <Flame size={14} className="text-[#FF8A00] drop-shadow-[0_0_8px_rgba(255,138,0,0.6)]" />;
    return <Award size={14} className="text-[#FF8A00]" />;
  };

  const settings = adminSettings;
  const botUser = settings.botUsername || 'EliteForceBot';

  // Calculate live unlocked tier metrics from real-time database state
  const tierStatus = calculateUserReferralTier(referralsCount, liveTiers);
  const unlockedTier = tierStatus.unlockedTier;
  const nextTier = tierStatus.nextTier;

  // Get real referral link
  const referralLink = telegramUser
    ? getReferralLink(telegramUser.id, botUser)
    : `https://t.me/${botUser}?start=ref_0`;

  // Load referral records from Firestore
  useEffect(() => {
    if (!telegramUser) return;
    setLoadingReferrals(true);
    getUserReferrals(telegramUser.id).then(records => {
      setReferralRecords(records);
      setLoadingReferrals(false);
    });
  }, [telegramUser, referralsCount]);

  // Check if withdrawal unlocked
  useEffect(() => {
    if (referralsCount >= settings.withdrawMinReferrals && !hasUnlockedWithdrawal) {
      setHasUnlockedWithdrawal(true);
    }
  }, [referralsCount, settings.withdrawMinReferrals]);

  const handleCopy = () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(referralLink);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = referralLink;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      showToast('Referral link copied to clipboard!', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('Failed to copy link.', 'error');
    }
  };

  const handleShare = () => {
    const shareText = `🚀 Join Elite Force Web3 & start earning EForce Tokens & USDT today! 💥`;
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(shareText)}`;

    if ((window as any).Telegram?.WebApp?.openTelegramLink) {
      try {
        (window as any).Telegram.WebApp.openTelegramLink(shareUrl);
        showToast('Opening Telegram Share...', 'info');
        return;
      } catch (err) {
        console.warn('openTelegramLink error:', err);
      }
    }

    if (navigator.share) {
      navigator
        .share({
          title: 'Elite Force (EForce)',
          text: shareText,
          url: referralLink,
        })
        .catch(() => {
          window.open(shareUrl, '_blank');
        });
      return;
    }

    window.open(shareUrl, '_blank');
    handleCopy();
  };

  const validReferrals = referralRecords.filter(r => r.isValid).length;
  const suspiciousReferrals = referralRecords.filter(r => !r.isValid).length;

  return (
    <div className="flex flex-col gap-5 pb-28">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Referrals</h1>
        <p className="text-xs text-slate-400 mt-1">Invite friends, earn USDT & EForce Token together</p>
      </div>

      {/* Header Banner (if set by Admin) */}
      {adminSettings.referralBannerUrl && (
        <div className="w-full h-32 rounded-[22px] overflow-hidden border border-white/10 relative shadow-[0_12px_30px_rgba(0,0,0,0.5)]">
          {adminSettings.referralBannerUrl.toLowerCase().includes('.mp4') ||
           adminSettings.referralBannerUrl.toLowerCase().includes('.webm') ||
           adminSettings.referralBannerUrl.toLowerCase().includes('.mov') ||
           adminSettings.referralBannerUrl.toLowerCase().startsWith('data:video/') ? (
            <video src={adminSettings.referralBannerUrl} autoPlay loop muted playsInline className="w-full h-full object-cover" />
          ) : (
            <img 
              src={adminSettings.referralBannerUrl} 
              alt="Referral Banner" 
              className="w-full h-full object-cover"
              loading="eager"
              decoding="async"
              {...{ fetchpriority: 'high' }}
            />
          )}
        </div>
      )}

      {/* Live Unlocked Tier Status Card */}
      <div className="glass-panel p-4 rounded-[22px] border-white/6 flex flex-col gap-3 relative overflow-hidden bg-gradient-to-br from-[#12182C] via-[#0E1325] to-[#0A0D1B]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center bg-white/5 rounded-xl p-2 border border-white/10 shadow-[0_0_15px_rgba(255,138,0,0.15)]">
              {renderPremiumIcon(unlockedTier?.badge || '')}
            </div>
            <div>
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block">Active Unlocked Tier</span>
              <h3 className="text-sm font-black text-white">{unlockedTier?.badge ? unlockedTier.badge.replace(/[^\\x00-\\x7F]/g, '').trim() : `Tier (${unlockedTier?.requiredReferrals} Referrals)`}</h3>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block">Claim Limit</span>
            <span className="text-sm font-black text-[#FF8A00]">{tierStatus.maxPoints.toLocaleString()} EFC</span>
          </div>
        </div>

        {/* Progress to Next Tier */}
        {nextTier ? (
          <div className="flex flex-col gap-1.5 mt-1">
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-slate-400">Progress to {nextTier.badge || `${nextTier.requiredReferrals} Refs`}</span>
              <span className="font-bold text-cyan-400">{tierStatus.remainingReferrals} more ref{tierStatus.remainingReferrals !== 1 ? 's' : ''} needed</span>
            </div>
            <div className="w-full h-2 rounded-full bg-white/5 border border-white/8 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#FF8A00] via-[#00E5FF] to-cyan-300 transition-all duration-500"
                style={{ width: `${tierStatus.progressPct}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="p-2 rounded-xl bg-amber-400/10 border border-amber-400/20 text-center text-[10px] font-black text-amber-300 flex items-center justify-center gap-1 mt-1">
            <Sparkles size={12} /> HIGHEST MASTER TIER UNLOCKED! (+${tierStatus.currentBonus.toFixed(2)} USDT Bonus)
          </div>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="glass-panel p-3 rounded-[18px] border-white/5 flex flex-col gap-0.5">
          <span className="text-[8px] text-slate-500 uppercase tracking-widest font-bold">Total</span>
          <span className="text-lg font-black text-white">{referralsCount}</span>
        </div>
        <div className="glass-panel p-3 rounded-[18px] border-white/5 flex flex-col gap-0.5">
          <span className="text-[8px] text-slate-500 uppercase tracking-widest font-bold">Valid</span>
          <span className="text-lg font-black text-accent-success">{validReferrals}</span>
        </div>
        <div className="glass-panel p-3 rounded-[18px] border-white/5 flex flex-col gap-0.5">
          <span className="text-[8px] text-slate-500 uppercase tracking-widest font-bold">Flagged</span>
          <span className="text-lg font-black text-accent-warning">{suspiciousReferrals}</span>
        </div>
      </div>

      {/* Referral Link Card */}
      <div className="glass-panel p-4 rounded-[22px] border-white/6 flex flex-col gap-3">
        <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Your Referral Link</span>
        <div className="flex items-center gap-2 bg-white/[0.04] border border-white/8 rounded-xl px-3 py-2.5">
          <span className="flex-1 text-[10px] text-slate-300 font-mono truncate">{referralLink}</span>
          <button
            onClick={handleCopy}
            className="shrink-0 w-7 h-7 rounded-lg bg-[#FF8A00]/15 border border-[#FF8A00]/25 flex items-center justify-center cursor-pointer hover:bg-[#FF8A00]/25 transition-all"
          >
            {copied ? <Check size={11} className="text-accent-success" /> : <Copy size={11} className="text-[#FF8A00]" />}
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className="flex-1 h-10 bg-white/5 border border-white/10 text-white text-[10px] font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer hover:bg-white/8 transition-all"
          >
            <Copy size={12} /> Copy Link
          </button>
          <button
            onClick={handleShare}
            className="flex-1 h-10 bg-[#FF8A00] hover:bg-[#FF8A00]/90 text-white text-[10px] font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_14px_rgba(255,138,0,0.25)] transition-all"
          >
            <Share2 size={12} /> Share Now
          </button>
        </div>
      </div>

      {/* DYNAMIC REAL-TIME REFERRAL CLAIM LIMIT TIERS (Managed by Admin) */}
      <div className="glass-panel p-4 rounded-[22px] border-white/6 flex flex-col gap-3">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between border-b border-white/5 pb-2.5">
          <span className="text-[10px] text-slate-400 uppercase tracking-widest font-extrabold flex items-center gap-1.5">
            <Award size={14} className="text-[#FF8A00] shrink-0" /> Dynamic Referral Tiers
          </span>
          <div className="flex items-center justify-between sm:justify-end gap-1.5">
            <span className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider">Current Limit:</span>
            <span className="text-xs font-black text-[#FF8A00]">
              {tierStatus.maxPoints.toLocaleString()} EFC
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {liveTiers.filter(t => t.isActive).map((tier) => {
            const isReached = referralsCount >= tier.requiredReferrals;
            const isClaimed = claimedTiers.includes(tier.id);
            const isCurrentTier = unlockedTier?.id === tier.id;

            return (
              <div
                key={tier.id}
                className={`flex items-center justify-between p-3 rounded-[16px] border transition-all ${
                  isCurrentTier
                    ? 'border-[#FF8A00] bg-[#FF8A00]/15 shadow-[0_0_20px_rgba(255,138,0,0.2)]'
                    : isReached
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : 'border-white/5 bg-white/[0.02] opacity-75'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
                    isCurrentTier
                      ? 'bg-[#FF8A00] text-black shadow-md'
                      : isReached
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-white/5 text-slate-500 border border-white/8'
                  }`}>
                    {isClaimed ? '✓' : isReached ? '★' : <Lock size={11} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      {renderPremiumIcon(tier.badge || '', tier.requiredReferrals)}
                      <span className="text-xs font-black text-white">
                        {formatTierBadgeName(tier.badge, tier.requiredReferrals)}
                      </span>
                      {isCurrentTier && (
                        <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#FF8A00] text-black">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <span className="text-[9.5px] text-slate-400 font-mono">
                      {tier.requiredReferrals === 0 ? 'Base Starter' : `${tier.requiredReferrals} Referrals Required`}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right flex flex-col gap-0.5">
                    <span className="text-xs font-black text-[#FF8A00]">
                      {tier.claimLimit.toLocaleString()} EFC
                    </span>
                    {tier.bonusUSDT > 0 && (
                      <span className="text-[9px] font-bold text-emerald-400 flex items-center justify-end gap-1">
                        <UsdtIcon size={11} />+${tier.bonusUSDT.toFixed(2)} USDT Bonus
                      </span>
                    )}
                  </div>

                  {/* Claimed Badge / Active Tier / Locked Status */}
                  <div className="shrink-0">
                    {isClaimed ? (
                      <div className="px-2.5 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[9.5px] font-extrabold flex items-center gap-1">
                        <Check size={11} /> Claimed
                      </div>
                    ) : isReached ? (
                      <div className="px-2.5 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[9.5px] font-extrabold flex items-center gap-1 shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                        <Sparkles size={11} className="text-yellow-400" /> Active Tier
                      </div>
                    ) : (
                      <div className="px-2 py-1 rounded-xl bg-white/5 border border-white/8 text-slate-500 text-[9.5px] font-medium flex items-center gap-1">
                        <Lock size={10} /> Locked
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-[9px] text-slate-500 text-center mt-1">
          ⚡ Tiers & limits update instantly in real-time when configured by Admin.
        </p>
      </div>

      {/* Referral Records */}
      {referralRecords.length > 0 && (
        <div className="glass-panel p-4 rounded-[22px] border-white/6 flex flex-col gap-3">
          <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold flex items-center gap-1.5">
            <Users size={11} /> Your Referrals
          </span>
          <div className="flex flex-col gap-1.5 max-h-[200px] overflow-y-auto pr-0.5">
            {referralRecords.map((rec) => (
              <div key={rec.id} className="flex items-center justify-between bg-white/[0.02] border border-white/5 rounded-[12px] p-2.5">
                <div>
                  <span className="text-[10px] text-slate-300 font-semibold block">User #{rec.referredId}</span>
                  <span className="text-[8px] text-slate-500">
                    {rec.deviceMatch ? '⚠️ Same device' : '✅ Valid join'}
                  </span>
                </div>
                <div className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                  rec.isValid
                    ? 'text-accent-success border-accent-success/25 bg-accent-success/10'
                    : 'text-accent-warning border-accent-warning/25 bg-accent-warning/10'
                }`}>
                  {rec.isValid ? 'Valid' : 'Flagged'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* How it Works */}
      <div className="glass-panel p-4 rounded-[22px] border-white/6 flex flex-col gap-2">
        <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">How It Works</span>
        {[
          'Share your referral link with friends',
          'Friend joins via your link & activates account',
          'You earn EForce tokens per valid referral',
        ].map((step, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <div className="w-5 h-5 rounded-full bg-[#FF8A00]/15 border border-[#FF8A00]/25 flex items-center justify-center text-[8px] font-black text-[#FF8A00] shrink-0 mt-0.5">
              {i + 1}
            </div>
            <span className="text-[10px] text-slate-400">{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
