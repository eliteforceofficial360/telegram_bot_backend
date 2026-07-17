import React from 'react';
import { motion } from 'framer-motion';

interface VerifiedBadgeProps {
  size?: number;
  className?: string;
}

export const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({ size = 20, className = "" }) => {
  const id = React.useId().replace(/:/g, '');

  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block select-none ${className}`}
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.2, rotate: 5 }}
      transition={{ type: "spring", stiffness: 380, damping: 18 }}
      style={{ overflow: 'visible' }}
    >
      <defs>
        {/* Glowing Orange glassmorphism gradient */}
        <linearGradient id={`glass-bg-${id}`} x1="0" y1="0" x2="128" y2="128" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFB347" stopOpacity="0.25"/>
          <stop offset="100%" stopColor="#FF8A00" stopOpacity="0.08"/>
        </linearGradient>

        <linearGradient id={`glass-border-${id}`} x1="0" y1="0" x2="128" y2="128" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFB347" stopOpacity="0.8"/>
          <stop offset="50%" stopColor="#FF8A00" stopOpacity="0.3"/>
          <stop offset="100%" stopColor="#FF8A00" stopOpacity="0.9"/>
        </linearGradient>

        <linearGradient id={`glow-${id}-grad`} x1="0" y1="0" x2="128" y2="128" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFB347" stopOpacity="0.4"/>
          <stop offset="100%" stopColor="#FF8A00" stopOpacity="0"/>
        </linearGradient>

        <filter id={`blur-${id}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="6" result="blur"/>
        </filter>
      </defs>

      {/* Glass glow backdrop */}
      <motion.circle
        cx="64" cy="64" r="50"
        fill={`url(#glow-${id}-grad)`}
        filter={`url(#blur-${id})`}
        animate={{ opacity: [0.3, 0.7, 0.3], scale: [0.95, 1.05, 0.95] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Main glass badge body */}
      <circle
        cx="64" cy="64" r="44"
        fill={`url(#glass-bg-${id})`}
        stroke={`url(#glass-border-${id})`}
        strokeWidth="3.5"
        style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
      />

      {/* Inner thin glow ring */}
      <circle
        cx="64" cy="64" r="38"
        stroke="#FFB347"
        strokeWidth="1"
        strokeOpacity="0.4"
        fill="none"
      />

      {/* Animated checkmark draw */}
      <motion.path
        d="M42 66 L56 80 L86 48"
        stroke="#FF8A00"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.55, delay: 0.15, ease: "easeOut" }}
        style={{
          filter: 'drop-shadow(0px 0px 5px rgba(255, 138, 0, 0.8))'
        }}
      />
    </motion.svg>
  );
};
