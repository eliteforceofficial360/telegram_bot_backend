import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Flame, Zap, ChevronRight, Trophy } from 'lucide-react';
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
  void energy;
  void setEnergy;
  void maxEnergy;
  void referralsCount;
  void setActiveTab;
  void energyCooldownUntil;

  // Daily Check-in (Firestore backed)
  const [dailyClaimed, setDailyClaimed] = useState(false);
  const [dailyStreak, setDailyStreak] = useState(0);
  const [claimingDaily, setClaimingDaily] = useState(false);

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

  // --- Automated Cloud Mining Engine ---
  const [miningStartTime, setMiningStartTime] = useState<number>(() => {
    return Number(localStorage.getItem('miningStartTime') || '0');
  });
  void miningStartTime;
  const [isMiningActive, setIsMiningActive] = useState<boolean>(false);
  const [miningProgress, setMiningProgress] = useState<number>(0);
  const [accumulatedMinedPoints, setAccumulatedMinedPoints] = useState<number>(0);
  const [timeRemainingStr, setTimeRemainingStr] = useState<string>('');
  const [isMiningCompleted, setIsMiningCompleted] = useState<boolean>(false);
  const [claimingMining, setClaimingMining] = useState<boolean>(false);

  const durationSec = settings.autoMinerDuration || 86400; // 24h default session
  const totalReward = settings.autoMinerReward || 1000;    // 1,000 EFC default reward

  // Live Mining Loop Effect
  useEffect(() => {
    const updateMiningStatus = () => {
      const now = Date.now();
      const startTime = Number(localStorage.getItem('miningStartTime') || '0');

      if (!startTime || startTime === 0) {
        setIsMiningActive(false);
        setIsMiningCompleted(false);
        setMiningProgress(0);
        setAccumulatedMinedPoints(0);
        setTimeRemainingStr('');
        return;
      }

      const elapsedSec = (now - startTime) / 1000;

      if (elapsedSec >= durationSec) {
        // Mining Completed! Ready to Claim
        setIsMiningActive(false);
        setIsMiningCompleted(true);
        setMiningProgress(100);
        setAccumulatedMinedPoints(totalReward);
        setTimeRemainingStr('00h 00m 00s');
      } else {
        // Mining Active
        setIsMiningActive(true);
        setIsMiningCompleted(false);
        const ratio = elapsedSec / durationSec;
        setMiningProgress(Math.min(100, ratio * 100));
        setAccumulatedMinedPoints(Math.floor(ratio * totalReward));

        const remainingSec = Math.max(0, durationSec - elapsedSec);
        const hrs = Math.floor(remainingSec / 3600);
        const mins = Math.floor((remainingSec % 3600) / 60);
        const secs = Math.floor(remainingSec % 60);
        setTimeRemainingStr(
          `${String(hrs).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`
        );
      }
    };

    updateMiningStatus();
    const interval = setInterval(updateMiningStatus, 1000);
    return () => clearInterval(interval);
  }, [durationSec, totalReward]);

  // Start Automated Mining Session
  const handleStartMining = () => {
    const now = Date.now();
    localStorage.setItem('miningStartTime', String(now));
    setMiningStartTime(now);
    setIsMiningActive(true);
    setIsMiningCompleted(false);
    showToast('⚡ Automated Cloud Mining started! Watch your points grow.', 'success');
  };

  // Claim Mining Rewards & Start Next Cycle
  const handleClaimMiningRewards = async () => {
    if (claimingMining) return;
    setClaimingMining(true);

    try {
      const rewardToClaim = totalReward;
      setEfcBalance(prev => prev + rewardToClaim);

      // Auto-restart next mining session
      const now = Date.now();
      localStorage.setItem('miningStartTime', String(now));
      setMiningStartTime(now);
      setIsMiningActive(true);
      setIsMiningCompleted(false);

      if (telegramUser) {
        syncPointsToFirestore(telegramUser.id, efcBalance + rewardToClaim).catch(() => {});
      }

      showToast(`🎁 Claimed +${rewardToClaim.toLocaleString()} EFC Points! Next mining session started.`, 'success');
      confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 }, colors: ['#FF8A00', '#00E5FF', '#FFD700'] });
    } catch {
      showToast('Error claiming mining rewards.', 'error');
    } finally {
      setClaimingMining(false);
    }
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
        <div className="flex items-center gap-2.5">
          {settings.appHeaderLogoUrl && (
            <img src={settings.appHeaderLogoUrl} alt="Logo" className="w-8 h-8 object-contain shrink-0" />
          )}
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
        </div>
        <div className="w-10 h-10 rounded-full border border-[#FFD700]/30 bg-[#0E1225] flex items-center justify-center shadow-[0_0_16px_rgba(255,138,0,0.3)] overflow-hidden">
          {settings.appHeaderRightLogoUrl ? (
            <img src={settings.appHeaderRightLogoUrl} alt="Header Avatar" className="w-full h-full object-cover rounded-full" />
          ) : telegramUser?.photoUrl ? (
            <img src={telegramUser.photoUrl} alt="" className="w-full h-full object-cover rounded-full" />
          ) : (
            <img src={settings.coinIconUrl || '/coin.png'} alt="EForce Coin" className="w-full h-full object-cover rounded-full" />
          )}
        </div>
      </div>

      {/* Hero Welcome Banner (if set by Admin) */}
      {settings.welcomeBannerUrl && (
        <div className="w-full h-32 rounded-[22px] overflow-hidden border border-white/10 relative shadow-[0_12px_30px_rgba(0,0,0,0.5)]">
          <img src={settings.welcomeBannerUrl} alt="Hero Banner" className="w-full h-full object-cover" />
        </div>
      )}

      {/* Balance Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass-panel p-4 rounded-[20px] border-white/5 flex flex-col gap-1 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">EFC Points</span>
            {settings.coinIconUrl && <img src={settings.coinIconUrl} alt="" className="w-4 h-4 object-contain opacity-80" />}
          </div>
          <span className="text-xl font-black text-[#FF8A00]">{efcBalance.toLocaleString()}</span>
          <span className="text-[9px] text-slate-500">{settings.swapRate || 1000} Points = 1 Token</span>
        </div>
        <div className="glass-panel p-4 rounded-[20px] border-white/5 flex flex-col gap-1 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">EForce Token</span>
            {settings.eforceTokenIconUrl && <img src={settings.eforceTokenIconUrl} alt="" className="w-4 h-4 object-contain opacity-80" />}
          </div>
          <span className="text-xl font-black text-accent-purple">{(dbUser?.tokens || 0).toLocaleString()}</span>
          <span className="text-[9px] text-slate-500">Utility Asset</span>
        </div>
      </div>

      {/* Automated Cloud Mining Reactor Widget */}
      <div className="relative flex flex-col items-center gap-5 my-3 w-full">
        {/* Cloud Mining Core Circle */}
        <div
          className="relative w-64 h-64 select-none flex items-center justify-center pointer-events-none"
          style={{ perspective: 900 }}
        >
          {/* Ambient Glow Rings */}
          <div className={`absolute inset-[-16px] rounded-full blur-3xl transition-all duration-700 ${
            isMiningActive ? 'bg-[#00E5FF]/20 animate-pulse' : isMiningCompleted ? 'bg-[#FFD700]/25 animate-pulse' : 'bg-[#FF8A00]/10'
          }`} />
          <div className={`absolute inset-[-4px] rounded-full blur-xl transition-all duration-700 ${
            isMiningActive ? 'bg-[#00E5FF]/25' : isMiningCompleted ? 'bg-[#FFD700]/30' : 'bg-[#FF8A00]/15'
          }`} />

          {/* Rotating Orbit Ring */}
          <motion.div
            animate={{ rotate: isMiningActive ? 360 : 0 }}
            transition={{ repeat: Infinity, duration: 12, ease: 'linear' }}
            className={`absolute inset-0 rounded-full border border-dashed ${
              isMiningActive ? 'border-[#00E5FF]/40' : isMiningCompleted ? 'border-[#FFD700]/50' : 'border-[#FF8A00]/20'
            }`}
          />

          {/* Inner Glowing Ring */}
          <div
            className="absolute inset-[2px] rounded-full"
            style={{
              border: `2px solid ${isMiningActive ? 'rgba(0,229,255,0.35)' : isMiningCompleted ? 'rgba(255,215,0,0.5)' : 'rgba(255,138,0,0.2)'}`,
              boxShadow: isMiningActive
                ? '0 0 35px rgba(0,229,255,0.3), inset 0 0 20px rgba(0,229,255,0.1)'
                : isMiningCompleted
                ? '0 0 40px rgba(255,215,0,0.4), inset 0 0 25px rgba(255,215,0,0.15)'
                : '0 0 20px rgba(255,138,0,0.15)',
            }}
          />

          {/* Mining Core Icon / Coin (Enlarged & Circular Masked - Zero Black Background) */}
          <div className="relative z-10 w-56 h-56 rounded-full overflow-hidden flex items-center justify-center shadow-[0_0_40px_rgba(255,215,0,0.35)] transition-all duration-500 bg-[#050816]">
            <motion.img
              src={settings.coinIconUrl || '/coin.png'}
              alt="Mining Core"
              draggable={false}
              animate={isMiningActive ? { rotate: [0, 4, -4, 0], scale: [1, 1.03, 1] } : {}}
              transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
              className="w-full h-full object-cover rounded-full select-none coin-image transition-all duration-500"
              style={{ mixBlendMode: 'screen' }}
            />
          </div>

          {/* Live Hashrate Badge inside Core */}
          {isMiningActive && (
            <div className="absolute z-20 bottom-4 px-3.5 py-1 rounded-full bg-[#050816]/90 border border-[#00E5FF]/40 backdrop-blur-md flex items-center gap-1.5 shadow-[0_4px_15px_rgba(0,0,0,0.6)]">
              <span className="w-2 h-2 rounded-full bg-[#00E5FF] animate-ping" />
              <span className="text-[10px] font-black text-[#00E5FF] tracking-wider uppercase font-mono">
                {(totalReward / (durationSec / 3600)).toFixed(1)} EFC/hr
              </span>
            </div>
          )}
        </div>

        {/* Live Mining Yield & Status Card */}
        <div className="w-full max-w-sm flex flex-col items-center gap-3 px-2">
          {/* Real-time Accumulated Mining Yield Counter */}
          <div className="glass-panel p-4 rounded-[22px] border-white/8 w-full flex flex-col items-center gap-1 shadow-[0_10px_30px_rgba(0,0,0,0.4)]">
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1">
              <Zap size={11} className={isMiningActive ? 'text-[#00E5FF] animate-pulse' : 'text-[#FF8A00]'} />
              {isMiningActive ? 'Live Mining Yield' : isMiningCompleted ? 'Mining Complete' : 'Cloud Mining Machine'}
            </span>

            <div className="flex items-center gap-1.5 my-1">
              <span className={`text-2xl font-black ${
                isMiningActive ? 'text-[#00E5FF]' : isMiningCompleted ? 'text-[#FFD700]' : 'text-slate-400'
              }`}>
                +{accumulatedMinedPoints.toLocaleString()}
              </span>
              <span className="text-xs font-extrabold text-slate-300 uppercase tracking-wider">EFC</span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden border border-white/[0.05] relative my-1">
              <motion.div
                className={`h-full rounded-full transition-all duration-300 ${
                  isMiningActive
                    ? 'bg-gradient-to-r from-[#00E5FF] to-[#0088FF]'
                    : isMiningCompleted
                    ? 'bg-gradient-to-r from-[#FF8A00] to-[#FFD700]'
                    : 'bg-white/10'
                }`}
                style={{ width: `${miningProgress}%` }}
              />
            </div>

            {/* Subtext info */}
            <div className="flex justify-between items-center w-full text-[9.5px] font-bold text-slate-400 mt-0.5 font-mono">
              <span>{isMiningActive ? `Time Remaining: ${timeRemainingStr}` : isMiningCompleted ? 'Ready to Claim!' : 'Automated Cloud Mining'}</span>
              <span>{miningProgress.toFixed(1)}%</span>
            </div>
          </div>

          {/* Action Button: Start / Claim / In Progress */}
          {isMiningCompleted ? (
            <button
              onClick={handleClaimMiningRewards}
              disabled={claimingMining}
              className="w-full h-12 rounded-[20px] bg-gradient-to-r from-[#FF8A00] via-[#FFB347] to-[#FFD700] text-black text-xs font-black uppercase tracking-wider shadow-[0_0_25px_rgba(255,138,0,0.5)] hover:scale-[1.02] active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {claimingMining ? (
                <span className="w-4 h-4 border-2 border-t-transparent border-black rounded-full animate-spin" />
              ) : (
                <>🎁 CLAIM MINING REWARDS (+{totalReward.toLocaleString()} EFC)</>
              )}
            </button>
          ) : isMiningActive ? (
            <div className="w-full h-12 rounded-[20px] bg-[#0E1225] border border-[#00E5FF]/30 text-[#00E5FF] text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,229,255,0.15)] select-none">
              <span className="w-2 h-2 rounded-full bg-[#00E5FF] animate-ping" />
              <span>MINING IN PROGRESS ⚡ ({timeRemainingStr})</span>
            </div>
          ) : (
            <button
              onClick={handleStartMining}
              className="w-full h-12 rounded-[20px] bg-gradient-to-r from-[#00E5FF] to-[#0088FF] text-black text-xs font-black uppercase tracking-wider shadow-[0_0_25px_rgba(0,229,255,0.4)] hover:scale-[1.02] active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              🚀 START AUTOMATED MINING SESSION
            </button>
          )}
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
