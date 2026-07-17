import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Users, CheckSquare, DollarSign, Shield,
  Settings, Zap, ExternalLink, X, ChevronRight,
} from 'lucide-react';

export type AdminTab = 'dashboard' | 'users' | 'tasks' | 'withdrawals' | 'security' | 'settings';

interface AdminSidebarProps {
  activeTab: AdminTab;
  setActiveTab: (tab: AdminTab) => void;
  isOpen: boolean;
  onClose: () => void;
  eforceTokenValue?: number;
}

const navItems: { id: AdminTab; label: string; icon: React.ReactNode; desc: string; accentColor: string }[] = [
  { id: 'dashboard',   label: 'Dashboard',   icon: <LayoutDashboard size={15} />, desc: 'Overview & KPIs',        accentColor: '#FF8A00' },
  { id: 'users',       label: 'Users',       icon: <Users size={15} />,           desc: 'Manage members',         accentColor: '#00E5FF' },
  { id: 'tasks',       label: 'Tasks',       icon: <CheckSquare size={15} />,     desc: 'Missions & rewards',     accentColor: '#A3E635' },
  { id: 'withdrawals', label: 'Withdrawals', icon: <DollarSign size={15} />,      desc: 'Payment requests',       accentColor: '#4ADE80' },
  { id: 'security',    label: 'Security',    icon: <Shield size={15} />,          desc: 'Flags & bans',           accentColor: '#FB923C' },
  { id: 'settings',    label: 'Settings',    icon: <Settings size={15} />,        desc: 'System config',          accentColor: '#B388FF' },
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
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full z-50 flex flex-col
          w-[240px] transition-transform duration-300 ease-out
          lg:relative lg:translate-x-0 lg:z-auto
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{
          background: 'linear-gradient(180deg, #0A0D1A 0%, #070A14 50%, #050810 100%)',
          borderRight: '1px solid rgba(255,255,255,0.055)',
          boxShadow: '4px 0 40px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header / Logo */}
        <div className="px-5 pt-6 pb-5 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                style={{
                  background: 'linear-gradient(135deg, #FF8A00, #FFB347)',
                  boxShadow: '0 0 20px rgba(255,138,0,0.5), 0 4px 12px rgba(255,138,0,0.2)',
                }}
              >
                <Zap size={17} className="text-white fill-current" />
              </div>
              <div>
                <div className="text-[11px] font-black text-white tracking-widest uppercase leading-none">
                  Elite Force
                </div>
                <div
                  className="text-[8px] font-bold uppercase tracking-[0.25em] mt-0.5"
                  style={{ color: '#FF8A00' }}
                >
                  Admin Console
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="lg:hidden w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/8 transition-all"
            >
              <X size={14} />
            </button>
          </div>

          {/* Divider */}
          <div
            className="mt-5 h-px w-full"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(255,138,0,0.3), transparent)' }}
          />
        </div>

        {/* Nav Items */}
        <nav className="flex-1 px-3 flex flex-col gap-1 overflow-y-auto pb-2">
          <div className="text-[8px] text-slate-600 font-black uppercase tracking-[0.28em] px-3 pb-2">
            Navigation
          </div>
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <motion.button
                key={item.id}
                onClick={() => { setActiveTab(item.id); onClose(); }}
                whileHover={{ x: isActive ? 0 : 3 }}
                whileTap={{ scale: 0.97 }}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-xs font-semibold transition-colors cursor-pointer relative overflow-hidden text-left ${
                  isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {/* Active background */}
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active-bg"
                    className="absolute inset-0 rounded-2xl"
                    style={{
                      background: `linear-gradient(135deg, ${item.accentColor}18 0%, ${item.accentColor}06 100%)`,
                      border: `1px solid ${item.accentColor}28`,
                    }}
                    transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                  />
                )}

                {/* Hover background */}
                {!isActive && (
                  <div className="absolute inset-0 rounded-2xl opacity-0 hover:opacity-100 transition-opacity"
                    style={{ background: 'rgba(255,255,255,0.03)' }} />
                )}

                {/* Left accent line */}
                {isActive && (
                  <div
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-full"
                    style={{ background: item.accentColor, boxShadow: `0 0 8px ${item.accentColor}` }}
                  />
                )}

                {/* Icon */}
                <span
                  className="relative z-10 w-7 h-7 rounded-xl flex items-center justify-center shrink-0 transition-all"
                  style={{
                    background: isActive ? `${item.accentColor}20` : 'rgba(255,255,255,0.05)',
                    color: isActive ? item.accentColor : '#64748b',
                    border: isActive ? `1px solid ${item.accentColor}30` : '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  {item.icon}
                </span>

                {/* Label + desc */}
                <div className="relative z-10 flex-1 min-w-0">
                  <div className="text-[11px] font-bold leading-none"
                    style={{ color: isActive ? '#fff' : undefined }}>
                    {item.label}
                  </div>
                  <div className="text-[9px] text-slate-600 mt-0.5 font-medium">{item.desc}</div>
                </div>

                {isActive && (
                  <ChevronRight size={11} className="relative z-10 shrink-0" style={{ color: item.accentColor }} />
                )}
              </motion.button>
            );
          })}
        </nav>

        {/* Token price chip */}
        <div className="mx-3 mb-3 shrink-0">
          <div
            className="rounded-2xl p-3.5"
            style={{
              background: 'linear-gradient(135deg, rgba(255,138,0,0.1) 0%, rgba(255,138,0,0.04) 100%)',
              border: '1px solid rgba(255,138,0,0.18)',
            }}
          >
            <div className="text-[8px] text-slate-500 uppercase tracking-[0.22em] font-bold mb-2.5">
              EF Token Price
            </div>
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-[9px] font-black text-white shrink-0"
                style={{
                  background: 'linear-gradient(135deg, #FF8A00, #FFB347)',
                  boxShadow: '0 0 12px rgba(255,138,0,0.4)',
                }}
              >
                EF
              </div>
              <div>
                <div className="text-[10px] text-white font-bold leading-none">EForce Token</div>
                <div className="text-[12px] font-black mt-0.5" style={{ color: '#FF8A00' }}>
                  ${eforceTokenValue.toFixed(4)}
                </div>
              </div>
              <div className="ml-auto text-[8px] font-bold px-1.5 py-0.5 rounded-full text-green-400 bg-green-400/10 border border-green-400/20">
                LIVE
              </div>
            </div>
          </div>
        </div>

        {/* View App link */}
        <div className="px-3 pb-5 shrink-0">
          <a
            href="https://v4elite.vercel.app"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl text-[10px] text-slate-400 hover:text-white transition-all group"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
            }}
          >
            <ExternalLink size={11} className="group-hover:text-[#FF8A00] transition-colors" />
            <span className="font-semibold">View Mini App</span>
            <div className="ml-auto w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          </a>
        </div>
      </aside>
    </>
  );
};
