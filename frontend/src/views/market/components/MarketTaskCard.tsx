import React from 'react';
import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import { type MarketTask } from '../../../lib/marketService';
import { PlatformIcon, getPlatformColor } from './PlatformIcons';

interface MarketTaskCardProps {
  task: MarketTask;
  onClick: (task: MarketTask) => void;
  compact?: boolean;
}

const DIFFICULTY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  easy: { label: 'Easy', color: '#00FF88', bg: 'rgba(0,255,136,0.12)' },
  medium: { label: 'Medium', color: '#FFC857', bg: 'rgba(255,200,87,0.12)' },
  hard: { label: 'Hard', color: '#FF4D6D', bg: 'rgba(255,77,109,0.12)' },
};

function timeLeft(expiresAt: string): string {
  if (!expiresAt) return 'No Expiry';
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const totalHours = Math.floor(diff / 3600000);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = Math.floor((diff % 3600000) / 60000);

  if (days > 0) return `${days}d ${hours}h left`;
  if (totalHours > 0) return `${totalHours}h ${minutes}m left`;
  const seconds = Math.floor((diff % 60000) / 1000);
  return `${minutes}m ${seconds}s left`;
}

export const MarketTaskCard: React.FC<MarketTaskCardProps> = ({ task, onClick, compact = false }) => {
  const platformColor = getPlatformColor(task.platform);
  const diff = DIFFICULTY_CONFIG[task.difficulty] || DIFFICULTY_CONFIG.easy;
  const progress = task.workerLimit > 0
    ? Math.min(100, ((task.workerLimit - task.remainingSlots) / task.workerLimit) * 100)
    : 0;

  if (compact) {
    return (
      <motion.button
        onClick={() => onClick(task)}
        whileTap={{ scale: 0.97 }}
        className="shrink-0 flex flex-col gap-2 p-3.5 rounded-[20px] cursor-pointer text-left"
        style={{
          width: 180,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        }}
      >
        {/* Platform badge */}
        <div className="flex items-center gap-2">
          <span
            className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `${platformColor}22`, border: `1px solid ${platformColor}44` }}
          >
            <PlatformIcon platformId={task.platform} size={14} color={platformColor} />
          </span>
          <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: platformColor }}>
            {task.platform}
          </span>
        </div>

        {/* Title */}
        <p className="text-[11px] font-bold text-white leading-tight line-clamp-2">{task.title}</p>

        {/* Reward */}
        <div className="flex items-center justify-between">
          <span
            className="text-xs font-black"
            style={{ color: '#FFD700', textShadow: '0 0 10px rgba(255,215,0,0.4)' }}
          >
            +{task.reward} EFC
          </span>
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-lg"
            style={{ color: diff.color, background: diff.bg }}>
            {diff.label}
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${progress}%`,
              background: `linear-gradient(90deg, ${platformColor}88, ${platformColor})`,
            }}
          />
        </div>
      </motion.button>
    );
  }

  return (
    <motion.button
      onClick={() => onClick(task)}
      whileTap={{ scale: 0.98 }}
      className="w-full flex items-center gap-3 p-4 rounded-[20px] cursor-pointer text-left"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: task.featured ? `0 0 20px ${platformColor}18` : '0 4px 20px rgba(0,0,0,0.25)',
        borderColor: task.featured ? `${platformColor}40` : 'rgba(255,255,255,0.08)',
      }}
    >
      {/* Platform icon */}
      <span
        className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
        style={{
          background: `${platformColor}18`,
          border: `1px solid ${platformColor}35`,
          boxShadow: `0 0 12px ${platformColor}20`,
        }}
      >
        <PlatformIcon platformId={task.platform} size={20} color={platformColor} />
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: platformColor }}>
            {task.platform} · {task.action}
          </span>
          {task.featured && (
            <span className="inline-flex items-center gap-0.5 text-[8px] font-black px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(255,215,0,0.15)', color: '#FFD700', border: '1px solid rgba(255,215,0,0.3)' }}>
              <Star size={8} fill="#FFD700" color="#FFD700" /> FEATURED
            </span>
          )}
        </div>
        <p className="text-[12px] font-bold text-white leading-tight truncate">{task.title}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] text-slate-500">{task.remainingSlots} slots · {timeLeft(task.expiresAt)}</span>
        </div>
      </div>

      {/* Right side */}
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span
          className="text-sm font-black"
          style={{ color: '#FFD700', textShadow: '0 0 12px rgba(255,215,0,0.35)' }}
        >
          +{task.reward}
        </span>
        <span className="text-[8px] font-bold text-slate-500">EFC</span>
        <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded-lg mt-0.5"
          style={{ color: diff.color, background: diff.bg }}>
          {diff.label}
        </span>
      </div>
    </motion.button>
  );
};

// ── Featured Hero Card ────────────────────────────────────────────────────────
export const FeaturedTaskCard: React.FC<{ task: MarketTask; onClick: (task: MarketTask) => void }> = ({ task, onClick }) => {
  const platformColor = getPlatformColor(task.platform);
  const progress = task.workerLimit > 0
    ? Math.min(100, ((task.workerLimit - task.remainingSlots) / task.workerLimit) * 100)
    : 0;

  return (
    <motion.button
      onClick={() => onClick(task)}
      whileTap={{ scale: 0.98 }}
      className="w-full rounded-[24px] overflow-hidden cursor-pointer text-left relative"
      style={{
        background: `linear-gradient(135deg, rgba(10,14,30,0.95) 0%, rgba(20,16,40,0.95) 100%)`,
        border: `1px solid ${platformColor}50`,
        boxShadow: `0 0 40px ${platformColor}18, 0 16px 40px rgba(0,0,0,0.5)`,
        minHeight: 140,
      }}
    >
      {/* Background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 80% 80% at 80% 50%, ${platformColor}15 0%, transparent 70%)`,
        }}
      />

      {/* Gold corner accent */}
      <div className="absolute top-0 right-0 w-24 h-24 pointer-events-none opacity-20"
        style={{ background: `radial-gradient(circle at top right, ${platformColor}, transparent 70%)` }} />

      <div className="relative z-10 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            {/* Featured badge */}
            <span className="inline-flex items-center gap-1 text-[9px] font-black tracking-widest px-2 py-1 rounded-full mb-3"
              style={{
                background: 'rgba(255,215,0,0.15)',
                border: '1px solid rgba(255,215,0,0.35)',
                color: '#FFD700',
              }}>
              <Star size={10} fill="#FFD700" color="#FFD700" /> FEATURED CAMPAIGN
            </span>

            <h3 className="text-sm font-black text-white leading-tight mb-1">{task.title}</h3>
            <p className="text-[10px] text-slate-400 leading-relaxed line-clamp-2 mb-3">{task.description}</p>

            {/* Stats row */}
            <div className="flex items-center gap-3">
              <div>
                <div className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Reward</div>
                <div className="text-sm font-black" style={{ color: '#FFD700' }}>+{task.reward} EFC</div>
              </div>
              <div className="w-px h-6 bg-white/10" />
              <div>
                <div className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Slots Left</div>
                <div className="text-sm font-black text-white">{task.remainingSlots}</div>
              </div>
              <div className="w-px h-6 bg-white/10" />
              <div>
                <div className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Platform</div>
                <div className="flex items-center gap-1.5 text-sm font-black" style={{ color: platformColor }}>
                  <PlatformIcon platformId={task.platform} size={14} color={platformColor} />
                  {task.platform}
                </div>
              </div>
            </div>

            {/* Progress */}
            <div className="mt-3">
              <div className="flex justify-between text-[8px] text-slate-500 mb-1">
                <span>{task.workerLimit - task.remainingSlots} completed</span>
                <span>{task.workerLimit} total</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${progress}%`,
                    background: `linear-gradient(90deg, ${platformColor}88, ${platformColor}, #FFD700)`,
                    boxShadow: `0 0 8px ${platformColor}60`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Platform orb */}
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
            style={{
              background: `${platformColor}20`,
              border: `1.5px solid ${platformColor}50`,
              boxShadow: `0 0 20px ${platformColor}30`,
            }}
          >
            <PlatformIcon platformId={task.platform} size={28} color={platformColor} />
          </div>
        </div>
      </div>
    </motion.button>
  );
};

