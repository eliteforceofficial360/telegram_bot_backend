import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, CheckCircle2, Circle, AlertTriangle, ExternalLink, Play, Lock, RefreshCw } from 'lucide-react';
import { showRewardedAd } from '../lib/monetag';

interface ForceJoinModalProps {
  telegramId: number;
  channelUrl: string;
  channelId: string;
  groupUrl: string;
  groupId: string;
  botApiUrl: string;
  monetagZoneId: string;
  monetagDirectLink?: string;
  cooldownSeconds?: number;
  showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  onVerificationSuccess: () => void;
  isAccessRestricted?: boolean;
}

export const ForceJoinModal: React.FC<ForceJoinModalProps> = ({
  telegramId,
  channelUrl,
  channelId,
  groupUrl,
  groupId,
  botApiUrl,
  monetagZoneId,
  monetagDirectLink,
  cooldownSeconds = 30,
  showToast,
  onVerificationSuccess,
  isAccessRestricted = false,
}) => {
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);
  const [isAdWatching, setIsAdWatching] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Status check state for channel and group
  const [channelJoined, setChannelJoined] = useState<boolean | null>(null);
  const [groupJoined, setGroupJoined] = useState<boolean | null>(null);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldownRemaining <= 0) return;
    const timer = setInterval(() => {
      setCooldownRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownRemaining]);

  const handleOpenLink = (url: string) => {
    if (!url) return;
    try {
      if ((window as any).Telegram?.WebApp?.openTelegramLink) {
        (window as any).Telegram.WebApp.openTelegramLink(url);
      } else {
        window.open(url, '_blank');
      }
    } catch {
      window.open(url, '_blank');
    }
  };

  /**
   * Main Verify Flow:
   * 1. Check cooldown
   * 2. Trigger Rewarded Ad
   * 3. On Ad Reward Granted -> Call Server Verification (/check-membership)
   * 4. On Ad Interrupted / Fail -> Start Cooldown & Cancel Verification
   */
  const handleVerify = async () => {
    if (cooldownRemaining > 0 || isAdWatching || isVerifying) return;

    setErrorMessage(null);
    setIsAdWatching(true);

    try {
      // Step 1: Trigger Rewarded Ad
      const adSuccess = await showRewardedAd(monetagZoneId, monetagDirectLink);

      if (!adSuccess) {
        // Rewarded ad failed, skipped, closed early or interrupted
        setIsAdWatching(false);
        setErrorMessage('Verification Cancelled: Please watch the full advertisement to continue verification.');
        setCooldownRemaining(cooldownSeconds);
        showToast('Verification Cancelled. Please watch the full ad to continue.', 'warning');
        return;
      }

      // Step 2: Reward Granted -> Proceed to Server Verification
      setIsAdWatching(false);
      setIsVerifying(true);

      const targetApi = botApiUrl ? botApiUrl.replace(/\/$/, '') : 'https://elite-force-telegram-app.onrender.com';
      const checkRes = await fetch(`${targetApi}/check-membership`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId,
          chatIds: [channelId || '@EliteForceChannel', groupId || '@EliteForceGroup'],
        }),
      });

      if (!checkRes.ok) {
        throw new Error('Server verification failed. Please try again.');
      }

      const data = await checkRes.json();
      setIsVerifying(false);

      if (data.results) {
        const cJoined = data.results[channelId || '@EliteForceChannel'] ?? false;
        const gJoined = data.results[groupId || '@EliteForceGroup'] ?? false;
        setChannelJoined(cJoined);
        setGroupJoined(gJoined);
      }

      if (data.isMember) {
        // Successful verification!
        showToast('Verification Successful. Welcome to Elite Force!', 'success');
        onVerificationSuccess();
      } else {
        setErrorMessage('Verification Failed: You must join all required Telegram communities before continuing.');
        showToast('You must join all required Telegram communities before continuing.', 'error');
      }
    } catch (err: any) {
      setIsAdWatching(false);
      setIsVerifying(false);
      setErrorMessage(err.message || 'Server connection error during verification.');
      showToast('Verification error. Please check internet connection.', 'error');
    }
  };

  const formattedTime = `00:${cooldownRemaining < 10 ? '0' : ''}${cooldownRemaining}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md rounded-[32px] p-6 border border-white/10 shadow-[0_25px_60px_rgba(0,0,0,0.8)] overflow-hidden relative"
        style={{ background: '#0B0E17' }}
      >
        {/* Glow Header Accent */}
        <div
          className="absolute top-0 left-0 right-0 h-1"
          style={{ background: 'linear-gradient(90deg, #FF8A00, #4ADE80, #38BDF8)' }}
        />

        {/* Shield Icon Header */}
        <div className="flex flex-col items-center text-center mt-2 mb-5">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3 relative"
            style={{
              background: isAccessRestricted ? 'rgba(239,68,68,0.12)' : 'rgba(74,222,128,0.12)',
              border: isAccessRestricted ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(74,222,128,0.3)',
              color: isAccessRestricted ? '#EF4444' : '#4ADE80',
            }}
          >
            <ShieldCheck size={28} />
          </div>

          <h2 className="text-lg font-black text-white uppercase tracking-wide">
            {isAccessRestricted ? 'Access Restricted 🚩' : 'CAPTCHA Verification'}
          </h2>
          <p className="text-xs text-slate-400 max-w-[310px] leading-relaxed mt-1">
            {isAccessRestricted
              ? 'You have left one or more required Telegram communities. Please rejoin them to unlock access.'
              : 'To continue using Elite Force, you must join all required Telegram communities.'}
          </p>
        </div>

        {/* Status Check List */}
        <div className="bg-white/[0.025] border border-white/5 rounded-2xl p-4 mb-4 space-y-3">
          {/* Telegram Channel Row */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              {channelJoined === true ? (
                <CheckCircle2 size={16} className="text-green-400" />
              ) : (
                <Circle size={16} className="text-slate-500" />
              )}
              <span className="font-bold text-white">Telegram Channel</span>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${channelJoined === true ? 'bg-green-500/10 text-green-400' : 'bg-white/5 text-slate-400'}`}>
              {channelJoined === true ? '✓ Joined' : 'Required'}
            </span>
          </div>

          {/* Telegram Group Row */}
          <div className="flex items-center justify-between text-xs border-t border-white/5 pt-3">
            <div className="flex items-center gap-2.5">
              {groupJoined === true ? (
                <CheckCircle2 size={16} className="text-green-400" />
              ) : (
                <Circle size={16} className="text-slate-500" />
              )}
              <span className="font-bold text-white">Telegram Group</span>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${groupJoined === true ? 'bg-green-500/10 text-green-400' : 'bg-white/5 text-slate-400'}`}>
              {groupJoined === true ? '✓ Joined' : 'Required'}
            </span>
          </div>
        </div>

        {/* Join Links Buttons */}
        <div className="grid grid-cols-2 gap-2 mb-5">
          <button
            onClick={() => handleOpenLink(channelUrl || 'https://t.me/EliteForceChannel')}
            className="h-11 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
          >
            <span>📢 Join Channel</span>
            <ExternalLink size={12} className="text-slate-400" />
          </button>

          <button
            onClick={() => handleOpenLink(groupUrl || 'https://t.me/EliteForceGroup')}
            className="h-11 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
          >
            <span>👥 Join Group</span>
            <ExternalLink size={12} className="text-slate-400" />
          </button>
        </div>

        {/* Interrupted Warning or Error Banner */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/25 flex items-start gap-2.5 text-xs text-rose-300">
            <AlertTriangle size={16} className="text-rose-400 shrink-0 mt-0.5" />
            <span className="text-[11px] leading-tight font-medium">{errorMessage}</span>
          </div>
        )}

        {/* Cooldown Timer Alert */}
        {cooldownRemaining > 0 && (
          <div className="mb-4 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between text-xs text-amber-300">
            <div className="flex items-center gap-2">
              <Lock size={15} className="text-amber-400" />
              <span className="text-[11px] font-bold">Verification Interrupted</span>
            </div>
            <span className="font-mono text-sm font-black text-amber-400">{formattedTime}</span>
          </div>
        )}

        {/* Main Verify CTA Button */}
        <button
          onClick={handleVerify}
          disabled={cooldownRemaining > 0 || isAdWatching || isVerifying}
          className="w-full h-13 rounded-2xl font-black text-sm text-white transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-[0.98]"
          style={{
            background: cooldownRemaining > 0
              ? '#1E293B'
              : 'linear-gradient(135deg, #FF8A00 0%, #FFB347 100%)',
            boxShadow: cooldownRemaining > 0 ? 'none' : '0 0 30px rgba(255,138,0,0.35)',
          }}
        >
          {isAdWatching ? (
            <>
              <Play size={16} className="animate-pulse text-black" />
              <span className="text-black">Watching Ad...</span>
            </>
          ) : isVerifying ? (
            <>
              <RefreshCw size={16} className="animate-spin text-black" />
              <span className="text-black">Verifying Communities...</span>
            </>
          ) : cooldownRemaining > 0 ? (
            `Verify Disabled (${formattedTime})`
          ) : (
            'Verify'
          )}
        </button>
      </motion.div>
    </div>
  );
};
