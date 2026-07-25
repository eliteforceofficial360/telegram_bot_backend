import React from 'react';
import { motion } from 'framer-motion';

interface MiningCoinProps {
  isMiningActive: boolean;
  isMiningCompleted: boolean;
  coinIconUrl?: string;
  className?: string;
}

export const MiningCoin: React.FC<MiningCoinProps> = ({
  isMiningActive,
  isMiningCompleted,
  coinIconUrl,
  className = '',
}) => {
  const isCustomUrl =
    coinIconUrl &&
    coinIconUrl !== '/coin.png' &&
    !coinIconUrl.includes('loading-logo');

  return (
    <div
      className={`relative w-full h-full flex items-center justify-center select-none ${className}`}
      style={{ perspective: 1000 }}
    >
      {/* Glow Effects Behind Coin */}
      <div
        className={`absolute inset-[-12px] rounded-full blur-2xl transition-all duration-700 pointer-events-none ${
          isMiningActive
            ? 'bg-[#FF8A00]/40 animate-pulse'
            : isMiningCompleted
            ? 'bg-[#FFD700]/50 animate-pulse'
            : 'bg-[#FF8A00]/15'
        }`}
      />

      {/* Main 3D Interactive Coin Container */}
      <motion.div
        className="relative w-full h-full rounded-full flex items-center justify-center"
        style={{ transformStyle: 'preserve-3d' }}
        animate={
          isMiningActive
            ? {
                rotateY: [0, 180, 360],
                rotateX: [0, 8, 0, -8, 0],
                scale: [1, 1.04, 1],
              }
            : {
                rotateY: 0,
                rotateX: 0,
                scale: 1,
              }
        }
        transition={
          isMiningActive
            ? {
                rotateY: { repeat: Infinity, duration: 4, ease: 'linear' },
                rotateX: { repeat: Infinity, duration: 3, ease: 'easeInOut' },
                scale: { repeat: Infinity, duration: 2, ease: 'easeInOut' },
              }
            : { duration: 0.5 }
        }
      >
        {isCustomUrl ? (
          <img
            src={coinIconUrl}
            alt="Mining Coin"
            draggable={false}
            className="w-full h-full object-cover rounded-full select-none drop-shadow-[0_0_35px_rgba(255,138,0,0.5)]"
          />
        ) : (
          <div className="w-full h-full rounded-full relative flex items-center justify-center bg-gradient-to-br from-[#FFB347] via-[#FF8A00] to-[#B35900] p-2 shadow-[0_0_40px_rgba(255,138,0,0.4),inset_0_2px_15px_rgba(255,255,255,0.4),inset_0_-4px_20px_rgba(0,0,0,0.6)] border-4 border-[#FFE0B2]/40">
            {/* Outer Coin Edge Ring */}
            <div className="absolute inset-1 rounded-full border-2 border-dashed border-[#FFF3E0]/30 pointer-events-none" />

            {/* Elite Force SVG Gold Emblem */}
            <svg
              viewBox="0 0 1625 1625"
              className="w-[85%] h-[85%] object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
            >
              <defs>
                <linearGradient id="efGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FFF2B2" />
                  <stop offset="50%" stopColor="#FE9E06" />
                  <stop offset="100%" stopColor="#B35900" />
                </linearGradient>
              </defs>
              {/* Gold EF Logo Center Emblem */}
              <circle cx="812.5" cy="812.5" r="700" fill="url(#efGoldGrad)" opacity="0.15" />
              <circle cx="812.5" cy="812.5" r="650" stroke="url(#efGoldGrad)" strokeWidth="30" fill="none" opacity="0.8" />
              
              {/* EF Monogram Diamond Center */}
              <g transform="translate(812.5, 812.5) scale(1.1) translate(-812.5, -812.5)">
                <path
                  d="M812.5 350 L1150 687.5 L812.5 1025 L475 687.5 Z"
                  fill="none"
                  stroke="url(#efGoldGrad)"
                  strokeWidth="45"
                  strokeLinejoin="round"
                />
                <path
                  d="M700 520 L920 520 L700 740 L920 740 M700 630 L880 630"
                  fill="none"
                  stroke="url(#efGoldGrad)"
                  strokeWidth="50"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            </svg>
          </div>
        )}
      </motion.div>
    </div>
  );
};
