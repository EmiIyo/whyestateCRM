import {
  Zap, Target, TrendingUp, AlertCircle, ArrowUpRight, CheckSquare, Square,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { kpiStats, commissionData, propertyMix, pipelineStages, activeDeals, upcomingTasks } from '@/data/index';
import { formatCurrency } from '@/lib/index';

// ─── Icon map ─────────────────────────────────────────────────────────────────
const ICON_MAP: Record<string, React.ElementType> = { Zap, Target, TrendingUp, AlertCircle };

// ─── Card shell ───────────────────────────────────────────────────────────────
function Card({
  children,
  className = '',
  style = {},
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`rounded-2xl p-5 ${className}`}
      style={{ background: '#FFFFFF', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', ...style }}
    >
      {children}
    </div>
  );
}

// ─── KPI Cards ────────────────────────────────────────────────────────────────
function KpiCards() {
  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
      {kpiStats.map((s) => {
        const Icon = ICON_MAP[s.icon] ?? Zap;
        return (
          <div
            key={s.label}
            className="rounded-2xl p-5"
            style={{
              background: s.cardBg,
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            }}
          >
            {/* Icon circle */}
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center mb-3"
              style={{ background: s.iconBg }}
            >
              <Icon size={18} style={{ color: s.iconColor }} />
            </div>

            {/* Value */}
            <p className="text-2xl font-bold leading-tight font-mono" style={{ color: '#2B3340' }}>
              {s.value}
            </p>

            {/* Label */}
            <p className="text-sm mt-0.5" style={{ color: '#A1A9B6' }}>{s.label}</p>

            {/* Detail badge */}
            <p className="text-xs font-medium mt-2" style={{ color: s.detailColor }}>
              {s.detail}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ─── Commission Chart ─────────────────────────────────────────────────────────
function CommissionChart() {
  return (
    <Card>
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="font-semibold text-base" style={{ color: '#4B4F55' }}>Commission Trend</p>
          <p className="text-xs mt-0.5" style={{ color: '#A1A9B6' }}>6-month performance · RM</p>
        </div>
        <span
          className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg"
          style={{ background: '#E7F9F2', color: '#22C55E' }}
        >
          <ArrowUpRight size={13} />
          48% growth
        </span>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={commissionData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="commGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1EC9C4" stopOpacity={0.18} />
              <stop offset="100%" stopColor="#1EC9C4" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#EAEAEA" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: '#A1A9B6' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) => `${v / 1000}K`}
            tick={{ fontSize: 11, fill: '#A1A9B6' }}
            axisLine={false}
            tickLine={false}
            domain={[0, 160000]}
            ticks={[0, 40000, 80000, 120000, 160000]}
          />
          <Tooltip
            contentStyle={{
              background: '#FFFFFF',
              border: '1px solid #E8EBEF',
              borderRadius: 10,
              fontSize: 12,
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            }}
            formatter={(v: number) => [`RM ${v.toLocaleString()}`, 'Commission']}
          />
          <Area
            type="monotone"
            dataKey="amount"
            stroke="#1EC9C4"
            strokeWidth={2.5}
            fill="url(#commGrad)"
            dot={{ r: 4, fill: '#1EC9C4', strokeWidth: 2, stroke: '#fff' }}
            activeDot={{ r: 6, fill: '#1EC9C4', stroke: '#fff', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
}

// ─── Property Mix ─────────────────────────────────────────────────────────────
function PropertyMix() {
  const total = propertyMix.reduce((s, d) => s + d.value, 0);
  let cumulative = 0;
  const segments = propertyMix.map((d) => {
    const start = (cumulative / total) * 360;
    cumulative += d.value;
    const end = (cumulative / total) * 360;
    return { ...d, start, end };
  });
  const gradient = segments
    .map((s) => `${s.color} ${s.start.toFixed(1)}deg ${s.end.toFixed(1)}deg`)
    .join(', ');

  return (
    <Card>
      <p className="font-semibold text-sm mb-4" style={{ color: '#4B4F55' }}>Property Mix</p>

      {/* Donut */}
      <div className="flex items-center justify-center mb-4">
        <div
          className="w-28 h-28 rounded-full relative"
          style={{ background: `conic-gradient(${gradient})` }}
        >
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{}}
          >
            <div
              className="w-16 h-16 rounded-full flex flex-col items-center justify-center"
              style={{ background: '#FFFFFF' }}
            >
              <span className="text-lg font-bold font-mono" style={{ color: '#2B3340' }}>{total}</span>
              <span className="text-xs" style={{ color: '#A1A9B6' }}>total</span>
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="space-y-2">
        {propertyMix.map((p) => (
          <div key={p.name} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
            <span className="text-xs flex-1" style={{ color: '#6F7B8A' }}>{p.name}</span>
            <span className="text-xs font-semibold font-mono" style={{ color: '#4B4F55' }}>{p.value}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Pipeline Stages ─────────────────────────────────────────────────────────
function PipelineStages() {
  const maxCount = Math.max(...pipelineStages.map((s) => s.count));
  return (
    <Card>
      <p className="font-semibold text-sm mb-4" style={{ color: '#4B4F55' }}>Pipeline Stages</p>
      <div className="space-y-3">
        {pipelineStages.map((s) => (
          <div key={s.label} className="flex items-center gap-3">
            <span className="text-xs font-medium w-8 flex-shrink-0" style={{ color: '#A1A9B6' }}>{s.label}</span>
            <div className="flex-1 h-2 rounded-full" style={{ background: '#F0F2F5' }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(s.count / maxCount) * 100}%`,
                  background: s.color,
                }}
              />
            </div>
            <span className="text-xs font-semibold w-4 text-right" style={{ color: '#4B4F55' }}>{s.count}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Stage badge colors ───────────────────────────────────────────────────────
const STAGE_STYLE: Record<string, { bg: string; text: string }> = {
  LOO:  { bg: '#FFF3E0', text: '#FCA600' },
  SPA:  { bg: '#E3F2FC', text: '#3D8FF4' },
  Loan: { bg: '#F3EEFF', text: '#8D54EA' },
  OC:   { bg: '#DAF3F2', text: '#1EC9C4' },
  VP:   { bg: '#FFF0F2', text: '#FF4F6C' },
};

// ─── Active Deals ─────────────────────────────────────────────────────────────
function ActiveDeals() {
  return (
    <Card className="col-span-2">
      <div className="flex items-center justify-between mb-4">
        <p className="font-semibold text-sm" style={{ color: '#4B4F55' }}>Active Deals</p>
        <button className="text-xs font-medium hover:underline" style={{ color: '#3D8FF4' }}>
          View all →
        </button>
      </div>
      <div className="space-y-2">
        {activeDeals.map((deal) => {
          const stageStyle = STAGE_STYLE[deal.stage] ?? { bg: '#F5F7FA', text: '#6F7B8A' };
          return (
            <div
              key={deal.id}
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#F5F7FA] transition-colors cursor-pointer"
            >
              {/* Dot */}
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ background: stageStyle.text }}
              />

              {/* Address */}
              <p className="flex-1 text-sm truncate" style={{ color: '#4B4F55' }}>{deal.address}</p>

              {/* Value */}
              <p className="text-sm font-semibold font-mono flex-shrink-0" style={{ color: '#2B3340' }}>
                {formatCurrency(deal.value)}
              </p>

              {/* Stage badge */}
              <span
                className="text-xs font-semibold px-2.5 py-0.5 rounded-full flex-shrink-0"
                style={{ background: stageStyle.bg, color: stageStyle.text }}
              >
                {deal.stage}
              </span>

              {/* Days */}
              <span className="text-xs w-8 text-right flex-shrink-0" style={{ color: '#A1A9B6' }}>
                {deal.daysInStage}d
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ─── Upcoming Tasks ───────────────────────────────────────────────────────────
function UpcomingTasks() {
  const urgentCount = upcomingTasks.filter((t) => t.urgent).length;
  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <p className="font-semibold text-sm" style={{ color: '#4B4F55' }}>Upcoming Tasks</p>
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ background: '#FFF0F2', color: '#FF4F6C' }}
        >
          {urgentCount} urgent
        </span>
      </div>
      <div className="space-y-2.5">
        {upcomingTasks.map((task) => (
          <div key={task.id} className="flex items-start gap-2.5 cursor-pointer group">
            {task.urgent ? (
              <AlertCircle size={15} className="flex-shrink-0 mt-0.5" style={{ color: '#FF4F6C' }} />
            ) : (
              <Square size={15} className="flex-shrink-0 mt-0.5" style={{ color: '#D1D5DB' }} />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm leading-snug group-hover:text-[#1EC9C4] transition-colors" style={{ color: '#4B4F55' }}>
                {task.text}
              </p>
              <p className="text-xs mt-0.5" style={{ color: '#A1A9B6' }}>{task.due}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  return (
    <div className="space-y-5">
      {/* Greeting */}
      <div>
        <h2 className="text-xl font-bold" style={{ color: '#2B3340' }}>
          Good morning, Ahmad 👋
        </h2>
        <p className="text-sm mt-0.5" style={{ color: '#A1A9B6' }}>
          You have {activeDeals.length} active deals and {upcomingTasks.filter((t) => t.urgent).length} urgent tasks today.
        </p>
      </div>

      {/* KPI Cards */}
      <KpiCards />

      {/* Charts + right column */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Commission chart — 2/3 width */}
        <div className="lg:col-span-2">
          <CommissionChart />
        </div>

        {/* Right column: Property Mix + Pipeline stacked */}
        <div className="flex flex-col gap-4">
          <PropertyMix />
          <PipelineStages />
        </div>
      </div>

      {/* Bottom row: Active Deals + Upcoming Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <ActiveDeals />
        </div>
        <UpcomingTasks />
      </div>
    </div>
  );
}