// ── Skeleton Card ─────────────────────────────────────────────────────────────
export const SkeletonCard: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  if (compact) {
    return (
      <div className="shrink-0 flex flex-col gap-2 p-3.5 rounded-[20px] animate-pulse"
        style={{ width: 180, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-white/5" />
          <div className="h-2 w-14 rounded-full bg-white/5" />
        </div>
        <div className="h-3 w-full rounded-full bg-white/5" />
        <div className="h-3 w-2/3 rounded-full bg-white/5" />
        <div className="flex justify-between">
          <div className="h-3 w-14 rounded-full bg-white/5" />
          <div className="h-3 w-10 rounded-full bg-white/5" />
        </div>
        <div className="h-1 w-full rounded-full bg-white/5" />
      </div>
    );
  }
  return (
    <div className="w-full flex items-center gap-3 p-4 rounded-[20px] animate-pulse"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
      <div className="w-11 h-11 rounded-2xl bg-white/5 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-2 w-1/3 rounded-full bg-white/5" />
        <div className="h-3 w-3/4 rounded-full bg-white/5" />
        <div className="h-2 w-1/2 rounded-full bg-white/5" />
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <div className="h-4 w-10 rounded-full bg-white/5" />
        <div className="h-2 w-6 rounded-full bg-white/5" />
      </div>
    </div>
  );
};
