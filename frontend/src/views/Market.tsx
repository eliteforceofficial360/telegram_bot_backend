import React, { useState, useEffect, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Search, SlidersHorizontal, Plus, RefreshCw, Store, Clock, Sparkles, Layers } from 'lucide-react';
import {
  type MarketTask, type TaskSubmission, type DiscoverFilters,
  fetchDiscoverTasks, fetchMyTasks, fetchCreatedTasks,
} from '../lib/marketService';
import { CategoryPills } from './market/components/CategoryPills';
import { MarketTaskCard, FeaturedTaskCard, SkeletonCard } from './market/components/MarketTaskCard';
import { FilterDrawer } from './market/components/FilterDrawer';
import { TaskBuilder } from './market/TaskBuilder';
import { TaskDetailView } from './market/TaskDetailView';
import { type TelegramUser } from '../lib/telegramUser';

interface MarketProps {
  efcBalance: number;
  setEfcBalance: React.Dispatch<React.SetStateAction<number>>;
  telegramUser: TelegramUser | null;
  adminSettings: any;
  showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  setActiveTab: (tab: string) => void;
}

type MarketTab = 'discover' | 'my_tasks' | 'created' | 'completed' | 'history';

export const Market: React.FC<MarketProps> = ({
  efcBalance, telegramUser, showToast,
}) => {
  const [activeTab, setActiveTabLocal] = useState<MarketTab>('discover');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [filters, setFilters] = useState<DiscoverFilters>({ sort: 'newest' });

  // Data states
  const [discoverTasks, setDiscoverTasks] = useState<MarketTask[]>([]);
  const [myTasks, setMyTasks] = useState<TaskSubmission[]>([]);
  const [createdTasks, setCreatedTasks] = useState<MarketTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modals
  const [taskBuilderOpen, setTaskBuilderOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<MarketTask | null>(null);

  // Load discover tasks
  const loadDiscover = useCallback(async () => {
    setLoading(true);
    const activePlatform = selectedCategory !== 'all' ? selectedCategory : undefined;
    const res = await fetchDiscoverTasks({
      ...filters,
      platform: activePlatform,
      search: searchQuery || undefined,
    });
    setDiscoverTasks(res.tasks);
    setLoading(false);
  }, [selectedCategory, filters, searchQuery]);

  // Load My Tasks
  const loadMyTasks = useCallback(async () => {
    if (!telegramUser) return;
    setLoading(true);
    const tasks = await fetchMyTasks(telegramUser.id);
    setMyTasks(tasks);
    setLoading(false);
  }, [telegramUser]);

  // Load Created Tasks
  const loadCreated = useCallback(async () => {
    if (!telegramUser) return;
    setLoading(true);
    const tasks = await fetchCreatedTasks(telegramUser.id);
    setCreatedTasks(tasks);
    setLoading(false);
  }, [telegramUser]);

  useEffect(() => {
    if (activeTab === 'discover') loadDiscover();
    else if (activeTab === 'my_tasks') loadMyTasks();
    else if (activeTab === 'created') loadCreated();
  }, [activeTab, loadDiscover, loadMyTasks, loadCreated]);

  const handleRefresh = async () => {
    setRefreshing(true);
    if (activeTab === 'discover') await loadDiscover();
    else if (activeTab === 'my_tasks') await loadMyTasks();
    else if (activeTab === 'created') await loadCreated();
    setRefreshing(false);
    showToast('Market refreshed', 'info');
  };

  const featuredTask = discoverTasks.find(t => t.featured) || discoverTasks[0];

  return (
    <div className="flex flex-col h-full space-y-4 pb-20 relative select-none">
      {/* ── Top Header ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pt-2 px-1">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-2xl flex items-center justify-center text-lg"
            style={{
              background: 'linear-gradient(135deg, rgba(255,215,0,0.2), rgba(255,138,0,0.1))',
              border: '1px solid rgba(255,215,0,0.3)',
              boxShadow: '0 0 15px rgba(255,215,0,0.2)',
            }}>
            🏪
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight text-white flex items-center gap-1.5">
              Task Market
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(255,215,0,0.15)', color: '#FFD700', border: '1px solid rgba(255,215,0,0.3)' }}>
                PRO
              </span>
            </h1>
            <p className="text-[10px] text-slate-400">P2P Sponsored Campaign Hub</p>
          </div>
        </div>

        {/* Action button: Refresh & Create */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setTaskBuilderOpen(true)}
            className="h-8 px-3 rounded-xl text-xs font-black text-black flex items-center gap-1 cursor-pointer transition-all shadow-lg"
            style={{
              background: 'linear-gradient(135deg, #FFD700, #FF8A00)',
              boxShadow: '0 0 15px rgba(255,138,0,0.3)',
            }}
          >
            <Plus size={14} /> Create
          </button>
        </div>
      </div>

      {/* ── Sub Navigation Tabs ───────────────────────────────────────────── */}
      <div className="flex items-center gap-1 p-1 rounded-[16px] bg-white/[0.04] border border-white/8">
        {[
          { id: 'discover', label: 'Discover' },
          { id: 'my_tasks', label: 'My Tasks' },
          { id: 'created', label: 'Created' },
          { id: 'completed', label: 'Completed' },
          { id: 'history', label: 'History' },
        ].map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTabLocal(tab.id as MarketTab)}
              className="flex-1 py-1.5 text-[10px] font-bold rounded-[12px] transition-all text-center cursor-pointer relative"
              style={{
                color: isActive ? '#FFD700' : '#64748b',
                background: isActive ? 'rgba(255,215,0,0.12)' : 'transparent',
                border: isActive ? '1px solid rgba(255,215,0,0.25)' : '1px solid transparent',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── DISCOVER TAB CONTENT ─────────────────────────────────────────── */}
      {activeTab === 'discover' && (
        <div className="space-y-4">
          {/* Search bar & filter trigger */}
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-[16px] bg-white/[0.04] border border-white/8">
              <Search size={14} className="text-slate-500" />
              <input
                type="text"
                placeholder="Search market tasks..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full text-xs text-white bg-transparent focus:outline-none placeholder-slate-600"
              />
            </div>
            <button
              onClick={() => setFilterDrawerOpen(true)}
              className="p-2.5 rounded-[16px] bg-white/[0.04] border border-white/8 text-slate-400 hover:text-white cursor-pointer"
            >
              <SlidersHorizontal size={16} />
            </button>
          </div>

          {/* Categories */}
          <CategoryPills
            selected={selectedCategory}
            onSelect={cat => setSelectedCategory(cat)}
          />

          {/* Featured Campaign */}
          {!loading && featuredTask && (
            <div>
              <FeaturedTaskCard task={featuredTask} onClick={task => setSelectedTask(task)} />
            </div>
          )}

          {/* Tasks List */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                Available Campaigns ({discoverTasks.length})
              </h3>
            </div>

            {loading ? (
              <div className="space-y-2">
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </div>
            ) : discoverTasks.length === 0 ? (
              <div className="text-center py-10 rounded-[24px] bg-white/[0.02] border border-white/5 space-y-2">
                <Store size={32} className="mx-auto text-slate-600 mb-1" />
                <p className="text-xs font-bold text-slate-400">No campaigns found</p>
                <p className="text-[10px] text-slate-600">Be the first to sponsor a task in this category!</p>
              </div>
            ) : (
              discoverTasks.map(task => (
                <MarketTaskCard key={task.id} task={task} onClick={t => setSelectedTask(t)} />
              ))
            )}
          </div>
        </div>
      )}

      {/* ── MY TASKS TAB ─────────────────────────────────────────────────── */}
      {activeTab === 'my_tasks' && (
        <div className="space-y-3">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Your Started & Submitted Tasks</h3>

          {loading ? (
            <SkeletonCard />
          ) : myTasks.length === 0 ? (
            <div className="text-center py-12 rounded-[24px] bg-white/[0.02] border border-white/5 space-y-2">
              <Clock size={32} className="mx-auto text-slate-600" />
              <p className="text-xs font-bold text-slate-400">No active tasks</p>
              <p className="text-[10px] text-slate-600">Explore the Discover tab to start earning EFC!</p>
            </div>
          ) : (
            myTasks.map(sub => (
              <div key={sub.id} className="p-4 rounded-[20px] bg-white/[0.04] border border-white/8 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-[#FF8A00] uppercase">{sub.platform}</span>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                    sub.status === 'approved' ? 'bg-[#00FF88]/15 text-[#00FF88] border border-[#00FF88]/30' :
                    sub.status === 'rejected' ? 'bg-[#FF4D6D]/15 text-[#FF4D6D] border border-[#FF4D6D]/30' :
                    'bg-[#FFC857]/15 text-[#FFC857] border border-[#FFC857]/30'
                  }`}>
                    {sub.status}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-white">{sub.taskTitle}</h4>
                <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1">
                  <span>Submitted: {new Date(sub.createdAt).toLocaleDateString()}</span>
                  <span className="font-bold text-[#FFD700]">+{sub.reward} EFC</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── CREATED TASKS TAB ────────────────────────────────────────────── */}
      {activeTab === 'created' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Your Created Campaigns</h3>
            <button
              onClick={() => setTaskBuilderOpen(true)}
              className="text-[10px] font-bold text-[#FFD700] underline cursor-pointer"
            >
              + Create New
            </button>
          </div>

          {loading ? (
            <SkeletonCard />
          ) : createdTasks.length === 0 ? (
            <div className="text-center py-12 rounded-[24px] bg-white/[0.02] border border-white/5 space-y-2">
              <Layers size={32} className="mx-auto text-slate-600" />
              <p className="text-xs font-bold text-slate-400">You haven't created any campaigns</p>
              <p className="text-[10px] text-slate-600">Sponsor a task to grow your community or social channel!</p>
            </div>
          ) : (
            createdTasks.map(ct => (
              <div key={ct.id} className="p-4 rounded-[20px] bg-white/[0.04] border border-white/8 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-[#FF8A00] uppercase">{ct.platform} · {ct.action}</span>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                    ct.status === 'active' ? 'bg-[#00FF88]/15 text-[#00FF88]' :
                    ct.status === 'paused' ? 'bg-[#FFC857]/15 text-[#FFC857]' : 'bg-slate-700 text-slate-300'
                  }`}>
                    {ct.status}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-white">{ct.title}</h4>
                <div className="grid grid-cols-3 gap-2 py-2 border-y border-white/5 text-center">
                  <div>
                    <div className="text-[8px] text-slate-500 uppercase">Workers</div>
                    <div className="text-xs font-bold text-white">{ct.completedCount} / {ct.workerLimit}</div>
                  </div>
                  <div>
                    <div className="text-[8px] text-slate-500 uppercase">Reward</div>
                    <div className="text-xs font-bold text-[#FFD700]">{ct.reward} EFC</div>
                  </div>
                  <div>
                    <div className="text-[8px] text-slate-500 uppercase">Status</div>
                    <div className="text-xs font-bold text-slate-300">{ct.remainingSlots} left</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── COMPLETED & HISTORY STUBS ─────────────────────────────────────── */}
      {(activeTab === 'completed' || activeTab === 'history') && (
        <div className="text-center py-16 rounded-[24px] bg-white/[0.02] border border-white/5 space-y-2">
          <Sparkles size={32} className="mx-auto text-[#FFD700]/50" />
          <p className="text-xs font-bold text-slate-300">History Log</p>
          <p className="text-[10px] text-slate-500">Your completed activity records will accumulate here.</p>
        </div>
      )}

      {/* ── Filter Drawer ─────────────────────────────────────────────────── */}
      <FilterDrawer
        open={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        filters={filters}
        onApply={newF => { setFilters(newF); loadDiscover(); }}
      />

      {/* ── Task Builder Modal ────────────────────────────────────────────── */}
      <AnimatePresence>
        {taskBuilderOpen && (
          <TaskBuilder
            onClose={() => setTaskBuilderOpen(false)}
            telegramUser={telegramUser}
            efcBalance={efcBalance}
            showToast={showToast}
            onCreated={() => { loadDiscover(); loadCreated(); }}
          />
        )}
      </AnimatePresence>

      {/* ── Task Detail Modal ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedTask && (
          <TaskDetailView
            task={selectedTask}
            onClose={() => setSelectedTask(null)}
            telegramUser={telegramUser}
            showToast={showToast}
            onSubmitted={() => { loadDiscover(); loadMyTasks(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
