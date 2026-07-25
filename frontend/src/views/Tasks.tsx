import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  Loader2,
  Send,
  Twitter,
  Play,
  Lock,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Zap,
  Plus,
  AlertTriangle,
  Layers,
  Image as ImageIcon,
  ShieldCheck,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  subscribeToTasks,
  subscribeToUserTasks,
  claimTaskReward,
  checkTelegramMembership,
  verifyTaskWithServer,
  createUserCampaignTask,
  subscribeToUserCreatedTasks,
  updateUserCampaignStatus,
  type EForceTask,
} from '../lib/taskService';
import type { TelegramUser } from '../lib/telegramUser';
import { type AdminSettings } from '../lib/adminSettingsService';
import { showRewardedAd } from '../lib/monetag';
import { claimDailyAdVideoReward, syncPointsToFirestore, syncTokensToFirestore, type FirestoreUser } from '../lib/userService';

interface TasksProps {
  efcBalance: number;
  setEfcBalance: (val: number | ((prev: number) => number)) => void;
  eforceTokens?: number;
  setEforceTokens?: (val: number | ((prev: number) => number)) => void;
  showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  telegramUser: TelegramUser | null;
  adminSettings: AdminSettings;
  dbUser: FirestoreUser | null;
  setActiveTab?: (tab: string) => void;
}

type TaskStatus = 'idle' | 'verifying' | 'completed';

