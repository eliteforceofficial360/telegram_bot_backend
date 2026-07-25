import React from 'react';
import { motion } from 'framer-motion';

const CATEGORIES = [
  { id: 'all', label: 'All', icon: '🌟' },
  { id: 'Telegram', label: 'Telegram', icon: '✈️', color: '#2AABEE' },
  { id: 'X', label: 'X', icon: '𝕏', color: '#FFFFFF' },
  { id: 'Discord', label: 'Discord', icon: '🎮', color: '#5865F2' },
  { id: 'Instagram', label: 'Instagram', icon: '📸', color: '#E1306C' },
  { id: 'TikTok', label: 'TikTok', icon: '🎵', color: '#FF0050' },
  { id: 'YouTube', label: 'YouTube', icon: '▶️', color: '#FF0000' },
  { id: 'Facebook', label: 'Facebook', icon: '👤', color: '#1877F2' },
  { id: 'Website', label: 'Website', icon: '🌐', color: '#10B981' },
  { id: 'Quiz', label: 'Quiz', icon: '❓', color: '#8B5CF6' },
  { id: 'Apps', label: 'Apps', icon: '📲', color: '#F59E0B' },
  { id: 'Custom', label: 'Custom', icon: '✏️', color: '#64748B' },
];

interface CategoryPillsProps {
  selected: string;
  onSelect: (id: string) => void;
  taskCounts?: Record<string, number>;
}

export const CategoryPills: React.FC<CategoryPillsProps> = ({ selected, onSelect, taskCounts = {} }) => {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
      {CATEGORIES.map((cat) => {
        const isActive = selected === cat.id;
        const count = cat.id === 'all' ? Object.values(taskCounts).reduce((a, b) => a + b, 0) : (taskCounts[cat.id] || 0);
        const color = cat.color || '#FF8A00';

        return (
          <motion.button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            whileTap={{ scale: 0.95 }}
            className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-[14px] cursor-pointer focus:outline-none transition-all"
            style={{
              background: isActive
                ? `linear-gradient(135deg, ${color}28, ${color}14)`
                : 'rgba(255,255,255,0.04)',
              border: isActive
                ? `1px solid ${color}55`
                : '1px solid rgba(255,255,255,0.07)',
              boxShadow: isActive ? `0 0 12px ${color}20` : 'none',
            }}
          >
            <span className="text-sm leading-none">{cat.icon}</span>
            <span
              className="text-[11px] font-bold whitespace-nowrap leading-none"
              style={{ color: isActive ? color : '#64748b' }}
            >
              {cat.label}
            </span>
            {count > 0 && (
              <span
                className="text-[8px] font-black px-1.5 py-0.5 rounded-full leading-none"
                style={{
                  background: isActive ? `${color}30` : 'rgba(255,255,255,0.06)',
                  color: isActive ? color : '#475569',
                }}
              >
                {count}
              </span>
            )}
            {isActive && (
              <motion.div
                layoutId="cat-active"
                className="absolute inset-0 rounded-[14px] pointer-events-none"
                style={{ border: `1px solid ${color}40` }}
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
          </motion.button>
        );
      })}
    </div>
  );
};
