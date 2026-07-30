import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Timestamp } from 'firebase/firestore';
import {
  Check, X, Search, Ban, Edit3, Save,
  RefreshCw, Plus, Trash2, ToggleLeft, ToggleRight,
  Star, ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  ArrowUpDown, ShieldAlert, Trophy, Eye, EyeOff, Upload,
  Copy, ExternalLink, Wallet, ShieldCheck, Clock, CheckCircle2, Info, Send, Lock, Users,
} from 'lucide-react';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { AdminSidebar } from '../components/admin/AdminSidebar';
import { AdminHeader } from '../components/admin/AdminHeader';
import { AdminDashboard, getCountryFlag } from '../components/admin/AdminDashboard';
import type { AdminTab } from '../components/admin/AdminSidebar';
import {
  getAllUsers, updateUserDatabaseValues, getTotalUserCount,
  getTodayNewUsersCount, getFlaggedUsersCount, getBannedUsersCount,
  getPremiumUsersCount, getAutoMinerUsersCount, getOnlineUserCount,
  updateWithdrawRequest, subscribeToWithdrawRequests,
  subscribeToDepositRequests, updateDepositRequest, type DepositRecord,
  flagUser, adminSetBan, logAdminAction,
  adminPinUser, adminRemoveUser, adminAddUser, adminResetLeaderboard,
  type FirestoreUser, subscribeToAllUsers, adminHideUser, normalizeCountryName,
} from '../lib/userService';
import {
  subscribeToTasks, createTask, updateTask, deleteTask, type EForceTask, type TaskType,
} from '../lib/taskService';
import {
  subscribeToAdminSettings, saveAdminSettings, DEFAULT_ADMIN_SETTINGS, type AdminSettings,
} from '../lib/adminSettingsService';
import {
  subscribeToReferralTiers, createReferralTier, updateReferralTier, deleteReferralTier, reorderReferralTiers, getTierBadgeWithIcon, type ReferralClaimTier,
} from '../lib/referralTierService';
import {
  sendWithdrawNotification,
  sendDepositNotification,
} from '../lib/notificationService';
import { uploadFile } from '../lib/uploadService';
import {
  fetchPendingMarketTasks, approveMarketTask, rejectMarketTask, type MarketTask,
} from '../lib/marketService';

interface AdminProps {
  showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  liveUserCount: number;
}

type SortField = 'points' | 'tokens' | 'firstName' | 'referrals';
type SortDir = 'asc' | 'desc';
type UserFilter = 'all' | 'online' | 'premium' | 'flagged' | 'banned';

const PAGE_SIZE = 10;

