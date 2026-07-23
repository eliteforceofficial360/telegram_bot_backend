import React from 'react';
import { motion } from 'framer-motion';
import {
  PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { Users, Zap, Star, Activity } from 'lucide-react';

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

const COUNTRY_COLORS = ['#2563EB', '#0284C7', '#0891B2', '#059669', '#D97706', '#DC2626'];

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
    <div className="bg-white border border-slate-200 p-2.5 rounded-xl shadow-lg text-xs">
      <div className="text-[10px] text-slate-500 font-bold mb-1 uppercase tracking-wider">{label}</div>
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-2 py-0.5">
          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: entry.color }} />
          <span className="text-slate-600 font-medium">{entry.name}:</span>
          <span className="text-slate-900 font-bold ml-auto">{entry.value.toLocaleString()}</span>
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
    { title: 'Total Members', value: kpi.total, sub: `${kpi.newToday} joined today`, icon: <Users size={16} />, color: '#2563EB', bg: 'bg-blue-50', border: 'border-blue-200' },
    { title: 'Live Online', value: liveUserCount || kpi.online, sub: 'Currently active', icon: <Zap size={16} />, color: '#059669', bg: 'bg-emerald-50', border: 'border-emerald-200' },
    { title: 'Premium Users', value: kpi.premium, sub: 'Telegram Supporters', icon: <Star size={16} />, color: '#0284C7', bg: 'bg-sky-50', border: 'border-sky-200' },
    { title: 'Auto Miners', value: kpi.autoMiners, sub: 'Active automated mining', icon: <Activity size={16} />, color: '#7C3AED', bg: 'bg-purple-50', border: 'border-purple-200' },
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
            className="bg-white rounded-2xl p-4.5 border border-slate-200 shadow-sm flex items-center justify-between"
          >
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{card.title}</div>
              <div className="text-2xl font-black text-slate-900 mt-1">{card.value.toLocaleString()}</div>
              <div className="text-[10px] font-medium text-slate-500 mt-0.5">{card.sub}</div>
            </div>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.bg} border ${card.border}`} style={{ color: card.color }}>
              {card.icon}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main Charts & Demographics grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* User Growth Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">User Growth Overview</h3>
              <p className="text-[10px] text-slate-500 font-medium">Daily registered & total active members growth trend</p>
            </div>
            <span className="text-[9px] font-bold px-2 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200">7 Days</span>
          </div>

          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={GROWTH_DATA}>
              <defs>
                <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563EB" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradNew" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0891B2" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#0891B2" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} width={35} />
              <Tooltip content={<CustomChartTooltip />} />
              <Area
                type="monotone" dataKey="users" name="Total Users" stroke="#2563EB" strokeWidth={2}
                fill="url(#gradTotal)" dot={false}
              />
              <Area
                type="monotone" dataKey="newUsers" name="New Users" stroke="#0891B2" strokeWidth={1.5}
                fill="url(#gradNew)" dot={false} strokeDasharray="4 2"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Country Demographics */}
        <div className="flex flex-col gap-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex-1">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-900">Users by Country</span>
              <span className="text-[9px] font-bold text-blue-600">Live Geo</span>
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
                <div key={i} className="flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs shrink-0">{c.flag}</span>
                    <span className="text-slate-700 font-semibold truncate max-w-[90px]">{c.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-14 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${c.value}%`, background: COUNTRY_COLORS[i % COUNTRY_COLORS.length] }}
                      />
                    </div>
                    <span className="text-slate-900 font-bold w-12 text-right">{c.count} ({c.value}%)</span>
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