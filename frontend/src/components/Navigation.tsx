import React from 'react';
import { motion } from 'framer-motion';

export type ActiveTab = 'home' | 'tasks' | 'referral' | 'wallet' | 'profile' | 'leaderboard' | 'admin';

interface NavigationProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  isAdmin: boolean;
}

// ── Inline SVG icons (wired/flat style) ─────────────────────────────────────
const HomeIcon = ({ color }: { color: string }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 9.5L12 3L21 9.5V20C21 20.5523 20.5523 21 20 21H15V15H9V21H4C3.44772 21 3 20.5523 3 20V9.5Z"
      stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <path d="M9 21V15H15V21" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const TasksIcon = ({ color }: { color: string }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="5" y="3" width="14" height="18" rx="2" stroke={color} strokeWidth="1.5" fill="none"/>
    <path d="M9 8H15" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M9 12H15" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M9 16H12" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M8 7L9.5 8.5L12.5 5.5" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" opacity="0"/>
  </svg>
);

const InviteIcon = ({ color }: { color: string }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="9" cy="7" r="4" stroke={color} strokeWidth="1.5" fill="none"/>
    <path d="M3 20C3 16.134 5.68629 13 9 13" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M17 13V19M14 16H20" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const WalletIcon = ({ color }: { color: string }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="6" width="20" height="14" rx="2" stroke={color} strokeWidth="1.5" fill="none"/>
    <path d="M2 10H22" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M6 6V4C6 3.44772 6.44772 3 7 3H17C17.5523 3 18 3.44772 18 4V6" stroke={color} strokeWidth="1.5"/>
    <circle cx="17" cy="15" r="1.5" fill={color}/>
  </svg>
);

const ProfileIcon = ({ color }: { color: string }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="8" r="4" stroke={color} strokeWidth="1.5" fill="none"/>
    <path d="M4 20C4 16.134 7.58172 13 12 13C16.4183 13 20 16.134 20 20" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const MinersIcon = ({ color }: { color: string }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L15 8H21L16.5 12L18.5 18L12 14.5L5.5 18L7.5 12L3 8H9L12 2Z"
      stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </svg>
);

const TAB_ICONS: Record<string, React.FC<{ color: string }>> = {
  home: HomeIcon,
  tasks: TasksIcon,
  referral: InviteIcon,
  wallet: WalletIcon,
  profile: ProfileIcon,
  leaderboard: MinersIcon,
};

const tabs = [
  { id: 'home'        as ActiveTab, label: 'Home'   },
  { id: 'tasks'       as ActiveTab, label: 'Tasks'  },
  { id: 'referral'    as ActiveTab, label: 'Invite' },
  { id: 'wallet'      as ActiveTab, label: 'Wallet' },
  { id: 'profile'     as ActiveTab, label: 'Profile'},
  { id: 'leaderboard' as ActiveTab, label: 'Miners' },
];

export const Navigation: React.FC<NavigationProps> = ({ activeTab, setActiveTab }) => {
  return (
    <div className="absolute bottom-4 left-3 right-3 z-40" style={{ willChange: 'transform', transform: 'translateZ(0)' }}>
      {/* Pill Container */}
      <div
        className="relative flex items-center justify-around px-2 py-2 rounded-[28px] overflow-hidden"
        style={{
          background: 'rgba(10,13,28,0.92)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.07)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.06)',
          willChange: 'transform',
        }}
      >
        {/* Subtle inner shimmer line */}
        <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />

        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = TAB_ICONS[tab.id];
          const iconColor = isActive ? '#FF8A00' : '#64748b';

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="relative flex flex-col items-center justify-center gap-0.5 py-1 px-2.5 cursor-pointer transition-all duration-200 group focus:outline-none"
              style={{ minWidth: 44 }}
            >
              {/* Active pill glow background */}
              {isActive && (
                <motion.div
                  layoutId="nav-active-pill"
                  className="absolute inset-0 rounded-[18px]"
                  style={{
                    background: 'rgba(255,138,0,0.12)',
                    border: '1px solid rgba(255,138,0,0.22)',
                    boxShadow: '0 0 18px rgba(255,138,0,0.15)',
                    willChange: 'transform',
                  }}
                  transition={{ type: 'spring', stiffness: 520, damping: 38 }}
                />
              )}

              {/* Icon */}
              <motion.div
                animate={{
                  scale: isActive ? 1.18 : 1,
                  y: isActive ? -1 : 0,
                }}
                transition={{ type: 'spring', stiffness: 480, damping: 30 }}
                className="relative z-10 w-6 h-6 flex items-center justify-center"
                style={{ willChange: 'transform' }}
              >
                <Icon color={iconColor} />
              </motion.div>

              {/* Label */}
              <span
                className={`relative z-10 text-[9px] font-semibold tracking-wide transition-colors duration-150 ${
                  isActive ? 'text-[#FF8A00]' : 'text-slate-600 group-hover:text-slate-400'
                }`}
              >
                {tab.label}
              </span>

              {/* Active dot indicator */}
              {isActive && (
                <motion.div
                  layoutId="nav-dot"
                  className="absolute -bottom-1 w-1 h-1 rounded-full bg-[#FF8A00] shadow-[0_0_6px_rgba(255,138,0,0.8)]"
                  transition={{ type: 'spring', stiffness: 520, damping: 38 }}
                  style={{ willChange: 'transform' }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
