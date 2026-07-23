import React from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { Users, Zap, TrendingUp, Star, Activity, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { VerifiedBadge } from '../VerifiedBadge';

interface AdminDashboardProps {
  kpi: {
    total: number; online: number; premium: number;
    newToday: number; flagged: number; banned: number; autoMiners: number;
  };
  loadingKpi: boolean;
  liveUserCount: number;
  withdrawals: any[];
  usersList: any[];
  onRefresh: () => void;
  eforceTokenValue: number;
}

const COUNTRY_COLORS = ['#FF8A00', '#00E5FF', '#B388FF', '#4CAF50', '#FFD700', '#FF5252'];

const generateGrowthData = () => {
  const days = [];
  const base = 800;
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    days.push({
      date: label,
      users: base + (6 - i) * Math.floor(Math.random() * 80 + 50),
      newUsers: Math.floor(Math.random() * 120 + 30),
    });
  }
  return days;
};

const GROWTH_DATA = generateGrowthData();

const COUNTRY_DATA = [
  { name: 'Bangladesh', value: 45.2 },
  { name: 'India', value: 18.7 },
  { name: 'Indonesia', value: 10.3 },
  { name: 'Philippines', value: 6.8 },
  { name: 'Brazil', value: 4.3 },
  { name: 'Others', value: 14.7 },
];


const SPRING = { type: 'spring', stiffness: 260, damping: 26, mass: 0.7 } as const;

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const staggerItem = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: SPRING },
};

interface KpiCardProps {
  label: string;
  value: number | string;
  sub?: string;
  icon: React.ReactNode;
  iconBg: string;
  trend?: number;
  loading: boolean;
  sparkData?: number[];
  sparkColor?: string;
}

const KpiCard: React.FC<KpiCardProps> = ({ label, value, sub, icon, iconBg, trend, loading, sparkData, sparkColor = '#FF8A00' }) => {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      variants={staggerItem}
      whileHover={reduceMotion ? undefined : { y: -3, boxShadow: '0 8px 30px rgba(0,0,0,0.3)' }}
      whileTap={reduceMotion ? undefined : { scale: 0.985 }}
      transition={SPRING}
      className="rounded-[20px] p-4 flex flex-col gap-3 relative overflow-hidden cursor-default will-change-transform"
      style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <div className="flex items-start justify-between">
        <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 ${iconBg}`}>
          {icon}
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full transition-colors ${trend >= 0 ? 'text-green-400 bg-green-400/10' : 'text-red-400 bg-red-400/10'}`}>
            {trend >= 0 ? <ArrowUpRight size={9} /> : <ArrowDownRight size={9} />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>

      { }
      <div className="min-h-[52px]">
        <AnimatePresence mode="wait" initial={false}>
          {loading ? (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="h-7 w-20 bg-white/5 rounded-lg animate-pulse"
            />
          ) : (
            <motion.div
              key="value"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="text-2xl font-black text-white tracking-tight"
            >
              {value.toLocaleString()}
            </motion.div>
          )}
        </AnimatePresence>
        <div className="text-[10px] text-slate-500 mt-0.5">{label}</div>
        {sub && <div className="text-[9px] text-slate-600 mt-0.5">{sub}</div>}
      </div>

      { }
      <div className="h-8 -mx-1">
        {sparkData && !loading && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData.map((v, i) => ({ v, i }))}>
              <defs>
                <linearGradient id={`spark-${label}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={sparkColor} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={sparkColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={sparkColor}
                strokeWidth={1.5}
                fill={`url(#spark-${label})`}
                dot={false}
                isAnimationActive={!reduceMotion}
                animationDuration={900}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </motion.div>
  );
};

const CustomChartTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.12 }}
        className="rounded-xl p-3 text-[10px] shadow-xl"
        style={{ background: '#0D1117', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        <p className="text-slate-400 mb-1.5 font-bold">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ color: p.color }} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }} />
            {p.name}: <span className="font-black ml-1">{p.value.toLocaleString()}</span>
          </p>
        ))}
      </motion.div>
    );
  }
  return null;
};

