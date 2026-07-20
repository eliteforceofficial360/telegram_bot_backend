import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Timestamp } from 'firebase/firestore';
import {
  Check, X, Search, Ban, Edit3, Save,
  RefreshCw, Plus, Trash2, ToggleLeft, ToggleRight,
  Star, ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  ArrowUpDown, ShieldAlert,
} from 'lucide-react';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { AdminSidebar } from '../components/admin/AdminSidebar';
import { AdminHeader } from '../components/admin/AdminHeader';
import { AdminDashboard } from '../components/admin/AdminDashboard';
import type { AdminTab } from '../components/admin/AdminSidebar';
import {
  getAllUsers, updateUserDatabaseValues, getTotalUserCount,
  getTodayNewUsersCount, getFlaggedUsersCount, getBannedUsersCount,
  getPremiumUsersCount, getAutoMinerUsersCount, getOnlineUserCount,
  updateWithdrawRequest, subscribeToWithdrawRequests,
  flagUser, adminSetBan, logAdminAction,
  adminPinUser, adminRemoveUser, adminAddUser, adminResetLeaderboard,
  type FirestoreUser,
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
  danger:  'inline-flex items-center justify-center gap-2 font-bold cursor-pointer transition-all active:scale-[0.97]',
  /** Amber warning (Flag) */
  warning: 'inline-flex items-center justify-center gap-2 font-bold cursor-pointer transition-all active:scale-[0.97]',
  /** Green success (Approve / Unban) */
  success: 'inline-flex items-center justify-center gap-2 font-bold cursor-pointer transition-all active:scale-[0.97]',
  /** Indigo edit (Edit) */
  edit:    'inline-flex items-center justify-center gap-2 font-bold cursor-pointer transition-all active:scale-[0.97]',
  /** Ghost neutral (Cancel / Refresh) */
  ghost:   'inline-flex items-center justify-center gap-2 font-bold cursor-pointer transition-all active:scale-[0.97]',
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
    background: 'rgba(74,222,128,0.12)',
    border: '1px solid rgba(74,222,128,0.35)',
    color: '#4ADE80',
    boxShadow: '0 0 12px rgba(74,222,128,0.15)',
  } as React.CSSProperties,
  edit: {
    background: 'rgba(139,92,246,0.14)',
    border: '1px solid rgba(139,92,246,0.35)',
    color: '#A78BFA',
    boxShadow: '0 0 10px rgba(139,92,246,0.15)',
  } as React.CSSProperties,
  ghost: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#94A3B8',
  } as React.CSSProperties,
};

