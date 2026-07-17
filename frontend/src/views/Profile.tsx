import { useState, useEffect } from 'react';
import { Trophy, Calendar, Globe2, Laptop, Save, Loader2 } from 'lucide-react';
import { getDisplayName, type TelegramUser } from '../lib/telegramUser';
import { type FirestoreUser, updateWalletAddress } from '../lib/userService';
import { VerifiedBadge } from '../components/VerifiedBadge';

interface ProfileProps {
  efcBalance: number;
  dbUser: FirestoreUser | null;
  showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  telegramUser: TelegramUser | null;
}

export const Profile = ({ efcBalance, dbUser, showToast, telegramUser }: ProfileProps) => {
  const connectedAddress = dbUser?.walletAddress || null;
  
  const [walletInput, setWalletInput] = useState(dbUser?.walletAddress || '');
  const [savingAddress, setSavingAddress] = useState(false);

  useEffect(() => {
    if (dbUser?.walletAddress) {
      setWalletInput(dbUser.walletAddress);
    }
  }, [dbUser]);

  const validateBep20 = (address: string): boolean => {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  };

  const handleSaveAddress = async () => {
    if (!telegramUser) return;
    if (!validateBep20(walletInput)) {
      showToast('Invalid BEP-20 address. Must start with 0x followed by 40 hex characters.', 'error');
      return;
    }
    setSavingAddress(true);
    const success = await updateWalletAddress(telegramUser.id, walletInput);
    setSavingAddress(false);
    if (success) {
      showToast('BEP-20 wallet address saved successfully!', 'success');
    } else {
      showToast('Failed to save wallet address.', 'error');
    }
  };

  const formatTimestamp = (ts: any) => {
    if (!ts) return 'Not Available';
    try {
      const date = typeof ts.toDate === 'function' 
        ? ts.toDate() 
        : (ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts));
      
      if (isNaN(date.getTime())) return 'Not Available';
      return date.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
      return 'Not Available';
    }
  };

  const joinDateStr = formatTimestamp(dbUser?.joinDate || dbUser?.createdAt);
  
  const latestIp = dbUser?.ipHistory && dbUser.ipHistory.length > 0
    ? dbUser.ipHistory[dbUser.ipHistory.length - 1]
    : 'Unknown';

  const country = dbUser?.country && dbUser.country !== 'Unknown' ? dbUser.country : 'BD';
  const flag = country === 'BD' || country.toLowerCase().includes('bangladesh') ? '🇧🇩' : '🌍';

  const achievements = [
    { name: "First Mine", desc: "Mined EFC Points for the first time", completed: true, badgeColor: "text-accent-cyan" },
    { name: "Affiliate Recruit", desc: "Invited 5 active members to the force", completed: (dbUser?.referrals || 0) >= 5, badgeColor: (dbUser?.referrals || 0) >= 5 ? "text-accent-purple" : "text-slate-500" },
    { name: "Node Authorizer", desc: "Saved custody wallet destination address", completed: connectedAddress !== null, badgeColor: connectedAddress !== null ? "text-accent-gold" : "text-slate-500" },
    { name: "Grandmaster Miner", desc: "Accumulated more than 10,000 EFC Points", completed: efcBalance >= 10000, badgeColor: efcBalance >= 10000 ? "text-accent-gold" : "text-slate-500" },
  ];

  return (
    <div className="flex flex-col gap-5 pb-28">
      {/* View Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Identity</h1>
        <p className="text-xs text-slate-400 mt-1">Review your node details, verification status, and achievements.</p>
      </div>

      {/* User Card */}
      <div className="glass-panel p-6 rounded-[24px] border-white/6 flex items-center gap-4 relative overflow-hidden">
        {/* Glow */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-accent-purple/10 rounded-full filter blur-xl"></div>
        
        {/* Avatar with Telegram Premium Outer Ring */}
        <div className={`relative shrink-0 w-16 h-16 rounded-full p-[3px] drop-shadow-[0_0_10px_rgba(179,136,255,0.3)] ${telegramUser?.isPremium ? 'animate-pulse bg-gradient-to-tr from-accent-purple via-accent-cyan to-accent-gold' : 'bg-gradient-to-tr from-slate-600 to-slate-400'}`}>
          <div className="w-full h-full rounded-full bg-[#12182D] flex items-center justify-center text-white font-bold text-xl relative overflow-hidden">
            {telegramUser?.photoUrl ? (
              <img
                src={telegramUser.photoUrl}
                alt={getDisplayName(telegramUser)}
                className="w-full h-full object-cover rounded-full"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <span className="text-lg font-bold">
                {(telegramUser?.firstName?.[0] ?? 'E').toUpperCase()}{(telegramUser?.lastName?.[0] ?? 'F').toUpperCase()}
              </span>
            )}
          </div>
          {/* Country flag indicator */}
          <div className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-[#12182D] border border-white/10 flex items-center justify-center text-[10px]" title={country}>
            {flag}
          </div>
        </div>

        {/* User profile tags */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <h2 className="text-base font-bold text-white tracking-tight truncate">{getDisplayName(telegramUser)}</h2>
            {dbUser?.isVerified && <VerifiedBadge size={14} className="shrink-0" />}
            {telegramUser?.isPremium && (
              <span className="text-[8px] font-black uppercase text-accent-gold flex items-center gap-0.5 bg-accent-gold/10 border border-accent-gold/15 px-1.5 py-0.5 rounded">
                👑 Premium
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-400 uppercase tracking-widest block font-medium">
            Member #{telegramUser?.id || '?' }
          </span>
        </div>
      </div>

      {/* Wallet Connection Node */}
      <div className="glass-panel p-5 rounded-[24px] border-white/6 flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400 font-medium">BEP-20 Connected Node</span>
          {connectedAddress ? (
            <span className="text-accent-success font-semibold flex items-center gap-1 text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-success animate-ping"></span>
              Connected
            </span>
          ) : (
            <span className="text-slate-500 font-semibold flex items-center gap-1 text-[10px]">
              Disconnected
            </span>
          )}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Enter BEP-20 Address (0x...)"
            value={walletInput}
            onChange={(e) => setWalletInput(e.target.value)}
            disabled={savingAddress}
            className="flex-1 h-9 rounded-xl bg-white/[0.03] border border-white/8 px-3 text-xs text-white outline-none focus:border-accent-cyan/40 transition-all font-mono"
          />
          <button
            onClick={handleSaveAddress}
            disabled={savingAddress || !walletInput}
            className="h-9 px-3 rounded-xl bg-[#00E5FF] hover:bg-[#00E5FF]/90 disabled:opacity-40 disabled:cursor-not-allowed text-[#050816] text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1 shadow-[0_0_12px_rgba(0,229,255,0.2)]"
          >
            {savingAddress ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <><Save size={12} /> Save</>
            )}
          </button>
        </div>
      </div>



      {/* Verification details info */}
      <div className="grid grid-cols-2 gap-3.5">
        <div className="glass-panel p-4 rounded-[20px] border-white/5 flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-slate-500 mb-1">
            <Calendar size={13} />
            <span className="text-[10px] uppercase font-bold tracking-wider">Join Date</span>
          </div>
          <span className="text-xs font-semibold text-white">{joinDateStr}</span>
        </div>
        <div className="glass-panel p-4 rounded-[20px] border-white/5 flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-slate-500 mb-1">
            <Globe2 size={13} />
            <span className="text-[10px] uppercase font-bold tracking-wider">Origin IP</span>
          </div>
          <span className="text-xs font-semibold text-white truncate">{latestIp}</span>
        </div>
      </div>

      {/* Device info node */}
      <div className="glass-panel p-4 rounded-[20px] border-white/5 flex flex-col gap-1">
        <div className="flex items-center gap-1.5 text-slate-500 mb-1">
          <Laptop size={13} />
          <span className="text-[10px] uppercase font-bold tracking-wider">Authorized Device</span>
        </div>
        <span className="text-xs font-semibold text-white">
          {dbUser?.device?.os || 'Unknown OS'} • {dbUser?.device?.browser || 'Unknown Browser'}
        </span>
      </div>

      {/* Achievements / Trophies */}
      <div className="flex flex-col gap-3.5">
        <span className="text-xs font-bold text-accent-cyan tracking-wider uppercase">Trophies & Milestones</span>
        
        <div className="flex flex-col gap-2.5">
          {achievements.map((item, idx) => (
            <div key={idx} className="glass-panel p-4 rounded-[20px] border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl bg-white/5 border border-white/8 ${item.badgeColor} flex items-center justify-center shrink-0`}>
                  <Trophy size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">{item.name}</h4>
                  <p className="text-[9px] text-slate-500 leading-normal">{item.desc}</p>
                </div>
              </div>
              <div>
                <span className={`text-[10px] px-2 py-0.5 font-bold uppercase tracking-wider rounded-md border ${
                  item.completed 
                    ? 'bg-accent-success/10 border-accent-success/20 text-accent-success' 
                    : 'bg-white/5 border-white/8 text-slate-500'
                }`}>
                  {item.completed ? 'Unlocked' : 'Locked'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
