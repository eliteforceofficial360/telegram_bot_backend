import React from 'react';
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

const tabMeta: Record<AdminTab, { title: string; sub: string; faIcon: string; accentColor: string }> = {
  dashboard:     { title: 'Executive Overview', sub: 'Real-time telemetry, active nodes & metrics', faIcon: 'fa-solid fa-chart-pie',             accentColor: '#38BDF8' },
  users:         { title: 'User Directory',     sub: 'Manage user accounts, ranks & security',     faIcon: 'fa-solid fa-users-gear',            accentColor: '#60A5FA' },
  countries:     { title: 'Regional Analytics', sub: 'Geographic distribution & active country hubs',faIcon: 'fa-solid fa-earth-americas',     accentColor: '#22D3EE' },
  tasks:         { title: 'Mission Control',    sub: 'Manage active earning missions & tasks',     faIcon: 'fa-solid fa-list-check',            accentColor: '#34D399' },
  withdrawals:   { title: 'Payout Queue',       sub: 'Review & authorize payout transactions',     faIcon: 'fa-solid fa-money-bill-transfer',   accentColor: '#4ADE80' },
  security:      { title: 'Security Center',    sub: 'Flagged threats, anti-cheat & bans',         faIcon: 'fa-solid fa-shield-halved',        accentColor: '#FB923C' },
  notifications: { title: 'Broadcast Manager', sub: 'Global push notifications & announcements',  faIcon: 'fa-solid fa-bullhorn',              accentColor: '#C084FC' },
  topminers:     { title: 'Leaderboard Setup',  sub: 'Configure leaderboard pinned top miners',    faIcon: 'fa-solid fa-trophy',                accentColor: '#FBBF24' },
  settings:      { title: 'System Parameters',  sub: 'Token economy, limits & app settings',        faIcon: 'fa-solid fa-sliders',               accentColor: '#818CF8' },
};

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  activeTab, onMenuClick, pendingCount, flaggedCount, onRefresh, isRefreshing, adminUsername,
}) => {
  const meta = tabMeta[activeTab];
  const notifCount = pendingCount + flaggedCount;

  return (
    <header className="flex items-center justify-between px-4 md:px-6 py-3.5 bg-[#0B0E14] border-b border-slate-800/80 relative z-20 shrink-0 select-none">
      {/* Left section: Mobile menu toggle + breadcrumb */}
      <div className="flex items-center gap-3.5">
        <button
          onClick={onMenuClick}
          className="lg:hidden w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-white bg-[#131824] hover:bg-[#182030] transition-colors border border-slate-800"
        >
          <i className="fa-solid fa-bars text-sm"></i>
        </button>

        {/* Tab Header Badge */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#131824] border border-slate-800 flex items-center justify-center text-blue-400 text-sm shrink-0">
            <i className={meta.faIcon}></i>
          </div>
          <div>
            <h1 className="text-sm md:text-base font-extrabold text-white tracking-tight leading-tight">
              {meta.title}
            </h1>
            <p className="text-[10px] text-slate-400 font-medium hidden md:block mt-0.5">{meta.sub}</p>
          </div>
        </div>
      </div>

      {/* Right section: System actions & user info */}
      <div className="flex items-center gap-2.5">
        {/* Refresh button */}
        <button
          onClick={onRefresh}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-white bg-[#131824] hover:bg-[#182030] transition-colors border border-slate-800"
          title="Refresh Telemetry"
        >
          <i className={`fa-solid fa-rotate-right text-xs ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`}></i>
        </button>

        {/* Alerts Bell */}
        <div className="relative">
          <button
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-white bg-[#131824] hover:bg-[#182030] transition-colors border border-slate-800"
            title="Alert Notifications"
          >
            <i className="fa-regular fa-bell text-xs"></i>
          </button>
          {notifCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold text-white bg-rose-600 flex items-center justify-center shadow-xs">
              {notifCount > 9 ? '9+' : notifCount}
            </span>
          )}
        </div>

        {/* Node Live Indicator */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-[9.5px] font-mono font-bold text-emerald-400 uppercase tracking-wider">
            NODE LIVE
          </span>
        </div>

        {/* Super Admin Badge */}
        <div className="flex items-center gap-2.5 pl-3 border-l border-slate-800">
          <div className="w-8 h-8 rounded-xl bg-[#131824] border border-slate-800 flex items-center justify-center text-amber-400 text-xs font-bold shadow-xs">
            <i className="fa-solid fa-user-shield"></i>
          </div>
          <div className="hidden md:block">
            <div className="text-[11px] font-extrabold text-white leading-none">
              {adminUsername ? (adminUsername.startsWith('@') ? adminUsername : `@${adminUsername}`) : '@admin'}
            </div>
            <div className="text-[8.5px] font-mono text-slate-400 font-bold uppercase tracking-wider mt-0.5">
              Super Admin
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
