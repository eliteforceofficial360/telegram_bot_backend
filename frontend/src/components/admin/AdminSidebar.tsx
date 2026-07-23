import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export type AdminTab = 'dashboard' | 'users' | 'countries' | 'tasks' | 'withdrawals' | 'security' | 'notifications' | 'settings' | 'topminers';

interface AdminSidebarProps {
  activeTab: AdminTab;
  setActiveTab: (tab: AdminTab) => void;
  isOpen: boolean;
  onClose: () => void;
  eforceTokenValue?: number;
}

const navItems: { id: AdminTab; label: string; iconClass: string; desc: string; accentColor: string }[] = [
  { id: 'dashboard',     label: 'Dashboard',      iconClass: 'fa-solid fa-chart-pie',             desc: 'Overview & Telemetry', accentColor: '#38BDF8' },
  { id: 'users',         label: 'Users Roster',   iconClass: 'fa-solid fa-users-gear',            desc: 'Member Directory',    accentColor: '#60A5FA' },
  { id: 'countries',     label: 'Geographics',    iconClass: 'fa-solid fa-earth-americas',        desc: 'Regional Demographics',accentColor: '#22D3EE' },
  { id: 'tasks',         label: 'Missions',       iconClass: 'fa-solid fa-list-check',            desc: 'Earning Campaigns',    accentColor: '#34D399' },
  { id: 'withdrawals',   label: 'Payouts',        iconClass: 'fa-solid fa-money-bill-transfer',   desc: 'Withdrawal Requests',  accentColor: '#4ADE80' },
  { id: 'security',      label: 'Security Shield',iconClass: 'fa-solid fa-shield-halved',        desc: 'Threats & Moderation', accentColor: '#FB923C' },
  { id: 'notifications', label: 'Broadcasts',     iconClass: 'fa-solid fa-bullhorn',              desc: 'Global Push Alerts',   accentColor: '#C084FC' },
  { id: 'topminers',     label: 'Leaderboard',    iconClass: 'fa-solid fa-trophy',                desc: 'Top Pinned Miners',    accentColor: '#FBBF24' },
  { id: 'settings',      label: 'System Config',  iconClass: 'fa-solid fa-sliders',               desc: 'Economy Parameters',   accentColor: '#818CF8' },
];

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  activeTab, setActiveTab, isOpen, onClose, eforceTokenValue = 0.05,
}) => {
  return (
    <>
      {/* Mobile Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      {/* Dark Corporate Sidebar Panel */}
      <aside
        className={`
          fixed top-0 left-0 h-full z-50 flex flex-col bg-[#0B0E14]
          w-[250px] transition-transform duration-200 ease-out border-r border-slate-800/80 shadow-2xl
          lg:relative lg:translate-x-0 lg:z-auto shrink-0 select-none
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Brand Header */}
        <div className="p-5 pb-4 shrink-0 border-b border-slate-800/80 bg-[#0E121B]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-xs">
                <i className="fa-solid fa-bolt text-lg"></i>
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-white tracking-tight leading-none">
                  Elite Force
                </h2>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                    Console Dark v4.2
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <i className="fa-solid fa-xmark text-sm"></i>
            </button>
          </div>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest">
            Core Modules
          </div>

          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); onClose(); }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer text-left ${
                  isActive
                    ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30 shadow-xs font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs shrink-0 transition-colors ${
                    isActive ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-slate-800/80 text-slate-400'
                  }`}
                >
                  <i className={item.iconClass}></i>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-bold leading-tight">{item.label}</div>
                  <div className={`text-[9.5px] truncate mt-0.5 font-normal ${isActive ? 'text-blue-300/80' : 'text-slate-500'}`}>
                    {item.desc}
                  </div>
                </div>

                {isActive && (
                  <i className="fa-solid fa-chevron-right text-[10px] text-blue-400 shrink-0"></i>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer info & live web link */}
        <div className="p-3 border-t border-slate-800/80 bg-[#0E121B] shrink-0 flex flex-col gap-2">
          <div className="p-3 bg-[#131824] rounded-xl border border-slate-800 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center text-xs font-bold border border-blue-500/20">
                <i className="fa-solid fa-coins"></i>
              </div>
              <div>
                <div className="text-[9px] text-slate-400 font-mono font-bold uppercase tracking-wider">EFC Token</div>
                <div className="text-[11px] font-extrabold text-white">${eforceTokenValue.toFixed(4)}</div>
              </div>
            </div>
            <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              LIVE
            </span>
          </div>

          <a
            href="https://v4elite.vercel.app"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#131824] hover:bg-[#182030] border border-slate-800 text-[11px] font-bold text-slate-300 hover:text-white transition-colors"
          >
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-globe text-blue-400 text-xs"></i>
              <span>Live Application</span>
            </div>
            <i className="fa-solid fa-arrow-up-right-from-square text-[10px] text-slate-500"></i>
          </a>
        </div>
      </aside>
    </>
  );
};
