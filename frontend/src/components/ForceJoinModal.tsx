import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, AlertTriangle, ExternalLink, Play, Lock, RefreshCw, Sparkles, Check, Send, Users } from 'lucide-react';
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
  const [verifyingText, setVerifyingText] = useState<string>('Verifying Telegram Servers...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Status check state for channel and group
  const [channelJoined, setChannelJoined] = useState<boolean | null>(null);
  const [groupJoined, setGroupJoined] = useState<boolean | null>(null);
  const [isInitialChecking, setIsInitialChecking] = useState<boolean>(true);

  // Helpers to sanitize channel & group IDs for API calls
  const getCleanChatId = (input: string, fallback: string) => {
    if (!input || !input.trim()) return fallback;
    const str = input.trim();
    if (str.includes('t.me/')) {
      const parsed = str.split('t.me/')[1].split('?')[0].split('/')[0].replace('+', '');
      return parsed ? `@${parsed}` : str;
    }
    if (!str.startsWith('@') && !str.startsWith('-100') && isNaN(Number(str))) {
      return `@${str}`;
    }
    return str;
  };

  const cleanChannelId = getCleanChatId(channelId, '@EliteForceChannel');
  const cleanGroupId = getCleanChatId(groupId, '@EliteForceGroup');

  // Auto-check membership status on mount
  useEffect(() => {
    let isMounted = true;
    const performInitialCheck = async () => {
      try {
        const targetApi = botApiUrl ? botApiUrl.replace(/\/$/, '') : 'https://elite-force-telegram-app.onrender.com';
        const res = await fetch(`${targetApi}/check-membership`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            telegramId,
            chatIds: [cleanChannelId, cleanGroupId, channelId, groupId].filter(Boolean),
          }),
        });

        if (res.ok && isMounted) {
          const data = await res.json();
          if (data.results) {
            const cJoined = data.results[cleanChannelId] ?? data.results[channelId] ?? false;
            const gJoined = data.results[cleanGroupId] ?? data.results[groupId] ?? false;
            setChannelJoined(cJoined);
            setGroupJoined(gJoined);
            if (data.isMember) {
              onVerificationSuccess();
            }
          }
        }
      } catch {
        /* silent catch on auto-check */
      } finally {
        if (isMounted) setIsInitialChecking(false);
      }
    };

    performInitialCheck();
    return () => {
      isMounted = false;
    };
  }, [telegramId, channelId, groupId, cleanChannelId, cleanGroupId, botApiUrl, onVerificationSuccess]);

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
      const tg = (window as any).Telegram?.WebApp;
      if (tg?.openTelegramLink && url.includes('t.me/')) {
        tg.openTelegramLink(url);
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
   * 2. Trigger Rewarded Ad if configured
   * 3. Display 2.5s verification delay / loading sequence for Telegram server sync
   * 4. Check server verification (/check-membership)
   */
  const handleVerify = async () => {
    if (cooldownRemaining > 0 || isAdWatching || isVerifying) return;

    setErrorMessage(null);
    setIsAdWatching(true);

    try {
      // Step 1: Trigger Rewarded Ad (if monetag zone is set)
      if (monetagZoneId && monetagZoneId.trim()) {
        const adSuccess = await showRewardedAd(monetagZoneId, monetagDirectLink);

        if (!adSuccess) {
          setIsAdWatching(false);
          setErrorMessage('Verification Cancelled: Please watch the full advertisement to continue verification.');
          setCooldownRemaining(cooldownSeconds);
          showToast('Verification Cancelled. Please watch the full ad to continue.', 'warning');
          return;
        }
      }

      setIsAdWatching(false);
      setIsVerifying(true);
      setVerifyingText('Connecting to Telegram API... ⏳');

      // Realistic 2.5s verification loading delay sequence
      await new Promise((r) => setTimeout(r, 800));
      setVerifyingText('Checking Channel & Group Membership... 🔍');
      await new Promise((r) => setTimeout(r, 1000));
      setVerifyingText('Verifying Security Credentials... 🔐');
      await new Promise((r) => setTimeout(r, 700));

      const targetApi = botApiUrl ? botApiUrl.replace(/\/$/, '') : 'https://elite-force-telegram-app.onrender.com';
      const checkRes = await fetch(`${targetApi}/check-membership`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId,
          chatIds: [cleanChannelId, cleanGroupId, channelId, groupId].filter(Boolean),
        }),
      });

      if (!checkRes.ok) {
        throw new Error('Server verification failed. Please try again.');
      }

      const data = await checkRes.json();
      setIsVerifying(false);

      if (data.results) {
        const cJoined = data.results[cleanChannelId] ?? data.results[channelId] ?? false;
        const gJoined = data.results[cleanGroupId] ?? data.results[groupId] ?? false;
        setChannelJoined(cJoined);
        setGroupJoined(gJoined);
      }

      if (data.isMember) {
        showToast('🎉 Verification Successful! Welcome to Elite Force.', 'success');
        onVerificationSuccess();
      } else {
        setErrorMessage('Verification Failed: You must join both the Channel and Group to continue.');
        showToast('Please join all required Telegram communities.', 'error');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md rounded-[32px] p-6 border border-white/10 shadow-[0_30px_70px_rgba(0,0,0,0.9)] overflow-hidden relative"
        style={{ background: 'linear-gradient(180deg, #111524 0%, #0A0D18 100%)' }}
      >
        {/* Glow Header Accent Bar */}
        <div
          className="absolute top-0 left-0 right-0 h-1.5"
          style={{ background: 'linear-gradient(90deg, #FF8A00, #4ADE80, #38BDF8, #A855F7)' }}
        />

        {/* Shield & Verification Header */}
        <div className="flex flex-col items-center text-center mt-2 mb-5">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-3 relative shadow-lg"
            style={{
              background: isAccessRestricted ? 'rgba(239, 68, 68, 0.15)' : 'rgba(74, 222, 128, 0.15)',
              border: isAccessRestricted ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid rgba(74, 222, 128, 0.35)',
              color: isAccessRestricted ? '#EF4444' : '#4ADE80',
            }}
          >
            <ShieldCheck size={32} />
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 12, ease: 'linear' }}
              className="absolute -inset-1 rounded-2xl border border-dashed border-white/15 pointer-events-none"
            />
          </div>

          <h2 className="text-xl font-black text-white uppercase tracking-wider flex items-center gap-1.5">
            {isAccessRestricted ? 'Access Restricted 🚩' : 'Community Verification'}
          </h2>
          <p className="text-xs text-slate-400 max-w-[310px] leading-relaxed mt-1.5">
            {isAccessRestricted
              ? 'You left one of our Telegram communities. Rejoin to instantly unlock your dashboard & earnings.'
              : 'To access Elite Force mining & tasks, please join our official Telegram channel and discussion group.'}
          </p>
        </div>

        {/* Real-time Status Card */}
        <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-4 mb-4 space-y-3">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 flex items-center justify-between">
            <span>Community Requirements</span>
            {isInitialChecking ? (
              <span className="text-cyan-400 flex items-center gap-1 font-mono">
                <RefreshCw size={10} className="animate-spin" /> Checking status...
              </span>
            ) : (
              <span className="text-emerald-400 flex items-center gap-1 font-mono">
                <Sparkles size={10} /> Live Status
              </span>
            )}
          </div>

          {/* Telegram Channel Row */}
          <div className="flex items-center justify-between text-xs bg-white/[0.02] border border-white/5 p-3 rounded-xl">
            <div className="flex items-center gap-2.5">
              {channelJoined === true ? (
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Check size={14} />
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Send size={12} />
                </div>
              )}
              <div className="flex flex-col">
                <span className="font-bold text-white text-xs">Official Channel</span>
                <span className="text-[10px] text-slate-400">{channelId || '@EliteForceChannel'}</span>
              </div>
            </div>
            <span
              className={`text-[10px] font-extrabold px-2.5 py-1 rounded-lg border ${
                channelJoined === true
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                  : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
              }`}
            >
              {channelJoined === true ? '✓ Joined' : 'Required'}
            </span>
          </div>

          {/* Telegram Group Row */}
          <div className="flex items-center justify-between text-xs bg-white/[0.02] border border-white/5 p-3 rounded-xl">
            <div className="flex items-center gap-2.5">
              {groupJoined === true ? (
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Check size={14} />
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                  <Users size={12} />
                </div>
              )}
              <div className="flex flex-col">
                <span className="font-bold text-white text-xs">Discussion Group</span>
                <span className="text-[10px] text-slate-400">{groupId || '@EliteForceGroup'}</span>
              </div>
            </div>
            <span
              className={`text-[10px] font-extrabold px-2.5 py-1 rounded-lg border ${
                groupJoined === true
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                  : 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300'
              }`}
            >
              {groupJoined === true ? '✓ Joined' : 'Required'}
            </span>
          </div>
        </div>

        {/* Join Links Buttons */}
        <div className="grid grid-cols-2 gap-2.5 mb-5">
          <button
            onClick={() => handleOpenLink(channelUrl || 'https://t.me/EliteForceChannel')}
            className="h-11 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 hover:from-emerald-500/30 hover:to-teal-500/30 border border-emerald-500/30 text-emerald-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-md"
          >
            <span>📢 Join Channel</span>
            <ExternalLink size={12} className="text-emerald-400" />
          </button>

          <button
            onClick={() => handleOpenLink(groupUrl || 'https://t.me/EliteForceGroup')}
            className="h-11 rounded-xl bg-gradient-to-r from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 border border-cyan-500/30 text-cyan-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-md"
          >
            <span>👥 Join Group</span>
            <ExternalLink size={12} className="text-cyan-400" />
          </button>
        </div>

        {/* Error / Warning Banner */}
        <AnimatePresence>
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-300"
            >
              <AlertTriangle size={16} className="text-rose-400 shrink-0 mt-0.5" />
              <span className="text-[11px] leading-tight font-medium">{errorMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

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
          className="w-full h-13 rounded-2xl font-black text-sm text-white transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-[0.98] shadow-lg"
          style={{
            background:
              cooldownRemaining > 0
                ? '#1E293B'
                : 'linear-gradient(135deg, #FF8A00 0%, #FFB347 100%)',
            boxShadow: cooldownRemaining > 0 ? 'none' : '0 0 30px rgba(255,138,0,0.4)',
          }}
        >
          {isAdWatching ? (
            <>
              <Play size={16} className="animate-pulse text-black" />
              <span className="text-black font-extrabold">Watching Ad...</span>
            </>
          ) : isVerifying ? (
            <>
              <RefreshCw size={16} className="animate-spin text-black" />
              <span className="text-black font-extrabold">{verifyingText}</span>
            </>
          ) : cooldownRemaining > 0 ? (
            `Verify Disabled (${formattedTime})`
          ) : (
            'Verify Membership & Launch App'
          )}
        </button>
      </motion.div>
    </div>
  );
};