// ── Shared style tokens ──────────────────────────────────────────────────────
const inputCls = 'w-full h-9 rounded-xl px-3 text-xs text-white outline-none transition-all focus:ring-1 focus:ring-[#FF8A00]/40';
const inputStyle = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' };
const panelStyle = { background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' };

// ── Premium Buttons ──────────────────────────────────────────────────────────
const Btn = {
  /** Orange gradient CTA (Save / Create) */
  primary: 'inline-flex items-center justify-center gap-2 font-bold cursor-pointer transition-all active:scale-[0.97] disabled:opacity-40',
  /** Red danger (Delete / Ban / Reset) */
  danger: 'inline-flex items-center justify-center gap-2 font-bold cursor-pointer transition-all active:scale-[0.97]',
  /** Amber warning (Flag) */
  warning: 'inline-flex items-center justify-center gap-2 font-bold cursor-pointer transition-all active:scale-[0.97]',
  /** Green success (Approve / Unban) */
  success: 'inline-flex items-center justify-center gap-2 font-bold cursor-pointer transition-all active:scale-[0.97]',
  /** Indigo edit (Edit) */
  edit: 'inline-flex items-center justify-center gap-2 font-bold cursor-pointer transition-all active:scale-[0.97]',
  /** Ghost neutral (Cancel / Refresh) */
  ghost: 'inline-flex items-center justify-center gap-2 font-bold cursor-pointer transition-all active:scale-[0.97]',
};

const btnStyle = {
  primary: {
    background: 'linear-gradient(135deg, #FF8A00, #FFB347)',
    boxShadow: '0 0 20px rgba(255,138,0,0.35), 0 4px 12px rgba(255,138,0,0.2)',
    color: '#fff',
    border: 'none',
  } as React.CSSProperties,
  danger: {
    background: 'rgba(248,113,113,0.12)',
    border: '1px solid rgba(248,113,113,0.35)',
    color: '#F87171',
    boxShadow: '0 0 12px rgba(248,113,113,0.15)',
  } as React.CSSProperties,
  warning: {
    background: 'rgba(251,191,36,0.12)',
    border: '1px solid rgba(251,191,36,0.35)',
    color: '#FBBF24',
    boxShadow: '0 0 10px rgba(251,191,36,0.15)',
  } as React.CSSProperties,
  success: {
    background: 'rgba(16,185,129,0.12)',
    border: '1px solid rgba(16,185,129,0.3)',
    color: '#34D399',
  } as React.CSSProperties,
  edit: {
    background: 'rgba(59,130,246,0.12)',
    border: '1px solid rgba(59,130,246,0.3)',
    color: '#60A5FA',
  } as React.CSSProperties,
  ghost: {
    background: '#181F2E',
    border: '1px solid #1E293B',
    color: '#CBD5E1',
  } as React.CSSProperties,
};

// ── Image with fallback component ────────────────────────────────────────────
const ImageWithFallback = ({ src, fallbackLetter, className }: { src: string; fallbackLetter: string; className?: string }) => {
  const [error, setError] = useState(false);
  useEffect(() => {
    setError(false);
  }, [src]);
  if (!src || error) {
    return <span className="uppercase">{fallbackLetter}</span>;
  }
  return (
    <img
      src={src}
      alt=""
      className={className}
      onError={() => setError(true)}
    />
  );
};

// ── Sort button (module-scoped) ───────────────────────────────────────────────
const SortBtn = ({ field, label, sortField, sortDir, handleSort }: { field: SortField; label: string; sortField: SortField; sortDir: SortDir; handleSort: (f: SortField) => void }) => (
  <button onClick={() => handleSort(field)} className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 hover:text-white transition-colors cursor-pointer group">
    <span>{label}</span>
    {sortField === field
      ? (sortDir === 'asc' ? <ChevronUp size={10} className="text-blue-400" /> : <ChevronDown size={10} className="text-blue-400" />)
      : <ArrowUpDown size={9} className="opacity-40 group-hover:opacity-80" />}
  </button>
);

// ── Toggle Switch (module-scoped) ─────────────────────────────────────────────
const Toggle = ({ on, onToggle, accentColor = '#4ADE80' }: { on: boolean; onToggle: () => void; accentColor?: string }) => (
  <button
    onClick={onToggle}
    className="relative w-11 h-6 rounded-full transition-all cursor-pointer shrink-0"
    style={{ background: on ? accentColor : 'rgba(255,255,255,0.1)', boxShadow: on ? `0 0 10px ${accentColor}50` : 'none' }}
  >
    <div
      className="absolute top-[3px] w-[18px] h-[18px] bg-white rounded-full shadow-md transition-all duration-200"
      style={{ left: on ? 23 : 3 }}
    />
  </button>
);

// ── Section card wrapper (module-scoped) ─────────────────────────────────────
const SectionCard = ({ children, accentColor = 'rgba(255,138,0,0.5)' }: { children: React.ReactNode; accentColor?: string }) => (
  <div
    className="rounded-[22px] overflow-hidden relative"
    style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}
  >
    {/* Colored top accent line */}
    <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-[22px]"
      style={{ background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)` }} />
    {children}
  </div>
);

export const Admin: React.FC<AdminProps> = ({ showToast, liveUserCount }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // --- Dashboard KPIs ---
  const [kpi, setKpi] = useState({ total: 0, online: 0, premium: 0, normal: 0, newToday: 0, flagged: 0, banned: 0, autoMiners: 0 });
  const [loadingKpi, setLoadingKpi] = useState(true);

  const fetchKpis = async () => {
    setLoadingKpi(true);
    const [total, online, premium, newToday, flagged, banned, autoMiners] = await Promise.all([
      getTotalUserCount(), getOnlineUserCount(), getPremiumUsersCount(),
      getTodayNewUsersCount(), getFlaggedUsersCount(), getBannedUsersCount(), getAutoMinerUsersCount(),
    ]);
    setKpi({ total, online, premium, normal: Math.max(0, total - premium), newToday, flagged, banned, autoMiners });
    setLoadingKpi(false);
  };

  useEffect(() => { fetchKpis(); const t = setInterval(fetchKpis, 30000); return () => clearInterval(t); }, []);

  // --- Users ---
  const [usersList, setUsersList] = useState<FirestoreUser[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [userFilter, setUserFilter] = useState<UserFilter>('all');
  const [sortField, setSortField] = useState<SortField>('points');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);
  const [editingUser, setEditingUser] = useState<FirestoreUser | null>(null);
  const [editPoints, setEditPoints] = useState(0);
  const [editTokens, setEditTokens] = useState(0);
  const [editWallet, setEditWallet] = useState(0);
  const [editReferrals, setEditReferrals] = useState(0);
  const [editRiskLevel, setEditRiskLevel] = useState<'safe' | 'medium' | 'high'>('safe');
  const [editBanStatus, setEditBanStatus] = useState<'none' | 'temp' | 'permanent'>('none');
  const [editBanDuration, setEditBanDuration] = useState<number>(24);
  const [editLeaderboardPinned, setEditLeaderboardPinned] = useState(false);
  const [editLeaderboardHidden, setEditLeaderboardHidden] = useState(false);
  const [editIsVerified, setEditIsVerified] = useState(false);
  const [editPhotoUrl, setEditPhotoUrl] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // --- Admin Settings & Market Access State ---
  const [marketStatus, setMarketStatus] = useState<'on' | 'off' | 'maintenance'>('on');
  const [marketMaintenanceUntil, setMarketMaintenanceUntil] = useState('');
  const [marketLockReason, setMarketLockReason] = useState('');
  const [savingMarketSettings, setSavingMarketSettings] = useState(false);
  const [pendingMarketTasks, setPendingMarketTasks] = useState<MarketTask[]>([]);
  const [loadingPendingMarket, setLoadingPendingMarket] = useState<boolean>(false);

  const loadPendingMarketTasks = React.useCallback(async () => {
    setLoadingPendingMarket(true);
    const tasks = await fetchPendingMarketTasks();
    setPendingMarketTasks(tasks);
    setLoadingPendingMarket(false);
  }, []);

  useEffect(() => {
    if (activeTab === 'market') {
      loadPendingMarketTasks();
    }
  }, [activeTab, loadPendingMarketTasks]);

  // Market Fee & BEP-20 Deposit Settings State
  const [marketServiceFeePercent, setMarketServiceFeePercent] = useState<number>(25);
  const [marketReviewFee, setMarketReviewFee] = useState<number>(10);
  const [marketVerificationFeeManual, setMarketVerificationFeeManual] = useState<number>(1.5);
  const [marketVerificationFeeAuto, setMarketVerificationFeeAuto] = useState<number>(0.5);

  const [bep20DepositAddress, setBep20DepositAddress] = useState<string>('0x0000000000000000000000000000000000000000');
  const [bep20DepositRate, setBep20DepositRate] = useState<number>(100);
  const [bep20DepositMinAmount, setBep20DepositMinAmount] = useState<number>(1.0);
  const [bep20DepositInstructions, setBep20DepositInstructions] = useState<string>('Send USDT (BEP-20 / BSC Network) to the address below, then submit your transaction hash (TxHash) for verification.');
  const [depositRequests, setDepositRequests] = useState<DepositRecord[]>([]);

  useEffect(() => {
    const unsub = subscribeToAdminSettings((s) => {
      setMarketStatus(s.marketStatus || 'on');
      setMarketMaintenanceUntil(s.marketMaintenanceUntil || '');
      setMarketLockReason(s.marketLockReason || 'Task Market is currently undergoing system maintenance and campaign security audits.');
      setMarketServiceFeePercent(s.marketServiceFeePercent ?? 25);
      setMarketReviewFee(s.marketReviewFee ?? 10);
      setMarketVerificationFeeManual(s.marketVerificationFeeManual ?? 1.5);
      setMarketVerificationFeeAuto(s.marketVerificationFeeAuto ?? 0.5);
      setBep20DepositAddress(s.bep20DepositAddress || '');
      setBep20DepositRate(s.bep20DepositRate ?? 100);
      setBep20DepositMinAmount(s.bep20DepositMinAmount ?? 1.0);
      setBep20DepositInstructions(s.bep20DepositInstructions || 'Send USDT (BEP-20 / BSC Network) to the address below, then submit your transaction hash (TxHash) for verification.');
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = subscribeToDepositRequests((list) => {
      setDepositRequests(list);
    });
    return () => unsub();
  }, []);

  const handleSetMarketTimerPreset = (minutes: number) => {
    const future = new Date(Date.now() + minutes * 60000).toISOString();
    setMarketMaintenanceUntil(future);
    setMarketStatus('maintenance');
  };

  const handleSaveMarketSettings = async () => {
    setSavingMarketSettings(true);
    const success = await saveAdminSettings({
      marketStatus,
      marketMaintenanceUntil: marketStatus === 'on' ? '' : marketMaintenanceUntil,
      marketLockReason,
      marketServiceFeePercent: Number(marketServiceFeePercent),
      marketReviewFee: Number(marketReviewFee),
      marketVerificationFeeManual: Number(marketVerificationFeeManual),
      marketVerificationFeeAuto: Number(marketVerificationFeeAuto),
      bep20DepositAddress,
      bep20DepositRate: Number(bep20DepositRate),
      bep20DepositMinAmount: Number(bep20DepositMinAmount),
      bep20DepositInstructions,
    });
    setSavingMarketSettings(false);
    if (success) {
      showToast('Market fees & BEP-20 deposit settings updated!', 'success');
    } else {
      showToast('Failed to update Market settings', 'error');
    }
  };

  // --- Referral Claim Limit Manager State ---
  const [referralTiers, setReferralTiers] = useState<ReferralClaimTier[]>([]);
  const [newTierRefs, setNewTierRefs] = useState<number>(5);
  const [newTierLimit, setNewTierLimit] = useState<number>(10000);
  const [newTierBonus, setNewTierBonus] = useState<number>(0.05);
  const [newTierBadge, setNewTierBadge] = useState<string>('🥉 Bronze');
  const [editingTierId, setEditingTierId] = useState<string | null>(null);
  const [editTierRefs, setEditTierRefs] = useState<number>(0);
  const [editTierLimit, setEditTierLimit] = useState<number>(0);
  const [editTierBonus, setEditTierBonus] = useState<number>(0);
  const [editTierBadge, setEditTierBadge] = useState<string>('');

  useEffect(() => {
    const unsub = subscribeToReferralTiers(setReferralTiers);
    return unsub;
  }, []);

  const handleAddReferralTier = async () => {
    if (newTierRefs < 0 || newTierLimit <= 0) {
      showToast('Please enter valid required referrals and claim limit.', 'warning');
      return;
    }
    const maxSort = referralTiers.reduce((max, t) => Math.max(max, t.sortOrder || 0), 0);
    const newId = await createReferralTier({
      requiredReferrals: Number(newTierRefs),
      claimLimit: Number(newTierLimit),
      bonusUSDT: Number(newTierBonus),
      badge: newTierBadge.trim() || '⚡ Level',
      isActive: true,
      sortOrder: maxSort + 1,
    });
    if (newId) {
      showToast('✅ New Referral Claim Tier added & live pushed to all users!', 'success');
      setNewTierRefs(prev => prev + 5);
      setNewTierLimit(prev => prev + 5000);
      setNewTierBonus(prev => Number((prev + 0.05).toFixed(2)));
    } else {
      showToast('Failed to create referral tier.', 'error');
    }
  };

  const handleStartEditTier = (tier: ReferralClaimTier) => {
    setEditingTierId(tier.id);
    setEditTierRefs(tier.requiredReferrals);
    setEditTierLimit(tier.claimLimit);
    setEditTierBonus(tier.bonusUSDT);
    setEditTierBadge(tier.badge || '');
  };

  const handleSaveEditTier = async (id: string) => {
    const ok = await updateReferralTier(id, {
      requiredReferrals: Number(editTierRefs),
      claimLimit: Number(editTierLimit),
      bonusUSDT: Number(editTierBonus),
      badge: editTierBadge.trim(),
    });
    if (ok) {
      showToast('✅ Referral Tier updated & live pushed to users!', 'success');
      setEditingTierId(null);
    } else {
      showToast('Failed to update tier.', 'error');
    }
  };

  const handleDeleteTier = async (id: string) => {
    if (!window.confirm('Delete this referral tier? All connected users will update instantly.')) return;
    const ok = await deleteReferralTier(id);
    if (ok) {
      showToast('Tier deleted & live pushed.', 'info');
    } else {
      showToast('Failed to delete tier.', 'error');
    }
  };

  const handleToggleTierActive = async (tier: ReferralClaimTier) => {
    const ok = await updateReferralTier(tier.id, { isActive: !tier.isActive });
    if (ok) {
      showToast(tier.isActive ? 'Tier disabled & live pushed' : 'Tier enabled & live pushed', 'success');
    }
  };

  const handleMoveTier = async (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= referralTiers.length) return;
    const updated = [...referralTiers];
    const temp = updated[index];
    updated[index] = updated[newIndex];
    updated[newIndex] = temp;
    setReferralTiers(updated);
    await reorderReferralTiers(updated);
    showToast('Tier order updated & live pushed!', 'success');
  };
  // Upload progress per asset key (0–100), used for progress bars on branding uploads
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

  // --- Country Analytics ---
  const [countrySearch, setCountrySearch] = useState('');

  const countryAnalytics = useMemo(() => {
    const map: Record<string, { name: string; count: number; online: number; premium: number; points: number }> = {};

    (usersList || []).forEach((u: any) => {
      const normCountry = normalizeCountryName(u.country);
      const c = normCountry && normCountry !== 'Unknown' ? normCountry : 'Other / Unknown';
      if (!map[c]) {
        map[c] = { name: c, count: 0, online: 0, premium: 0, points: 0 };
      }
      map[c].count += 1;
      if (u.isOnline) map[c].online += 1;
      if (u.isTelegramPremium) map[c].premium += 1;
      map[c].points += (u.points || 0);
    });

    const total = (usersList || []).length || 1;
    return Object.values(map)
      .map(item => ({
        ...item,
        percentage: parseFloat(((item.count / total) * 100).toFixed(1)),
        flag: getCountryFlag(item.name),
        avgPoints: Math.round(item.points / (item.count || 1)),
      }))
      .sort((a, b) => b.count - a.count);
  }, [usersList]);

  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return countryAnalytics;
    const q = countrySearch.toLowerCase();
    return countryAnalytics.filter(c => c.name.toLowerCase().includes(q));
  }, [countryAnalytics, countrySearch]);
  const [savingUser, setSavingUser] = useState(false);
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [addUserId, setAddUserId] = useState('');
  const [addUserName, setAddUserName] = useState('');
  const [addFirstName, setAddFirstName] = useState('');
  const [addPoints, setAddPoints] = useState('0');
  const [addingUser, setAddingUser] = useState(false);

  const fetchUsers = async () => { setLoadingUsers(true); const u = await getAllUsers(); setUsersList(u); setLoadingUsers(false); };
  useEffect(() => {
    setLoadingUsers(true);
    const unsub = subscribeToAllUsers((u) => {
      setUsersList(u);
      setLoadingUsers(false);
    });
    return unsub;
  }, []);

  const startEditUser = (u: FirestoreUser) => {
    setEditingUser(u); setEditPoints(u.points ?? 0); setEditTokens(u.tokens ?? 0);
    setEditWallet(u.wallet ?? 0); setEditReferrals(u.referrals ?? 0);
    setEditRiskLevel(u.riskLevel ?? 'safe'); setEditBanStatus(u.banStatus ?? 'none');
    setEditLeaderboardPinned(u.leaderboardPinned ?? false);
    setEditLeaderboardHidden(u.leaderboardHidden ?? false);
    setEditIsVerified(u.isVerified ?? false);
    setEditPhotoUrl(u.photoUrl ?? '');
    if (u.banStatus === 'temp' && u.banUntil) {
      const until = u.banUntil instanceof Timestamp ? u.banUntil.toDate() : new Date(u.banUntil as string);
      const diffHrs = Math.max(1, Math.round((until.getTime() - Date.now()) / 3600000));
      setEditBanDuration(diffHrs >= 72 ? 72 : diffHrs >= 48 ? 48 : 24);
    } else setEditBanDuration(24);
  };


  // ── centralised upload helper (used by all upload handlers) ─────────────────
  // Delegates to uploadService.ts which handles: MIME validation, ImgBB, Bot API,
  // Cloudinary streaming, retry with exponential backoff, data URL fallback.
  const _upload = async (
    file: File,
    assetKey: string,
    folder = 'branding'
  ): Promise<string> => {
    const result = await uploadFile(file, {
      assetKey,
      folder,
      botApiUrl: settings.botApiUrl,
      botApiSecret: notifApiSecret,
      onProgress: (pct) =>
        setUploadProgress((prev) => ({ ...prev, [assetKey]: pct })),
    });
    setUploadProgress((prev) => ({ ...prev, [assetKey]: 100 }));
    setTimeout(() =>
      setUploadProgress((prev) => { const n = { ...prev }; delete n[assetKey]; return n; }),
    1500);
    return result.secureUrl;
  };


  // ── Avatar upload (User profile photo in admin roster) ────────────────────
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>, userId: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset so same file can be re-selected
    e.target.value = '';

    setUploadingAvatar(true);
    showToast(file.type.startsWith('video/') ? '🎬 Uploading video...' : '🖼️ Uploading image...', 'info');

    try {
      const url = await _upload(file, `avatar_${userId}`, 'profile');
      setEditPhotoUrl(url);
      showToast('✅ Photo uploaded successfully!', 'success');
    } catch (err: any) {
      // err.code and err.message come from uploadService structured errors
      showToast(err.message || 'Upload failed. Please try again.', 'error');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveUser = async () => {
    if (!editingUser) return; setSavingUser(true);
    let banUntil = null;
    if (editBanStatus === 'temp') banUntil = Timestamp.fromDate(new Date(Date.now() + editBanDuration * 3600000));
    const ok = await updateUserDatabaseValues(editingUser.telegramId, {
      points: editPoints, tokens: editTokens, wallet: editWallet, referrals: editReferrals,
      riskLevel: editRiskLevel, banStatus: editBanStatus, banUntil,
      leaderboardPinned: editLeaderboardPinned, leaderboardHidden: editLeaderboardHidden,
      isVerified: editIsVerified,
      // ✅ FIX: Save the updated photo URL to Firestore
      photoUrl: editPhotoUrl,
    });
    if (ok) {
      const sessionStr = localStorage.getItem('admin_session');
      let adminId = 'unknown'; let adminUsername = 'Admin';
      if (sessionStr) { try { const p = JSON.parse(sessionStr); adminId = p.uid || 'unknown'; adminUsername = p.email || 'Admin'; } catch { } }
      const changes: string[] = [];
      if (editingUser.points !== editPoints) changes.push(`Points: ${editingUser.points} -> ${editPoints}`);
      if (editingUser.tokens !== editTokens) changes.push(`Tokens: ${editingUser.tokens} -> ${editTokens}`);
      if (editingUser.wallet !== editWallet) changes.push(`Wallet: ${editingUser.wallet} -> ${editWallet}`);
      if (editingUser.referrals !== editReferrals) changes.push(`Referrals: ${editingUser.referrals} -> ${editReferrals}`);
      if (editingUser.riskLevel !== editRiskLevel) changes.push(`Risk: ${editingUser.riskLevel} -> ${editRiskLevel}`);
      if (editingUser.banStatus !== editBanStatus) changes.push(`Ban: ${editingUser.banStatus} -> ${editBanStatus}`);
      if ((editingUser.leaderboardPinned ?? false) !== editLeaderboardPinned) changes.push(`Pinned: ${editingUser.leaderboardPinned ?? false} -> ${editLeaderboardPinned}`);
      if ((editingUser.leaderboardHidden ?? false) !== editLeaderboardHidden) changes.push(`Hidden: ${editingUser.leaderboardHidden ?? false} -> ${editLeaderboardHidden}`);
      if ((editingUser.isVerified ?? false) !== editIsVerified) changes.push(`Verified: ${editingUser.isVerified ?? false} -> ${editIsVerified}`);
      if (editingUser.photoUrl !== editPhotoUrl) changes.push(`Photo updated`);
      if (changes.length > 0) await logAdminAction(typeof adminId === 'number' ? adminId : 0, adminUsername, 'Edit User Profile & Leaderboard', editingUser.telegramId, changes.join(', ')).catch(() => { });
      showToast(`✅ ${editingUser.firstName} updated.`, 'success'); fetchUsers(); setEditingUser(null);
    } else { showToast('Error updating user.', 'error'); }
    setSavingUser(false);
  };

  const handleFlagUser = async (u: FirestoreUser) => {
    try { await flagUser(u.telegramId, 'Manual flag by admin'); showToast(`🚩 ${u.firstName} flagged.`, 'warning'); fetchUsers(); }
    catch { showToast('Failed to flag user.', 'error'); }
  };
  const handleBanUser = async (u: FirestoreUser) => {
    try { const ok = await adminSetBan(u.telegramId, 'permanent'); ok ? (showToast(`🚫 ${u.firstName} banned.`, 'error'), fetchUsers()) : showToast('Failed to ban user.', 'error'); }
    catch { showToast('Failed to ban user.', 'error'); }
  };
  const handleUnbanUser = async (u: FirestoreUser) => {
    try {
      const ok = await adminSetBan(u.telegramId, 'none');
      if (ok) {
        // Also clear flags + risk level so user is fully reset
        await updateUserDatabaseValues(u.telegramId, {
          banStatus: 'none',
          banUntil: null,
          flagCount: 0,
          riskLevel: 'safe',
        } as any);
        showToast(`✅ ${u.firstName} unbanned & flags cleared.`, 'success');
        fetchUsers();
      } else {
        showToast('Failed to unban user.', 'error');
      }
    } catch { showToast('Failed to unban user.', 'error'); }
  };
  const handlePinUser = async (u: FirestoreUser) => {
    try { await adminPinUser(u.telegramId, !u.leaderboardPinned); showToast(u.leaderboardPinned ? `📌 ${u.firstName} unpinned.` : `📌 ${u.firstName} pinned.`, 'success'); fetchUsers(); }
    catch { showToast('Failed to toggle pin state.', 'error'); }
  };

  const handleHideUser = async (u: FirestoreUser) => {
    try {
      await adminHideUser(u.telegramId, !u.leaderboardHidden);
      showToast(u.leaderboardHidden ? `👁️ ${u.firstName} is now visible on leaderboard.` : `👁️‍🗨️ ${u.firstName} is now hidden from leaderboard.`, 'success');
      fetchUsers();
    } catch {
      showToast('Failed to toggle leaderboard visibility.', 'error');
    }
  };

  const handleRemoveFromLeaderboard = async (u: FirestoreUser) => {
    if (!confirm(`Remove ${u.firstName} from the leaderboard?`)) return;
    try {
      await adminHideUser(u.telegramId, true);
      showToast(`👁️‍🗨️ ${u.firstName} removed from leaderboard.`, 'success');
      fetchUsers();
    } catch {
      showToast('Failed to remove user from leaderboard.', 'error');
    }
  };

  const handleDeleteUser = async (u: FirestoreUser) => {
    if (!confirm(`Delete ${u.firstName} (${u.telegramId}) permanently?`)) return;
    try { await adminRemoveUser(u.telegramId); showToast(`🗑 ${u.firstName} deleted.`, 'error'); fetchUsers(); }
    catch { showToast('Failed to delete user.', 'error'); }
  };
  const handleResetLeaderboard = async () => {
    if (!confirm("Reset ALL users' points to 0? This cannot be undone.")) return;
    try { const count = await adminResetLeaderboard(); showToast(`🔄 Leaderboard reset — ${count} users cleared.`, 'warning'); fetchUsers(); }
    catch { showToast('Failed to reset leaderboard.', 'error'); }
  };
  const handleAddUser = async () => {
    const id = parseInt(addUserId);
    if (!id || !addFirstName.trim()) { showToast('Telegram ID and First Name required.', 'error'); return; }
    setAddingUser(true);
    try {
      await adminAddUser(id, addUserName.trim(), addFirstName.trim(), parseInt(addPoints) || 0);
      showToast(`✅ @${addUserName || id} added.`, 'success');
      setShowAddUserForm(false); setAddUserId(''); setAddUserName(''); setAddFirstName(''); setAddPoints('0');
      fetchUsers();
    } catch (err: any) { showToast(err.message || 'Error adding user.', 'error'); }
    setAddingUser(false);
  };

  const handleSort = (field: SortField) => { if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortField(field); setSortDir('desc'); } setPage(1); };

  const processedUsers = useMemo(() => {
    let list = [...usersList];
    const q = userSearch.toLowerCase();
    if (q) list = list.filter(u => u.firstName?.toLowerCase().includes(q) || u.username?.toLowerCase().includes(q) || String(u.telegramId).includes(q));
    switch (userFilter) {
      case 'premium': list = list.filter(u => u.isTelegramPremium); break;
      case 'flagged': list = list.filter(u => u.flagCount > 0); break;
      case 'banned': list = list.filter(u => (u.banStatus ?? 'none') !== 'none'); break;
      case 'online': list = list.filter(u => u.isOnline); break;
    }
    list.sort((a, b) => {
      let av = (a as any)[sortField];
      let bv = (b as any)[sortField];
      if (av === undefined || av === null) av = '';
      if (bv === undefined || bv === null) bv = '';
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      const avStr = String(av).toLowerCase();
      const bvStr = String(bv).toLowerCase();
      return sortDir === 'asc' ? avStr.localeCompare(bvStr) : bvStr.localeCompare(avStr);
    });
    return list;
  }, [usersList, userSearch, userFilter, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(processedUsers.length / PAGE_SIZE));
  const pagedUsers = processedUsers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const visibleFrom = processedUsers.length ? (page - 1) * PAGE_SIZE + 1 : 0;
  const visibleTo = Math.min(page * PAGE_SIZE, processedUsers.length);
  const filterCounts: Record<UserFilter, number> = {
    all: usersList.length,
    online: usersList.filter(u => u.isOnline).length,
    premium: usersList.filter(u => u.isTelegramPremium).length,
    flagged: usersList.filter(u => u.flagCount > 0).length,
    banned: usersList.filter(u => (u.banStatus ?? 'none') !== 'none').length,
  };

  // --- Tasks ---
  const [tasks, setTasks] = useState<EForceTask[]>([]);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState<EForceTask | null>(null);
  const blankTask = { title: '', description: '', type: 'channel' as TaskType, reward: 500, tokenReward: 0, url: '', dailyLimit: 0, totalCompletionLimit: 0, expiryDate: '', isEnabled: true, isMandatory: false, autoApprove: true, answer: '', requireSocialConnection: 'none' as const, requireRewardedAd: true, cooldownSeconds: 30 };
  const [taskForm, setTaskForm] = useState(blankTask);
  useEffect(() => { const unsub = subscribeToTasks(setTasks); return unsub; }, []);
  const handleSaveTask = async () => {
    let inferredPlatform = 'general';
    if (taskForm.requireSocialConnection && taskForm.requireSocialConnection !== 'none') {
      inferredPlatform = taskForm.requireSocialConnection;
    } else if (taskForm.type === 'x') {
      inferredPlatform = 'x';
    } else if (taskForm.type === 'discord') {
      inferredPlatform = 'discord';
    } else if (taskForm.type === 'tiktok') {
      inferredPlatform = 'tiktok';
    } else if (taskForm.type === 'instagram') {
      inferredPlatform = 'instagram';
    } else if (taskForm.type === 'youtube') {
      inferredPlatform = 'youtube';
    } else if (taskForm.type === 'reddit') {
      inferredPlatform = 'reddit';
    } else if (taskForm.type === 'channel' || taskForm.type === 'group') {
      inferredPlatform = 'telegram';
    } else if (taskForm.type === 'video' || taskForm.type === 'ad') {
      inferredPlatform = 'video';
    } else if (taskForm.type === 'website') {
      inferredPlatform = 'website';
    }

    const d = { ...taskForm, platform: inferredPlatform, expiryDate: taskForm.expiryDate || null };
    if (!d.title.trim()) { showToast('Task title is required.', 'warning'); return; }
    try {
      if (editingTask) {
        const ok = await updateTask(editingTask.id, d);
        ok ? showToast('Task updated.', 'success') : showToast('Failed to update task.', 'error');
      } else {
        const docId = await createTask(d);
        docId ? showToast('Task created.', 'success') : showToast('Failed to create task.', 'error');
      }
      setShowTaskForm(false); setEditingTask(null); setTaskForm(blankTask);
    } catch { showToast('Unexpected error.', 'error'); }
  };
  const handleDeleteTask = async (t: EForceTask) => {
    if (!window.confirm(`Delete task "${t.title}"?`)) return;
    const ok = await deleteTask(t.id);
    ok ? showToast('Task deleted.', 'success') : showToast('Failed to delete task.', 'error');
  };
  const handleToggleTask = async (t: EForceTask) => {
    const ok = await updateTask(t.id, { isEnabled: !t.isEnabled });
    ok ? showToast(`Task "${t.title}" ${t.isEnabled ? 'disabled' : 'enabled'}.`, 'info') : showToast('Failed.', 'error');
  };
  const startEditTask = (t: EForceTask) => {
    setEditingTask(t);
    setTaskForm({ title: t.title, description: t.description, type: t.type, reward: t.reward, tokenReward: t.tokenReward, url: t.url, dailyLimit: t.dailyLimit, totalCompletionLimit: t.totalCompletionLimit, expiryDate: t.expiryDate || '', isEnabled: t.isEnabled, isMandatory: t.isMandatory ?? false, autoApprove: t.autoApprove, answer: t.answer || '', requireSocialConnection: (t.requireSocialConnection || 'none') as any, requireRewardedAd: t.requireRewardedAd ?? true, cooldownSeconds: t.cooldownSeconds || 30 });
    setShowTaskForm(true);
  };

  // --- Withdrawals ---
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [withdrawFilter, setWithdrawFilter] = useState<'all' | 'Pending' | 'Approved' | 'Rejected' | 'Banned'>('Pending');
  const [withdrawSearch, setWithdrawSearch] = useState('');
  const [withdrawAssetFilter, setWithdrawAssetFilter] = useState<'all' | 'usdt' | 'token'>('all');
  const [withdrawSort, setWithdrawSort] = useState<'newest' | 'oldest' | 'amount_desc' | 'amount_asc'>('newest');
  const [selectedWithdrawIds, setSelectedWithdrawIds] = useState<string[]>([]);
  const [selectedWithdrawDetail, setSelectedWithdrawDetail] = useState<any | null>(null);
  const [withdrawModal, setWithdrawModal] = useState<{ id: string; status: 'Approved' | 'Rejected' | 'Banned'; req: any } | null>(null);
  const [withdrawNote, setWithdrawNote] = useState('');
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  useEffect(() => { const unsub = subscribeToWithdrawRequests(setWithdrawals); return unsub; }, []);

  const handleCopyWallet = async (addr: string) => {
    if (!addr) return;
    let copied = false;
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(addr);
        copied = true;
      } catch (err) {
        console.warn('navigator.clipboard failed, trying fallback:', err);
      }
    }
    if (!copied) {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = addr;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        copied = document.execCommand('copy');
        textArea.remove();
      } catch (execErr) {
        console.warn('execCommand copy failed:', execErr);
      }
    }

    if (copied) {
      setCopiedAddress(addr);
      showToast('📋 BEP-20 Wallet copied to clipboard!', 'success');
      setTimeout(() => setCopiedAddress(null), 2000);
    } else {
      showToast('⚠️ Copy blocked by browser permissions. Direct text selection enabled.', 'warning');
    }
  };

  const withdrawMetrics = useMemo(() => {
    const pending = withdrawals.filter(w => w.status === 'Pending');
    const approved = withdrawals.filter(w => w.status === 'Approved');
    const pendingUsdt = pending.filter(w => (w.type || 'usdt').toLowerCase() === 'usdt').reduce((acc, w) => acc + (Number(w.amount) || 0), 0);
    const pendingToken = pending.filter(w => (w.type || 'usdt').toLowerCase() === 'token').reduce((acc, w) => acc + (Number(w.amount) || 0), 0);
    const approvedUsdt = approved.filter(w => (w.type || 'usdt').toLowerCase() === 'usdt').reduce((acc, w) => acc + (Number(w.amount) || 0), 0);
    const approvedToken = approved.filter(w => (w.type || 'usdt').toLowerCase() === 'token').reduce((acc, w) => acc + (Number(w.amount) || 0), 0);
    const highRiskPending = pending.filter(w => {
      const u = usersList.find(usr => usr.telegramId === w.telegramId);
      return u?.riskLevel === 'high' || (u?.flagCount || 0) > 0;
    }).length;
    return { pendingUsdt, pendingToken, approvedUsdt, approvedToken, pendingCount: pending.length, approvedCount: approved.length, highRiskPending };
  }, [withdrawals, usersList]);

  const processedWithdrawals = useMemo(() => {
    let list = [...withdrawals];
    if (withdrawFilter !== 'all') {
      list = list.filter(w => w.status === withdrawFilter);
    }
    if (withdrawAssetFilter !== 'all') {
      list = list.filter(w => (w.type || 'usdt').toLowerCase() === withdrawAssetFilter);
    }
    const q = withdrawSearch.trim().toLowerCase();
    if (q) {
      list = list.filter(w =>
        String(w.telegramId || '').toLowerCase().includes(q) ||
        String(w.username || '').toLowerCase().includes(q) ||
        String(w.walletAddress || '').toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      if (withdrawSort === 'newest') return timeB - timeA;
      if (withdrawSort === 'oldest') return timeA - timeB;
      if (withdrawSort === 'amount_desc') return (Number(b.amount) || 0) - (Number(a.amount) || 0);
      if (withdrawSort === 'amount_asc') return (Number(a.amount) || 0) - (Number(b.amount) || 0);
      return 0;
    });
    return list;
  }, [withdrawals, withdrawFilter, withdrawAssetFilter, withdrawSearch, withdrawSort]);

  const handleBatchAction = async (status: 'Approved' | 'Rejected', defaultNote: string) => {
    if (selectedWithdrawIds.length === 0) return;
    if (!confirm(`Are you sure you want to ${status.toLowerCase()} ${selectedWithdrawIds.length} payout request(s)?`)) return;
    let count = 0;
    for (const id of selectedWithdrawIds) {
      const req = withdrawals.find(w => w.id === id);
      const ok = await updateWithdrawRequest(id, status, defaultNote);
      if (ok) {
        count++;
        if (req?.telegramId && settings.botApiUrl) {
          sendWithdrawNotification(settings.botApiUrl, req.telegramId, status, req.amount ?? 0, req.type ?? 'usdt', defaultNote).catch(() => {});
        }
      }
    }
    showToast(`✅ ${count} payout request(s) ${status.toLowerCase()}.`, 'success');
    setSelectedWithdrawIds([]);
  };

  const toggleSelectAllPending = () => {
    const pendingIds = processedWithdrawals.filter(w => w.status === 'Pending').map(w => w.id);
    if (selectedWithdrawIds.length === pendingIds.length && pendingIds.length > 0) {
      setSelectedWithdrawIds([]);
    } else {
      setSelectedWithdrawIds(pendingIds);
    }
  };
  // --- Notifications tab ---
  const [notifMessage, setNotifMessage] = useState('');
  const [notifSending, setNotifSending] = useState(false);
  const [notifApiSecret] = useState(() => {
    const saved = localStorage.getItem('admin_api_secret');
    return (saved && saved.trim() !== '') ? saved : 'https://elite-force-telegram-app.onrender.com';
  });
  const [notifImageUrl, setNotifImageUrl] = useState('');
  const [uploadingNotificationImage, setUploadingNotificationImage] = useState(false);
  // ── Notification Center States ──────────────────────────────────────────
  const [notifSubTab, setNotifSubTab] = useState<'broadcast' | 'templates' | 'history'>('broadcast');
  const [bcastTargetType, setBcastTargetType] = useState<'everyone' | 'premium' | 'specific' | 'campaign' | 'country' | 'language'>('everyone');
  const [bcastTargetIds, setBcastTargetIds] = useState('');
  const [bcastCampaignId, setBcastCampaignId] = useState('');
  const [bcastCountry, setBcastCountry] = useState('');
  const [bcastLanguage, setBcastLanguage] = useState('');
  const [bcastIsPremiumOnly] = useState(false);
  const [bcastButtonText, setBcastButtonText] = useState('Open Elite Force');
  const [bcastButtonTab, setBcastButtonTab] = useState('home');
  const [bcastSearchQuery, setBcastSearchQuery] = useState('');

  const targetIdArray = useMemo(() => {
    return bcastTargetIds
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
  }, [bcastTargetIds]);

  const handleToggleTargetId = (idStr: string) => {
    const current = targetIdArray;
    let updated: string[];
    if (current.includes(idStr)) {
      updated = current.filter(x => x !== idStr);
    } else {
      updated = [...current, idStr];
    }
    setBcastTargetIds(updated.join(', '));
  };

  const handleRemoveTargetId = (idStr: string) => {
    const updated = targetIdArray.filter(x => x !== idStr);
    setBcastTargetIds(updated.join(', '));
  };

  const handleTargetUserForBroadcast = (u: FirestoreUser) => {
    const uIdStr = String(u.telegramId);
    if (!targetIdArray.includes(uIdStr)) {
      handleToggleTargetId(uIdStr);
    }
    setActiveTab('notifications');
    setNotifSubTab('broadcast');
    setBcastTargetType('specific');
    showToast(`🎯 User ${u.firstName} (ID: ${uIdStr}) added to Broadcast Target!`, 'success');
  };

  const filteredBcastUsers = useMemo(() => {
    if (!bcastSearchQuery.trim()) return usersList;
    const q = bcastSearchQuery.toLowerCase();
    return usersList.filter(u =>
      (u.firstName && u.firstName.toLowerCase().includes(q)) ||
      (u.lastName && u.lastName.toLowerCase().includes(q)) ||
      (u.username && u.username.toLowerCase().includes(q)) ||
      String(u.telegramId || '').includes(q)
    );
  }, [usersList, bcastSearchQuery]);

  const [selectedEventType, setSelectedEventType] = useState<string>('SOCIAL_CONNECTED');
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [uploadingImageField, setUploadingImageField] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('admin_api_secret', notifApiSecret);
  }, [notifApiSecret]);

  const fetchNotificationHistory = async () => {
    if (!settings.botApiUrl) return;
    setLoadingHistory(true);
    try {
      const res = await fetch(`${settings.botApiUrl.replace(/\/$/, '')}/api/admin/notifications/history`, {
        headers: { 'Authorization': `Bearer ${notifApiSecret}` },
      });
      const data = await res.json();
      if (data.success) {
        setHistoryLogs(data.logs || []);
      }
    } catch {
      // quiet catch
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSendNotification = async () => {
    if (!notifMessage.trim()) { showToast('Message cannot be empty.', 'warning'); return; }
    if (!settings.botApiUrl) { showToast('Bot API URL not set in Settings.', 'error'); return; }
    setNotifSending(true);
    try {
      const res = await fetch(`${settings.botApiUrl.replace(/\/$/, '')}/api/admin/broadcast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${notifApiSecret}`,
        },
        body: JSON.stringify({
          targetType: bcastTargetType,
          targetIds: bcastTargetIds.split(',').map(s => s.trim()).filter(Boolean),
          campaignId: bcastCampaignId,
          country: bcastCountry,
          language: bcastLanguage,
          isPremiumOnly: bcastIsPremiumOnly || bcastTargetType === 'premium',
          templateText: notifMessage,
          buttonText: bcastButtonText,
          buttonTab: bcastButtonTab,
          imageUrl: notifImageUrl,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`📢 Broadcast sent to ${data.sent} users (${data.failed} failed/blocked)!`, 'success');
        setNotifMessage('');
        setNotifImageUrl('');
      } else {
        showToast(data.error || 'Broadcast failed.', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to process broadcast.', 'error');
    } finally {
      setNotifSending(false);
    }
  };

  const handleNotificationImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUploadingNotificationImage(true);
    try {
      const url = await _upload(file, 'notif_image', 'branding');
      setNotifImageUrl(url);
      showToast('✅ Notification image uploaded!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Upload failed.', 'error');
    } finally {
      setUploadingNotificationImage(false);
    }
  };

  const [settings, setSettings] = useState<AdminSettings>(DEFAULT_ADMIN_SETTINGS);
  const settingsRef = useRef<AdminSettings>(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  const [savingSettings, setSavingSettings] = useState(false);
  useEffect(() => { const unsub = subscribeToAdminSettings(setSettings); return unsub; }, []);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    await saveAdminSettings(settings);
    setSavingSettings(false);
    showToast('⚡ Settings saved & live synced to users!', 'success');
  };

  // --- Custom Top Miners ---
  const [newMinerName, setNewMinerName] = useState('');
  const [newMinerScore, setNewMinerScore] = useState('0');
  const [newMinerBadge, setNewMinerBadge] = useState('⛏️');
  const handleAddCustomMiner = () => {
    const score = parseInt(newMinerScore) || 0;
    if (!newMinerName.trim()) { showToast('Miner name is required.', 'warning'); return; }
    const updated = [...(settings.customTopMiners || []), { name: newMinerName.trim(), score, badge: newMinerBadge || '⛏️' }];
    setSettings(s => ({ ...s, customTopMiners: updated }));
    setNewMinerName(''); setNewMinerScore('0'); setNewMinerBadge('⛏️');
  };
  const handleRemoveCustomMiner = (idx: number) => {
    const updated = (settings.customTopMiners || []).filter((_, i) => i !== idx);
    setSettings(s => ({ ...s, customTopMiners: updated }));
  };

  // Hero Multi-Banner Slider Management
  const [newBannerUrl, setNewBannerUrl] = useState('');
  const [newBannerTitle, setNewBannerTitle] = useState('');
  const [newBannerLink, setNewBannerLink] = useState('');

  const handleAddHeroBanner = async () => {
    if (!newBannerUrl.trim()) {
      showToast('Please provide or upload a banner image URL', 'warning');
      return;
    }
    const newBanner: { id: string; imageUrl: string; title?: string; linkUrl?: string } = {
      id: String(Date.now()),
      imageUrl: newBannerUrl.trim(),
    };
    if (newBannerTitle.trim()) newBanner.title = newBannerTitle.trim();
    if (newBannerLink.trim()) newBanner.linkUrl = newBannerLink.trim();

    const updatedBanners = [...(settings.heroBanners || []), newBanner];
    const updatedSettings = { ...settings, heroBanners: updatedBanners };
    setSettings(updatedSettings);
    await saveAdminSettings(updatedSettings);
    setNewBannerUrl('');
    setNewBannerTitle('');
    setNewBannerLink('');
    showToast('✅ New Carousel Banner added!', 'success');
  };

  const handleRemoveHeroBanner = async (index: number) => {
    const updatedBanners = (settings.heroBanners || []).filter((_, i) => i !== index);
    const updatedSettings = { ...settings, heroBanners: updatedBanners };
    setSettings(updatedSettings);
    await saveAdminSettings(updatedSettings);
    showToast('Banner removed.', 'info');
  };

  // ── Hero Multi-Banner Slider: upload image or video for carousel ──────────
  const handleAddBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const isVideo = file.type.startsWith('video/');
    showToast(isVideo ? '🎬 Uploading video banner...' : '🖼️ Uploading banner image...', 'info');
    try {
      const url = await _upload(file, `hero_banner_${Date.now()}`, 'banner');

      const newBanner: { id: string; imageUrl: string; title?: string; linkUrl?: string } = {
        id: String(Date.now()),
        imageUrl: url,
      };
      if (newBannerTitle.trim()) newBanner.title = newBannerTitle.trim();
      if (newBannerLink.trim()) newBanner.linkUrl = newBannerLink.trim();

      const updatedBanners = [...(settings.heroBanners || []), newBanner];
      const updatedSettings = { ...settings, heroBanners: updatedBanners };
      setSettings(updatedSettings);
      await saveAdminSettings(updatedSettings);
      setNewBannerUrl('');
      setNewBannerTitle('');
      setNewBannerLink('');
      showToast(isVideo ? '🎬 Video Banner added to Carousel!' : '✅ Banner Image added to Carousel!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Upload failed.', 'error');
    }
  };

  // ── Branding / System Images upload ──────────────────────────────────────
  const handleBrandingUpload = async (e: React.ChangeEvent<HTMLInputElement>, targetField: keyof AdminSettings) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const key = String(targetField);
    setUploadingImageField(key);
    setUploadProgress((prev) => ({ ...prev, [key]: 0 }));

    try {
      const url = await _upload(file, key, file.type.startsWith('video/') ? 'video' : 'icon');
      const updated = { ...settingsRef.current, [targetField]: url };
      setSettings(updated);
      // Guard: never write base64 data URLs > 700KB directly into adminSettings
      // (Firestore 1MB doc limit — large data URLs cause silent write failures)
      if (url.startsWith('data:') && url.length > 700000) {
        showToast(
          '⚠️ File stored locally. Configure Cloudinary for persistent CDN storage.',
          'warning'
        );
      } else {
        await saveAdminSettings(updated);
        showToast(`✅ ${key} uploaded & live synced!`, 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Upload failed.', 'error');
    } finally {
      setUploadingImageField(null);
    }
  };

  // Task type color map (Dark Corporate)
  const TASK_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    channel: { bg: 'rgba(59,130,246,0.12)', text: '#60A5FA', border: 'rgba(59,130,246,0.3)' },
    group:   { bg: 'rgba(14,165,233,0.12)', text: '#38BDF8', border: 'rgba(14,165,233,0.3)' },
    x:       { bg: 'rgba(255,255,255,0.06)', text: '#FFFFFF', border: 'rgba(255,255,255,0.2)' },
    website: { bg: 'rgba(16,185,129,0.12)', text: '#34D399', border: 'rgba(16,185,129,0.3)' },
    video:   { bg: 'rgba(244,63,94,0.12)',  text: '#FB7185', border: 'rgba(244,63,94,0.3)' },
    daily:   { bg: 'rgba(245,158,11,0.12)',  text: '#FBBF24', border: 'rgba(245,158,11,0.3)' },
    ad:      { bg: 'rgba(168,85,247,0.12)',  text: '#C084FC', border: 'rgba(168,85,247,0.3)' },
  };

  // ============ RENDER ============
  return (
    <div className="flex h-full overflow-hidden bg-[#090D16]">
      <AdminSidebar
        activeTab={activeTab}
        setActiveTab={tab => { setActiveTab(tab); setPage(1); }}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        eforceTokenValue={settings.eforceTokenValue}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#090D16]">
        <AdminHeader
          activeTab={activeTab}
          onMenuClick={() => setSidebarOpen(true)}
          pendingCount={withdrawals.filter(w => w.status === 'Pending').length}
          flaggedCount={kpi.flagged}
          onRefresh={fetchKpis}
          isRefreshing={loadingKpi}
          adminUsername={settings.adminUsername}
        />

        <main
          className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 bg-[#090D16]"
        >

          {/* ════════════════════ DASHBOARD ════════════════════ */}
          {activeTab === 'dashboard' && (
            <AdminDashboard
              kpi={kpi}
              loadingKpi={loadingKpi}
              liveUserCount={liveUserCount}
              withdrawals={withdrawals}
              usersList={usersList}
              onRefresh={fetchKpis}
              eforceTokenValue={settings.eforceTokenValue}
            />
          )}

          {/* ════════════════════ USERS ════════════════════ */}
          {activeTab === 'users' && (
            <div className="flex flex-col gap-5">

              {/* ── Top stats + controls ── */}
              <SectionCard accentColor="#0284C7">
                <div className="p-5 flex flex-col gap-4">
                  {/* Header row */}
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                          <i className="fa-solid fa-users-gear text-blue-400"></i>
                          <span>User Roster Management</span>
                        </h2>
                        <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          LIVE ROSTER
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 max-w-lg font-medium">
                        Search, review, and moderate active ecosystem members. Use filters to isolate online, premium, flagged or banned accounts.
                      </p>
                    </div>

                    {/* Mini KPI chips */}
                    <div className="grid grid-cols-4 gap-2 xl:shrink-0">
                      {[
                        { label: 'Total', value: usersList.length, color: 'text-white', bg: 'bg-[#181F2E]', border: 'border-slate-700/80' },
                        { label: 'Online', value: filterCounts.online, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
                        { label: 'Flagged', value: filterCounts.flagged, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
                        { label: 'Banned', value: filterCounts.banned, color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
                      ].map(s => (
                        <div key={s.label} className={`rounded-xl px-3 py-2 text-center ${s.bg} border ${s.border}`}>
                          <div className={`text-base font-extrabold leading-none ${s.color}`}>{s.value}</div>
                          <div className="text-[8.5px] font-mono uppercase tracking-wider text-slate-400 mt-1">{s.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Search + action buttons */}
                  <div className="flex flex-col md:flex-row gap-2.5">
                    <div className="relative flex-1">
                      <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none"></i>
                      <input
                        value={userSearch}
                        onChange={e => { setUserSearch(e.target.value); setPage(1); }}
                        placeholder="Search name, @username, Telegram ID…"
                        className="w-full pl-9 pr-9 h-10 rounded-xl text-xs text-white bg-[#181F2E] border border-slate-700/80 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder-slate-500 font-medium"
                      />
                      {userSearch && (
                        <button onClick={() => { setUserSearch(''); setPage(1); }}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                          <i className="fa-solid fa-xmark text-xs"></i>
                        </button>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {/* Add User */}
                      <button
                        onClick={() => setShowAddUserForm(v => !v)}
                        className="inline-flex items-center gap-2 px-3.5 h-10 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors cursor-pointer shadow-xs"
                      >
                        <i className="fa-solid fa-user-plus text-xs"></i>
                        <span>Add User</span>
                      </button>
                      {/* Reset Leaderboard */}
                      <button
                        onClick={handleResetLeaderboard}
                        className={`${Btn.danger} h-11 px-4 rounded-2xl text-xs`}
                        style={btnStyle.danger}
                        title="Reset all users' points to 0"
                      >
                        <RefreshCw size={12} /> Reset LB
                      </button>
                      {/* Refresh */}
                      <button
                        onClick={fetchUsers}
                        className={`${Btn.ghost} h-11 px-4 rounded-2xl text-xs`}
                        style={btnStyle.ghost}
                      >
                        <RefreshCw size={12} className={loadingUsers ? 'animate-spin' : ''} /> Refresh
                      </button>
                    </div>
                  </div>

                  {/* Add User Form */}
                  <AnimatePresence>
                    {showAddUserForm && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="rounded-2xl p-4 flex flex-col gap-3 mt-1"
                          style={{ background: 'rgba(255,138,0,0.06)', border: '1px solid rgba(255,138,0,0.2)' }}>
                          <div className="flex items-center gap-2">
                            <Plus size={12} className="text-[#FF8A00]" />
                            <span className="text-[10px] font-black text-[#FF8A00] uppercase tracking-widest">Add User Manually</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <input value={addUserId} onChange={e => setAddUserId(e.target.value)} placeholder="Telegram ID *" type="number" className={inputCls} style={inputStyle} />
                            <input value={addFirstName} onChange={e => setAddFirstName(e.target.value)} placeholder="First Name *" className={inputCls} style={inputStyle} />
                            <input value={addUserName} onChange={e => setAddUserName(e.target.value)} placeholder="Username (opt.)" className={inputCls} style={inputStyle} />
                            <input value={addPoints} onChange={e => setAddPoints(e.target.value)} placeholder="Starting Points" type="number" className={inputCls} style={inputStyle} />
                          </div>
                          <div className="flex gap-2">
                            <button onClick={handleAddUser} disabled={addingUser} className={`${Btn.primary} h-9 px-5 rounded-xl text-xs`} style={btnStyle.primary}>
                              {addingUser ? <RefreshCw size={11} className="animate-spin" /> : <Plus size={11} />} Create Account
                            </button>
                            <button onClick={() => setShowAddUserForm(false)} className={`${Btn.ghost} h-9 px-4 rounded-xl text-xs`} style={btnStyle.ghost}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Filter pills */}
                  <div className="flex gap-2 flex-wrap">
                    {(['all', 'online', 'premium', 'flagged', 'banned'] as UserFilter[]).map(f => {
                      const isSelected = userFilter === f;
                      const meta: Record<UserFilter, { faIcon: string }> = {
                        all: { faIcon: 'fa-solid fa-users' },
                        online: { faIcon: 'fa-solid fa-bolt' },
                        premium: { faIcon: 'fa-solid fa-star' },
                        flagged: { faIcon: 'fa-solid fa-flag' },
                        banned: { faIcon: 'fa-solid fa-ban' },
                      };
                      return (
                        <button
                          key={f}
                          onClick={() => { setUserFilter(f); setPage(1); }}
                          className={`flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-[11px] font-bold capitalize transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-slate-900 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                          }`}
                        >
                          <i className={`${meta[f].faIcon} text-[10px]`}></i>
                          <span>{f}</span>
                          <span className="opacity-60 text-[10px]">({filterCounts[f]})</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </SectionCard>

              {/* ── Users table ── */}
              <SectionCard accentColor="#38BDF8">
                {/* Table header */}
                <div className="grid items-center gap-2 px-5 py-3 border-b border-slate-800 bg-[#0E121B] sticky top-0 z-10"
                  style={{ gridTemplateColumns: '2.5rem 1fr 8rem 7rem 6rem 7rem 10rem' }}>
                  <div />
                  <SortBtn field="firstName" label="User" sortField={sortField} sortDir={sortDir} handleSort={handleSort} />
                  <SortBtn field="points" label="Points" sortField={sortField} sortDir={sortDir} handleSort={handleSort} />
                  <SortBtn field="tokens" label="Tokens" sortField={sortField} sortDir={sortDir} handleSort={handleSort} />
                  <SortBtn field="referrals" label="Refs" sortField={sortField} sortDir={sortDir} handleSort={handleSort} />
                  <span className="text-[9.5px] font-mono font-bold uppercase tracking-wider text-slate-400">Status</span>
                  <span className="text-[9.5px] font-mono font-bold uppercase tracking-wider text-slate-400 text-right">Actions</span>
                </div>

                {/* Table rows */}
                {loadingUsers ? (
                  <div className="flex flex-col bg-[#131824]">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="grid items-center gap-2 px-5 py-4 border-b border-slate-800/80"
                        style={{ gridTemplateColumns: '2.5rem 1fr 8rem 7rem 6rem 7rem 10rem' }}>
                        <div className="w-9 h-9 rounded-full bg-slate-800 animate-pulse" />
                        <div className="space-y-1.5"><div className="h-3 w-28 bg-slate-800 rounded animate-pulse" /><div className="h-2 w-20 bg-slate-800/60 rounded animate-pulse" /></div>
                        {Array.from({ length: 5 }).map((_, j) => <div key={j} className="h-3 bg-slate-800 rounded animate-pulse" />)}
                      </div>
                    ))}
                  </div>
                ) : pagedUsers.length === 0 ? (
                  <div className="text-center py-16 text-slate-400 text-xs bg-[#131824] font-medium">No users match your filters.</div>
                ) : (
                  <AnimatePresence mode="wait">
                    <motion.div key={`${userFilter}-${page}-${sortField}-${sortDir}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }} className="bg-[#131824]">
                      {pagedUsers.map((u, idx) => (
                        <React.Fragment key={u.telegramId}>
                          <motion.div
                            initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.025 }}
                            className="grid items-center gap-2 px-5 py-3.5 border-b border-slate-800/80 transition-all hover:bg-[#182030] cursor-default group"
                            style={{ gridTemplateColumns: '2.5rem 1fr 8rem 7rem 6rem 7rem 10rem' }}
                          >
                            {/* Avatar */}
                            <div className="relative">
                              <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center text-xs font-extrabold bg-[#182030] border border-slate-700 text-slate-200 shrink-0">
                                <ImageWithFallback src={u.photoUrl ?? ''} fallbackLetter={(u.firstName?.[0] ?? 'U')} className="w-full h-full object-cover" />
                              </div>
                              {u.isOnline && <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#131824]" />}
                            </div>

                            {/* Name */}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-extrabold text-white truncate max-w-[130px]">{u.firstName} {u.lastName}</span>
                                {u.isVerified && <VerifiedBadge size={10} />}
                                {u.isTelegramPremium && <i className="fa-solid fa-star text-sky-400 text-[10px]" title="Telegram Premium"></i>}
                                {u.leaderboardHidden && <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded uppercase bg-slate-800 text-slate-400 border border-slate-700">Hidden</span>}
                                {(u.banStatus ?? 'none') !== 'none' && <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20">Banned</span>}
                                {u.flagCount > 0 && <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">🚩{u.flagCount}</span>}
                              </div>
                              <span className="text-[10px] text-slate-400 font-medium">@{u.username || 'no_username'} · {u.telegramId} · <span className="text-slate-300 font-bold" title={u.country || 'Unknown'}>{getCountryFlag(u.country)} {u.country && u.country !== 'Unknown' ? u.country : 'Unknown'}</span></span>
                            </div>

                            {/* Points */}
                            <div>
                              <span className="text-xs font-black text-blue-400">{(u.points || 0).toLocaleString()}</span>
                              <div className="text-[8.5px] font-mono uppercase tracking-wider text-slate-400">EForce</div>
                            </div>

                            {/* Tokens */}
                            <div>
                              <span className="text-xs font-semibold text-slate-300">{(u.tokens || 0).toLocaleString()}</span>
                              <div className="text-[8px] uppercase tracking-widest text-slate-600">Token</div>
                            </div>

                            {/* Refs */}
                            <div>
                              <span className="text-xs font-semibold" style={{ color: '#B388FF' }}>{u.referrals || 0}</span>
                              <div className="text-[8px] uppercase tracking-widest text-slate-600">Refs</div>
                            </div>

                            {/* Status badge */}
                            <div>
                              {(u.banStatus ?? 'none') !== 'none' ? (
                                <span className="text-[9px] font-bold px-2.5 py-1 rounded-full" style={{ color: '#F87171', background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.25)' }}>🚫 Banned</span>
                              ) : u.isOnline ? (
                                <span className="text-[9px] font-bold px-2.5 py-1 rounded-full" style={{ color: '#4ADE80', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.25)' }}>● Live</span>
                              ) : (
                                <span className="text-[9px] font-bold px-2.5 py-1 rounded-full" style={{ color: '#64748b', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>○ Away</span>
                              )}
                            </div>

                            {/* Action buttons */}
                            <div className="flex items-center justify-end gap-1">
                              {/* Edit */}
                              <button onClick={() => startEditUser(u)} title="Edit user" className="w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer" style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)', color: '#A78BFA' }}>
                                <Edit3 size={12} />
                              </button>
                              {/* Target Broadcast */}
                              <button onClick={() => handleTargetUserForBroadcast(u)} title="Add user ID to Broadcast target" className="w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer" style={{ background: 'rgba(192,132,252,0.12)', border: '1px solid rgba(192,132,252,0.3)', color: '#C084FC' }}>
                                <Send size={12} />
                              </button>
                              {/* Pin */}
                              <button onClick={() => handlePinUser(u)} title="Pin to leaderboard" className="w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer text-[12px]"
                                style={{ background: u.leaderboardPinned ? 'rgba(255,138,0,0.15)' : 'rgba(255,255,255,0.04)', border: u.leaderboardPinned ? '1px solid rgba(255,138,0,0.3)' : '1px solid rgba(255,255,255,0.08)' }}>
                                📌
                              </button>
                              {/* Hide / Show from Leaderboard */}
                              <button onClick={() => handleHideUser(u)} title={u.leaderboardHidden ? "Show on leaderboard" : "Hide from leaderboard"} className="w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer"
                                style={{ background: u.leaderboardHidden ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.04)', border: u.leaderboardHidden ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(255,255,255,0.08)', color: u.leaderboardHidden ? '#EF4444' : '#64748b' }}>
                                {u.leaderboardHidden ? <EyeOff size={12} /> : <Eye size={12} />}
                              </button>
                              {/* Flag */}
                              <button onClick={() => handleFlagUser(u)} title="Flag user" className="w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer text-[12px]"
                                style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
                                🚩
                              </button>
                              {/* Ban / Unban */}
                              {(u.banStatus ?? 'none') !== 'none' ? (
                                <button onClick={() => handleUnbanUser(u)} title="Unban user" className="w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer" style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.25)', color: '#4ADE80' }}>
                                  <Check size={12} />
                                </button>
                              ) : (
                                <button onClick={() => handleBanUser(u)} title="Ban user" className="w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer" style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', color: '#F87171' }}>
                                  <Ban size={12} />
                                </button>
                              )}
                              {/* Delete */}
                              <button onClick={() => handleDeleteUser(u)} title="Delete permanently" className="w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer" style={{ background: 'rgba(248,82,82,0.1)', border: '1px solid rgba(248,82,82,0.25)', color: '#FF5252' }}>
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </motion.div>

                          {/* Inline edit drawer */}
                          <AnimatePresence>
                            {editingUser?.telegramId === u.telegramId && (
                              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
                                <div className="px-5 py-5 border-b flex flex-col gap-4" style={{ borderColor: 'rgba(255,138,0,0.15)', background: 'rgba(255,138,0,0.03)' }}>
                                  <div className="flex items-center justify-between gap-3 flex-wrap">
                                    <div>
                                      <div className="text-sm font-black text-white">Edit — {u.firstName}</div>
                                      <div className="text-[9px] text-slate-500">@{u.username || 'no_username'} · ID {u.telegramId}</div>
                                    </div>
                                    <div className="text-[9px] px-3 py-1 rounded-full font-bold"
                                      style={{ background: editRiskLevel === 'high' ? 'rgba(248,113,113,0.12)' : editRiskLevel === 'medium' ? 'rgba(251,191,36,0.1)' : 'rgba(74,222,128,0.1)', color: editRiskLevel === 'high' ? '#F87171' : editRiskLevel === 'medium' ? '#FBBF24' : '#4ADE80', border: `1px solid ${editRiskLevel === 'high' ? 'rgba(248,113,113,0.3)' : editRiskLevel === 'medium' ? 'rgba(251,191,36,0.3)' : 'rgba(74,222,128,0.3)'}` }}>
                                      Risk: {editRiskLevel.toUpperCase()}
                                    </div>
                                  </div>

                                  {/* Profile Photo Upload */}
                                  <div className="flex items-center gap-4 p-3 rounded-xl border border-white/[0.04] bg-white/[0.01]">
                                    <div className="relative w-12 h-12 rounded-full overflow-hidden flex items-center justify-center text-lg font-black shrink-0"
                                      style={{ background: 'rgba(255,138,0,0.12)', border: '1.5px solid rgba(255,138,0,0.22)', color: '#FF8A00' }}>
                                      <ImageWithFallback src={editPhotoUrl} fallbackLetter={(u.firstName?.[0] ?? 'U')} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <label className="text-[8px] text-slate-500 font-black uppercase tracking-wider block mb-1">User Photo/Avatar</label>
                                      <div className="flex items-center gap-2">
                                        <input
                                          type="text"
                                          value={editPhotoUrl}
                                          onChange={e => setEditPhotoUrl(e.target.value)}
                                          placeholder="Enter Image URL or Upload below"
                                          className={`${inputCls} flex-1 text-[10px] h-8`}
                                          style={inputStyle}
                                        />
                                        <label className="h-8 px-3 rounded-lg flex items-center justify-center gap-1 text-[10px] font-bold cursor-pointer transition-all shrink-0 select-none"
                                          style={{ background: 'rgba(255,138,0,0.12)', border: '1px solid rgba(255,138,0,0.22)', color: '#FF8A00' }}>
                                          {uploadingAvatar ? <RefreshCw size={10} className="animate-spin" /> : <Upload size={10} />} {uploadingAvatar ? 'Uploading...' : 'Upload'}
                                          <input
                                            type="file"
                                            accept="image/*,video/*"
                                            onChange={e => handleAvatarUpload(e, u.telegramId)}
                                            className="hidden"
                                            disabled={uploadingAvatar}
                                          />
                                        </label>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                    {[{ label: 'Points', val: editPoints, set: setEditPoints }, { label: 'Tokens', val: editTokens, set: setEditTokens }, { label: 'Wallet', val: editWallet, set: setEditWallet }, { label: 'Referrals', val: editReferrals, set: setEditReferrals }].map(f => (
                                      <div key={f.label}>
                                        <label className="text-[8px] text-slate-500 font-black uppercase tracking-wider block mb-1">{f.label}</label>
                                        <input type="number" value={f.val} onChange={e => f.set(Number(e.target.value))} className={inputCls} style={inputStyle} />
                                      </div>
                                    ))}
                                  </div>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                    <div>
                                      <label className="text-[8px] text-slate-500 font-black uppercase tracking-wider block mb-1">Risk Level</label>
                                      <select value={editRiskLevel} onChange={e => setEditRiskLevel(e.target.value as any)} className={inputCls + ' cursor-pointer'} style={{ ...inputStyle, background: '#0A0D1A' }}>
                                        <option value="safe">Safe</option><option value="medium">Medium</option><option value="high">High</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="text-[8px] text-slate-500 font-black uppercase tracking-wider block mb-1">Ban Status</label>
                                      <select value={editBanStatus} onChange={e => setEditBanStatus(e.target.value as any)} className={inputCls + ' cursor-pointer'} style={{ ...inputStyle, background: '#0A0D1A' }}>
                                        <option value="none">None</option><option value="temp">Temp</option><option value="permanent">Permanent</option>
                                      </select>
                                    </div>
                                    {editBanStatus === 'temp' && (
                                      <div>
                                        <label className="text-[8px] text-slate-500 font-black uppercase tracking-wider block mb-1">Duration</label>
                                        <select value={editBanDuration} onChange={e => setEditBanDuration(Number(e.target.value))} className={inputCls + ' cursor-pointer'} style={{ ...inputStyle, background: '#0A0D1A' }}>
                                          <option value={24}>24h</option><option value={48}>48h</option><option value={72}>72h</option>
                                        </select>
                                      </div>
                                    )}
                                    <div>
                                      <label className="text-[8px] text-slate-500 font-black uppercase tracking-wider block mb-1">LB Pin</label>
                                      <select value={editLeaderboardPinned ? 'true' : 'false'} onChange={e => setEditLeaderboardPinned(e.target.value === 'true')} className={inputCls + ' cursor-pointer'} style={{ ...inputStyle, background: '#0A0D1A' }}>
                                        <option value="false">Unpinned</option><option value="true">Pinned</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="text-[8px] text-slate-500 font-black uppercase tracking-wider block mb-1">LB Visibility</label>
                                      <select value={editLeaderboardHidden ? 'true' : 'false'} onChange={e => setEditLeaderboardHidden(e.target.value === 'true')} className={inputCls + ' cursor-pointer'} style={{ ...inputStyle, background: '#0A0D1A' }}>
                                        <option value="false">Visible</option><option value="true">Hidden</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="text-[8px] text-slate-500 font-black uppercase tracking-wider block mb-1">Verified Badge</label>
                                      <select value={editIsVerified ? 'true' : 'false'} onChange={e => setEditIsVerified(e.target.value === 'true')} className={inputCls + ' cursor-pointer'} style={{ ...inputStyle, background: '#0A0D1A' }}>
                                        <option value="false">Unverified</option><option value="true">Verified</option>
                                      </select>
                                    </div>
                                  </div>
                                  <div className="flex gap-2 pt-1">
                                    <button onClick={handleSaveUser} disabled={savingUser} className={`${Btn.primary} flex-1 h-10 rounded-xl text-xs`} style={btnStyle.primary}>
                                      {savingUser ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />} Save Changes
                                    </button>
                                    <button onClick={() => setEditingUser(null)} className={`${Btn.ghost} h-10 px-5 rounded-xl text-xs`} style={btnStyle.ghost}>
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </React.Fragment>
                      ))}
                    </motion.div>
                  </AnimatePresence>
                )}

                {/* Pagination */}
                <div className="flex items-center justify-between gap-3 px-5 py-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  <span className="text-[10px] text-slate-500">
                    Showing <span className="text-white font-bold">{visibleFrom}–{visibleTo}</span> of <span className="text-white font-bold">{processedUsers.length}</span>
                  </span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-white disabled:opacity-25 transition-all cursor-pointer" style={btnStyle.ghost}><ChevronLeft size={13} /></button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const p = totalPages <= 5 ? i + 1 : page <= 3 ? i + 1 : page >= totalPages - 2 ? totalPages - 4 + i : page - 2 + i;
                      return (
                        <button key={p} onClick={() => setPage(p)} className="w-8 h-8 rounded-xl text-[10px] font-bold cursor-pointer transition-all"
                          style={p === page ? btnStyle.primary : btnStyle.ghost}>{p}</button>
                      );
                    })}
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-white disabled:opacity-25 transition-all cursor-pointer" style={btnStyle.ghost}><ChevronRight size={13} /></button>
                  </div>
                </div>
              </SectionCard>
            </div>
          )}

          {/* ════════════════════ COUNTRIES ════════════════════ */}
          {activeTab === 'countries' && (
            <div className="flex flex-col gap-5">
              {/* Top Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <SectionCard accentColor="#38BDF888">
                  <div className="p-4 flex items-center justify-between">
                    <div>
                      <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Tracked Countries</div>
                      <div className="text-2xl font-black text-white mt-1">{countryAnalytics.length}</div>
                      <div className="text-[9px] text-slate-400 mt-0.5 font-medium">Unique Geographic Locations</div>
                    </div>
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl bg-[#38BDF8]/10 border border-[#38BDF8]/20">
                      🌐
                    </div>
                  </div>
                </SectionCard>

                <SectionCard accentColor="#FF8A0088">
                  <div className="p-4 flex items-center justify-between">
                    <div>
                      <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Top User Hub</div>
                      <div className="text-xl font-black text-white mt-1 truncate max-w-[140px]">
                        {countryAnalytics[0]?.flag || '🌐'} {countryAnalytics[0]?.name || 'N/A'}
                      </div>
                      <div className="text-[9px] text-amber-400 mt-0.5 font-bold">
                        {countryAnalytics[0]?.count || 0} users ({countryAnalytics[0]?.percentage || 0}%)
                      </div>
                    </div>
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl bg-[#FF8A00]/10 border border-[#FF8A00]/20">
                      🏆
                    </div>
                  </div>
                </SectionCard>

                <SectionCard accentColor="#4ADE8088">
                  <div className="p-4 flex items-center justify-between">
                    <div>
                      <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Active Live Online</div>
                      <div className="text-2xl font-black text-green-400 mt-1">
                        {countryAnalytics.reduce((acc, curr) => acc + curr.online, 0)}
                      </div>
                      <div className="text-[9px] text-slate-400 mt-0.5 font-medium">Currently Mining Online</div>
                    </div>
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl bg-green-500/10 border border-green-500/20">
                      ⚡
                    </div>
                  </div>
                </SectionCard>

                <SectionCard accentColor="#00E5FF88">
                  <div className="p-4 flex items-center justify-between">
                    <div>
                      <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Premium Members</div>
                      <div className="text-2xl font-black text-[#00E5FF] mt-1">
                        {countryAnalytics.reduce((acc, curr) => acc + curr.premium, 0)}
                      </div>
                      <div className="text-[9px] text-slate-400 mt-0.5 font-medium">Telegram Star Supporters</div>
                    </div>
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl bg-[#00E5FF]/10 border border-[#00E5FF]/20">
                      ⭐
                    </div>
                  </div>
                </SectionCard>
              </div>

              {/* Main Country List & Breakdown Card */}
              <SectionCard accentColor="#38BDF855">
                <div className="p-5 flex flex-col gap-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-black text-white flex items-center gap-2">
                        <span>🌐</span> Country & Regional Demographics
                      </h3>
                      <p className="text-[10px] text-slate-500 mt-0.5">Real-time user count, online activity, and point generation by country</p>
                    </div>

                    <div className="relative w-full md:w-64">
                      <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                      <input
                        value={countrySearch}
                        onChange={e => setCountrySearch(e.target.value)}
                        placeholder="Search country name..."
                        className="w-full pl-10 pr-4 h-9 rounded-xl text-xs text-white outline-none"
                        style={inputStyle}
                      />
                    </div>
                  </div>

                  {/* Table of Countries */}
                  <div className="overflow-x-auto rounded-2xl border border-white/[0.06]" style={{ background: 'rgba(0,0,0,0.2)' }}>
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead>
                        <tr className="border-b border-white/[0.08] text-[9px] uppercase tracking-wider text-slate-500" style={{ background: 'rgba(255,255,255,0.02)' }}>
                          <th className="py-3 px-4">Rank & Country</th>
                          <th className="py-3 px-4">User Count</th>
                          <th className="py-3 px-4">Percentage</th>
                          <th className="py-3 px-4">Online Live</th>
                          <th className="py-3 px-4">Premium Users</th>
                          <th className="py-3 px-4 text-right">Avg EForce/User</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04]">
                        {filteredCountries.map((c, i) => (
                          <tr key={c.name} className="hover:bg-white/[0.03] transition-colors">
                            <td className="py-3 px-4 flex items-center gap-3">
                              <span className="text-[10px] font-black text-slate-500 w-4">#{i + 1}</span>
                              <span className="text-base">{c.flag}</span>
                              <span className="font-bold text-white text-xs">{c.name}</span>
                            </td>
                            <td className="py-3 px-4 font-black text-white">{c.count.toLocaleString()}</td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <div className="w-20 h-1.5 rounded-full bg-white/5 overflow-hidden">
                                  <div className="h-full rounded-full bg-gradient-to-r from-[#38BDF8] to-[#00E5FF]" style={{ width: `${c.percentage}%` }} />
                                </div>
                                <span className="text-[10px] font-bold text-slate-400">{c.percentage}%</span>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              {c.online > 0 ? (
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-green-400/10 text-green-400 border border-green-400/20">
                                  ● {c.online} online
                                </span>
                              ) : (
                                <span className="text-[9px] text-slate-600">0 online</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              {c.premium > 0 ? (
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#00E5FF]/10 text-[#00E5FF] border border-[#00E5FF]/20 flex items-center gap-1 w-fit">
                                  <Star size={9} className="fill-current" /> {c.premium}
                                </span>
                              ) : (
                                <span className="text-[9px] text-slate-600">0 premium</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right font-black text-[#FF8A00]">
                              {c.avgPoints.toLocaleString()} EFC
                            </td>
                          </tr>
                        ))}

                        {filteredCountries.length === 0 && (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-slate-500 text-xs font-medium">
                              No country data matches your search query.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </SectionCard>
            </div>
          )}
          {activeTab === 'tasks' && (
            <div className="flex flex-col gap-5">
              <SectionCard accentColor="#A3E63588">
                <div className="p-5 flex flex-col gap-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <h2 className="text-base font-black text-white">Mission Control</h2>
                      <p className="text-[10px] text-slate-500 mt-0.5">Create and manage EForce earning missions — {tasks.length} active task{tasks.length !== 1 ? 's' : ''}</p>
                    </div>
                    <button
                      onClick={() => { setShowTaskForm(true); setEditingTask(null); setTaskForm(blankTask); }}
                      className={`${Btn.primary} h-10 px-5 rounded-2xl text-xs`}
                      style={btnStyle.primary}
                    >
                      <Plus size={14} /> New Mission
                    </button>
                  </div>

                  {/* Task form */}
                  <AnimatePresence>
                    {showTaskForm && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="rounded-2xl p-5 flex flex-col gap-4 mt-1"
                          style={{ background: 'rgba(163,230,53,0.04)', border: '1px solid rgba(163,230,53,0.2)' }}>
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{editingTask ? '✏️' : '➕'}</span>
                            <span className="text-xs font-black text-white">{editingTask ? 'Edit Mission' : 'New Mission'}</span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div><label className="text-[8px] text-slate-500 font-black uppercase tracking-wider block mb-1">Title *</label><input type="text" value={taskForm.title} onChange={e => setTaskForm(p => ({ ...p, title: e.target.value }))} className={inputCls} style={inputStyle} /></div>
                            <div><label className="text-[8px] text-slate-500 font-black uppercase tracking-wider block mb-1">URL</label><input type="text" value={taskForm.url} onChange={e => setTaskForm(p => ({ ...p, url: e.target.value }))} className={inputCls} style={inputStyle} /></div>
                          </div>
                          <div><label className="text-[8px] text-slate-500 font-black uppercase tracking-wider block mb-1">Description</label><textarea value={taskForm.description} onChange={e => setTaskForm(p => ({ ...p, description: e.target.value }))} rows={2} className="w-full rounded-xl px-3 py-2 text-xs text-white outline-none resize-none" style={inputStyle} /></div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {[{ label: 'EForce Reward', key: 'reward' }, { label: 'Token Reward', key: 'tokenReward' }, { label: 'Daily Limit', key: 'dailyLimit' }, { label: 'Total Limit', key: 'totalCompletionLimit' }].map(f => (
                              <div key={f.key}><label className="text-[8px] text-slate-500 font-black uppercase tracking-wider block mb-1">{f.label}</label><input type="number" value={(taskForm as any)[f.key]} onChange={e => setTaskForm(p => ({ ...p, [f.key]: Number(e.target.value) }))} className={inputCls + ' text-right'} style={inputStyle} /></div>
                            ))}
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div>
                              <label className="text-[8px] text-slate-500 font-black uppercase tracking-wider block mb-1">Type</label>
                              <select value={taskForm.type} onChange={e => setTaskForm(p => ({ ...p, type: e.target.value as TaskType }))} className={inputCls + ' cursor-pointer'} style={{ ...inputStyle, background: '#0A0D1A' }}>
                                <option value="channel">Telegram Channel</option>
                                <option value="group">Telegram Group</option>
                                <option value="x">Follow on X</option>
                                <option value="discord">Discord Server</option>
                                <option value="tiktok">TikTok Channel</option>
                                <option value="instagram">Instagram Page</option>
                                <option value="youtube">YouTube Channel / Video</option>
                                <option value="reddit">Reddit Subreddit</option>
                                <option value="quiz">Quiz / Secret Answer</option>
                                <option value="website">Visit Website</option>
                                <option value="video">Watch Video</option>
                                <option value="daily">Daily Mission</option>
                                <option value="ad">Reward Ad</option>
                              </select>
                            </div>

                            <div>
                              <label className="text-[8px] text-slate-500 font-black uppercase tracking-wider block mb-1">Quiz Answer / Secret Code</label>
                              <input
                                type="text"
                                placeholder="Correct answer for user verification..."
                                value={taskForm.answer || ''}
                                onChange={e => setTaskForm(p => ({ ...p, answer: e.target.value }))}
                                className={inputCls}
                                style={inputStyle}
                              />
                            </div>

                            <div>
                              <label className="text-[8px] text-slate-500 font-black uppercase tracking-wider block mb-1">Required Social Account</label>
                              <select
                                value={taskForm.requireSocialConnection || 'none'}
                                onChange={e => setTaskForm(p => ({ ...p, requireSocialConnection: e.target.value as any }))}
                                className={inputCls + ' cursor-pointer'}
                                style={{ ...inputStyle, background: '#0A0D1A' }}
                              >
                                <option value="none">None (Auto / Open Access)</option>
                                <option value="x">Require X (Twitter) Connected</option>
                                <option value="discord">Require Discord Connected</option>
                                <option value="instagram">Require Instagram Connected</option>
                                <option value="tiktok">Require TikTok Connected</option>
                                <option value="youtube">Require YouTube Connected</option>
                                <option value="reddit">Require Reddit Connected</option>
                              </select>
                            </div>

                            <div>
                              <label className="text-[8px] text-slate-500 font-black uppercase tracking-wider block mb-1">Interrupted Cooldown (Seconds)</label>
                              <input
                                type="number"
                                value={taskForm.cooldownSeconds ?? 30}
                                onChange={e => setTaskForm(p => ({ ...p, cooldownSeconds: Number(e.target.value) }))}
                                className={inputCls + ' text-right'}
                                style={inputStyle}
                              />
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-5 items-center pt-2 border-t border-white/5">
                            <label className="flex items-center gap-2 text-[10px] text-slate-300 font-bold cursor-pointer">
                              <input type="checkbox" checked={taskForm.isEnabled} onChange={e => setTaskForm(p => ({ ...p, isEnabled: e.target.checked }))} className="accent-[#FF8A00]" />
                              Enabled
                            </label>
                            <label className="flex items-center gap-2 text-[10px] text-slate-300 font-bold cursor-pointer">
                              <input type="checkbox" checked={taskForm.requireRewardedAd ?? true} onChange={e => setTaskForm(p => ({ ...p, requireRewardedAd: e.target.checked }))} className="accent-[#FF8A00]" />
                              Require Rewarded Ad
                            </label>
                            <label className="flex items-center gap-2 text-[10px] text-slate-300 font-bold cursor-pointer">
                              <input type="checkbox" checked={taskForm.autoApprove} onChange={e => setTaskForm(p => ({ ...p, autoApprove: e.target.checked }))} className="accent-[#FF8A00]" />
                              Auto-approve
                            </label>
                            <label className="flex items-center gap-2 text-[10px] cursor-pointer font-bold" style={{ color: taskForm.isMandatory ? '#FF8A00' : '#64748b' }}>
                              <input type="checkbox" checked={(taskForm as any).isMandatory ?? false} onChange={e => setTaskForm(p => ({ ...p, isMandatory: e.target.checked }))} className="accent-[#FF8A00]" />
                              🔒 Mandatory
                            </label>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={handleSaveTask} className={`${Btn.primary} flex-1 h-10 rounded-xl text-xs`} style={btnStyle.primary}>
                              {editingTask ? <><Save size={13} /> Update Mission</> : <><Plus size={13} /> Create Mission</>}
                            </button>
                            <button onClick={() => { setShowTaskForm(false); setEditingTask(null); }} className={`${Btn.ghost} h-10 px-5 rounded-xl text-xs`} style={btnStyle.ghost}>Cancel</button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </SectionCard>

              {/* Task cards grid */}
              {tasks.length === 0 ? (
                <div className="rounded-[22px] py-20 text-center flex flex-col items-center gap-4" style={panelStyle}>
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl" style={{ background: 'rgba(163,230,53,0.08)', border: '1px solid rgba(163,230,53,0.2)' }}>✅</div>
                  <div><p className="text-sm font-bold text-white">No missions yet</p><p className="text-xs text-slate-500 mt-1">Create your first earning mission above.</p></div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {tasks.map((task, idx) => {
                    const tc = TASK_TYPE_COLORS[task.type] ?? TASK_TYPE_COLORS['website'];
                    return (
                      <motion.div key={task.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}
                        className="rounded-[22px] p-4 flex flex-col gap-3 relative overflow-hidden transition-all hover:shadow-[0_0_30px_rgba(163,230,53,0.07)]"
                        style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid ${task.isEnabled ? 'rgba(163,230,53,0.15)' : 'rgba(255,255,255,0.06)'}` }}>
                        {/* Top accent */}
                        <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-[22px]"
                          style={{ background: task.isEnabled ? 'linear-gradient(90deg, transparent, rgba(163,230,53,0.5), transparent)' : 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)' }} />

                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className={`w-2 h-2 rounded-full shrink-0 mt-1 ${task.isEnabled ? 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.8)]' : 'bg-slate-600'}`} />
                            <span className="text-sm font-bold text-white truncate">{task.title}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {task.isMandatory && (
                              <span className="text-[8px] font-black px-2 py-1 rounded-full uppercase tracking-wider" style={{ background: 'rgba(255,138,0,0.15)', color: '#FF8A00', border: '1px solid rgba(255,138,0,0.3)' }}>🔒 Required</span>
                            )}
                            <span className="text-[8px] font-black px-2 py-1 rounded-full capitalize uppercase tracking-wider" style={{ background: tc.bg, color: tc.text, border: `1px solid ${tc.border}` }}>{task.type}</span>
                          </div>
                        </div>

                        {task.description && <p className="text-[10px] text-slate-500 leading-relaxed line-clamp-2">{task.description}</p>}

                        <div className="flex items-center gap-2">
                          <div className="flex-1 rounded-xl px-3 py-2" style={{ background: 'rgba(255,138,0,0.07)', border: '1px solid rgba(255,138,0,0.15)' }}>
                            <div className="text-[7px] text-slate-500 uppercase tracking-widest">EForce Reward</div>
                            <div className="text-sm font-black text-[#FF8A00]">{task.reward.toLocaleString()}</div>
                          </div>
                          {task.tokenReward > 0 && (
                            <div className="flex-1 rounded-xl px-3 py-2" style={{ background: 'rgba(179,136,255,0.07)', border: '1px solid rgba(179,136,255,0.15)' }}>
                              <div className="text-[7px] text-slate-500 uppercase tracking-widest">Token</div>
                              <div className="text-sm font-black text-[#B388FF]">+{task.tokenReward}</div>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 pt-1 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                          {/* Toggle Active/Disabled */}
                          <button onClick={() => handleToggleTask(task)}
                            className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-[10px] font-bold transition-all cursor-pointer flex-1 justify-center"
                            style={task.isEnabled
                              ? { background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.25)', color: '#4ADE80' }
                              : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', color: '#64748b' }
                            }
                          >
                            {task.isEnabled ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                            {task.isEnabled ? 'Active' : 'Inactive'}
                          </button>
                          {/* Edit */}
                          <button onClick={() => startEditTask(task)} title="Edit mission" className="w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer" style={btnStyle.edit}><Edit3 size={13} /></button>
                          {/* Delete */}
                          <button onClick={() => handleDeleteTask(task)} title="Delete mission" className="w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer" style={btnStyle.danger}><Trash2 size={13} /></button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ════════════════════ WITHDRAWALS (PAYOUT QUEUE) ════════════════════ */}
          {activeTab === 'withdrawals' && (
            <div className="flex flex-col gap-6">

              {/* 1. KPI Metric Strip */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="rounded-[22px] p-4 border flex flex-col justify-between" style={{ background: 'rgba(251,191,36,0.06)', borderColor: 'rgba(251,191,36,0.2)' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-yellow-400">Pending Payouts</span>
                    <Clock size={16} className="text-yellow-400" />
                  </div>
                  <div className="mt-3">
                    <div className="text-2xl font-black text-white">{withdrawMetrics.pendingCount} <span className="text-xs text-yellow-400 font-bold">reqs</span></div>
                    <div className="text-[10px] text-slate-400 mt-1 font-mono">{withdrawMetrics.pendingUsdt.toLocaleString()} USDT · {withdrawMetrics.pendingToken.toLocaleString()} EForce</div>
                  </div>
                </div>

                <div className="rounded-[22px] p-4 border flex flex-col justify-between" style={{ background: 'rgba(74,222,128,0.06)', borderColor: 'rgba(74,222,128,0.2)' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-green-400">Total Approved</span>
                    <CheckCircle2 size={16} className="text-green-400" />
                  </div>
                  <div className="mt-3">
                    <div className="text-2xl font-black text-white">{withdrawMetrics.approvedCount} <span className="text-xs text-green-400 font-bold">completed</span></div>
                    <div className="text-[10px] text-slate-400 mt-1 font-mono">{withdrawMetrics.approvedUsdt.toLocaleString()} USDT Total</div>
                  </div>
                </div>

                <div className="rounded-[22px] p-4 border flex flex-col justify-between" style={{ background: 'rgba(248,113,113,0.06)', borderColor: 'rgba(248,113,113,0.2)' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-red-400">Security Risk Alerts</span>
                    <ShieldAlert size={16} className="text-red-400 animate-pulse" />
                  </div>
                  <div className="mt-3">
                    <div className="text-2xl font-black text-red-400">{withdrawMetrics.highRiskPending} <span className="text-xs text-slate-400 font-normal">flagged reqs</span></div>
                    <div className="text-[10px] text-slate-500 mt-1">Anti-cheat flagged or medium/high risk</div>
                  </div>
                </div>

                <div className="rounded-[22px] p-4 border flex flex-col justify-between" style={{ background: 'rgba(59,130,246,0.06)', borderColor: 'rgba(59,130,246,0.2)' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-blue-400">Network & Protocol</span>
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-[9px] font-bold text-blue-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" /> BEP-20
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="text-xs font-bold text-white">BNB Smart Chain</div>
                    <div className="text-[10px] text-slate-400 mt-1">Fast Execution · Zero Friction</div>
                  </div>
                </div>
              </div>

              {/* 2. Control Toolbar (Filters & Search & Batch) */}
              <SectionCard accentColor="#4ADE8088">
                <div className="p-5 flex flex-col gap-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <h2 className="text-base font-black text-white flex items-center gap-2">
                        💳 Payout Queue <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-green-500/10 text-green-400 border border-green-500/20">{processedWithdrawals.length} items</span>
                      </h2>
                      <p className="text-[10px] text-slate-500 mt-0.5">Review, verify BEP-20 wallet addresses, and process member payouts</p>
                    </div>

                    {/* Batch Actions Bar (when items selected) */}
                    {selectedWithdrawIds.length > 0 && (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.05] border border-white/10">
                        <span className="text-xs font-bold text-amber-400">{selectedWithdrawIds.length} Selected</span>
                        <button
                          onClick={() => handleBatchAction('Approved', 'Processed successfully. Batch approved.')}
                          className="h-8 px-3 rounded-lg bg-green-500/20 hover:bg-green-500/30 border border-green-500/40 text-green-400 text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
                        >
                          <Check size={12} /> Batch Approve
                        </button>
                        <button
                          onClick={() => handleBatchAction('Rejected', 'Request rejected during batch review.')}
                          className="h-8 px-3 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-400 text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
                        >
                          <X size={12} /> Batch Reject
                        </button>
                        <button
                          onClick={() => setSelectedWithdrawIds([])}
                          className="h-8 px-2 rounded-lg text-slate-400 hover:text-white text-[10px] font-bold transition-all"
                        >
                          Clear
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Filter Pills + Search Input */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                    {/* Status Tabs */}
                    <div className="md:col-span-6 flex gap-1.5 flex-wrap">
                      {(['all', 'Pending', 'Approved', 'Rejected', 'Banned'] as const).map(f => {
                        const cnt = f === 'all' ? withdrawals.length : withdrawals.filter(w => w.status === f).length;
                        const colors = { all: '#FF8A00', Pending: '#FBBF24', Approved: '#4ADE80', Rejected: '#F87171', Banned: '#FB923C' };
                        const isSelected = withdrawFilter === f;
                        return (
                          <button key={f} onClick={() => setWithdrawFilter(f)}
                            className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-[10px] font-bold transition-all cursor-pointer"
                            style={{
                              background: isSelected ? `${colors[f]}18` : 'rgba(255,255,255,0.04)',
                              border: isSelected ? `1px solid ${colors[f]}40` : '1px solid rgba(255,255,255,0.08)',
                              color: isSelected ? colors[f] : '#64748b',
                            }}
                          >
                            {f} {cnt > 0 && <span className="px-1.5 py-0.5 rounded-full text-[8px] font-black" style={{ background: isSelected ? `${colors[f]}25` : 'rgba(255,255,255,0.08)', color: isSelected ? colors[f] : '#94a3b8' }}>{cnt}</span>}
                          </button>
                        );
                      })}
                    </div>

                    {/* Asset filter */}
                    <div className="md:col-span-2">
                      <select
                        value={withdrawAssetFilter}
                        onChange={e => setWithdrawAssetFilter(e.target.value as any)}
                        className={inputCls + ' cursor-pointer text-[10px]'}
                        style={{ ...inputStyle, background: '#0A0D1A' }}
                      >
                        <option value="all">All Assets</option>
                        <option value="usdt">USDT Only</option>
                        <option value="token">EForce Token</option>
                      </select>
                    </div>

                    {/* Sort selector */}
                    <div className="md:col-span-2">
                      <select
                        value={withdrawSort}
                        onChange={e => setWithdrawSort(e.target.value as any)}
                        className={inputCls + ' cursor-pointer text-[10px]'}
                        style={{ ...inputStyle, background: '#0A0D1A' }}
                      >
                        <option value="newest">Newest First</option>
                        <option value="oldest">Oldest First</option>
                        <option value="amount_desc">Highest Amount</option>
                        <option value="amount_asc">Lowest Amount</option>
                      </select>
                    </div>

                    {/* Search */}
                    <div className="md:col-span-2 relative">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text"
                        placeholder="Search wallet/user..."
                        value={withdrawSearch}
                        onChange={e => setWithdrawSearch(e.target.value)}
                        className={`${inputCls} pl-8 text-[10px]`}
                        style={inputStyle}
                      />
                      {withdrawSearch && (
                        <button onClick={() => setWithdrawSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs">✕</button>
                      )}
                    </div>
                  </div>
                </div>
              </SectionCard>

              {/* 3. Main Data Table */}
              <SectionCard accentColor="#4ADE8033">
                {/* Header row */}
                <div className="grid gap-3 px-5 py-3 border-b text-[9px] font-black uppercase tracking-widest text-slate-500 items-center"
                  style={{ borderColor: 'rgba(255,255,255,0.06)', gridTemplateColumns: '2rem 1.8fr 1.2fr 1.5fr 0.8fr 1fr 9rem' }}>
                  <div>
                    <input
                      type="checkbox"
                      onChange={toggleSelectAllPending}
                      checked={selectedWithdrawIds.length > 0 && selectedWithdrawIds.length === processedWithdrawals.filter(w => w.status === 'Pending').length}
                      className="rounded accent-[#FF8A00] cursor-pointer"
                      title="Select all pending"
                    />
                  </div>
                  <div>User & Security</div>
                  <div>Amount & Asset</div>
                  <div>BEP-20 Wallet Address</div>
                  <div>Status</div>
                  <div>Requested Date</div>
                  <div className="text-right">Actions</div>
                </div>

                {processedWithdrawals.length === 0 ? (
                  <div className="text-center py-16 text-slate-500 text-xs flex flex-col items-center gap-2">
                    <Wallet size={28} className="text-slate-600 mb-1" />
                    <span>No {withdrawFilter !== 'all' ? withdrawFilter.toLowerCase() : ''} payout requests matching filter.</span>
                  </div>
                ) : processedWithdrawals.map((req, idx) => {
                  const userObj = usersList.find(u => u.telegramId === req.telegramId);
                  const isSelected = selectedWithdrawIds.includes(req.id);
                  const formattedDate = req.createdAt?.seconds
                    ? new Date(req.createdAt.seconds * 1000).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : (req.createdAt ? String(req.createdAt).substring(0, 16) : 'Recent');

                  const riskLevel = userObj?.riskLevel || 'safe';

                  return (
                    <motion.div
                      key={req.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className={`grid gap-3 items-center px-5 py-3.5 border-b hover:bg-white/[0.02] transition-all ${isSelected ? 'bg-amber-500/[0.04]' : ''}`}
                      style={{ borderColor: 'rgba(255,255,255,0.04)', gridTemplateColumns: '2rem 1.8fr 1.2fr 1.5fr 0.8fr 1fr 9rem' }}
                    >
                      {/* Checkbox */}
                      <div>
                        {req.status === 'Pending' ? (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              setSelectedWithdrawIds(prev =>
                                prev.includes(req.id) ? prev.filter(i => i !== req.id) : [...prev, req.id]
                              );
                            }}
                            className="rounded accent-[#FF8A00] cursor-pointer"
                          />
                        ) : <div className="w-4" />}
                      </div>

                      {/* User & Security */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative w-9 h-9 rounded-full overflow-hidden flex items-center justify-center text-sm font-black shrink-0 border border-white/10 bg-white/5">
                          {userObj?.photoUrl ? (
                            <img src={userObj.photoUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span>{(req.username?.[0] || 'U').toUpperCase()}</span>
                          )}
                          {userObj?.isOnline && (
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 border-2 border-[#090D16] rounded-full" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-white truncate">@{req.username || req.telegramId}</span>
                            {userObj?.isVerified && <VerifiedBadge size={11} />}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[9px] text-slate-500 font-mono">ID: {req.telegramId}</span>
                            {/* Risk Pill */}
                            <span className={`text-[8px] font-extrabold px-1.5 py-0.2 rounded-md ${riskLevel === 'high' ? 'bg-red-500/15 text-red-400 border border-red-500/30' : riskLevel === 'medium' ? 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30' : 'bg-green-500/10 text-green-400 border border-green-500/20'}`}>
                              {riskLevel.toUpperCase()}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Amount */}
                      <div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-sm font-black text-white">{req.amount || 0}</span>
                          <span className="text-[9px] font-bold text-[#FF8A00] uppercase">{req.type === 'token' ? 'EForce' : 'USDT'}</span>
                        </div>
                        <div className="text-[8px] text-slate-500 mt-0.5">Network: BEP-20</div>
                      </div>

                      {/* Wallet Address */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <span
                            onClick={() => req.walletAddress && handleCopyWallet(req.walletAddress)}
                            className="text-[10px] text-slate-300 font-mono truncate max-w-[110px] cursor-pointer hover:text-amber-400 select-all transition-all"
                            title={`Click to copy: ${req.walletAddress}`}
                          >
                            {req.walletAddress ? `${req.walletAddress.substring(0, 6)}...${req.walletAddress.substring(req.walletAddress.length - 4)}` : 'No Wallet'}
                          </span>
                          {req.walletAddress && (
                            <>
                              <button
                                onClick={() => handleCopyWallet(req.walletAddress)}
                                title="Copy Wallet Address"
                                className={`p-1 rounded transition-all cursor-pointer shrink-0 ${copiedAddress === req.walletAddress ? 'text-green-400 bg-green-500/20' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
                              >
                                {copiedAddress === req.walletAddress ? <Check size={11} /> : <Copy size={11} />}
                              </button>
                              <a
                                href={`https://bscscan.com/address/${req.walletAddress}`}
                                target="_blank"
                                rel="noreferrer"
                                title="View on BscScan"
                                className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-amber-400 transition-all shrink-0"
                              >
                                <ExternalLink size={11} />
                              </a>
                            </>
                          )}
                        </div>
                        <span className="text-[8px] text-slate-500 block truncate">{req.walletAddress ? 'BEP-20 (BNB Chain)' : 'Unset'}</span>
                      </div>

                      {/* Status */}
                      <div>
                        <span className={`text-[9px] font-black px-2.5 py-1 rounded-full inline-block ${req.status === 'Pending' ? 'text-yellow-400 bg-yellow-400/10 border border-yellow-400/25' : req.status === 'Approved' ? 'text-green-400 bg-green-400/10 border border-green-400/25' : 'text-red-400 bg-red-400/10 border border-red-400/25'}`}>
                          {req.status}
                        </span>
                      </div>

                      {/* Date */}
                      <div className="text-[9px] text-slate-400 font-medium">
                        {formattedDate}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 justify-end">
                        {/* Audit Details */}
                        <button
                          onClick={() => setSelectedWithdrawDetail({ req, user: userObj })}
                          title="Audit Payout Details"
                          className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition-all cursor-pointer"
                        >
                          <Info size={12} />
                        </button>

                        {req.status === 'Pending' && (
                          <>
                            <button
                              onClick={() => { setWithdrawModal({ id: req.id, status: 'Approved', req }); setWithdrawNote('Processed successfully. Funds sent to your BEP-20 wallet.'); }}
                              title="Approve Payout"
                              className="flex items-center gap-0.5 h-7 px-2 rounded-lg text-[10px] font-bold cursor-pointer transition-all"
                              style={btnStyle.success}
                            >
                              <Check size={11} /> OK
                            </button>
                            <button
                              onClick={() => { setWithdrawModal({ id: req.id, status: 'Rejected', req }); setWithdrawNote('Wrong or invalid BEP-20 wallet address.'); }}
                              title="Reject Payout"
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition-all cursor-pointer"
                            >
                              <X size={11} />
                            </button>
                            <button
                              onClick={() => { setWithdrawModal({ id: req.id, status: 'Banned', req }); setWithdrawNote('Account suspended due to policy violation (anti-cheat system flag).'); }}
                              title="Ban User & Cancel"
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all cursor-pointer"
                            >
                              <Ban size={11} />
                            </button>
                          </>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </SectionCard>

              {/* 📥 BEP-20 DEPOSIT VERIFICATION QUEUE */}
              <SectionCard accentColor="#00FF8888">
                <div className="p-5 flex flex-col gap-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <h2 className="text-base font-black text-white flex items-center gap-2">
                        📥 Deposit Verification Queue <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{depositRequests.length} total</span>
                      </h2>
                      <p className="text-[10px] text-slate-500 mt-0.5">Verify user BEP-20 TxHash on BscScan and approve deposit credits to user wallets</p>
                    </div>
                  </div>

                  {/* Deposit Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono">
                      <thead>
                        <tr className="border-b border-white/10 text-slate-400 text-[10px] uppercase tracking-wider">
                          <th className="pb-3 font-bold">User</th>
                          <th className="pb-3 font-bold">USDT Deposited</th>
                          <th className="pb-3 font-bold">EFC Bonus</th>
                          <th className="pb-3 font-bold">TxHash (BEP-20)</th>
                          <th className="pb-3 font-bold">Status</th>
                          <th className="pb-3 font-bold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {depositRequests.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-6 text-center text-slate-500 text-xs">
                              No deposit requests submitted yet.
                            </td>
                          </tr>
                        ) : (
                          depositRequests.map((req) => (
                            <tr key={req.id} className="hover:bg-white/[0.02] transition-colors">
                              <td className="py-3 pr-2">
                                <span className="text-white font-bold block">@{req.username || `User_${req.telegramId}`}</span>
                                <span className="text-[9px] text-slate-500 font-mono">ID: {req.telegramId}</span>
                              </td>
                              <td className="py-3 font-bold text-emerald-400">
                                +${req.amountUsdt.toFixed(2)} USDT
                              </td>
                              <td className="py-3 font-bold text-[#FF8A00]">
                                +{req.efcGranted.toLocaleString()} EFC
                              </td>
                              <td className="py-3 font-mono">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-cyan-400 text-[10px] truncate max-w-[140px]">{req.txHash}</span>
                                  <a
                                    href={`https://bscscan.com/tx/${req.txHash}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    title="Verify on BscScan"
                                    className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-emerald-400 transition-all shrink-0"
                                  >
                                    <ExternalLink size={12} />
                                  </a>
                                </div>
                              </td>
                              <td className="py-3">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                                  req.status === 'Approved' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
                                  req.status === 'Rejected' ? 'bg-rose-500/15 text-rose-400 border-rose-500/30' :
                                  'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                }`}>
                                  {req.status}
                                </span>
                              </td>
                              <td className="py-3 text-right">
                                {req.status === 'Pending' ? (
                                  <div className="flex items-center gap-1.5 justify-end">
                                    <button
                                      onClick={async () => {
                                        const ok = await updateDepositRequest(req.id, 'Approved');
                                        if (ok) {
                                          showToast(`Deposit approved! Credited $${req.amountUsdt} USDT & ${req.efcGranted} EFC to user.`, 'success');
                                          sendDepositNotification(settings.botApiUrl, Number(req.telegramId), 'Approved', req.amountUsdt).catch(() => {});
                                        } else {
                                          showToast('Failed to approve deposit.', 'error');
                                        }
                                      }}
                                      className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold cursor-pointer transition-all flex items-center gap-1"
                                    >
                                      <Check size={11} /> Approve
                                    </button>
                                    <button
                                      onClick={async () => {
                                        const ok = await updateDepositRequest(req.id, 'Rejected');
                                        if (ok) {
                                          showToast('Deposit request rejected.', 'info');
                                          sendDepositNotification(settings.botApiUrl, Number(req.telegramId), 'Rejected', req.amountUsdt).catch(() => {});
                                        } else {
                                          showToast('Failed to reject deposit.', 'error');
                                        }
                                      }}
                                      className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 text-[10px] font-bold cursor-pointer transition-all flex items-center gap-1"
                                    >
                                      <X size={11} /> Reject
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-500">Processed</span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </SectionCard>
            </div>
          )}

          {/* ════════════════════ TASK MARKET MODERATION ════════════════════ */}
          {activeTab === 'market' && (
            <div className="flex flex-col gap-5">
              <SectionCard accentColor="#FFD70088">
                <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">🏪</div>
                    <div>
                      <div className="text-sm font-black text-white">Task Market Moderation Hub</div>
                      <div className="text-[9px] text-slate-400">Review user-submitted P2P campaigns, inspect escrow, and manage market security</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full">
                    Escrow Engine Active
                  </span>
                </div>

                <div className="p-5 space-y-4">
                  {/* Market Stats Grid */}
                  <div className="grid grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/8">
                      <div className="text-[9px] text-slate-400 uppercase font-black">Active Campaigns</div>
                      <div className="text-lg font-black text-white mt-1">P2P Live</div>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/8">
                      <div className="text-[9px] text-slate-400 uppercase font-black">Escrow Guarantee</div>
                      <div className="text-lg font-black text-[#FFD700] mt-1">100% Locked</div>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/8">
                      <div className="text-[9px] text-slate-400 uppercase font-black">Platform Fee</div>
                      <div className="text-lg font-black text-[#00FF88] mt-1">25% Retained</div>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/8">
                      <div className="text-[9px] text-slate-400 uppercase font-black">Moderation Queue</div>
                      <div className="text-lg font-black text-cyan-400 mt-1">Auto & Manual</div>
                    </div>
                  </div>

                  {/* Market Moderation Notice */}
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-3">
                    <ShieldAlert size={18} className="text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-bold text-white mb-1">P2P Campaign Safety Policies</div>
                      <div className="text-[10px] text-slate-300 leading-relaxed">
                        All market tasks deduct escrow from campaign creators upfront. Workers receive automated payouts upon task verification. Submissions with suspicious URLs or policy violations should be paused or rejected immediately.
                      </div>
                    </div>
                  </div>

                  {/* ── Market Access & Lock Controller ── */}
                  <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/8 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-black text-white flex items-center gap-2">
                          <Lock size={14} className="text-[#FF8A00]" />
                          Market Access & Maintenance Controller
                        </h4>
                        <p className="text-[10px] text-slate-400">Lock the Market UI, set scheduled maintenance timers, or unlock for users</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase border ${
                        marketStatus === 'on' ? 'bg-[#00FF88]/15 text-[#00FF88] border-[#00FF88]/30' :
                        marketStatus === 'maintenance' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' :
                        'bg-red-500/15 text-red-400 border-red-500/30'
                      }`}>
                        {marketStatus === 'on' ? '🟢 Market Unlocked (ON)' : marketStatus === 'maintenance' ? '⏳ Scheduled Maintenance' : '🔴 Market Locked (OFF)'}
                      </span>
                    </div>

                    {/* Status Mode Selectors */}
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => setMarketStatus('on')}
                        className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                          marketStatus === 'on' ? 'bg-[#00FF88]/20 text-[#00FF88] border border-[#00FF88]/50 shadow-lg' : 'bg-white/5 text-slate-400 border border-white/10'
                        }`}
                      >
                        <CheckCircle2 size={14} /> ON (Unlocked)
                      </button>
                      <button
                        onClick={() => setMarketStatus('off')}
                        className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                          marketStatus === 'off' ? 'bg-red-500/20 text-red-400 border border-red-500/50 shadow-lg' : 'bg-white/5 text-slate-400 border border-white/10'
                        }`}
                      >
                        <Ban size={14} /> OFF (Locked)
                      </button>
                      <button
                        onClick={() => setMarketStatus('maintenance')}
                        className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                          marketStatus === 'maintenance' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50 shadow-lg' : 'bg-white/5 text-slate-400 border border-white/10'
                        }`}
                      >
                        <Clock size={14} /> Maintenance Timer
                      </button>
                    </div>

                    {/* Maintenance Time Presets (when maintenance or off) */}
                    {marketStatus !== 'on' && (
                      <div className="space-y-3 pt-2 border-t border-white/5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                          Set Maintenance Time Limit (Countdown Timer)
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { label: '+15m', mins: 15 },
                            { label: '+30m', mins: 30 },
                            { label: '+1h', mins: 60 },
                            { label: '+2h', mins: 120 },
                            { label: '+6h', mins: 360 },
                            { label: '+12h', mins: 720 },
                            { label: '+24h', mins: 1440 },
                          ].map(p => (
                            <button
                              key={p.label}
                              onClick={() => handleSetMarketTimerPreset(p.mins)}
                              className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-white/5 border border-white/10 hover:border-amber-500/40 text-slate-300 hover:text-amber-400 transition-all cursor-pointer"
                            >
                              {p.label}
                            </button>
                          ))}
                          <button
                            onClick={() => setMarketMaintenanceUntil('')}
                            className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all cursor-pointer"
                          >
                            Clear Timer
                          </button>
                        </div>

                        {/* Expiry DateTime input */}
                        <div className="flex items-center gap-3 pt-1">
                          <input
                            type="datetime-local"
                            value={marketMaintenanceUntil ? new Date(marketMaintenanceUntil).toISOString().slice(0, 16) : ''}
                            onChange={e => setMarketMaintenanceUntil(e.target.value ? new Date(e.target.value).toISOString() : '')}
                            className="px-3 py-2 rounded-xl text-xs bg-white/5 border border-white/10 text-white focus:outline-none"
                          />
                          {marketMaintenanceUntil && (
                            <span className="text-[10px] font-mono text-amber-400">
                              Unlocks at: {new Date(marketMaintenanceUntil).toLocaleString()}
                            </span>
                          )}
                        </div>

                        {/* Lock Notice Message */}
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                            Lock Screen Reason / Notice Message
                          </label>
                          <textarea
                            value={marketLockReason}
                            onChange={e => setMarketLockReason(e.target.value)}
                            placeholder="Enter notice shown to users when locked..."
                            rows={2}
                            className="w-full px-3 py-2 rounded-xl text-xs bg-white/5 border border-white/10 text-white placeholder-slate-600 focus:outline-none resize-none"
                          />
                        </div>
                      </div>
                    )}

                    {/* ── Market Escrow & Fee Configuration Engine ── */}
                    <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-3 pt-3 border-t">
                      <div>
                        <h4 className="text-xs font-black text-white flex items-center gap-2">
                          <Wallet size={14} className="text-[#FFD700]" />
                          Market Escrow & Fee Rates Controller
                        </h4>
                        <p className="text-[10px] text-slate-400">Configure service fees, review costs, and verification rates charged on task creation</p>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Service Fee (%)</label>
                          <input
                            type="number"
                            value={marketServiceFeePercent}
                            onChange={e => setMarketServiceFeePercent(Number(e.target.value))}
                            className="w-full px-3 py-2 rounded-xl text-xs bg-white/5 border border-white/10 text-white font-bold outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Review Fee (EFC)</label>
                          <input
                            type="number"
                            value={marketReviewFee}
                            onChange={e => setMarketReviewFee(Number(e.target.value))}
                            className="w-full px-3 py-2 rounded-xl text-xs bg-white/5 border border-white/10 text-white font-bold outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Manual Verif. (EFC/Worker)</label>
                          <input
                            type="number"
                            step="0.1"
                            value={marketVerificationFeeManual}
                            onChange={e => setMarketVerificationFeeManual(Number(e.target.value))}
                            className="w-full px-3 py-2 rounded-xl text-xs bg-white/5 border border-white/10 text-white font-bold outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Auto Verif. (EFC/Worker)</label>
                          <input
                            type="number"
                            step="0.1"
                            value={marketVerificationFeeAuto}
                            onChange={e => setMarketVerificationFeeAuto(Number(e.target.value))}
                            className="w-full px-3 py-2 rounded-xl text-xs bg-white/5 border border-white/10 text-white font-bold outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* ── BEP-20 Deposit Gateway Configuration ── */}
                    <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-3 pt-3 border-t">
                      <div>
                        <h4 className="text-xs font-black text-white flex items-center gap-2">
                          <ShieldCheck size={14} className="text-[#00FF88]" />
                          BEP-20 (USDT) Deposit Gateway Configuration
                        </h4>
                        <p className="text-[10px] text-slate-400">Set receiving wallet address and USDT conversion rates for user deposits</p>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">BEP-20 Admin Deposit Wallet Address (BSC Network)</label>
                          <input
                            type="text"
                            value={bep20DepositAddress}
                            onChange={e => setBep20DepositAddress(e.target.value)}
                            placeholder="0x..."
                            className="w-full px-3 py-2 rounded-xl text-xs bg-white/5 border border-white/10 text-cyan-400 font-mono font-bold outline-none"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">EFC Points per 1 USDT</label>
                            <input
                              type="number"
                              value={bep20DepositRate}
                              onChange={e => setBep20DepositRate(Number(e.target.value))}
                              className="w-full px-3 py-2 rounded-xl text-xs bg-white/5 border border-white/10 text-white font-bold outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Min. Deposit Amount ($ USDT)</label>
                            <input
                              type="number"
                              step="0.5"
                              value={bep20DepositMinAmount}
                              onChange={e => setBep20DepositMinAmount(Number(e.target.value))}
                              className="w-full px-3 py-2 rounded-xl text-xs bg-white/5 border border-white/10 text-white font-bold outline-none"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Deposit Instructions Text</label>
                          <textarea
                            value={bep20DepositInstructions}
                            onChange={e => setBep20DepositInstructions(e.target.value)}
                            rows={2}
                            className="w-full px-3 py-2 rounded-xl text-xs bg-white/5 border border-white/10 text-white focus:outline-none resize-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Save Button */}
                    <div className="flex justify-end pt-1">
                      <button
                        onClick={handleSaveMarketSettings}
                        disabled={savingMarketSettings}
                        className="px-5 py-2.5 rounded-xl text-xs font-black text-black cursor-pointer transition-all shadow-lg flex items-center gap-1.5"
                        style={{ background: 'linear-gradient(135deg, #FFD700, #FF8A00)' }}
                      >
                        {savingMarketSettings ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                        Save Market & Deposit Settings
                      </button>
                    </div>
                  </div>

                  {/* ── BEP-20 Deposit Requests Center ── */}
                  <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/8 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-black text-white flex items-center gap-2">
                          📥 BEP-20 Deposit Requests ({depositRequests.filter(d => d.status === 'Pending').length} Pending)
                        </h4>
                        <p className="text-[10px] text-slate-400">Review user TxHash submissions and credit EFC/USDT balances</p>
                      </div>
                    </div>

                    {depositRequests.length === 0 ? (
                      <div className="text-center py-6 text-xs text-slate-500 font-mono">No deposit requests submitted yet.</div>
                    ) : (
                      <div className="space-y-2.5">
                        {depositRequests.map((d) => (
                          <div key={d.id} className="p-3.5 rounded-xl bg-black/40 border border-white/10 flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                                  d.status === 'Approved' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                                  d.status === 'Rejected' ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' :
                                  'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                }`}>
                                  {d.status}
                                </span>
                                <span className="text-xs font-bold text-white">{d.username} (ID: {d.telegramId})</span>
                              </div>
                              <span className="text-xs font-black text-[#00FF88]">+${d.amountUsdt} USDT ({d.efcGranted} EFC)</span>
                            </div>

                            <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                              <span className="truncate mr-2">TxHash: <span className="text-cyan-400">{d.txHash}</span></span>
                              <a
                                href={`https://bscscan.com/tx/${d.txHash}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-cyan-400 hover:underline flex items-center gap-1 shrink-0"
                              >
                                BscScan <ExternalLink size={10} />
                              </a>
                            </div>

                            {d.status === 'Pending' && (
                              <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                                <button
                                  onClick={async () => {
                                    const ok = await updateDepositRequest(d.id, 'Approved');
                                    if (ok) {
                                      showToast(`✅ Approved! Credited +${d.efcGranted} EFC & +$${d.amountUsdt} USDT to user.`, 'success');
                                      sendDepositNotification(settings.botApiUrl, Number(d.telegramId), 'Approved', d.amountUsdt).catch(() => {});
                                    } else {
                                      showToast('Failed to approve deposit.', 'error');
                                    }
                                  }}
                                  className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30 transition-all cursor-pointer"
                                >
                                  Approve & Credit User
                                </button>
                                <button
                                  onClick={async () => {
                                    const ok = await updateDepositRequest(d.id, 'Rejected', 'Invalid TxHash or deposit not received');
                                    if (ok) {
                                      showToast('❌ Deposit request rejected.', 'info');
                                      sendDepositNotification(settings.botApiUrl, Number(d.telegramId), 'Rejected', d.amountUsdt, 'Invalid TxHash or deposit not received').catch(() => {});
                                    } else {
                                      showToast('Failed to reject deposit.', 'error');
                                    }
                                  }}
                                  className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:bg-rose-500/30 transition-all cursor-pointer"
                                >
                                  Reject Deposit
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* ── Custom & Pending Market Tasks Moderation Queue ── */}
                  <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/8 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-black text-white flex items-center gap-2">
                          <ShieldCheck size={16} className="text-[#00FF88]" />
                          Custom & Pending Market Tasks Review Queue ({pendingMarketTasks.length})
                        </h4>
                        <p className="text-[10px] text-slate-400">Review custom and pending P2P tasks before approving them for public Market discover</p>
                      </div>
                      <button
                        onClick={loadPendingMarketTasks}
                        disabled={loadingPendingMarket}
                        className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white cursor-pointer"
                      >
                        <RefreshCw size={14} className={loadingPendingMarket ? 'animate-spin' : ''} />
                      </button>
                    </div>

                    {loadingPendingMarket ? (
                      <div className="text-center py-8 text-xs text-slate-500 font-mono">Loading pending market tasks...</div>
                    ) : pendingMarketTasks.length === 0 ? (
                      <div className="text-center py-8 rounded-xl bg-black/20 border border-white/5 space-y-1">
                        <CheckCircle2 size={24} className="mx-auto text-emerald-400 opacity-60" />
                        <div className="text-xs font-bold text-slate-400">No Custom Tasks Awaiting Review</div>
                        <div className="text-[10px] text-slate-600">All submitted custom tasks have been reviewed or published.</div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {pendingMarketTasks.map((t) => (
                          <div key={t.id} className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                  {t.platform} · {t.action || 'Custom'}
                                </span>
                                <span className="text-[9px] font-mono text-slate-400">Creator ID: {t.creatorTelegramId}</span>
                              </div>
                              <span className="text-xs font-black text-[#FFD700]">{t.reward} EFC reward</span>
                            </div>

                            <div>
                              <div className="text-xs font-bold text-white">{t.title}</div>
                              {t.description && <div className="text-[10px] text-slate-400 mt-0.5">{t.description}</div>}
                              {t.targetUrl && (
                                <a href={t.targetUrl} target="_blank" rel="noreferrer" className="text-[10px] text-cyan-400 hover:underline flex items-center gap-1 mt-1">
                                  <ExternalLink size={10} /> {t.targetUrl}
                                </a>
                              )}
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[10px] text-slate-400 font-mono">
                              <span>Escrow Held: {t.totalEscrow || t.budget || 0} EFC</span>
                              <span>Limit: {t.workerLimit} workers</span>
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                              <button
                                onClick={async () => {
                                  const res = await approveMarketTask(t.id);
                                  if (res.ok) {
                                    showToast('✅ Task approved and published to Market!', 'success');
                                    loadPendingMarketTasks();
                                  } else {
                                    showToast(res.error || 'Failed to approve task', 'error');
                                  }
                                }}
                                className="flex-1 py-2 rounded-xl text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                              >
                                <CheckCircle2 size={14} /> Approve & Publish
                              </button>
                              <button
                                onClick={async () => {
                                  const res = await rejectMarketTask(t.id);
                                  if (res.ok) {
                                    showToast(`❌ Task rejected & ${res.refundedAmount || 0} EFC refunded.`, 'info');
                                    loadPendingMarketTasks();
                                  } else {
                                    showToast(res.error || 'Failed to reject task', 'error');
                                  }
                                }}
                                className="flex-1 py-2 rounded-xl text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:bg-rose-500/30 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                              >
                                <X size={14} /> Reject & Refund Escrow
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </SectionCard>
            </div>
          )}

          {/* ════════════════════ NOTIFICATION CENTER ════════════════════ */}
          {activeTab === 'notifications' && (
            <div className="flex flex-col gap-5">
              {/* Top Navigation Tabs for Notification Center */}
              <div className="flex items-center gap-2 p-1.5 bg-[#0D1220] border border-white/10 rounded-2xl">
                {[
                  { id: 'broadcast', label: '📢 Broadcast Manager' },
                  { id: 'templates', label: '⚙️ Event Templates & Toggles' },
                  { id: 'history', label: '📜 Notification History' },
                ].map((st) => (
                  <button
                    key={st.id}
                    onClick={() => {
                      setNotifSubTab(st.id as any);
                      if (st.id === 'history') fetchNotificationHistory();
                    }}
                    className={`flex-1 h-10 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      notifSubTab === st.id
                        ? 'bg-[#182035] text-white shadow-md border border-[#C084FC]/40'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              {/* ── SUB-TAB 1: BROADCAST MANAGER ── */}
              {notifSubTab === 'broadcast' && (
                <SectionCard accentColor="#C084FC88">
                  <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center text-lg bg-[#C084FC]/10 border border-[#C084FC]/30 text-[#C084FC]">📢</div>
                      <div>
                        <div className="text-sm font-black text-white">Targeted Broadcast Center</div>
                        <div className="text-[9px] text-slate-400">Broadcast customized Telegram push alerts to filtered audience segments</div>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 flex flex-col gap-4">
                    {/* Audience Target Selector */}
                    <div className="flex flex-col gap-2">
                      <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Select Broadcast Audience Target</label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {[
                          { id: 'everyone', label: '🌐 Everyone' },
                          { id: 'premium', label: '⭐ Telegram Premium Users' },
                          { id: 'specific', label: '👤 Specific User IDs' },
                          { id: 'campaign', label: '🏆 By Campaign' },
                          { id: 'country', label: '🌍 By Country' },
                          { id: 'language', label: '🗣 By Language' },
                        ].map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setBcastTargetType(t.id as any)}
                            className={`h-10 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center text-center ${
                              bcastTargetType === t.id
                                ? 'bg-[#C084FC]/15 border-[#C084FC]/50 text-[#C084FC]'
                                : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Filter specific fields based on target selection */}
                    {bcastTargetType === 'specific' && (
                      <div className="flex flex-col gap-3 p-3.5 rounded-2xl bg-white/[0.03] border border-white/8">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] text-[#C084FC] font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                            <Users size={14} /> Target Telegram User IDs ({targetIdArray.length} Selected)
                          </label>
                          {targetIdArray.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setBcastTargetIds('')}
                              className="text-[10px] font-bold text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                            >
                              🧹 Clear All Selected
                            </button>
                          )}
                        </div>

                        {/* Text input fallback for raw ID pasting */}
                        <input
                          type="text"
                          placeholder="Type or paste Telegram User IDs (e.g. 123456789, 987654321)..."
                          value={bcastTargetIds}
                          onChange={(e) => setBcastTargetIds(e.target.value)}
                          className={inputCls}
                          style={inputStyle}
                        />

                        {/* Selected User Chips */}
                        {targetIdArray.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 py-1">
                            {targetIdArray.map(idStr => {
                              const found = usersList.find(u => String(u.telegramId) === idStr);
                              return (
                                <span
                                  key={idStr}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-[#C084FC]/15 border border-[#C084FC]/40 text-white"
                                >
                                  <span className="w-4 h-4 rounded-full bg-[#C084FC]/30 flex items-center justify-center text-[9px] uppercase font-black text-[#C084FC]">
                                    {found?.firstName?.[0] || 'U'}
                                  </span>
                                  <span>{found ? `${found.firstName} (${idStr})` : `ID: ${idStr}`}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveTargetId(idStr)}
                                    className="hover:text-red-400 text-slate-400 cursor-pointer transition-colors"
                                  >
                                    <X size={12} />
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                        )}

                        {/* Interactive User Selection Dropdown Picker */}
                        <div className="space-y-2 pt-2 border-t border-white/5">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Click User below to Add / Remove ID</span>
                            <span className="text-[9px] text-slate-500">{usersList.length} Total Users Available</span>
                          </div>
                          <div className="relative">
                            <input
                              type="text"
                              placeholder="Search registered user by name, @username, or ID..."
                              value={bcastSearchQuery}
                              onChange={(e) => setBcastSearchQuery(e.target.value)}
                              className="w-full h-8 px-3 rounded-xl text-xs bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none"
                            />
                          </div>

                          <div className="max-h-48 overflow-y-auto space-y-1 pr-1" style={{ scrollbarWidth: 'thin' }}>
                            {filteredBcastUsers.slice(0, 20).map(u => {
                              const uIdStr = String(u.telegramId);
                              const isSelected = targetIdArray.includes(uIdStr);
                              return (
                                <button
                                  key={u.telegramId}
                                  type="button"
                                  onClick={() => handleToggleTargetId(uIdStr)}
                                  className={`w-full flex items-center justify-between p-2 rounded-xl text-left cursor-pointer transition-all ${
                                    isSelected
                                      ? 'bg-[#C084FC]/20 border border-[#C084FC]/40 text-white shadow-md'
                                      : 'bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 text-slate-300'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-7 h-7 rounded-xl bg-white/10 flex items-center justify-center text-xs font-black text-amber-400 shrink-0 uppercase overflow-hidden">
                                      {u.photoUrl ? (
                                        <img src={u.photoUrl} alt="" className="w-full h-full object-cover" />
                                      ) : (
                                        u.firstName?.[0] || 'U'
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="text-xs font-bold text-white truncate flex items-center gap-1">
                                        {u.firstName} {u.lastName || ''}
                                        {u.username && <span className="text-[10px] text-[#C084FC]">@{u.username}</span>}
                                      </div>
                                      <div className="text-[9px] font-mono text-slate-400">ID: {uIdStr}</div>
                                    </div>
                                  </div>
                                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-lg ${
                                    isSelected ? 'bg-[#C084FC] text-black' : 'bg-white/10 text-slate-400'
                                  }`}>
                                    {isSelected ? '✓ Selected' : '+ Add ID'}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {bcastTargetType === 'campaign' && (
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Campaign ID</label>
                        <input
                          type="text"
                          placeholder="e.g. launch_campaign_2026"
                          value={bcastCampaignId}
                          onChange={(e) => setBcastCampaignId(e.target.value)}
                          className={inputCls}
                          style={inputStyle}
                        />
                      </div>
                    )}

                    {bcastTargetType === 'country' && (
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Country Code</label>
                        <input
                          type="text"
                          placeholder="e.g. Bangladesh or BD"
                          value={bcastCountry}
                          onChange={(e) => setBcastCountry(e.target.value)}
                          className={inputCls}
                          style={inputStyle}
                        />
                      </div>
                    )}

                    {bcastTargetType === 'language' && (
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Language Code</label>
                        <input
                          type="text"
                          placeholder="e.g. en or bn"
                          value={bcastLanguage}
                          onChange={(e) => setBcastLanguage(e.target.value)}
                          className={inputCls}
                          style={inputStyle}
                        />
                      </div>
                    )}

                    {/* Template text */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Message Content (Supports HTML & Emojis)</label>
                      <textarea
                        rows={5}
                        placeholder="📢 <b>Elite Force Announcement</b>&#10;&#10;Type message here..."
                        value={notifMessage}
                        onChange={(e) => setNotifMessage(e.target.value)}
                        className="w-full rounded-xl px-3 py-2.5 text-xs text-white outline-none font-mono"
                        style={{ ...inputStyle, minHeight: 110 }}
                      />
                    </div>

                    {/* Optional Image */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Image / Banner URL (Optional)</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="e.g. https://example.com/banner.jpg"
                          value={notifImageUrl}
                          onChange={(e) => setNotifImageUrl(e.target.value)}
                          className={`${inputCls} flex-1`}
                          style={inputStyle}
                        />
                        <label className="h-9 px-4 rounded-xl bg-[#C084FC] text-white text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer shrink-0">
                          {uploadingNotificationImage ? <RefreshCw size={11} className="animate-spin" /> : <Upload size={11} />} Upload
                          <input type="file" accept="image/*" onChange={handleNotificationImageUpload} className="hidden" disabled={uploadingNotificationImage} />
                        </label>
                      </div>
                    </div>

                    {/* Inline Keyboard Controls */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Inline Button Label</label>
                        <input
                          type="text"
                          placeholder="Open Elite Force"
                          value={bcastButtonText}
                          onChange={(e) => setBcastButtonText(e.target.value)}
                          className={inputCls}
                          style={inputStyle}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Target App Tab</label>
                        <select
                          value={bcastButtonTab}
                          onChange={(e) => setBcastButtonTab(e.target.value)}
                          className={`${inputCls} cursor-pointer`}
                          style={{ ...inputStyle, background: '#0D1220' }}
                        >
                          <option value="home">Home / Mine</option>
                          <option value="tasks">Missions & Tasks</option>
                          <option value="profile">Profile & Connections</option>
                          <option value="friends">Referrals / Friends</option>
                          <option value="wallet">Wallet & Withdraw</option>
                          <option value="support">Support</option>
                        </select>
                      </div>
                    </div>

                    {/* Action Button */}
                    <button
                      onClick={handleSendNotification}
                      disabled={notifSending || !notifMessage.trim()}
                      className={`${Btn.primary} w-full h-12 rounded-2xl text-sm font-black mt-2`}
                      style={{ ...btnStyle.primary, background: 'linear-gradient(135deg, #C084FC, #818CF8)', boxShadow: '0 0 30px rgba(192,132,252,0.35)' }}
                    >
                      {notifSending ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
                      {notifSending ? 'Broadcasting...' : `Broadcast Message to ${bcastTargetType.toUpperCase()}`}
                    </button>
                  </div>
                </SectionCard>
              )}

              {/* ── SUB-TAB 2: EVENT TEMPLATES & TOGGLES ── */}
              {notifSubTab === 'templates' && (
                <SectionCard accentColor="#4ADE8088">
                  <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center text-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">⚙️</div>
                      <div>
                        <div className="text-sm font-black text-white">Event Message Templates & System Toggles</div>
                        <div className="text-[9px] text-slate-400">Configure event notifications, edit templates, dynamic variables, and buttons</div>
                      </div>
                    </div>
                    <button
                      onClick={handleSaveSettings}
                      disabled={savingSettings}
                      className="px-4 h-9 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      {savingSettings ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />} Save All Templates
                    </button>
                  </div>

                  <div className="p-5 flex flex-col gap-5">
                    {/* Master System Toggle */}
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-extrabold text-white">Telegram Automated Notifications Master Switch</div>
                        <div className="text-[10px] text-slate-400">Turn ON/OFF all automated Telegram bot notifications platform-wide</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const current = settings.notificationSettings?.enabled ?? true;
                          setSettings((s) => ({
                            ...s,
                            notificationSettings: {
                              ...(s.notificationSettings || { events: {} }),
                              enabled: !current,
                            },
                          }));
                        }}
                        className={`px-4 h-8 rounded-xl text-xs font-black border cursor-pointer transition-all ${
                          (settings.notificationSettings?.enabled ?? true)
                            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                            : 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                        }`}
                      >
                        {(settings.notificationSettings?.enabled ?? true) ? '⚡ ENABLED (ONLINE)' : '🔒 DISABLED (OFFLINE)'}
                      </button>
                    </div>

                    {/* Event Selector Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {[
                        { id: 'SOCIAL_CONNECTED', label: '✅ Social Connected' },
                        { id: 'SOCIAL_DISCONNECTED', label: '⚠️ Social Disconnected' },
                        { id: 'TASK_COMPLETED', label: '🎉 Task Completed' },
                        { id: 'TASK_REJECTED', label: '❌ Task Rejected' },
                        { id: 'CAMPAIGN_COMPLETED', label: '🏆 Campaign Done' },
                        { id: 'MINING_COMPLETED', label: '⛏ Mining Done' },
                        { id: 'DAILY_REWARD', label: '🎁 Daily Reward' },
                        { id: 'REFERRAL_BONUS', label: '👥 Referral Bonus' },
                        { id: 'WITHDRAW_APPROVED', label: '💸 Payout Approved' },
                        { id: 'WITHDRAW_REJECTED', label: '🚫 Payout Rejected' },
                        { id: 'DEPOSIT_SUBMITTED', label: '📥 Deposit Submitted' },
                        { id: 'DEPOSIT_APPROVED', label: '✅ Deposit Approved' },
                        { id: 'DEPOSIT_REJECTED', label: '❌ Deposit Rejected' },
                        { id: 'MARKET_TASK_CREATED', label: '📌 Market Task Created' },
                        { id: 'MARKET_TASK_LIVE', label: '🚀 Market Task Live' },
                        { id: 'WORKER_APPROVED', label: '✅ Worker Approved' },
                        { id: 'WORKER_REJECTED', label: '❌ Worker Rejected' },
                        { id: 'LEVEL_UP', label: '⚡ Level Up' },
                        { id: 'STREAK_BONUS', label: '🔥 Streak Bonus' },
                        { id: 'SPIN_WIN', label: '🎡 Lucky Spin' },
                        { id: 'PROMO_CODE_REDEEMED', label: '🎟 Promo Code' },
                        { id: 'PASS_PURCHASED', label: '👑 VIP Pass' },
                        { id: 'KYC_VERIFIED', label: '🛡 Identity Verified' },
                        { id: 'SECURITY_ALERT', label: '🔒 Security Alert' },
                        { id: 'ADMIN_BROADCAST', label: '📢 Admin Broadcast' },
                      ].map((ev) => (
                        <button
                          key={ev.id}
                          type="button"
                          onClick={() => setSelectedEventType(ev.id)}
                          className={`p-2.5 rounded-xl text-left border text-xs font-bold transition-all cursor-pointer ${
                            selectedEventType === ev.id
                              ? 'bg-[#FF8A00]/15 border-[#FF8A00]/50 text-[#FF8A00]'
                              : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                          }`}
                        >
                          {ev.label}
                        </button>
                      ))}
                    </div>

                    {/* Active Event Template Editor */}
                    {(() => {
                      const evConfig = settings.notificationSettings?.events?.[selectedEventType] || {
                        enabled: true,
                        template: '',
                        buttonText: 'Open Elite Force',
                        buttonTab: 'home',
                      };

                      return (
                        <div className="p-5 rounded-2xl bg-black/40 border border-white/10 flex flex-col gap-4">
                          <div className="flex items-center justify-between border-b border-white/5 pb-3">
                            <div className="text-xs font-black text-[#FF8A00] uppercase tracking-wider">
                              Editing Event: {selectedEventType}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const currentEv = evConfig.enabled ?? true;
                                setSettings((s) => ({
                                  ...s,
                                  notificationSettings: {
                                    ...(s.notificationSettings || { enabled: true, events: {} }),
                                    events: {
                                      ...(s.notificationSettings?.events || {}),
                                      [selectedEventType]: {
                                        ...evConfig,
                                        enabled: !currentEv,
                                      },
                                    },
                                  },
                                }));
                              }}
                              className={`px-3 h-7 rounded-lg text-[10px] font-black border cursor-pointer ${
                                (evConfig.enabled ?? true)
                                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                                  : 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                              }`}
                            >
                              {(evConfig.enabled ?? true) ? 'Event Notification ON' : 'Event Notification OFF'}
                            </button>
                          </div>

                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">HTML Message Template</label>
                            <textarea
                              rows={6}
                              value={evConfig.template}
                              onChange={(e) => {
                                const val = e.target.value;
                                setSettings((s) => ({
                                  ...s,
                                  notificationSettings: {
                                    ...(s.notificationSettings || { enabled: true, events: {} }),
                                    events: {
                                      ...(s.notificationSettings?.events || {}),
                                      [selectedEventType]: {
                                        ...evConfig,
                                        template: val,
                                      },
                                    },
                                  },
                                }));
                              }}
                              className="w-full rounded-xl px-3 py-2.5 text-xs text-white outline-none font-mono"
                              style={{ ...inputStyle, minHeight: 120 }}
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1">
                              <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Button Text</label>
                              <input
                                type="text"
                                value={evConfig.buttonText || 'Open Elite Force'}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setSettings((s) => ({
                                    ...s,
                                    notificationSettings: {
                                      ...(s.notificationSettings || { enabled: true, events: {} }),
                                      events: {
                                        ...(s.notificationSettings?.events || {}),
                                        [selectedEventType]: {
                                          ...evConfig,
                                          buttonText: val,
                                        },
                                      },
                                    },
                                  }));
                                }}
                                className={inputCls}
                                style={inputStyle}
                              />
                            </div>

                            <div className="flex flex-col gap-1">
                              <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Button App Tab Target</label>
                              <select
                                value={evConfig.buttonTab || 'home'}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setSettings((s) => ({
                                    ...s,
                                    notificationSettings: {
                                      ...(s.notificationSettings || { enabled: true, events: {} }),
                                      events: {
                                        ...(s.notificationSettings?.events || {}),
                                        [selectedEventType]: {
                                          ...evConfig,
                                          buttonTab: val,
                                        },
                                      },
                                    },
                                  }));
                                }}
                                className={`${inputCls} cursor-pointer`}
                                style={{ ...inputStyle, background: '#0D1220' }}
                              >
                                <option value="home">Home / Mine</option>
                                <option value="tasks">Missions & Tasks</option>
                                <option value="profile">Profile & Connections</option>
                                <option value="friends">Referrals / Friends</option>
                                <option value="wallet">Wallet & Withdraw</option>
                                <option value="support">Support</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </SectionCard>
              )}

              {/* ── SUB-TAB 3: NOTIFICATION HISTORY LOG ── */}
              {notifSubTab === 'history' && (
                <SectionCard accentColor="#38BDF888">
                  <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center text-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">📜</div>
                      <div>
                        <div className="text-sm font-black text-white">Notification History Audit Log</div>
                        <div className="text-[9px] text-slate-400">Real-time log of dispatched notifications, idempotency keys, and delivery status</div>
                      </div>
                    </div>
                    <button
                      onClick={fetchNotificationHistory}
                      disabled={loadingHistory}
                      className="px-3 h-8 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-bold text-slate-300 transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw size={12} className={loadingHistory ? 'animate-spin' : ''} /> Refresh Logs
                    </button>
                  </div>

                  <div className="p-4 flex flex-col gap-3">
                    {historyLogs.length === 0 ? (
                      <div className="text-center py-8 text-xs text-slate-500">
                        {loadingHistory ? 'Loading notification history...' : 'No notification history records found yet.'}
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-white/10 text-[9px] font-black uppercase text-slate-400 tracking-wider">
                              <th className="p-2.5">Time</th>
                              <th className="p-2.5">User ID</th>
                              <th className="p-2.5">Event Type</th>
                              <th className="p-2.5">Status</th>
                              <th className="p-2.5">Message ID</th>
                              <th className="p-2.5">Preview</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {historyLogs.map((log) => (
                              <tr key={log.id} className="hover:bg-white/[0.02] text-[11px]">
                                <td className="p-2.5 text-slate-400 font-mono text-[10px] whitespace-nowrap">
                                  {log.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A'}
                                </td>
                                <td className="p-2.5 text-white font-mono font-bold">
                                  {log.userId || 'Broadcast'}
                                </td>
                                <td className="p-2.5">
                                  <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 text-[9px] font-mono font-bold">
                                    {log.eventType}
                                  </span>
                                </td>
                                <td className="p-2.5">
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold ${
                                    log.deliveryStatus === 'sent' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : log.deliveryStatus === 'blocked' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                  }`}>
                                    {log.deliveryStatus}
                                  </span>
                                </td>
                                <td className="p-2.5 text-slate-400 font-mono text-[10px]">
                                  {log.messageId || '-'}
                                </td>
                                <td className="p-2.5 text-slate-300 line-clamp-1 max-w-xs font-mono text-[10px]">
                                  {log.content ? log.content.replace(/<[^>]*>/g, '') : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </SectionCard>
              )}
            </div>
          )}

          {/* ════════════════════ SECURITY ════════════════════ */}
          {activeTab === 'security' && (
            <div className="flex flex-col gap-5">
              {/* Stats row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Flagged', value: kpi.flagged, icon: '🚩', color: '#FBBF24', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.22)', glow: 'rgba(251,191,36,0.3)' },
                  { label: 'Banned', value: kpi.banned, icon: '🚫', color: '#F87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.22)', glow: 'rgba(248,113,113,0.3)' },
                  { label: 'Auto Miners', value: kpi.autoMiners, icon: '⛏️', color: '#FF8A00', bg: 'rgba(255,138,0,0.08)', border: 'rgba(255,138,0,0.22)', glow: 'rgba(255,138,0,0.3)' },
                  { label: 'Total Users', value: kpi.total, icon: '👥', color: '#B388FF', bg: 'rgba(179,136,255,0.08)', border: 'rgba(179,136,255,0.22)', glow: 'rgba(179,136,255,0.3)' },
                ].map(item => (
                  <motion.div key={item.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className="rounded-[22px] p-5 flex flex-col gap-2 relative overflow-hidden"
                    style={{ background: item.bg, border: `1px solid ${item.border}` }}>
                    <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-[22px]"
                      style={{ background: `linear-gradient(90deg, transparent, ${item.glow}, transparent)` }} />
                    <span className="text-2xl">{item.icon}</span>
                    <span className="text-3xl font-black leading-none" style={{ color: item.color }}>
                      {loadingKpi ? <span className="text-slate-600">—</span> : item.value.toLocaleString()}
                    </span>
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">{item.label}</span>
                  </motion.div>
                ))}
              </div>

              {/* Flagged users list */}
              <SectionCard accentColor="#FBBF2488">
                <div className="px-5 py-4 border-b flex items-center gap-2.5" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  <ShieldAlert size={15} className="text-[#FBBF24]" />
                  <span className="text-sm font-black text-white">Flagged Users</span>
                  {usersList.filter(u => u.flagCount > 0).length > 0 && (
                    <span className="ml-auto text-[9px] font-black px-2.5 py-1 rounded-full" style={{ color: '#FBBF24', background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.25)' }}>
                      {usersList.filter(u => u.flagCount > 0).length} flagged
                    </span>
                  )}
                </div>
                {usersList.filter(u => u.flagCount > 0).length === 0 ? (
                  <div className="text-center py-14 flex flex-col items-center gap-3">
                    <span className="text-3xl">✅</span>
                    <span className="text-xs text-slate-500 font-semibold">System clean! No flagged users.</span>
                  </div>
                ) : usersList.filter(u => u.flagCount > 0).map((u, idx) => (
                  <motion.div key={u.telegramId} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}
                    className="flex items-center gap-3 px-5 py-4 border-b hover:bg-white/[0.015] transition-all"
                    style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black shrink-0"
                      style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.25)', color: '#FBBF24' }}>
                      {(u.firstName?.[0] ?? 'U').toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-bold text-white block">{u.firstName} {u.lastName}</span>
                      <span className="text-[9px] text-slate-500">
                        🚩 {u.flagCount} flags · Risk: <span className="font-bold uppercase" style={{ color: u.riskLevel === 'high' ? '#F87171' : u.riskLevel === 'medium' ? '#FBBF24' : '#4ADE80' }}>{u.riskLevel}</span> · @{u.username}
                      </span>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => handleUnbanUser(u)} className={`${Btn.success} h-8 px-3 rounded-xl text-[9px]`} style={btnStyle.success}><Check size={11} /> Unban</button>
                      <button onClick={() => handleBanUser(u)} className={`${Btn.danger}  h-8 px-3 rounded-xl text-[9px]`} style={btnStyle.danger}><Ban size={11} /> Ban</button>
                    </div>
                  </motion.div>
                ))}
              </SectionCard>

              {/* ── Protected Users — X Connection Status ── */}
              <SectionCard accentColor="#38BDF888">
                <div className="px-5 py-4 border-b flex items-center gap-2.5 flex-wrap" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  <ShieldCheck size={15} className="text-[#38BDF8]" />
                  <span className="text-sm font-black text-white">Protected Users</span>
                  <span className="text-[9px] text-slate-400 font-medium">X Account Link Status</span>
                  <div className="ml-auto flex items-center gap-2">
                    <span className="text-[9px] font-black px-2.5 py-1 rounded-full"
                      style={{ color: '#34D399', background: 'rgba(52,211,153,0.10)', border: '1px solid rgba(52,211,153,0.25)' }}>
                      {usersList.filter(u => (u as any).socialConnections?.x?.connected).length} connected
                    </span>
                    <span className="text-[9px] font-black px-2.5 py-1 rounded-full"
                      style={{ color: '#FB923C', background: 'rgba(251,146,60,0.10)', border: '1px solid rgba(251,146,60,0.25)' }}>
                      {usersList.filter(u => !(u as any).socialConnections?.x?.connected).length} unlinked
                    </span>
                  </div>
                </div>

                {/* Summary Stats */}
                <div className="grid grid-cols-3 divide-x divide-white/5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {[
                    {
                      label: 'X Connected',
                      value: usersList.filter(u => (u as any).socialConnections?.x?.connected).length,
                      color: '#34D399',
                      icon: '🔗',
                    },
                    {
                      label: 'X Verified',
                      value: usersList.filter(u => (u as any).socialConnections?.x?.verified).length,
                      color: '#38BDF8',
                      icon: '✅',
                    },
                    {
                      label: 'Unlinked',
                      value: usersList.filter(u => !(u as any).socialConnections?.x?.connected).length,
                      color: '#FB923C',
                      icon: '⚠️',
                    },
                  ].map(s => (
                    <div key={s.label} className="flex flex-col items-center justify-center py-4 gap-1">
                      <span className="text-lg">{s.icon}</span>
                      <span className="text-xl font-black" style={{ color: s.color }}>{s.value}</span>
                      <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">{s.label}</span>
                    </div>
                  ))}
                </div>

                {/* User rows */}
                <div className="divide-y" style={{ '--tw-divide-opacity': 1 } as React.CSSProperties}>
                  {usersList.length === 0 ? (
                    <div className="text-center py-12 flex flex-col items-center gap-3">
                      <span className="text-3xl">👥</span>
                      <span className="text-xs text-slate-500 font-semibold">No users found.</span>
                    </div>
                  ) : usersList.map((u, idx) => {
                    const xConn = (u as any).socialConnections?.x;
                    const isConnected = !!xConn?.connected;
                    const isVerified  = !!xConn?.verified;
                    const handle      = xConn?.handle || null;

                    return (
                      <motion.div
                        key={u.telegramId}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.02 }}
                        className="flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.015] transition-all"
                        style={{ borderColor: 'rgba(255,255,255,0.04)' }}
                      >
                        {/* Avatar */}
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black shrink-0"
                          style={{
                            background: isConnected ? 'rgba(56,189,248,0.12)' : 'rgba(251,146,60,0.10)',
                            border: `1px solid ${isConnected ? 'rgba(56,189,248,0.3)' : 'rgba(251,146,60,0.25)'}`,
                            color: isConnected ? '#38BDF8' : '#FB923C',
                          }}
                        >
                          {(u.firstName?.[0] ?? 'U').toUpperCase()}
                        </div>

                        {/* User info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-white">{u.firstName} {u.lastName}</span>
                            {u.username && (
                              <span className="text-[9px] text-slate-500 font-mono">@{u.username}</span>
                            )}
                            {isVerified && (
                              <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full"
                                style={{ color: '#38BDF8', background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.25)' }}>
                                ✓ VERIFIED
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {isConnected ? (
                              <span className="text-[9px] font-mono font-bold text-[#34D399]">
                                𝕏 {handle || 'linked'}
                              </span>
                            ) : (
                              <span className="text-[9px] text-[#FB923C] font-semibold">X not connected</span>
                            )}
                            <span className="text-[9px] text-slate-600">·</span>
                            <span className="text-[9px] text-slate-500">{(u.points ?? 0).toLocaleString()} pts</span>
                            <span className="text-[9px] text-slate-600">·</span>
                            <span className="text-[9px] text-slate-500">ID: {u.telegramId}</span>
                          </div>
                        </div>

                        {/* Status badge */}
                        <div className="shrink-0">
                          {isConnected ? (
                            <span
                              className="text-[9px] font-black px-2.5 py-1 rounded-full"
                              style={{
                                color: isVerified ? '#34D399' : '#38BDF8',
                                background: isVerified ? 'rgba(52,211,153,0.10)' : 'rgba(56,189,248,0.10)',
                                border: `1px solid ${isVerified ? 'rgba(52,211,153,0.25)' : 'rgba(56,189,248,0.25)'}`,
                              }}
                            >
                              {isVerified ? '🔒 LOCKED' : '🔗 LINKED'}
                            </span>
                          ) : (
                            <span
                              className="text-[9px] font-black px-2.5 py-1 rounded-full"
                              style={{ color: '#FB923C', background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.2)' }}
                            >
                              ⚠️ UNLINKED
                            </span>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </SectionCard>

            </div>
          )}


          {/* ════════════════════ SETTINGS ════════════════════ */}
          {activeTab === 'settings' && (
            <div className="flex flex-col gap-5">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                {/* Economy */}
                <SectionCard accentColor="#FF8A0088">
                  <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                    <div className="flex items-center gap-2"><span className="text-base">💰</span><span className="text-sm font-black text-white">Economy</span></div>
                    <p className="text-[9px] text-slate-500 mt-0.5">Token values, reward rates, and energy</p>
                  </div>
                  <div className="p-4 flex flex-col divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                    {[{ label: 'Swap Rate (Points per Token)', key: 'swapRate' }, { label: 'EForce Token Value (USD)', key: 'eforceTokenValue' }].map(f => (
                      <div key={f.key} className="flex items-center justify-between gap-4 py-3">
                        <label className="text-xs text-slate-400">{f.label}</label>
                        <input type="number" value={(settings as any)[f.key]} onChange={e => setSettings(prev => ({ ...prev, [f.key]: Number(e.target.value) }))} className="w-28 h-8 rounded-xl px-3 text-xs text-white outline-none text-right transition-all" style={inputStyle} />
                      </div>
                    ))}
                    <div className="flex items-center justify-between py-3">
                      <label className="text-xs text-slate-400">Swap Portal Open</label>
                      <Toggle on={settings.swapOpen} onToggle={() => setSettings(p => ({ ...p, swapOpen: !p.swapOpen }))} accentColor="#4ADE80" />
                    </div>
                  </div>
                </SectionCard>

                {/* Auto Miner & Telegram Premium Limits Configuration */}
                <SectionCard accentColor="#00E5FFaa">
                  <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                    <div className="flex items-center gap-2">
                      <span className="text-base">⛏️</span>
                      <span className="text-sm font-black text-white">Auto Miner & Telegram Premium Timers/Limits</span>
                    </div>
                    <p className="text-[9px] text-slate-500 mt-0.5">Customize mining session duration timers and rewards separately for Standard vs Telegram Premium users</p>
                  </div>
                  <div className="p-4 flex flex-col divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                    <div className="flex items-center justify-between gap-4 py-3">
                      <div>
                        <label className="text-xs text-slate-300 font-bold block">Standard Mining Duration (Seconds)</label>
                        <span className="text-[9px] text-slate-500">e.g. 300 = 5min, 3600 = 1h, 86400 = 24h</span>
                      </div>
                      <input
                        type="number"
                        value={settings.autoMinerDuration || 300}
                        onChange={e => setSettings(p => ({ ...p, autoMinerDuration: Number(e.target.value) }))}
                        className="w-28 h-8 rounded-xl px-3 text-xs text-white outline-none text-right font-mono"
                        style={inputStyle}
                      />
                    </div>

                    <div className="flex items-center justify-between gap-4 py-3">
                      <div>
                        <label className="text-xs text-slate-300 font-bold block">Standard Mining Session Reward (EFC)</label>
                        <span className="text-[9px] text-slate-500">Points awarded per session for standard users</span>
                      </div>
                      <input
                        type="number"
                        value={settings.autoMinerReward || 500}
                        onChange={e => setSettings(p => ({ ...p, autoMinerReward: Number(e.target.value) }))}
                        className="w-28 h-8 rounded-xl px-3 text-xs text-white outline-none text-right font-mono"
                        style={inputStyle}
                      />
                    </div>

                    <div className="flex items-center justify-between gap-4 py-3 bg-amber-400/[0.03] px-2.5 py-3 rounded-xl border border-amber-400/15 my-1">
                      <div>
                        <label className="text-xs text-amber-300 font-black flex items-center gap-1">
                          <span>⭐ Telegram Premium Mining Duration (Seconds)</span>
                        </label>
                        <span className="text-[9px] text-slate-400">Duration timer for Telegram Premium subscribers (e.g. 300s, 14400s)</span>
                      </div>
                      <input
                        type="number"
                        value={settings.premiumAutoMinerDuration || settings.autoMinerDuration || 300}
                        onChange={e => setSettings(p => ({ ...p, premiumAutoMinerDuration: Number(e.target.value) }))}
                        className="w-28 h-8 rounded-xl px-3 text-xs text-amber-300 font-bold outline-none text-right font-mono border border-amber-400/30"
                        style={inputStyle}
                      />
                    </div>

                    <div className="flex items-center justify-between gap-4 py-3 bg-amber-400/[0.03] px-2.5 py-3 rounded-xl border border-amber-400/15 my-1">
                      <div>
                        <label className="text-xs text-amber-300 font-black flex items-center gap-1">
                          <span>⭐ Telegram Premium Mining Reward (EFC)</span>
                        </label>
                        <span className="text-[9px] text-slate-400">Points awarded per session for Telegram Premium subscribers</span>
                      </div>
                      <input
                        type="number"
                        value={settings.premiumAutoMinerReward || 1000}
                        onChange={e => setSettings(p => ({ ...p, premiumAutoMinerReward: Number(e.target.value) }))}
                        className="w-28 h-8 rounded-xl px-3 text-xs text-amber-300 font-bold outline-none text-right font-mono border border-amber-400/30"
                        style={inputStyle}
                      />
                    </div>
                  </div>
                </SectionCard>

                {/* Referral & Withdrawal */}
                <SectionCard accentColor="#B388FF55">
                  <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                    <div className="flex items-center gap-2"><span className="text-base">🔗</span><span className="text-sm font-black text-white">Referral & Withdrawal</span></div>
                    <p className="text-[9px] text-slate-500 mt-0.5">Invite rewards and payout rules</p>
                  </div>
                  <div className="p-4 flex flex-col divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                    {[
                      { label: 'Referral USDT Reward', key: 'referralRewardUsdt' },
                      { label: 'Referral Points Reward', key: 'referralRewardPoints' },
                      { label: 'Min Referrals to Withdraw', key: 'withdrawMinReferrals' },
                      { label: 'Min Withdraw Amount (USDT)', key: 'withdrawMinAmount' },
                      { label: 'Min Withdraw Token Amount (EForce)', key: 'withdrawMinTokenAmount' },
                      { label: 'Daily Withdraw Limit (USDT)', key: 'dailyWithdrawLimit' },
                      { label: 'Daily Token Limit (EForce)', key: 'dailyTokenWithdrawLimit' }
                    ].map(f => (
                      <div key={f.key} className="flex items-center justify-between gap-4 py-3">
                        <label className="text-xs text-slate-400">{f.label}</label>
                        <input type="number" value={(settings as any)[f.key]} onChange={e => setSettings(prev => ({ ...prev, [f.key]: Number(e.target.value) }))} className="w-28 h-8 rounded-xl px-3 text-xs text-white outline-none text-right transition-all" style={inputStyle} />
                      </div>
                    ))}
                    <div className="flex items-center justify-between py-3">
                      <label className="text-xs text-slate-400">Withdrawal Open</label>
                      <Toggle on={settings.withdrawOpen} onToggle={() => setSettings(p => ({ ...p, withdrawOpen: !p.withdrawOpen }))} accentColor="#4ADE80" />
                    </div>
                    <div className="flex items-center justify-between py-3">
                      <label className="text-xs text-slate-400">Require Referrals for Withdraw</label>
                      <Toggle on={settings.withdrawRequireReferrals} onToggle={() => setSettings(p => ({ ...p, withdrawRequireReferrals: !p.withdrawRequireReferrals }))} accentColor="#4ADE80" />
                    </div>
                    <div className="flex items-center justify-between py-3">
                      <div>
                        <label className="text-xs text-slate-400 block">Referral Base Claim Limit (0 Referrals)</label>
                        <span className="text-[9px] text-slate-500">Max points limit for regular users without referrals (default 5000 EFC)</span>
                      </div>
                      <input type="number" value={settings.referralBaseLimit ?? 5000} onChange={e => setSettings(prev => ({ ...prev, referralBaseLimit: Number(e.target.value) }))} className="w-28 h-8 rounded-xl px-3 text-xs text-white outline-none text-right font-mono" style={inputStyle} />
                    </div>
                    <div className="flex items-center justify-between py-3">
                      <div>
                        <label className="text-xs text-slate-400 block">Referral Tier Boost (Per 5 Referrals)</label>
                        <span className="text-[9px] text-slate-500">Points added to claim limit for every 5 referrals up to 50 (default +5000 EFC)</span>
                      </div>
                      <input type="number" value={settings.referralStepLimit ?? 5000} onChange={e => setSettings(prev => ({ ...prev, referralStepLimit: Number(e.target.value) }))} className="w-28 h-8 rounded-xl px-3 text-xs text-white outline-none text-right font-mono" style={inputStyle} />
                    </div>
                    <div className="flex items-center justify-between py-3">
                      <label className="text-xs text-slate-400">Bot Username (Ref Links)</label>
                      <input type="text" value={settings.botUsername} onChange={e => setSettings(prev => ({ ...prev, botUsername: e.target.value }))} className="w-36 h-8 rounded-xl px-3 text-xs text-white outline-none text-right" style={inputStyle} />
                    </div>
                    <div className="flex items-center justify-between py-3 border-t border-white/5">
                      <div>
                        <label className="text-xs text-emerald-400 font-bold block">Admin BEP-20 Deposit Wallet (USDT)</label>
                        <span className="text-[9px] text-slate-500">Address shown to users for USDT deposits</span>
                      </div>
                      <input
                        type="text"
                        placeholder="0x..."
                        value={settings.bep20DepositAddress || ''}
                        onChange={e => setSettings(prev => ({ ...prev, bep20DepositAddress: e.target.value.trim() }))}
                        className="w-56 h-8 rounded-xl px-3 text-xs text-cyan-300 outline-none text-right font-mono border border-emerald-500/30"
                        style={inputStyle}
                      />
                    </div>
                    <div className="flex items-center justify-between py-3">
                      <label className="text-xs text-slate-400">Deposit Conversion Rate (1 USDT = X EFC)</label>
                      <input
                        type="number"
                        value={settings.bep20DepositRate ?? 100}
                        onChange={e => setSettings(prev => ({ ...prev, bep20DepositRate: Number(e.target.value) }))}
                        className="w-28 h-8 rounded-xl px-3 text-xs text-white outline-none text-right font-mono"
                        style={inputStyle}
                      />
                    </div>
                    <div className="flex items-center justify-between py-3">
                      <label className="text-xs text-slate-400">Min Deposit Amount ($ USDT)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={settings.bep20DepositMinAmount ?? 1.0}
                        onChange={e => setSettings(prev => ({ ...prev, bep20DepositMinAmount: Number(e.target.value) }))}
                        className="w-28 h-8 rounded-xl px-3 text-xs text-white outline-none text-right font-mono"
                        style={inputStyle}
                      />
                    </div>
                  </div>
                </SectionCard>

                {/* ── FULLY DYNAMIC REFERRAL CLAIM LIMIT MANAGER ── */}
                <SectionCard accentColor="#FF8A00aa">
                  <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base">🏆</span>
                        <span className="text-sm font-black text-white">Referral Claim Limit Manager</span>
                      </div>
                      <p className="text-[9px] text-slate-400 mt-0.5">
                        Add, edit, delete, reorder, or toggle referral tiers. Changes push in real-time to all connected users without reloading!
                      </p>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-[#FF8A00] bg-[#FF8A00]/10 border border-[#FF8A00]/25 px-2.5 py-1 rounded-full">
                      {referralTiers.length} Active Tiers
                    </span>
                  </div>

                  <div className="p-4 flex flex-col gap-4">
                    {/* Add New Tier Form */}
                    <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col gap-3">
                      <span className="text-xs font-bold text-slate-300 flex items-center gap-1">
                        <Plus size={13} className="text-[#FF8A00]" /> Add New Referral Claim Tier
                      </span>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                        <div>
                          <label className="text-[8px] text-slate-400 uppercase tracking-wider font-bold block mb-1">
                            Required Referrals
                          </label>
                          <input
                            type="number"
                            placeholder="e.g. 15"
                            value={newTierRefs}
                            onChange={e => setNewTierRefs(Number(e.target.value))}
                            className={inputCls}
                            style={inputStyle}
                          />
                        </div>
                        <div>
                          <label className="text-[8px] text-slate-400 uppercase tracking-wider font-bold block mb-1">
                            Max Claim Limit (EFC)
                          </label>
                          <input
                            type="number"
                            placeholder="e.g. 20000"
                            value={newTierLimit}
                            onChange={e => setNewTierLimit(Number(e.target.value))}
                            className={inputCls}
                            style={inputStyle}
                          />
                        </div>
                        <div>
                          <label className="text-[8px] text-slate-400 uppercase tracking-wider font-bold block mb-1">
                            USDT Bonus ($)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="e.g. 0.15"
                            value={newTierBonus}
                            onChange={e => setNewTierBonus(Number(e.target.value))}
                            className={inputCls}
                            style={inputStyle}
                          />
                        </div>
                        <div>
                          <label className="text-[8px] text-slate-400 uppercase tracking-wider font-bold block mb-1">
                            Badge Label
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. 🥇 Gold"
                            value={newTierBadge}
                            onChange={e => setNewTierBadge(e.target.value)}
                            className={inputCls}
                            style={inputStyle}
                          />
                        </div>
                      </div>
                      <button
                        onClick={handleAddReferralTier}
                        className="h-9 px-4 rounded-xl bg-gradient-to-r from-[#FF8A00] to-[#FFB347] text-black text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer shadow-md hover:scale-[1.01] transition-all ml-auto mt-1"
                      >
                        <Plus size={14} /> Create Tier & Live Push
                      </button>
                    </div>

                    {/* Tiers List */}
                    <div className="flex flex-col gap-2">
                      {referralTiers.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-500 border border-dashed border-white/10 rounded-2xl">
                          No referral claim tiers configured yet.
                        </div>
                      ) : (
                        referralTiers.map((tier, idx) => {
                          const isEditing = editingTierId === tier.id;

                          if (isEditing) {
                            return (
                              <div key={tier.id} className="p-3.5 rounded-2xl bg-[#FF8A00]/10 border border-[#FF8A00]/30 flex flex-col gap-2">
                                <span className="text-xs font-bold text-[#FF8A00]">Editing Tier #{idx + 1} ({tier.id})</span>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                  <div>
                                    <label className="text-[8px] text-slate-400 font-bold block mb-1">Req Referrals</label>
                                    <input
                                      type="number"
                                      value={editTierRefs}
                                      onChange={e => setEditTierRefs(Number(e.target.value))}
                                      className={inputCls}
                                      style={inputStyle}
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[8px] text-slate-400 font-bold block mb-1">Claim Limit (EFC)</label>
                                    <input
                                      type="number"
                                      value={editTierLimit}
                                      onChange={e => setEditTierLimit(Number(e.target.value))}
                                      className={inputCls}
                                      style={inputStyle}
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[8px] text-slate-400 font-bold block mb-1">USDT Bonus ($)</label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={editTierBonus}
                                      onChange={e => setEditTierBonus(Number(e.target.value))}
                                      className={inputCls}
                                      style={inputStyle}
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[8px] text-slate-400 font-bold block mb-1">Badge</label>
                                    <input
                                      type="text"
                                      value={editTierBadge}
                                      onChange={e => setEditTierBadge(e.target.value)}
                                      className={inputCls}
                                      style={inputStyle}
                                    />
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 justify-end mt-1">
                                  <button
                                    onClick={() => setEditingTierId(null)}
                                    className="h-8 px-3 rounded-xl bg-white/5 text-slate-300 text-xs font-bold hover:bg-white/10"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => handleSaveEditTier(tier.id)}
                                    className="h-8 px-4 rounded-xl bg-[#FF8A00] text-black text-xs font-black flex items-center gap-1 hover:brightness-110"
                                  >
                                    <Save size={12} /> Save & Push Live
                                  </button>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div
                              key={tier.id}
                              className={`flex items-center justify-between gap-3 p-3 rounded-2xl border transition-all ${
                                tier.isActive
                                  ? 'bg-white/[0.025] border-white/8 hover:bg-white/[0.04]'
                                  : 'bg-white/[0.01] border-white/4 opacity-50'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="flex flex-col gap-0.5 shrink-0">
                                  <button
                                    onClick={() => handleMoveTier(idx, 'up')}
                                    disabled={idx === 0}
                                    className="p-1 text-slate-500 hover:text-white disabled:opacity-20"
                                    title="Move Up"
                                  >
                                    <ChevronUp size={12} />
                                  </button>
                                  <button
                                    onClick={() => handleMoveTier(idx, 'down')}
                                    disabled={idx === referralTiers.length - 1}
                                    className="p-1 text-slate-500 hover:text-white disabled:opacity-20"
                                    title="Move Down"
                                  >
                                    <ChevronDown size={12} />
                                  </button>
                                </div>

                                <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center text-xs font-black shrink-0">
                                  {tier.requiredReferrals}
                                </div>

                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-black text-white">{getTierBadgeWithIcon(tier.badge, tier.requiredReferrals).full}</span>
                                    <span className="text-[9px] text-slate-500 font-mono">({tier.requiredReferrals} Referrals)</span>
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                    Max Claim: <span className="font-bold text-[#FF8A00]">{tier.claimLimit.toLocaleString()} EFC</span> · Bonus: <span className="font-bold text-emerald-400">${tier.bonusUSDT.toFixed(2)} USDT</span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <Toggle
                                  on={tier.isActive}
                                  onToggle={() => handleToggleTierActive(tier)}
                                  accentColor="#4ADE80"
                                />
                                <button
                                  onClick={() => handleStartEditTier(tier)}
                                  className="p-2 rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-all"
                                  title="Edit Tier"
                                >
                                  <Edit3 size={13} />
                                </button>
                                <button
                                  onClick={() => handleDeleteTier(tier.id)}
                                  className="p-2 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-all"
                                  title="Delete Tier"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </SectionCard>

                {/* Telegram Bot Welcome & App Link Customization */}
                <SectionCard accentColor="#38BDF888">
                  <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                    <div className="flex items-center gap-2">
                      <span className="text-base">🤖</span>
                      <span className="text-sm font-black text-white">Telegram Bot Start Message & App Link</span>
                    </div>
                    <p className="text-[9px] text-slate-500 mt-0.5">Customize the /start welcome message, button text, and Mini App URL sent in Telegram</p>
                  </div>
                  <div className="p-4 flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-slate-300 font-bold">Mini App URL (Web App Link)</label>
                      <span className="text-[9px] text-slate-500">The URL opened when users click the bot button</span>
                      <input
                        type="text"
                        placeholder="https://mini-telegram-app-c0fb4.web.app"
                        value={settings.miniAppUrl || ''}
                        onChange={e => setSettings(prev => ({ ...prev, miniAppUrl: e.target.value }))}
                        className="w-full h-9 rounded-xl px-3 text-xs text-white outline-none font-mono"
                        style={inputStyle}
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-slate-300 font-bold">Launch App Button Text</label>
                      <span className="text-[9px] text-slate-500">Text displayed on the Telegram inline web app button</span>
                      <input
                        type="text"
                        placeholder="🔥 Launch Elite Force App 🔥"
                        value={settings.botStartButtonText || ''}
                        onChange={e => setSettings(prev => ({ ...prev, botStartButtonText: e.target.value }))}
                        className="w-full h-9 rounded-xl px-3 text-xs text-white outline-none font-bold"
                        style={inputStyle}
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-slate-300 font-bold">Telegram /start Welcome Text</label>
                      <textarea
                        rows={7}
                        placeholder="Welcome message sent when user runs /start..."
                        value={settings.botStartMessage || ''}
                        onChange={e => setSettings(prev => ({ ...prev, botStartMessage: e.target.value }))}
                        className="w-full rounded-xl p-3 text-xs text-white outline-none resize-y font-sans"
                        style={{ ...inputStyle, minHeight: 130 }}
                      />
                      <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[10px] text-blue-300 space-y-1">
                        <div>💡 <strong>Available Placeholders & Formatting:</strong></div>
                        <div>• Use <code>{'{name}'}</code> or <code>{'{username}'}</code> to automatically insert user's name.</div>
                        <div>• Telegram HTML tags supported: <code>&lt;b&gt;bold&lt;/b&gt;</code>, <code>&lt;i&gt;italic&lt;/i&gt;</code>, <code>&lt;code&gt;code&lt;/code&gt;</code>, <code>&lt;a href="..."&gt;link&lt;/a&gt;</code></div>
                      </div>
                    </div>
                  </div>
                </SectionCard>

                {/* Force Join Verification & Community Gate Configuration */}
                <SectionCard accentColor="#4ADE8088">
                  <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base">🛡️</span>
                        <span className="text-sm font-black text-white">Force Join & Community Verification Gate</span>
                      </div>
                      <p className="text-[9px] text-slate-500 mt-0.5">Require users to join Telegram Channel & Group before accessing Mini App features</p>
                    </div>
                  </div>

                  <div className="p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between py-2 border-b border-white/5">
                      <div>
                        <label className="text-xs text-white font-bold block">Enable Force Join Gate</label>
                        <span className="text-[9px] text-slate-400">Lock app access until user verifies Channel & Group membership</span>
                      </div>
                      <Toggle
                        on={settings.forceJoinEnabled ?? true}
                        onToggle={async () => {
                          const nextVal = !(settings.forceJoinEnabled ?? true);
                          const updated = { ...settings, forceJoinEnabled: nextVal };
                          setSettings(updated);
                          await saveAdminSettings(updated);
                          showToast(nextVal ? '✅ Force Join Gate ENABLED & Live Synced!' : '⚠️ Force Join Gate DISABLED & Live Synced!', nextVal ? 'success' : 'info');
                        }}
                        accentColor="#4ADE80"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-slate-300 font-bold">Telegram Channel Link</label>
                        <input
                          type="text"
                          placeholder="https://t.me/EliteForceChannel"
                          value={settings.telegramChannelUrl || ''}
                          onChange={e => {
                            const urlVal = e.target.value;
                            let autoId = settings.telegramChannelId;
                            if (urlVal.includes('t.me/')) {
                              const parsed = urlVal.split('t.me/')[1].split('?')[0].split('/')[0].replace('+', '');
                              if (parsed) autoId = `@${parsed}`;
                            }
                            setSettings(p => ({ ...p, telegramChannelUrl: urlVal, telegramChannelId: autoId }));
                          }}
                          className={inputCls}
                          style={inputStyle}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-slate-300 font-bold">Telegram Channel Username/ID</label>
                        <input
                          type="text"
                          placeholder="@EliteForceChannel"
                          value={settings.telegramChannelId || ''}
                          onChange={e => {
                            let val = e.target.value.trim();
                            if (val && !val.startsWith('@') && !val.startsWith('-100') && !val.includes('t.me/')) val = `@${val}`;
                            setSettings(p => ({ ...p, telegramChannelId: val }));
                          }}
                          className={inputCls}
                          style={inputStyle}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-slate-300 font-bold">Telegram Group Link</label>
                        <input
                          type="text"
                          placeholder="https://t.me/EliteForceGroup"
                          value={settings.telegramGroupUrl || ''}
                          onChange={e => {
                            const urlVal = e.target.value;
                            let autoId = settings.telegramGroupId;
                            if (urlVal.includes('t.me/')) {
                              const parsed = urlVal.split('t.me/')[1].split('?')[0].split('/')[0].replace('+', '');
                              if (parsed) autoId = `@${parsed}`;
                            }
                            setSettings(p => ({ ...p, telegramGroupUrl: urlVal, telegramGroupId: autoId }));
                          }}
                          className={inputCls}
                          style={inputStyle}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-slate-300 font-bold">Telegram Group Username/ID</label>
                        <input
                          type="text"
                          placeholder="@EliteForceGroup"
                          value={settings.telegramGroupId || ''}
                          onChange={e => {
                            let val = e.target.value.trim();
                            if (val && !val.startsWith('@') && !val.startsWith('-100') && !val.includes('t.me/')) val = `@${val}`;
                            setSettings(p => ({ ...p, telegramGroupId: val }));
                          }}
                          className={inputCls}
                          style={inputStyle}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between py-2 border-t border-white/5">
                      <div>
                        <label className="text-xs text-slate-300 font-bold block">Interrupted Ad Cooldown (Seconds)</label>
                        <span className="text-[9px] text-slate-500">Duration button remains disabled after skipped/canceled ad</span>
                      </div>
                      <input
                        type="number"
                        value={settings.verificationCooldownSeconds ?? 30}
                        onChange={e => setSettings(p => ({ ...p, verificationCooldownSeconds: Number(e.target.value) }))}
                        className="w-24 h-8 rounded-xl px-3 text-xs text-white outline-none text-right font-mono"
                        style={inputStyle}
                      />
                    </div>

                    <button
                      onClick={async () => {
                        await saveAdminSettings(settings);
                        showToast('✅ Force Join Gate settings saved & live synced to users!', 'success');
                      }}
                      className="h-10 w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer shadow-md hover:scale-[1.01] transition-all mt-1"
                    >
                      <Save size={14} /> Save Force Join Gate Settings
                    </button>
                  </div>
                </SectionCard>

                {/* Dedicated Home Dashboard Multi-Banner Slider Manager */}
                <SectionCard accentColor="#00E5FFaa">
                  <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base">🖼️</span>
                        <span className="text-sm font-black text-white">Home Dashboard Multi-Banner Slider</span>
                      </div>
                      <p className="text-[9px] text-slate-500 mt-0.5">Upload multiple hero banners. They will auto-scroll right-to-left on the Home dashboard!</p>
                    </div>
                  </div>

                  <div className="p-5 flex flex-col gap-4">
                    {/* Add New Hero Banner Form */}
                    <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col gap-3">
                      <span className="text-xs font-bold text-slate-300">Add New Carousel Banner</span>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <input
                          type="text"
                          placeholder="Banner Image or Video URL (MP4, WebM)"
                          value={newBannerUrl}
                          onChange={e => setNewBannerUrl(e.target.value)}
                          className={inputCls}
                          style={inputStyle}
                        />
                        <input
                          type="text"
                          placeholder="Banner Title (Optional)"
                          value={newBannerTitle}
                          onChange={e => setNewBannerTitle(e.target.value)}
                          className={inputCls}
                          style={inputStyle}
                        />
                        <input
                          type="text"
                          placeholder="Click Link / Telegram URL (Optional)"
                          value={newBannerLink}
                          onChange={e => setNewBannerLink(e.target.value)}
                          className={inputCls}
                          style={inputStyle}
                        />
                      </div>

                      <div className="flex items-center gap-3 mt-1">
                        <label className="h-9 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black text-xs font-black flex items-center gap-2 cursor-pointer shadow-lg hover:scale-[1.02] transition-all">
                          <Upload size={13} /> Upload Image / Video
                          <input
                            type="file"
                            accept="image/*,video/*"
                            onChange={handleAddBannerUpload}
                            className="hidden"
                          />
                        </label>

                        <button
                          onClick={handleAddHeroBanner}
                          className="h-9 px-5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-lg hover:scale-[1.02] transition-all ml-auto"
                        >
                          <Plus size={14} /> Add to Carousel
                        </button>
                      </div>
                    </div>

                    {/* Active Banners List */}
                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-bold text-slate-400">Active Slide Banners ({(settings.heroBanners || []).length})</span>
                      {(settings.heroBanners || []).length === 0 ? (
                        <div className="p-5 text-center text-xs text-slate-500 border border-dashed border-white/10 rounded-2xl">
                          No multi-banners added yet. Default single banner will be shown.
                        </div>
                      ) : (
                        (settings.heroBanners || []).map((b, idx) => {
                          const isVid = b.imageUrl?.toLowerCase().includes('.mp4') ||
                                        b.imageUrl?.toLowerCase().includes('.webm') ||
                                        b.imageUrl?.toLowerCase().includes('.mov') ||
                                        b.imageUrl?.toLowerCase().startsWith('data:video/');
                          return (
                            <div key={b.id || idx} className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/5">
                              {isVid ? (
                                <div className="w-16 h-10 rounded-xl overflow-hidden border border-white/10 shrink-0 bg-black relative flex items-center justify-center">
                                  <video src={b.imageUrl} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                                  <span className="absolute bottom-0.5 right-0.5 text-[8px] bg-black/70 px-1 py-0.5 rounded text-amber-400 font-bold">🎬 Video</span>
                                </div>
                              ) : (
                                <img src={b.imageUrl} alt="" className="w-16 h-10 object-cover rounded-xl border border-white/10 shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                                  <span>{b.title || `Banner #${idx + 1}`}</span>
                                  {isVid && <span className="text-[9px] text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded font-mono">Video Banner</span>}
                                </div>
                                {b.linkUrl && <div className="text-[10px] text-cyan-400 truncate">{b.linkUrl}</div>}
                              </div>
                              <button
                                onClick={() => handleRemoveHeroBanner(idx)}
                                className="p-2 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-all cursor-pointer"
                                title="Delete Banner"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </SectionCard>

                {/* System Branding & All Image Settings */}
                <SectionCard accentColor="#FF8A0088">
                  <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base">🎨</span>
                        <span className="text-sm font-black text-white">System Image Assets & Branding</span>
                      </div>
                      <p className="text-[9px] text-slate-500 mt-0.5">Customize all logos, icons, hero banners, and token badges across the entire app</p>
                    </div>
                  </div>

                  <div className="p-4 flex flex-col divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                    {[
                      { key: 'loadingLogoUrl', label: 'Loading Screen / Splash Logo', desc: 'Main logo shown during app startup loading screen', defaultVal: '/loading-logo.png' },
                      { key: 'appHeaderLogoUrl', label: 'App Top Header Left Logo', desc: 'Logo image in top navigation header bar (Left)', defaultVal: '/loading-logo.png' },
                      { key: 'appHeaderRightLogoUrl', label: 'App Top Header Right Avatar / Badge', desc: 'Circular avatar icon in top right of Home header bar', defaultVal: '/coin.png' },
                      { key: 'faviconUrl', label: 'Browser Tab Favicon Icon', desc: 'Favicon icon shown on browser tabs', defaultVal: '/loading-logo.png' },
                      { key: 'welcomeBannerUrl', label: 'Home Dashboard Hero Banner (Single Default)', desc: 'Top banner image on Home screen when no carousel slides are added', defaultVal: '/coin-logo.jpg' },
                      { key: 'tasksBannerUrl', label: 'Tasks & Missions Header Banner', desc: 'Header banner image on Tasks page', defaultVal: '/coin-logo.jpg' },
                      { key: 'referralBannerUrl', label: 'Referral & Earn Header Banner', desc: 'Header banner image on Referral page', defaultVal: '/coin-logo.jpg' },
                      { key: 'walletBannerUrl', label: 'Wallet & Payout Header Banner', desc: 'Header banner image on Wallet page', defaultVal: '/coin.jpg' },
                      { key: 'leaderboardBannerUrl', label: 'Leaderboard Header Banner', desc: 'Top banner image on Leaderboard page', defaultVal: '/coin-logo.jpg' },
                      { key: 'usdtIconUrl', label: 'USDT Currency Badge Icon', desc: 'Custom badge icon for USDT balance and rewards', defaultVal: 'https://assets.coingecko.com/coins/images/325/large/Tether.png' },
                      { key: 'eforceTokenIconUrl', label: 'EForce Token Badge Icon', desc: 'Custom badge icon for EForce token balance', defaultVal: '/coin.png' },
                    ].map(item => {
                      const displayUrl = (settings as any)[item.key] || item.defaultVal;
                      const isUploading = uploadingImageField === item.key;
                      const isVid = displayUrl.toLowerCase().includes('.mp4') ||
                                    displayUrl.toLowerCase().includes('.webm') ||
                                    displayUrl.toLowerCase().includes('.mov') ||
                                    displayUrl.toLowerCase().startsWith('data:video/');
                      return (
                        <div key={item.key} className="flex flex-col gap-1 py-3">
                          <div className="flex items-center justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              <label className="text-xs text-slate-300 block font-bold">{item.label}</label>
                              <span className="text-[9px] text-slate-500 block truncate">{item.desc}</span>
                            </div>
                            <div className="flex items-center gap-2.5 shrink-0">
                              <div className="w-9 h-9 rounded-xl border border-white/10 overflow-hidden bg-black/40 flex items-center justify-center shrink-0">
                                {isVid ? (
                                  <video src={displayUrl} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                                ) : (
                                  <ImageWithFallback src={displayUrl} fallbackLetter="🖼️" className="w-full h-full object-contain" />
                                )}
                              </div>
                              <input
                                type="text"
                                placeholder={item.defaultVal}
                                value={(settings as any)[item.key] || ''}
                                onChange={e => {
                                  const val = e.target.value;
                                  setSettings(prev => ({ ...prev, [item.key]: val }));
                                }}
                                onBlur={e => {
                                  const val = e.target.value;
                                  const updated = { ...settingsRef.current, [item.key]: val };
                                  saveAdminSettings(updated).catch(() => {});
                                  showToast(`⚡ ${item.label} saved & synced live!`, 'success');
                                }}
                                className="w-36 md:w-52 h-8 rounded-xl px-3 text-xs text-white outline-none text-right font-mono transition-all focus:border-[#FF8A00]"
                                style={inputStyle}
                              />
                              <label className="h-8 px-3 rounded-xl bg-[#FF8A00] hover:bg-[#FF8A00]/90 text-white text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-all shrink-0 select-none">
                                {isUploading ? <RefreshCw size={10} className="animate-spin" /> : <Upload size={10} />}
                                {isUploading ? 'Uploading...' : 'Upload'}
                                <input
                                  type="file"
                                  accept="image/*,video/*"
                                  onChange={e => handleBrandingUpload(e, item.key as any)}
                                  className="hidden"
                                  disabled={isUploading}
                                />
                              </label>
                            </div>
                          </div>
                          {/* Upload progress bar */}
                          {isUploading && uploadProgress[item.key] !== undefined && (
                            <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                              <div
                                className="h-full rounded-full transition-all duration-300"
                                style={{
                                  width: `${uploadProgress[item.key] ?? 0}%`,
                                  background: 'linear-gradient(90deg, #FF8A00, #FFB347)',
                                }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}

                    <div className="p-4 pt-3 border-t border-white/[0.03]">
                      <p className="text-[9px] text-slate-500">
                        ℹ️ Uploads automatically handle local device files via Bot API & ImgBB/Cloudinary fallbacks. Direct image URLs (e.g., <code>https://i.ibb.co/banner.jpg</code>) can also be pasted directly.
                      </p>
                    </div>
                  </div>
                </SectionCard>

                {/* Monetag Ads */}
                <SectionCard accentColor="#00E5FF55">
                  <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                    <div className="flex items-center gap-2"><span className="text-base">📢</span><span className="text-sm font-black text-white">Monetag Ads</span></div>
                    <p className="text-[9px] text-slate-500 mt-0.5">Sponsored ad system configuration</p>
                  </div>
                  <div className="p-4 flex flex-col divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                    <div className="flex items-center justify-between py-3"><label className="text-xs text-slate-400">Enable Ads System</label><Toggle on={settings.adEnabled} onToggle={() => setSettings(p => ({ ...p, adEnabled: !p.adEnabled }))} accentColor="#4ADE80" /></div>
                    <div className="flex items-center justify-between gap-4 py-3"><label className="text-xs text-slate-400">Monetag Zone ID</label><input type="text" value={settings.monetagZoneId} onChange={e => setSettings(p => ({ ...p, monetagZoneId: e.target.value }))} className="w-36 h-8 rounded-xl px-3 text-xs text-white outline-none text-right" style={inputStyle} /></div>
                    <div className="flex items-center justify-between gap-4 py-3"><label className="text-xs text-slate-400">Monetag Direct Link (Fallback)</label><input type="text" placeholder="https://..." value={settings.monetagDirectLink || ''} onChange={e => setSettings(p => ({ ...p, monetagDirectLink: e.target.value }))} className="w-48 h-8 rounded-xl px-3 text-xs text-white outline-none text-right" style={inputStyle} /></div>
                    {[{ label: 'Ad EForce Reward (Normal)', key: 'adRewardAmount' }, { label: '⭐ Ad EForce Reward (Premium)', key: 'premiumAdRewardAmount' }, { label: 'Ad Token Reward', key: 'adTokenReward' }, { label: 'Daily Ads Limit (Normal)', key: 'adDailyLimitNormal' }, { label: '⭐ Daily Ads Limit (Premium)', key: 'adDailyLimitPremium' }].map(f => (
                      <div key={f.key} className="flex items-center justify-between gap-4 py-3">
                        <label className="text-xs text-slate-400">{f.label}</label>
                        <input type="number" value={(settings as any)[f.key] ?? (f.key === 'premiumAdRewardAmount' ? 200 : 0)} onChange={e => setSettings(prev => ({ ...prev, [f.key]: Number(e.target.value) }))} className="w-28 h-8 rounded-xl px-3 text-xs text-white outline-none text-right" style={inputStyle} />
                      </div>
                    ))}
                    <div className="flex items-center justify-between py-3"><label className="text-xs text-slate-400">Require Ad for Daily Check-in</label><Toggle on={settings.adRequireDailyClaim} onToggle={() => setSettings(p => ({ ...p, adRequireDailyClaim: !p.adRequireDailyClaim }))} accentColor="#FF8A00" /></div>
                    <div className="flex items-center justify-between py-3"><label className="text-xs text-slate-400">Require Ad to Complete Tasks</label><Toggle on={settings.adRequireTasks} onToggle={() => setSettings(p => ({ ...p, adRequireTasks: !p.adRequireTasks }))} accentColor="#FF8A00" /></div>
                    <div className="flex items-center justify-between py-3"><label className="text-xs text-slate-400">Require Ad to Start Mining</label><Toggle on={settings.adRequireAutoMiner} onToggle={() => setSettings(p => ({ ...p, adRequireAutoMiner: !p.adRequireAutoMiner }))} accentColor="#FF8A00" /></div>
                  </div>
                </SectionCard>

                {/* Social Connections (No X OAuth — Username-Based) */}
                <SectionCard accentColor="#E5A33888">
                  <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                    <div className="flex items-center gap-2">
                      <span className="text-base">🔗</span>
                      <span className="text-sm font-black text-white">Social Connections</span>
                    </div>
                    <p className="text-[9px] text-slate-500 mt-0.5">Configure Discord OAuth, X (Twitter) username verification, and WhatsApp numbers for user accounts linkage. X uses username-based verification — no OAuth required.</p>
                  </div>
                  <div className="p-4 flex flex-col divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                    <div className="flex items-center justify-between gap-4 py-3">
                      <label className="text-xs text-slate-400">Discord OAuth Client ID</label>
                      <input
                        type="text"
                        placeholder="e.g. 123456789012345678"
                        value={settings.discordClientId || ''}
                        onChange={e => setSettings(p => ({ ...p, discordClientId: e.target.value }))}
                        className="w-48 h-8 rounded-xl px-3 text-xs text-white outline-none text-right font-mono"
                        style={inputStyle}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5 py-3">
                      <label className="text-xs text-slate-400">Discord Authorize URL</label>
                      <input
                        type="text"
                        placeholder="https://discord.com/oauth2/authorize?client_id="
                        value={settings.discordAuthUrl || ''}
                        onChange={e => setSettings(p => ({ ...p, discordAuthUrl: e.target.value }))}
                        className="w-full h-8 rounded-xl px-3 text-xs text-white outline-none font-mono"
                        style={inputStyle}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-4 py-3">
                      <div>
                        <label className="text-xs text-slate-300 font-bold block">X (Twitter) — Username Verification</label>
                        <span className="text-[9px] text-slate-500 block">No OAuth. Users enter @username. Verification uses Bearer Token (server-side only).</span>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-2.5 py-1">Active ✓</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 py-3">
                      <label className="text-xs text-slate-400">WhatsApp Support / Verification Number</label>
                      <input
                        type="text"
                        placeholder="+9613578241"
                        value={settings.whatsappNumber || ''}
                        onChange={e => setSettings(p => ({ ...p, whatsappNumber: e.target.value }))}
                        className="w-40 h-8 rounded-xl px-3 text-xs text-white outline-none text-right font-mono"
                        style={inputStyle}
                      />
                    </div>
                  </div>
                </SectionCard>

                {/* Universal Reward Reversal System */}
                <SectionCard accentColor="#EF444488">
                  <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                    <div className="flex items-center gap-2">
                      <span className="text-base">🔄</span>
                      <span className="text-sm font-black text-white">Universal Reward Reversal System</span>
                    </div>
                    <p className="text-[9px] text-slate-500 mt-0.5">Automated task audit, grace period, and point revocation engine</p>
                  </div>
                  <div className="p-4 flex flex-col divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                    <div className="flex items-center justify-between py-3">
                      <div>
                        <label className="text-xs text-slate-300 font-bold block">Enable Reward Reversal System</label>
                        <span className="text-[9px] text-slate-500 block">Periodically audit tasks and revoke points if action is removed</span>
                      </div>
                      <Toggle
                        on={settings.rewardReversalEnabled ?? true}
                        onToggle={() => setSettings(p => ({ ...p, rewardReversalEnabled: !(p.rewardReversalEnabled ?? true) }))}
                        accentColor="#EF4444"
                      />
                    </div>

                    <div className="flex items-center justify-between gap-4 py-3">
                      <label className="text-xs text-slate-400">Audit Verification Interval (Hours)</label>
                      <select
                        value={settings.reversalIntervalHours || 12}
                        onChange={e => setSettings(p => ({ ...p, reversalIntervalHours: Number(e.target.value) }))}
                        className="h-8 rounded-xl px-3 text-xs text-white bg-[#0A0E1A] border border-white/10 outline-none"
                      >
                        <option value={6}>Every 6 Hours</option>
                        <option value={12}>Every 12 Hours</option>
                        <option value={24}>Every 24 Hours</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between gap-4 py-3">
                      <label className="text-xs text-slate-400">Grace Period Before Deduction (Hours)</label>
                      <select
                        value={settings.gracePeriodHours ?? 24}
                        onChange={e => setSettings(p => ({ ...p, gracePeriodHours: Number(e.target.value) }))}
                        className="h-8 rounded-xl px-3 text-xs text-white bg-[#0A0E1A] border border-white/10 outline-none"
                      >
                        <option value={0}>0 Hours (Immediate)</option>
                        <option value={12}>12 Hours Grace</option>
                        <option value={24}>24 Hours Grace (Recommended)</option>
                        <option value={48}>48 Hours Grace</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between gap-4 py-3">
                      <label className="text-xs text-slate-400">Deduction Type</label>
                      <select
                        value={settings.reversalDeductionType || 'full'}
                        onChange={e => setSettings(p => ({ ...p, reversalDeductionType: e.target.value as any }))}
                        className="h-8 rounded-xl px-3 text-xs text-white bg-[#0A0E1A] border border-white/10 outline-none"
                      >
                        <option value="full">Full Task Reward Revocation</option>
                        <option value="partial">Partial Deductions</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between py-3">
                      <div>
                        <label className="text-xs text-slate-300 font-bold block">Allow Task Re-Verification & Restoration</label>
                        <span className="text-[9px] text-slate-500 block">Allow users to re-complete the task to earn back their reward</span>
                      </div>
                      <Toggle
                        on={settings.autoReVerificationEnabled ?? true}
                        onToggle={() => setSettings(p => ({ ...p, autoReVerificationEnabled: !(p.autoReVerificationEnabled ?? true) }))}
                        accentColor="#4ADE80"
                      />
                    </div>
                  </div>
                </SectionCard>

                {/* Admin Profile */}
                <SectionCard accentColor="#ffffff22">
                  <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                    <div className="flex items-center gap-2"><span className="text-base">👤</span><span className="text-sm font-black text-white">Admin Profile</span></div>
                    <p className="text-[9px] text-slate-500 mt-0.5">Contact identity displayed in console</p>
                  </div>
                  <div className="p-4">
                    <div className="flex items-center justify-between gap-4 py-3">
                      <label className="text-xs text-slate-400">Admin Username (@)</label>
                      <input type="text" value={settings.adminUsername || ''} onChange={e => setSettings(prev => ({ ...prev, adminUsername: e.target.value }))} placeholder="username" className="w-40 h-8 rounded-xl px-3 text-xs text-white outline-none text-right" style={inputStyle} />
                    </div>
                    <div className="flex items-center justify-between gap-4 py-3 border-t border-white/5">
                      <div className="flex flex-col">
                        <label className="text-xs text-slate-400">Private Admin Telegram ID (Chat ID)</label>
                        <span className="text-[9px] text-slate-500">Bot sends instant Deposit, Withdraw & Task request alerts to this ID (Hidden from users)</span>
                      </div>
                      <input type="text" value={settings.adminTelegramId || ''} onChange={e => setSettings(prev => ({ ...prev, adminTelegramId: e.target.value }))} placeholder="e.g. 123456789" className="w-44 h-8 rounded-xl px-3 text-xs text-white outline-none text-right font-mono" style={inputStyle} />
                    </div>
                    <div className="flex items-center justify-between py-3 border-t border-white/5">
                      <label className="text-xs text-slate-400">CAPTCHA Verification</label>
                      <Toggle on={settings.humanVerificationOpen} onToggle={() => setSettings(p => ({ ...p, humanVerificationOpen: !p.humanVerificationOpen }))} accentColor="#4ADE80" />
                    </div>
                  </div>
                </SectionCard>

                {/* Daily Check-in Rewards */}
                <SectionCard accentColor="#FBBF2444">
                  <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                    <div className="flex items-center gap-2"><span className="text-base">📅</span><span className="text-sm font-black text-white">Daily Check-in Rewards</span></div>
                    <p className="text-[9px] text-slate-500 mt-0.5">EForce points awarded for each consecutive day (Standard vs Telegram Premium)</p>
                  </div>
                  <div className="p-4 flex flex-col gap-4">
                    {/* Standard Daily Rewards */}
                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-bold text-slate-300">Standard User Daily Rewards (Day 1–7)</span>
                      <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
                        {settings.dailyClaimRewards.map((reward, i) => (
                          <div key={i} className="flex flex-col items-center gap-1">
                            <div className="text-[8px] font-black text-slate-500 uppercase tracking-wider">Day {i + 1}</div>
                            <input
                              type="number"
                              value={reward}
                              onChange={e => {
                                const nr = [...settings.dailyClaimRewards];
                                nr[i] = Number(e.target.value);
                                setSettings(prev => ({ ...prev, dailyClaimRewards: nr }));
                              }}
                              className="w-full h-9 rounded-xl px-1 text-[10px] text-white outline-none text-center font-bold"
                              style={inputStyle}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Telegram Premium Daily Rewards */}
                    <div className="flex flex-col gap-2 p-3 rounded-2xl bg-amber-400/[0.03] border border-amber-400/20">
                      <span className="text-xs font-black text-amber-300 flex items-center gap-1">
                        <span>⭐ Telegram Premium User Daily Rewards (Day 1–7)</span>
                      </span>
                      <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
                        {(settings.premiumDailyClaimRewards || [200, 300, 400, 600, 1000, 1500, 2000]).map((reward, i) => (
                          <div key={i} className="flex flex-col items-center gap-1">
                            <div className="text-[8px] font-black text-amber-400 uppercase tracking-wider">Day {i + 1}</div>
                            <input
                              type="number"
                              value={reward}
                              onChange={e => {
                                const nr = [...(settings.premiumDailyClaimRewards || [200, 300, 400, 600, 1000, 1500, 2000])];
                                nr[i] = Number(e.target.value);
                                setSettings(prev => ({ ...prev, premiumDailyClaimRewards: nr }));
                              }}
                              className="w-full h-9 rounded-xl px-1 text-[10px] text-amber-300 outline-none text-center font-bold border border-amber-400/30"
                              style={inputStyle}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </SectionCard>

              </div>

              {/* ── Save All Settings CTA ── */}
              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className={`${Btn.primary} w-full h-14 rounded-2xl text-sm font-black`}
                style={{ ...btnStyle.primary, boxShadow: '0 0 40px rgba(255,138,0,0.45), 0 8px 24px rgba(255,138,0,0.25)' }}
              >
                {savingSettings ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
                {savingSettings ? 'Saving to Firestore…' : 'Save All Settings'}
              </button>
            </div>
          )}

          {/* ════════════════════ TOP MINERS (LEADERBOARD) ════════════════════ */}
          {activeTab === 'topminers' && (
            <div className="flex flex-col gap-5">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Custom Top Miners config */}
                <SectionCard accentColor="#FFD70088">
                  <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                    <div className="flex items-center gap-2">
                      <Trophy size={16} className="text-[#FFD700]" />
                      <span className="text-sm font-black text-white">Custom Top Pinned Miners</span>
                    </div>
                    <p className="text-[9px] text-slate-500 mt-0.5">Add featured miners shown pinned at the top of the leaderboard</p>
                  </div>
                  <div className="p-4 flex flex-col gap-3">
                    <div className="grid grid-cols-[1fr_5rem_3rem_2.5rem] gap-2 items-end">
                      <div><label className="text-[8px] text-slate-500 uppercase tracking-wider font-bold block mb-1">Name</label><input type="text" placeholder="Miner name" value={newMinerName} onChange={e => setNewMinerName(e.target.value)} className={inputCls} style={inputStyle} /></div>
                      <div><label className="text-[8px] text-slate-500 uppercase tracking-wider font-bold block mb-1">Score</label><input type="number" value={newMinerScore} onChange={e => setNewMinerScore(e.target.value)} className={inputCls + ' text-right'} style={inputStyle} /></div>
                      <div><label className="text-[8px] text-slate-500 uppercase tracking-wider font-bold block mb-1">Badge</label><input type="text" value={newMinerBadge} onChange={e => setNewMinerBadge(e.target.value)} maxLength={2} className={inputCls + ' text-center'} style={inputStyle} /></div>
                      <button onClick={handleAddCustomMiner} className="h-9 w-10 flex items-center justify-center rounded-xl cursor-pointer transition-all" style={btnStyle.primary} title="Add Miner"><Plus size={14} /></button>
                    </div>
                    {(settings.customTopMiners || []).length === 0 ? (
                      <p className="text-[10px] text-slate-600 text-center py-3">No custom miners added yet.</p>
                    ) : (
                      <div className="flex flex-col gap-1.5 mt-1">
                        {(settings.customTopMiners || []).map((m, idx) => (
                          <div key={idx} className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(255,138,0,0.05)', border: '1px solid rgba(255,138,0,0.12)' }}>
                            <span className="text-lg w-8 text-center shrink-0">{m.badge || '⛏️'}</span>
                            <span className="flex-1 text-xs font-bold text-white truncate">{m.name}</span>
                            <span className="text-xs font-black" style={{ color: '#FF8A00' }}>{m.score.toLocaleString()} EFC</span>
                            <button onClick={() => handleRemoveCustomMiner(idx)} className="w-7 h-7 flex items-center justify-center rounded-lg transition-all cursor-pointer" style={btnStyle.danger} title="Remove"><Trash2 size={12} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </SectionCard>

                {/* Reset Leaderboard and stats */}
                <SectionCard accentColor="#EF444488">
                  <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                    <div className="flex items-center gap-2">
                      <span className="text-base">⚠️</span>
                      <span className="text-sm font-black text-white">Leaderboard Maintenance</span>
                    </div>
                    <p className="text-[9px] text-slate-500 mt-0.5">Critical operations for ranking database</p>
                  </div>
                  <div className="p-5 flex flex-col gap-4">
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Resetting the leaderboard will set all users' EFC points balance to 0. Custom pinned miners will NOT be affected.
                    </p>
                    <button
                      onClick={handleResetLeaderboard}
                      className={`${Btn.danger} w-full h-12 rounded-xl text-xs font-black flex items-center justify-center gap-2`}
                      style={{ ...btnStyle.danger, boxShadow: '0 0 20px rgba(239,68,68,0.3)' }}
                    >
                      <RefreshCw size={14} /> Reset Leaderboard Points to 0
                    </button>
                  </div>
                </SectionCard>
              </div>

              {/* Leaderboard Members (Real-time) */}
              <SectionCard accentColor="#FFD70066">
                <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  <div>
                    <div className="flex items-center gap-2">
                      <Trophy size={16} className="text-[#FFD700]" />
                      <span className="text-sm font-black text-white">Real-Time Leaderboard Members</span>
                    </div>
                    <p className="text-[9px] text-slate-500 mt-0.5">Manage live miners, points, pin/unpin status, and accounts</p>
                  </div>
                  {/* Quick Add User button */}
                  <button
                    onClick={() => { setActiveTab('users'); setShowAddUserForm(true); }}
                    className={`${Btn.primary} h-9 px-4 rounded-xl text-[10px] font-black flex items-center gap-1.5`}
                    style={btnStyle.primary}
                  >
                    <Plus size={12} /> Add Miner
                  </button>
                </div>

                <div className="p-0">
                  {/* Table headers */}
                  <div className="grid items-center gap-2 px-5 py-3 border-b text-[9px] font-black uppercase tracking-widest text-slate-600"
                    style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(4,8,16,0.3)', gridTemplateColumns: '3.5rem 2.5rem 1fr 8rem 8rem 10rem' }}>
                    <span>Rank</span>
                    <div />
                    <span>User</span>
                    <span>Points</span>
                    <span>Tokens</span>
                    <span className="text-right">Actions</span>
                  </div>

                  {/* Table rows */}
                  {usersList.filter(u => !u.leaderboardHidden).length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-8">No miners found in database.</p>
                  ) : (
                    <div className="divide-y divide-white/[0.03]">
                      {usersList.filter(u => !u.leaderboardHidden).map((u, idx) => (
                        <div key={u.telegramId} className="flex flex-col">
                          <div className="grid items-center gap-2 px-5 py-3.5 hover:bg-white/[0.015] transition-all"
                            style={{ gridTemplateColumns: '3.5rem 2.5rem 1fr 8rem 8rem 10rem' }}>
                            {/* Rank */}
                            <span className="text-xs font-black text-slate-400">
                              {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                            </span>

                            {/* Avatar */}
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 relative"
                              style={{ background: 'rgba(255,138,0,0.1)', border: '1px solid rgba(255,138,0,0.2)', color: '#FF8A00' }}>
                              <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center">
                                <ImageWithFallback src={u.photoUrl ?? ''} fallbackLetter={(u.firstName?.[0] ?? 'U')} className="w-full h-full object-cover" />
                              </div>
                              {u.isOnline && <div className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-green-400 border border-slate-900" />}
                            </div>

                            {/* Name / User */}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1 flex-wrap">
                                <span className="text-xs font-bold text-white truncate max-w-[120px]">{u.firstName} {u.lastName}</span>
                                {u.leaderboardPinned && <span className="text-[8px] font-black text-[#FF8A00]">📌 Pinned</span>}
                                {u.isVerified && <VerifiedBadge size={9} />}
                              </div>
                              <span className="text-[8px] text-slate-600 block">@{u.username || 'no_username'} · ID {u.telegramId}</span>
                            </div>

                            {/* Points */}
                            <span className="text-xs font-black" style={{ color: '#FF8A00' }}>{(u.points || 0).toLocaleString()} EFC</span>

                            {/* Tokens */}
                            <span className="text-xs font-bold text-slate-400">{(u.tokens || 0).toLocaleString()} EForce</span>

                            {/* Actions */}
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Edit */}
                              <button onClick={() => startEditUser(u)} title="Edit points/balance" className="w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer" style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)', color: '#A78BFA' }}>
                                <Edit3 size={11} />
                              </button>
                              {/* Pin */}
                              <button onClick={() => handlePinUser(u)} title="Pin/Unpin" className="w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer"
                                style={{ background: u.leaderboardPinned ? 'rgba(255,138,0,0.15)' : 'rgba(255,255,255,0.04)', border: u.leaderboardPinned ? '1px solid rgba(255,138,0,0.3)' : '1px solid rgba(255,255,255,0.08)' }}>
                                📌
                              </button>
                              {/* Hide / Show from Leaderboard */}
                              <button onClick={() => handleHideUser(u)} title={u.leaderboardHidden ? "Show on leaderboard" : "Hide from leaderboard"} className="w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer"
                                style={{ background: u.leaderboardHidden ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.04)', border: u.leaderboardHidden ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(255,255,255,0.08)', color: u.leaderboardHidden ? '#EF4444' : '#64748b' }}>
                                {u.leaderboardHidden ? <EyeOff size={11} /> : <Eye size={11} />}
                              </button>
                              {/* Remove */}
                              <button onClick={() => handleRemoveFromLeaderboard(u)} title="Remove Miner" className="w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer" style={{ background: 'rgba(248,82,82,0.1)', border: '1px solid rgba(248,82,82,0.25)', color: '#FF5252' }}>
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>

                          {/* Inline Edit Drawer for Leaderboard Tab */}
                          <AnimatePresence>
                            {editingUser?.telegramId === u.telegramId && (
                              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
                                <div className="px-5 py-4 border-b flex flex-col gap-3" style={{ borderColor: 'rgba(255,138,0,0.15)', background: 'rgba(255,138,0,0.02)' }}>
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black text-white">Adjust Balances for {u.firstName}</span>
                                    <span className="text-[9px] text-slate-500">ID: {u.telegramId}</span>
                                  </div>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                    {[{ label: 'Points', val: editPoints, set: setEditPoints }, { label: 'Tokens', val: editTokens, set: setEditTokens }, { label: 'Wallet', val: editWallet, set: setEditWallet }, { label: 'Referrals', val: editReferrals, set: setEditReferrals }].map(f => (
                                      <div key={f.label}>
                                        <label className="text-[8px] text-slate-500 font-bold uppercase tracking-wider block mb-1">{f.label}</label>
                                        <input type="number" value={f.val} onChange={e => f.set(Number(e.target.value))} className={inputCls} style={inputStyle} />
                                      </div>
                                    ))}
                                  </div>
                                  <div className="flex gap-2 justify-end">
                                    <button onClick={handleSaveUser} disabled={savingUser} className={`${Btn.primary} h-8 px-4 rounded-lg text-[10px] font-bold`} style={btnStyle.primary}>
                                      {savingUser ? '...' : 'Save Changes'}
                                    </button>
                                    <button onClick={() => setEditingUser(null)} className={`${Btn.ghost} h-8 px-3 rounded-lg text-[10px] font-bold`} style={btnStyle.ghost}>
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </SectionCard>

              {/* Hidden / Excluded Miners */}
              <SectionCard accentColor="#EF444466">
                <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  <div>
                    <div className="flex items-center gap-2">
                      <EyeOff size={16} className="text-[#EF4444]" />
                      <span className="text-sm font-black text-white">Hidden / Excluded Miners</span>
                    </div>
                    <p className="text-[9px] text-slate-500 mt-0.5">Miners hidden from the leaderboard. You can add them back at any time.</p>
                  </div>
                </div>

                <div className="p-0">
                  {/* Table headers */}
                  <div className="grid items-center gap-2 px-5 py-3 border-b text-[9px] font-black uppercase tracking-widest text-slate-600"
                    style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(4,8,16,0.3)', gridTemplateColumns: '3.5rem 2.5rem 1fr 8rem 8rem 10rem' }}>
                    <span>Status</span>
                    <div />
                    <span>User</span>
                    <span>Points</span>
                    <span>Tokens</span>
                    <span className="text-right">Actions</span>
                  </div>

                  {/* Table rows */}
                  {usersList.filter(u => u.leaderboardHidden).length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-8">No hidden miners found.</p>
                  ) : (
                    <div className="divide-y divide-white/[0.03]">
                      {usersList.filter(u => u.leaderboardHidden).map((u) => (
                        <div key={u.telegramId} className="flex flex-col">
                          <div className="grid items-center gap-2 px-5 py-3.5 hover:bg-white/[0.015] transition-all"
                            style={{ gridTemplateColumns: '3.5rem 2.5rem 1fr 8rem 8rem 10rem' }}>
                            {/* Status */}
                            <span className="text-[8px] font-black text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded border border-red-400/20 text-center uppercase">
                              Hidden
                            </span>

                            {/* Avatar */}
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 relative"
                              style={{ background: 'rgba(255,138,0,0.1)', border: '1px solid rgba(255,138,0,0.2)', color: '#FF8A00' }}>
                              <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center">
                                <ImageWithFallback src={u.photoUrl ?? ''} fallbackLetter={(u.firstName?.[0] ?? 'U')} className="w-full h-full object-cover" />
                              </div>
                              {u.isOnline && <div className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-green-400 border border-slate-900" />}
                            </div>

                            {/* Name / User */}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1 flex-wrap">
                                <span className="text-xs font-bold text-white truncate max-w-[120px]">{u.firstName} {u.lastName}</span>
                                {u.isVerified && <VerifiedBadge size={9} />}
                              </div>
                              <span className="text-[8px] text-slate-600 block">@{u.username || 'no_username'} · ID {u.telegramId}</span>
                            </div>

                            {/* Points */}
                            <span className="text-xs font-black" style={{ color: '#FF8A00' }}>{(u.points || 0).toLocaleString()} EFC</span>

                            {/* Tokens */}
                            <span className="text-xs font-bold text-slate-400">{(u.tokens || 0).toLocaleString()} EForce</span>

                            {/* Actions */}
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Add Back Button */}
                              <button onClick={() => handleHideUser(u)} title="Add back to leaderboard" className="h-7 px-3 rounded-lg flex items-center justify-center gap-1 text-[10px] font-bold transition-all cursor-pointer"
                                style={{ background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ADE80' }}>
                                <Plus size={11} /> Add to Leaderboard
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </SectionCard>

              {/* Save Settings button */}
              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className={`${Btn.primary} w-full h-14 rounded-2xl text-sm font-black`}
                style={{ ...btnStyle.primary, boxShadow: '0 0 40px rgba(255,138,0,0.45), 0 8px 24px rgba(255,138,0,0.25)' }}
              >
                {savingSettings ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
                {savingSettings ? 'Saving to Firestore…' : 'Save Leaderboard Settings'}
              </button>
            </div>
          )}

        </main>
      </div>

      {/* ── Withdrawal Processing Modal ── */}
      <AnimatePresence>
        {withdrawModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="w-full max-w-md rounded-[28px] p-6 border border-white/10 shadow-[0_25px_50px_rgba(0,0,0,0.6)]"
              style={{ background: '#090D1A' }}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-black text-white uppercase tracking-wider">
                  {withdrawModal.status === 'Approved' ? '✅ Approve Withdrawal' : withdrawModal.status === 'Rejected' ? '❌ Reject Withdrawal' : '🚫 Ban & Cancel Request'}
                </span>
                <button
                  onClick={() => setWithdrawModal(null)}
                  className="text-slate-400 hover:text-white transition-all cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Request Info */}
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-3.5 mb-4 text-xs space-y-1.5 font-sans">
                <div className="flex justify-between"><span className="text-slate-500">User:</span><span className="font-bold text-white">@{withdrawModal.req.username || withdrawModal.req.telegramId}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Amount:</span><span className="font-black text-[#FF8A00]">{withdrawModal.req.amount} {withdrawModal.req.type === 'token' ? 'EForce' : 'USDT'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">BEP-20 Wallet:</span><span className="font-mono text-slate-300 select-all">{withdrawModal.req.walletAddress || 'None'}</span></div>
              </div>

              {/* Textarea for note */}
              <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block mb-1.5">
                {withdrawModal.status === 'Approved' ? 'Approval Message / Transaction TXID' : withdrawModal.status === 'Rejected' ? 'Rejection Reason' : 'Suspension Reason'}
              </label>
              <textarea
                value={withdrawNote}
                onChange={e => setWithdrawNote(e.target.value)}
                placeholder="Enter a message to be sent to the user..."
                className="w-full h-24 bg-white/[0.04] border border-white/10 rounded-xl p-3 text-xs text-white outline-none focus:ring-1 focus:ring-[#FF8A00]/50 resize-none mb-4"
              />

              {/* Quick templates */}
              <div className="mb-5">
                <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider block mb-1.5">Quick Templates</span>
                <div className="flex flex-wrap gap-1.5">
                  {withdrawModal.status === 'Approved' ? (
                    <>
                      <button onClick={() => setWithdrawNote('Processed successfully. Funds sent to your BEP-20 wallet.')} className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-[9px] font-bold text-slate-300 rounded-lg transition-all cursor-pointer border border-white/5">Processed Successfully</button>
                      <button onClick={() => setWithdrawNote('Approved. TXID: ')} className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-[9px] font-bold text-slate-300 rounded-lg transition-all cursor-pointer border border-white/5">TxID Prefix</button>
                    </>
                  ) : withdrawModal.status === 'Rejected' ? (
                    <>
                      <button onClick={() => setWithdrawNote('Wrong or invalid BEP-20 wallet address.')} className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-[9px] font-bold text-slate-300 rounded-lg transition-all cursor-pointer border border-white/5">Wrong Wallet</button>
                      <button onClick={() => setWithdrawNote('Suspicious referral activity detected.')} className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-[9px] font-bold text-slate-300 rounded-lg transition-all cursor-pointer border border-white/5">Suspicious Refs</button>
                      <button onClick={() => setWithdrawNote('Daily withdrawal limit exceeded. Please request a smaller amount.')} className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-[9px] font-bold text-slate-300 rounded-lg transition-all cursor-pointer border border-white/5">Exceeds Limit</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => setWithdrawNote('Account suspended due to policy violation (anti-cheat system flag).')} className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-[9px] font-bold text-slate-300 rounded-lg transition-all cursor-pointer border border-white/5">Policy Violation</button>
                      <button onClick={() => setWithdrawNote('Bot usage or automated scripting detected.')} className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-[9px] font-bold text-slate-300 rounded-lg transition-all cursor-pointer border border-white/5">Bot Detected</button>
                    </>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setWithdrawModal(null)}
                  className="px-4 h-10 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    const { id, status, req } = withdrawModal;
                    const ok = await updateWithdrawRequest(id, status, withdrawNote);
                    if (ok) {
                      showToast(`Request ${status}.`, status === 'Approved' ? 'success' : 'warning');
                      if (req?.telegramId && settings.botApiUrl) {
                        sendWithdrawNotification(
                          settings.botApiUrl,
                          req.telegramId,
                          status,
                          req.amount ?? 0,
                          req.type ?? 'usdt',
                          withdrawNote
                        ).catch(() => { });
                      }
                      setWithdrawModal(null);
                      setWithdrawNote('');
                    } else {
                      showToast('Update failed.', 'error');
                    }
                  }}
                  className="px-4 h-10 rounded-xl text-xs font-bold text-white transition-all cursor-pointer"
                  style={{
                    background: withdrawModal.status === 'Approved' ? 'linear-gradient(135deg, #10B981, #059669)' : withdrawModal.status === 'Rejected' ? 'linear-gradient(135deg, #FBBF24, #D97706)' : 'linear-gradient(135deg, #EF4444, #DC2626)',
                    boxShadow: withdrawModal.status === 'Approved' ? '0 0 15px rgba(16,185,129,0.3)' : withdrawModal.status === 'Rejected' ? '0 0 15px rgba(251,191,36,0.3)' : '0 0 15px rgba(239,68,68,0.3)'
                  }}
                >
                  {withdrawModal.status === 'Approved' ? 'Approve' : withdrawModal.status === 'Rejected' ? 'Reject' : 'Suspend & Ban'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Payout Security Audit Detail Modal ── */}
      <AnimatePresence>
        {selectedWithdrawDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="w-full max-w-lg rounded-[28px] p-6 border border-white/10 shadow-[0_25px_60px_rgba(0,0,0,0.8)] overflow-hidden"
              style={{ background: '#090D1A' }}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-lg">
                    🛡️
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">Payout Security Audit</h3>
                    <p className="text-[10px] text-slate-400">Detailed verification report for payout #{selectedWithdrawDetail.req.id.substring(0, 8)}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedWithdrawDetail(null)}
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Body */}
              <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                {/* User Identity Card */}
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center text-base font-bold">
                      {selectedWithdrawDetail.user?.photoUrl ? (
                        <img src={selectedWithdrawDetail.user.photoUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span>{(selectedWithdrawDetail.req.username?.[0] || 'U').toUpperCase()}</span>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-black text-white">{selectedWithdrawDetail.user?.firstName || 'User'}</span>
                        {selectedWithdrawDetail.user?.isVerified && <VerifiedBadge size={12} />}
                      </div>
                      <div className="text-[10px] text-slate-400">@{selectedWithdrawDetail.req.username || 'no_username'} · ID: <span className="font-mono text-slate-300">{selectedWithdrawDetail.req.telegramId}</span></div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${selectedWithdrawDetail.user?.riskLevel === 'high' ? 'bg-red-500/15 text-red-400 border-red-500/30' : selectedWithdrawDetail.user?.riskLevel === 'medium' ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' : 'bg-green-500/10 text-green-400 border-green-500/20'}`}>
                      {(selectedWithdrawDetail.user?.riskLevel || 'safe').toUpperCase()} RISK
                    </span>
                  </div>
                </div>

                {/* Payout Details */}
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2.5 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-white/5">
                    <span className="text-slate-400">Requested Amount:</span>
                    <span className="text-base font-black text-[#FF8A00]">{selectedWithdrawDetail.req.amount} {selectedWithdrawDetail.req.type === 'token' ? 'EForce Token' : 'USDT'}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-white/5">
                    <span className="text-slate-400">Target Protocol / Network:</span>
                    <span className="font-bold text-white bg-blue-500/10 px-2 py-0.5 rounded text-[10px] text-blue-400 border border-blue-500/20">BEP-20 (BNB Smart Chain)</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-white/5">
                    <span className="text-slate-400">BEP-20 Wallet Address:</span>
                    <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate-200 bg-white/5 px-2 py-1 rounded border border-white/10 select-all">
                      <span>{selectedWithdrawDetail.req.walletAddress || 'Not set'}</span>
                      {selectedWithdrawDetail.req.walletAddress && (
                        <button
                          onClick={() => handleCopyWallet(selectedWithdrawDetail.req.walletAddress)}
                          title="Copy Wallet"
                          className="text-slate-400 hover:text-white transition-all cursor-pointer"
                        >
                          <Copy size={11} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-400">Request Status:</span>
                    <span className={`font-black text-[10px] px-2 py-0.5 rounded-full ${selectedWithdrawDetail.req.status === 'Pending' ? 'text-yellow-400 bg-yellow-400/10' : selectedWithdrawDetail.req.status === 'Approved' ? 'text-green-400 bg-green-400/10' : 'text-red-400 bg-red-400/10'}`}>
                      {selectedWithdrawDetail.req.status}
                    </span>
                  </div>
                </div>

                {/* Automated Security Checks */}
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">Automated Security Checks</span>
                  <div className="flex items-center justify-between text-xs py-1 border-b border-white/5">
                    <span className="text-slate-300 flex items-center gap-1.5"><ShieldCheck size={14} className="text-green-400" /> BEP-20 Format Check</span>
                    <span className="text-green-400 font-bold text-[10px]">{selectedWithdrawDetail.req.walletAddress?.startsWith('0x') && selectedWithdrawDetail.req.walletAddress?.length === 42 ? '✓ Valid 42-char Hex' : '⚠️ Non-Standard Format'}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs py-1 border-b border-white/5">
                    <span className="text-slate-300 flex items-center gap-1.5"><ShieldAlert size={14} className={selectedWithdrawDetail.user?.flagCount > 0 ? 'text-red-400' : 'text-green-400'} /> Flag Count</span>
                    <span className={`font-bold text-[10px] ${selectedWithdrawDetail.user?.flagCount > 0 ? 'text-red-400' : 'text-green-400'}`}>{selectedWithdrawDetail.user?.flagCount || 0} Flags Logged</span>
                  </div>
                  <div className="flex items-center justify-between text-xs py-1">
                    <span className="text-slate-300 flex items-center gap-1.5"><Trophy size={14} className="text-amber-400" /> Total User Referrals</span>
                    <span className="text-white font-mono text-[10px]">{selectedWithdrawDetail.user?.referrals || 0} Referrals</span>
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between gap-2">
                <a
                  href={`https://bscscan.com/address/${selectedWithdrawDetail.req.walletAddress}`}
                  target="_blank"
                  rel="noreferrer"
                  className="h-10 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <ExternalLink size={13} /> View on BscScan
                </a>
                <div className="flex items-center gap-2">
                  {selectedWithdrawDetail.req.status === 'Pending' && (
                    <button
                      onClick={() => {
                        const req = selectedWithdrawDetail.req;
                        setSelectedWithdrawDetail(null);
                        setWithdrawModal({ id: req.id, status: 'Approved', req });
                        setWithdrawNote('Processed successfully. Funds sent to your BEP-20 wallet.');
                      }}
                      className="h-10 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white text-xs font-black transition-all cursor-pointer shadow-lg shadow-green-500/20"
                    >
                      Process Approval
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedWithdrawDetail(null)}
                    className="h-10 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-xs font-bold transition-all cursor-pointer"
                  >
                    Close Audit
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
