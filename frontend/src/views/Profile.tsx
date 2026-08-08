import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Trophy, 
  Calendar, 
  Globe2, 
  Laptop, 
  Copy, 
  Check, 
  ShieldCheck, 
  Zap, 
  Wallet as WalletIcon, 
  Sparkles, 
  Lock, 
  Unlock,
  Pickaxe,
  Users,
  Headset,
  MessageSquare
} from 'lucide-react';
import { getDisplayName, type TelegramUser } from '../lib/telegramUser';
import { updateUserDatabaseValues, type FirestoreUser } from '../lib/userService';
import { UsdtIcon } from '../components/UsdtIcon';
import { DEFAULT_ADMIN_SETTINGS, type AdminSettings } from '../lib/adminSettingsService';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { Connections } from '../components/Connections';
import {
  subscribeToReferralTiers,
  calculateUserReferralTier,
  getTierBadgeWithIcon,
  type ReferralClaimTier,
} from '../lib/referralTierService';

interface ProfileProps {
  efcBalance: number;
  usdtBalance?: number;
  eforceTokens?: number;
  referralsCount?: number;
  adminSettings?: AdminSettings;
  dbUser: FirestoreUser | null;
  showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  telegramUser: TelegramUser | null;
  onOpenSupport?: () => void;
}

