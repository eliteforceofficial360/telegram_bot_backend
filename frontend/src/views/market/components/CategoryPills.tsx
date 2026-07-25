import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { PLATFORM_META, PlatformIcon } from './PlatformIcons';

interface CategoryPillsProps {
  selected: string;
  onSelect: (id: string) => void;
  taskCounts?: Record<string, number>;
}

export const CategoryPills: React.FC<CategoryPillsProps> = ({ selected, onSelect, taskCounts = {} }) => {
  const categories = [
    { id: 'all', label: 'All', color: '#FF8A00' },
    ...PLATFORM_META.map(p => ({ id: p.id, label: p.label, color: p.color })),
  ];

  return (
    <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
      {categories.map((cat) => {
        const isActive = selected === cat.id;
        const count = cat.id === 'all' ? Object.values(taskCounts).reduce((a, b) => a + b, 0) : (taskCounts[cat.id] || 0);
        const color = cat.color;

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
            <span className="flex items-center justify-center w-4 h-4">
              {cat.id === 'all' ? (
                <Sparkles size={14} color={isActive ? color : '#64748b'} />
              ) : (
                <PlatformIcon platformId={cat.id} size={14} color={isActive ? color : '#64748b'} />
              )}
            </span>
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
          </motion.button>
        );
      })}
    </div>
  );
};
