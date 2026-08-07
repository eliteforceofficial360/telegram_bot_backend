// Firestore Task Service — Elite Force (EForce)
// Handles CRUD for tasks (admin) and task completion tracking (users)

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  query,
  where,
  getDocs,
  orderBy,
  Timestamp,
  runTransaction,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';

export type TaskType =
  | 'channel'
  | 'group'
  | 'website'
  | 'x'
  | 'discord'
  | 'tiktok'
  | 'instagram'
  | 'youtube'
  | 'reddit'
  | 'quiz'
  | 'video'
  | 'daily'
  | 'ad';

export interface EForceTask {
  id: string;
  title: string;
  description: string;
  type: TaskType;
  reward: number;        // EForce points
  tokenReward: number;   // EST tokens (optional)
  isEnabled: boolean;
  isMandatory: boolean;  // must complete before optional tasks
  autoApprove: boolean;
  url: string;
  dailyLimit: number;    // max completions per user per day (0 = unlimited)
  totalCompletionLimit: number; // max total completions (0 = unlimited)
  expiryDate: string | null; // ISO date string or null
  answer?: string;       // Correct answer for quiz / text input verification (server validated)
  answerCaseSensitive?: boolean;
  requireSocialConnection?: 'x' | 'discord' | 'tiktok' | 'instagram' | 'youtube' | 'reddit' | 'none';
  requireRewardedAd?: boolean;
  cooldownSeconds?: number;
  completedCount: number;
  createdAt: unknown;

  // User-Created Campaign Task Extensions
  createdBy?: number;
  createdByName?: string;
  status?: 'active' | 'under_review' | 'completed' | 'paused' | 'cancelled';
  escrowedAmount?: number;
  quantityTotal?: number;
  platform?: string;
  actionType?: string;
  minTier?: 'stone' | 'bronze' | 'silver' | 'gold';
  verifiedOnly?: boolean;
  stepsChecklist?: string[];
  inputFields?: string[];
  noteToReviewers?: string;
}

export interface UserTaskRecord {
  taskId: string;
  telegramId: number;
  completedAt: unknown;
  rewardClaimed: boolean;
}

const TASKS_COLLECTION = 'tasks';
const USER_TASKS_COLLECTION = 'userTasks';

/**
 * Subscribe to real-time task list from Firestore (Includes both Admin tasks and User Created Market Tasks).
 * Returns unsubscribe function.
 */
export const subscribeToTasks = (
  callback: (tasks: EForceTask[]) => void
): (() => void) => {
  if (!isFirebaseConfigured()) {
    callback(getDefaultTasks());
    return () => {};
  }

  let adminTasks: EForceTask[] = [];
  let marketTasksList: EForceTask[] = [];

  const emitCombined = () => {
    const combined = [...marketTasksList, ...adminTasks];
    callback(combined);
  };

  // 1. Subscribe to Admin Tasks
  const qAdmin = query(
    collection(db, TASKS_COLLECTION),
    orderBy('createdAt', 'desc')
  );
  const unsubAdmin = onSnapshot(qAdmin, (snap) => {
    adminTasks = [];
    snap.forEach((d) => adminTasks.push({ id: d.id, ...d.data() } as EForceTask));
    emitCombined();
  }, () => {
    adminTasks = [];
    emitCombined();
  });

  // 2. Subscribe to Active User-Created Market Tasks
  const qMarket = query(
    collection(db, 'marketTasks'),
    where('status', '==', 'active')
  );
  const unsubMarket = onSnapshot(qMarket, (snap) => {
    marketTasksList = [];
    snap.forEach((d) => {
      const data = d.data();
      const platformLower = (data.platform || 'website').toLowerCase();
      let type: TaskType = 'website';
      if (platformLower.includes('x') || platformLower.includes('twitter')) type = 'x';
      else if (platformLower.includes('discord')) type = 'discord';
      else if (platformLower.includes('youtube')) type = 'youtube';
      else if (platformLower.includes('telegram')) type = 'channel';
      else if (platformLower.includes('instagram')) type = 'instagram';
      else if (platformLower.includes('tiktok')) type = 'tiktok';
      else if (platformLower.includes('reddit')) type = 'reddit';

      marketTasksList.push({
        id: d.id,
        title: data.title || 'Market Task',
        description: data.description || `Complete ${data.action || 'action'} task`,
        type: type,
        reward: Number(data.reward || 10),
        tokenReward: Number(data.tokenReward || 0),
        isEnabled: data.status === 'active',
        isMandatory: false,
        autoApprove: false,
        url: data.targetUrl || '',
        dailyLimit: 0,
        totalCompletionLimit: Number(data.workerLimit || 0),
        expiryDate: data.expiresAt || null,
        completedCount: Number(data.completedCount || 0),
        createdAt: data.createdAt,
        createdBy: data.creatorTelegramId ? Number(data.creatorTelegramId) : undefined,
        createdByName: data.creatorName,
        status: data.status,
        escrowedAmount: data.totalEscrow,
        quantityTotal: data.workerLimit,
        platform: data.platform,
        actionType: data.action,
        requireSocialConnection: data.requireSocialConnection || undefined,
        requireRewardedAd: data.requireRewardedAd || false,
      });
    });
    emitCombined();
  }, () => {
    marketTasksList = [];
    emitCombined();
  });

  return () => {
    unsubAdmin();
    unsubMarket();
  };
};

