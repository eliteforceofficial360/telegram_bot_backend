import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, SlidersHorizontal } from 'lucide-react';
import { type DiscoverFilters } from '../../../lib/marketService';

interface FilterDrawerProps {
  open: boolean;
  onClose: () => void;
  filters: DiscoverFilters;
  onApply: (filters: DiscoverFilters) => void;
}

const SORT_OPTIONS = [
  { id: 'newest', label: '🕐 Newest First' },
  { id: 'highest_reward', label: '⬆️ Highest Reward' },
  { id: 'lowest_reward', label: '⬇️ Lowest Reward' },
  { id: 'ending_soon', label: '⏳ Ending Soon' },
  { id: 'trending', label: '🔥 Trending' },
];

const DIFFICULTY_OPTIONS = [
  { id: 'easy', label: 'Easy', color: '#00FF88' },
  { id: 'medium', label: 'Medium', color: '#FFC857' },
  { id: 'hard', label: 'Hard', color: '#FF4D6D' },
];

export const FilterDrawer: React.FC<FilterDrawerProps> = ({ open, onClose, filters, onApply }) => {
  const [local, setLocal] = useState<DiscoverFilters>(filters);

  const handleApply = () => {
    onApply(local);
    onClose();
  };

  const handleReset = () => {
    const reset: DiscoverFilters = { sort: 'newest' };
    setLocal(reset);
    onApply(reset);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          />

          {/* Drawer */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 36 }}
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-[28px] overflow-hidden"
            style={{
              maxWidth: 430,
              margin: '0 auto',
              background: 'rgba(10,14,30,0.98)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderBottom: 'none',
              boxShadow: '0 -20px 60px rgba(0,0,0,0.6)',
            }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-2 pb-4">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={16} className="text-[#FF8A00]" />
                <span className="text-sm font-black text-white tracking-wide">Filters</span>
              </div>
              <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/6 flex items-center justify-center cursor-pointer">
                <X size={14} className="text-slate-400" />
              </button>
            </div>

            <div className="px-5 pb-6 space-y-5 overflow-y-auto" style={{ maxHeight: '70vh' }}>
              {/* Sort By */}
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Sort By</p>
                <div className="flex flex-wrap gap-2">
                  {SORT_OPTIONS.map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setLocal(p => ({ ...p, sort: opt.id as DiscoverFilters['sort'] }))}
                      className="px-3 py-2 rounded-[12px] text-[11px] font-bold cursor-pointer transition-all"
                      style={{
                        background: local.sort === opt.id ? 'rgba(255,138,0,0.18)' : 'rgba(255,255,255,0.04)',
                        border: local.sort === opt.id ? '1px solid rgba(255,138,0,0.5)' : '1px solid rgba(255,255,255,0.08)',
                        color: local.sort === opt.id ? '#FF8A00' : '#64748b',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Difficulty */}
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Difficulty</p>
                <div className="flex gap-2">
                  {DIFFICULTY_OPTIONS.map(d => (
                    <button
                      key={d.id}
                      onClick={() => setLocal(p => ({ ...p, difficulty: p.difficulty === d.id ? undefined : d.id }))}
                      className="flex-1 py-2 rounded-[12px] text-[11px] font-bold cursor-pointer transition-all"
                      style={{
                        background: local.difficulty === d.id ? `${d.color}20` : 'rgba(255,255,255,0.04)',
                        border: local.difficulty === d.id ? `1px solid ${d.color}55` : '1px solid rgba(255,255,255,0.08)',
                        color: local.difficulty === d.id ? d.color : '#64748b',
                      }}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Min Reward */}
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  Min Reward: <span className="text-[#FFD700]">{local.minReward || 0} EFC</span>
                </p>
                <input
                  type="range"
                  min={0}
                  max={500}
                  step={5}
                  value={local.minReward || 0}
                  onChange={e => setLocal(p => ({ ...p, minReward: Number(e.target.value) }))}
                  className="w-full h-1.5 rounded-full cursor-pointer"
                  style={{ accentColor: '#FF8A00' }}
                />
                <div className="flex justify-between text-[9px] text-slate-600 mt-1">
                  <span>0</span>
                  <span>500 EFC</span>
                </div>
              </div>

              {/* Verified only */}
              <div className="flex items-center justify-between py-3 px-4 rounded-[16px]"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div>
                  <p className="text-[11px] font-bold text-white">Verified Tasks Only</p>
                  <p className="text-[9px] text-slate-500">Show only platform-verified campaigns</p>
                </div>
                <button
                  onClick={() => setLocal(p => ({ ...p, verifiedOnly: !p.verifiedOnly }))}
                  className="w-11 h-6 rounded-full cursor-pointer transition-all relative"
                  style={{ background: local.verifiedOnly ? 'linear-gradient(90deg, #FF8A00, #FFD700)' : 'rgba(255,255,255,0.1)' }}
                >
                  <motion.div
                    animate={{ x: local.verifiedOnly ? 20 : 2 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    className="absolute top-1 w-4 h-4 rounded-full bg-white shadow"
                  />
                </button>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleReset}
                  className="flex-1 h-11 rounded-[16px] text-xs font-bold cursor-pointer"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#64748b' }}
                >
                  Reset
                </button>
                <button
                  onClick={handleApply}
                  className="flex-2 h-11 px-8 rounded-[16px] text-xs font-bold cursor-pointer text-white"
                  style={{ background: 'linear-gradient(135deg, #FF8A00, #FFD700)', boxShadow: '0 0 20px rgba(255,138,0,0.3)' }}
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
