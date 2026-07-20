import React from 'react';
import { motion } from 'framer-motion';
import { Bell, Menu, RefreshCw, Zap } from 'lucide-react';
import type { AdminTab } from './AdminSidebar';

interface AdminHeaderProps {
  activeTab: AdminTab;
  onMenuClick: () => void;
  pendingCount: number;
  flaggedCount: number;
  onRefresh: () => void;
  isRefreshing: boolean;
  adminUsername?: string;
}

const tabMeta: Record<AdminTab, { title: string; sub: string; icon: string; accentColor: string }> = {
  dashboard:     { title: 'Dashboard',        sub: "Live overview of your mining ecosystem",          icon: '📊', accentColor: '#FF8A00' },
  users:         { title: 'User Management',  sub: 'Search, moderate and manage all members',         icon: '👥', accentColor: '#00E5FF' },
  tasks:         { title: 'Mission Control',  sub: 'Create and manage EForce earning tasks',          icon: '✅', accentColor: '#A3E635' },
  withdrawals:   { title: 'Withdrawals',      sub: 'Review and process payout requests',              icon: '💸', accentColor: '#4ADE80' },
  security:      { title: 'Security Center',  sub: 'Monitor flagged users and threats',               icon: '🛡️', accentColor: '#FB923C' },
  notifications: { title: 'Notifications',   sub: 'Send bot messages, announcements & alerts',       icon: '📢', accentColor: '#C084FC' },
  topminers:     { title: 'Top Miners Control',sub: 'Configure leaderboard pinned miners and ranks',       icon: '🏆', accentColor: '#FFD700' },
  settings:      { title: 'System Settings',  sub: 'Configure app economy and global parameters',     icon: '⚙️', accentColor: '#B388FF' },
};

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  activeTab, onMenuClick, pendingCount, flaggedCount, onRefresh, isRefreshing, adminUsername,
}) => {
  const meta = tabMeta[activeTab];
  const notifCount = pendingCount + flaggedCount;

  return (
    <header
      className="flex items-center justify-between px-4 md:px-6 py-3.5 shrink-0 relative"
      style={{
        background: 'rgba(7,10,20,0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
      }}
    >
      {/* Subtle top shimmer */}
      <div className="absolute top-0 left-0 right-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${meta.accentColor}22, transparent)` }} />

      {/* Left: burger + breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-white transition-all"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }}
        >
          <Menu size={15} />
        </button>

        {/* Tab icon + title */}
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-sm shrink-0 hidden sm:flex"
            style={{ background: `${meta.accentColor}15`, border: `1px solid ${meta.accentColor}25` }}
          >
            {meta.icon}
          </div>
          <div>
            <h1 className="text-sm md:text-[15px] font-black text-white tracking-tight leading-none">
              {meta.title}
            </h1>
            <p className="text-[9px] text-slate-500 mt-0.5 hidden md:block font-medium">{meta.sub}</p>
          </div>
        </div>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2">
        {/* Refresh button */}
        <motion.button
          onClick={onRefresh}
          whileTap={{ scale: 0.92 }}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-white transition-all"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}
          title="Refresh data"
        >
          <RefreshCw size={13} className={isRefreshing ? 'animate-spin text-[#FF8A00]' : ''} />
        </motion.button>

        {/* Notification bell */}
        <div className="relative">
          <button
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-white transition-all"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}
            title="Alerts"
          >
            <Bell size={13} />
          </button>
          {notifCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[8px] font-black text-white flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #FF5252, #FF1744)',
                boxShadow: '0 0 8px rgba(255,82,82,0.6)',
              }}
            >
              {notifCount > 9 ? '9+' : notifCount}
            </motion.span>
          )}
        </div>

        {/* Live status indicator */}
        <div
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full"
          style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)' }}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[9px] font-bold text-green-400">LIVE</span>
        </div>

        {/* Admin profile chip */}
        <div
          className="flex items-center gap-2 pl-3 ml-1 border-l"
          style={{ borderColor: 'rgba(255,255,255,0.08)' }}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{
              background: 'linear-gradient(135deg, #FF8A00, #FFB347)',
              boxShadow: '0 0 12px rgba(255,138,0,0.4)',
            }}
          >
            <Zap size={12} className="text-white fill-current" />
          </div>
          <div className="hidden md:block">
            <div
              className="text-[10px] font-extrabold leading-none"
              style={{
                color: '#FF8A00',
                textShadow: '0 0 10px rgba(255,138,0,0.5)',
              }}
            >
              {adminUsername
                ? (adminUsername.startsWith('@') ? adminUsername : `@${adminUsername}`)
                : '@admin'}
            </div>
            <div className="text-[8px] text-slate-500 mt-0.5 font-semibold uppercase tracking-wider">Super Admin</div>
          </div>
        </div>
      </div>
    </header>
  );
};
