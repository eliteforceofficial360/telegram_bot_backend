import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Users, CheckSquare, DollarSign, Shield,
  Settings, Zap, ExternalLink, X, ChevronRight, Bell, Trophy, Globe,
} from 'lucide-react';

export type AdminTab = 'dashboard' | 'users' | 'countries' | 'tasks' | 'withdrawals' | 'security' | 'notifications' | 'settings' | 'topminers';

interface AdminSidebarProps {
  activeTab: AdminTab;
  setActiveTab: (tab: AdminTab) => void;
  isOpen: boolean;
  onClose: () => void;
  eforceTokenValue?: number;
}

const navItems: { id: AdminTab; label: string; icon: React.ReactNode; desc: string; accentColor: string }[] = [
  { id: 'dashboard',     label: 'Dashboard',      icon: <LayoutDashboard size={15} />, desc: 'Overview & KPIs',        accentColor: '#2563EB' },
  { id: 'users',         label: 'Users',          icon: <Users size={15} />,           desc: 'Manage members',         accentColor: '#0284C7' },
  { id: 'countries',     label: 'Countries',      icon: <Globe size={15} />,           desc: 'Regional analytics',     accentColor: '#0891B2' },
  { id: 'tasks',         label: 'Tasks',          icon: <CheckSquare size={15} />,     desc: 'Missions & rewards',     accentColor: '#059669' },
  { id: 'withdrawals',   label: 'Withdrawals',    icon: <DollarSign size={15} />,      desc: 'Payment requests',       accentColor: '#16A34A' },
  { id: 'security',      label: 'Security',       icon: <Shield size={15} />,          desc: 'Flags & bans',           accentColor: '#EA580C' },
  { id: 'notifications', label: 'Notifications',  icon: <Bell size={15} />,            desc: 'Push messages & alerts', accentColor: '#7C3AED' },
  { id: 'topminers',     label: 'Top Miners',     icon: <Trophy size={15} />,          desc: 'Leaderboard setup',      accentColor: '#D97706' },
  { id: 'settings',      label: 'Settings',       icon: <Settings size={15} />,        desc: 'System config',          accentColor: '#4F46E5' },
];

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  activeTab, setActiveTab, isOpen, onClose, eforceTokenValue = 0.05,
}) => {
  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full z-50 flex flex-col bg-white
          w-[240px] transition-transform duration-300 ease-out border-r border-slate-200 shadow-sm
          lg:relative lg:translate-x-0 lg:z-auto
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Header / Logo */}
        <div className="px-5 pt-5 pb-4 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center shrink-0 text-white shadow-sm"
              >
                <Zap size={16} className="fill-current" />
              </div>
              <div>
                <div className="text-[12px] font-black text-slate-900 tracking-tight leading-none">
                  Elite Force
                </div>
                <div className="text-[9px] font-bold text-blue-600 uppercase tracking-widest mt-0.5">
                  Admin Console
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="lg:hidden w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          <div className="mt-4 h-px w-full bg-slate-100" />
        </div>

        {/* Nav Items */}
        <nav className="flex-1 px-3 flex flex-col gap-1 overflow-y-auto pb-2">
          <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider px-3 py-1">
            Navigation
          </div>
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); onClose(); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer text-left ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-200/60 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                    isActive ? 'bg-blue-600 text-white' : 'text-slate-400 bg-slate-100'
                  }`}
                >
                  {item.icon}
                </span>

                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold leading-none">{item.label}</div>
                  <div className="text-[9px] text-slate-400 mt-0.5 truncate">{item.desc}</div>
                </div>

                {isActive && (
                  <ChevronRight size={12} className="shrink-0 text-blue-600" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Token price chip */}
        <div className="mx-3 mb-3 shrink-0">
          <div className="rounded-xl p-3 bg-slate-50 border border-slate-200">
            <div className="text-[8px] text-slate-400 uppercase tracking-wider font-bold mb-1.5">
              EForce Token Price
            </div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-[8px] font-black text-white shrink-0">
                EFC
              </div>
              <div>
                <div className="text-[10px] text-slate-700 font-bold leading-none">Token Value</div>
                <div className="text-[11px] font-black mt-0.5 text-blue-600">
                  ${eforceTokenValue.toFixed(4)}
                </div>
              </div>
              <div className="ml-auto text-[8px] font-bold px-1.5 py-0.5 rounded text-emerald-700 bg-emerald-50 border border-emerald-200">
                LIVE
              </div>
            </div>
          </div>
        </div>

        {/* View App link */}
        <div className="px-3 pb-4 shrink-0">
          <a
            href="https://v4elite.vercel.app"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] text-slate-600 hover:text-slate-900 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-all font-semibold"
          >
            <ExternalLink size={12} className="text-slate-500" />
            <span>View Live Mini App</span>
            <div className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-500" />
          </a>
        </div>
      </aside>
    </>
  );
};
