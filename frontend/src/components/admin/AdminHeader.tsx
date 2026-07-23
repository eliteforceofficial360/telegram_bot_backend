import React from 'react';
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
  dashboard:     { title: 'Dashboard',        sub: "Live overview of your mining ecosystem",          icon: '📊', accentColor: '#2563EB' },
  users:         { title: 'User Management',  sub: 'Search, moderate and manage all members',         icon: '👥', accentColor: '#0284C7' },
  countries:     { title: 'Country Demographics', sub: 'Regional analytics & demographic breakdown', icon: '🌐', accentColor: '#0891B2' },
  tasks:         { title: 'Mission Control',  sub: 'Create and manage EForce earning tasks',          icon: '✅', accentColor: '#059669' },
  withdrawals:   { title: 'Withdrawals',      sub: 'Review and process payout requests',              icon: '💸', accentColor: '#16A34A' },
  security:      { title: 'Security Center',  sub: 'Monitor flagged users and threats',               icon: '🛡️', accentColor: '#EA580C' },
  notifications: { title: 'Notifications',   sub: 'Send bot messages, announcements & alerts',       icon: '📢', accentColor: '#7C3AED' },
  topminers:     { title: 'Top Miners Control',sub: 'Configure leaderboard pinned miners and ranks',       icon: '🏆', accentColor: '#D97706' },
  settings:      { title: 'System Settings',  sub: 'Configure app economy and global parameters',     icon: '⚙️', accentColor: '#4F46E5' },
};

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  activeTab, onMenuClick, pendingCount, flaggedCount, onRefresh, isRefreshing, adminUsername,
}) => {
  const meta = tabMeta[activeTab];
  const notifCount = pendingCount + flaggedCount;

  return (
    <header
      className="flex items-center justify-between px-4 md:px-6 py-3.5 shrink-0 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-xs relative z-20"
    >
      {/* Left: burger + breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-all border border-slate-200"
        >
          <Menu size={15} />
        </button>

        {/* Tab icon + title */}
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0 hidden sm:flex bg-slate-100 border border-slate-200 text-slate-700"
          >
            {meta.icon}
          </div>
          <div>
            <h1 className="text-sm md:text-[15px] font-bold text-slate-900 tracking-tight leading-none">
              {meta.title}
            </h1>
            <p className="text-[10px] text-slate-500 mt-0.5 hidden md:block font-medium">{meta.sub}</p>
          </div>
        </div>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2">
        {/* Refresh button */}
        <button
          onClick={onRefresh}
          className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-all border border-slate-200"
          title="Refresh data"
        >
          <RefreshCw size={13} className={isRefreshing ? 'animate-spin text-blue-600' : ''} />
        </button>

        {/* Notification bell */}
        <div className="relative">
          <button
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-all border border-slate-200"
            title="Alerts"
          >
            <Bell size={13} />
          </button>
          {notifCount > 0 && (
            <span
              className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[8px] font-bold text-white flex items-center justify-center bg-rose-600 shadow-xs"
            >
              {notifCount > 9 ? '9+' : notifCount}
            </span>
          )}
        </div>

        {/* Live status indicator */}
        <div
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[9px] font-bold text-emerald-700">LIVE</span>
        </div>

        {/* Admin profile chip */}
        <div
          className="flex items-center gap-2 pl-3 ml-1 border-l border-slate-200"
        >
          <div
            className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-white shrink-0 shadow-xs"
          >
            <Zap size={13} className="fill-current" />
          </div>
          <div className="hidden md:block">
            <div className="text-[10px] font-bold leading-none text-slate-900">
              {adminUsername
                ? (adminUsername.startsWith('@') ? adminUsername : `@${adminUsername}`)
                : '@admin'}
            </div>
            <div className="text-[8px] text-slate-400 mt-0.5 font-semibold uppercase tracking-wider">Super Admin</div>
          </div>
        </div>
      </div>
    </header>
  );
};
