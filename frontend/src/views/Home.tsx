import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Flame, Zap, ChevronRight, Trophy, Video } from 'lucide-react';
import confetti from 'canvas-confetti';
import { getDisplayName, type TelegramUser } from '../lib/telegramUser';
import { recordDailyCheckin, subscribeToUser, upsertUser, syncPointsToFirestore, type FirestoreUser } from '../lib/userService';
import { type AdminSettings } from '../lib/adminSettingsService';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { showRewardedAd } from '../lib/monetag';
import { MiningCoin } from '../components/MiningCoin';

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
  const [avatarImgError, setAvatarImgError] = useState(false);

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

  // --- Multi-Banner Hero Carousel (Right-to-Left Auto Slider) ---
  const validHeroBanners = (settings.heroBanners || []).filter(b => b && b.imageUrl);
  const activeBanners = validHeroBanners.length > 0
    ? validHeroBanners
    : settings.welcomeBannerUrl
      ? [{ id: 'default', imageUrl: settings.welcomeBannerUrl, title: '' }]
      : [];

  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);

  useEffect(() => {
    if (currentBannerIndex >= activeBanners.length) {
      setCurrentBannerIndex(0);
    }
  }, [activeBanners.length, currentBannerIndex]);

  useEffect(() => {
    if (activeBanners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentBannerIndex(prev => (prev + 1) % activeBanners.length);
    }, 4000); // Smooth auto-slide right to left every 4s
    return () => clearInterval(interval);
  }, [activeBanners.length]);

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

  const isTelegramPremium = !!(telegramUser?.isPremium);

  // Auto Miner: Telegram Premium vs Standard User Settings
  const durationSec = isTelegramPremium
    ? (settings.premiumAutoMinerDuration || settings.autoMinerDuration || 300)
    : (settings.autoMinerDuration || 300);

  const totalReward = isTelegramPremium
    ? (settings.premiumAutoMinerReward || settings.autoMinerReward || 1000)
    : (settings.autoMinerReward || 500);

  // Daily Check-in: Telegram Premium vs Standard Rewards Array
  const activeDailyRewards = (isTelegramPremium && settings.premiumDailyClaimRewards?.length === 7)
    ? settings.premiumDailyClaimRewards
    : (settings.dailyClaimRewards || [100, 150, 200, 300, 500, 750, 1000]);

  // Ads: Telegram Premium vs Standard Limits & Rewards
  const effectiveAdDailyLimit = isTelegramPremium
    ? (settings.adDailyLimitPremium || settings.adDailyLimit || 20)
    : (settings.adDailyLimitNormal || settings.adDailyLimit || 10);

  const effectiveAdReward = isTelegramPremium
    ? (settings.premiumAdRewardAmount || settings.adRewardAmount * 2 || 200)
    : (settings.adRewardAmount || 100);

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
    showToast(isTelegramPremium ? '⭐ Premium Automated Cloud Mining started!' : '⚡ Automated Cloud Mining started!', 'success');
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
        syncPointsToFirestore(telegramUser.id, efcBalance + rewardToClaim).catch(() => { });
      }

      showToast(`🎁 Claimed +${rewardToClaim.toLocaleString()} EFC Points! Next mining session started.`, 'success');
      confetti({ particleCount: 22, spread: 45, origin: { y: 0.6 }, ticks: 90, disableForReducedMotion: true, colors: ['#FF8A00', '#00E5FF', '#FFD700'] });
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
    let result = await recordDailyCheckin(telegramUser.id, activeDailyRewards);

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
        ).catch(() => { });

        // Retry checkin
        result = await recordDailyCheckin(telegramUser.id, activeDailyRewards);
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
      confetti({ particleCount: 20, spread: 45, origin: { y: 0.6 }, ticks: 90, disableForReducedMotion: true, colors: ['#FF8A00', '#00E5FF', '#B388FF'] });
    } else {
      showToast(result.reason || 'Already claimed today!', result.reason ? 'error' : 'warning');
    }
  };

  const handleWatchAdClick = async () => {
    if (!telegramUser) {
      showToast('Open in Telegram to earn with ads.', 'warning');
      return;
    }
    if (adWatchesToday >= effectiveAdDailyLimit) {
      showToast(`Daily limit reached! Come back tomorrow.`, 'warning');
      return;
    }
    if (watchingAd) return;

    setWatchingAd(true);
    try {
      showToast('Launching sponsored ad...', 'info');
      const completed = await showRewardedAd(settings.monetagZoneId, settings.monetagDirectLink);
      if (completed) {
        // Add point reward to user (Telegram Premium bonus vs Standard)
        const reward = effectiveAdReward;
        setEfcBalance(prev => prev + reward);

        // Save to Firestore by updating the user profile points
        const updatedCount = adWatchesToday + 1;
        setAdWatchesToday(updatedCount);
        localStorage.setItem('adWatchCount', String(updatedCount));

        await syncPointsToFirestore(telegramUser.id, efcBalance + reward);

        showToast(`🎉 Ad watch complete! +${reward} EFC Points added.`, 'success');
        confetti({ particleCount: 20, spread: 40, origin: { y: 0.6 }, ticks: 80, disableForReducedMotion: true, colors: ['#FF8A00', '#00E5FF'] });
      } else {
        showToast('⚠️ Ad closed too early! Watch the complete ad (min 7s) to earn rewards.', 'warning');
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
        {/* User Profile Avatar / Photo on Top-Right */}
        <div 
          onClick={() => setActiveTab && setActiveTab('profile')}
          className="w-10 h-10 rounded-full p-[2px] bg-gradient-to-tr from-[#FF8A00] to-[#00E5FF] shadow-[0_0_16px_rgba(0,229,255,0.35)] overflow-hidden cursor-pointer shrink-0 hover:scale-105 transition-all"
          title="View Profile"
        >
          <div className="w-full h-full rounded-full bg-[#0E1225] flex items-center justify-center text-white font-black text-xs overflow-hidden">
            {(dbUser?.photoUrl || telegramUser?.photoUrl) && !avatarImgError ? (
              <img 
                src={dbUser?.photoUrl || telegramUser?.photoUrl} 
                alt="Profile" 
                className="w-full h-full object-cover rounded-full" 
                onError={() => setAvatarImgError(true)}
              />
            ) : (
              <span className="text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-[#FF8A00] to-[#00E5FF]">
                {(displayName[0] || 'U').toUpperCase()}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Multi-Image Right-to-Left Auto-Sliding Hero Carousel Banner */}
      {activeBanners.length > 0 && (
        <div className="relative w-full h-[136px] min-h-[136px] rounded-[24px] overflow-hidden border border-white/12 shadow-[0_15px_35px_rgba(0,0,0,0.6)] bg-[#090D1F] group select-none shrink-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeBanners[currentBannerIndex]?.id || currentBannerIndex}
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '-100%', opacity: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => {
                const link = activeBanners[currentBannerIndex]?.linkUrl;
                if (link) {
                  const tg = (window as any).Telegram?.WebApp;
                  if (tg?.openTelegramLink && link.includes('t.me/')) tg.openTelegramLink(link);
                  else window.open(link, '_blank');
                }
              }}
              className={`absolute inset-0 w-full h-full ${activeBanners[currentBannerIndex]?.linkUrl ? 'cursor-pointer' : ''}`}
            >
              {activeBanners[currentBannerIndex]?.imageUrl?.toLowerCase().includes('.mp4') ||
                activeBanners[currentBannerIndex]?.imageUrl?.toLowerCase().includes('.webm') ||
                activeBanners[currentBannerIndex]?.imageUrl?.toLowerCase().includes('.mov') ||
                activeBanners[currentBannerIndex]?.imageUrl?.toLowerCase().startsWith('data:video/') ? (
                <video
                  src={activeBanners[currentBannerIndex]?.imageUrl}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <img
                  src={activeBanners[currentBannerIndex]?.imageUrl}
                  alt={activeBanners[currentBannerIndex]?.title || 'Hero Banner'}
                  className="w-full h-full object-cover"
                  loading="eager"
                  decoding="sync"
                  {...{ fetchpriority: 'high' }}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              {activeBanners[currentBannerIndex]?.title && (
                <div className="absolute bottom-3 left-4 right-4">
                  <span className="text-xs font-black text-white drop-shadow-md tracking-wide">
                    {activeBanners[currentBannerIndex]?.title}
                  </span>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Active Banner Slide Dots */}
          {activeBanners.length > 1 && (
            <div className="absolute bottom-2.5 right-4 z-20 flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/50 backdrop-blur-md border border-white/10">
              {activeBanners.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentBannerIndex(idx)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentBannerIndex ? 'w-4 bg-[#FF8A00]' : 'w-1.5 bg-white/40'
                    }`}
                />
              ))}
            </div>
          )}
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

      {/* ═══════════════════════════════════════════════════════════
           AUTOMATED CLOUD MINING REACTOR — Premium Web3 Interface
           ═══════════════════════════════════════════════════════════ */}
      <div className="relative flex flex-col items-center w-full my-2 select-none" style={{ gap: 0 }}>

        {/* ── Futuristic Mining Background Panel ─────────────────── */}
        <div
          className="relative w-full flex flex-col items-center overflow-hidden"
          style={{
            borderRadius: '28px',
            background: 'radial-gradient(ellipse 90% 70% at 50% 30%, rgba(30,18,4,0.98) 0%, rgba(10,8,20,0.99) 60%, rgba(5,8,22,1) 100%)',
            boxShadow: isMiningCompleted
              ? '0 0 0 1px rgba(255,215,0,0.18), 0 24px 80px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,215,0,0.15)'
              : isMiningActive
                ? '0 0 0 1px rgba(0,229,255,0.12), 0 24px 80px rgba(0,0,0,0.7), inset 0 1px 0 rgba(0,229,255,0.08)'
                : '0 0 0 1px rgba(255,138,0,0.10), 0 24px 80px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,138,0,0.07)',
            padding: '28px 20px 24px',
          }}
        >
          {/* Vignette edges */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              borderRadius: '28px',
              background: 'radial-gradient(ellipse 110% 110% at 50% 50%, transparent 55%, rgba(0,0,0,0.65) 100%)',
            }}
          />

          {/* Ambient golden light bloom — static radial, painted once */}
          <div
            className="absolute top-0 left-1/2 pointer-events-none"
            style={{
              transform: 'translateX(-50%)',
              width: '260px',
              height: '130px',
              background: isMiningCompleted
                ? 'radial-gradient(ellipse, rgba(255,200,0,0.16) 0%, transparent 70%)'
                : isMiningActive
                  ? 'radial-gradient(ellipse, rgba(0,229,255,0.09) 0%, transparent 70%)'
                  : 'radial-gradient(ellipse, rgba(255,138,0,0.07) 0%, transparent 70%)',
              // No filter:blur here — the radial-gradient itself provides the soft edge
            }}
          />

          {/* ── Golden Ambient Particles (5 max for 60fps on mobile) ─ */}
          {(isMiningActive || isMiningCompleted) && ([
            { left: '18%', size: 3, dur: '3.8s', delay: '0s', tx: '-15px' },
            { left: '35%', size: 2, dur: '4.5s', delay: '0.8s', tx: '10px' },
            { left: '50%', size: 4, dur: '3.2s', delay: '1.4s', tx: '-8px' },
            { left: '67%', size: 2, dur: '5.0s', delay: '0.3s', tx: '18px' },
            { left: '80%', size: 3, dur: '4.2s', delay: '1.9s', tx: '-20px' },
          ] as const).map((p, i) => (
            <div
              key={i}
              className="gold-particle"
              style={{
                bottom: '55px',
                left: p.left,
                width: `${p.size}px`,
                height: `${p.size}px`,
                background: isMiningCompleted
                  ? `rgba(255,${190 + i * 8},0,0.85)`
                  : `rgba(0,220,255,0.75)`,
                // No box-shadow on particles — box-shadow triggers paint per-particle
                ['--dur' as any]: p.dur,
                ['--delay' as any]: p.delay,
                ['--tx' as any]: p.tx,
              }}
            />
          ))}

          {/* ── Mining Core Circle ─────────────────────────────── */}
          <div
            className="relative flex items-center justify-center"
            style={{ width: '272px', height: '272px', flexShrink: 0 }}
          >
            {/* Outer wide glow — static radial, no filter:blur (zero paint cost) */}
            <div
              className={`absolute rounded-full pointer-events-none transition-opacity duration-700 ${isMiningCompleted ? 'completed-aura' : ''
                }`}
              style={{
                inset: '-16px',
                background: isMiningCompleted
                  ? 'radial-gradient(circle, rgba(255,200,0,0.28) 0%, rgba(255,120,0,0.12) 55%, transparent 80%)'
                  : isMiningActive
                    ? 'radial-gradient(circle, rgba(0,229,255,0.20) 0%, rgba(0,136,255,0.10) 55%, transparent 80%)'
                    : 'transparent',
              }}
            />

            {/* Outer slow-rotating dashed ring */}
            <div
              className="mining-ring-spin absolute rounded-full pointer-events-none"
              style={{
                inset: '0',
                border: isMiningCompleted
                  ? '1px dashed rgba(255,215,0,0.45)'
                  : isMiningActive
                    ? '1px dashed rgba(0,229,255,0.38)'
                    : '1px dashed rgba(255,138,0,0.18)',
                borderRadius: '50%',
              }}
            />

            {/* Inner reverse-rotating dashed ring */}
            <div
              className="mining-ring-spin-reverse absolute rounded-full pointer-events-none"
              style={{
                inset: '8px',
                border: isMiningCompleted
                  ? '1px dashed rgba(255,180,0,0.25)'
                  : isMiningActive
                    ? '1px dashed rgba(0,200,255,0.20)'
                    : '1px dashed rgba(255,138,0,0.10)',
                borderRadius: '50%',
              }}
            />

            {/* Solid glowing border ring */}
            <div
              className="absolute rounded-full pointer-events-none mining-pulse-ring"
              style={{
                inset: '4px',
                border: isMiningCompleted
                  ? '1.5px solid rgba(255,215,0,0.55)'
                  : isMiningActive
                    ? '1.5px solid rgba(0,229,255,0.40)'
                    : '1.5px solid rgba(255,138,0,0.22)',
                borderRadius: '50%',
                boxShadow: isMiningCompleted
                  ? '0 0 30px rgba(255,215,0,0.35), inset 0 0 22px rgba(255,215,0,0.12)'
                  : isMiningActive
                    ? '0 0 30px rgba(0,229,255,0.28), inset 0 0 20px rgba(0,229,255,0.10)'
                    : '0 0 18px rgba(255,138,0,0.14)',
              }}
            />

            {/* Inner circle background — dark metallic */}
            <div
              className="absolute rounded-full pointer-events-none"
              style={{
                inset: '6px',
                background: 'radial-gradient(circle at 38% 32%, rgba(40,28,8,0.95) 0%, rgba(12,10,24,0.97) 60%, rgba(5,8,22,0.99) 100%)',
                borderRadius: '50%',
              }}
            />

            {/* ✅ MiningCoin — perfectly centered, no offset */}
            <div
              className="relative z-10 flex items-center justify-center"
              style={{ width: '220px', height: '220px' }}
            >
              <MiningCoin
                isMiningActive={isMiningActive}
                isMiningCompleted={isMiningCompleted}
              />
            </div>

            {/* Live Hashrate Badge — bottom center of circle */}
            {isMiningActive && (
              <div className="absolute z-20 bottom-5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#050816]/95 border border-[#00E5FF]/40 flex items-center gap-1.5 shadow-[0_2px_8px_rgba(0,0,0,0.6)] whitespace-nowrap">
                <span className="w-2 h-2 rounded-full bg-[#00E5FF] animate-ping shrink-0" />
                <span className="text-[9px] font-black text-[#00E5FF] tracking-wider uppercase font-mono">
                  {(totalReward / (durationSec / 3600)).toFixed(1)} EFC/hr
                </span>
              </div>
            )}

            {/* Completed badge — bottom center of circle */}
            {isMiningCompleted && (
              <div className="absolute z-20 bottom-5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#1A0F00]/95 border border-[#FFD700]/50 flex items-center gap-1.5 shadow-[0_2px_8px_rgba(255,200,0,0.2)] whitespace-nowrap">
                <span className="text-[9px] font-black text-[#FFD700] tracking-wider uppercase font-mono">
                  ✦ READY TO CLAIM
                </span>
              </div>
            )}
          </div>

          {/* ── Mining Complete Card ────────────────────────────── */}
          <div
            className="mining-card-enter w-full flex flex-col items-center gap-3 mt-5"
            style={{ maxWidth: '320px' }}
          >
            {/* Status + Yield Card */}
            <div
              className="w-full flex flex-col items-center gap-2"
              style={{
                background: 'rgba(14, 18, 37, 0.94)',
                borderRadius: '20px',
                border: isMiningCompleted
                  ? '1px solid rgba(255,215,0,0.22)'
                  : isMiningActive
                    ? '1px solid rgba(0,229,255,0.16)'
                    : '1px solid rgba(255,255,255,0.07)',
                padding: '16px',
                boxShadow: isMiningCompleted
                  ? '0 0 0 1px rgba(255,200,0,0.08), 0 8px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,215,0,0.10)'
                  : '0 8px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
                transform: 'translateZ(0)',
              }}
            >
              {/* Label row */}
              <div className="flex items-center gap-1.5 w-full justify-center">
                <Zap
                  size={11}
                  className={isMiningActive ? 'text-[#00E5FF] animate-pulse' : isMiningCompleted ? 'text-[#FFD700]' : 'text-[#FF8A00]'}
                />
                <span className={`text-[9px] font-black uppercase tracking-[0.18em] ${isMiningActive ? 'text-[#00E5FF]' : isMiningCompleted ? 'text-[#FFD700]' : 'text-slate-400'
                  }`}>
                  {isMiningActive ? 'Live Mining Yield' : isMiningCompleted ? 'Mining Complete' : 'Cloud Mining Machine'}
                </span>
              </div>

              {/* Big reward number — premium typography */}
              <div className="flex items-baseline gap-2 justify-center mt-0.5">
                <span
                  className={`font-black leading-none ${isMiningCompleted ? 'text-[#FFD700]' : isMiningActive ? 'text-[#00E5FF]' : 'text-slate-400'
                    }`}
                  style={{
                    fontSize: '2rem',
                    letterSpacing: '-0.02em',
                    textShadow: isMiningCompleted
                      ? '0 0 20px rgba(255,215,0,0.6), 0 0 40px rgba(255,138,0,0.3)'
                      : isMiningActive
                        ? '0 0 20px rgba(0,229,255,0.5)'
                        : 'none',
                  }}
                >
                  +{accumulatedMinedPoints.toLocaleString()}
                </span>
                <span
                  className="font-extrabold uppercase tracking-widest text-slate-300"
                  style={{ fontSize: '0.7rem', letterSpacing: '0.15em' }}
                >
                  EFC
                </span>
              </div>

              {/* Progress Bar — rounded, glowing, animated */}
              <div
                className="w-full relative mt-1"
                style={{ height: '10px' }}
              >
                <div
                  className="absolute inset-0 rounded-full overflow-hidden"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  {/* Fill */}
                  <motion.div
                    className="h-full rounded-full relative overflow-hidden"
                    style={{
                      background: isMiningCompleted
                        ? 'linear-gradient(90deg, #FF8A00 0%, #FFB347 45%, #FFD700 100%)'
                        : isMiningActive
                          ? 'linear-gradient(90deg, #00B4CC 0%, #00E5FF 60%, #4DFFFF 100%)'
                          : 'rgba(255,255,255,0.10)',
                      boxShadow: isMiningCompleted
                        ? '0 0 12px rgba(255,200,0,0.7), 0 0 4px rgba(255,138,0,0.5)'
                        : isMiningActive
                          ? '0 0 12px rgba(0,229,255,0.6)'
                          : 'none',
                      width: `${miningProgress}%`,
                      transition: 'width 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: `${miningProgress}%` }}
                    transition={{ duration: 1.0, ease: [0.25, 0.46, 0.45, 0.94] }}
                  >
                    {/* Shimmer sweep */}
                    {(isMiningActive || isMiningCompleted) && (
                      <div className="progress-shimmer absolute inset-0" />
                    )}
                  </motion.div>
                </div>
              </div>

              {/* Subtext row */}
              <div className="flex justify-between items-center w-full mt-1">
                <span className="text-[9px] font-bold text-slate-400 font-mono tracking-wide">
                  {isMiningActive
                    ? `⏱ ${timeRemainingStr}`
                    : isMiningCompleted
                      ? '✦ Ready to Claim!'
                      : 'Automated Cloud Mining'}
                </span>
                <span className="text-[9px] font-bold text-slate-500 font-mono">
                  {miningProgress.toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Action Button */}
            {isMiningCompleted ? (
              <button
                onClick={handleClaimMiningRewards}
                disabled={claimingMining}
                className="w-full h-12 rounded-[18px] text-black text-xs font-black uppercase tracking-wider hover:scale-[1.02] active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 relative overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, #FF8A00 0%, #FFB347 40%, #FFD700 80%, #FFF4AA 100%)',
                  boxShadow: '0 0 30px rgba(255,165,0,0.55), 0 4px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.3)',
                }}
              >
                {/* Subtle shine overlay */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 60%)',
                    borderRadius: '18px',
                  }}
                />
                {claimingMining ? (
                  <span className="w-4 h-4 border-2 border-t-transparent border-black rounded-full animate-spin" />
                ) : (
                  <span className="relative z-10">🎁 CLAIM REWARDS (+{totalReward.toLocaleString()} EFC)</span>
                )}
              </button>
            ) : isMiningActive ? (
              <div
                className="w-full h-12 rounded-[18px] text-[#00E5FF] text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 select-none"
                style={{
                  background: 'rgba(0,229,255,0.06)',
                  border: '1px solid rgba(0,229,255,0.28)',
                  boxShadow: '0 0 18px rgba(0,229,255,0.12)',
                }}
              >
                <span className="w-2 h-2 rounded-full bg-[#00E5FF] animate-ping shrink-0" />
                <span>MINING IN PROGRESS ⚡ ({timeRemainingStr})</span>
              </div>
            ) : (
              <button
                onClick={handleStartMining}
                className="w-full h-12 rounded-[18px] text-black text-xs font-black uppercase tracking-wider hover:scale-[1.02] active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
                style={{
                  background: 'linear-gradient(135deg, #00B4CC 0%, #00E5FF 60%, #4DFFFF 100%)',
                  boxShadow: '0 0 28px rgba(0,229,255,0.45), 0 4px 20px rgba(0,0,0,0.4)',
                }}
              >
                🚀 START AUTOMATED MINING SESSION
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Daily Check-in */}
      <div className="glass-panel p-4 rounded-[22px] border-white/6 flex flex-col gap-3 relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Daily Check-in</span>
              {isTelegramPremium && (
                <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-amber-400/15 text-amber-300 border border-amber-400/30 flex items-center gap-0.5">
                  ⭐ Premium Boost
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Flame size={11} className="text-[#FF8A00]" />
              <span className="text-xs font-black text-white">{dailyStreak} Day Streak</span>
            </div>
          </div>
          <button
            onClick={claimDailyReward}
            disabled={dailyClaimed || claimingDaily}
            className={`h-9 px-5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${dailyClaimed
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
          {activeDailyRewards.map((reward, i) => {
            const dayNum = i + 1;
            const isCurrent = ((dailyStreak - 1) % 7) === i;
            const isPast = dailyStreak >= dayNum;
            return (
              <div
                key={i}
                className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-xl border transition-all ${isCurrent && !dailyClaimed
                  ? 'border-[#FF8A00]/50 bg-[#FF8A00]/10'
                  : isPast
                    ? 'border-accent-success/30 bg-accent-success/5'
                    : 'border-white/5 bg-white/[0.02]'
                  }`}
              >
                <span className="text-[7px] text-slate-500 font-bold">D{dayNum}</span>
                <span className="text-[9px] font-black text-white">{reward >= 1000 ? (reward / 1000).toFixed(1) + 'k' : reward}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sponsored Ads Card */}
      {settings.adEnabled && (
        <div
          className="glass-panel p-4 rounded-[22px] border flex items-center justify-between shadow-lg"
          style={{ background: 'linear-gradient(135deg, rgba(0, 229, 255, 0.14) 0%, rgba(255, 138, 0, 0.08) 100%)', borderColor: 'rgba(0, 229, 255, 0.3)' }}
        >
          <div className="flex items-center gap-3 min-w-0 pr-2">
            <div className="w-10 h-10 rounded-[14px] flex items-center justify-center shrink-0 border border-[#00E5FF]/40 bg-[#00E5FF]/20 text-[#00E5FF] shadow-[0_0_12px_rgba(0,229,255,0.25)]">
              <Video size={18} />
            </div>
            <div className="flex flex-col gap-0.5 min-w-0">
              <h4 className="text-xs sm:text-sm font-extrabold text-white leading-snug">
                Watch an ad, earn <span className="text-[#00E5FF] font-black">+{effectiveAdReward} EFC Points</span>
              </h4>
              <div className="flex items-center gap-2">
                <p className="text-[10px] text-slate-400 font-mono leading-tight">
                  {adWatchesToday < effectiveAdDailyLimit
                    ? `${effectiveAdDailyLimit - adWatchesToday}/${effectiveAdDailyLimit} left today`
                    : 'Daily limit reached'}
                </p>
                {isTelegramPremium && (
                  <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-cyan-400/15 text-cyan-300 border border-cyan-400/30 whitespace-nowrap shrink-0">
                    ⭐ 2x
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={handleWatchAdClick}
            disabled={watchingAd || adWatchesToday >= effectiveAdDailyLimit}
            className={`h-9 px-4 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${adWatchesToday >= effectiveAdDailyLimit
              ? 'bg-white/5 text-slate-500 border border-white/10 cursor-not-allowed'
              : 'bg-gradient-to-r from-[#00E5FF] via-[#00B0FF] to-[#3B82F6] text-[#050816] shadow-[0_0_14px_rgba(0,229,255,0.35)] hover:scale-105'
              }`}
          >
            {watchingAd ? (
              <span className="w-3.5 h-3.5 border-2 border-t-transparent border-black rounded-full animate-spin" />
            ) : (
              <>
                <Video size={13} /> Watch
              </>
            )}
          </button>
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
