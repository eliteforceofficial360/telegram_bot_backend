import React from 'react';
import { motion } from 'framer-motion';

interface MiningCoinProps {
  isMiningActive: boolean;
  isMiningCompleted: boolean;
  className?: string;
}

export const MiningCoin: React.FC<MiningCoinProps> = ({
  isMiningActive,
  isMiningCompleted,
  className = '',
}) => {
  return (
    <div
      className={`relative w-full h-full flex items-center justify-center select-none ${className}`}
      style={{ perspective: 1200 }}
    >
      {/* Dynamic Ambient Aura Glow */}
      <div
        className={`absolute inset-[-18px] rounded-full blur-3xl transition-all duration-700 pointer-events-none ${
          isMiningActive
            ? 'bg-[#FF8A00]/45 animate-pulse'
            : isMiningCompleted
            ? 'bg-[#FFD700]/55 animate-pulse'
            : 'bg-[#FF8A00]/15'
        }`}
      />

      {/* Outer Pulse Ring */}
      <div
        className={`absolute inset-[-6px] rounded-full blur-xl transition-all duration-700 pointer-events-none ${
          isMiningActive
            ? 'bg-[#00E5FF]/35'
            : isMiningCompleted
            ? 'bg-[#FFD700]/40'
            : 'bg-[#FF8A00]/20'
        }`}
      />

      {/* 3D Coin Body Container */}
      <motion.div
        className="relative w-full h-full rounded-full flex items-center justify-center cursor-pointer"
        style={{ transformStyle: 'preserve-3d' }}
        animate={
          isMiningActive
            ? {
                rotateY: [0, 180, 360],
                rotateX: [0, 6, 0, -6, 0],
                scale: [1, 1.03, 1],
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
                rotateY: { repeat: Infinity, duration: 4.5, ease: 'linear' },
                rotateX: { repeat: Infinity, duration: 3, ease: 'easeInOut' },
                scale: { repeat: Infinity, duration: 2, ease: 'easeInOut' },
              }
            : { duration: 0.4 }
        }
      >
        {/* 3D Realistic Metallic Gold Coin Canvas */}
        <div className="w-full h-full rounded-full relative flex items-center justify-center bg-gradient-to-br from-[#FFD700] via-[#FF8A00] to-[#804000] p-1.5 shadow-[0_15px_40px_rgba(0,0,0,0.8),inset_0_2px_20px_rgba(255,255,255,0.6),inset_0_-8px_25px_rgba(0,0,0,0.7)] border-4 border-[#FFE5B4]/50 overflow-hidden">
          {/* Milled Edge Ridges Pattern Ring */}
          <div className="absolute inset-1.5 rounded-full border-2 border-dashed border-[#FFF8E7]/40 pointer-events-none z-10" />

          {/* Inner Bezel Ring */}
          <div className="absolute inset-3 rounded-full border border-[#FFF2B2]/60 shadow-[inset_0_0_15px_rgba(0,0,0,0.5)] pointer-events-none z-10" />

          {/* Master 3D Gold EF Vector Emblem */}
          <svg
            viewBox="0 0 1625 1625"
            className="w-[92%] h-[92%] object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.7)] z-20"
          >
            <defs>
              <linearGradient id="efCoinGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FFF9D2" />
                <stop offset="35%" stopColor="#FFD700" />
                <stop offset="70%" stopColor="#FF8A00" />
                <stop offset="100%" stopColor="#994D00" />
              </linearGradient>
              <radialGradient id="efCoinBgGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#FFE082" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#804000" stopOpacity="0.1" />
              </radialGradient>
              <filter id="goldGlowFilter" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="8" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Background Texture Disc */}
            <circle cx="812.5" cy="812.5" r="750" fill="url(#efCoinBgGlow)" />
            <circle cx="812.5" cy="812.5" r="700" stroke="url(#efCoinGoldGrad)" strokeWidth="24" fill="none" opacity="0.85" />
            <circle cx="812.5" cy="812.5" r="660" stroke="#FFE5B4" strokeWidth="8" fill="none" opacity="0.4" strokeDasharray="16, 12" />

            {/* Master EF Diamond Monogram */}
            <g transform="translate(812.5, 812.5) scale(1.15) translate(-812.5, -812.5)" filter="url(#goldGlowFilter)">
              {/* Outer Diamond Shield */}
              <path
                d="M812.5 320 L1180 687.5 L812.5 1055 L445 687.5 Z"
                fill="none"
                stroke="url(#efCoinGoldGrad)"
                strokeWidth="48"
                strokeLinejoin="round"
              />
              {/* Inner Diamond Accent */}
              <path
                d="M812.5 390 L1110 687.5 L812.5 985 L515 687.5 Z"
                fill="none"
                stroke="#FFF9D2"
                strokeWidth="14"
                strokeLinejoin="round"
                opacity="0.6"
              />
              {/* 'E' Letter Vector Structure */}
              <path
                d="M660 510 L880 510 L660 730 L880 730 M660 620 L840 620"
                fill="none"
                stroke="url(#efCoinGoldGrad)"
                strokeWidth="56"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* 'F' Letter Vector Structure */}
              <path
                d="M880 510 L1020 510 M880 620 L980 620 M880 510 L880 860"
                fill="none"
                stroke="url(#efCoinGoldGrad)"
                strokeWidth="56"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          </svg>
        </div>
      </motion.div>
    </div>
  );
};