// ── Sort button (module-scoped so it's not recreated on every render) ─────────
const SortBtn = ({ field, label, sortField, sortDir, handleSort }: { field: SortField; label: string; sortField: SortField; sortDir: SortDir; handleSort: (f: SortField) => void }) => (
  <button onClick={() => handleSort(field)} className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-slate-500 hover:text-white transition-all cursor-pointer group">
    {label}
    {sortField === field
      ? (sortDir === 'asc' ? <ChevronUp size={10} className="text-[#FF8A00]" /> : <ChevronDown size={10} className="text-[#FF8A00]" />)
      : <ArrowUpDown size={9} className="opacity-25 group-hover:opacity-60" />}
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
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [savingUser, setSavingUser] = useState(false);
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [addUserId, setAddUserId] = useState('');
  const [addUserName, setAddUserName] = useState('');
  const [addFirstName, setAddFirstName] = useState('');
  const [addPoints, setAddPoints] = useState('0');
  const [addingUser, setAddingUser] = useState(false);

  const fetchUsers = async () => { setLoadingUsers(true); const u = await getAllUsers(); setUsersList(u); setLoadingUsers(false); };
  useEffect(() => { fetchUsers(); }, []);
  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    }
  }, [activeTab]);

  const startEditUser = (u: FirestoreUser) => {
    setEditingUser(u); setEditPoints(u.points ?? 0); setEditTokens(u.tokens ?? 0);
    setEditWallet(u.wallet ?? 0); setEditReferrals(u.referrals ?? 0);
    setEditRiskLevel(u.riskLevel ?? 'safe'); setEditBanStatus(u.banStatus ?? 'none');
    setEditLeaderboardPinned(u.leaderboardPinned ?? false);
    setEditLeaderboardHidden(u.leaderboardHidden ?? false);
    setEditIsVerified(u.isVerified ?? false);
    if (u.banStatus === 'temp' && u.banUntil) {
      const until = u.banUntil instanceof Timestamp ? u.banUntil.toDate() : new Date(u.banUntil as string);
      const diffHrs = Math.max(1, Math.round((until.getTime() - Date.now()) / 3600000));
      setEditBanDuration(diffHrs >= 72 ? 72 : diffHrs >= 48 ? 48 : 24);
    } else setEditBanDuration(24);
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
      if (sessionStr) { try { const p = JSON.parse(sessionStr); adminId = p.uid || 'unknown'; adminUsername = p.email || 'Admin'; } catch {} }
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
      if (changes.length > 0) await logAdminAction(typeof adminId === 'number' ? adminId : 0, adminUsername, 'Edit User Profile & Leaderboard', editingUser.telegramId, changes.join(', ')).catch(() => {});
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
      case 'banned':  list = list.filter(u => (u.banStatus ?? 'none') !== 'none'); break;
      case 'online':  list = list.filter(u => u.isOnline); break;
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
  const [notifMessage, setNotifMessage]     = useState('');
  const [notifTarget, setNotifTarget]       = useState<'all' | 'user'>('all');
  const [notifUserId, setNotifUserId]       = useState('');
  const [notifUserSearch, setNotifUserSearch] = useState('');
  const [notifUserDropdown, setNotifUserDropdown] = useState(false);
  const [notifSending, setNotifSending]     = useState(false);
  const [notifApiSecret, setNotifApiSecret] = useState('elite_force_secret_2024');
  const [notifImageUrl, setNotifImageUrl]   = useState('');
  const [notifBtnText, setNotifBtnText]     = useState('');
  const [notifBtnUrl, setNotifBtnUrl]       = useState('');

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

  // Task type color map
  const TASK_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    channel: { bg: 'rgba(0,229,255,0.1)',   text: '#00E5FF', border: 'rgba(0,229,255,0.25)' },
    group:   { bg: 'rgba(56,189,248,0.1)',   text: '#38BDF8', border: 'rgba(56,189,248,0.25)' },
    x:       { bg: 'rgba(255,255,255,0.08)', text: '#ffffff', border: 'rgba(255,255,255,0.2)' },
    website: { bg: 'rgba(163,230,53,0.1)',   text: '#A3E635', border: 'rgba(163,230,53,0.25)' },
    video:   { bg: 'rgba(248,113,113,0.1)',  text: '#F87171', border: 'rgba(248,113,113,0.25)' },
    daily:   { bg: 'rgba(255,138,0,0.1)',    text: '#FF8A00', border: 'rgba(255,138,0,0.25)' },
    ad:      { bg: 'rgba(179,136,255,0.1)',  text: '#B388FF', border: 'rgba(179,136,255,0.25)' },
  };

  // ============ RENDER ============
  return (
    <div className="flex h-full overflow-hidden" style={{ background: '#040810' }}>
      <AdminSidebar
        activeTab={activeTab}
        setActiveTab={tab => { setActiveTab(tab); setPage(1); }}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        eforceTokenValue={settings.eforceTokenValue}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
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
          className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5"
          style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.07) transparent' }}
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
              <SectionCard accentColor="#00E5FF88">
                <div className="p-5 flex flex-col gap-4">
                  {/* Header row */}
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h2 className="text-base font-black text-white">User Management</h2>
                        <span className="text-[8px] font-black uppercase tracking-[0.22em] px-2.5 py-1 rounded-full"
                          style={{ background: 'rgba(0,229,255,0.1)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.2)' }}>
                          Live Roster
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1 max-w-lg">
                        Search, review, and moderate users. Use filters to isolate online, premium, flagged or banned accounts.
                      </p>
                    </div>

                    {/* Mini KPI chips */}
                    <div className="grid grid-cols-4 gap-2 xl:shrink-0">
                      {[
                        { label: 'Total',   value: usersList.length,          color: '#fff',     bg: 'rgba(255,255,255,0.05)',  border: 'rgba(255,255,255,0.1)' },
                        { label: 'Online',  value: filterCounts.online,       color: '#4ADE80',  bg: 'rgba(74,222,128,0.08)',   border: 'rgba(74,222,128,0.2)' },
                        { label: 'Flagged', value: filterCounts.flagged,      color: '#FBBF24',  bg: 'rgba(251,191,36,0.08)',   border: 'rgba(251,191,36,0.2)' },
                        { label: 'Banned',  value: filterCounts.banned,       color: '#F87171',  bg: 'rgba(248,113,113,0.08)',  border: 'rgba(248,113,113,0.2)' },
                      ].map(s => (
                        <div key={s.label} className="rounded-2xl px-3 py-2.5 text-center" style={{ background: s.bg, border: `1px solid ${s.border}` }}>
                          <div className="text-lg font-black leading-none" style={{ color: s.color }}>{s.value}</div>
                          <div className="text-[8px] uppercase tracking-[0.18em] text-slate-500 mt-0.5">{s.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Search + action buttons */}
                  <div className="flex flex-col md:flex-row gap-2.5">
                    <div className="relative flex-1">
                      <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                      <input
                        value={userSearch}
                        onChange={e => { setUserSearch(e.target.value); setPage(1); }}
                        placeholder="Search name, @username, Telegram ID…"
                        className="w-full pl-10 pr-10 h-11 rounded-2xl text-xs text-white outline-none transition-all"
                        style={inputStyle}
                      />
                      {userSearch && (
                        <button onClick={() => { setUserSearch(''); setPage(1); }}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg flex items-center justify-center text-slate-500 hover:text-white transition-all">
                          <X size={11} />
                        </button>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {/* Add User */}
                      <button
                        onClick={() => setShowAddUserForm(v => !v)}
                        className={`${Btn.primary} h-11 px-4 rounded-2xl text-xs`}
                        style={btnStyle.primary}
                      >
                        <Plus size={13} /> Add User
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
                            <input value={addUserId}    onChange={e => setAddUserId(e.target.value)}    placeholder="Telegram ID *"     type="number" className={inputCls} style={inputStyle} />
                            <input value={addFirstName} onChange={e => setAddFirstName(e.target.value)} placeholder="First Name *"      className={inputCls} style={inputStyle} />
                            <input value={addUserName}  onChange={e => setAddUserName(e.target.value)}  placeholder="Username (opt.)"   className={inputCls} style={inputStyle} />
                            <input value={addPoints}    onChange={e => setAddPoints(e.target.value)}    placeholder="Starting Points"   type="number" className={inputCls} style={inputStyle} />
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
                      const meta: Record<UserFilter, { emoji: string; color: string; border: string; activeBg: string }> = {
                        all:     { emoji: '●', color: '#fff',    border: 'rgba(255,255,255,0.15)', activeBg: 'linear-gradient(135deg,#FF8A00,#FFB347)' },
                        online:  { emoji: '🟢', color: '#4ADE80', border: 'rgba(74,222,128,0.3)',   activeBg: 'rgba(74,222,128,0.18)' },
                        premium: { emoji: '⭐', color: '#00E5FF', border: 'rgba(0,229,255,0.3)',    activeBg: 'rgba(0,229,255,0.12)' },
                        flagged: { emoji: '🚩', color: '#FBBF24', border: 'rgba(251,191,36,0.3)',   activeBg: 'rgba(251,191,36,0.12)' },
                        banned:  { emoji: '🚫', color: '#F87171', border: 'rgba(248,113,113,0.3)',  activeBg: 'rgba(248,113,113,0.12)' },
                      };
                      const m = meta[f];
                      return (
                        <button
                          key={f}
                          onClick={() => { setUserFilter(f); setPage(1); }}
                          className="flex items-center gap-1.5 h-8 px-3.5 rounded-full text-[10px] font-bold capitalize transition-all cursor-pointer"
                          style={{
                            background: isSelected ? m.activeBg : 'rgba(255,255,255,0.04)',
                            border: `1px solid ${isSelected ? m.border : 'rgba(255,255,255,0.08)'}`,
                            color: isSelected ? m.color : '#64748b',
                          }}
                        >
                          <span className="text-[10px]">{m.emoji}</span>
                          {f} <span className="opacity-60">({filterCounts[f]})</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </SectionCard>

              {/* ── Users table ── */}
              <SectionCard accentColor="#00E5FF44">
                {/* Table header */}
                <div className="grid items-center gap-2 px-5 py-3 border-b sticky top-0 z-10 backdrop-blur"
                  style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(4,8,16,0.92)', gridTemplateColumns: '2.5rem 1fr 8rem 7rem 6rem 7rem 10rem' }}>
                  <div />
                  <SortBtn field="firstName" label="User"   sortField={sortField} sortDir={sortDir} handleSort={handleSort} />
                  <SortBtn field="points"    label="Points" sortField={sortField} sortDir={sortDir} handleSort={handleSort} />
                  <SortBtn field="tokens"    label="Tokens" sortField={sortField} sortDir={sortDir} handleSort={handleSort} />
                  <SortBtn field="referrals" label="Refs"   sortField={sortField} sortDir={sortDir} handleSort={handleSort} />
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-600">Status</span>
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-600 text-right">Actions</span>
                </div>

                {/* Table rows */}
                {loadingUsers ? (
                  <div className="flex flex-col">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="grid items-center gap-2 px-5 py-4 border-b border-white/[0.03]"
                        style={{ gridTemplateColumns: '2.5rem 1fr 8rem 7rem 6rem 7rem 10rem' }}>
                        <div className="w-9 h-9 rounded-full bg-white/5 animate-pulse" />
                        <div className="space-y-1.5"><div className="h-3 w-28 bg-white/5 rounded animate-pulse" /><div className="h-2 w-20 bg-white/[0.03] rounded animate-pulse" /></div>
                        {Array.from({ length: 5 }).map((_, j) => <div key={j} className="h-3 bg-white/[0.03] rounded animate-pulse" />)}
                      </div>
                    ))}
                  </div>
                ) : pagedUsers.length === 0 ? (
                  <div className="text-center py-16 text-slate-500 text-xs">No users match your filters.</div>
                ) : (
                  <AnimatePresence mode="wait">
                    <motion.div key={`${userFilter}-${page}-${sortField}-${sortDir}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
                      {pagedUsers.map((u, idx) => (
                        <React.Fragment key={u.telegramId}>
                          <motion.div
                            initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.025 }}
                            className="grid items-center gap-2 px-5 py-4 border-b transition-all hover:bg-white/[0.02] cursor-default group"
                            style={{ borderColor: 'rgba(255,255,255,0.04)', gridTemplateColumns: '2.5rem 1fr 8rem 7rem 6rem 7rem 10rem' }}
                          >
                            {/* Avatar */}
                            <div className="relative">
                              <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black"
                                style={{ background: 'rgba(255,138,0,0.12)', border: '1.5px solid rgba(255,138,0,0.22)', color: '#FF8A00' }}>
                                {(u.firstName?.[0] ?? 'U').toUpperCase()}
                              </div>
                              {u.isOnline && <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400 border-2" style={{ borderColor: '#040810', boxShadow: '0 0 6px rgba(74,222,128,0.8)' }} />}
                            </div>

                            {/* Name */}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-bold text-white truncate max-w-[130px]">{u.firstName} {u.lastName}</span>
                                {u.isVerified && <VerifiedBadge size={10} />}
                                {u.isTelegramPremium && <Star size={10} className="text-[#00E5FF] fill-current shrink-0" />}
                                {(u.banStatus ?? 'none') !== 'none' && <span className="text-[7px] font-black px-1.5 py-0.5 rounded uppercase" style={{ color: '#F87171', background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.25)' }}>Banned</span>}
                                {u.flagCount > 0 && <span className="text-[7px] font-black px-1.5 py-0.5 rounded" style={{ color: '#FBBF24', background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.25)' }}>🚩{u.flagCount}</span>}
                              </div>
                              <span className="text-[9px] text-slate-600">@{u.username || 'no_username'} · {u.telegramId}</span>
                            </div>

                            {/* Points */}
                            <div>
                              <span className="text-xs font-black" style={{ color: '#FF8A00' }}>{(u.points || 0).toLocaleString()}</span>
                              <div className="text-[8px] uppercase tracking-widest text-slate-600">EForce</div>
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

          {/* ════════════════════ TASKS ════════════════════ */}
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
                  { label: 'Total Users',   value: usersList.length,           color: '#C084FC', bg: 'rgba(192,132,252,0.08)', border: 'rgba(192,132,252,0.22)' },
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
                    <input
                      type="text"
                      placeholder="e.g. https://example.com/banner.png"
                      value={notifImageUrl}
                      onChange={e => setNotifImageUrl(e.target.value)}
                      className={inputCls}
                      style={inputStyle}
                    />
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
                    { icon: '🚫', label: 'Account Banned',      desc: 'Auto-sent when you ban a user from a withdrawal', color: '#FB923C' },
                    { icon: '🎉', label: 'Referral Notification', desc: 'Auto-sent by bot when a new user joins via referral link', color: '#C084FC' },
                    { icon: '📢', label: 'Custom Announcement', desc: 'Manual broadcast using the form above', color: '#60A5FA' },
                    { icon: '📩', label: 'Custom User Message',  desc: 'Direct message to a specific user using the form above', color: '#34D399' },
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
                  { label: 'Flagged',     value: kpi.flagged,    icon: '🚩', color: '#FBBF24', bg: 'rgba(251,191,36,0.08)',   border: 'rgba(251,191,36,0.22)',   glow: 'rgba(251,191,36,0.3)' },
                  { label: 'Banned',      value: kpi.banned,     icon: '🚫', color: '#F87171', bg: 'rgba(248,113,113,0.08)',  border: 'rgba(248,113,113,0.22)',  glow: 'rgba(248,113,113,0.3)' },
                  { label: 'Auto Miners', value: kpi.autoMiners, icon: '⛏️', color: '#FF8A00', bg: 'rgba(255,138,0,0.08)',    border: 'rgba(255,138,0,0.22)',    glow: 'rgba(255,138,0,0.3)' },
                  { label: 'Total Users', value: kpi.total,      icon: '👥', color: '#B388FF', bg: 'rgba(179,136,255,0.08)', border: 'rgba(179,136,255,0.22)', glow: 'rgba(179,136,255,0.3)' },
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
                      <button onClick={() => handleBanUser(u)}   className={`${Btn.danger}  h-8 px-3 rounded-xl text-[9px]`} style={btnStyle.danger}><Ban size={11} /> Ban</button>
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
                    {[{ label: 'Swap Rate (Points per Token)', key: 'swapRate' }, { label: 'EForce Token Value (USD)', key: 'eforceTokenValue' }, { label: 'Tap Reward', key: 'tapReward' }, { label: 'Combo Multiplier', key: 'comboReward' }, { label: 'Max Energy', key: 'energyMax' }].map(f => (
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

                {/* Auto Miner */}
                <SectionCard accentColor="#FF8A0055">
                  <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                    <div className="flex items-center gap-2"><span className="text-base">⛏️</span><span className="text-sm font-black text-white">Auto Miner</span></div>
                    <p className="text-[9px] text-slate-500 mt-0.5">Mining duration, reward, and cooldown</p>
                  </div>
                  <div className="p-4 flex flex-col divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                    {[{ label: 'Duration (seconds)', key: 'autoMinerDuration' }, { label: 'Reward per Session (EForce)', key: 'autoMinerReward' }, { label: 'Cooldown (seconds)', key: 'autoMinerCooldown' }].map(f => (
                      <div key={f.key} className="flex items-center justify-between gap-4 py-3">
                        <label className="text-xs text-slate-400">{f.label}</label>
                        <input type="number" value={(settings as any)[f.key]} onChange={e => setSettings(prev => ({ ...prev, [f.key]: Number(e.target.value) }))} className="w-28 h-8 rounded-xl px-3 text-xs text-white outline-none text-right transition-all" style={inputStyle} />
                      </div>
                    ))}
                    <div className="flex items-center justify-between py-3">
                      <label className="text-xs text-slate-400">Premium Users Only</label>
                      <Toggle on={settings.autoMinerPremiumOnly} onToggle={() => setSettings(p => ({ ...p, autoMinerPremiumOnly: !p.autoMinerPremiumOnly }))} accentColor="#00E5FF" />
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
                    {[{ label: 'Referral USDT Reward', key: 'referralRewardUsdt' }, { label: 'Referral Token Reward', key: 'referralRewardToken' }, { label: 'Min Referrals to Withdraw', key: 'withdrawMinReferrals' }, { label: 'Min Withdraw Amount (USDT)', key: 'withdrawMinAmount' }, { label: 'Daily Withdraw Limit (USDT)', key: 'dailyWithdrawLimit' }].map(f => (
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
                        <label className="text-xs text-slate-400 block">Loading Screen Logo URL</label>
                        <span className="text-[9px] text-slate-600">URL of the logo shown on startup loading screen</span>
                      </div>
                      <input type="text" value={settings.loadingLogoUrl || ''} onChange={e => setSettings(prev => ({ ...prev, loadingLogoUrl: e.target.value }))} className="w-48 h-8 rounded-xl px-3 text-xs text-white outline-none text-right" style={inputStyle} />
                    </div>
                    <div className="flex items-center justify-between gap-4 py-3">
                      <div>
                        <label className="text-xs text-slate-400 block">Mining Coin Icon URL</label>
                        <span className="text-[9px] text-slate-600">URL of the central spinning coin / mine button logo</span>
                      </div>
                      <input type="text" value={settings.coinIconUrl || ''} onChange={e => setSettings(prev => ({ ...prev, coinIconUrl: e.target.value }))} className="w-48 h-8 rounded-xl px-3 text-xs text-white outline-none text-right" style={inputStyle} />
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

                {/* Custom Top Miners */}
                <SectionCard accentColor="#FF8A0066">
                  <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                    <div className="flex items-center gap-2"><span className="text-base">⛏️</span><span className="text-sm font-black text-white">Custom Top Miners</span></div>
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
                            <span className="text-xs font-black" style={{ color: '#FF8A00' }}>{m.score.toLocaleString()} EForce</span>
                            <button onClick={() => handleRemoveCustomMiner(idx)} className="w-7 h-7 flex items-center justify-center rounded-lg transition-all cursor-pointer" style={btnStyle.danger} title="Remove"><Trash2 size={12} /></button>
                          </div>
                        ))}
                      </div>
                    )}
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
                        ).catch(() => {});
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
