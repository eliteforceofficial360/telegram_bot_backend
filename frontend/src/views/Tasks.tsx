import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Loader2, Send, Twitter, Globe, Compass, Play, Megaphone, Star, Lock, ExternalLink } from 'lucide-react';
import confetti from 'canvas-confetti';
import { subscribeToTasks, subscribeToUserTasks, claimTaskReward, checkTelegramMembership, type EForceTask, type TaskType } from '../lib/taskService';
import type { TelegramUser } from '../lib/telegramUser';
import { type AdminSettings } from '../lib/adminSettingsService';
import { showRewardedAd } from '../lib/monetag';
import { claimDailyAdVideoReward, syncPointsToFirestore, type FirestoreUser } from '../lib/userService';

interface TasksProps {
  efcBalance: number;
  setEfcBalance: (val: number | ((prev: number) => number)) => void;
  showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  telegramUser: TelegramUser | null;
  adminSettings: AdminSettings;
  dbUser: FirestoreUser | null;
}

const taskTypeIcon = (type: TaskType) => {
  switch (type) {
    case 'channel': return <Send size={14} />;
    case 'group':   return <Send size={14} />;
    case 'x':       return <Twitter size={14} />;
    case 'website': return <Globe size={14} />;
    case 'video':   return <Play size={14} />;
    case 'daily':   return <Compass size={14} />;
    case 'ad':      return <Megaphone size={14} />;
    default:        return <Star size={14} />;
  }
};

const taskTypeLabel = (type: TaskType) => {
  switch (type) {
    case 'channel': return 'Telegram Channel';
    case 'group':   return 'Telegram Group';
    case 'x':       return 'Follow on X';
    case 'website': return 'Visit Website';
    case 'video':   return 'Watch Video';
    case 'daily':   return 'Daily Mission';
    case 'ad':      return 'Reward Ad';
    default:        return 'Task';
  }
};

const taskTypeColor = (type: TaskType) => {
  switch (type) {
    case 'channel': return 'text-accent-cyan bg-accent-cyan/10 border-accent-cyan/20';
    case 'group':   return 'text-accent-cyan bg-accent-cyan/10 border-accent-cyan/20';
    case 'x':       return 'text-slate-300 bg-white/5 border-white/10';
    case 'website': return 'text-accent-blue bg-accent-blue/10 border-accent-blue/20';
    case 'video':   return 'text-accent-purple bg-accent-purple/10 border-accent-purple/20';
    case 'daily':   return 'text-[#FF8A00] bg-[#FF8A00]/10 border-[#FF8A00]/20';
    case 'ad':      return 'text-accent-success bg-accent-success/10 border-accent-success/20';
    default:        return 'text-slate-400 bg-white/5 border-white/10';
  }
};

type TaskStatus = 'idle' | 'verifying' | 'completed';

