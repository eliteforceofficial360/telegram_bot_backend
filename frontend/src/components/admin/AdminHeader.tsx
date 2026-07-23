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
  dashboard:     { title: 'Executive Overview', sub: 'Real-time performance metrics & telemetry', faIcon: 'fa-solid fa-chart-pie',             accentColor: '#2563EB' },
  users:         { title: 'User Directory',     sub: 'Manage member roster, ranks and moderations', faIcon: 'fa-solid fa-users-gear',            accentColor: '#0284C7' },
  countries:     { title: 'Regional Demographics', sub: 'Geographic distribution and country analytics', faIcon: 'fa-solid fa-earth-americas',     accentColor: '#0891B2' },
  tasks:         { title: 'Mission Control',    sub: 'Configure active earning tasks & campaigns', faIcon: 'fa-solid fa-list-check',            accentColor: '#059669' },
  withdrawals:   { title: 'Payout Queue',       sub: 'Review, approve, or flag payment requests',  faIcon: 'fa-solid fa-money-bill-transfer',   accentColor: '#16A34A' },
  security:      { title: 'Security Center',    sub: 'Flagged accounts, anti-cheat & bans',        faIcon: 'fa-solid fa-shield-halved',        accentColor: '#EA580C' },
  notifications: { title: 'Broadcast Manager', sub: 'Push messages & global announcements',        faIcon: 'fa-solid fa-bullhorn',              accentColor: '#7C3AED' },
  topminers:     { title: 'Leaderboard Config',  sub: 'Pin top miners & configure rankings',        faIcon: 'fa-solid fa-trophy',                accentColor: '#D97706' },
  settings:      { title: 'System Parameters',  sub: 'Global token values, limits & app settings', faIcon: 'fa-solid fa-sliders',               accentColor: '#4F46E5' },
};

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  activeTab, onMenuClick, pendingCount, flaggedCount, onRefresh, isRefreshing, adminUsername,
}) => {
  const meta = tabMeta[activeTab];
  const notifCount = pendingCount + flaggedCount;

  return (
    <header className="flex items-center justify-between px-4 md:px-6 py-3.5 bg-white border-b border-slate-200 shadow-xs relative z-20 shrink-0 select-none">
      {/* Left section: Mobile menu toggle + breadcrumb */}
      <div className="flex items-center gap-3.5">
        <button
          onClick={onMenuClick}
          className="lg:hidden w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors border border-slate-200"
        >
          <i className="fa-solid fa-bars text-sm"></i>
        </button>

        {/* Tab Header Badge */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 text-sm shrink-0">
            <i className={meta.faIcon}></i>
          </div>
          <div>
            <h1 className="text-sm md:text-base font-extrabold text-slate-900 tracking-tight leading-tight">
              {meta.title}
            </h1>
            <p className="text-[10px] text-slate-500 font-medium hidden md:block mt-0.5">{meta.sub}</p>
          </div>
        </div>
      </div>

      {/* Right section: System actions & user info */}
      <div className="flex items-center gap-2.5">
        {/* Refresh button */}
        <button
          onClick={onRefresh}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 transition-colors border border-slate-200"
          title="Refresh Telemetry"
        >
          <i className={`fa-solid fa-rotate-right text-xs ${isRefreshing ? 'animate-spin text-blue-600' : ''}`}></i>
        </button>

        {/* Alerts Bell */}
        <div className="relative">
          <button
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 transition-colors border border-slate-200"
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
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-[9.5px] font-mono font-bold text-emerald-700 uppercase tracking-wider">
            NODE LIVE
          </span>
        </div>

        {/* Super Admin Badge */}
        <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200">
          <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center text-white text-xs font-bold shadow-xs">
            <i className="fa-solid fa-user-shield text-amber-400"></i>
          </div>
          <div className="hidden md:block">
            <div className="text-[11px] font-extrabold text-slate-900 leading-none">
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
