import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Trophy, Flame, ChevronRight, Zap } from 'lucide-react';
import confetti from 'canvas-confetti';
import { getDisplayName, type TelegramUser } from '../lib/telegramUser';
import { recordDailyCheckin, subscribeToUser, upsertUser, syncPointsToFirestore, type FirestoreUser } from '../lib/userService';
import { type AdminSettings } from '../lib/adminSettingsService';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { showRewardedAd } from '../lib/monetag';

interface HomeProps {
  efcBalance: number;
  setEfcBalance: React.Dispatch<React.SetStateAction<number>>;
  usdtBalance: number;
  energy: number;
  setEnergy: React.Dispatch<React.SetStateAction<number>>;
  maxEnergy: number;
  referralsCount: number;
  showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  telegramUser: TelegramUser | null;
  adminSettings: AdminSettings;
  setActiveTab: (tab: any) => void;
  energyCooldownUntil: number;
}

export const Home: React.FC<HomeProps> = ({
  efcBalance,
  setEfcBalance,
  usdtBalance,
  energy,
  setEnergy,
  maxEnergy,
  referralsCount,
  showToast,
  telegramUser,
  adminSettings: settings, // alias adminSettings to settings
  setActiveTab,
  energyCooldownUntil,
}) => {
  void usdtBalance;

  // Daily Check-in (Firestore backed)
  const [dailyClaimed, setDailyClaimed] = useState(false);
  const [dailyStreak, setDailyStreak] = useState(0);
  const [claimingDaily, setClaimingDaily] = useState(false);

  // Floating text tap effects state
  const [clicks, setClicks] = useState<{ id: number; x: number; y: number; text: string }[]>([]);

  const [dbUser, setDbUser] = useState<FirestoreUser | null>(null);

  // Subscribe to real-time user document changes in Firestore
  useEffect(() => {
    if (!telegramUser) return;
    const unsubscribe = subscribeToUser(telegramUser.id, setDbUser);
    return unsubscribe;
  }, [telegramUser]);

  // Check today's claim status from localStorage (quick check before Firestore)
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const lastClaim = localStorage.getItem('lastClaimDate');
    const streak = Number(localStorage.getItem('dailyStreak') || '0');
    if (lastClaim === today) setDailyClaimed(true);
    setDailyStreak(streak);
  }, []);

  // Track ad watches per day
  const [adWatchesToday, setAdWatchesToday] = useState(0);
  const [watchingAd, setWatchingAd] = useState(false);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const lastAdDate = localStorage.getItem('lastAdWatchDate');
    const count = Number(localStorage.getItem('adWatchCount') || '0');
    if (lastAdDate === today) {
      setAdWatchesToday(count);
    } else {
      localStorage.setItem('lastAdWatchDate', today);
      localStorage.setItem('adWatchCount', '0');
      setAdWatchesToday(0);
    }
  }, []);

  const settingsRef = useRef(settings);
  const telegramUserRef = useRef(telegramUser);
  
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { telegramUserRef.current = telegramUser; }, [telegramUser]);

  // Unified click handler for central coin (Tap-to-Earn)
  const handleMainCoinClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (energyCooldownUntil > Date.now()) {
      const remaining = Math.ceil((energyCooldownUntil - Date.now()) / 1000);
      showToast(`Energy exhausted! Cooldown: ${remaining}s remaining.`, 'warning');
      return;
    }

    const reward = settings.tapReward || 1;
    if (energy < reward) {
      showToast('Not enough energy! Wait for it to regenerate.', 'warning');
      return;
    }

    // Trigger haptic feedback if running in Telegram WebView
    try {
      const tg = (window as any).Telegram?.WebApp;
      if (tg?.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('light');
      }
    } catch { /* ignore */ }

    // Deduct energy, reward points
    setEnergy(prev => Math.max(0, prev - reward));
    setEfcBalance(prev => prev + reward);

    // Visual float tap effect relative to coin wrapper bounds
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = Date.now() + Math.random();
    setClicks(prev => [...prev, { id, x, y, text: `+${reward}` }]);

    // Automatically remove the click item after animation completes
    setTimeout(() => {
      setClicks(prev => prev.filter(c => c.id !== id));
    }, 800);
  };

  // Daily Check-in (Firestore + localStorage)
  const claimDailyReward = async () => {
    if (dailyClaimed || claimingDaily) return;

    if (!telegramUser) {
      showToast('Open in Telegram to claim daily reward.', 'warning');
      return;
    }

    // Show rewarded ad first if configured globally in admin
    if (settings.adEnabled) {
      try {
        showToast('Loading Daily Claim Sponsor Ad...', 'info');
        await showRewardedAd(settings.monetagZoneId, settings.monetagDirectLink);
      } catch (err: any) {
        showToast(err.message || 'Ad dismissed. Complete the ad to claim daily reward!', 'error');
        return;
      }
    }

    setClaimingDaily(true);
    let result = await recordDailyCheckin(telegramUser.id, settings.dailyClaimRewards);

    // Auto-init retry if user not initialized
    if (!result.success && result.reason?.includes('initialized')) {
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const isRealTelegramUser = !!(window as any).Telegram?.WebApp?.initDataUnsafe?.user;

      if (isRealTelegramUser || isLocalhost) {
        const ua = navigator.userAgent;
        let detectedOS = 'Unknown OS';
        if (ua.includes('Windows')) detectedOS = 'Windows';
        else if (ua.includes('Macintosh')) detectedOS = 'macOS';
        else if (ua.includes('Android')) detectedOS = 'Android';
        else if (ua.includes('iPhone') || ua.includes('iPad')) detectedOS = 'iOS';

        let detectedBrowser = 'Unknown Browser';
        if (ua.includes('Firefox')) detectedBrowser = 'Firefox';
        else if (ua.includes('Chrome')) detectedBrowser = 'Chrome';
        else if (ua.includes('Safari') && !ua.includes('Chrome')) detectedBrowser = 'Safari';
        else if (ua.includes('Telegram')) detectedBrowser = 'Telegram WebView';

        await upsertUser(
          telegramUser,
          {
            platform: navigator.platform || 'Web',
            browser: detectedBrowser,
            os: detectedOS,
            resolution: `${window.screen.width}x${window.screen.height}`,
            language: navigator.language || 'en',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
          },
          efcBalance
        ).catch(() => {});

        // Retry checkin
        result = await recordDailyCheckin(telegramUser.id, settings.dailyClaimRewards);
      }
    }

    setClaimingDaily(false);

    if (result.success) {
      setEfcBalance(prev => prev + result.reward);
      setDailyClaimed(true);
      setDailyStreak(result.newStreak);
      localStorage.setItem('lastClaimDate', new Date().toISOString().slice(0, 10));
      localStorage.setItem('dailyStreak', String(result.newStreak));
      showToast(`🎁 Day ${result.newStreak} reward: +${result.reward.toLocaleString()} EFC Points!`, 'success');
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 }, colors: ['#FF8A00', '#00E5FF', '#B388FF'] });
    } else {
      showToast(result.reason || 'Already claimed today!', result.reason ? 'error' : 'warning');
    }
  };

  const handleWatchAdClick = async () => {
    if (!telegramUser) {
      showToast('Open in Telegram to earn with ads.', 'warning');
      return;
    }
    if (adWatchesToday >= settings.adDailyLimit) {
      showToast(`Daily limit reached! Come back tomorrow.`, 'warning');
      return;
    }
    if (watchingAd) return;

    setWatchingAd(true);
    try {
      showToast('Loading sponsored video...', 'info');
      const completed = await showRewardedAd(settings.monetagZoneId, settings.monetagDirectLink);
      if (completed) {
        // Add point reward to user
        const reward = settings.adRewardAmount || 100;
        setEfcBalance(prev => prev + reward);
        
        // Save to Firestore by updating the user profile points
        const updatedCount = adWatchesToday + 1;
        setAdWatchesToday(updatedCount);
        localStorage.setItem('adWatchCount', String(updatedCount));
        
        // We can use syncPointsToFirestore or custom updater
        await syncPointsToFirestore(telegramUser.id, efcBalance + reward);
        
        showToast(`🎉 Ad watch complete! +${reward} EFC Points added.`, 'success');
        confetti({ particleCount: 40, spread: 45, origin: { y: 0.6 }, colors: ['#FF8A00', '#00E5FF'] });
      }
    } catch (err: any) {
      showToast(err.message || 'Ad skipped or dismissed.', 'error');
    } finally {
      setWatchingAd(false);
    }
  };

  const displayName = telegramUser ? getDisplayName(telegramUser) : 'EForce Miner';
  const withdrawMinReferrals = settings.withdrawMinReferrals;
  const referralProgress = Math.min((referralsCount / withdrawMinReferrals) * 100, 100);

  return (
    <div className="flex flex-col gap-5 pb-28">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-1.5">
            Hey, {displayName.split(' ')[0]}
            {dbUser?.isVerified && <VerifiedBadge size={14} className="shrink-0" />}
            👋
          </h1>
          <p className="text-[10px] text-slate-500 mt-0.5 font-semibold uppercase tracking-widest">
            EForce Mining Dashboard
          </p>
        </div>
        <div className="w-10 h-10 rounded-full border border-[#FFD700]/30 bg-[#0E1225] flex items-center justify-center shadow-[0_0_16px_rgba(255,138,0,0.3)] overflow-hidden">
          {telegramUser?.photoUrl ? (
            <img src={telegramUser.photoUrl} alt="" className="w-full h-full object-cover rounded-full" />
          ) : (
            <img src={settings.coinIconUrl || '/coin.png'} alt="EForce Coin" className="w-full h-full object-cover rounded-full" />
          )}
        </div>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass-panel p-4 rounded-[20px] border-white/5 flex flex-col gap-1">
          <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">EFC Points</span>
          <span className="text-xl font-black text-[#FF8A00]">{efcBalance.toLocaleString()}</span>
          <span className="text-[9px] text-slate-500">{settings.swapRate || 1000} Points = 1 Token</span>
        </div>
        <div className="glass-panel p-4 rounded-[20px] border-white/5 flex flex-col gap-1">
          <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">EForce Token</span>
          <span className="text-xl font-black text-accent-purple">{(dbUser?.tokens || 0).toLocaleString()}</span>
          <span className="text-[9px] text-slate-500">Utility Asset</span>
        </div>
      </div>

      {/* Main Mining Area */}
      <div className="relative flex flex-col items-center gap-5 my-2">
        {/* Coin Wrapper */}
        <div
          onClick={handleMainCoinClick}
          onContextMenu={(e) => e.preventDefault()}
          className="relative w-64 h-64 cursor-pointer select-none flex items-center justify-center coin-tap-container active:scale-95 transition-transform duration-75 ease-out"
          style={{ perspective: 900 }}
        >
          {/* Floating rising clicks */}
          <AnimatePresence>
            {clicks.map(c => (
              <motion.span
                key={c.id}
                initial={{ opacity: 1, y: c.y - 20, x: c.x - 10, scale: 1 }}
                animate={{ opacity: 0, y: c.y - 80, scale: 1.2 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="absolute z-50 text-base font-black pointer-events-none select-none text-[#FFD700] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] font-display"
                style={{ left: 0, top: 0 }}
              >
                {c.text}
              </motion.span>
            ))}
          </AnimatePresence>

          {/* Multi-layer ambient glow rings */}
          <div className="absolute inset-[-16px] rounded-full blur-3xl bg-[#FF8A00]/10 animate-pulse transition-all duration-700" />
          <div className="absolute inset-[-4px] rounded-full blur-xl bg-[#FF8A00]/15 transition-all duration-700" />

          {/* Rotating orbit ring */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 25, ease: 'linear' }}
            className="absolute inset-0 rounded-full border border-dashed border-[#FFD700]/15"
          />

          {/* Gold solid ring border */}
          <div
            className="absolute inset-[2px] rounded-full pointer-events-none"
            style={{
              border: '2px solid rgba(255,215,0,0.18)',
              boxShadow: '0 0 30px rgba(255,138,0,0.25), inset 0 0 20px rgba(255,215,0,0.06)',
            }}
          />

          {/* Coin image */}
          <motion.img
            src={settings.coinIconUrl || '/coin.png'}
            alt="EForce Coin"
            draggable={false}
            whileTap={{ scale: 0.95 }}
            className="relative z-10 w-full h-full object-contain select-none drop-shadow-[0_0_28px_rgba(255,215,0,0.35)] coin-image transition-all duration-500"
          />
        </div>

        {/* Energy Details */}
        <div className="flex flex-col items-center gap-3.5 w-full">
          <div className="w-full max-w-sm flex flex-col gap-1.5 px-4 mt-2">
            <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              <span className="flex items-center gap-1">
                <Zap size={11} className="text-[#FF8A00] animate-pulse" />
                Energy
              </span>
              <span>{energy} / {maxEnergy}</span>
            </div>
            <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden border border-white/[0.03]">
              <div
                className="h-full bg-gradient-to-r from-[#FF8A00] to-[#FFD700] rounded-full transition-all duration-100"
                style={{ width: `${(energy / maxEnergy) * 100}%` }}
              />
            </div>
            {energyCooldownUntil > Date.now() && (
              <span className="text-[8px] text-accent-danger font-black uppercase tracking-wider text-center mt-1">
                ⚡ Cooldown Active (Locked for 60s)
              </span>
            )}
          </div>

          <span className="text-[9px] text-slate-500 font-semibold uppercase tracking-widest block text-center mt-1">
            Tap the coin to mine EFC points
          </span>
        </div>
      </div>

      {/* Daily Check-in */}
      <div className="glass-panel p-4 rounded-[22px] border-white/6 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Daily Check-in</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Flame size={11} className="text-[#FF8A00]" />
              <span className="text-xs font-black text-white">{dailyStreak} Day Streak</span>
            </div>
          </div>
          <button
            onClick={claimDailyReward}
            disabled={dailyClaimed || claimingDaily}
            className={`h-9 px-5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
              dailyClaimed
                ? 'bg-white/5 text-slate-500 border border-white/10 cursor-not-allowed'
                : 'bg-[#FF8A00] hover:bg-[#FF8A00]/90 text-white shadow-[0_0_14px_rgba(255,138,0,0.3)]'
            }`}
          >
            {claimingDaily ? (
              <span className="w-3 h-3 border-2 border-t-transparent border-white rounded-full animate-spin" />
            ) : (
              <Sparkles size={11} />
            )}
            {dailyClaimed ? 'Claimed ✓' : 'Claim'}
          </button>
        </div>

        {/* Streak Days Row */}
        <div className="flex gap-1.5">
          {(settings.dailyClaimRewards || []).map((reward, i) => {
            const dayNum = i + 1;
            const isCurrent = ((dailyStreak - 1) % 7) === i;
            const isPast = dailyStreak >= dayNum;
            return (
              <div
                key={i}
                className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-xl border transition-all ${
                  isCurrent && !dailyClaimed
                    ? 'border-[#FF8A00]/50 bg-[#FF8A00]/10'
                    : isPast
                    ? 'border-accent-success/30 bg-accent-success/5'
                    : 'border-white/5 bg-white/[0.02]'
                }`}
              >
                <span className="text-[7px] text-slate-500 font-bold">D{dayNum}</span>
                <span className="text-[9px] font-black text-white">{reward >= 1000 ? (reward/1000).toFixed(1)+'k' : reward}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sponsored Ads (Monetag) */}
      {settings.adEnabled && (
        <div className="glass-panel p-4 rounded-[22px] border-white/6 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Sponsored Ads</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xs font-black text-white">Watch & Earn Points</span>
              </div>
            </div>
            <button
              onClick={handleWatchAdClick}
              disabled={watchingAd || adWatchesToday >= settings.adDailyLimit}
              className={`h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                adWatchesToday >= settings.adDailyLimit
                  ? 'bg-white/5 text-slate-500 border border-white/10 cursor-not-allowed'
                  : 'bg-gradient-to-r from-accent-blue to-accent-cyan text-white shadow-[0_0_12px_rgba(0,229,255,0.25)]'
              }`}
            >
              {watchingAd ? (
                <span className="w-3 h-3 border-2 border-t-transparent border-white rounded-full animate-spin" />
              ) : (
                'Watch Ad'
              )}
            </button>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-slate-400">
              Reward: <span className="text-accent-cyan font-bold">+{settings.adRewardAmount} EFC Points</span>
            </span>
            <span className="text-[9px] text-slate-500 font-bold">
              Today: {adWatchesToday}/{settings.adDailyLimit} completed
            </span>
          </div>
        </div>
      )}

      {/* Referral Progress */}
      <div className="glass-panel p-4 rounded-[22px] border-white/6 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Referral Progress</span>
          <span className="text-[10px] font-black text-[#FF8A00]">{referralsCount}/{withdrawMinReferrals}</span>
        </div>
        <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-[#FF8A00] to-[#FFD700] rounded-full"
            animate={{ width: `${referralProgress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-slate-500">
            {referralsCount >= withdrawMinReferrals
              ? '✅ Withdrawal unlocked!'
              : `${withdrawMinReferrals - referralsCount} more referrals to unlock withdrawal`}
          </span>
          <ChevronRight size={12} className="text-slate-500" />
        </div>
      </div>

      {/* Leaderboard Button */}
      <button
        onClick={() => setActiveTab('leaderboard')}
        className="glass-panel p-4 rounded-[22px] border-white/6 flex items-center justify-between hover:bg-white/[0.04] transition-all cursor-pointer w-full"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[12px] bg-accent-purple/15 border border-accent-purple/25 flex items-center justify-center">
            <Trophy size={15} className="text-accent-purple" />
          </div>
          <div className="text-left">
            <span className="text-[11px] font-bold text-white block">Leaderboard</span>
            <span className="text-[9px] text-slate-500">Top EFC miners</span>
          </div>
        </div>
        <ChevronRight size={14} className="text-slate-500" />
      </button>
    </div>
  );
};
