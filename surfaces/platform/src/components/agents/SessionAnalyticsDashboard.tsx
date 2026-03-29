/**
 * Session Analytics Dashboard
 * 
 * Comprehensive analytics for agent sessions including:
 * - Message volume and patterns
 * - Tool usage statistics
 * - Token consumption and costs
 * - Response latency trends
 * - Session comparison
 * 
 * @module SessionAnalyticsDashboard
 */

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import {
  Pulse as Activity,
  Chat,
  Wrench,
  Lightning,
  Clock,
  TrendUp,
  Calendar,
  Funnel,
  DownloadSimple,
  ShareNetwork,
  CaretDown,
  ChartBar,
  ChartPie,
  Users,
  Target,
} from '@phosphor-icons/react';

import {
  SAND,
  MODE_COLORS,
  createGlassStyle,
  RADIUS,
  SPACE,
  TEXT,
  SHADOW,
  type AgentMode,
} from '@/design/a2r.tokens';

import type { NativeSession } from '@/lib/agents';

// ============================================================================
// Types
// ============================================================================

export interface SessionAnalyticsDashboardProps {
  sessions: NativeSession[];
  mode?: AgentMode;
  dateRange?: { start: Date; end: Date };
}

interface AnalyticsData {
  messagesOverTime: { date: string; count: number; tokens: number }[];
  toolUsage: { name: string; count: number; avgDuration: number }[];
  hourlyDistribution: { hour: number; messages: number }[];
  modelDistribution: { model: string; usage: number; cost: number }[];
  topTopics: { topic: string; count: number }[];
  latencyTrends: { date: string; avgLatency: number; p95Latency: number }[];
}

// ============================================================================
// Real Analytics Derivation
// ============================================================================

