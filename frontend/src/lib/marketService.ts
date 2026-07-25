// Market Service — all Market API calls
const BOT_API = () => {
  const stored = localStorage.getItem('adminSettings');
  if (stored) {
    try {
      const s = JSON.parse(stored);
      if (s.botApiUrl) return s.botApiUrl.replace(/\/$/, '');
    } catch { /* ignore */ }
  }
  return import.meta.env.VITE_BOT_API_URL || '';
};

export interface MarketTask {
  id: string;
  title: string;
  description: string;
  instructions: string;
  platform: string;
  action: string;
  targetUrl: string;
  reward: number;
  workerLimit: number;
  dailyLimit: number;
  cooldownHours: number;
  expiryDays: number;
  budget: number;
  totalEscrow: number;
  platformFee: number;
  verificationFee: number;
  verificationType: 'automatic' | 'manual' | 'hybrid';
  status: 'pending_review' | 'active' | 'paused' | 'completed' | 'rejected' | 'expired' | 'draft';
  creatorTelegramId: number;
  creatorName: string;
  completedCount: number;
  remainingSlots: number;
  exampleImages: string[];
  checklist: string[];
  inputFields: string[];
  audience: {
    type: 'everyone' | 'level' | 'premium' | 'country';
    minLevel?: number;
    countries?: string[];
    premiumOnly?: boolean;
    minBalance?: number;
  };
  featured: boolean;
  trending: boolean;
  createdAt: string;
  expiresAt: string;
  views: number;
  completionRate: number;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface TaskSubmission {
  id: string;
  taskId: string;
  taskTitle: string;
  platform: string;
  workerTelegramId: number;
  status: 'started' | 'submitted' | 'pending_review' | 'approved' | 'rejected';
  reward: number;
  proofUrl?: string;
  proofText?: string;
  inputValues?: Record<string, string>;
  rejectionReason?: string;
  submittedAt?: string;
  reviewedAt?: string;
  createdAt: string;
}

export interface CreateTaskPayload {
  telegramId: number;
  platform: string;
  action: string;
  targetUrl: string;
  title: string;
  description: string;
  instructions: string;
  exampleImages: string[];
  checklist: string[];
  inputFields: string[];
  reward: number;
  workerLimit: number;
  dailyLimit: number;
  cooldownHours: number;
  expiryDays: number;
  audience: MarketTask['audience'];
  verificationType: MarketTask['verificationType'];
}

export interface DiscoverFilters {
  platform?: string;
  minReward?: number;
  maxReward?: number;
  difficulty?: string;
  sort?: 'newest' | 'highest_reward' | 'lowest_reward' | 'ending_soon' | 'trending';
  verifiedOnly?: boolean;
  page?: number;
  limit?: number;
  search?: string;
}

// ── API Functions ─────────────────────────────────────────────────────────────

export async function fetchDiscoverTasks(filters: DiscoverFilters = {}): Promise<{ tasks: MarketTask[]; total: number; hasMore: boolean }> {
  try {
    const params = new URLSearchParams();
    if (filters.platform) params.set('platform', filters.platform);
    if (filters.minReward !== undefined) params.set('minReward', String(filters.minReward));
    if (filters.maxReward !== undefined) params.set('maxReward', String(filters.maxReward));
    if (filters.difficulty) params.set('difficulty', filters.difficulty);
    if (filters.sort) params.set('sort', filters.sort);
    if (filters.verifiedOnly) params.set('verifiedOnly', 'true');
    if (filters.page) params.set('page', String(filters.page));
    if (filters.limit) params.set('limit', String(filters.limit || 20));
    if (filters.search) params.set('search', filters.search);

    const res = await fetch(`${BOT_API()}/api/market/tasks/discover?${params}`);
    if (!res.ok) throw new Error('Failed to fetch tasks');
    return await res.json();
  } catch {
    return { tasks: [], total: 0, hasMore: false };
  }
}

export async function fetchTaskDetail(taskId: string): Promise<MarketTask | null> {
  try {
    const res = await fetch(`${BOT_API()}/api/market/tasks/${taskId}`);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

export async function fetchMyTasks(telegramId: number): Promise<TaskSubmission[]> {
  try {
    const res = await fetch(`${BOT_API()}/api/market/tasks/my?telegramId=${telegramId}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.submissions || [];
  } catch { return []; }
}

export async function fetchCreatedTasks(telegramId: number): Promise<MarketTask[]> {
  try {
    const res = await fetch(`${BOT_API()}/api/market/tasks/created?telegramId=${telegramId}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.tasks || [];
  } catch { return []; }
}

export async function createMarketTask(payload: CreateTaskPayload): Promise<{ ok: boolean; taskId?: string; error?: string; insufficientBalance?: boolean }> {
  try {
    const res = await fetch(`${BOT_API()}/api/market/tasks/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return data;
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : 'Network error' };
  }
}

export async function startTask(taskId: string, telegramId: number): Promise<{ ok: boolean; submissionId?: string; error?: string }> {
  try {
    const res = await fetch(`${BOT_API()}/api/market/tasks/${taskId}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramId }),
    });
    return await res.json();
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : 'Network error' };
  }
}