export const Tasks = ({ setEfcBalance, showToast, telegramUser, adminSettings, dbUser }: TasksProps) => {
  const [tasks, setTasks] = useState<EForceTask[]>([]);
  const [completedTaskIds, setCompletedTaskIds] = useState<Set<string>>(new Set());
  const [taskStatus, setTaskStatus] = useState<Record<string, TaskStatus>>({});
  const [taskSteps, setTaskSteps] = useState<Record<string, number>>({});
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'all' | TaskType>('all');

  // Subscribe to Firestore tasks (real-time)
  useEffect(() => {
    setLoadingTasks(true);
    const unsub = subscribeToTasks((t) => {
      setTasks(t);
      setLoadingTasks(false);
    });
    return unsub;
  }, []);

  // Subscribe to user's completed tasks (real-time)
  useEffect(() => {
    if (!telegramUser) return;
    const unsub = subscribeToUserTasks(telegramUser.id, (ids) => {
      setCompletedTaskIds(ids);
    });
    return unsub;
  }, [telegramUser]);

  const [openedOptionalUrls, setOpenedOptionalUrls] = useState<Record<string, boolean>>({});

  const handleStartOptionalTask = async (task: EForceTask) => {
    if (adminSettings.adEnabled) {
      try {
        showToast('Loading sponsored video...', 'info');
        await showRewardedAd(adminSettings.monetagZoneId, adminSettings.monetagDirectLink);
      } catch (err: any) {
        showToast(err.message || 'Ad dismissed. Complete the ad to start task!', 'error');
        return;
      }
    }
    if (task.url) {
      window.open(task.url, '_blank');
    }
    setOpenedOptionalUrls(prev => ({ ...prev, [task.id]: true }));
  };

  const handleTaskClick = async (task: EForceTask) => {
    if (!telegramUser) {
      showToast('Please open in Telegram to complete tasks.', 'warning');
      return;
    }
    const currentStatus = taskStatus[task.id] || 'idle';
    if (currentStatus !== 'idle' || completedTaskIds.has(task.id)) return;

    // Show rewarded ad first if configured globally in admin
    if (adminSettings.adEnabled) {
      try {
        showToast('Loading sponsored video...', 'info');
        await showRewardedAd(adminSettings.monetagZoneId, adminSettings.monetagDirectLink);
      } catch (err: any) {
        showToast(err.message || 'Ad dismissed. Complete the ad to verify!', 'error');
        return;
      }
    }

    // Open external URL if available
    if (task.url) {
      window.open(task.url, '_blank');
    }

    setTaskStatus(prev => ({ ...prev, [task.id]: 'verifying' }));

    // Verification delay (simulates checking join/follow)
    await new Promise(res => setTimeout(res, 2000));

    // For Telegram channel or group tasks, check membership via Telegram API
    if (task.type === 'channel' || task.type === 'group') {
      const checkRes = await checkTelegramMembership(
        telegramUser.id,
        task.url || adminSettings.botUsername || 'EliteForceChannel',
        adminSettings.botApiUrl
      );
      if (!checkRes.isMember) {
        setTaskStatus(prev => ({ ...prev, [task.id]: 'idle' }));
        showToast(checkRes.reason || 'You have not joined the Telegram channel/group yet!', 'error');
        return;
      }
    }

    const result = await claimTaskReward(telegramUser.id, task);

    if (result.success) {
      setTaskStatus(prev => ({ ...prev, [task.id]: 'completed' }));
      setEfcBalance(bal => {
        const newVal = bal + task.reward;
        syncPointsToFirestore(telegramUser.id, newVal).catch(() => {});
        return newVal;
      });
      showToast(`✅ Verified! +${task.reward.toLocaleString()} EFC Points earned!`, 'success');
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 }, colors: ['#FF8A00', '#00E5FF', '#B388FF'] });
    } else {
      setTaskStatus(prev => ({ ...prev, [task.id]: 'idle' }));
      showToast(result.reason || 'Verification failed. Try again.', 'error');
    }
  };

  const handleWatchAdStep = async (task: EForceTask) => {
    if (!telegramUser) return;
    try {
      showToast('Loading sponsored video...', 'info');
      const completed = await showRewardedAd(adminSettings.monetagZoneId, adminSettings.monetagDirectLink);
      if (completed) {
        setTaskSteps(prev => ({ ...prev, [task.id]: 2 }));
        showToast('Ad completed! Telegram link unlocked.', 'success');
      } else {
        showToast('Ad dismissed. Complete the ad to proceed!', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Ad dismissed. Complete the ad to proceed!', 'error');
    }
  };

  const handleJoinLinkStep = (task: EForceTask) => {
    if (task.url) {
      window.open(task.url, '_blank');
    }
    setTaskSteps(prev => ({ ...prev, [task.id]: 3 }));
    showToast('Task link opened. Click Verify to confirm membership.', 'info');
  };

  const handleVerifyStep = async (task: EForceTask) => {
    if (!telegramUser) return;
    setTaskStatus(prev => ({ ...prev, [task.id]: 'verifying' }));
    // Verification delay (simulates checking join/follow)
    await new Promise(res => setTimeout(res, 2000));

    // Check Telegram membership via API if channel/group task
    if (task.type === 'channel' || task.type === 'group') {
      const checkRes = await checkTelegramMembership(
        telegramUser.id,
        task.url || adminSettings.botUsername || 'EliteForceChannel',
        adminSettings.botApiUrl
      );
      if (!checkRes.isMember) {
        setTaskStatus(prev => ({ ...prev, [task.id]: 'idle' }));
        showToast(checkRes.reason || 'You have not joined the Telegram channel/group yet!', 'error');
        return;
      }
    }

    const result = await claimTaskReward(telegramUser.id, task);

    if (result.success) {
      setTaskStatus(prev => ({ ...prev, [task.id]: 'completed' }));
      setEfcBalance(bal => {
        const newVal = bal + task.reward;
        syncPointsToFirestore(telegramUser.id, newVal).catch(() => {});
        return newVal;
      });
      showToast(`✅ Verified! +${task.reward.toLocaleString()} EFC Points earned!`, 'success');
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 }, colors: ['#FF8A00', '#00E5FF', '#B388FF'] });
    } else {
      setTaskStatus(prev => ({ ...prev, [task.id]: 'idle' }));
      showToast(result.reason || 'Verification failed. Try again.', 'error');
    }
  };

  const [watchingDailyVideo, setWatchingDailyVideo] = useState(false);

  const handleWatchDailyVideo = async () => {
    if (!telegramUser) {
      showToast('Please open in Telegram to watch video ads.', 'warning');
      return;
    }

    if (!adminSettings.adEnabled) {
      showToast('Video ads system is currently offline.', 'info');
      return;
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const lastAdDate = dbUser?.dailyAdWatchDate || '';
    const adCount = lastAdDate === todayStr ? (dbUser?.dailyAdWatchCount || 0) : 0;
    const isPremium = !!telegramUser.isPremium;
    const limit = isPremium ? adminSettings.adDailyLimitPremium : adminSettings.adDailyLimitNormal;

    if (adCount >= limit) {
      showToast(`Daily limit of ${limit} ads reached!`, 'warning');
      return;
    }

    setWatchingDailyVideo(true);
    try {
      showToast('Loading sponsored video ad...', 'info');
      const completed = await showRewardedAd(adminSettings.monetagZoneId, adminSettings.monetagDirectLink);
      if (completed) {
        // Securely claim tokens from Firestore backend
        const result = await claimDailyAdVideoReward(
          telegramUser.id,
          isPremium,
          adminSettings.adTokenReward || 1,
          adminSettings.adDailyLimitNormal || 10,
          adminSettings.adDailyLimitPremium || 20
        );

        if (result.success) {
          showToast(`🎉 Ad completed! +${adminSettings.adTokenReward || 1} EForce Token added!`, 'success');
          confetti({ particleCount: 60, spread: 50, origin: { y: 0.65 }, colors: ['#00E5FF', '#B388FF'] });
        } else {
          showToast(result.reason || 'Verification failed.', 'error');
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Ad dismissed or skipped.', 'error');
    } finally {
      setWatchingDailyVideo(false);
    }
  };

  const isCompleted = (task: EForceTask) =>
    completedTaskIds.has(task.id) || taskStatus[task.id] === 'completed';

  const isExpired = (task: EForceTask) =>
    !!(task.expiryDate && new Date(task.expiryDate) < new Date());

  const isLimitReached = (task: EForceTask) =>
    task.totalCompletionLimit > 0 && task.completedCount >= task.totalCompletionLimit;

  const enabledTasks = tasks.filter(t => t.isEnabled);
  const taskTypes: Array<'all' | TaskType> = ['all', 'daily', 'channel', 'group', 'x', 'website', 'video', 'ad'];

  const filteredTasks = activeFilter === 'all'
    ? enabledTasks
    : enabledTasks.filter(t => t.type === activeFilter);

  const completedCount = enabledTasks.filter(t => isCompleted(t)).length;
  const totalRewards = enabledTasks
    .filter(t => isCompleted(t))
    .reduce((sum, t) => sum + t.reward, 0);

  const mandatoryTasks = filteredTasks.filter(t => t.isMandatory);
  const optionalTasks  = filteredTasks.filter(t => !t.isMandatory);
  const allMandatoryDone = mandatoryTasks.every(t => isCompleted(t));

  return (
    <div className="flex flex-col gap-5 pb-28">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Missions</h1>
        <p className="text-xs text-slate-400 mt-1">Complete tasks to earn EForce rewards</p>
      </div>

      {/* Header Banner (if set by Admin) */}
      {adminSettings.tasksBannerUrl && (
        <div className="w-full h-32 rounded-[22px] overflow-hidden border border-white/10 relative shadow-[0_12px_30px_rgba(0,0,0,0.5)]">
          <img src={adminSettings.tasksBannerUrl} alt="Tasks Banner" className="w-full h-full object-cover" />
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass-panel p-3.5 rounded-[18px] border-white/5 flex flex-col gap-1">
          <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Completed</span>
          <span className="text-lg font-black text-accent-success">{completedCount}/{enabledTasks.length}</span>
        </div>
        <div className="glass-panel p-3.5 rounded-[18px] border-white/5 flex flex-col gap-1">
          <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Earned Today</span>
          <span className="text-lg font-black text-[#FF8A00]">{totalRewards.toLocaleString()} EForce</span>
        </div>
      </div>

      {/* Filter Pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {taskTypes.map(type => (
          <button
            key={type}
            onClick={() => setActiveFilter(type)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all cursor-pointer ${
              activeFilter === type
                ? 'bg-[#FF8A00] border-[#FF8A00] text-white'
                : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
            }`}
          >
            {type === 'all' ? 'All' : taskTypeLabel(type as TaskType)}
          </button>
        ))}
      </div>

      {/* Task List */}
      {loadingTasks ? (
        <div className="flex flex-col items-center gap-3 py-12">
          <Loader2 size={24} className="text-accent-cyan animate-spin" />
          <span className="text-xs text-slate-500">Loading missions...</span>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="text-center py-12 text-slate-500 text-sm">
          No missions in this category yet.
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {/* ── Required Missions ── */}
          {mandatoryTasks.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-widest" style={{ color: '#FF8A00' }}>🔒 Required Missions</span>
                <span className="text-[9px] text-slate-500">({mandatoryTasks.filter(t => isCompleted(t)).length}/{mandatoryTasks.length} done)</span>
              </div>
              <div className="flex flex-col gap-3">
          <AnimatePresence>
            {mandatoryTasks.map((task, i) => {
              const status = taskStatus[task.id] || 'idle';
              const done = isCompleted(task);
              const expired = isExpired(task);
              const limitHit = isLimitReached(task);
              const isForceJoin = task.type === 'channel' || task.type === 'group';
              const startStep = (isForceJoin && adminSettings.adEnabled) ? 1 : 2;
              const currentStep = taskSteps[task.id] || startStep;

              return (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className={`glass-panel rounded-[20px] border-white/6 transition-all overflow-hidden ${
                    done ? 'opacity-60' : expired || limitHit ? 'opacity-40' : ''
                  }`}
                >
                  {/* Main task row */}
                  <div className="p-4 flex items-center gap-3.5">
                    {/* Icon */}
                    <div className={`w-10 h-10 rounded-[14px] flex items-center justify-center shrink-0 border ${taskTypeColor(task.type)}`}>
                      {taskTypeIcon(task.type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[11px] font-bold text-white truncate">{task.title}</span>
                        {task.url && !done && (
                          <ExternalLink size={10} className="text-slate-500 shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-bold uppercase tracking-wider border rounded-full px-1.5 py-0.5 ${taskTypeColor(task.type)}`}>
                          {taskTypeLabel(task.type)}
                        </span>
                        <span className="text-[10px] font-black text-[#FF8A00]">+{task.reward.toLocaleString()}</span>
                      </div>
                      {expired && <span className="text-[9px] text-accent-danger mt-0.5 block">Expired</span>}
                      {limitHit && !expired && <span className="text-[9px] text-slate-500 mt-0.5 block">Limit reached</span>}
                    </div>

                    {/* Action button (non-force-join) */}
                    {!isForceJoin && (() => {
                      if (done) return (
                        <button disabled className="shrink-0 w-20 h-8 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 bg-accent-success/15 text-accent-success border border-accent-success/25">
                          <Check size={12} /> Done
                        </button>
                      );
                      if (expired || limitHit) return (
                        <button disabled className="shrink-0 w-20 h-8 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 bg-white/5 text-slate-500 border border-white/10 cursor-not-allowed">
                          <Lock size={11} /> Closed
                        </button>
                      );
                      if (status === 'verifying') return (
                        <button disabled className="shrink-0 w-20 h-8 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 bg-white/5 text-slate-400 border border-white/10 cursor-wait">
                          <Loader2 size={12} className="animate-spin" /> Check
                        </button>
                      );
                      return (
                        <button
                          onClick={() => handleTaskClick(task)}
                          className="shrink-0 w-20 h-8 rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1 bg-[#FF8A00] hover:bg-[#FF8A00]/90 text-white shadow-[0_0_12px_rgba(255,138,0,0.25)] cursor-pointer"
                        >
                          Go
                        </button>
                      );
                    })()}

                    {/* Force Join: show step badge */}
                    {isForceJoin && (
                      done ? (
                        <button disabled className="shrink-0 w-20 h-8 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 bg-accent-success/15 text-accent-success border border-accent-success/25">
                          <Check size={12} /> Done
                        </button>
                      ) : expired || limitHit ? (
                        <button disabled className="shrink-0 w-20 h-8 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 bg-white/5 text-slate-500 border border-white/10 cursor-not-allowed">
                          <Lock size={11} /> Closed
                        </button>
                      ) : (
                        <div className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-xl border border-white/10 bg-white/5">
                          {[1, 2, 3].filter(s => adminSettings.adEnabled || s > 1).map(s => (
                            <div key={s} className={`w-1.5 h-1.5 rounded-full transition-all ${currentStep > s ? 'bg-accent-success' : currentStep === s ? 'bg-[#FF8A00] animate-pulse' : 'bg-white/20'}`} />
                          ))}
                          <span className="text-[8px] text-slate-400 font-bold ml-1">Step {currentStep - (adminSettings.adEnabled ? 0 : 1)}</span>
                        </div>
                      )
                    )}
                  </div>

                  {/* Force Join inline step panel */}
                  {isForceJoin && !done && !expired && !limitHit && (
                    <div className="border-t border-white/5 px-4 py-3 flex flex-col gap-2.5" style={{ background: 'rgba(255,138,0,0.03)' }}>
                      <div className="flex items-center gap-2 flex-wrap">

                        {/* Step 1: Watch Ad */}
                        {adminSettings.adEnabled && (
                          <button
                            onClick={() => handleWatchAdStep(task)}
                            disabled={currentStep !== 1}
                            className={`flex-1 h-9 rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                              currentStep === 1
                                ? 'bg-accent-purple/20 border-accent-purple/40 text-accent-purple hover:bg-accent-purple/30'
                                : currentStep > 1
                                ? 'bg-accent-success/10 border-accent-success/20 text-accent-success cursor-default'
                                : 'bg-white/5 border-white/10 text-slate-500 cursor-not-allowed'
                            }`}
                          >
                            {currentStep > 1 ? <Check size={10} /> : <Play size={10} />}
                            1. Watch Ad
                          </button>
                        )}

                        {/* Step 2: Join Channel */}
                        <button
                          onClick={() => handleJoinLinkStep(task)}
                          disabled={currentStep !== 2}
                          className={`flex-1 h-9 rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                            currentStep === 2
                              ? 'bg-accent-cyan/15 border-accent-cyan/35 text-accent-cyan hover:bg-accent-cyan/25'
                              : currentStep > 2
                              ? 'bg-accent-success/10 border-accent-success/20 text-accent-success cursor-default'
                              : 'bg-white/5 border-white/10 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          {currentStep > 2 ? <Check size={10} /> : <Send size={10} />}
                          {adminSettings.adEnabled ? '2.' : '1.'} Join Channel
                        </button>

                        {/* Step 3: Verify */}
                        <button
                          onClick={() => handleVerifyStep(task)}
                          disabled={currentStep !== 3 || status === 'verifying'}
                          className={`flex-1 h-9 rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                            status === 'verifying'
                              ? 'bg-[#FF8A00]/15 border-[#FF8A00]/30 text-[#FF8A00] cursor-wait'
                              : currentStep === 3
                              ? 'bg-[#FF8A00]/15 border-[#FF8A00]/30 text-[#FF8A00] hover:bg-[#FF8A00]/25'
                              : 'bg-white/5 border-white/10 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          {status === 'verifying' ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                          {adminSettings.adEnabled ? '3.' : '2.'} Verify
                        </button>
                      </div>

                      <p className="text-[9px] text-slate-500 text-center">
                        {currentStep === 1 ? '👁 Watch the sponsored ad to unlock the channel link' :
                         currentStep === 2 ? '📲 Open the channel and join, then come back to verify' :
                         status === 'verifying' ? '⏳ Checking your membership...' :
                         '✅ Click Verify to confirm and claim your reward'}
                      </p>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>

              </div>
            </div>
          )}

          {/* ── Optional Missions ── */}
          {optionalTasks.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-widest text-slate-400">⭐ Optional Missions</span>
                {!allMandatoryDone && mandatoryTasks.length > 0 && (
                  <span className="text-[9px] px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(255,138,0,0.1)', color: '#FF8A00', border: '1px solid rgba(255,138,0,0.25)' }}>Complete required first for bonus rewards</span>
                )}
              </div>
              <div className="flex flex-col gap-3">
                {/* Sponsored Video Ads (optional, always shown in all/ad filter) */}
                {adminSettings.adEnabled && (activeFilter === 'all' || activeFilter === 'ad') && (() => {
                  const todayStr = new Date().toISOString().slice(0, 10);
                  const lastAdDate = dbUser?.dailyAdWatchDate || '';
                  const adCount = lastAdDate === todayStr ? (dbUser?.dailyAdWatchCount || 0) : 0;
                  const isPremium = !!telegramUser?.isPremium;
                  const limit = isPremium ? (adminSettings.adDailyLimitPremium || 20) : (adminSettings.adDailyLimitNormal || 10);
                  const isLimitReached = adCount >= limit;
                  return (
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                      className={`glass-panel p-4 rounded-[20px] border-white/6 flex items-center gap-3.5 transition-all ${isLimitReached ? 'opacity-60' : ''}`}
                      style={{ background: 'linear-gradient(135deg, rgba(0, 229, 255, 0.05) 0%, rgba(0, 229, 255, 0.01) 100%)', borderColor: 'rgba(0, 229, 255, 0.15)' }}>
                      <div className="w-10 h-10 rounded-[14px] flex items-center justify-center shrink-0 border border-accent-cyan/20 bg-accent-cyan/10 text-accent-cyan"><Play size={14} className="fill-current" /></div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-black text-white mb-0.5">Daily Sponsored Video Ads {isPremium && <span className="text-[7px] font-black text-[#00E5FF] bg-[#00E5FF]/10 px-1 py-0.5 rounded border border-[#00E5FF]/20 uppercase ml-1">Premium Boost</span>}</div>
                        <div className="text-[9px] text-slate-400">Earn <span className="text-accent-purple font-black">+{adminSettings.adTokenReward || 1} EForce Token</span> per watch · {adCount}/{limit} today</div>
                      </div>
                      <button onClick={handleWatchDailyVideo} disabled={watchingDailyVideo || isLimitReached}
                        className={`shrink-0 w-24 h-8 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-all ${ isLimitReached ? 'bg-accent-success/15 text-accent-success border border-accent-success/25' : 'bg-gradient-to-r from-accent-cyan to-accent-blue text-white' }`}>
                        {isLimitReached ? (<><Check size={11} /> Done</>) : watchingDailyVideo ? (<><Loader2 size={10} className="animate-spin" /> Loading</>) : (<><Play size={10} /> Watch</>)}
                      </button>
                    </motion.div>
                  );
                })()}

                <AnimatePresence>
                  {optionalTasks.map((task, i) => {
                    const status = taskStatus[task.id] || 'idle';
                    const done = isCompleted(task);
                    const expired = isExpired(task);
                    const limitHit = isLimitReached(task);
                    return (
                      <motion.div key={task.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                        className={`glass-panel rounded-[20px] border-white/6 transition-all overflow-hidden ${ done ? 'opacity-60' : expired || limitHit ? 'opacity-40' : '' }`}>
                        <div className="p-4 flex items-center gap-3.5">
                          <div className={`w-10 h-10 rounded-[14px] flex items-center justify-center shrink-0 border ${taskTypeColor(task.type)}`}>{taskTypeIcon(task.type)}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="text-[11px] font-bold text-white truncate">{task.title}</span>
                              {task.url && !done && <ExternalLink size={10} className="text-slate-500 shrink-0" />}
                            </div>
                            <span className={`text-[9px] font-bold uppercase tracking-wider border rounded-full px-1.5 py-0.5 ${taskTypeColor(task.type)}`}>{taskTypeLabel(task.type)}</span>
                          </div>
                          <div className="shrink-0">
                            {done ? (
                              <button disabled className="w-20 h-8 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 bg-accent-success/15 text-accent-success border border-accent-success/25"><Check size={12} /> Done</button>
                            ) : expired || limitHit ? (
                              <button disabled className="w-20 h-8 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 bg-white/5 text-slate-500 border border-white/10 cursor-not-allowed"><Lock size={11} /> Closed</button>
                            ) : !openedOptionalUrls[task.id] && task.url ? (
                              <button onClick={() => handleStartOptionalTask(task)}
                                className="w-20 h-8 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-all"
                                style={{ background: 'linear-gradient(135deg, #FF8A00, #E52E71)', color: '#fff' }}>
                                Start
                              </button>
                            ) : (
                              <button onClick={() => handleVerifyStep(task)} disabled={status === 'verifying'}
                                className="w-20 h-8 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-all border border-accent-success/20 bg-accent-success/5 text-accent-success"
                              >
                                {status === 'verifying' ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                                {status === 'verifying' ? 'Verifying' : 'Verify'}
                              </button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
};
