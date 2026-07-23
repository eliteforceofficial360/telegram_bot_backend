import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Timestamp } from 'firebase/firestore';
import {
  Check, X, Search, Ban, Edit3, Save,
  RefreshCw, Plus, Trash2, ToggleLeft, ToggleRight,
  Star, ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  ArrowUpDown, ShieldAlert, Trophy, Eye, EyeOff, Upload,
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
  flagUser, adminSetBan, logAdminAction,
  adminPinUser, adminRemoveUser, adminAddUser, adminResetLeaderboard,
  type FirestoreUser, subscribeToAllUsers, adminHideUser,
} from '../lib/userService';
import {
  subscribeToTasks, createTask, updateTask, deleteTask, type EForceTask, type TaskType,
} from '../lib/taskService';
import {
  subscribeToAdminSettings, saveAdminSettings, DEFAULT_ADMIN_SETTINGS, type AdminSettings,
} from '../lib/adminSettingsService';
import {
  sendMessageToUser, sendAnnouncement, sendWithdrawNotification,
} from '../lib/notificationService';

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

  // --- Country Analytics ---
  const [countrySearch, setCountrySearch] = useState('');

  const countryAnalytics = useMemo(() => {
    const map: Record<string, { name: string; count: number; online: number; premium: number; points: number }> = {};

    (usersList || []).forEach((u: any) => {
      const c = u.country && u.country !== 'Unknown' ? u.country : 'Other / Unknown';
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

  const uploadImageToBot = async (base64Image: string, filename: string): Promise<string> => {
    // 1. Try Bot API server (Cloudinary endpoint)
    if (settings.botApiUrl) {
      const url = `${settings.botApiUrl.replace(/\/$/, '')}/upload-branding`;
      const secrets = [
        notifApiSecret,
        'https://elite-force-telegram-app.onrender.com',
        'elite_force_secret_2024'
      ];

      for (const secret of secrets) {
        if (!secret) continue;
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${secret}`
            },
            body: JSON.stringify({ image: base64Image, filename })
          });

          if (res.status === 401) continue;

          if (res.ok) {
            const data = await res.json();
            if (data.secureUrl) return data.secureUrl;
          }
        } catch (err) {
          console.warn('Bot API upload attempt failed, falling back to ImgBB:', err);
        }
      }
    }

    // 2. Automatic Fallback to ImgBB free image host if Cloudinary is unconfigured
    try {
      const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, '');
      const formData = new FormData();
      formData.append('image', cleanBase64);

      const imgbbRes = await fetch('https://api.imgbb.com/1/upload?key=6d70077319714757c9a96e622b78edc3', {
        method: 'POST',
        body: formData,
      });

      if (imgbbRes.ok) {
        const imgbbData = await imgbbRes.json();
        if (imgbbData.data?.url) {
          return imgbbData.data.url;
        }
      }
    } catch (fallbackErr) {
      console.warn('ImgBB fallback upload failed:', fallbackErr);
    }

    throw new Error('Cloudinary is unconfigured on your bot backend. Please paste a direct image URL (e.g. https://i.ibb.co/banner.jpg).');
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>, userId: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        try {
          const secureUrl = await uploadImageToBot(reader.result as string, `user_${userId}_${Date.now()}`);
          setEditPhotoUrl(secureUrl);
          showToast('✅ Avatar uploaded successfully!', 'success');
        } catch (err: any) {
          showToast(err.message || 'Upload failed.', 'error');
        } finally {
          setUploadingAvatar(false);
        }
      };
      reader.onerror = () => {
        showToast('Failed to read file.', 'error');
        setUploadingAvatar(false);
      };
    } catch (err) {
      showToast('File processing error.', 'error');
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
  const blankTask = { title: '', description: '', type: 'channel' as TaskType, reward: 500, tokenReward: 0, url: '', dailyLimit: 0, totalCompletionLimit: 0, expiryDate: '', isEnabled: true, isMandatory: false, autoApprove: true };
  const [taskForm, setTaskForm] = useState(blankTask);
  useEffect(() => { const unsub = subscribeToTasks(setTasks); return unsub; }, []);
  const handleSaveTask = async () => {
    const d = { ...taskForm, expiryDate: taskForm.expiryDate || null };
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
    setTaskForm({ title: t.title, description: t.description, type: t.type, reward: t.reward, tokenReward: t.tokenReward, url: t.url, dailyLimit: t.dailyLimit, totalCompletionLimit: t.totalCompletionLimit, expiryDate: t.expiryDate || '', isEnabled: t.isEnabled, isMandatory: t.isMandatory ?? false, autoApprove: t.autoApprove });
    setShowTaskForm(true);
  };

  // --- Withdrawals ---
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [withdrawFilter, setWithdrawFilter] = useState<'all' | 'Pending' | 'Approved' | 'Rejected' | 'Banned'>('Pending');
  const [withdrawModal, setWithdrawModal] = useState<{ id: string; status: 'Approved' | 'Rejected' | 'Banned'; req: any } | null>(null);
  const [withdrawNote, setWithdrawNote] = useState('');
  useEffect(() => { const unsub = subscribeToWithdrawRequests(setWithdrawals); return unsub; }, []);
  // --- Notifications tab ---
  const [notifMessage, setNotifMessage] = useState('');
  const [notifTarget, setNotifTarget] = useState<'all' | 'user'>('all');
  const [notifUserId, setNotifUserId] = useState('');
  const [notifUserSearch, setNotifUserSearch] = useState('');
  const [notifUserDropdown, setNotifUserDropdown] = useState(false);
  const [notifSending, setNotifSending] = useState(false);
  const [notifApiSecret, setNotifApiSecret] = useState(() => {
    const saved = localStorage.getItem('admin_api_secret');
    return (saved && saved.trim() !== '') ? saved : 'https://elite-force-telegram-app.onrender.com';
  });
  const [notifImageUrl, setNotifImageUrl] = useState('');
  const [notifBtnText, setNotifBtnText] = useState('');
  const [uploadingNotificationImage, setUploadingNotificationImage] = useState(false);
  const [notifBtnUrl, setNotifBtnUrl] = useState('');

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCoin, setUploadingCoin] = useState(false);

  useEffect(() => {
    localStorage.setItem('admin_api_secret', notifApiSecret);
  }, [notifApiSecret]);

  // Filtered user list for notification picker
  const notifUserOptions = useMemo(() => {
    if (!notifUserSearch.trim()) return usersList.slice(0, 50);
    const q = notifUserSearch.toLowerCase();
    return usersList.filter(u =>
      u.firstName?.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q) ||
      String(u.telegramId).includes(q)
    ).slice(0, 30);
  }, [usersList, notifUserSearch]);

  const handleSelectNotifUser = (u: FirestoreUser) => {
    setNotifUserId(String(u.telegramId));
    setNotifUserSearch(u.firstName + (u.username ? ` (@${u.username})` : ''));
    setNotifUserDropdown(false);
  };

  const handleSendNotification = async () => {
    if (!notifMessage.trim()) { showToast('Message cannot be empty.', 'warning'); return; }
    if (!settings.botApiUrl) { showToast('Bot API URL not set in Settings.', 'error'); return; }
    setNotifSending(true);
    if (notifTarget === 'all') {
      const ids = usersList.map(u => u.telegramId).filter(Boolean);
      if (ids.length === 0) { showToast('No users loaded.', 'error'); setNotifSending(false); return; }
      const res = await sendAnnouncement(settings.botApiUrl, notifMessage, ids, notifApiSecret, notifImageUrl, notifBtnText, notifBtnUrl);
      res.ok
        ? showToast(`📢 Announcement sent to ${res.sent ?? ids.length} users!`, 'success')
        : showToast(res.error || 'Send failed.', 'error');
    } else {
      const id = parseInt(notifUserId);
      if (!id) { showToast('Enter a valid Telegram ID.', 'error'); setNotifSending(false); return; }
      const res = await sendMessageToUser(settings.botApiUrl, id, notifMessage, notifApiSecret, notifImageUrl, notifBtnText, notifBtnUrl);
      res.ok
        ? showToast('✅ Message sent!', 'success')
        : showToast(res.error || 'Send failed.', 'error');
    }
    setNotifSending(false);
    setNotifMessage('');
    setNotifImageUrl('');
    setNotifBtnText('');
    setNotifBtnUrl('');
  };

  const handleNotificationImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingNotificationImage(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        try {
          const secureUrl = await uploadImageToBot(reader.result as string, `notif_${Date.now()}`);
          setNotifImageUrl(secureUrl);
          showToast('✅ Notification image uploaded successfully!', 'success');
        } catch (err: any) {
          showToast(err.message || 'Upload failed.', 'error');
        } finally {
          setUploadingNotificationImage(false);
        }
      };
      reader.onerror = () => {
        showToast('Failed to read file.', 'error');
        setUploadingNotificationImage(false);
      };
    } catch (err) {
      showToast('File processing error.', 'error');
      setUploadingNotificationImage(false);
    }
  };

  const [settings, setSettings] = useState<AdminSettings>(DEFAULT_ADMIN_SETTINGS);
  const [savingSettings, setSavingSettings] = useState(false);
  useEffect(() => { const unsub = subscribeToAdminSettings(setSettings); return unsub; }, []);
  const handleSaveSettings = async () => {
    setSavingSettings(true);
    const ok = await saveAdminSettings(settings);
    setSavingSettings(false);
    ok ? showToast('⚙️ Settings saved.', 'success') : showToast('Failed.', 'error');
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

  const handleBrandingUpload = async (e: React.ChangeEvent<HTMLInputElement>, targetField: 'loadingLogoUrl' | 'coinIconUrl') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const setUploading = targetField === 'loadingLogoUrl' ? setUploadingLogo : setUploadingCoin;
    setUploading(true);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        try {
          const secureUrl = await uploadImageToBot(reader.result as string, `${targetField}_${Date.now()}`);
          setSettings(prev => {
            const updated = { ...prev, [targetField]: secureUrl };
            saveAdminSettings(updated).catch(() => { });
            return updated;
          });
          showToast('✅ Branding image uploaded & saved successfully!', 'success');
        } catch (err: any) {
          showToast(err.message || 'Upload failed.', 'error');
        } finally {
          setUploading(false);
        }
      };
      reader.onerror = () => {
        showToast('Failed to read file.', 'error');
        setUploading(false);
      };
    } catch (err) {
      showToast('File processing error.', 'error');
      setUploading(false);
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
                                          {uploadingAvatar ? <RefreshCw size={10} className="animate-spin" /> : <Upload size={10} />} Upload Image
                                          <input
                                            type="file"
                                            accept="image/*"
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
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            <div><label className="text-[8px] text-slate-500 font-black uppercase tracking-wider block mb-1">Type</label>
                              <select value={taskForm.type} onChange={e => setTaskForm(p => ({ ...p, type: e.target.value as TaskType }))} className={inputCls + ' cursor-pointer'} style={{ ...inputStyle, background: '#0A0D1A' }}>
                                <option value="channel">Telegram Channel</option><option value="group">Telegram Group</option><option value="x">Follow on X</option><option value="website">Visit Website</option><option value="video">Watch Video</option><option value="daily">Daily Mission</option><option value="ad">Reward Ad</option>
                              </select>
                            </div>
                            <div><label className="text-[8px] text-slate-500 font-black uppercase tracking-wider block mb-1">Expiry Date</label><input type="date" value={taskForm.expiryDate} onChange={e => setTaskForm(p => ({ ...p, expiryDate: e.target.value }))} className={inputCls} style={inputStyle} /></div>
                            <div className="flex gap-5 items-center pt-5">
                              <label className="flex items-center gap-2 text-[10px] text-slate-400 cursor-pointer"><input type="checkbox" checked={taskForm.isEnabled} onChange={e => setTaskForm(p => ({ ...p, isEnabled: e.target.checked }))} className="accent-[#FF8A00]" />Enabled</label>
                              <label className="flex items-center gap-2 text-[10px] text-slate-400 cursor-pointer"><input type="checkbox" checked={taskForm.autoApprove} onChange={e => setTaskForm(p => ({ ...p, autoApprove: e.target.checked }))} className="accent-[#FF8A00]" />Auto-approve</label>
                              <label className="flex items-center gap-2 text-[10px] cursor-pointer font-bold" style={{ color: taskForm.isMandatory ? '#FF8A00' : '#64748b' }}><input type="checkbox" checked={(taskForm as any).isMandatory ?? false} onChange={e => setTaskForm(p => ({ ...p, isMandatory: e.target.checked }))} className="accent-[#FF8A00]" />🔒 Mandatory</label>
                            </div>
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

          {/* ════════════════════ WITHDRAWALS ════════════════════ */}
          {activeTab === 'withdrawals' && (
            <div className="flex flex-col gap-5">
              <SectionCard accentColor="#4ADE8088">
                <div className="p-5 flex flex-col gap-4">
                  <div>
                    <h2 className="text-base font-black text-white">Withdrawal Requests</h2>
                    <p className="text-[10px] text-slate-500 mt-0.5">Review and process member payout requests</p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {(['all', 'Pending', 'Approved', 'Rejected', 'Banned'] as const).map(f => {
                      const cnt = f === 'all' ? withdrawals.length : withdrawals.filter(w => w.status === f).length;
                      const colors = { all: '#FF8A00', Pending: '#FBBF24', Approved: '#4ADE80', Rejected: '#F87171', Banned: '#FB923C' };
                      const isSelected = withdrawFilter === f;
                      return (
                        <button key={f} onClick={() => setWithdrawFilter(f)}
                          className="flex items-center gap-1.5 h-9 px-4 rounded-full text-[10px] font-bold transition-all cursor-pointer"
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
                </div>
              </SectionCard>

              <SectionCard accentColor="#4ADE8033">
                {/* Header row */}
                <div className="grid gap-3 px-5 py-3 border-b text-[9px] font-black uppercase tracking-widest text-slate-600"
                  style={{ borderColor: 'rgba(255,255,255,0.06)', gridTemplateColumns: '2.5rem 1fr 8rem 6rem 6rem 9rem' }}>
                  <div /><div>User</div><div>Amount</div><div>Network</div><div>Status</div><div className="text-right">Actions</div>
                </div>

                {withdrawals.filter(w => withdrawFilter === 'all' || w.status === withdrawFilter).length === 0 ? (
                  <div className="text-center py-16 text-slate-500 text-xs">No {withdrawFilter !== 'all' ? withdrawFilter.toLowerCase() : ''} requests.</div>
                ) : withdrawals.filter(w => withdrawFilter === 'all' || w.status === withdrawFilter).map((req, idx) => {
                  const userObj = usersList.find(u => u.telegramId === req.telegramId);
                  return (
                    <motion.div key={req.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}
                      className="grid gap-3 items-center px-5 py-4 border-b hover:bg-white/[0.015] transition-all"
                      style={{ borderColor: 'rgba(255,255,255,0.04)', gridTemplateColumns: '2.5rem 1fr 8rem 6rem 6rem 9rem' }}>
                      <div className="w-9 h-9 rounded-full flex items-center justify-center overflow-hidden shrink-0"
                        style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)' }}>
                        {userObj?.photoUrl ? (
                          <img src={userObj.photoUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-lg">💸</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-white block truncate">@{req.username || req.telegramId}</span>
                        <span className="text-[9px] text-slate-500 font-mono select-all block truncate mt-0.5" title={req.walletAddress}>{req.walletAddress || 'No Wallet'}</span>
                        <span className="text-[8px] text-slate-600 block">ID: {req.telegramId}</span>
                      </div>
                      <div>
                        <span className="text-sm font-black text-white">{req.amount || '?'}</span>
                        <span className="text-[9px] text-slate-500 ml-1">{req.type === 'token' ? 'EForce Token' : 'USDT'}</span>
                      </div>
                      <span className="text-[9px] font-bold text-slate-400">BEP-20</span>
                      <span className={`text-[9px] font-black px-2.5 py-1 rounded-full inline-block ${req.status === 'Pending' ? 'text-yellow-400 bg-yellow-400/10 border border-yellow-400/25' : req.status === 'Approved' ? 'text-green-400 bg-green-400/10 border border-green-400/25' : 'text-red-400 bg-red-400/10 border border-red-400/25'}`}>
                        {req.status}
                      </span>
                      {req.status === 'Pending' ? (
                        <div className="flex gap-1.5 justify-end">
                          <button onClick={() => { setWithdrawModal({ id: req.id, status: 'Approved', req }); setWithdrawNote('Processed successfully. Funds sent to your BEP-20 wallet.'); }} title="Approve" className="flex items-center gap-1 h-8 px-3 rounded-xl text-[10px] font-bold cursor-pointer transition-all" style={btnStyle.success}><Check size={11} /> OK</button>
                          <button onClick={() => { setWithdrawModal({ id: req.id, status: 'Rejected', req }); setWithdrawNote('Wrong or invalid BEP-20 wallet address.'); }} title="Reject" className="flex items-center gap-1 h-8 px-3 rounded-xl text-[10px] font-bold cursor-pointer transition-all" style={btnStyle.ghost}><X size={11} /></button>
                          <button onClick={() => { setWithdrawModal({ id: req.id, status: 'Banned', req }); setWithdrawNote('Account suspended due to policy violation (anti-cheat system flag).'); }} title="Ban user" className="flex items-center gap-1 h-8 px-3 rounded-xl text-[10px] font-bold cursor-pointer transition-all" style={btnStyle.danger}><Ban size={11} /></button>
                        </div>
                      ) : <div />}
                    </motion.div>
                  );
                })}
              </SectionCard>
            </div>
          )}

          {/* ════════════════════ NOTIFICATIONS ════════════════════ */}
          {activeTab === 'notifications' && (
            <div className="flex flex-col gap-5">

              {/* Stats strip */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Total Users', value: usersList.length, color: '#C084FC', bg: 'rgba(192,132,252,0.08)', border: 'rgba(192,132,252,0.22)' },
                  { label: 'Pending Alerts', value: withdrawals.filter(w => w.status === 'Pending').length, color: '#FBBF24', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.22)' },
                  { label: 'Bot Connected', value: settings.botApiUrl ? '✓' : '✗', color: settings.botApiUrl ? '#4ADE80' : '#F87171', bg: settings.botApiUrl ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)', border: settings.botApiUrl ? 'rgba(74,222,128,0.22)' : 'rgba(248,113,113,0.22)' },
                ].map(s => (
                  <div key={s.label} className="rounded-[22px] p-5" style={{ background: s.bg, border: `1px solid ${s.border}` }}>
                    <div className="text-2xl font-black leading-none" style={{ color: s.color }}>{s.value}</div>
                    <div className="text-[9px] uppercase tracking-[0.18em] text-slate-500 mt-1.5">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Message Composer */}
              <SectionCard accentColor="#C084FC88">
                <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-lg" style={{ background: 'rgba(192,132,252,0.12)', border: '1px solid rgba(192,132,252,0.25)' }}>📢</div>
                    <div>
                      <div className="text-sm font-black text-white">Send Notification</div>
                      <div className="text-[9px] text-slate-500 mt-0.5">Send Telegram bot messages directly to users</div>
                    </div>
                  </div>
                </div>
                <div className="p-5 flex flex-col gap-4">

                  {/* Target selector */}
                  <div className="flex gap-2">
                    {(['all', 'user'] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => setNotifTarget(t)}
                        className="flex-1 h-10 rounded-xl text-xs font-bold border transition-all cursor-pointer"
                        style={notifTarget === t
                          ? { background: 'rgba(192,132,252,0.15)', border: '1px solid rgba(192,132,252,0.5)', color: '#C084FC' }
                          : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', color: '#64748b' }
                        }
                      >
                        {t === 'all' ? '📢 All Users (Broadcast)' : '👤 Specific User'}
                      </button>
                    ))}
                  </div>

                  {/* User name picker (conditional) */}
                  {notifTarget === 'user' && (
                    <div className="flex flex-col gap-1 relative">
                      <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Search User by Name or Username</label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Type name or @username to search..."
                          value={notifUserSearch}
                          onChange={e => { setNotifUserSearch(e.target.value); setNotifUserDropdown(true); setNotifUserId(''); }}
                          onFocus={() => setNotifUserDropdown(true)}
                          className={inputCls}
                          style={inputStyle}
                        />
                        {notifUserSearch && notifUserId && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-accent-success">
                            ID: {notifUserId}
                          </div>
                        )}
                      </div>
                      {notifUserDropdown && notifUserOptions.length > 0 && (
                        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-xl overflow-hidden shadow-xl max-h-48 overflow-y-auto"
                          style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.1)' }}>
                          {notifUserOptions.map(u => (
                            <button key={u.telegramId} onClick={() => handleSelectNotifUser(u)}
                              className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/[0.06] transition-all cursor-pointer border-b last:border-0"
                              style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                                style={{ background: `hsl(${(u.telegramId % 360)}, 60%, 25%)`, border: '1px solid rgba(255,255,255,0.1)' }}>
                                {(u.firstName?.[0] || '?').toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold text-white truncate">{u.firstName} {u.username && <span className="text-slate-400 font-normal">@{u.username}</span>}</div>
                                <div className="text-[9px] text-slate-600">ID: {u.telegramId}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      <p className="text-[9px] text-slate-600">Select a user from the list — their Telegram ID will be used</p>
                    </div>
                  )}

                  {/* Message textarea */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                      Message {notifTarget === 'all' ? `(will reach ${usersList.length} users)` : ''}
                    </label>
                    <textarea
                      rows={5}
                      placeholder="Type your announcement or custom message here..."
                      value={notifMessage}
                      onChange={e => setNotifMessage(e.target.value)}
                      className="w-full rounded-xl px-3 py-2.5 text-xs text-white outline-none resize-none focus:ring-1 focus:ring-[#C084FC]/40"
                      style={{ ...inputStyle, minHeight: 110 }}
                    />
                    <div className="flex justify-between text-[9px] text-slate-600">
                      <span>{notifMessage.length} chars</span>
                      <span>Rendered as HTML in Telegram</span>
                    </div>
                  </div>

                  {/* Image URL (Optional) */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Image URL (Optional)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="e.g. https://example.com/banner.png"
                        value={notifImageUrl}
                        onChange={e => setNotifImageUrl(e.target.value)}
                        className={`${inputCls} flex-1`}
                        style={inputStyle}
                      />
                      <label className="h-9 px-4 rounded-xl bg-[#C084FC] hover:bg-[#818CF8] text-white text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-all shrink-0 select-none">
                        {uploadingNotificationImage ? <RefreshCw size={11} className="animate-spin" /> : <Upload size={11} />} Upload Image
                        <input type="file" accept="image/*" onChange={handleNotificationImageUpload} className="hidden" disabled={uploadingNotificationImage} />
                      </label>
                    </div>
                    <p className="text-[9px] text-slate-600">If set, Telegram will send this as a Photo with the message as caption</p>
                  </div>

                  {/* Inline Button (Optional) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Button Text (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. 🎁 Claim Now"
                        value={notifBtnText}
                        onChange={e => setNotifBtnText(e.target.value)}
                        className={inputCls}
                        style={inputStyle}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Button Link (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. https://t.me/EliteForceBot/app"
                        value={notifBtnUrl}
                        onChange={e => setNotifBtnUrl(e.target.value)}
                        className={inputCls}
                        style={inputStyle}
                      />
                    </div>
                  </div>

                  {/* API Secret (collapsible) */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">API Secret (from backend .env)</label>
                    <input
                      type="password"
                      value={notifApiSecret}
                      onChange={e => setNotifApiSecret(e.target.value)}
                      className={inputCls}
                      style={inputStyle}
                    />
                  </div>

                  {/* Send button */}
                  <button
                    onClick={handleSendNotification}
                    disabled={notifSending || !notifMessage.trim()}
                    className={`${Btn.primary} w-full h-12 rounded-2xl text-sm font-black`}
                    style={{ ...btnStyle.primary, background: 'linear-gradient(135deg, #C084FC, #818CF8)', boxShadow: '0 0 30px rgba(192,132,252,0.35)' }}
                  >
                    {notifSending ? <RefreshCw size={16} className="animate-spin" /> : '🚀'}
                    {notifSending
                      ? (notifTarget === 'all' ? `Sending to ${usersList.length} users...` : 'Sending...')
                      : (notifTarget === 'all' ? `Broadcast to All ${usersList.length} Users` : 'Send to User')}
                  </button>

                  {!settings.botApiUrl && (
                    <div className="rounded-xl px-4 py-3 text-xs text-yellow-400 font-semibold"
                      style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
                      ⚠️ Bot API URL not set. Go to <strong>Settings</strong> and add your bot server URL to enable notifications.
                    </div>
                  )}
                </div>
              </SectionCard>

              {/* Quick actions: per-user message from Users list */}
              <SectionCard accentColor="#C084FC44">
                <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  <div className="text-sm font-black text-white">📋 Notification Types Reference</div>
                  <div className="text-[9px] text-slate-500 mt-0.5">These are sent automatically by the system</div>
                </div>
                <div className="p-4 flex flex-col gap-3">
                  {[
                    { icon: '✅', label: 'Withdrawal Approved', desc: 'Auto-sent when you approve a withdrawal in the Withdrawals tab', color: '#4ADE80' },
                    { icon: '❌', label: 'Withdrawal Rejected', desc: 'Auto-sent when you reject a withdrawal request', color: '#F87171' },
                    { icon: '🚫', label: 'Account Banned', desc: 'Auto-sent when you ban a user from a withdrawal', color: '#FB923C' },
                    { icon: '🎉', label: 'Referral Notification', desc: 'Auto-sent by bot when a new user joins via referral link', color: '#C084FC' },
                    { icon: '📢', label: 'Custom Announcement', desc: 'Manual broadcast using the form above', color: '#60A5FA' },
                    { icon: '📩', label: 'Custom User Message', desc: 'Direct message to a specific user using the form above', color: '#34D399' },
                  ].map(n => (
                    <div key={n.label} className="flex items-start gap-3 py-2.5 border-b last:border-0" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                      <div className="text-lg w-7 shrink-0">{n.icon}</div>
                      <div className="flex-1">
                        <div className="text-xs font-bold" style={{ color: n.color }}>{n.label}</div>
                        <div className="text-[9px] text-slate-500 mt-0.5">{n.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>

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
                      <label className="text-xs text-slate-400">Bot Username (Ref Links)</label>
                      <input type="text" value={settings.botUsername} onChange={e => setSettings(prev => ({ ...prev, botUsername: e.target.value }))} className="w-36 h-8 rounded-xl px-3 text-xs text-white outline-none text-right" style={inputStyle} />
                    </div>
                    <div className="flex items-center justify-between py-3 gap-4">
                      <div>
                        <label className="text-xs text-slate-400 block">Bot API URL</label>
                        <span className="text-[9px] text-slate-600">Your running backend URL (for notifications)</span>
                      </div>
                      <input type="text" placeholder="http://your-server:4000" value={settings.botApiUrl || ''} onChange={e => setSettings(prev => ({ ...prev, botApiUrl: e.target.value }))} className="w-48 h-8 rounded-xl px-3 text-xs text-white outline-none text-right" style={inputStyle} />
                    </div>
                  </div>
                </SectionCard>

                {/* App Customization & Branding */}
                <SectionCard accentColor="#FF8A0055">
                  <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                    <div className="flex items-center gap-2">
                      <span className="text-base">🎨</span>
                      <span className="text-sm font-black text-white">App Branding</span>
                    </div>
                    <p className="text-[9px] text-slate-500 mt-0.5">Customize loading screen logo and central mining coin icon</p>
                  </div>
                  <div className="p-4 flex flex-col divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                    <div className="flex items-center justify-between gap-4 py-3">
                      <div>
                        <label className="text-xs text-slate-400 block font-semibold">Loading Screen Logo URL</label>
                        <span className="text-[9px] text-slate-600">Enter image URL or select local file</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {settings.loadingLogoUrl && (
                          <div className="w-9 h-9 rounded-xl border border-white/10 overflow-hidden bg-black/40 flex items-center justify-center shrink-0">
                            <img src={settings.loadingLogoUrl} alt="" className="w-full h-full object-contain" />
                          </div>
                        )}
                        <input type="text" value={settings.loadingLogoUrl || ''} onChange={e => setSettings(prev => ({ ...prev, loadingLogoUrl: e.target.value }))} className="w-40 h-8 rounded-xl px-3 text-xs text-white outline-none text-right" style={inputStyle} />
                        <label className="h-8 px-3 rounded-xl bg-[#FF8A00] hover:bg-[#FF8A00]/90 text-white text-[10px] font-bold flex items-center justify-center cursor-pointer transition-all shrink-0">
                          {uploadingLogo ? '...' : 'Upload'}
                          <input type="file" accept="image/*" onChange={e => handleBrandingUpload(e, 'loadingLogoUrl')} className="hidden" />
                        </label>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-4 py-3">
                      <div>
                        <label className="text-xs text-slate-400 block font-semibold">Mining Coin Icon URL</label>
                        <span className="text-[9px] text-slate-600">Enter image URL or select local file</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {settings.coinIconUrl && (
                          <div className="w-9 h-9 rounded-xl border border-white/10 overflow-hidden bg-black/40 flex items-center justify-center shrink-0">
                            <img src={settings.coinIconUrl} alt="" className="w-full h-full object-contain" />
                          </div>
                        )}
                        <input type="text" value={settings.coinIconUrl || ''} onChange={e => setSettings(prev => ({ ...prev, coinIconUrl: e.target.value }))} className="w-40 h-8 rounded-xl px-3 text-xs text-white outline-none text-right" style={inputStyle} />
                        <label className="h-8 px-3 rounded-xl bg-[#FF8A00] hover:bg-[#FF8A00]/90 text-white text-[10px] font-bold flex items-center justify-center cursor-pointer transition-all shrink-0">
                          {uploadingCoin ? '...' : 'Upload'}
                          <input type="file" accept="image/*" onChange={e => handleBrandingUpload(e, 'coinIconUrl')} className="hidden" />
                        </label>
                      </div>
                    </div>
                    <div className="p-4 pt-0 border-t border-white/[0.03]">
                      <p className="text-[9px] text-slate-500">
                        ℹ️ Image uploading uses the Bot API server. Make sure the <b>Bot API URL</b> (above) and <b>API Secret</b> (in Notifications tab) are configured correctly.
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
                    {[{ label: 'Ad EForce Reward', key: 'adRewardAmount' }, { label: 'Ad Token Reward', key: 'adTokenReward' }, { label: 'Daily Ads (Normal)', key: 'adDailyLimitNormal' }, { label: 'Daily Ads (Premium)', key: 'adDailyLimitPremium' }].map(f => (
                      <div key={f.key} className="flex items-center justify-between gap-4 py-3">
                        <label className="text-xs text-slate-400">{f.label}</label>
                        <input type="number" value={(settings as any)[f.key]} onChange={e => setSettings(prev => ({ ...prev, [f.key]: Number(e.target.value) }))} className="w-28 h-8 rounded-xl px-3 text-xs text-white outline-none text-right" style={inputStyle} />
                      </div>
                    ))}
                    <div className="flex items-center justify-between py-3"><label className="text-xs text-slate-400">Require Ad for Daily Check-in</label><Toggle on={settings.adRequireDailyClaim} onToggle={() => setSettings(p => ({ ...p, adRequireDailyClaim: !p.adRequireDailyClaim }))} accentColor="#FF8A00" /></div>
                    <div className="flex items-center justify-between py-3"><label className="text-xs text-slate-400">Require Ad to Complete Tasks</label><Toggle on={settings.adRequireTasks} onToggle={() => setSettings(p => ({ ...p, adRequireTasks: !p.adRequireTasks }))} accentColor="#FF8A00" /></div>
                    <div className="flex items-center justify-between py-3"><label className="text-xs text-slate-400">Require Ad to Start Mining</label><Toggle on={settings.adRequireAutoMiner} onToggle={() => setSettings(p => ({ ...p, adRequireAutoMiner: !p.adRequireAutoMiner }))} accentColor="#FF8A00" /></div>
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
                    <div className="flex items-center justify-between py-3">
                      <label className="text-xs text-slate-400">CAPTCHA Verification</label>
                      <Toggle on={settings.humanVerificationOpen} onToggle={() => setSettings(p => ({ ...p, humanVerificationOpen: !p.humanVerificationOpen }))} accentColor="#4ADE80" />
                    </div>
                  </div>
                </SectionCard>

                {/* Daily Check-in */}
                <SectionCard accentColor="#FBBF2444">
                  <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                    <div className="flex items-center gap-2"><span className="text-base">📅</span><span className="text-sm font-black text-white">Daily Check-in Rewards</span></div>
                    <p className="text-[9px] text-slate-500 mt-0.5">EForce points awarded for each consecutive day</p>
                  </div>
                  <div className="p-4">
                    <div className="grid grid-cols-4 gap-2">
                      {settings.dailyClaimRewards.map((reward, i) => (
                        <div key={i} className="flex flex-col items-center gap-1.5">
                          <div className="text-[8px] font-black text-slate-500 uppercase tracking-wider">Day {i + 1}</div>
                          <input type="number" value={reward} onChange={e => { const nr = [...settings.dailyClaimRewards]; nr[i] = Number(e.target.value); setSettings(prev => ({ ...prev, dailyClaimRewards: nr })); }}
                            className="w-full h-9 rounded-xl px-1 text-[10px] text-white outline-none text-center font-bold" style={inputStyle} />
                        </div>
                      ))}
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
    </div>
  );
};