/**
 * Admin: Create a new task in Firestore.
 */
export const createTask = async (
  task: Omit<EForceTask, 'id' | 'completedCount' | 'createdAt'>
): Promise<string | null> => {
  if (!isFirebaseConfigured()) return null;
  try {
    const ref = await addDoc(collection(db, TASKS_COLLECTION), {
      ...task,
      completedCount: 0,
      createdAt: serverTimestamp(),
    });
    return ref.id;
  } catch {
    return null;
  }
};

/**
 * Admin: Update an existing task.
 */
export const updateTask = async (
  taskId: string,
  updates: Partial<Omit<EForceTask, 'id' | 'createdAt'>>
): Promise<boolean> => {
  if (!isFirebaseConfigured()) return false;
  try {
    await updateDoc(doc(db, TASKS_COLLECTION, taskId), updates);
    return true;
  } catch {
    return false;
  }
};

/**
 * Admin: Delete a task.
 * Handles both admin tasks (tasks collection) and market tasks (marketTasks collection).
 * For market tasks, sets status to 'cancelled' so they disappear from user views immediately via onSnapshot.
 */
export const deleteTask = async (taskId: string): Promise<boolean> => {
  if (!isFirebaseConfigured()) return false;
  try {
    // First try to delete from admin tasks collection
    const adminRef = doc(db, TASKS_COLLECTION, taskId);
    const { getDoc } = await import('firebase/firestore');
    const adminSnap = await getDoc(adminRef);
    if (adminSnap.exists()) {
      await deleteDoc(adminRef);
      return true;
    }
    // If not found in admin tasks, try marketTasks collection (user-created)
    const marketRef = doc(db, 'marketTasks', taskId);
    const marketSnap = await getDoc(marketRef);
    if (marketSnap.exists()) {
      // Set status to 'cancelled' so onSnapshot removes it from user views
      await updateDoc(marketRef, { status: 'cancelled', cancelledAt: serverTimestamp(), cancelledByAdmin: true });
      return true;
    }
    return false;
  } catch {
    return false;
  }
};

/**
 * Get a user's completed task IDs.
 */
export const getUserCompletedTasks = async (
  telegramId: number
): Promise<Set<string>> => {
  if (!isFirebaseConfigured()) return new Set();
  try {
    const q = query(
      collection(db, USER_TASKS_COLLECTION),
      where('telegramId', '==', telegramId)
    );
    const snap = await getDocs(q);
    const ids = new Set<string>();
    snap.forEach((d) => {
      const rec = d.data() as UserTaskRecord;
      // For daily tasks, only count if completed today
      ids.add(rec.taskId);
    });
    return ids;
  } catch {
    return new Set();
  }
};

/**
 * Subscribe to a user's completed task records in real-time.
 */
