import { Info, ExternalLink, Copy, Shield, Star, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { type AdminSettings } from '../lib/adminSettingsService';

interface SettingsProps {
  showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  adminSettings?: AdminSettings;
}

const APP_VERSION = '2.0.0';
const BOT_USERNAME = '@EliteForceEFCBot';
const SUPPORT_LINK = 'https://t.me/EliteForceEFCBot';

export const Settings = ({ showToast, adminSettings }: SettingsProps) => {

  const copyBotLink = () => {
    navigator.clipboard.writeText(BOT_USERNAME).catch(() => {});
    showToast('Bot username copied!', 'success');
  };

  return (
    <div className="flex flex-col gap-5 pb-28">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Settings</h1>
        <p className="text-xs text-slate-400 mt-1">Elite Force EFC app information & support.</p>
      </div>

      {/* App Info Card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="glass-panel p-5 rounded-[24px] border-white/6 flex items-center gap-4"
      >
        {/* Coin logo */}
        <div className="w-14 h-14 rounded-[16px] overflow-hidden shrink-0 border border-[#FFD700]/20 shadow-[0_0_20px_rgba(255,138,0,0.2)]">
          <img src={adminSettings?.coinIconUrl || '/coin.png'} alt="EForce Coin" className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-black text-white tracking-wide">Elite Force EFC</h2>
          <p className="text-[10px] text-slate-400 mt-0.5">Web3 Mining Ecosystem</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[9px] font-bold text-[#FF8A00] bg-[#FF8A00]/10 border border-[#FF8A00]/20 px-2 py-0.5 rounded-full">
              v{APP_VERSION}
            </span>
            <span className="text-[9px] font-bold text-accent-success bg-accent-success/10 border border-accent-success/20 px-2 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-success animate-ping" />
              Live
            </span>
          </div>
        </div>
      </motion.div>

      {/* Info rows */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="glass-panel rounded-[24px] border-white/6 overflow-hidden divide-y divide-white/5"
      >
        {/* How it works */}
        <div className="flex items-center gap-3 p-4">
          <div className="w-8 h-8 rounded-[10px] bg-[#FF8A00]/10 border border-[#FF8A00]/20 flex items-center justify-center shrink-0">
            <Zap size={14} className="text-[#FF8A00]" />
          </div>
          <div className="flex-1">
            <span className="text-xs font-bold text-white block">How to Earn</span>
            <span className="text-[10px] text-slate-500">Tap coin → earn EForce points → swap to EForce token</span>
          </div>
        </div>

        {/* Referral info */}
        <div className="flex items-center gap-3 p-4">
          <div className="w-8 h-8 rounded-[10px] bg-accent-purple/10 border border-accent-purple/20 flex items-center justify-center shrink-0">
            <Star size={14} className="text-accent-purple" />
          </div>
          <div className="flex-1">
            <span className="text-xs font-bold text-white block">Referral Bonus</span>
            <span className="text-[10px] text-slate-500">Invite friends to earn EForce token rewards</span>
          </div>
        </div>

        {/* Security */}
        <div className="flex items-center gap-3 p-4">
          <div className="w-8 h-8 rounded-[10px] bg-accent-cyan/10 border border-accent-cyan/20 flex items-center justify-center shrink-0">
            <Shield size={14} className="text-accent-cyan" />
          </div>
          <div className="flex-1">
            <span className="text-xs font-bold text-white block">Anti-Cheat Protection</span>
            <span className="text-[10px] text-slate-500">Auto-ban for bot tapping & suspicious activity</span>
          </div>
        </div>

        {/* Version */}
        <div className="flex items-center gap-3 p-4">
          <div className="w-8 h-8 rounded-[10px] bg-white/5 border border-white/8 flex items-center justify-center shrink-0">
            <Info size={14} className="text-slate-400" />
          </div>
          <div className="flex-1">
            <span className="text-xs font-bold text-white block">App Version</span>
            <span className="text-[10px] text-slate-500">EForce v{APP_VERSION} — Production Build</span>
          </div>
        </div>
      </motion.div>

      {/* Support / Bot */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="glass-panel p-5 rounded-[24px] border-white/6 flex flex-col gap-3"
      >
        <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Support & Community</span>

        {/* Copy bot */}
        <button
          onClick={copyBotLink}
          className="flex items-center justify-between p-3 rounded-[14px] bg-white/[0.03] border border-white/6 hover:bg-white/[0.06] transition-all cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-[10px] bg-accent-cyan/10 border border-accent-cyan/15 flex items-center justify-center">
              <Copy size={12} className="text-accent-cyan" />
            </div>
            <div className="text-left">
              <span className="text-xs font-bold text-white block">Official Bot</span>
              <span className="text-[10px] text-slate-500">{BOT_USERNAME}</span>
            </div>
          </div>
          <span className="text-[9px] font-bold text-accent-cyan bg-accent-cyan/10 px-2 py-0.5 rounded-full">Copy</span>
        </button>

        {/* Open Telegram */}
        <a
          href={SUPPORT_LINK}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-between p-3 rounded-[14px] bg-white/[0.03] border border-white/6 hover:bg-white/[0.06] transition-all cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-[10px] bg-[#FF8A00]/10 border border-[#FF8A00]/15 flex items-center justify-center">
              <ExternalLink size={12} className="text-[#FF8A00]" />
            </div>
            <div className="text-left">
              <span className="text-xs font-bold text-white block">Open in Telegram</span>
              <span className="text-[10px] text-slate-500">Contact support or ask questions</span>
            </div>
          </div>
          <span className="text-[9px] font-bold text-[#FF8A00] bg-[#FF8A00]/10 px-2 py-0.5 rounded-full">Open</span>
        </a>
      </motion.div>

      {/* Footer note */}
      <p className="text-center text-[9px] text-slate-600 font-medium tracking-wide pb-2">
        Elite Force EFC © 2025 · All Rights Reserved
      </p>

    </div>
  );
};
