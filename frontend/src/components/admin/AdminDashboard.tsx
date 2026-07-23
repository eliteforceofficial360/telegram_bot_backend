import React from 'react';
import { motion } from 'framer-motion';
import {
  PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

interface AdminDashboardProps {
  kpi: {
    total: number; online: number; premium: number;
    newToday: number; flagged: number; banned: number; autoMiners: number;
  };
  loadingKpi?: boolean;
  liveUserCount: number;
  withdrawals?: any[];
  usersList: any[];
  onRefresh?: () => void;
  eforceTokenValue?: number;
}

const COUNTRY_COLORS = ['#38BDF8', '#60A5FA', '#22D3EE', '#34D399', '#FBBF24', '#F87171'];

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

const CustomChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0B0E14] border border-slate-800 p-3 rounded-xl shadow-xl text-xs font-sans">
      <div className="text-[10px] text-slate-400 font-mono font-bold mb-1.5 uppercase tracking-wider">{label}</div>
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-2 py-0.5">
          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: entry.color }} />
          <span className="text-slate-300 font-medium">{entry.name}:</span>
          <span className="text-white font-bold ml-auto">{entry.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
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
  kpi, liveUserCount, usersList
}) => {
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

  const kpiCards = [
    { title: 'Total Members', value: kpi.total, sub: `+${kpi.newToday} joined today`, faIcon: 'fa-solid fa-users', color: '#60A5FA', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
    { title: 'Live Active Miners', value: liveUserCount || kpi.online, sub: 'Mining currently online', faIcon: 'fa-solid fa-bolt', color: '#34D399', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    { title: 'Telegram Premium', value: kpi.premium, sub: 'Star Supporters', faIcon: 'fa-solid fa-star', color: '#38BDF8', bg: 'bg-sky-500/10', border: 'border-sky-500/20' },
    { title: 'Auto Miners Active', value: kpi.autoMiners, sub: 'Automated sessions', faIcon: 'fa-solid fa-robot', color: '#C084FC', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
  ];

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-6"
    >
      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card, idx) => (
          <motion.div
            key={idx}
            variants={staggerItem}
            className="bg-[#131824] rounded-2xl p-5 border border-slate-800/80 shadow-xs flex items-center justify-between"
          >
            <div>
              <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">{card.title}</div>
              <div className="text-2xl font-black text-white mt-1.5">{card.value.toLocaleString()}</div>
              <div className="text-[10.5px] font-semibold text-slate-400 mt-1 flex items-center gap-1">
                <i className="fa-solid fa-chart-line text-[10px] text-emerald-400"></i>
                <span>{card.sub}</span>
              </div>
            </div>
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-base ${card.bg} border ${card.border}`} style={{ color: card.color }}>
              <i className={card.faIcon}></i>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main Charts & Demographics grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* User Growth Chart */}
        <div className="lg:col-span-2 bg-[#131824] rounded-2xl p-5 border border-slate-800/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <i className="fa-solid fa-chart-area text-blue-400"></i>
                <span>User Growth & Acquisition</span>
              </h3>
              <p className="text-[10.5px] text-slate-400 font-medium mt-0.5">7-day active registration & user telemetry trajectory</p>
            </div>
            <span className="text-[9.5px] font-mono font-bold px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <i className="fa-solid fa-calendar-days mr-1.5"></i>7 Days
            </span>
          </div>

          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={GROWTH_DATA}>
              <defs>
                <linearGradient id="gradTotalDark" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38BDF8" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#38BDF8" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradNewDark" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22D3EE" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#22D3EE" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={35} />
              <Tooltip content={<CustomChartTooltip />} />
              <Area
                type="monotone" dataKey="users" name="Total Users" stroke="#38BDF8" strokeWidth={2}
                fill="url(#gradTotalDark)" dot={false}
              />
              <Area
                type="monotone" dataKey="newUsers" name="New Users" stroke="#22D3EE" strokeWidth={1.5}
                fill="url(#gradNewDark)" dot={false} strokeDasharray="4 2"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Country Demographics */}
        <div className="flex flex-col gap-4">
          <div className="bg-[#131824] rounded-2xl p-5 border border-slate-800/80 shadow-xs flex-1">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                <i className="fa-solid fa-globe text-cyan-400"></i>
                <span>Users By Geo Location</span>
              </span>
              <span className="text-[9.5px] font-mono font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                LIVE
              </span>
            </div>
            <ResponsiveContainer width="100%" height={120}>
              <PieChart>
                <Pie
                  data={computedCountryData.length > 0 ? computedCountryData : COUNTRY_DATA} cx="50%" cy="50%" innerRadius={34} outerRadius={52}
                  dataKey="value" paddingAngle={3}
                >
                  {(computedCountryData.length > 0 ? computedCountryData : COUNTRY_DATA).map((_, i) => (
                    <Cell key={i} fill={COUNTRY_COLORS[i % COUNTRY_COLORS.length]} stroke="none" />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any, name: any, item: any) => [`${v}% (${item.payload.count || 0} users)`, name]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-2 mt-2">
              {(computedCountryData.length > 0 ? computedCountryData : COUNTRY_DATA.map(c => ({ ...c, count: 0, flag: getCountryFlag(c.name) }))).slice(0, 4).map((c, i) => (
                <div key={i} className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs shrink-0">{c.flag}</span>
                    <span className="text-slate-200 font-bold truncate max-w-[90px]">{c.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-14 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${c.value}%`, background: COUNTRY_COLORS[i % COUNTRY_COLORS.length] }}
                      />
                    </div>
                    <span className="text-white font-extrabold w-12 text-right">{c.count} ({c.value}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};