import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Search, RefreshCw, Star, HelpCircle } from 'lucide-react';
import { getLeaderboardUsers, type FirestoreUser } from '../lib/userService';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { type AdminSettings } from '../lib/adminSettingsService';

interface LeaderboardProps {
  telegramUser: { id: number; username?: string; firstName?: string; lastName?: string; photoUrl?: string } | null;
  efcBalance: number;
  showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  dbUser?: FirestoreUser | null;
  adminSettings?: AdminSettings;
}

export const Leaderboard = ({ telegramUser, efcBalance, showToast, dbUser, adminSettings }: LeaderboardProps) => {
  const [topMiners, setTopMiners] = useState<FirestoreUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const users = await getLeaderboardUsers(50); // Fetch top 50
      setTopMiners(users);
    } catch {
      showToast('Failed to load top miners.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  // Find current user's rank
  const myRankIndex = topMiners.findIndex(u => u.telegramId === telegramUser?.id);
  const myRank = myRankIndex !== -1 ? myRankIndex + 1 : '50+';

  // Filter list by search query
  const filteredMiners = topMiners.filter(u => {
    const q = searchQuery.toLowerCase();
    return (
      u.firstName?.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q) ||
      String(u.telegramId).includes(q)
    );
  });

  return (
    <div className="flex flex-col gap-5 pb-28">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <Trophy className="text-[#FF8A00]" size={24} /> Top Miners
        </h1>
        <p className="text-xs text-slate-400 mt-1">Global ecosystem rankings by EFC Points.</p>
      </div>

      {/* Current User Rank Card */}
      {telegramUser && dbUser?.leaderboardHidden !== true && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel p-4 rounded-[22px] border-white/6 flex items-center justify-between"
          style={{
            background: 'linear-gradient(135deg, rgba(255, 138, 0, 0.1) 0%, rgba(255, 138, 0, 0.03) 100%)',
            borderColor: 'rgba(255, 138, 0, 0.2)',
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF8A00] to-[#FFB347] flex flex-col items-center justify-center shadow-[0_0_15px_rgba(255,138,0,0.25)]">
              <span className="text-[9px] font-bold text-white uppercase leading-none opacity-80">Rank</span>
              <span className="text-sm font-black text-white leading-none mt-0.5">#{myRank}</span>
            </div>
            <div>
              <span className="text-xs font-bold text-white block">You (EFC Miner)</span>
              <span className="text-[10px] text-slate-400">@{telegramUser.username || 'user'}</span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-sm font-black text-[#FF8A00] block">{efcBalance.toLocaleString()} EFC</span>
            <span className="text-[9px] text-slate-500 font-semibold block">EFC Points</span>
          </div>
        </motion.div>
      )}

      {/* Search & Refresh */}
      <div className="flex gap-2.5 items-center">
        <div className="flex-1 relative">
          <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search miners by name..."
            className="w-full pl-9 pr-4 h-9 rounded-xl text-xs text-white outline-none"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
          />
        </div>
        <button
          onClick={fetchLeaderboard}
          disabled={loading}
          className="w-9 h-9 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center text-slate-400 hover:text-white transition-all cursor-pointer"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Custom Pinned Miners */}
      {(adminSettings?.customTopMiners || []).length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-widest" style={{ color: '#FF8A00' }}>⛏️ Featured Miners</span>
            <span className="text-[9px] px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(255,138,0,0.08)', color: '#FF8A00', border: '1px solid rgba(255,138,0,0.2)' }}>Pinned by Admin</span>
          </div>
          <div className="glass-panel rounded-[20px] border-white/6 overflow-hidden divide-y divide-white/[0.04]">
            {(adminSettings!.customTopMiners).map((m, i) => (
              <div key={i} className="flex items-center gap-3 p-3.5">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-sm shrink-0" style={{ background: 'rgba(255,138,0,0.12)', border: '1px solid rgba(255,138,0,0.25)' }}>{m.badge || '⛏️'}</div>
                <div className="w-8 h-8 rounded-full border border-[#FF8A00]/20 bg-[#FF8A00]/10 flex items-center justify-center text-xs font-bold shrink-0" style={{ color: '#FF8A00' }}>{(m.name?.[0] || 'E').toUpperCase()}</div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-bold text-white truncate block">{m.name}</span>
                  <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: '#FF8A00' }}>Featured</span>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-black text-white">{m.score.toLocaleString()}</span>
                  <span className="text-[8px] text-slate-500 block font-bold uppercase tracking-wider">EFC Points</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Leaderboard List */}
      <div className="glass-panel rounded-[24px] border-white/6 overflow-hidden divide-y divide-white/[0.04]">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <span className="w-7 h-7 border-2 border-t-transparent border-[#FF8A00] rounded-full animate-spin" />
            <span className="text-xs text-slate-500 font-semibold">Loading top miners...</span>
          </div>
        ) : filteredMiners.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs">No miners found.</div>
        ) : (
          filteredMiners.map((u, i) => {
            const rank = i + 1;
            const isMe = u.telegramId === telegramUser?.id;

            return (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.5) }}
                key={u.telegramId}
                className={`flex items-center gap-3 p-3.5 transition-all ${
                  isMe ? 'bg-[#FF8A00]/5 border-l-2 border-l-[#FF8A00]' : 'hover:bg-white/[0.01]'
                }`}
              >
                {/* Rank Badge */}
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                  rank === 1 ? 'bg-gradient-to-br from-[#FFD700]/30 to-[#FFB347]/10 text-[#FFD700] border border-[#FFD700]/30 shadow-[0_0_8px_rgba(255,215,0,0.15)]' :
                  rank === 2 ? 'bg-gradient-to-br from-slate-300/30 to-slate-400/10 text-slate-300 border border-slate-300/30' :
                  rank === 3 ? 'bg-gradient-to-br from-[#CD7F32]/30 to-[#CD7F32]/10 text-[#CD7F32] border border-[#CD7F32]/30' :
                  'bg-white/5 text-slate-500'
                }`}>
                  {rank}
                </div>

                {/* Avatar */}
                <div className="w-8 h-8 rounded-full border border-white/8 bg-[#0E1225] flex items-center justify-center text-xs font-bold text-slate-400 shrink-0 overflow-hidden">
                  {u.photoUrl ? (
                    <img src={u.photoUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    (u.firstName?.[0] ?? 'E').toUpperCase()
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-xs font-bold truncate max-w-[120px] ${isMe ? 'text-[#FF8A00]' : 'text-white'}`}>
                      {u.firstName} {u.lastName}
                    </span>
                    {u.isVerified && <VerifiedBadge size={10} className="shrink-0" />}
                    {u.isTelegramPremium && <Star size={10} className="text-[#00E5FF] fill-current shrink-0" />}
                    {u.leaderboardPinned && (
                      <span className="text-[7px] font-black text-[#FF8A00] bg-[#FF8A00]/15 border border-[#FF8A00]/25 px-1.5 py-0.5 rounded uppercase shrink-0">
                        📌 Pinned
                      </span>
                    )}
                  </div>
                  <span className="text-[9px] text-slate-500 block mt-0.5">@{u.username || 'user'}</span>
                </div>

                {/* Score */}
                <div className="text-right shrink-0">
                  <span className="text-xs font-black text-white">{(u.points || 0).toLocaleString()}</span>
                  <span className="text-[8px] text-slate-500 block mt-0.5 font-bold uppercase tracking-wider">EFC Points</span>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Bottom Info note */}
      <div className="flex gap-2 p-4 rounded-[18px] bg-white/[0.02] border border-white/6 items-start">
        <HelpCircle size={14} className="text-[#FF8A00] shrink-0 mt-0.5" />
        <p className="text-[9px] text-slate-500 leading-relaxed">
          Elite Force leaderboards are updated in real-time as users mine and claim points. Join the official Telegram community to compete for seasonal rank rewards and token drops.
        </p>
      </div>
    </div>
  );
};
