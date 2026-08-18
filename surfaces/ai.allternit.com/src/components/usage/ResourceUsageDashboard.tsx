'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  DownloadSimple,
  ArrowsClockwise,
  ChatTeardropText,
  Hash,
  CurrencyDollar,
  House,
  Cloud,
  Calendar,
  Brain,
  UsersThree,
  ChartBar,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { gizziBaseUrl } from '@/lib/agents/api-config';

import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('ResourceUsageDashboard');

/**
 * True once the referenced element has a measurable box. ResponsiveContainer
 * warns ("width(-1) and height(-1) should be greater than 0") whenever a chart
 * mounts while its parent has no size — e.g. while the Settings modal that
 * hosts this dashboard is still animating in — so gate charts on real layout.
 */
function useHasSize(ref: React.RefObject<HTMLElement | null>): boolean {
  const [hasSize, setHasSize] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setHasSize(entry.contentRect.width > 0 && entry.contentRect.height > 0);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return hasSize;
}

// ── Gizzi usage summary (matches SessionUsage.UsageSummary from cmd/gizzi-code) ──

interface UsageTokens {
  input: number;
  output: number;
  reasoning: number;
  cache: { read: number; write: number };
}

interface UsageEntry {
  timestamp: number;
  sessionID: string;
  messageID: string;
  providerID: string;
  modelID: string;
  tokens: UsageTokens;
  cost: number;
}

interface DailyUsage {
  date: string; // YYYY-MM-DD
  providers: Record<string, { tokens: number; cost: number }>;
  models: Record<string, { tokens: number; cost: number }>;
  total: { tokens: number; cost: number; messages: number };
}

interface SessionUsageSummary {
  sessionID: string;
  startTime: number;
  endTime?: number;
  messageCount: number;
  total: { tokens: number; cost: number };
  byModel: Record<string, { tokens: number; cost: number }>;
  byProvider: Record<string, { tokens: number; cost: number }>;
}

interface UsageSummary {
  entries: UsageEntry[];
  daily: DailyUsage[];
  sessions: SessionUsageSummary[];
  grandTotal: { tokens: number; cost: number; messages: number; sessions: number };
}

const LOCAL_PROVIDERS = ['ollama', 'local-cli', 'llamacpp', 'lmstudio', 'lm-studio', 'gpt4all', 'local', 'subprocess'];

function isLocalProvider(providerID: string): boolean {
  const p = providerID.toLowerCase();
  return LOCAL_PROVIDERS.some((k) => p.includes(k));
}

function entryTokens(e: { tokens: UsageTokens }): number {
  return e.tokens.input + e.tokens.output + e.tokens.cache.read + e.tokens.cache.write;
}

const DAYS_FOR_RANGE: Record<'all' | '30d' | '7d', number> = { all: 365, '30d': 30, '7d': 7 };

