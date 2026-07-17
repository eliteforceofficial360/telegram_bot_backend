import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export type ActiveTab = 'home' | 'tasks' | 'referral' | 'wallet' | 'profile' | 'leaderboard' | 'admin';

interface NavigationProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  isAdmin: boolean;
}

// ── iOS-style dual-state animated icons ─────────────────────────────────────
// Each icon renders filled when active, outlined when inactive

const HomeIcon = ({ active }: { active: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    {active ? (
      <>
        {/* filled house body */}
        <path d="M3 10.5L12 3L21 10.5V20C21 20.5523 20.5523 21 20 21H15.5V15.5C15.5 14.6716 14.8284 14 14 14H10C9.17157 14 8.5 14.6716 8.5 15.5V21H4C3.44772 21 3 20.5523 3 20V10.5Z"
          fill="#FF8A00" opacity="0.9"/>
        {/* door */}
        <rect x="9" y="15" width="6" height="6" rx="1" fill="#FF6500"/>
        {/* roof peak highlight */}
        <path d="M12 3L21 10.5" stroke="#FFB347" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
        <path d="M3 10.5L12 3" stroke="#FFB347" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
      </>
    ) : (
      <>
        <path d="M3 10.5L12 3L21 10.5V20C21 20.5523 20.5523 21 20 21H15V15H9V21H4C3.44772 21 3 20.5523 3 20V10.5Z"
          stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M9 21V15H15V21" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </>
    )}
  </svg>
);

const TasksIcon = ({ active }: { active: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    {active ? (
      <>
        {/* filled card */}
        <rect x="4" y="2" width="16" height="20" rx="3" fill="#FF8A00" opacity="0.85"/>
        {/* check mark line 1 */}
        <path d="M8 8.5H16" stroke="#FFF" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M8 12H16" stroke="#FFF" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M8 15.5H12" stroke="#FFF" strokeWidth="1.5" strokeLinecap="round"/>
        {/* tick */}
        <circle cx="19" cy="19" r="4" fill="#4ADE80"/>
        <path d="M17.2 19L18.5 20.3L21 17.8" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </>
    ) : (
      <>
        <rect x="5" y="3" width="14" height="18" rx="2" stroke="#64748b" strokeWidth="1.5"/>
        <path d="M9 8H15" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M9 12H15" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M9 16H12" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round"/>
      </>
    )}
  </svg>
);

const InviteIcon = ({ active }: { active: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    {active ? (
      <>
        {/* filled person */}
        <circle cx="9" cy="7" r="4" fill="#FF8A00" opacity="0.9"/>
        <path d="M3 20C3 16.134 5.68629 13 9 13H10" stroke="#FF8A00" strokeWidth="2" strokeLinecap="round"/>
        {/* plus badge */}
        <circle cx="17" cy="17" r="5" fill="#00E5FF" opacity="0.9"/>
        <path d="M17 14.5V19.5M14.5 17H19.5" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
      </>
    ) : (
      <>
        <circle cx="9" cy="7" r="4" stroke="#64748b" strokeWidth="1.5"/>
        <path d="M3 20C3 16.134 5.68629 13 9 13" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M17 13V19M14 16H20" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </>
    )}
  </svg>
);

const WalletIcon = ({ active }: { active: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    {active ? (
      <>
        {/* filled card body */}
        <rect x="2" y="6" width="20" height="14" rx="3" fill="#FF8A00" opacity="0.85"/>
        <path d="M2 10H22" stroke="#FF6500" strokeWidth="1.5"/>
        {/* coin */}
        <circle cx="17" cy="15.5" r="2.5" fill="white" opacity="0.9"/>
        <text x="17" y="16.5" textAnchor="middle" fontSize="3" fill="#FF8A00" fontWeight="bold">$</text>
        {/* card top strip */}
        <path d="M6 6V5C6 3.89543 6.89543 3 8 3H16C17.1046 3 18 3.89543 18 5V6" stroke="#FFB347" strokeWidth="1.5"/>
      </>
    ) : (
      <>
        <rect x="2" y="6" width="20" height="14" rx="2" stroke="#64748b" strokeWidth="1.5"/>
        <path d="M2 10H22" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M6 6V4C6 3.44772 6.44772 3 7 3H17C17.5523 3 18 3.44772 18 4V6" stroke="#64748b" strokeWidth="1.5"/>
        <circle cx="17" cy="15" r="1.5" fill="#64748b"/>
      </>
    )}
  </svg>
);

const ProfileIcon = ({ active }: { active: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    {active ? (
      <>
        {/* filled head */}
        <circle cx="12" cy="8" r="4.5" fill="#FF8A00" opacity="0.9"/>
        {/* body fill */}
        <path d="M4 20C4 16.134 7.58172 13 12 13C16.4183 13 20 16.134 20 20" stroke="#FF8A00" strokeWidth="3" strokeLinecap="round"/>
        {/* glow ring */}
        <circle cx="12" cy="8" r="6" stroke="#FFB347" strokeWidth="0.8" opacity="0.4"/>
      </>
    ) : (
      <>
        <circle cx="12" cy="8" r="4" stroke="#64748b" strokeWidth="1.5"/>
        <path d="M4 20C4 16.134 7.58172 13 12 13C16.4183 13 20 16.134 20 20" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round"/>
      </>
    )}
  </svg>
);

const LeaderboardIcon = ({ active }: { active: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    {active ? (
      <>
        {/* gold star filled */}
        <path d="M12 2L14.5 8.5H21.5L16 12.5L18.5 19L12 15L5.5 19L8 12.5L2.5 8.5H9.5L12 2Z"
          fill="#FFD700" stroke="#FF8A00" strokeWidth="0.5"/>
        {/* inner shimmer */}
        <path d="M12 5L13.8 9.8H19L14.8 12.6L16.6 17.5L12 14.5L7.4 17.5L9.2 12.6L5 9.8H10.2L12 5Z"
          fill="#FFFDE7" opacity="0.35"/>
      </>
    ) : (
      <>
        <path d="M12 2L15 8H21L16.5 12L18.5 18L12 14.5L5.5 18L7.5 12L3 8H9L12 2Z"
          stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </>
    )}
  </svg>
);

const TAB_CONFIG = [
  { id: 'home'        as ActiveTab, label: 'Home',    Icon: HomeIcon },
  { id: 'tasks'       as ActiveTab, label: 'Tasks',   Icon: TasksIcon },
  { id: 'referral'    as ActiveTab, label: 'Invite',  Icon: InviteIcon },
  { id: 'wallet'      as ActiveTab, label: 'Wallet',  Icon: WalletIcon },
  { id: 'profile'     as ActiveTab, label: 'Profile', Icon: ProfileIcon },
  { id: 'leaderboard' as ActiveTab, label: 'Miners',  Icon: LeaderboardIcon },
];

export const Navigation: React.FC<NavigationProps> = ({ activeTab, setActiveTab }) => {
  return (
    <div
      className="absolute bottom-4 left-3 right-3 z-40"
      style={{ willChange: 'transform', transform: 'translateZ(0)' }}
    >
      {/* Pill Container */}
      <div
        className="relative flex items-center justify-around px-1 py-1.5 rounded-[30px] overflow-hidden"
        style={{
          background: 'rgba(8,11,24,0.95)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.07)',
          willChange: 'transform',
        }}
      >
        {/* Top shimmer */}
        <div className="absolute top-0 left-10 right-10 h-px bg-gradient-to-r from-transparent via-white/12 to-transparent pointer-events-none" />

        {TAB_CONFIG.map((tab) => {
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="relative flex flex-col items-center justify-center gap-0.5 py-2 px-2 cursor-pointer focus:outline-none"
              style={{ minWidth: 46 }}
            >
              {/* Active pill glow background */}
              <AnimatePresence>
                {isActive && (
                  <motion.div
                    layoutId="nav-active-pill"
                    className="absolute inset-0 rounded-[20px]"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{
                      background: 'linear-gradient(135deg, rgba(255,138,0,0.18), rgba(255,180,0,0.08))',
                      border: '1px solid rgba(255,138,0,0.28)',
                      boxShadow: '0 0 20px rgba(255,138,0,0.18), inset 0 1px 0 rgba(255,255,255,0.08)',
                      willChange: 'transform',
                    }}
                    transition={{ type: 'spring', stiffness: 520, damping: 38 }}
                  />
                )}
              </AnimatePresence>

              {/* Icon with pop animation */}
              <motion.div
                key={`${tab.id}-${isActive}`}
                initial={isActive ? { scale: 0.7, y: 4 } : false}
                animate={{ scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 600, damping: 28 }}
                className="relative z-10 w-6 h-6 flex items-center justify-center"
                style={{ willChange: 'transform' }}
              >
                <tab.Icon active={isActive} />
              </motion.div>

              {/* Label */}
              <motion.span
                animate={{ opacity: isActive ? 1 : 0.45 }}
                transition={{ duration: 0.15 }}
                className={`relative z-10 text-[8.5px] font-bold tracking-wide ${
                  isActive ? 'text-[#FF8A00]' : 'text-slate-500'
                }`}
                style={{ fontFamily: 'inherit' }}
              >
                {tab.label}
              </motion.span>

              {/* Active dot */}
              <AnimatePresence>
                {isActive && (
                  <motion.div
                    layoutId="nav-dot"
                    className="absolute -bottom-0.5 w-1.5 h-1.5 rounded-full"
                    style={{
                      background: 'linear-gradient(135deg, #FF8A00, #FFB347)',
                      boxShadow: '0 0 8px rgba(255,138,0,0.9)',
                      willChange: 'transform',
                    }}
                    transition={{ type: 'spring', stiffness: 520, damping: 38 }}
                  />
                )}
              </AnimatePresence>
            </button>
          );
        })}
      </div>
    </div>
  );
};