export const Profile = ({ 
  efcBalance, 
  usdtBalance = 0, 
  eforceTokens = 0,
  referralsCount = 0,
  adminSettings,
  dbUser, 
  showToast, 
  telegramUser,
  onOpenSupport
}: ProfileProps) => {
  const connectedAddress = dbUser?.walletAddress || null;
  const [copiedId, setCopiedId] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [liveTiers, setLiveTiers] = useState<ReferralClaimTier[]>([]);
  const [_isEditingName, setIsEditingName] = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [_savingName, setSavingName] = useState(false);

  const [isEditingDev, setIsEditingDev] = useState(false);
  const [userDevRole, setUserDevRole] = useState(dbUser?.devRole || '');
  const [userDevBio, setUserDevBio] = useState(dbUser?.devBio || '');
  const [savingDev, setSavingDev] = useState(false);

  useEffect(() => {
    if (dbUser) {
      setUserDevRole(dbUser.devRole || '');
      setUserDevBio(dbUser.devBio || '');
    }
  }, [dbUser?.devRole, dbUser?.devBio]);

  const handleSaveDevInfo = async () => {
    const userId = telegramUser?.id || dbUser?.telegramId;
    if (!userId) return;
    if (dbUser?.devLocked) {
      showToast('🔒 Developer information is locked by Admin.', 'warning');
      return;
    }
    setSavingDev(true);
    try {
      const ok = await updateUserDatabaseValues(userId, {
        devRole: userDevRole.trim(),
        devBio: userDevBio.trim(),
      });
      if (ok) {
        showToast('✅ Developer information updated successfully!', 'success');
        setIsEditingDev(false);
      } else {
        showToast('Failed to update developer profile.', 'error');
      }
    } catch {
      showToast('Error updating developer profile.', 'error');
    } finally {
      setSavingDev(false);
    }
  };

  const handleOpenDeveloperLink = (targetUrl?: string) => {
    let finalUrl = (targetUrl || adminSettings?.devAppContactUrl || adminSettings?.devAppPortfolioUrl || '').trim();
    if (!finalUrl && adminSettings?.devAppTelegram) {
      const handle = adminSettings.devAppTelegram.replace('@', '').trim();
      finalUrl = `https://t.me/${handle}`;
    }
    if (!finalUrl) finalUrl = 'https://t.me/EliteForceDev';

    const tg = (window as any).Telegram?.WebApp;
    if (finalUrl.includes('t.me/')) {
      if (tg?.openTelegramLink) {
        tg.openTelegramLink(finalUrl);
        return;
      }
    }
    if (tg?.openLink) {
      tg.openLink(finalUrl);
      return;
    }
    window.open(finalUrl, '_blank', 'noopener,noreferrer');
  };

  useEffect(() => {
    const unsub = subscribeToReferralTiers(setLiveTiers);
    return unsub;
  }, []);

  const _handleStartEditName = () => {
    setEditFirstName(dbUser?.firstName ?? telegramUser?.firstName ?? '');
    setEditLastName(dbUser?.lastName ?? telegramUser?.lastName ?? '');
    setEditUsername(dbUser?.username ?? telegramUser?.username ?? '');
    setIsEditingName(true);
  };
  void _handleStartEditName;

  const _handleSaveName = async () => {
    const userId = telegramUser?.id || dbUser?.telegramId;
    if (!userId) {
      showToast('User session not found.', 'warning');
      return;
    }
    if (!editFirstName.trim()) {
      showToast('First Name cannot be empty.', 'warning');
      return;
    }
    setSavingName(true);
    try {
      const cleanUsername = editUsername.replace(/^@/, '').trim();
      const ok = await updateUserDatabaseValues(userId, {
        firstName: editFirstName.trim(),
        lastName: editLastName.trim(),
        username: cleanUsername,
      });
      if (ok) {
        showToast('✅ Profile name & username updated successfully!', 'success');
        setIsEditingName(false);
      } else {
        showToast('Failed to update profile. Please try again.', 'error');
      }
    } catch {
      showToast('Error updating profile details.', 'error');
    } finally {
      setSavingName(false);
    }
  };
  void _handleSaveName;

  const handleCopyId = () => {
    if (!telegramUser) return;
    navigator.clipboard.writeText(String(telegramUser.id));
    setCopiedId(true);
    showToast('Telegram ID copied to clipboard!', 'success');
    setTimeout(() => setCopiedId(false), 2000);
  };

  const formatTimestamp = (ts: any) => {
    if (!ts) return 'July 20, 2026';
    try {
      const date = typeof ts.toDate === 'function' 
        ? ts.toDate() 
        : (ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts));
      if (isNaN(date.getTime())) return 'July 20, 2026';
      return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return 'July 20, 2026';
    }
  };

  const joinDateStr = formatTimestamp(dbUser?.joinDate || dbUser?.createdAt);
  
  const latestIp = dbUser?.ipHistory && dbUser.ipHistory.length > 0
    ? dbUser.ipHistory[dbUser.ipHistory.length - 1]
    : '180.149.234.100';

  const country = dbUser?.country && dbUser.country !== 'Unknown' ? dbUser.country : 'BD';
  const flag = country === 'BD' || country.toLowerCase().includes('bangladesh') ? '🇧🇩' : '🌐';

  // Compute Real-Time Values
  const totalPoints = dbUser?.points ?? efcBalance ?? 0;
  const totalTokens = dbUser?.tokens ?? eforceTokens ?? 0;
  const totalRef = dbUser?.referrals ?? dbUser?.referralCount ?? referralsCount ?? 0;

  // Real-Time Referral Tier Rank Calculation
  const tierStatus = calculateUserReferralTier(totalRef, liveTiers);
  const tierBadgeInfo = getTierBadgeWithIcon(tierStatus.unlockedTier?.badge, tierStatus.unlockedTier?.requiredReferrals);

  // Dynamic Milestones / Achievements
  const achievements = [
    { 
      id: 'first_mine',
      name: "First Mine", 
      desc: "Mined EFC Points for the first time", 
      completed: true, 
      progress: 100,
      icon: <Pickaxe size={16} />,
      color: "from-amber-500/20 to-orange-500/20 border-amber-500/30 text-amber-400" 
    },
    { 
      id: 'node_auth',
      name: "Node Authorizer", 
      desc: "Saved custody wallet destination address", 
      completed: connectedAddress !== null,
      progress: connectedAddress !== null ? 100 : 0, 
      icon: <WalletIcon size={16} />,
      color: "from-cyan-500/20 to-blue-500/20 border-cyan-500/30 text-cyan-400" 
    },
    { 
      id: 'recruiter',
      name: "Affiliate Recruit", 
      desc: "Invite 5 active members to the force", 
      completed: totalRef >= 5, 
      progress: Math.min(Math.round((totalRef / 5) * 100), 100),
      current: totalRef,
      target: 5,
      icon: <Users size={16} />,
      color: "from-purple-500/20 to-pink-500/20 border-purple-500/30 text-purple-400" 
    },
    { 
      id: 'grandmaster',
      name: "Grandmaster Miner", 
      desc: "Accumulate 10,000+ EFC Points", 
      completed: efcBalance >= 10000, 
      progress: Math.min(Math.round((efcBalance / 10000) * 100), 100),
      current: efcBalance,
      target: 10000,
      icon: <Trophy size={16} />,
      color: "from-yellow-500/20 to-amber-500/20 border-yellow-500/30 text-yellow-400" 
    },
    { 
      id: 'usdt_collector',
      name: "USDT Collector", 
      desc: "Earn referral USDT commissions", 
      completed: (dbUser?.wallet || usdtBalance) > 0, 
      progress: (dbUser?.wallet || usdtBalance) > 0 ? 100 : 0,
      icon: <Sparkles size={16} />,
      color: "from-emerald-500/20 to-teal-500/20 border-emerald-500/30 text-emerald-400" 
    },
    { 
      id: 'verified_status',
      name: "Verified Force Node", 
      desc: "Account verified on Elite Force network", 
      completed: !!dbUser?.isVerified || !!telegramUser?.isPremium, 
      progress: (dbUser?.isVerified || telegramUser?.isPremium) ? 100 : 0,
      icon: <ShieldCheck size={16} />,
      color: "from-blue-500/20 to-indigo-500/20 border-blue-500/30 text-blue-400" 
    },
  ];

  const unlockedCount = achievements.filter(a => a.completed).length;

  return (
    <div className="flex flex-col gap-5 pb-28">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Identity <Sparkles size={18} className="text-[#FF8A00]" />
          </h1>
          <span className="text-[10px] font-black text-[#00E5FF] bg-[#00E5FF]/10 border border-[#00E5FF]/25 px-2.5 py-1 rounded-full uppercase tracking-wider">
            {tierBadgeInfo.full}
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-1">Review your node details, verification status, and achievements.</p>
      </div>

      {/* User Hero Profile Card */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel p-5 rounded-[24px] border-white/10 flex flex-col gap-4 relative overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
        style={{
          background: 'linear-gradient(135deg, rgba(255, 138, 0, 0.08) 0%, rgba(18, 24, 45, 0.95) 50%, rgba(0, 229, 255, 0.06) 100%)'
        }}
      >
        {/* Glow ambient background lights */}
        <div className="absolute -top-10 -right-10 w-36 h-36 bg-[#FF8A00]/15 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-36 h-36 bg-[#00E5FF]/15 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center gap-4 relative z-10">
          {/* Avatar with Animated Premium Glow Ring */}
          <div className={`relative shrink-0 w-16 h-16 rounded-full p-[3px] shadow-[0_0_15px_rgba(255,138,0,0.35)] ${
            telegramUser?.isPremium 
              ? 'animate-pulse bg-gradient-to-tr from-[#FF8A00] via-[#00E5FF] to-[#FFD700]' 
              : 'bg-gradient-to-tr from-[#FF8A00]/60 to-[#00E5FF]/60'
          }`}>
            <div className="w-full h-full rounded-full bg-[#080d21] flex items-center justify-center text-white font-bold text-xl relative overflow-hidden">
              {(dbUser?.photoUrl || telegramUser?.photoUrl) && !imgError ? (
                <img
                  src={dbUser?.photoUrl || telegramUser?.photoUrl || ''}
                  alt={getDisplayName(telegramUser)}
                  className="w-full h-full object-cover rounded-full"
                  onError={() => setImgError(true)}
                />
              ) : (
                <span className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-[#FF8A00] to-[#00E5FF]">
                  {(telegramUser?.firstName?.[0] ?? 'E').toUpperCase()}{(telegramUser?.lastName?.[0] ?? 'F').toUpperCase()}
                </span>
              )}
            </div>
            {/* Country Flag Badge */}
            <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-[#080d21] border border-white/20 flex items-center justify-center text-xs shadow-md" title={country}>
              {flag}
            </div>
          </div>

          {/* User Information Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              <h2 className="text-base font-extrabold text-white tracking-tight truncate">
                {getDisplayName(telegramUser, dbUser)}
              </h2>

              {dbUser?.isVerified && <VerifiedBadge size={15} className="shrink-0" />}
              {telegramUser?.isPremium && (
                <span className="text-[8px] font-black uppercase text-[#FFD700] bg-[#FFD700]/15 border border-[#FFD700]/30 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                  👑 Premium
                </span>
              )}
              {dbUser?.isDeveloper && (
                <span className="text-[8.5px] font-black uppercase text-cyan-300 bg-cyan-500/15 border border-cyan-500/35 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-[0_0_10px_rgba(0,229,255,0.2)]">
                  💻 VERIFIED DEV
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 font-mono font-medium">
                MEMBER #{telegramUser?.id || '89741000'}
              </span>
              <button
                onClick={handleCopyId}
                className="shrink-0 text-slate-500 hover:text-white transition-colors cursor-pointer"
                title="Copy Telegram ID"
              >
                {copiedId ? <Check size={11} className="text-accent-success" /> : <Copy size={11} />}
              </button>
            </div>

            {dbUser?.isDeveloper && (
              <div className="text-[10px] font-bold text-cyan-400 mt-1 flex items-center gap-1.5 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shrink-0" />
                <span className="truncate">{dbUser.devRole || 'EForce Core Developer & Specialist'}</span>
              </div>
            )}
          </div>
        </div>

        {/* Quick Stats Metrics Row — 5 Metric Cards */}
        <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-white/8 relative z-10">
          {/* EFC Points */}
          <div className="bg-white/[0.03] border border-white/5 p-2.5 rounded-xl flex flex-col gap-0.5">
            <span className="text-[8px] text-slate-500 uppercase tracking-widest font-extrabold">Points</span>
            <span className="text-sm font-black text-[#FF8A00] truncate">{totalPoints.toLocaleString()} EFC</span>
          </div>

          {/* EForce Token */}
          <div className="bg-white/[0.03] border border-white/5 p-2.5 rounded-xl flex flex-col gap-0.5">
            <span className="text-[8px] text-slate-500 uppercase tracking-widest font-extrabold">EForce Token</span>
            <span className="text-sm font-black text-[#B388FF] truncate">{totalTokens.toLocaleString()} EForce</span>
          </div>

          {/* Deposit Balance */}
          <div className="bg-emerald-500/10 border border-emerald-500/25 p-2.5 rounded-xl flex flex-col gap-0.5 shadow-[0_0_12px_rgba(16,185,129,0.1)]">
            <span className="text-[8px] text-emerald-400 uppercase tracking-widest font-extrabold flex items-center gap-1">
              <UsdtIcon size={10} /> Deposit Balance
            </span>
            <span className="text-sm font-black text-emerald-400 truncate">${(dbUser?.depositBalance ?? 0.00).toFixed(2)} USDT</span>
          </div>

          {/* USDT Wallet */}
          <div className="bg-white/[0.03] border border-white/5 p-2.5 rounded-xl flex flex-col gap-0.5">
            <span className="text-[8px] text-slate-500 uppercase tracking-widest font-extrabold flex items-center gap-1">
              <UsdtIcon size={10} /> USDT Wallet
            </span>
            <span className="text-sm font-black text-slate-200 truncate">${(dbUser?.wallet || usdtBalance).toFixed(2)}</span>
          </div>

          {/* Real-time Agent Rank */}
          <div className="col-span-2 bg-white/[0.03] border border-white/5 p-2.5 rounded-xl flex items-center justify-between">
            <span className="text-[8px] text-slate-500 uppercase tracking-widest font-extrabold">Agent Rank</span>
            <span className="text-xs font-black text-[#00E5FF]">{tierBadgeInfo.full}</span>
          </div>
        </div>
      </motion.div>

      {/* Official Mini App Developer Profile Sector */}
      {adminSettings?.devAppShowCard !== false && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative p-4 rounded-[24px] overflow-hidden flex flex-col gap-3"
          style={{
            background: 'linear-gradient(135deg, rgba(0, 229, 255, 0.1) 0%, rgba(10, 15, 30, 0.95) 50%, rgba(139, 92, 246, 0.1) 100%)',
            border: '1px solid rgba(0, 229, 255, 0.35)',
            boxShadow: '0 8px 30px rgba(0, 229, 255, 0.15)',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center text-cyan-300 shadow-[0_0_15px_rgba(0,229,255,0.3)] shrink-0">
                <Laptop size={20} />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs font-black text-white tracking-wider uppercase">DEVELOPER PROFILE SECTOR</h3>
                  <span className="text-[8.5px] font-extrabold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                    {adminSettings?.devAppVerifiedBadge || '⚡ OFFICIAL CREATOR'}
                  </span>
                </div>
                <span className="text-[11px] font-extrabold text-cyan-400 block mt-0.5">
                  {adminSettings?.devAppName || 'Elite Force Dev Team'}
                </span>
              </div>
            </div>
          </div>

          <div className="text-[10px] font-bold text-purple-300 bg-purple-500/10 px-2.5 py-1 rounded-lg border border-purple-500/20 w-fit">
            📌 {adminSettings?.devAppRole || 'Full-Stack Telegram Mini App & Systems Developer'}
          </div>

          <p className="text-[11px] text-slate-300 bg-white/[0.03] p-3 rounded-xl border border-white/5 font-medium leading-relaxed">
            {adminSettings?.devAppBio || 'Creator & Lead Systems Developer of the Elite Force Telegram Mini App & Web3 Ecosystem.'}
          </p>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => handleOpenDeveloperLink(adminSettings?.devAppContactUrl)}
              className="h-9 px-4 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/35 border border-cyan-500/50 text-cyan-300 text-[11px] font-extrabold flex items-center gap-2 transition-all cursor-pointer shadow-[0_0_15px_rgba(0,229,255,0.2)] hover:scale-105 active:scale-95"
            >
              <MessageSquare size={13} />
              <span>{adminSettings?.devAppButtonText || `Contact Developer (${adminSettings?.devAppTelegram || '@EliteForceDev'})`}</span>
            </button>
          </div>
        </motion.div>
      )}

      {/* User Self-Editable Developer Profile Sector (if marked as dev) */}
      {dbUser?.isDeveloper && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative p-4 rounded-[24px] overflow-hidden flex flex-col gap-3"
          style={{
            background: 'linear-gradient(135deg, rgba(0, 229, 255, 0.08) 0%, rgba(13, 18, 36, 0.95) 50%, rgba(139, 92, 246, 0.08) 100%)',
            border: '1px solid rgba(0, 229, 255, 0.25)',
            boxShadow: '0 8px 30px rgba(0, 229, 255, 0.1)',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#00E5FF]/10 border border-[#00E5FF]/30 flex items-center justify-center text-[#00E5FF]">
                <Laptop size={18} />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs font-black text-white tracking-wider uppercase">Personal Dev Badge</h3>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#00E5FF]/15 text-[#00E5FF] border border-[#00E5FF]/30">
                    VERIFIED DEV
                  </span>
                </div>
                <span className="text-[10px] font-bold text-cyan-300 block mt-0.5">
                  {dbUser.devRole || 'EForce Core Developer'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {dbUser.devLocked ? (
                <span className="text-[9px] font-bold px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                  <Lock size={10} /> Locked by Admin
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditingDev(!isEditingDev)}
                  className="text-[9px] font-bold px-2.5 py-1 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/25 transition-all cursor-pointer flex items-center gap-1"
                >
                  <Unlock size={10} /> {isEditingDev ? 'Close Edit' : 'Edit Info'}
                </button>
              )}
            </div>
          </div>

          {dbUser.devBio && !isEditingDev && (
            <p className="text-[11px] text-slate-300 bg-white/[0.03] p-2.5 rounded-xl border border-white/5 font-medium leading-relaxed">
              {dbUser.devBio}
            </p>
          )}

          {isEditingDev && !dbUser.devLocked && (
            <div className="flex flex-col gap-2.5 pt-2 border-t border-white/10">
              <div>
                <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">Developer Role / Title</label>
                <input
                  type="text"
                  value={userDevRole}
                  onChange={e => setUserDevRole(e.target.value)}
                  placeholder="e.g. Bot Developer, Smart Contract Eng"
                  className="w-full h-9 px-3 rounded-xl bg-slate-900/90 border border-cyan-500/30 text-xs text-white outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">Developer Bio & Skills</label>
                <textarea
                  rows={2}
                  value={userDevBio}
                  onChange={e => setUserDevBio(e.target.value)}
                  placeholder="Describe your tech stack, skills, or portfolio links..."
                  className="w-full p-2.5 rounded-xl bg-slate-900/90 border border-cyan-500/30 text-xs text-white outline-none focus:border-cyan-400 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsEditingDev(false)}
                  className="h-8 px-3.5 rounded-lg text-xs font-bold text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveDevInfo}
                  disabled={savingDev}
                  className="h-8 px-4 rounded-lg bg-cyan-500 text-black text-xs font-extrabold flex items-center gap-1 cursor-pointer shadow-md hover:bg-cyan-400 transition-all"
                >
                  {savingDev ? 'Saving...' : 'Save Developer Profile'}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      )}



      {/* Security & Node Metadata Grid */}
      <div className="grid grid-cols-2 gap-3">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-panel p-4 rounded-[20px] border-white/6 flex flex-col gap-1"
        >
          <div className="flex items-center gap-1.5 text-slate-400 mb-1">
            <Calendar size={13} className="text-[#FF8A00]" />
            <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400">Join Date</span>
          </div>
          <span className="text-xs font-extrabold text-white">{joinDateStr}</span>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="glass-panel p-4 rounded-[20px] border-white/6 flex flex-col gap-1"
        >
          <div className="flex items-center gap-1.5 text-slate-400 mb-1">
            <Globe2 size={13} className="text-[#00E5FF]" />
            <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400">Origin IP</span>
          </div>
          <span className="text-xs font-extrabold text-white truncate font-mono">{latestIp}</span>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14 }}
          className="glass-panel p-4 rounded-[20px] border-white/6 flex flex-col gap-1 col-span-2"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-slate-400 mb-1">
              <Laptop size={13} className="text-[#B388FF]" />
              <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400">Authorized Device</span>
            </div>
            <span className="text-[9px] font-bold text-accent-success bg-accent-success/10 border border-accent-success/20 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Zap size={10} /> Active Node
            </span>
          </div>
          <span className="text-xs font-extrabold text-white">
            {dbUser?.device?.os || 'Windows'} • {dbUser?.device?.browser || 'Chrome'}
          </span>
        </motion.div>
      </div>

      {/* Social Connections (X, Discord, TikTok, Instagram, YouTube, Reddit, WhatsApp) */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.14 }}
      >
        <Connections
          telegramUser={telegramUser}
          dbUser={dbUser}
          adminSettings={adminSettings || DEFAULT_ADMIN_SETTINGS}
          showToast={showToast}
        />
      </motion.div>

      {/* 24/7 Premium Customer Live Support Card */}
      {onOpenSupport && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14 }}
          onClick={onOpenSupport}
          className="relative p-4 rounded-[26px] overflow-hidden flex items-center justify-between cursor-pointer group transition-all duration-300"
          style={{
            background: 'linear-gradient(135deg, rgba(0, 229, 255, 0.12) 0%, rgba(14, 20, 34, 0.95) 50%, rgba(255, 138, 0, 0.12) 100%)',
            border: '1px solid rgba(0, 229, 255, 0.25)',
            boxShadow: '0 12px 35px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
          }}
        >
          {/* Top Shimmer Line */}
          <div className="absolute top-0 left-6 right-6 h-[1px] bg-gradient-to-r from-transparent via-[#00E5FF]/50 to-transparent pointer-events-none" />

          {/* Ambient Glow Pill */}
          <div className="absolute -left-10 -bottom-10 w-28 h-28 bg-[#00E5FF]/15 rounded-full blur-xl pointer-events-none group-hover:bg-[#00E5FF]/25 transition-all" />

          <div className="flex items-center gap-3.5 relative z-10 min-w-0 pr-2">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#00E5FF]/25 to-[#0088FF]/10 border border-[#00E5FF]/40 flex items-center justify-center text-[#00E5FF] shadow-[0_0_18px_rgba(0,229,255,0.3)] shrink-0 group-hover:scale-105 transition-all">
              <Headset size={22} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-black text-white tracking-wide truncate">Live Customer Support (24/7)</h3>
                <span className="flex items-center gap-1 text-[8.5px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> ONLINE
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5 truncate font-medium">Need help? Chat directly with support agents in real-time</p>
            </div>
          </div>

          <div className="relative z-10 shrink-0">
            <button
              type="button"
              className="h-9 px-4 rounded-xl font-extrabold text-xs text-black flex items-center gap-1.5 whitespace-nowrap shadow-lg cursor-pointer transition-all duration-200 group-hover:scale-105 active:scale-[0.98]"
              style={{
                background: 'linear-gradient(135deg, #00E5FF 0%, #00B4D8 100%)',
                boxShadow: '0 0 20px rgba(0, 229, 255, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.4)',
              }}
            >
              <MessageSquare size={13} fill="currentColor" opacity={0.3} />
              <span>Chat Now</span>
            </button>
          </div>
        </motion.div>
      )}

      {/* Achievements / Trophies & Milestones */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.16 }}
        className="flex flex-col gap-3.5"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-extrabold text-white tracking-wider uppercase flex items-center gap-1.5">
            <Trophy size={14} className="text-[#FF8A00]" /> Trophies & Milestones
          </span>
          <span className="text-[10px] font-bold text-[#FF8A00] bg-[#FF8A00]/10 border border-[#FF8A00]/20 px-2 py-0.5 rounded-full">
            {unlockedCount}/{achievements.length} Unlocked
          </span>
        </div>

        <div className="flex flex-col gap-2.5">
          {achievements.map((item, idx) => (
            <div 
              key={item.id || idx} 
              className={`glass-panel p-4 rounded-[20px] border-white/6 flex flex-col gap-2.5 transition-all ${
                item.completed ? 'bg-white/[0.03]' : 'bg-white/[0.01] opacity-75'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${item.color} border flex items-center justify-center shrink-0 shadow-sm`}>
                    {item.icon}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white mb-0.5">{item.name}</h4>
                    <p className="text-[9px] text-slate-400 leading-normal">{item.desc}</p>
                  </div>
                </div>

                <div className="shrink-0">
                  <span className={`text-[9px] px-2.5 py-1 font-extrabold uppercase tracking-wider rounded-lg border flex items-center gap-1 ${
                    item.completed 
                      ? 'bg-accent-success/10 border-accent-success/25 text-accent-success' 
                      : 'bg-white/5 border-white/10 text-slate-500'
                  }`}>
                    {item.completed ? <Unlock size={10} /> : <Lock size={10} />}
                    {item.completed ? 'Unlocked' : 'Locked'}
                  </span>
                </div>
              </div>

              {/* Progress bar for locked achievements with target count */}
              {!item.completed && item.target !== undefined && (
                <div className="flex flex-col gap-1 pt-1">
                  <div className="flex items-center justify-between text-[8px] text-slate-400 font-bold">
                    <span>PROGRESS</span>
                    <span>{item.current || 0} / {item.target}</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-white/5 border border-white/10 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-[#FF8A00] to-[#00E5FF] rounded-full transition-all duration-500"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </motion.div>

      {/* Edit Profile Name Modal — Disabled (users cannot change their name) */}
    </div>
  );
};