export const Tasks = ({
  efcBalance: _efcBalance,
  setEfcBalance,
  eforceTokens: _eforceTokens,
  setEforceTokens,
  showToast,
  telegramUser,
  adminSettings,
  dbUser,
  setActiveTab,
}: TasksProps) => {
  const [tasks, setTasks] = useState<EForceTask[]>([]);
  const [completedTaskIds, setCompletedTaskIds] = useState<Set<string>>(new Set());
  const [taskStatus, setTaskStatus] = useState<Record<string, TaskStatus>>({});
  const [taskSteps, setTaskSteps] = useState<Record<string, number>>({});
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizErrors, setQuizErrors] = useState<Record<string, string>>({});
  const [taskCooldowns, setTaskCooldowns] = useState<Record<string, number>>({});
  const [loadingTasks, setLoadingTasks] = useState(true);

  // ── Navigation & Campaign Builder States ─────────────────────────────────────
  const [mainTab, setMainTab] = useState<'earn' | 'my_tasks' | 'create'>('earn');

  // User Created Tasks Subscription
  const [userCreatedTasks, setUserCreatedTasks] = useState<EForceTask[]>([]);
  useEffect(() => {
    if (!telegramUser) return;
    const unsub = subscribeToUserCreatedTasks(telegramUser.id, (tList) => {
      setUserCreatedTasks(tList);
    });
    return unsub;
  }, [telegramUser]);

  // Campaign Builder Form States (Matching Screenshots Design System)
  const [selectedPlatform, setSelectedPlatform] = useState<string>('x');
  const [selectedActions, setSelectedActions] = useState<Record<string, boolean>>({ follow: true });
  const [targetUrl, setTargetUrl] = useState<string>('https://x.com/EliteForceOFC');
  const [rewardPerEach, setRewardPerEach] = useState<number>(5);
  const [quantity, setQuantity] = useState<number>(10);
  const [expiresDays, setExpiresDays] = useState<number>(7);
  const [minTier, setMinTier] = useState<'stone' | 'bronze' | 'silver' | 'gold'>('stone');
  const [verifiedOnly, setVerifiedOnly] = useState<boolean>(false);
  const [customTitle, setCustomTitle] = useState<string>('');
  const [customDescription, setCustomDescription] = useState<string>('');
  const [customNoteToReviewers, setCustomNoteToReviewers] = useState<string>('');
  const [startPaused, setStartPaused] = useState<boolean>(false);
  const [stepsChecklist, _setStepsChecklist] = useState<string[]>(['']);
  const [inputFields, _setInputFields] = useState<string[]>(['']);
  const [isCreatingCampaign, setIsCreatingCampaign] = useState<boolean>(false);

  const platformsList = [
    { id: 'x', label: 'X', icon: '𝕏' },
    { id: 'instagram', label: 'Instagram', icon: '📷' },
    { id: 'telegram', label: 'Telegram', icon: '✈️' },
    { id: 'whatsapp', label: 'WhatsApp', icon: '💬' },
    { id: 'discord', label: 'Discord', icon: '👾' },
    { id: 'tiktok', label: 'TikTok', icon: '🎵' },
    { id: 'youtube', label: 'YouTube', icon: '▶️' },
    { id: 'reddit', label: 'Reddit', icon: '🤖' },
    { id: 'google', label: 'Google', icon: '🔍' },
    { id: 'apps', label: 'Apps', icon: '📥' },
    { id: 'custom', label: 'Custom', icon: '✏️' },
  ];

  // Escrow Calculations
  const rewardEach = Math.max(1, Number(rewardPerEach) || 5);
  const howMany = Math.max(1, Number(quantity) || 1);
  const baseSubtotal = rewardEach * howMany;
  const serviceFee = Math.round(baseSubtotal * 0.25 * 10) / 10;
  const tierCost = minTier === 'silver' ? 1 * howMany : minTier === 'gold' ? 2 * howMany : 0;
  const verificationCost = verifiedOnly ? 1.5 * howMany : 0;
  const reviewFee = selectedPlatform === 'custom' ? 10 : 0;
  const totalEscrowRequired = Math.ceil(baseSubtotal + serviceFee + tierCost + verificationCost + reviewFee);

  const currentBalance = dbUser?.points ?? _efcBalance ?? 0;
  const balanceAfter = currentBalance - totalEscrowRequired;
  const isInsufficientBalance = balanceAfter < 0;

  const handleCreateCampaign = async () => {
    if (!telegramUser) {
      showToast('Please open in Telegram to create tasks.', 'warning');
      return;
    }

    if (!targetUrl.trim()) {
      showToast('Please enter a target URL for your task.', 'warning');
      return;
    }

    if (selectedPlatform === 'custom' && !customTitle.trim()) {
      showToast('Please enter a short title for your custom task.', 'warning');
      return;
    }

    if (isInsufficientBalance) {
      showToast(`Insufficient EFC balance. Needed: ${totalEscrowRequired} EFC, Available: ${currentBalance} EFC`, 'error');
      return;
    }

    setIsCreatingCampaign(true);

    const actionKeys = Object.keys(selectedActions).filter((k) => selectedActions[k]);
    const actionLabel = actionKeys.length > 0 ? actionKeys.join(', ') : 'Task';
    const finalTitle =
      selectedPlatform === 'custom'
        ? customTitle.trim()
        : `${selectedPlatform.toUpperCase()} ${actionLabel} Campaign`;

    const finalDescription =
      selectedPlatform === 'custom'
        ? customDescription.trim()
        : `Complete ${actionLabel} on ${targetUrl.trim()}`;

    const expiryDateObj = new Date();
    expiryDateObj.setDate(expiryDateObj.getDate() + (Number(expiresDays) || 7));

    const taskData: Omit<EForceTask, 'id' | 'completedCount' | 'createdAt'> = {
      title: finalTitle,
      description: finalDescription,
      type: (selectedPlatform === 'x' ? 'x' : selectedPlatform === 'telegram' ? 'channel' : 'website') as any,
      reward: rewardEach,
      tokenReward: 0,
      isEnabled: !startPaused,
      isMandatory: false,
      autoApprove: selectedPlatform !== 'custom',
      url: targetUrl.trim(),
      dailyLimit: 0,
      totalCompletionLimit: howMany,
      expiryDate: expiryDateObj.toISOString(),
      createdBy: telegramUser.id,
      createdByName: `${telegramUser.firstName || ''} ${telegramUser.lastName || ''}`.trim() || 'User',
      status: selectedPlatform === 'custom' ? 'under_review' : startPaused ? 'paused' : 'active',
      escrowedAmount: totalEscrowRequired,
      quantityTotal: howMany,
      platform: selectedPlatform,
      actionType: actionLabel,
      minTier: minTier,
      verifiedOnly: verifiedOnly,
      stepsChecklist: stepsChecklist.filter((s) => s.trim().length > 0),
      inputFields: inputFields.filter((f) => f.trim().length > 0),
      noteToReviewers: customNoteToReviewers.trim(),
    };

    const res = await createUserCampaignTask(telegramUser.id, taskData, totalEscrowRequired);
    setIsCreatingCampaign(false);

    if (res.success) {
      setEfcBalance((prev) => Math.max(0, prev - totalEscrowRequired));
      showToast(`🎉 Campaign Created! ${totalEscrowRequired} EFC escrowed.`, 'success');
      confetti({ particleCount: 25, spread: 50, origin: { y: 0.6 } });

      setTargetUrl('https://x.com/EliteForceOFC');
      setCustomTitle('');
      setCustomDescription('');
      setMainTab('my_tasks');
    } else {
      showToast(res.reason || 'Failed to create campaign. Please try again.', 'error');
    }
  };

  // Cooldown countdown timer for interrupted task ads
  useEffect(() => {
    const hasCooldowns = Object.values(taskCooldowns).some((c) => c > 0);
    if (!hasCooldowns) return;

    const timer = setInterval(() => {
      setTaskCooldowns((prev) => {
        const next: Record<string, number> = {};
        Object.entries(prev).forEach(([id, sec]) => {
          if (sec > 0) next[id] = sec - 1;
        });
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [taskCooldowns]);

  // Accordion Expand/Collapse States
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    x: true,
    discord: true,
    video: true,
    telegram: true,
    general: true,
  });
  const [expandedSubCats, setExpandedSubCats] = useState<Record<string, boolean>>({});

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

  const toggleCategory = (catId: string) => {
    setExpandedCategories((prev) => ({ ...prev, [catId]: !prev[catId] }));
  };

  const toggleSubCat = (subKey: string) => {
    setExpandedSubCats((prev) => ({ ...prev, [subKey]: !prev[subKey] }));
  };

  const isCompleted = (task: EForceTask) =>
    completedTaskIds.has(task.id) || taskStatus[task.id] === 'completed';

  const isExpired = (task: EForceTask) =>
    !!(task.expiryDate && new Date(task.expiryDate) < new Date());

  const isLimitReached = (task: EForceTask) =>
    task.totalCompletionLimit > 0 && task.completedCount >= task.totalCompletionLimit;

  // Campaign Task Verification Handler
  const handleTaskClick = async (task: EForceTask) => {
    if (!telegramUser) {
      showToast('Please open in Telegram to complete tasks.', 'warning');
      return;
    }

    // 1. Prevent Duplicate Rewards
    if (isCompleted(task)) {
      showToast('Task Already Completed', 'info');
      return;
    }

    // 2. Check Cooldown
    if (taskCooldowns[task.id] > 0) {
      showToast(`Verification Interrupted: Please wait ${taskCooldowns[task.id]}s before trying again.`, 'warning');
      return;
    }

    const currentStatus = taskStatus[task.id] || 'idle';
    if (currentStatus !== 'idle') return;

    // 3. Quiz / Answer Validation (if applicable)
    const userAnswer = (quizAnswers[task.id] || '').trim();
    if (task.answer && task.answer.trim()) {
      if (!userAnswer) {
        setQuizErrors((prev) => ({ ...prev, [task.id]: 'Please enter your answer before verifying.' }));
        showToast('Please enter your answer before verifying.', 'warning');
        return;
      }

      const expected = task.answer.trim();
      const isMatch = task.answerCaseSensitive ? expected === userAnswer : expected.toLowerCase() === userAnswer.toLowerCase();
      if (!isMatch) {
        setQuizErrors((prev) => ({ ...prev, [task.id]: '❌ Incorrect Answer. Please check your answer and try again.' }));
        showToast('❌ Incorrect Answer. Please check your answer and try again.', 'error');
        return; // NO AD SHOWN!
      } else {
        setQuizErrors((prev) => ({ ...prev, [task.id]: '' }));
      }
    }

    // 4. Social Connection Verification (username-based, server-side — no OAuth)
    const inferPlatform = (t: EForceTask): string => {
      if (t.requireSocialConnection && t.requireSocialConnection !== 'none') {
        return t.requireSocialConnection.toLowerCase();
      }
      const typeStr = (t.type || '').toLowerCase();
      const platformStr = ((t as any).platform || '').toLowerCase();
      const titleStr = (t.title || '').toLowerCase();
      const urlStr = (t.url || '').toLowerCase();

      if (typeStr.includes('x') || typeStr.includes('twitter') || platformStr.includes('x') || platformStr.includes('twitter') || urlStr.includes('x.com') || urlStr.includes('twitter.com') || titleStr.includes('follow x') || titleStr.includes('retweet') || titleStr.includes('like x')) return 'x';
      if (typeStr.includes('discord') || platformStr.includes('discord') || urlStr.includes('discord.') || titleStr.includes('discord')) return 'discord';
      if (typeStr.includes('youtube') || platformStr.includes('youtube') || urlStr.includes('youtube.com') || urlStr.includes('youtu.be') || titleStr.includes('youtube')) return 'youtube';
      if (typeStr.includes('instagram') || platformStr.includes('instagram') || urlStr.includes('instagram.com') || titleStr.includes('instagram')) return 'instagram';
      if (typeStr.includes('tiktok') || platformStr.includes('tiktok') || urlStr.includes('tiktok.com') || titleStr.includes('tiktok')) return 'tiktok';
      if (typeStr.includes('reddit') || platformStr.includes('reddit') || urlStr.includes('reddit.com') || titleStr.includes('reddit')) return 'reddit';

      return 'none';
    };

    const reqPlatform = inferPlatform(task);
    if (reqPlatform && reqPlatform !== 'none') {
      const conn = dbUser?.socialConnections?.[reqPlatform as keyof typeof dbUser.socialConnections];
      if (!conn || !conn.connected || !conn.handle) {
        showToast(`🔒 Authentication Required: Connect your ${reqPlatform.toUpperCase()} account in Profile first!`, 'error');
        if (setActiveTab) {
          setTimeout(() => setActiveTab('profile'), 1200);
        }
        return;
      }
    }

    // Open link if present
    if (task.url && task.type !== 'quiz') {
      try {
        if ((window as any).Telegram?.WebApp?.openLink) {
          (window as any).Telegram.WebApp.openLink(task.url);
        } else {
          window.open(task.url, '_blank');
        }
      } catch {
        window.open(task.url, '_blank');
      }
    }

    // 5. Rewarded Advertisement Flow
    let adSuccess = true;
    if (adminSettings.adEnabled && task.requireRewardedAd !== false) {
      try {
        showToast('Loading Rewarded Advertisement...', 'info');
        adSuccess = await showRewardedAd(adminSettings.monetagZoneId, adminSettings.monetagDirectLink);
      } catch {
        adSuccess = false;
      }

      if (!adSuccess) {
        // Interrupted Ad -> Cancel Verification & Start Cooldown
        setTaskCooldowns((prev) => ({ ...prev, [task.id]: task.cooldownSeconds || 30 }));
        showToast('Verification Cancelled: You must watch the complete advertisement to verify this task.', 'warning');
        return;
      }
    }

    // 6. Server Verification & Reward Granting
    setTaskStatus((prev) => ({ ...prev, [task.id]: 'verifying' }));

    const serverRes = await verifyTaskWithServer(
      telegramUser.id,
      task,
      userAnswer,
      adSuccess,
      adminSettings.botApiUrl
    );

    if (serverRes.success) {
      setTaskStatus((prev) => ({ ...prev, [task.id]: 'completed' }));
      setCompletedTaskIds((prev) => new Set(prev).add(task.id));

      const pointsEarned = serverRes.reward || task.reward;
      const tokensEarned = serverRes.tokenReward || task.tokenReward;

      setEfcBalance((bal) => {
        const newVal = bal + pointsEarned;
        syncPointsToFirestore(telegramUser.id, newVal).catch(() => {});
        return newVal;
      });

      if (tokensEarned > 0 && setEforceTokens) {
        setEforceTokens((tok) => {
          const newTok = tok + tokensEarned;
          syncTokensToFirestore(telegramUser.id, newTok).catch(() => {});
          return newTok;
        });
      }

      showToast(`✅ Task Completed! +${pointsEarned.toLocaleString()} EFC Points${tokensEarned > 0 ? ` & +${tokensEarned} EST` : ''}`, 'success');
      confetti({ particleCount: 20, spread: 45, origin: { y: 0.7 }, ticks: 80, disableForReducedMotion: true, colors: ['#FF8A00', '#00E5FF', '#4ADE80'] });
    } else {
      setTaskStatus((prev) => ({ ...prev, [task.id]: 'idle' }));
      showToast(serverRes.error || serverRes.reason || 'Verification failed on server.', 'error');
    }
  };

  const handleWatchAdStep = async (task: EForceTask) => {
    if (!telegramUser) return;
    try {
      showToast('Loading sponsored video...', 'info');
      const completed = await showRewardedAd(adminSettings.monetagZoneId, adminSettings.monetagDirectLink);
      if (completed) {
        setTaskSteps((prev) => ({ ...prev, [task.id]: 2 }));
        showToast('Ad completed! Link unlocked.', 'success');
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
    setTaskSteps((prev) => ({ ...prev, [task.id]: 3 }));
    showToast('Task link opened. Click Verify to confirm membership.', 'info');
  };

  const handleVerifyStep = async (task: EForceTask) => {
    if (!telegramUser) return;
    setTaskStatus((prev) => ({ ...prev, [task.id]: 'verifying' }));
    await new Promise((res) => setTimeout(res, 2000));

    if (task.type === 'channel' || task.type === 'group') {
      const checkRes = await checkTelegramMembership(
        telegramUser.id,
        task.url || adminSettings.botUsername || 'EliteForceChannel',
        adminSettings.botApiUrl
      );
      if (!checkRes.isMember) {
        setTaskStatus((prev) => ({ ...prev, [task.id]: 'idle' }));
        showToast(checkRes.reason || 'You have not joined the Telegram channel/group yet!', 'error');
        return;
      }
    }

    const result = await claimTaskReward(telegramUser.id, task);

    if (result.success) {
      setTaskStatus((prev) => ({ ...prev, [task.id]: 'completed' }));
      setEfcBalance((bal) => {
        const newVal = bal + task.reward;
        syncPointsToFirestore(telegramUser.id, newVal).catch(() => {});
        return newVal;
      });
      if (task.tokenReward > 0 && setEforceTokens) {
        setEforceTokens((tok) => {
          const newTok = tok + task.tokenReward;
          syncTokensToFirestore(telegramUser.id, newTok).catch(() => {});
          return newTok;
        });
      }
      showToast(`✅ Verified! +${task.reward.toLocaleString()} EFC Points${task.tokenReward > 0 ? ` & +${task.tokenReward} EST Tokens` : ''} earned!`, 'success');
      confetti({ particleCount: 20, spread: 45, origin: { y: 0.7 }, ticks: 80, disableForReducedMotion: true, colors: ['#FF8A00', '#00E5FF', '#B388FF'] });
    } else {
      setTaskStatus((prev) => ({ ...prev, [task.id]: 'idle' }));
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
    const adCount = lastAdDate === todayStr ? dbUser?.dailyAdWatchCount || 0 : 0;
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
        const result = await claimDailyAdVideoReward(
          telegramUser.id,
          isPremium,
          adminSettings.adTokenReward || 1,
          adminSettings.adDailyLimitNormal || 10,
          adminSettings.adDailyLimitPremium || 20
        );

        if (result.success) {
          showToast(`🎉 Ad completed! +${adminSettings.adTokenReward || 1} EFC Points added!`, 'success');
          confetti({ particleCount: 20, spread: 40, origin: { y: 0.65 }, ticks: 80, disableForReducedMotion: true, colors: ['#00E5FF', '#B388FF'] });
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

  const enabledTasks = tasks.filter((t) => t.isEnabled);
  const completedCount = enabledTasks.filter((t) => isCompleted(t)).length;
  const totalEarnedRewards = enabledTasks
    .filter((t) => isCompleted(t))
    .reduce((sum, t) => sum + t.reward, 0);

  // Categorize tasks dynamically into platform categories
  const categoriesData = useMemo(() => {
    const activeTasks = enabledTasks;

    // Categorization logic
    const xTasks = activeTasks.filter((t) => t.type === 'x' || t.title.toLowerCase().includes('twitter') || t.title.toLowerCase().includes('x.com'));
    const discordTasks = activeTasks.filter((t) => t.title.toLowerCase().includes('discord') || t.url?.includes('discord'));
    const videoTasks = activeTasks.filter((t) => t.type === 'video' || t.type === 'ad' || t.title.toLowerCase().includes('video') || t.title.toLowerCase().includes('youtube'));
    const telegramTasks = activeTasks.filter((t) => t.type === 'channel' || t.type === 'group' || t.url?.includes('t.me'));
    const generalTasks = activeTasks.filter(
      (t) => !xTasks.includes(t) && !discordTasks.includes(t) && !videoTasks.includes(t) && !telegramTasks.includes(t)
    );

    const getSubCategoryStats = (taskList: EForceTask[], subType: string) => {
      let filtered = taskList;
      if (subType === 'Follow') {
        filtered = taskList.filter((t) => !t.title.toLowerCase().includes('like') && !t.title.toLowerCase().includes('repost') && !t.title.toLowerCase().includes('retweet'));
      } else if (subType === 'Like') {
        filtered = taskList.filter((t) => t.title.toLowerCase().includes('like'));
      } else if (subType === 'Repost') {
        filtered = taskList.filter((t) => t.title.toLowerCase().includes('repost') || t.title.toLowerCase().includes('retweet'));
      } else if (subType === 'Join') {
        filtered = taskList;
      } else if (subType === 'Watch') {
        filtered = taskList;
      } else if (subType === 'Channel') {
        filtered = taskList.filter((t) => t.type === 'channel');
      } else if (subType === 'Group') {
        filtered = taskList.filter((t) => t.type === 'group');
      } else if (subType === 'Other') {
        filtered = taskList;
      }

      const uncompleted = filtered.filter((t) => !isCompleted(t) && !isExpired(t));
      const totalReward = uncompleted.reduce((s, t) => s + t.reward, 0);

      return {
        tasks: filtered,
        uncompletedCount: uncompleted.length,
        totalReward,
      };
    };

    const getCategoryTotal = (taskList: EForceTask[]) => {
      const uncompleted = taskList.filter((t) => !isCompleted(t) && !isExpired(t));
      return uncompleted.reduce((s, t) => s + t.reward, 0);
    };

    return [
      {
        id: 'x',
        title: 'X',
        icon: (
          <div className="w-8 h-8 rounded-xl bg-black border border-white/20 flex items-center justify-center text-white shrink-0">
            <Twitter size={16} />
          </div>
        ),
        totalReward: getCategoryTotal(xTasks),
        subCategories: [
          { name: 'Follow', ...getSubCategoryStats(xTasks, 'Follow') },
          { name: 'Like', ...getSubCategoryStats(xTasks, 'Like') },
          { name: 'Repost', ...getSubCategoryStats(xTasks, 'Repost') },
        ],
      },
      {
        id: 'discord',
        title: 'Discord',
        icon: (
          <div className="w-8 h-8 rounded-xl bg-[#5865F2] flex items-center justify-center text-white shrink-0 shadow-[0_0_12px_rgba(88,101,242,0.4)]">
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028z" />
            </svg>
          </div>
        ),
        totalReward: getCategoryTotal(discordTasks),
        subCategories: [
          { name: 'Join', ...getSubCategoryStats(discordTasks, 'Join') },
        ],
      },
      {
        id: 'video',
        title: 'Video & Video Ads',
        icon: (
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-rose-600 flex items-center justify-center text-white shrink-0 shadow-[0_0_12px_rgba(168,85,247,0.4)]">
            <Play size={16} className="fill-current" />
          </div>
        ),
        totalReward: getCategoryTotal(videoTasks),
        subCategories: [
          { name: 'Watch Video Missions', ...getSubCategoryStats(videoTasks, 'Watch') },
        ],
      },
      {
        id: 'telegram',
        title: 'Telegram',
        icon: (
          <div className="w-8 h-8 rounded-xl bg-[#0088cc] flex items-center justify-center text-white shrink-0 shadow-[0_0_12px_rgba(0,136,204,0.4)]">
            <Send size={15} />
          </div>
        ),
        totalReward: getCategoryTotal(telegramTasks),
        subCategories: [
          { name: 'Channels', ...getSubCategoryStats(telegramTasks, 'Channel') },
          { name: 'Groups', ...getSubCategoryStats(telegramTasks, 'Group') },
        ],
      },
      {
        id: 'general',
        title: 'General',
        icon: (
          <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-amber-400 shrink-0">
            <Zap size={16} className="fill-current" />
          </div>
        ),
        totalReward: getCategoryTotal(generalTasks),
        subCategories: [
          { name: 'Other', ...getSubCategoryStats(generalTasks, 'Other') },
        ],
      },
    ];
  }, [enabledTasks, completedTaskIds]);

  return (
    <div className="flex flex-col gap-5 pb-28">
      {/* Header & Top Navigation Bar */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Missions & Tasks</h1>
            <p className="text-xs text-slate-400 mt-1">Complete tasks or create your own campaign</p>
          </div>
        </div>

        {/* Segmented Nav Tabs (Earn, My tasks, + Create) matching Design System */}
        <div className="flex items-center gap-2 p-1.5 bg-[#16171B] border border-white/10 rounded-2xl">
          <button
            onClick={() => setMainTab('earn')}
            className={`flex-1 h-10 rounded-xl font-extrabold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              mainTab === 'earn'
                ? 'bg-[#252833] text-white shadow-md border border-white/10'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Zap size={14} className={mainTab === 'earn' ? 'text-[#FF8A00]' : ''} />
            Earn
          </button>

          <button
            onClick={() => setMainTab('my_tasks')}
            className={`flex-1 h-10 rounded-xl font-extrabold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              mainTab === 'my_tasks'
                ? 'bg-[#252833] text-white shadow-md border border-white/10'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers size={14} className={mainTab === 'my_tasks' ? 'text-[#00E5FF]' : ''} />
            My tasks
          </button>

          <button
            onClick={() => setMainTab('create')}
            className={`flex-1 h-10 rounded-xl font-extrabold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              mainTab === 'create'
                ? 'bg-[#E5A338] text-black shadow-lg font-black'
                : 'bg-white/10 text-white hover:bg-white/15'
            }`}
          >
            <Plus size={14} />
            + Create
          </button>
        </div>
      </div>

      {/* ── 1. EARN TAB CONTENT ── */}
      {mainTab === 'earn' && (
        <div className="flex flex-col gap-5">

      {/* Header Banner (if set by Admin) */}
      {adminSettings.tasksBannerUrl && (
        <div className="w-full h-32 rounded-[22px] overflow-hidden border border-white/10 relative shadow-[0_12px_30px_rgba(0,0,0,0.5)]">
          {adminSettings.tasksBannerUrl.toLowerCase().includes('.mp4') ||
           adminSettings.tasksBannerUrl.toLowerCase().includes('.webm') ||
           adminSettings.tasksBannerUrl.toLowerCase().includes('.mov') ||
           adminSettings.tasksBannerUrl.toLowerCase().startsWith('data:video/') ? (
            <video src={adminSettings.tasksBannerUrl} autoPlay loop muted playsInline className="w-full h-full object-cover" />
          ) : (
            <img src={adminSettings.tasksBannerUrl} alt="Tasks Banner" className="w-full h-full object-cover" />
          )}
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass-panel p-3.5 rounded-[18px] border-white/5 flex flex-col gap-1">
          <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Completed</span>
          <span className="text-lg font-black text-accent-success">{completedCount}/{enabledTasks.length}</span>
        </div>
        <div className="glass-panel p-3.5 rounded-[18px] border-white/5 flex flex-col gap-1">
          <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Earned Rewards</span>
          <span className="text-lg font-black text-[#FF8A00]">{totalEarnedRewards.toLocaleString()} EFC Points</span>
        </div>
      </div>

      {/* Daily Video Ads Banner */}
      {adminSettings.adEnabled && (() => {
        const todayStr = new Date().toISOString().slice(0, 10);
        const lastAdDate = dbUser?.dailyAdWatchDate || '';
        const adCount = lastAdDate === todayStr ? dbUser?.dailyAdWatchCount || 0 : 0;
        const isPremium = !!telegramUser?.isPremium;
        const limit = isPremium ? adminSettings.adDailyLimitPremium || 20 : adminSettings.adDailyLimitNormal || 10;
        const limitHit = adCount >= limit;
        return (
          <div
            className={`glass-panel p-4 rounded-[22px] border-white/10 flex items-center gap-3.5 transition-all ${limitHit ? 'opacity-60' : ''}`}
            style={{ background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.12) 0%, rgba(0, 229, 255, 0.05) 100%)', borderColor: 'rgba(168, 85, 247, 0.25)' }}
          >
            <div className="w-10 h-10 rounded-[14px] flex items-center justify-center shrink-0 border border-purple-500/30 bg-purple-500/20 text-purple-300">
              <Play size={16} className="fill-current" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-black text-white mb-0.5">
                Watch Sponsored Video Ad {isPremium && <span className="text-[7px] font-black text-[#00E5FF] bg-[#00E5FF]/10 px-1 py-0.5 rounded border border-[#00E5FF]/20 uppercase ml-1">Premium Boost</span>}
              </div>
              <div className="text-[9px] text-slate-400">
                Earn <span className="text-purple-400 font-black">+{adminSettings.adTokenReward || 1} EFC Points</span> per ad · {adCount}/{limit} today
              </div>
            </div>
            <button
              onClick={handleWatchDailyVideo}
              disabled={watchingDailyVideo || limitHit}
              className={`shrink-0 h-9 px-4 rounded-xl text-[10px] font-extrabold flex items-center justify-center gap-1 cursor-pointer transition-all ${
                limitHit
                  ? 'bg-accent-success/15 text-accent-success border border-accent-success/25'
                  : 'bg-gradient-to-r from-purple-500 to-cyan-500 text-white shadow-lg hover:scale-105'
              }`}
            >
              {limitHit ? (
                <>
                  <Check size={12} /> Done
                </>
              ) : watchingDailyVideo ? (
                <>
                  <Loader2 size={11} className="animate-spin" /> Watching
                </>
              ) : (
                <>
                  <Play size={11} /> Watch Ad
                </>
              )}
            </button>
          </div>
        );
      })()}

      {/* Task Categories Accordion Cards */}
      {loadingTasks ? (
        <div className="flex flex-col items-center gap-3 py-12">
          <Loader2 size={24} className="text-accent-cyan animate-spin" />
          <span className="text-xs text-slate-500">Loading categorized missions...</span>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {categoriesData.map((cat) => {
            const isCatExpanded = !!expandedCategories[cat.id];

            return (
              <div
                key={cat.id}
                className="rounded-[22px] bg-[#141414] border border-white/8 overflow-hidden shadow-xl transition-all"
              >
                {/* Category Header Bar */}
                <button
                  onClick={() => toggleCategory(cat.id)}
                  className="w-full p-4 flex items-center justify-between cursor-pointer hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {cat.icon}
                    <span className="text-sm font-bold text-white tracking-wide">{cat.title}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    {cat.totalReward > 0 && (
                      <span className="text-xs font-black text-[#FF8A00] tracking-tight">
                        {cat.totalReward.toLocaleString()} EFC Points
                      </span>
                    )}
                    <div className="text-slate-400">
                      {isCatExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </div>
                  </div>
                </button>

                {/* Subcategories Accordion Content */}
                <AnimatePresence>
                  {isCatExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-white/5 flex flex-col divide-y divide-white/5"
                    >
                      {cat.subCategories.map((sub) => {
                        const subKey = `${cat.id}_${sub.name}`;
                        const isSubExpanded = !!expandedSubCats[subKey];
                        const hasUncompleted = sub.uncompletedCount > 0;

                        return (
                          <div key={sub.name} className="flex flex-col">
                            {/* Subcategory Row */}
                            <button
                              onClick={() => toggleSubCat(subKey)}
                              className="w-full px-5 py-3.5 flex items-center justify-between cursor-pointer hover:bg-white/[0.015] transition-colors"
                            >
                              <div>
                                <div className="text-xs font-bold text-slate-200 text-left mb-0.5">{sub.name}</div>
                                <div className="text-[10px] text-slate-500 text-left">
                                  {hasUncompleted
                                    ? `${sub.uncompletedCount} task${sub.uncompletedCount > 1 ? 's' : ''} · ${sub.totalReward.toLocaleString()} EFC Points total`
                                    : 'None left for you right now'}
                                </div>
                              </div>
                              <div className="text-slate-500">
                                {isSubExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              </div>
                            </button>

                            {/* Subcategory Tasks List */}
                            <AnimatePresence>
                              {isSubExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.18 }}
                                  className="px-4 pb-4 pt-2 flex flex-col gap-2.5 bg-black/30 border-t border-white/[0.03]"
                                >
                                  {sub.tasks.length === 0 ? (
                                    <div className="text-center py-4 text-[10px] text-slate-500">
                                      No active missions in this section right now.
                                    </div>
                                  ) : (
                                    sub.tasks.map((task) => {
                                      const status = taskStatus[task.id] || 'idle';
                                      const done = isCompleted(task);
                                      const expired = isExpired(task);
                                      const limitHit = isLimitReached(task);
                                      const isForceJoin = task.type === 'channel' || task.type === 'group';
                                      const startStep = isForceJoin && adminSettings.adEnabled ? 1 : 2;
                                      const currentStep = taskSteps[task.id] || startStep;

                                      return (
                                        <div
                                          key={task.id}
                                          className={`p-4 rounded-[20px] bg-[#1a1a1a] border border-[#2a2a2a] flex flex-col gap-3 transition-all relative ${
                                            done ? 'opacity-60' : expired || limitHit ? 'opacity-40' : ''
                                          }`}
                                        >
                                          {/* Card Header Row */}
                                          <div className="flex items-center justify-between gap-2 flex-wrap">
                                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 shadow-[0_0_8px_#34d399]" />
                                              <span className="text-sm font-extrabold text-white truncate">
                                                {task.title}
                                              </span>
                                              {task.url && !done && (
                                                <ExternalLink size={11} className="text-slate-400 shrink-0" />
                                              )}
                                            </div>

                                            <div className="flex items-center gap-1.5 shrink-0">
                                              {task.isMandatory && (
                                                <span className="text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                                                  🔒 REQUIRED
                                                </span>
                                              )}
                                              <span className="text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                                {task.type}
                                              </span>
                                            </div>
                                          </div>

                                          {task.description && (
                                            <p className="text-[10px] text-slate-400 line-clamp-2">{task.description}</p>
                                          )}

                                          {/* Dual Reward Boxes (EFC Points REWARD & TOKEN) */}
                                          <div className="grid grid-cols-2 gap-2.5 my-0.5">
                                            {/* EFC Points REWARD Box */}
                                            <div className="p-3 rounded-xl bg-[#242424] border border-[#333333] flex flex-col gap-0.5">
                                              <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">
                                                EFC Points Reward
                                              </span>
                                              <span className="text-base font-black text-[#FF8A00]">
                                                {task.reward.toLocaleString()}
                                              </span>
                                            </div>

                                            {/* TOKEN Box */}
                                            <div className="p-3 rounded-xl bg-[#242424] border border-[#333333] flex flex-col gap-0.5">
                                              <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">
                                                Token
                                              </span>
                                              <span className="text-base font-black text-indigo-400">
                                                +{task.tokenReward || 100}
                                              </span>
                                            </div>
                                          </div>

                                          {/* Quiz Answer Input Box (if Quiz / Text Solution Task) */}
                                          {task.answer && !done && (
                                            <div className="flex flex-col gap-1.5 my-1">
                                              <label className="text-[10px] text-slate-300 font-bold flex items-center justify-between">
                                                <span>ENTER YOUR ANSWER:</span>
                                                <span className="text-[9px] text-slate-500 font-normal">Server Validated</span>
                                              </label>
                                              <input
                                                type="text"
                                                placeholder="Type solution here..."
                                                value={quizAnswers[task.id] || ''}
                                                onChange={(e) => {
                                                  const val = e.target.value;
                                                  setQuizAnswers((prev) => ({ ...prev, [task.id]: val }));
                                                  if (quizErrors[task.id]) setQuizErrors((prev) => ({ ...prev, [task.id]: '' }));
                                                }}
                                                className="w-full h-9 rounded-xl bg-black/40 border border-white/10 px-3 text-xs text-white placeholder-slate-500 outline-none focus:border-[#FF8A00] font-mono"
                                              />
                                              {quizErrors[task.id] && (
                                                <span className="text-[10px] text-rose-400 font-bold">{quizErrors[task.id]}</span>
                                              )}
                                            </div>
                                          )}

                                          {/* Cooldown Timer Alert (Interrupted Ad) */}
                                          {taskCooldowns[task.id] > 0 && !done && (
                                            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between text-[10px] text-amber-300 font-bold">
                                              <span>Verification Interrupted</span>
                                              <span className="font-mono text-amber-400 font-black">00:{taskCooldowns[task.id] < 10 ? '0' : ''}{taskCooldowns[task.id]}</span>
                                            </div>
                                          )}

                                          {/* Status & Action Bar */}
                                          <div className="flex items-center justify-between gap-3 pt-1 border-t border-white/5">
                                            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                              Active
                                            </div>

                                            {/* Action Button */}
                                            {!isForceJoin &&
                                              (done ? (
                                                <button
                                                  disabled
                                                  className="shrink-0 h-8 px-4 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 bg-accent-success/15 text-accent-success border border-accent-success/25"
                                                >
                                                  <Check size={12} /> Done
                                                </button>
                                              ) : expired || limitHit ? (
                                                <button
                                                  disabled
                                                  className="shrink-0 h-8 px-4 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 bg-white/5 text-slate-500 border border-white/10 cursor-not-allowed"
                                                >
                                                  <Lock size={11} /> Closed
                                                </button>
                                              ) : taskCooldowns[task.id] > 0 ? (
                                                <button
                                                  disabled
                                                  className="shrink-0 h-8 px-4 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 bg-white/5 text-amber-400 border border-amber-500/30 cursor-not-allowed font-mono"
                                                >
                                                  <Lock size={11} /> Verify ({taskCooldowns[task.id]}s)
                                                </button>
                                              ) : status === 'verifying' ? (
                                                <button
                                                  disabled
                                                  className="shrink-0 h-8 px-4 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 bg-white/5 text-slate-400 border border-white/10 cursor-wait"
                                                >
                                                  <Loader2 size={12} className="animate-spin" /> Verifying
                                                </button>
                                              ) : (
                                                <button
                                                  onClick={() => handleTaskClick(task)}
                                                  className="shrink-0 h-8 px-5 rounded-xl text-[10px] font-extrabold transition-all flex items-center justify-center gap-1 bg-[#FF8A00] hover:bg-[#FF8A00]/90 text-white shadow-[0_0_12px_rgba(255,138,0,0.25)] cursor-pointer hover:scale-105"
                                                >
                                                  Verify Task
                                                </button>
                                              ))}

                                            {/* Force Join: Done Badge */}
                                            {isForceJoin && done && (
                                              <button
                                                disabled
                                                className="shrink-0 h-8 px-4 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 bg-accent-success/15 text-accent-success border border-accent-success/25"
                                              >
                                                <Check size={12} /> Done
                                              </button>
                                            )}
                                          </div>

                                          {/* Force Join Inline Step Panel */}
                                          {isForceJoin && !done && !expired && !limitHit && (
                                            <div
                                              className="border-t border-white/5 pt-3 mt-1 flex flex-col gap-2.5"
                                            >
                                              <div className="flex items-center gap-2 flex-wrap">
                                                {adminSettings.adEnabled && (
                                                  <button
                                                    onClick={() => handleWatchAdStep(task)}
                                                    disabled={currentStep !== 1}
                                                    className={`flex-1 h-8 rounded-xl text-[9px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer border ${
                                                      currentStep === 1
                                                        ? 'bg-purple-500/20 border-purple-500/40 text-purple-300 hover:bg-purple-500/30'
                                                        : currentStep > 1
                                                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 cursor-default'
                                                        : 'bg-white/5 border-white/10 text-slate-500 cursor-not-allowed'
                                                    }`}
                                                  >
                                                    {currentStep > 1 ? <Check size={10} /> : <Play size={10} />}
                                                    1. Watch Ad
                                                  </button>
                                                )}

                                                <button
                                                  onClick={() => handleJoinLinkStep(task)}
                                                  disabled={currentStep !== 2}
                                                  className={`flex-1 h-8 rounded-xl text-[9px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer border ${
                                                    currentStep === 2
                                                      ? 'bg-cyan-500/15 border-cyan-500/35 text-cyan-300 hover:bg-cyan-500/25'
                                                      : currentStep > 2
                                                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 cursor-default'
                                                      : 'bg-white/5 border-white/10 text-slate-500 cursor-not-allowed'
                                                  }`}
                                                >
                                                  {currentStep > 2 ? <Check size={10} /> : <Send size={10} />}
                                                  {adminSettings.adEnabled ? '2.' : '1.'} Join Link
                                                </button>

                                                <button
                                                  onClick={() => handleVerifyStep(task)}
                                                  disabled={currentStep !== 3 || status === 'verifying'}
                                                  className={`flex-1 h-8 rounded-xl text-[9px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer border ${
                                                    status === 'verifying'
                                                      ? 'bg-[#FF8A00]/15 border-[#FF8A00]/30 text-[#FF8A00] cursor-wait'
                                                      : currentStep === 3
                                                      ? 'bg-[#FF8A00]/15 border-[#FF8A00]/30 text-[#FF8A00] hover:bg-[#FF8A00]/25'
                                                      : 'bg-white/5 border-white/10 text-slate-500 cursor-not-allowed'
                                                  }`}
                                                >
                                                  {status === 'verifying' ? (
                                                    <Loader2 size={10} className="animate-spin" />
                                                  ) : (
                                                    <Check size={10} />
                                                  )}
                                                  {adminSettings.adEnabled ? '3.' : '2.'} Verify
                                                </button>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })
                                  )}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  )}

      {/* ── 2. CREATE TASK CAMPAIGN TAB (Design System Implementation) ── */}
      {mainTab === 'create' && (
        <div className="flex flex-col gap-5">
          {/* Info Banner */}
          <div className="p-4 rounded-[20px] bg-[#16171B] border border-white/10 text-xs text-slate-300 leading-relaxed font-medium">
            Fund a task from your balance and real users complete it, verified like any sponsored task. A 25% fee applies per completed action, plus verification costs where shown.
          </div>

          {/* Form Container */}
          <div className="glass-panel p-5 rounded-[24px] border border-white/10 flex flex-col gap-4 bg-[#16171B] shadow-xl">
            {/* PLATFORM SELECTOR */}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">PLATFORM</span>
              <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-none flex-wrap">
                {platformsList.map((p) => {
                  const isSel = selectedPlatform === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setSelectedPlatform(p.id);
                        if (p.id === 'x') setSelectedActions({ follow: true });
                        else if (p.id === 'telegram') setSelectedActions({ channel: true });
                        else setSelectedActions({ do_task: true });
                      }}
                      className={`h-9 px-3.5 rounded-full border text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                        isSel
                          ? 'bg-white text-black border-white shadow-md scale-105 font-extrabold'
                          : 'bg-[#1F2026] text-slate-300 border-white/10 hover:border-white/20'
                      }`}
                    >
                      <span>{p.icon}</span>
                      <span>{p.label}</span>
                      {isSel && <Check size={12} strokeWidth={3} />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ACTION SELECTOR */}
            <div className="flex flex-col gap-2 pt-2 border-t border-white/5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">ACTION</span>
              </div>
              <p className="text-[10px] text-slate-500 mb-1">Tick several to order them all on one post.</p>

              <div className="grid grid-cols-2 gap-2">
                {selectedPlatform === 'x' && (
                  <>
                    {[
                      { id: 'like', label: 'Like', min: 3 },
                      { id: 'repost', label: 'Repost', min: 5 },
                      { id: 'bookmark', label: 'Bookmark', min: 3 },
                      { id: 'reply', label: 'Reply', min: 7 },
                      { id: 'views', label: 'Views', min: 20 },
                      { id: 'follow', label: 'Follow', min: 5 },
                      { id: 'quote', label: 'Quote', min: 10 },
                    ].map((act) => {
                      const checked = !!selectedActions[act.id];
                      return (
                        <button
                          key={act.id}
                          type="button"
                          onClick={() => setSelectedActions((prev) => ({ ...prev, [act.id]: !prev[act.id] }))}
                          className={`p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                            checked
                              ? 'bg-white/10 border-[#E5A338] text-white shadow-md'
                              : 'bg-[#121212] border-white/10 text-slate-400 hover:border-white/20'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] shrink-0 ${checked ? 'bg-[#E5A338] border-[#E5A338] text-black font-black' : 'border-white/30'}`}>
                              {checked && '✓'}
                            </span>
                            <span className="text-xs font-bold text-white truncate">{act.label}</span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 shrink-0">from {act.min}</span>
                        </button>
                      );
                    })}
                  </>
                )}

                {selectedPlatform === 'telegram' && (
                  <>
                    {[
                      { id: 'channel', label: 'Join Channel', min: 5 },
                      { id: 'group', label: 'Join Group', min: 5 },
                    ].map((act) => {
                      const checked = !!selectedActions[act.id];
                      return (
                        <button
                          key={act.id}
                          type="button"
                          onClick={() => setSelectedActions((prev) => ({ ...prev, [act.id]: !prev[act.id] }))}
                          className={`p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                            checked
                              ? 'bg-white/10 border-[#E5A338] text-white shadow-md'
                              : 'bg-[#121212] border-white/10 text-slate-400 hover:border-white/20'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] shrink-0 ${checked ? 'bg-[#E5A338] border-[#E5A338] text-black font-black' : 'border-white/30'}`}>
                              {checked && '✓'}
                            </span>
                            <span className="text-xs font-bold text-white">{act.label}</span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400">from {act.min}</span>
                        </button>
                      );
                    })}
                  </>
                )}

                {selectedPlatform !== 'x' && selectedPlatform !== 'telegram' && (
                  <button
                    type="button"
                    onClick={() => setSelectedActions({ do_task: true })}
                    className="p-3 rounded-xl border bg-white/10 border-[#E5A338] text-white flex items-center justify-between col-span-2 shadow-md"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded bg-[#E5A338] text-black font-black flex items-center justify-center text-[10px]">✓</span>
                      <span className="text-xs font-bold text-white">Do Task / Visit Link</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">from 5 EFC</span>
                  </button>
                )}
              </div>
            </div>

            {/* TARGET URL INPUT */}
            <div className="flex flex-col gap-1.5 pt-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">TARGET</span>
              <input
                type="text"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="https://x.com/EliteForceOFC"
                className="w-full h-11 rounded-xl bg-[#121212] border border-white/10 px-4 text-xs text-white placeholder-slate-500 font-mono outline-none focus:border-[#E5A338] transition-all"
              />
            </div>

            {/* CUSTOM TASK EXTRA FIELDS */}
            {selectedPlatform === 'custom' && (
              <div className="flex flex-col gap-3 pt-3 border-t border-white/10">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">TASK TITLE</span>
                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="Short title, e.g. Sign up on Invent"
                    className="w-full h-11 rounded-xl bg-[#121212] border border-white/10 px-4 text-xs text-white placeholder-slate-500 outline-none focus:border-[#E5A338]"
                  />
                  <span className="text-[9px] text-slate-500">A clear, short name shown on the task card.</span>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">WHAT SHOULD WORKERS DO?</span>
                  <textarea
                    rows={3}
                    value={customDescription}
                    onChange={(e) => setCustomDescription(e.target.value)}
                    placeholder="Describe exact steps. e.g. Open link, read post, reply with feedback. Upload screenshot proof."
                    className="w-full rounded-xl bg-[#121212] border border-white/10 p-3 text-xs text-white placeholder-slate-500 outline-none focus:border-[#E5A338]"
                  />
                </div>

                {/* Example screenshot placeholder button */}
                <button
                  type="button"
                  onClick={() => showToast('Image upload available for active campaigns', 'info')}
                  className="p-3 rounded-xl border border-dashed border-white/20 bg-white/5 flex items-center justify-center gap-2 text-xs text-slate-300 hover:bg-white/10 cursor-pointer transition-all"
                >
                  <ImageIcon size={16} className="text-[#FF8A00]" />
                  <span>Add example screenshots (optional, up to 3)</span>
                </button>

                {/* Note to Reviewers */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">NOTE TO REVIEWERS (OPTIONAL)</span>
                  <textarea
                    rows={2}
                    value={customNoteToReviewers}
                    onChange={(e) => setCustomNoteToReviewers(e.target.value)}
                    placeholder="e.g. A valid screenshot shows the dashboard with a green checkmark"
                    className="w-full rounded-xl bg-[#121212] border border-white/10 p-3 text-xs text-white placeholder-slate-500 outline-none focus:border-[#E5A338]"
                  />
                </div>

                {/* Start Paused Checkbox */}
                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-[#121212] border border-white/10 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={startPaused}
                    onChange={(e) => setStartPaused(e.target.checked)}
                    className="w-4 h-4 rounded accent-[#E5A338]"
                  />
                  <span className="text-xs font-bold text-white">Start paused after approval</span>
                </label>

                {/* Notice Box */}
                <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 flex flex-col gap-1.5 text-[11px] text-slate-300">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-[#E5A338]" /> Reviewed before going live
                  </span>
                  <p className="text-slate-400 leading-relaxed text-[10px]">
                    Custom tasks are checked by a moderator first. Not allowed: wallets, seed phrases, private keys, signing transactions, fake reviews, harassment.
                  </p>
                </div>
              </div>
            )}

            {/* REWARD / EACH, HOW MANY, EXPIRES (DAYS) GRID */}
            <div className="grid grid-cols-3 gap-2.5 pt-2">
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">REWARD / EACH</span>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    value={rewardPerEach}
                    onChange={(e) => setRewardPerEach(Number(e.target.value))}
                    className="w-full h-11 rounded-xl bg-[#121212] border border-white/10 pl-3 pr-10 text-xs text-white font-mono outline-none focus:border-[#E5A338]"
                  />
                  <span className="absolute right-2.5 top-3.5 text-[9px] font-bold text-slate-400">EFC</span>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">HOW MANY</span>
                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="w-full h-11 rounded-xl bg-[#121212] border border-white/10 px-3 text-xs text-white font-mono outline-none focus:border-[#E5A338]"
                />
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">EXPIRES (DAYS)</span>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={expiresDays}
                  onChange={(e) => setExpiresDays(Number(e.target.value))}
                  className="w-full h-11 rounded-xl bg-[#121212] border border-white/10 px-3 text-xs text-white font-mono outline-none focus:border-[#E5A338]"
                />
              </div>
            </div>

            {/* MINIMUM TIER SELECTOR */}
            <div className="flex flex-col gap-2 pt-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">MINIMUM TIER</span>
              <div className="flex items-center gap-2">
                {(['stone', 'bronze', 'silver', 'gold'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setMinTier(t)}
                    className={`flex-1 h-9 rounded-xl text-xs font-bold capitalize border transition-all cursor-pointer ${
                      minTier === t
                        ? 'bg-white/15 border-white text-white font-extrabold shadow-sm'
                        : 'bg-[#121212] border-white/10 text-slate-400 hover:border-white/20'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <p className="text-[9.5px] text-slate-500 leading-relaxed">
                Who can complete it. Higher tiers need active older accounts. Silver adds +1 and Gold +2 EFC to minimum reward.
              </p>

              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-[#121212] border border-white/10 cursor-pointer mt-1">
                <input
                  type="checkbox"
                  checked={verifiedOnly}
                  onChange={(e) => setVerifiedOnly(e.target.checked)}
                  className="w-4 h-4 rounded accent-[#E5A338]"
                />
                <span className="text-xs font-bold text-white">Verified (blue-tick) X users only</span>
              </label>
            </div>

            {/* ESCROW SUMMARY BOX (Matching Screenshot 2 & 3) */}
            <div className="p-4 rounded-2xl bg-[#121212] border border-white/10 flex flex-col gap-2 font-mono">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>{rewardEach} EFC × {howMany}</span>
                <span className="font-bold text-white">{baseSubtotal} EFC</span>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Service fee (25%)</span>
                <span>{serviceFee} EFC</span>
              </div>

              {reviewFee > 0 && (
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Review fee (one-time)</span>
                  <span>{reviewFee} EFC</span>
                </div>
              )}

              <div className="h-px bg-white/10 my-1" />

              <div className="flex items-center justify-between text-xs font-bold text-white">
                <span>Total escrowed</span>
                <span className="text-sm font-extrabold">{totalEscrowRequired} EFC</span>
              </div>

              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-400">Balance after</span>
                {isInsufficientBalance ? (
                  <span className="text-rose-400 font-extrabold">Insufficient ({balanceAfter} EFC)</span>
                ) : (
                  <span className="text-emerald-400 font-extrabold">{balanceAfter} EFC</span>
                )}
              </div>

              <p className="text-[9px] text-slate-500 font-sans mt-1">
                Unfinished units are refunded in full (reward + fee) if the task expires or you cancel.
              </p>
            </div>

            {/* CTA BUTTON */}
            <button
              type="button"
              onClick={handleCreateCampaign}
              disabled={isCreatingCampaign}
              className={`w-full h-12 rounded-2xl font-extrabold text-sm shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
                isInsufficientBalance
                  ? 'bg-rose-500/20 border border-rose-500/30 text-rose-400 hover:bg-rose-500/30'
                  : 'bg-[#E5A338] text-black hover:brightness-110 active:scale-98'
              }`}
            >
              {isCreatingCampaign ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Escrowing & Launching...
                </>
              ) : isInsufficientBalance ? (
                <>
                  <AlertTriangle size={16} /> Top up EFC Balance
                </>
              ) : (
                'Create task'
              )}
            </button>

            <div className="text-center pt-2">
              <span className="text-[10px] text-slate-500 font-semibold block mb-1">Can't find the task you're looking for?</span>
              <button
                type="button"
                onClick={() => showToast('Task suggestion submitted!', 'info')}
                className="text-xs font-bold text-white underline underline-offset-4 hover:text-[#E5A338]"
              >
                Suggest a task type
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 3. MY TASKS TAB (User Created Campaigns Management) ── */}
      {mainTab === 'my_tasks' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-extrabold text-white">My Created Campaigns</h2>
            <span className="text-xs text-slate-400 font-mono">{userCreatedTasks.length} campaigns</span>
          </div>

          {userCreatedTasks.length === 0 ? (
            <div className="glass-panel p-8 rounded-[24px] border border-white/10 flex flex-col items-center gap-3 text-center bg-[#16171B]">
              <span className="text-4xl">🚀</span>
              <h3 className="text-sm font-bold text-white">No campaigns created yet</h3>
              <p className="text-xs text-slate-400 max-w-xs">
                Launch your first campaign to get real users to follow, like, join, or complete your tasks.
              </p>
              <button
                type="button"
                onClick={() => setMainTab('create')}
                className="mt-2 h-10 px-5 rounded-xl bg-[#E5A338] text-black font-extrabold text-xs cursor-pointer hover:brightness-110 transition-all shadow-lg"
              >
                + Create Task Campaign
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {userCreatedTasks.map((t) => {
                const total = t.quantityTotal || t.totalCompletionLimit || 1;
                const done = t.completedCount || 0;
                const pct = Math.min(100, Math.round((done / total) * 100));

                return (
                  <div
                    key={t.id}
                    className="p-4 rounded-[22px] bg-[#16171B] border border-white/10 flex flex-col gap-3 shadow-lg"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white truncate">{t.title}</span>
                      <span
                        className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                          t.status === 'active' || t.isEnabled
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : t.status === 'under_review'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                            : 'bg-slate-500/10 text-slate-400 border-slate-500/30'
                        }`}
                      >
                        {t.status || (t.isEnabled ? 'active' : 'paused')}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>{done} / {total} completed</span>
                      <span>{t.reward} EFC each</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-[#FF8A00] to-[#00E5FF] transition-all duration-300" style={{ width: `${pct}%` }} />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-white/5">
                      <button
                        type="button"
                        onClick={async () => {
                          const nextStatus = t.isEnabled ? 'paused' : 'active';
                          const res = await updateUserCampaignStatus(telegramUser!.id, t.id, nextStatus);
                          if (res.success) showToast(`Campaign ${nextStatus}!`, 'info');
                        }}
                        className="h-8 px-3 rounded-lg bg-white/10 text-white text-[10px] font-bold hover:bg-white/15 cursor-pointer"
                      >
                        {t.isEnabled ? 'Pause' : 'Resume'}
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          const res = await updateUserCampaignStatus(telegramUser!.id, t.id, 'cancelled');
                          if (res.success) {
                            showToast(`Campaign cancelled! ${res.refundedAmount || 0} EFC refunded.`, 'success');
                            setEfcBalance((prev) => prev + (res.refundedAmount || 0));
                          }
                        }}
                        className="h-8 px-3 rounded-lg bg-rose-500/15 text-rose-400 border border-rose-500/30 text-[10px] font-bold hover:bg-rose-500/25 cursor-pointer"
                      >
                        Cancel & Refund
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