export function getCountryFlag(countryName?: string): string {
  if (!countryName) return '🌐';
  const c = countryName.toLowerCase();
  if (c.includes('bangladesh') || c === 'bd') return '🇧🇩';
  if (c.includes('india') || c === 'in') return '🇮🇳';
  if (c.includes('pakistan') || c === 'pk') return '🇵🇰';
  if (c.includes('indonesia') || c === 'id') return '🇮🇩';
  if (c.includes('nigeria') || c === 'ng') return '🇳🇬';
  if (c.includes('philippines') || c === 'ph') return '🇵🇭';
  if (c.includes('russia') || c === 'ru') return '🇷🇺';
  if (c.includes('brazil') || c === 'br') return '🇧🇷';
  if (c.includes('united states') || c.includes('usa') || c === 'us') return '🇺🇸';
  if (c.includes('united kingdom') || c.includes('uk') || c === 'gb') return '🇬🇧';
  if (c.includes('vietnam') || c === 'vn') return '🇻🇳';
  if (c.includes('uzbekistan') || c === 'uz') return '🇺🇿';
  if (c.includes('turkey') || c.includes('türkiye') || c === 'tr') return '🇹🇷';
  if (c.includes('egypt') || c === 'eg') return '🇪🇬';
  if (c.includes('germany') || c === 'de') return '🇩🇪';
  if (c.includes('france') || c === 'fr') return '🇫🇷';
  if (c.includes('spain') || c === 'es') return '🇪🇸';
  return '🌐';
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  kpi, loadingKpi, liveUserCount, withdrawals, usersList, eforceTokenValue
}) => {
  void eforceTokenValue;
  const reduceMotion = useReducedMotion();
  const pending = withdrawals.filter(w => w.status === 'Pending');
  const recentUsers = [...usersList].slice(0, 5);
  const flaggedUsers = usersList.filter(u => u.flagCount > 0).slice(0, 5);

  const countryCounts: Record<string, number> = {};
  (usersList || []).forEach((u: any) => {
    const cName = u.country && u.country !== 'Unknown' ? u.country : 'Other';
    countryCounts[cName] = (countryCounts[cName] || 0) + 1;
  });

  const totalCount = (usersList || []).length || 1;
  const computedCountryData = Object.entries(countryCounts)
    .map(([name, count]) => ({
      name,
      count,
      value: parseFloat(((count / totalCount) * 100).toFixed(1)),
      flag: getCountryFlag(name),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const sparkPoints = [400, 430, 448, 470, 540, 580, kpi.total || 620];
  const newUserSpark = [30, 45, 28, 80, 55, 95, kpi.newToday || 70];

  return (
    <div className="flex flex-col gap-5">

      { }
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3"
      >
        <KpiCard label="Total Users" value={kpi.total} icon={<Users size={16} className="text-[#FF8A00]" />} iconBg="bg-[#FF8A00]/15" trend={8.45} loading={loadingKpi} sparkData={sparkPoints} sparkColor="#FF8A00" sub="Registered members" />
        <KpiCard label="Online Now" value={liveUserCount || kpi.online} icon={<Activity size={16} className="text-green-400" />} iconBg="bg-green-400/15" loading={loadingKpi} sub="● Live connection" />
        <KpiCard label="Tg Premium" value={kpi.premium} icon={<Star size={16} className="text-[#00E5FF]" />} iconBg="bg-[#00E5FF]/15" trend={18.72} loading={loadingKpi} sparkData={[10, 14, 20, 25, 30, 35, kpi.premium || 40]} sparkColor="#00E5FF" sub={`${kpi.total > 0 ? ((kpi.premium / kpi.total) * 100).toFixed(1) : 0}% of total`} />
        <KpiCard label="New Today" value={kpi.newToday} icon={<TrendingUp size={16} className="text-[#B388FF]" />} iconBg="bg-[#B388FF]/15" trend={12.45} loading={loadingKpi} sparkData={newUserSpark} sparkColor="#B388FF" sub="Joined today" />
        <KpiCard label="Auto Miners" value={kpi.autoMiners} icon={<Zap size={16} className="text-yellow-400" />} iconBg="bg-yellow-400/15" loading={loadingKpi} sub="Active mining sessions" />
        <KpiCard label="Pending W." value={pending.length} icon={<span className="text-base">💸</span>} iconBg="bg-orange-400/15" loading={false} sub="Awaiting approval" />
      </motion.div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        <div className="xl:col-span-2 rounded-[22px] p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <span className="text-sm font-black text-white">User Growth</span>
              <p className="text-[9px] text-slate-500 mt-0.5">Total vs new users over time</p>
            </div>
            <div className="flex items-center gap-3 text-[9px] text-slate-500">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-0.5 bg-[#FF8A00] rounded inline-block" />Total Users</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-0.5 bg-[#00E5FF] rounded inline-block border-dashed" />New Users</span>
              <span className="text-[9px] font-bold text-slate-400 bg-white/5 border border-white/8 px-2.5 py-1 rounded-lg">Last 7 Days</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={GROWTH_DATA}>
              <defs>
                <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FF8A00" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#FF8A00" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradNew" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00E5FF" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#00E5FF" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#475569' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#475569' }} axisLine={false} tickLine={false} width={35} />
              <Tooltip content={<CustomChartTooltip />} />
              <Area
                type="monotone" dataKey="users" name="Total Users" stroke="#FF8A00" strokeWidth={2.5}
                fill="url(#gradTotal)" dot={false}
                isAnimationActive={!reduceMotion} animationDuration={1100} animationEasing="ease-out"
              />
              <Area
                type="monotone" dataKey="newUsers" name="New Users" stroke="#00E5FF" strokeWidth={1.5}
                fill="url(#gradNew)" dot={false} strokeDasharray="5 3"
                isAnimationActive={!reduceMotion} animationDuration={1100} animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-[22px] p-4 flex-1" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black text-white block">Users by Country</span>
              <span className="text-[9px] font-semibold text-accent-cyan">Live Demographics</span>
            </div>
            <ResponsiveContainer width="100%" height={120}>
              <PieChart>
                <Pie
                  data={computedCountryData.length > 0 ? computedCountryData : COUNTRY_DATA} cx="50%" cy="50%" innerRadius={34} outerRadius={55}
                  dataKey="value" paddingAngle={3}
                  isAnimationActive={!reduceMotion} animationDuration={900} animationEasing="ease-out"
                >
                  {(computedCountryData.length > 0 ? computedCountryData : COUNTRY_DATA).map((_, i) => (
                    <Cell key={i} fill={COUNTRY_COLORS[i % COUNTRY_COLORS.length]} stroke="none" />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any, name: any, item: any) => [`${v}% (${item.payload.count || 0} users)`, name]} contentStyle={{ background: '#0D1117', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-1.5 mt-1">
              {(computedCountryData.length > 0 ? computedCountryData : COUNTRY_DATA.map(c => ({ ...c, count: 0, flag: getCountryFlag(c.name) }))).slice(0, 5).map((c, i) => (
                <div key={i} className="flex items-center justify-between text-[9px]">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs leading-none shrink-0">{c.flag}</span>
                    <span className="text-slate-300 font-medium truncate max-w-[90px]">{c.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-12 h-1 rounded-full bg-white/5 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: COUNTRY_COLORS[i % COUNTRY_COLORS.length] }}
                        initial={{ width: 0 }}
                        animate={{ width: `${c.value}%` }}
                        transition={{ duration: 0.8, delay: i * 0.08, ease: 'easeOut' }}
                      />
                    </div>
                    <span className="text-white font-black text-[9px] w-12 text-right">{c.count} ({c.value}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[22px] p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <span className="text-xs font-black text-white block mb-3">User Activity</span>
            {[
              { label: 'Today Active Users', value: liveUserCount || kpi.online, color: '#00E5FF' },
              { label: 'Auto Miner Active', value: kpi.autoMiners, color: '#FF8A00' },
              { label: 'Flagged Today', value: kpi.flagged, color: '#FFB347' },
              { label: 'Banned Total', value: kpi.banned, color: '#FF5252' },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-1.5 border-b border-white/[0.04] last:border-0">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: item.color }} />
                  <span className="text-[10px] text-slate-400">{item.label}</span>
                </div>
                <span className="text-[10px] font-black text-white transition-all">{loadingKpi ? '-' : item.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3-col mini tables */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        <div className="rounded-[22px] p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-black text-white">Recent Users</span>
            <span className="text-[9px] text-[#FF8A00] font-bold cursor-pointer hover:underline">View All →</span>
          </div>
          <motion.div variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-2.5">
            {recentUsers.length === 0 ? (
              <div className="text-[10px] text-slate-500 text-center py-4">No users yet</div>
            ) : recentUsers.map((u: any, idx: number) => (
              <motion.div key={u.telegramId ?? u.username ?? idx} variants={staggerItem} className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black text-[#FF8A00] shrink-0 relative"
                  style={{ background: 'rgba(255,138,0,0.12)', border: '1px solid rgba(255,138,0,0.2)' }}>
                  {(u.firstName?.[0] ?? 'U').toUpperCase()}
                  <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-400 border border-[#0D1117]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-semibold text-white truncate">{u.firstName}</span>
                    {u.isVerified && <VerifiedBadge size={9} />}
                  </div>
                  <span className="text-[8px] text-slate-500">@{u.username || 'no_username'}</span>
                </div>
                <span className="text-[9px] font-black text-[#FF8A00] shrink-0">{(u.points || 0).toLocaleString()} EForce</span>
              </motion.div>
            ))}
          </motion.div>
        </div>

        <div className="rounded-[22px] p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-black text-white">Recent Withdrawals</span>
            <span className="text-[9px] text-[#FF8A00] font-bold cursor-pointer hover:underline">View All →</span>
          </div>
          <motion.div variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-2.5">
            {pending.length === 0 ? (
              <div className="text-[10px] text-slate-500 text-center py-4">✅ No pending requests</div>
            ) : pending.slice(0, 5).map((req: any, idx: number) => (
              <motion.div key={req.id ?? idx} variants={staggerItem} className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black shrink-0"
                  style={{ background: 'rgba(255,179,71,0.12)', border: '1px solid rgba(255,179,71,0.2)' }}>
                  💸
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-semibold text-white block truncate">@{req.username || req.telegramId}</span>
                  <span className="text-[8px] text-slate-500">{req.amount || '?'} USDT • BEP-20</span>
                </div>
                <span className="text-[9px] font-black text-yellow-400 bg-yellow-400/10 px-1.5 py-0.5 rounded-md">Pending</span>
              </motion.div>
            ))}
          </motion.div>
        </div>

        <div className="rounded-[22px] p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-black text-white">Flagged Users</span>
            <span className="text-[9px] text-[#FF8A00] font-bold cursor-pointer hover:underline">View All →</span>
          </div>
          <motion.div variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-2.5">
            {flaggedUsers.length === 0 ? (
              <div className="text-[10px] text-slate-500 text-center py-4">✅ System clean</div>
            ) : flaggedUsers.map((u: any, idx: number) => (
              <motion.div key={u.telegramId ?? idx} variants={staggerItem} className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] shrink-0"
                  style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.2)' }}>
                  🚩
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-semibold text-white block truncate">@{u.username || 'unknown'}</span>
                  <span className="text-[8px] text-slate-500 capitalize">{u.riskLevel ?? 'medium'} risk</span>
                </div>
                <span className="text-[9px] font-black text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded-md">🚩{u.flagCount}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Bottom Status Bar */}
      <motion.div variants={staggerContainer} initial="hidden" animate="show" className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-3">
        {[
          { label: 'Auto Miner Users', value: kpi.autoMiners, icon: '⛏️', color: 'rgba(255,179,71,0.08)', border: 'rgba(255,179,71,0.15)' },
          { label: 'Pending Withdrawals', value: pending.length, icon: '💸', color: 'rgba(255,138,0,0.08)', border: 'rgba(255,138,0,0.15)' },
          { label: 'Flagged Users', value: kpi.flagged, icon: '🚩', color: 'rgba(234,179,8,0.08)', border: 'rgba(234,179,8,0.15)' },
          { label: 'Banned Users', value: kpi.banned, icon: '🚫', color: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.15)' },
        ].map((item) => (
          <motion.div key={item.label} variants={staggerItem} className="flex items-center gap-3 p-3 rounded-[16px]" style={{ background: item.color, border: `1px solid ${item.border}` }}>
            <span className="text-xl">{item.icon}</span>
            <div>
              <div className="text-base font-black text-white">{loadingKpi ? '-' : item.value.toLocaleString()}</div>
              <div className="text-[8px] text-slate-500">{item.label}</div>
            </div>
          </motion.div>
        ))}
        <motion.div variants={staggerItem} className="flex items-center gap-3 p-3 rounded-[16px]" style={{ background: 'rgba(74,222,128,0.07)', border: '1px solid rgba(74,222,128,0.18)' }}>
          <div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.9)] shrink-0" />
          <div>
            <div className="text-[10px] font-black text-green-400">Operational</div>
            <div className="text-[8px] text-slate-500">System Status</div>
          </div>
        </motion.div>
      </motion.div>

    </div>
  );
};