export const subscribeToUserTasks = (
  telegramId: number,
  callback: (completedTaskIds: Set<string>) => void
): (() => void) => {
  if (!isFirebaseConfigured()) return () => {};
  const q = query(
    collection(db, USER_TASKS_COLLECTION),
    where('telegramId', '==', telegramId)
  );
  return onSnapshot(q, (snap) => {
    const ids = new Set<string>();
    const today = new Date().toISOString().slice(0, 10);
    snap.forEach((d) => {
      const rec = d.data() as UserTaskRecord;
      // For non-daily tasks always mark complete
      // For daily tasks only if completed today
      const completedDate = rec.completedAt instanceof Timestamp
        ? rec.completedAt.toDate().toISOString().slice(0, 10)
        : today;
      if (completedDate === today || !rec.taskId.startsWith('daily_')) {
        ids.add(rec.taskId);
      }
    });
    callback(ids);
  });
};

/**
 * Claim a task reward for a user.
 * Returns { success, reason }
 */
export const claimTaskReward = async (
  telegramId: number,
  task: EForceTask
): Promise<{ success: boolean; reason?: string }> => {
  if (!isFirebaseConfigured()) {
    return { success: true }; // Dev mode — allow
  }

  // Check expiry
  if (task.expiryDate && new Date(task.expiryDate) < new Date()) {
    return { success: false, reason: 'Task has expired.' };
  }

  // Check total limit
  if (task.totalCompletionLimit > 0 && task.completedCount >= task.totalCompletionLimit) {
    return { success: false, reason: 'Task completion limit reached.' };
  }

  const docId = `${telegramId}_${task.id}`;
  const userTaskRef = doc(db, USER_TASKS_COLLECTION, docId);
  const taskRef = doc(db, TASKS_COLLECTION, task.id);

  try {
    await runTransaction(db, async (transaction) => {
      const existing = await transaction.get(userTaskRef);

      if (existing.exists()) {
        const rec = existing.data() as UserTaskRecord;
        const today = new Date().toISOString().slice(0, 10);

        // For daily tasks: allow repeat if last completion was before today
        if (task.type === 'daily') {
          const lastDate = rec.completedAt instanceof Timestamp
            ? rec.completedAt.toDate().toISOString().slice(0, 10)
            : today;
          if (lastDate === today) {
            throw Object.assign(new Error('Already completed today.'), { code: 'DUPLICATE' });
          }
        } else {
          throw Object.assign(new Error('Task already completed.'), { code: 'DUPLICATE' });
        }
      }

      // Write completion record
      transaction.set(userTaskRef, {
        taskId: task.id,
        telegramId,
        completedAt: serverTimestamp(),
        rewardClaimed: true,
      });

      // Increment global completedCount atomically
      if (!task.id.startsWith('default_')) {
        const taskSnap = await transaction.get(taskRef);
        if (taskSnap.exists()) {
          transaction.update(taskRef, {
            completedCount: (taskSnap.data().completedCount || 0) + 1,
          });
        }
      }
    });

    return { success: true };
  } catch (err: any) {
    if (err?.code === 'DUPLICATE') {
      return { success: false, reason: err.message };
    }
    console.error("Error in claimTaskReward:", err);
    return { success: false, reason: err?.message || 'Network error. Try again.' };
  }
};

/**
 * Verify an X (Twitter) task using official X API via Backend Verification Engine.
 * Rules:
 * 1. Checks OAuth authentication state.
 * 2. Queries X API v2 endpoints (follow, like, repost).
 * 3. Handles "Verification Unavailable" on X API rate limits.
 */
export const verifyXTaskWithBackend = async (
  telegramId: number,
  task: EForceTask,
  botApiUrl?: string
): Promise<{ success: boolean; status?: string; reason?: string; reward?: number }> => {
  const baseUrl = botApiUrl || import.meta.env.VITE_BOT_API_URL || 'https://telegram-bot-backend-zbvn.onrender.com';
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/x/verify-task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telegramId,
        taskId: task.id,
        taskType: task.type,
        targetId: task.url || 'EliteForceToken',
        rewardAmount: task.reward,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return data;
    } else {
      const errJson = await res.json().catch(() => ({}));
      return {
        success: false,
        status: errJson.status || 'ERROR',
        reason: errJson.reason || errJson.error || 'X Task verification failed.',
      };
    }
  } catch (err: any) {
    console.warn('[taskService] verifyXTaskWithBackend fallback error:', err);
    return {
      success: false,
      status: 'Verification Unavailable',
      reason: 'Could not connect to X Verification Engine. Verification skipped.',
    };
  }
};