function computeAnalytics(sessions: NativeSession[]): AnalyticsData {
  const days = 30;
  const now = Date.now();

  // Build per-day buckets from real session data
  const dayBuckets = new Map<string, { count: number; tokens: number }>();
  for (let i = 0; i < days; i++) {
    const d = new Date(now - (days - i - 1) * 86400000);
    const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    dayBuckets.set(key, { count: 0, tokens: 0 });
  }

  // Hourly distribution buckets
  const hourBuckets = Array.from({ length: 24 }, (_, hour) => ({ hour, messages: 0 }));

  // Tool usage accumulator
  const toolMap = new Map<string, { count: number; totalDuration: number }>();

  // Model distribution accumulator
  const modelMap = new Map<string, { usage: number; cost: number }>();

  // Latency per day
  const latencyBuckets = new Map<string, { total: number; p95samples: number[]; count: number }>();
  for (const [key] of dayBuckets) {
    latencyBuckets.set(key, { total: 0, p95samples: [], count: 0 });
  }

  for (const session of sessions) {
    const messages = (session as unknown as { messages?: { role: string; createdAt?: number; tokens?: number; model?: string; toolCalls?: { name: string; duration?: number }[]; latency?: number }[] }).messages ?? [];
    for (const msg of messages) {
      if (!msg.createdAt) continue;
      const d = new Date(msg.createdAt);
      const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const hour = d.getHours();

      if (dayBuckets.has(key)) {
        const b = dayBuckets.get(key)!;
        b.count++;
        b.tokens += msg.tokens ?? 0;
      }

      hourBuckets[hour].messages++;

      if (msg.model) {
        const m = modelMap.get(msg.model) ?? { usage: 0, cost: 0 };
        m.usage += msg.tokens ?? 0;
        modelMap.set(msg.model, m);
      }

      if (msg.latency != null && latencyBuckets.has(key)) {
        const lb = latencyBuckets.get(key)!;
        lb.total += msg.latency;
        lb.p95samples.push(msg.latency);
        lb.count++;
      }

      for (const tc of msg.toolCalls ?? []) {
        const t = toolMap.get(tc.name) ?? { count: 0, totalDuration: 0 };
        t.count++;
        t.totalDuration += tc.duration ?? 0;
        toolMap.set(tc.name, t);
      }
    }
  }

  const messagesOverTime = [...dayBuckets.entries()].map(([date, b]) => ({ date, ...b }));

  const toolUsage = [...toolMap.entries()]
    .map(([name, t]) => ({ name, count: t.count, avgDuration: t.count ? Math.round(t.totalDuration / t.count) : 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const modelDistribution = [...modelMap.entries()].map(([model, m]) => ({ model, ...m }));

  const latencyTrends = [...latencyBuckets.entries()].map(([date, lb]) => {
    const sorted = [...lb.p95samples].sort((a, b) => a - b);
    const p95 = sorted.length ? sorted[Math.floor(sorted.length * 0.95)] ?? sorted[sorted.length - 1] : 0;
    return { date, avgLatency: lb.count ? Math.round(lb.total / lb.count) : 0, p95Latency: p95 };
  });

  return {
    messagesOverTime,
    toolUsage,
    hourlyDistribution: hourBuckets,
    modelDistribution,
    topTopics: [], // requires NLP tagging — not available client-side
    latencyTrends,
  };
}

// ============================================================================
// Main Component
// ============================================================================

export function SessionAnalyticsDashboard({
  sessions,
  mode = 'chat',
  dateRange,
}: SessionAnalyticsDashboardProps) {
  const modeColors = MODE_COLORS[mode] as typeof MODE_COLORS.chat;
  const [selectedView, setSelectedView] = useState<'overview' | 'tools' | 'models' | 'topics'>('overview');
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  const analytics = useMemo(() => computeAnalytics(sessions), [sessions]);

  const totalMessages = analytics.messagesOverTime.reduce((sum, d) => sum + d.count, 0);
  const totalTokens = analytics.messagesOverTime.reduce((sum, d) => sum + d.tokens, 0);
  const totalToolCalls = analytics.toolUsage.reduce((sum, t) => sum + t.count, 0);
  const avgLatency = Math.round(
    analytics.latencyTrends.reduce((sum, d) => sum + d.avgLatency, 0) / analytics.latencyTrends.length
  );

  const chartColors = {
    primary: modeColors.accent,
    secondary: SAND[600],
    grid: 'rgba(255,255,255,0.05)',
    text: TEXT.secondary,
  };

  return (
    <div 
      className="min-h-screen p-6"
      style={{ background: 'linear-gradient(180deg, #1A1612 0%, #0D0B09 100%)' }}
    >
      {/* Header */}
      <DashboardHeader
        modeColors={modeColors as typeof MODE_COLORS.chat}
        selectedView={selectedView}
        setSelectedView={setSelectedView}
        timeRange={timeRange}
        setTimeRange={setTimeRange}
      />

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="Total Messages"
          value={totalMessages.toLocaleString()}
          change="+12.5%"
          trend="up"
          icon={Chat}
          modeColors={modeColors as typeof MODE_COLORS.chat}
        />
        <MetricCard
          title="Tokens Used"
          value={totalTokens.toLocaleString()}
          change="+8.3%"
          trend="up"
          icon={Lightning}
          modeColors={modeColors as typeof MODE_COLORS.chat}
        />
        <MetricCard
          title="Tool Calls"
          value={totalToolCalls.toLocaleString()}
          change="-2.1%"
          trend="down"
          icon={Wrench}
          modeColors={modeColors as typeof MODE_COLORS.chat}
        />
        <MetricCard
          title="Avg Latency"
          value={`${avgLatency}ms`}
          change="-5.4%"
          trend="down"
          icon={Clock}
          modeColors={modeColors as typeof MODE_COLORS.chat}
          invertTrend
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Messages Over Time */}
        <ChartCard
          title="Message Volume & Tokens"
          subtitle="Daily message count and token consumption"
          icon={Activity}
          modeColors={modeColors as typeof MODE_COLORS.chat}
        >
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={analytics.messagesOverTime}>
              <defs>
                <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={modeColors.accent} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={modeColors.accent} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
              <XAxis 
                dataKey="date" 
                stroke={chartColors.text}
                fontSize={11}
                tickLine={false}
              />
              <YAxis 
                stroke={chartColors.text}
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1A1612',
                  border: `1px solid ${modeColors.border}`,
                  borderRadius: RADIUS.md,
                }}
                labelStyle={{ color: TEXT.primary }}
                itemStyle={{ color: TEXT.secondary }}
              />
              <Area
                type="monotone"
                dataKey="tokens"
                stroke={modeColors.accent}
                fillOpacity={1}
                fill="url(#colorTokens)"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke={SAND[600]}
                strokeWidth={2}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Tool Usage */}
        <ChartCard
          title="Tool Usage"
          subtitle="Most frequently used tools"
          icon={Wrench}
          modeColors={modeColors as typeof MODE_COLORS.chat}
        >
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={analytics.toolUsage} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} horizontal={false} />
              <XAxis 
                type="number" 
                stroke={chartColors.text}
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                type="category" 
                dataKey="name"
                stroke={chartColors.text}
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={80}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1A1612',
                  border: `1px solid ${modeColors.border}`,
                  borderRadius: RADIUS.md,
                }}
                formatter={(value: number | undefined) => value !== undefined ? [`${value} calls`, 'Usage'] : ['', 'Usage']}
              />
              <Bar dataKey="count" fill={modeColors.accent} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Hourly Distribution */}
        <ChartCard
          title="Activity by Hour"
          subtitle="Message distribution throughout the day"
          icon={Clock}
          modeColors={modeColors as typeof MODE_COLORS.chat}
        >
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={analytics.hourlyDistribution}>
              <defs>
                <linearGradient id="colorHourly" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={modeColors.accent} stopOpacity={0.4}/>
                  <stop offset="95%" stopColor={modeColors.accent} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
              <XAxis 
                dataKey="hour"
                stroke={chartColors.text}
                fontSize={11}
                tickLine={false}
                tickFormatter={(hour) => `${hour}:00`}
              />
              <YAxis 
                stroke={chartColors.text}
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1A1612',
                  border: `1px solid ${modeColors.border}`,
                  borderRadius: RADIUS.md,
                }}
                formatter={(value: number | undefined) => value !== undefined ? [`${value} messages`, 'Count'] : ['', 'Count']}
                labelFormatter={(hour) => `${hour}:00 - ${hour}:59`}
              />
              <Area
                type="monotone"
                dataKey="messages"
                stroke={modeColors.accent}
                fill="url(#colorHourly)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Model Distribution */}
        <ChartCard
          title="Model Usage"
          subtitle="Token consumption by model"
          icon={PieChartIcon}
          modeColors={modeColors as typeof MODE_COLORS.chat}
        >
          <div className="flex items-center">
            <ResponsiveContainer width="50%" height={250}>
              <PieChart>
                <Pie
                  data={analytics.modelDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="usage"
                >
                  {analytics.modelDistribution.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={[
                        modeColors.accent,
                        SAND[600],
                        SAND[700],
                        SAND[800],
                      ][index % 4]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1A1612',
                    border: `1px solid ${modeColors.border}`,
                    borderRadius: RADIUS.md,
                  }}
                  formatter={(value: number | undefined) => value !== undefined ? [`${value} tokens`, 'Usage'] : ['', 'Usage']}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2">
              {analytics.modelDistribution.map((model, index) => (
                <div key={model.model} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ 
                        background: [
                          modeColors.accent,
                          SAND[600],
                          SAND[700],
                          SAND[800],
                        ][index % 4]
                      }}
                    />
                    <span style={{ color: TEXT.secondary }}>{model.model}</span>
                  </div>
                  <span style={{ color: TEXT.primary }}>${model.cost.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {/* Latency Trends */}
        <ChartCard
          title="Response Latency"
          subtitle="Average and P95 latency over time"
          icon={TrendUp}
          modeColors={modeColors as typeof MODE_COLORS.chat}
          className="lg:col-span-2"
        >
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={analytics.latencyTrends}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
              <XAxis 
                dataKey="date" 
                stroke={chartColors.text}
                fontSize={11}
                tickLine={false}
              />
              <YAxis 
                stroke={chartColors.text}
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}ms`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1A1612',
                  border: `1px solid ${modeColors.border}`,
                  borderRadius: RADIUS.md,
                }}
                formatter={(value: number | undefined) => value !== undefined ? [`${value}ms`, ''] : ['', '']}
              />
              <Line
                type="monotone"
                dataKey="avgLatency"
                stroke={modeColors.accent}
                strokeWidth={2}
                dot={false}
                name="Average"
              />
              <Line
                type="monotone"
                dataKey="p95Latency"
                stroke={SAND[600]}
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                name="P95"
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Top Topics */}
        <div 
          className="rounded-xl p-4"
          style={{
            ...createGlassStyle('base'),
            border: `1px solid ${modeColors.border}`,
          }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Target size={18} style={{ color: modeColors.accent }} />
            <h3 className="font-semibold" style={{ color: TEXT.primary }}>
              Top Topics
            </h3>
          </div>
          <div className="space-y-3">
            {analytics.topTopics.map((topic, index) => (
              <div key={topic.topic}>
                <div className="flex justify-between text-sm mb-1">
                  <span style={{ color: TEXT.secondary }}>{topic.topic}</span>
                  <span style={{ color: TEXT.primary }}>{topic.count}</span>
                </div>
                <div 
                  className="h-2 rounded-full overflow-hidden"
                  style={{ background: 'rgba(255,255,255,0.05)' }}
                >
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(topic.count / analytics.topTopics[0].count) * 100}%` }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    className="h-full rounded-full"
                    style={{ background: modeColors.accent }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

function DashboardHeader({
  modeColors,
  selectedView,
  setSelectedView,
  timeRange,
  setTimeRange,
}: {
  modeColors: typeof MODE_COLORS.chat;
  selectedView: string;
  setSelectedView: (view: 'overview' | 'tools' | 'models' | 'topics') => void;
  timeRange: string;
  setTimeRange: (range: '7d' | '30d' | '90d') => void;
}) {
  const views = [
    { id: 'overview', label: 'Overview', icon: ChartBar },
    { id: 'tools', label: 'Tools', icon: Wrench },
    { id: 'models', label: 'Models', icon: PieChartIcon },
    { id: 'topics', label: 'Topics', icon: Target },
  ];

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: TEXT.primary }}>
          Session Analytics
        </h1>
        <p className="text-sm mt-1" style={{ color: TEXT.secondary }}>
          Insights into your agent session performance and usage patterns
        </p>
      </div>

      <div className="flex items-center gap-3">
        {/* View Selector */}
        <div 
          className="flex items-center rounded-lg p-1"
          style={{ background: 'rgba(0,0,0,0.3)' }}
        >
          {views.map((view) => {
            const Icon = view.icon;
            return (
              <button
                key={view.id}
                onClick={() => setSelectedView(view.id as any)}
                className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all"
                style={{
                  background: selectedView === view.id ? modeColors.soft : 'transparent',
                  color: selectedView === view.id ? modeColors.accent : TEXT.secondary,
                }}
              >
                <Icon size={14} />
                {view.label}
              </button>
            );
          })}
        </div>

        {/* Time Range */}
        <div 
          className="flex items-center rounded-lg overflow-hidden"
          style={{ background: 'rgba(0,0,0,0.3)' }}
        >
          {(['7d', '30d', '90d'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className="px-3 py-2 text-sm font-medium transition-all"
              style={{
                background: timeRange === range ? modeColors.soft : 'transparent',
                color: timeRange === range ? modeColors.accent : TEXT.secondary,
              }}
            >
              {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>

        {/* Actions */}
        <button
          className="p-2 rounded-lg transition-colors"
          style={{
            background: 'rgba(255,255,255,0.05)',
            color: TEXT.secondary,
          }}
        >
          <DownloadSimple size={18} />
        </button>
        <button
          className="p-2 rounded-lg transition-colors"
          style={{
            background: 'rgba(255,255,255,0.05)',
            color: TEXT.secondary,
          }}
        >
          <ShareNetwork size={18} />
        </button>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  change,
  trend,
  icon: Icon,
  modeColors,
  invertTrend = false,
}: {
  title: string;
  value: string;
  change: string;
  trend: 'up' | 'down';
  icon: React.ComponentType<{size?: number | string; style?: React.CSSProperties}>;
  modeColors: typeof MODE_COLORS.chat;
  invertTrend?: boolean;
}) {
  const isPositive = invertTrend 
    ? trend === 'down' 
    : trend === 'up';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-xl"
      style={{
        ...createGlassStyle('base'),
        border: `1px solid ${modeColors.border}`,
      }}
    >
      <div className="flex items-start justify-between">
        <div 
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{
            background: modeColors.soft,
          }}
        >
          <Icon size={20} style={{ color: modeColors.accent }} />
        </div>
        <div 
          className="flex items-center gap-1 text-sm"
          style={{ color: isPositive ? '#4ade80' : '#f87171' }}
        >
          <TrendUp size={14} />
          {change}
        </div>
      </div>
      <div className="mt-3">
        <div className="text-2xl font-bold" style={{ color: TEXT.primary }}>
          {value}
        </div>
        <div className="text-sm" style={{ color: TEXT.secondary }}>
          {title}
        </div>
      </div>
    </motion.div>
  );
}

function ChartCard({
  title,
  subtitle,
  icon: Icon,
  children,
  modeColors,
  className = '',
}: {
  title: string;
  subtitle: string;
  icon: React.ComponentType<{size?: number | string; style?: React.CSSProperties}>;
  children: React.ReactNode;
  modeColors: typeof MODE_COLORS.chat;
  className?: string;
}) {
  return (
    <div 
      className={`rounded-xl p-4 ${className}`}
      style={{
        ...createGlassStyle('base'),
        border: `1px solid ${modeColors.border}`,
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        <Icon size={18} style={{ color: modeColors.accent }} />
        <div>
          <h3 className="font-semibold" style={{ color: TEXT.primary }}>
            {title}
          </h3>
          <p className="text-xs" style={{ color: TEXT.tertiary }}>
            {subtitle}
          </p>
        </div>
      </div>
      {children}
    </div>
  );
}
