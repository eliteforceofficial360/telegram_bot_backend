import { useState } from 'react';
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
  Users
} from 'lucide-react';
import { getDisplayName, type TelegramUser } from '../lib/telegramUser';
import { type FirestoreUser } from '../lib/userService';
import { type AdminSettings } from '../lib/adminSettingsService';
import { VerifiedBadge } from '../components/VerifiedBadge';

interface ProfileProps {
  efcBalance: number;
  usdtBalance?: number;
  referralsCount?: number;
  adminSettings?: AdminSettings;
  dbUser: FirestoreUser | null;
  showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  telegramUser: TelegramUser | null;
}

export const Profile = ({ 
  efcBalance, 
  usdtBalance = 0, 
  referralsCount = 0,
  dbUser, 
  showToast, 
  telegramUser 
}: ProfileProps) => {
  const connectedAddress = dbUser?.walletAddress || null;
  const [copiedId, setCopiedId] = useState(false);

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

  // Calculate Agent Level based on points
  const getAgentLevel = (points: number) => {
    if (points >= 100000) return { title: 'Cyber Overlord', level: 5, badge: '👑 VIP' };
    if (points >= 25000) return { title: 'Grandmaster Miner', level: 4, badge: '💎 DIAMOND' };
    if (points >= 5000) return { title: 'Elite Commander', level: 3, badge: '🔥 GOLD' };
    if (points >= 1000) return { title: 'Vanguard Agent', level: 2, badge: '⚡ SILVER' };
    return { title: 'Recruit Node', level: 1, badge: '🌱 BRONZE' };
  };

  const agentLevel = getAgentLevel(efcBalance);

  // Dynamic Milestones / Achievements
  const totalRef = dbUser?.referrals || referralsCount || 0;
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
            {agentLevel.badge}
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
              {telegramUser?.photoUrl ? (
                <img
                  src={telegramUser.photoUrl}
                  alt={getDisplayName(telegramUser)}
                  className="w-full h-full object-cover rounded-full"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
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
                {getDisplayName(telegramUser)}
              </h2>
              {dbUser?.isVerified && <VerifiedBadge size={15} className="shrink-0" />}
              {telegramUser?.isPremium && (
                <span className="text-[8px] font-black uppercase text-[#FFD700] bg-[#FFD700]/15 border border-[#FFD700]/30 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                  👑 Premium
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
          </div>
        </div>

        {/* Quick Stats Metrics Row */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/8 relative z-10">
          <div className="bg-white/[0.03] border border-white/5 p-2.5 rounded-xl flex flex-col gap-0.5">
            <span className="text-[8px] text-slate-500 uppercase tracking-widest font-extrabold">Points</span>
            <span className="text-sm font-black text-[#FF8A00] truncate">{efcBalance.toLocaleString()} EFC</span>
          </div>

          <div className="bg-white/[0.03] border border-white/5 p-2.5 rounded-xl flex flex-col gap-0.5">
            <span className="text-[8px] text-slate-500 uppercase tracking-widest font-extrabold">USDT Wallet</span>
            <span className="text-sm font-black text-accent-success truncate">${(dbUser?.wallet || usdtBalance).toFixed(2)}</span>
          </div>

          <div className="bg-white/[0.03] border border-white/5 p-2.5 rounded-xl flex flex-col gap-0.5">
            <span className="text-[8px] text-slate-500 uppercase tracking-widest font-extrabold">Agent Rank</span>
            <span className="text-xs font-black text-[#00E5FF] truncate">{agentLevel.title}</span>
          </div>
        </div>
      </motion.div>



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
    </div>
  );
};