export function ResourceUsageDashboard() {
  const [data, setData] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'all' | '30d' | '7d'>('30d');
  const dailyChartRef = useRef<HTMLDivElement>(null);
  const modelsChartRef = useRef<HTMLDivElement>(null);
  const dailyChartSized = useHasSize(dailyChartRef);
  const modelsChartSized = useHasSize(modelsChartRef);

  const fetchUsage = useCallback(async (range: 'all' | '30d' | '7d') => {
    setRefreshing(true);
    setError(null);
    try {
      const days = DAYS_FOR_RANGE[range];
      const res = await fetch(`${gizziBaseUrl()}/v1/global/usage?days=${days}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`gizzi /global/usage returned ${res.status}`);
      const summary = (await res.json()) as UsageSummary;
      setData(summary);
    } catch (err) {
      logger.error({ err }, 'Failed to fetch usage data');
      setError(err instanceof Error ? err.message : 'Failed to reach gizzi runtime');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchUsage(timeRange);
    const interval = setInterval(() => void fetchUsage(timeRange), 30000);
    return () => clearInterval(interval);
  }, [timeRange, fetchUsage]);

  const handleExport = async () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `allternit-usage-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Real derivations from the gizzi summary (no fabricated values).
  const derived = useMemo(() => {
    if (!data) return null;
    let localTokens = 0;
    let cloudTokens = 0;
    const byModel = new Map<string, number>();
    for (const e of data.entries) {
      const t = entryTokens(e);
      if (isLocalProvider(e.providerID)) localTokens += t;
      else cloudTokens += t;
      byModel.set(e.modelID, (byModel.get(e.modelID) ?? 0) + t);
    }
    const modelRows = Array.from(byModel.entries())
      .map(([name, tokens]) => ({ name, tokens }))
      .sort((a, b) => b.tokens - a.tokens);
    const topModel = modelRows[0]?.name ?? '—';
    const activeDays = data.daily.filter((d) => d.total.tokens > 0).length;
    const dailyAsc = [...data.daily].sort((a, b) => a.date.localeCompare(b.date));
    const peakDay = dailyAsc.reduce<DailyUsage | null>(
      (max, d) => (d.total.tokens > (max?.total.tokens ?? 0) ? d : max),
      null,
    );
    return { localTokens, cloudTokens, modelRows, topModel, activeDays, dailyAsc, peakDay };
  }, [data]);

  if (loading && !data) {
    return (
      <div className="p-12 flex justify-center">
        <div className="animate-spin rounded-full size-8 border-b-2 border-[var(--accent-primary)]" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="bg-[var(--bg-secondary)] p-6 rounded-2xl border border-[var(--border-subtle)] space-y-3">
        <div className="text-[13px] text-[var(--status-error)]">Usage data unavailable: {error}</div>
        <div className="text-[12px] text-[var(--text-tertiary)]">
          The gizzi runtime did not respond at {gizziBaseUrl()}. Start the desktop app or the gizzi-code server, then refresh.
        </div>
        <button type="button"
          onClick={() => void fetchUsage(timeRange)}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-sm font-medium"
        >
          <ArrowsClockwise size={16} /> Retry
        </button>
      </div>
    );
  }

  if (!data || !derived) return null;

  const { grandTotal } = data;

  return (
    <div className="bg-[var(--glass-bg)] backdrop-blur-md border border-[var(--border-subtle)] rounded-2xl font-sans overflow-hidden" style={{ maxHeight: 220 }}>
      <div className="flex flex-col h-full">
        {/* Top bar: title, key metrics, controls */}
        <div className="flex items-center gap-4 px-4 py-3 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
              <ChartBar size={18} weight="duotone" />
            </div>
            <div className="hidden sm:block">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Brain usage</h2>
              <p className="text-[11px] text-[var(--text-tertiary)]">Metered at the gizzi boundary</p>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              <MetricPill label="Sessions" value={grandTotal.sessions.toLocaleString()} icon={UsersThree} />
              <MetricPill label="Messages" value={grandTotal.messages.toLocaleString()} icon={ChatTeardropText} />
              <MetricPill label="Tokens" value={formatTokens(grandTotal.tokens)} icon={Hash} />
              <MetricPill label="Cost" value={formatCost(grandTotal.cost)} icon={CurrencyDollar} />
              <MetricPill label="Local" value={formatTokens(derived.localTokens)} icon={House} />
              <MetricPill label="Cloud" value={formatTokens(derived.cloudTokens)} icon={Cloud} />
              <MetricPill label="Days" value={derived.activeDays.toString()} icon={Calendar} />
              <MetricPill label="Top model" value={derived.topModel} icon={Brain} />
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button type="button"
              onClick={() => void fetchUsage(timeRange)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] text-xs font-medium transition-colors disabled:opacity-50"
            >
              <ArrowsClockwise size={14} className={refreshing ? 'animate-spin' : ''} />
              <span className="hidden md:inline">{refreshing ? 'Syncing…' : 'Refresh'}</span>
            </button>
            <button type="button"
              onClick={handleExport}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] text-xs font-medium transition-colors"
            >
              <DownloadSimple size={14} />
              <span className="hidden md:inline">Export</span>
            </button>
            <div className="flex bg-[var(--bg-primary)] p-0.5 rounded-lg border border-[var(--border-subtle)]">
              {(['all', '30d', '7d'] as const).map((range) => (
                <button type="button"
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={cn(
                    'px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors',
                    timeRange === range ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]',
                  )}
                >
                  {range === 'all' ? 'All' : range}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom row: side-by-side charts */}
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 min-h-0">
          {/* Daily tokens */}
          <div className="px-4 py-2.5 border-b sm:border-b-0 sm:border-r border-[var(--border-subtle)] flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-1.5 shrink-0">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Daily tokens</h3>
              {derived.peakDay && (
                <span className="text-[11px] text-[var(--text-tertiary)]">
                  Peak {derived.peakDay.date}: {formatTokens(derived.peakDay.total.tokens)}
                </span>
              )}
            </div>
            {derived.dailyAsc.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-[11px] text-[var(--text-tertiary)]">No usage recorded in this range yet.</div>
            ) : (
              <div ref={dailyChartRef} className="flex-1 min-h-0">
                {dailyChartSized && (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={derived.dailyAsc.map((d) => ({ date: d.date.slice(5), tokens: d.total.tokens }))} margin={{ left: -20, right: 0, top: 4, bottom: -4 }}>
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }} interval="preserveStartEnd" />
                      <YAxis hide />
                      <Tooltip cursor={{ fill: 'var(--surface-hover)' }} contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '8px' }} formatter={(v: any) => formatTokens(Number(v))} />
                      <Bar dataKey="tokens" fill="var(--accent-primary)" radius={[3, 3, 0, 0]} barSize={8} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}
          </div>

          {/* Top models */}
          <div className="px-4 py-2.5 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-1.5 shrink-0">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Top models</h3>
              {derived.modelRows.length > 0 && (
                <span className="text-[11px] text-[var(--text-tertiary)]">{derived.modelRows.length} model{derived.modelRows.length === 1 ? '' : 's'}</span>
              )}
            </div>
            {derived.modelRows.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-[11px] text-[var(--text-tertiary)]">No model usage yet.</div>
            ) : (
              <div ref={modelsChartRef} className="flex-1 min-h-0">
                {modelsChartSized && (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={derived.modelRows.slice(0, 5)} layout="vertical" margin={{ left: -20, right: 8, top: 4, bottom: -4 }}>
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }} width={100} />
                      <Tooltip cursor={{ fill: 'var(--surface-hover)' }} contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '8px' }} formatter={(v: any) => formatTokens(Number(v))} />
                      <Bar dataKey="tokens" fill="var(--accent-primary)" radius={[0, 3, 3, 0]} barSize={10} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricPill({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: React.ComponentType<Record<string, unknown>>;
}) {
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] shrink-0">
      {Icon ? (
        <div className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
          <Icon size={12} weight="duotone" />
        </div>
      ) : null}
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider font-medium text-[var(--text-tertiary)]">{label}</div>
        <div className="text-xs font-bold text-[var(--text-primary)] truncate" title={value}>
          {value}
        </div>
      </div>
    </div>
  );
}

function formatTokens(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
}

function formatCost(cost: number): string {
  if (cost === 0) return '$0.00';
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}