/**
 * Universal Server-Side Task Verification & Reward Engine Endpoint.
 * Validates Answer, Social OAuth Connection, Rewarded Ad Completion, Cooldown, & Duplicate Prevention on Server.
 */
export const verifyTaskWithServer = async (
  telegramId: number,
  task: EForceTask,
  userAnswer?: string,
  adCompleted?: boolean,
  botApiUrl?: string
): Promise<{ success: boolean; reward?: number; tokenReward?: number; error?: string; reason?: string; requirePlatform?: string }> => {
  const baseUrl = botApiUrl ? botApiUrl.replace(/\/$/, '') : (import.meta.env.VITE_BOT_API_URL || 'https://telegram-bot-backend-zbvn.onrender.com');
  try {
    const res = await fetch(`${baseUrl}/api/tasks/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telegramId,
        taskId: task.id,
        taskType: task.type,
        userAnswer: userAnswer || '',
        adCompleted: !!adCompleted,
        requireSocialConnection: task.requireSocialConnection || 'none',
      }),
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    console.warn('[taskService] verifyTaskWithServer error:', err);
    return {
      success: false,
      error: err.message || 'Server connection error during task verification.',
    };
  }
};

/**
 * Verifies if user has joined a Telegram channel or group via backend bot API.
 */
export const checkTelegramMembership = async (
  telegramId: number,
  chatIdOrUrl: string,
  botApiUrl = ''
): Promise<{ isMember: boolean; reason?: string }> => {
  if (!telegramId || !chatIdOrUrl) return { isMember: true };

  // Extract handle from full t.me URL if needed
  let chatId = chatIdOrUrl.trim();
  if (chatId.includes('t.me/')) {
    const parts = chatId.split('t.me/')[1].split('?')[0].split('/')[0].replace('+', '');
    chatId = parts ? `@${parts}` : chatId;
  }

  if (botApiUrl) {
    try {
      const res = await fetch(`${botApiUrl.replace(/\/$/, '')}/check-membership`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId, chatId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (typeof data.isMember === 'boolean') {
          return {
            isMember: data.isMember,
            reason: data.isMember ? undefined : `You have not joined ${chatId} yet. Please join first!`
          };
        }
      }
    } catch (err) {
      console.warn('[TelegramCheck] Failed calling bot API:', err);
    }
  }

  // Fallback to true if bot API not configured
  return { isMember: true };
};

/**
 * Default tasks to show when Firestore is not configured or empty.
 */
const getDefaultTasks = (): EForceTask[] => [
  {
    id: 'default_1',
    title: 'Join Telegram Channel',
    description: 'Join the official Elite Force channel',
    type: 'channel',
    reward: 500,
    tokenReward: 0,
    isEnabled: true,
    isMandatory: true,
    autoApprove: true,
    url: 'https://t.me/EliteForceChannel',
    dailyLimit: 0,
    totalCompletionLimit: 1,
    expiryDate: null,
    completedCount: 0,
    createdAt: null,
  },
  {
    id: 'default_2',
    title: 'Join Official Discussion Group',
    description: 'Join the Elite Force community group',
    type: 'group',
    reward: 500,
    tokenReward: 0,
    isEnabled: true,
    isMandatory: true,
    autoApprove: true,
    url: 'https://t.me/EliteForceGroup',
    dailyLimit: 0,
    totalCompletionLimit: 1,
    expiryDate: null,
    completedCount: 0,
    createdAt: null,
  },
  {
    id: 'default_3',
    title: 'Follow Elite Force on X',
    description: 'Follow our official X account',
    type: 'x',
    reward: 800,
    tokenReward: 0,
    isEnabled: true,
    isMandatory: false,
    autoApprove: true,
    url: 'https://x.com/EliteForce',
    dailyLimit: 0,
    totalCompletionLimit: 1,
    expiryDate: null,
    completedCount: 0,
    createdAt: null,
  },
  {
    id: 'default_4',
    title: 'Daily Check-in',
    description: 'Complete your daily check-in to earn rewards',
    type: 'daily',
    reward: 200,
    tokenReward: 0,
    isEnabled: true,
    isMandatory: false,
    autoApprove: true,
    url: '',
    dailyLimit: 1,
    totalCompletionLimit: 0,
    expiryDate: null,
    completedCount: 0,
    createdAt: null,
  },
];

/**
 * Create a new User-Funded Campaign Task with Escrow deduction.
 */
export const createUserCampaignTask = async (
  telegramId: number,
  taskData: Omit<EForceTask, 'id' | 'completedCount' | 'createdAt'>,
  totalEscrow: number
): Promise<{ success: boolean; taskId?: string; reason?: string }> => {
  if (!isFirebaseConfigured()) {
    return { success: false, reason: 'Firebase not configured' };
  }

  try {
    const userRef = doc(db, 'users', String(telegramId));
    let newTaskId = '';

    await runTransaction(db, async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) {
        throw new Error('User profile not found.');
      }

      const userData = userSnap.data();
      const currentPoints = Number(userData.points || 0);

      if (currentPoints < totalEscrow) {
        throw new Error(`Insufficient balance. Required: ${totalEscrow} EFC, Current: ${currentPoints} EFC`);
      }

      // Deduct escrow
      transaction.update(userRef, { points: currentPoints - totalEscrow });

      // Create Task doc
      const newTaskRef = doc(collection(db, TASKS_COLLECTION));
      newTaskId = newTaskRef.id;

      transaction.set(newTaskRef, {
        ...taskData,
        createdBy: telegramId,
        escrowedAmount: totalEscrow,
        completedCount: 0,
        createdAt: serverTimestamp(),
      });
    });

    return { success: true, taskId: newTaskId };
  } catch (err: any) {
    console.error('[createUserCampaignTask] Error:', err);
    return { success: false, reason: err?.message || 'Failed to create campaign task.' };
  }
};

/**
 * Subscribe to tasks created by a specific user.
 */
export const subscribeToUserCreatedTasks = (
  telegramId: number,
  callback: (tasks: EForceTask[]) => void
): (() => void) => {
  if (!isFirebaseConfigured()) {
    callback([]);
    return () => {};
  }
  const q = query(
    collection(db, TASKS_COLLECTION),
    where('createdBy', '==', telegramId)
  );
  return onSnapshot(
    q,
    (snap) => {
      const tasks: EForceTask[] = [];
      snap.forEach((d) => tasks.push({ id: d.id, ...d.data() } as EForceTask));
      callback(tasks);
    },
    () => callback([])
  );
};

/**
 * Update user campaign status (Pause / Resume / Cancel & Refund)
 */
export const updateUserCampaignStatus = async (
  telegramId: number,
  taskId: string,
  newStatus: 'active' | 'paused' | 'cancelled'
): Promise<{ success: boolean; refundedAmount?: number; reason?: string }> => {
  if (!isFirebaseConfigured()) return { success: false, reason: 'Firebase not configured' };

  try {
    const taskRef = doc(db, TASKS_COLLECTION, taskId);
    const userRef = doc(db, 'users', String(telegramId));
    let refunded = 0;

    await runTransaction(db, async (transaction) => {
      const taskSnap = await transaction.get(taskRef);
      if (!taskSnap.exists()) throw new Error('Task not found.');

      const taskData = taskSnap.data() as EForceTask;
      if (taskData.createdBy !== telegramId) {
        throw new Error('Unauthorized.');
      }

      if (newStatus === 'cancelled') {
        const total = taskData.totalCompletionLimit || 1;
        const done = taskData.completedCount || 0;
        const remaining = Math.max(0, total - done);
        const escrow = taskData.escrowedAmount || 0;
        refunded = Math.round((escrow / total) * remaining);

        const userSnap = await transaction.get(userRef);
        if (userSnap.exists()) {
          const curPoints = Number(userSnap.data()?.points || 0);
          transaction.update(userRef, { points: curPoints + refunded });
        }

        transaction.update(taskRef, { status: 'cancelled', isEnabled: false });
      } else {
        transaction.update(taskRef, {
          status: newStatus,
          isEnabled: newStatus === 'active',
        });
      }
    });

    return { success: true, refundedAmount: refunded };
  } catch (err: any) {
    return { success: false, reason: err?.message || 'Failed to update campaign.' };
  }
};

