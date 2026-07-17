// Firestore Task Service — Elite Force (EForce)
// Handles CRUD for tasks (admin) and task completion tracking (users)

import {
  collection,
  doc,
  getDoc,
  setDoc,
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
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';

export type TaskType =
  | 'channel'
  | 'group'
  | 'website'
  | 'x'
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
  autoApprove: boolean;
  url: string;
  dailyLimit: number;    // max completions per user per day (0 = unlimited)
  totalCompletionLimit: number; // max total completions (0 = unlimited)
  expiryDate: string | null; // ISO date string or null
  completedCount: number;
  createdAt: unknown;
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
 * Subscribe to real-time task list from Firestore.
 * Returns unsubscribe function.
 */
export const subscribeToTasks = (
  callback: (tasks: EForceTask[]) => void
): (() => void) => {
  if (!isFirebaseConfigured()) {
    callback(getDefaultTasks());
    return () => {};
  }
  const q = query(
    collection(db, TASKS_COLLECTION),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snap) => {
    const tasks: EForceTask[] = [];
    snap.forEach((d) => tasks.push({ id: d.id, ...d.data() } as EForceTask));
    callback(tasks);
  }, () => callback([]));
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
 */
export const deleteTask = async (taskId: string): Promise<boolean> => {
  if (!isFirebaseConfigured()) return false;
  try {
    await deleteDoc(doc(db, TASKS_COLLECTION, taskId));
    return true;
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

  try {
    const existing = await getDoc(userTaskRef);
    if (existing.exists()) {
      const rec = existing.data() as UserTaskRecord;
      const today = new Date().toISOString().slice(0, 10);

      // For daily tasks: allow repeat if last completion was before today
      if (task.type === 'daily') {
        const lastDate = rec.completedAt instanceof Timestamp
          ? rec.completedAt.toDate().toISOString().slice(0, 10)
          : today;
        if (lastDate === today) {
          return { success: false, reason: 'Already completed today.' };
        }
      } else {
        return { success: false, reason: 'Task already completed.' };
      }
    }

    // Write completion record
    await setDoc(userTaskRef, {
      taskId: task.id,
      telegramId,
      completedAt: serverTimestamp(),
      rewardClaimed: true,
    });

    // Increment global completedCount
    await updateDoc(doc(db, TASKS_COLLECTION, task.id), {
      completedCount: (task.completedCount || 0) + 1,
    });

    return { success: true };
  } catch {
    return { success: false, reason: 'Network error. Try again.' };
  }
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
    autoApprove: true,
    url: '',
    dailyLimit: 1,
    totalCompletionLimit: 0,
    expiryDate: null,
    completedCount: 0,
    createdAt: null,
  },
];
