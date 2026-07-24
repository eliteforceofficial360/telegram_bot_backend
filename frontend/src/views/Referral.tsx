import React, { useState, useEffect } from 'react';
import { Copy, Share2, Users, Check, Award } from 'lucide-react';
import { getReferralLink, getUserReferrals, type ReferralRecord } from '../lib/referralService';
import { getReferralTierLimit, type AdminSettings } from '../lib/adminSettingsService';
import type { TelegramUser } from '../lib/telegramUser';

interface ReferralProps {
  showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  setEfcBalance: React.Dispatch<React.SetStateAction<number>>;
  hasUnlockedWithdrawal: boolean;
  setHasUnlockedWithdrawal: (unlocked: boolean) => void;
  referralsCount: number;
  setReferralsCount: React.Dispatch<React.SetStateAction<number>>;
  telegramUser: TelegramUser | null;
  adminSettings: AdminSettings;
}

export const Referral: React.FC<ReferralProps> = ({
  showToast,
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
  const settings = adminSettings;
  const botUser = settings.botUsername || 'EliteForceBot';

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

    // 1. If running inside Telegram WebApp, use openTelegramLink for native share dialog
    if ((window as any).Telegram?.WebApp?.openTelegramLink) {
      try {
        (window as any).Telegram.WebApp.openTelegramLink(shareUrl);
        showToast('Opening Telegram Share...', 'info');
        return;
      } catch (err) {
        console.warn('openTelegramLink error:', err);
      }
    }

    // 2. Fallback to Web Share API if available
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

    // 3. Direct Telegram web share link fallback
    window.open(shareUrl, '_blank');
    handleCopy();
  };

  const validReferrals = referralRecords.filter(r => r.isValid).length;
  const suspiciousReferrals = referralRecords.filter(r => !r.isValid).length;
  const withdrawMinReferrals = settings.withdrawMinReferrals;
  const referralProgress = Math.min((referralsCount / withdrawMinReferrals) * 100, 100);
  const isWithdrawalUnlocked = referralsCount >= withdrawMinReferrals;
  void referralProgress;
  void isWithdrawalUnlocked;

  // Level milestones (0 to 50 referrals)
  void withdrawMinReferrals;

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
            <img src={adminSettings.referralBannerUrl} alt="Referral Banner" className="w-full h-full object-cover" />
          )}
        </div>
      )}

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

      {/* Reward Structure & Claim Limit Tiers (0 to 50 Referrals) */}
      <div className="glass-panel p-4 rounded-[22px] border-white/6 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold flex items-center gap-1.5">
            <Award size={13} className="text-[#FF8A00]" /> EFC Claim Limit Tiers (Up to 50 Referrals)
          </span>
          <span className="text-xs font-black text-[#FF8A00]">
            {getReferralTierLimit(referralsCount, settings.referralBaseLimit || 5000, settings.referralStepLimit || 5000).maxPoints.toLocaleString()} EFC Max
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50].map((stepRefs) => {
            const stepMaxPoints = (settings.referralBaseLimit || 5000) + (stepRefs / 5) * (settings.referralStepLimit || 5000);
            const isReached = referralsCount >= stepRefs;
            return (
              <div
                key={stepRefs}
                className={`flex items-center justify-between p-2.5 rounded-[14px] border transition-all ${
                  isReached
                    ? 'border-[#FF8A00]/30 bg-[#FF8A00]/10'
                    : 'border-white/5 bg-white/[0.02]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black ${
                    isReached ? 'bg-[#FF8A00] text-black' : 'bg-white/5 text-slate-500'
                  }`}>
                    {isReached ? '✓' : stepRefs}
                  </div>
                  <span className="text-[10px] text-slate-300 font-semibold">
                    {stepRefs === 0 ? 'Regular (0 Referrals)' : `${stepRefs} Referrals`}
                  </span>
                </div>
                <div className="text-right flex flex-col gap-0.5">
                  <span className="text-[10px] font-black text-[#FF8A00]">
                    {stepMaxPoints.toLocaleString()} EFC Limit
                  </span>
                  {stepRefs > 0 && (
                    <span className="text-[8px] font-bold text-emerald-400">
                      +${(settings.referralRewardUsdt * stepRefs).toFixed(2)} USDT Bonus
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[9px] text-slate-500 text-center">
          Base limit: {(settings.referralBaseLimit || 5000).toLocaleString()} EFC (0 refs). Every 5 referrals unlocks +{(settings.referralStepLimit || 5000).toLocaleString()} EFC claim capacity up to 50 refs!
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