export async function submitTaskProof(
  taskId: string,
  telegramId: number,
  proof: { proofUrl?: string; proofText?: string; inputValues?: Record<string, string> }
): Promise<{ ok: boolean; status?: string; reward?: number; error?: string }> {
  try {
    const res = await fetch(`${BOT_API()}/api/market/tasks/${taskId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramId, ...proof }),
    });
    return await res.json();
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : 'Network error' };
  }
}

export async function pauseTask(taskId: string, telegramId: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${BOT_API()}/api/market/tasks/${taskId}/pause`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramId }),
    });
    return await res.json();
  } catch { return { ok: false, error: 'Network error' }; }
}

export async function resumeTask(taskId: string, telegramId: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${BOT_API()}/api/market/tasks/${taskId}/resume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramId }),
    });
    return await res.json();
  } catch { return { ok: false, error: 'Network error' }; }
}

export async function cancelTask(taskId: string, telegramId: number): Promise<{ ok: boolean; refundAmount?: number; error?: string }> {
  try {
    const res = await fetch(`${BOT_API()}/api/market/tasks/${taskId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramId }),
    });
    return await res.json();
  } catch { return { ok: false, error: 'Network error' }; }
}

export async function fetchTaskAnalytics(taskId: string, telegramId: number): Promise<{
  views: number; clicks: number; starts: number; completed: number; failed: number;
  conversionRate: number; avgCompletionTime: number; rewardDistributed: number; remaining: number;
} | null> {
  try {
    const res = await fetch(`${BOT_API()}/api/market/tasks/${taskId}/analytics?telegramId=${telegramId}`);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

// Cost calculation (client-side, matches backend)
export function calculateTaskCost(reward: number, workers: number, verificationType: string, expiryDays: number) {
  const PLATFORM_FEE_RATE = 0.25;
  const VERIFICATION_FEE_PER_WORKER = verificationType === 'manual' ? 1.5 : verificationType === 'hybrid' ? 1.0 : 0.5;

  const rewardPool = reward * workers;
  const platformFee = rewardPool * PLATFORM_FEE_RATE;
  const verificationFee = VERIFICATION_FEE_PER_WORKER * workers;
  const escrowTotal = rewardPool + platformFee + verificationFee;
  const dailyCost = escrowTotal / Math.max(1, expiryDays);

  return {
    rewardPool,
    platformFee,
    verificationFee,
    escrowTotal,
    dailyCost,
    platformFeeRate: PLATFORM_FEE_RATE,
  };
}

export const PLATFORMS = [
  { id: 'X', icon: '𝕏', color: '#FFFFFF' },
  { id: 'Instagram', icon: '📸', color: '#E1306C' },
  { id: 'Telegram', icon: '✈️', color: '#2AABEE' },
  { id: 'WhatsApp', icon: '💬', color: '#25D366' },
  { id: 'Discord', icon: '🎮', color: '#5865F2' },
  { id: 'TikTok', icon: '🎵', color: '#FF0050' },
  { id: 'YouTube', icon: '▶️', color: '#FF0000' },
  { id: 'Reddit', icon: '🔴', color: '#FF4500' },
  { id: 'Google', icon: '📍', color: '#4285F4' },
  { id: 'Apps', icon: '📲', color: '#F59E0B' },
  { id: 'Custom', icon: '✏️', color: '#64748B' },
];

export const PLATFORM_ACTIONS: Record<string, { label: string; icon: string; baseReward: number }[]> = {
  X: [
    { label: 'Like', icon: '❤️', baseReward: 3 },
    { label: 'Repost', icon: '🔁', baseReward: 5 },
    { label: 'Bookmark', icon: '🔖', baseReward: 3 },
    { label: 'Reply', icon: '💬', baseReward: 7 },
    { label: 'Views (20/1k)', icon: '👁️', baseReward: 20 },
    { label: 'Follow', icon: '➕', baseReward: 5 },
    { label: 'Quote', icon: '✏️', baseReward: 7 },
  ],
  Instagram: [
    { label: 'Like', icon: '❤️', baseReward: 3 },
    { label: 'Follow', icon: '➕', baseReward: 5 },
    { label: 'Comment', icon: '💬', baseReward: 6 },
    { label: 'Share Story', icon: '📸', baseReward: 7 },
    { label: 'Reel View', icon: '▶️', baseReward: 4 },
  ],
  Telegram: [
    { label: 'Join Channel', icon: '✈️', baseReward: 3 },
    { label: 'Join Group', icon: '👥', baseReward: 3 },
    { label: 'Join Bot', icon: '🤖', baseReward: 2 },
    { label: 'React to Post', icon: '⭐', baseReward: 2 },
    { label: 'Share Story', icon: '📷', baseReward: 4 },
  ],
  WhatsApp: [
    { label: 'Join Channel', icon: '💬', baseReward: 3 },
    { label: 'Join Group', icon: '👥', baseReward: 3 },
    { label: 'Message Bot', icon: '🤖', baseReward: 3 },
  ],
  Discord: [
    { label: 'Join Server', icon: '🎮', baseReward: 4 },
    { label: 'React to Message', icon: '😀', baseReward: 2 },
    { label: 'Send Message', icon: '💬', baseReward: 5 },
  ],
  TikTok: [
    { label: 'Follow', icon: '➕', baseReward: 5 },
    { label: 'Like Video', icon: '❤️', baseReward: 3 },
    { label: 'Comment', icon: '💬', baseReward: 6 },
    { label: 'Share', icon: '🔗', baseReward: 7 },
  ],
  YouTube: [
    { label: 'Subscribe', icon: '🔔', baseReward: 6 },
    { label: 'Like Video', icon: '👍', baseReward: 3 },
    { label: 'Comment', icon: '💬', baseReward: 7 },
    { label: 'Watch Video', icon: '▶️', baseReward: 5 },
  ],
  Reddit: [
    { label: 'Upvote Post', icon: '⬆️', baseReward: 3 },
    { label: 'Join Subreddit', icon: '👥', baseReward: 4 },
    { label: 'Comment', icon: '💬', baseReward: 5 },
  ],
  Google: [
    { label: 'Review Business', icon: '⭐', baseReward: 10 },
    { label: 'Search & Click', icon: '🔍', baseReward: 5 },
  ],
  Apps: [
    { label: 'Download & Install', icon: '📲', baseReward: 15 },
    { label: 'Register Account', icon: '📝', baseReward: 12 },
    { label: 'Rate App (5 Stars)', icon: '⭐', baseReward: 10 },
  ],
  Custom: [
    { label: 'Do task', icon: '✏️', baseReward: 10 },
  ],
};

