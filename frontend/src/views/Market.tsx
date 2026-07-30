import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, SlidersHorizontal, Plus, RefreshCw, Store, Clock, Sparkles, Layers, ShieldAlert, Bell, Home } from 'lucide-react';
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
  usdtBalance?: number;
  setUsdtBalance?: React.Dispatch<React.SetStateAction<number>>;
  telegramUser: TelegramUser | null;
  adminSettings: any;
  showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  setActiveTab: (tab: string) => void;
  initialTab?: MarketTab;
  autoOpenCreate?: boolean;
  resetAutoOpenCreate?: () => void;
}

type MarketTab = 'discover' | 'my_tasks' | 'created' | 'completed' | 'history';

const MarketMaintenanceOverlay: React.FC<{
  adminSettings: any;
  setActiveTab: (tab: string) => void;
  showToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}> = ({ adminSettings, setActiveTab, showToast }) => {
  const status = adminSettings?.marketStatus || 'off';
  const until = adminSettings?.marketMaintenanceUntil;
  const reason = adminSettings?.marketLockReason || 'Task Market is currently undergoing maintenance and security checks.';

  const [timeLeftStr, setTimeLeftStr] = useState<string>('');
  const [reminderSet, setReminderSet] = useState<boolean>(() => {
    return localStorage.getItem('market_reminder_set') === 'true';
  });

  useEffect(() => {
    if (!until) return;
    const updateTimer = () => {
      const diff = new Date(until).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeftStr('00:00:00');
        return;
      }
      const hrs = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeftStr(
        `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
      );
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [until]);

  const toggleReminder = () => {
    const next = !reminderSet;
    setReminderSet(next);
    localStorage.setItem('market_reminder_set', next ? 'true' : 'false');
    if (next) {
      showToast('🔔 Reminder set! We will notify you when Market unlocks.', 'success');
    } else {
      showToast('Reminder cancelled.', 'info');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center select-none">
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-sm rounded-[28px] p-6 space-y-5 relative overflow-hidden"
        style={{
          background: 'linear-gradient(145deg, rgba(20,24,40,0.92) 0%, rgba(10,12,24,0.95) 100%)',
          border: '1.5px solid rgba(255,215,0,0.25)',
          boxShadow: '0 20px 50px rgba(0,0,0,0.6), 0 0 30px rgba(255,215,0,0.1)',
        }}
      >
        {/* Ambient Glow */}
        <div
          className="absolute -top-20 left-1/2 -translate-x-1/2 w-40 h-40 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(255,215,0,0.25) 0%, transparent 70%)' }}
        />

        {/* Lock Shield */}
        <div className="relative mx-auto w-20 h-20 rounded-3xl flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, rgba(255,215,0,0.2), rgba(255,138,0,0.1))',
            border: '1.5px solid rgba(255,215,0,0.4)',
            boxShadow: '0 0 25px rgba(255,215,0,0.25)',
          }}>
          <ShieldAlert size={38} color="#FFD700" />
        </div>

        {/* Status Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest"
          style={{
            background: 'rgba(255,215,0,0.12)',
            border: '1px solid rgba(255,215,0,0.3)',
            color: '#FFD700',
          }}>
          {status === 'maintenance' ? '⏳ SCHEDULED MAINTENANCE' : '🔒 MARKET TEMPORARILY LOCKED'}
        </div>

        <div>
          <h2 className="text-lg font-black text-white tracking-tight mb-1">
            Task Market is Locked
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed px-2">
            {reason}
          </p>
        </div>

        {/* Countdown Display */}
        {until && (
          <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 space-y-1">
            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
              Estimated Unlock Countdown
            </div>
            <div className="text-2xl font-black font-mono tracking-widest"
              style={{ color: '#FFD700', textShadow: '0 0 15px rgba(255,215,0,0.4)' }}>
              {timeLeftStr || '00:00:00'}
            </div>
            <div className="text-[9px] text-slate-500">
              Unlocks at: {new Date(until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2 pt-1">
          {until && (
            <button
              onClick={toggleReminder}
              className="w-full py-3 rounded-2xl text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer transition-all"
              style={{
                background: reminderSet ? 'rgba(0,255,136,0.15)' : 'rgba(255,215,0,0.15)',
                border: reminderSet ? '1px solid rgba(0,255,136,0.4)' : '1px solid rgba(255,215,0,0.35)',
                color: reminderSet ? '#00FF88' : '#FFD700',
              }}
            >
              <Bell size={14} />
              {reminderSet ? '✓ Reminder Active' : '🔔 Remind Me When Live'}
            </button>
          )}

          <button
            onClick={() => setActiveTab('home')}
            className="w-full py-3 rounded-2xl text-xs font-bold text-slate-400 hover:text-white bg-white/5 border border-white/8 transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Home size={14} /> Return to Home
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export const Market: React.FC<MarketProps> = ({
  efcBalance,
  setEfcBalance,
  usdtBalance,
  setUsdtBalance,
  telegramUser,
  showToast,
  adminSettings,
  setActiveTab,
  initialTab,
  autoOpenCreate,
  resetAutoOpenCreate,
}) => {
  const [activeTab, setActiveTabLocal] = useState<MarketTab>(initialTab || 'discover');
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

  // Sync initialTab prop when component receives routing instructions
  useEffect(() => {
    if (initialTab) {
      setActiveTabLocal(initialTab);
    }
  }, [initialTab]);

  // Sync autoOpenCreate prop when component receives auto-create trigger
  useEffect(() => {
    if (autoOpenCreate) {
      setTaskBuilderOpen(true);
      if (resetAutoOpenCreate) {
        resetAutoOpenCreate();
      }
    }
  }, [autoOpenCreate, resetAutoOpenCreate]);

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

  const marketStatus = adminSettings?.marketStatus || 'on';
  const marketUntil = adminSettings?.marketMaintenanceUntil;
  const isMarketLocked =
    marketStatus === 'off' ||
    (marketStatus === 'maintenance' && marketUntil && new Date(marketUntil).getTime() > Date.now());

  if (isMarketLocked) {
    return (
      <MarketMaintenanceOverlay
        adminSettings={adminSettings}
        setActiveTab={setActiveTab}
        showToast={showToast}
      />
    );
  }

  return (
    <div className="flex flex-col h-full space-y-4 pb-20 relative select-none">
      {/* ── Top Header ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pt-2 px-1">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-2xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, rgba(255,215,0,0.2), rgba(255,138,0,0.1))',
              border: '1px solid rgba(255,215,0,0.3)',
              boxShadow: '0 0 15px rgba(255,215,0,0.2)',
            }}>
            <Store size={18} color="#FFD700" />
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
              <FeaturedTaskCard task={featuredTask} onClick={task => {
                setSelectedTask(task);
                if (setActiveTab) setActiveTab('tasks');
              }} />
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
                <MarketTaskCard key={task.id} task={task} onClick={t => {
                  setSelectedTask(t);
                  if (setActiveTab) setActiveTab('tasks');
                }} />
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
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${sub.status === 'approved' ? 'bg-[#00FF88]/15 text-[#00FF88] border border-[#00FF88]/30' :
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
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${ct.status === 'active' ? 'bg-[#00FF88]/15 text-[#00FF88]' :
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
            setEfcBalance={setEfcBalance}
            usdtBalance={usdtBalance ?? 0}
            setUsdtBalance={setUsdtBalance}
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
