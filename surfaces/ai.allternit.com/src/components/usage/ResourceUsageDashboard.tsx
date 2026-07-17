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
  TerminalWindow,
  DownloadSimple,
  ArrowsClockwise,
} from '@phosphor-icons/react';
import { useIsClient } from '@/lib/hooks/use-is-client';
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
  const isClient = useIsClient();
  const [data, setData] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
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
      if (isClient) {
        setLogs((prev) => [
          `[${new Date().toLocaleTimeString()}] Gizzi sync: ${summary.grandTotal.messages} messages · ${summary.grandTotal.sessions} sessions`,
          `[${new Date().toLocaleTimeString()}] Tokens (${range}): ${formatTokens(summary.grandTotal.tokens)} · cost ${formatCost(summary.grandTotal.cost)}`,
          ...prev,
        ].slice(0, 50));
      }
    } catch (err) {
      logger.error({ err }, 'Failed to fetch usage data');
      setError(err instanceof Error ? err.message : 'Failed to reach gizzi runtime');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isClient]);

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
    <div className="bg-[var(--bg-secondary)] p-6 rounded-2xl border border-[var(--border-subtle)] font-sans space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-[12px] text-[var(--text-tertiary)] uppercase tracking-widest font-bold">
          Brain usage · metered at the gizzi boundary
        </div>
        <div className="flex items-center gap-3">
          <button type="button"
            onClick={() => void fetchUsage(timeRange)}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] text-sm font-medium transition-colors disabled:opacity-50"
          >
            <ArrowsClockwise size={16} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          <button type="button"
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] text-sm font-medium transition-colors"
          >
            <DownloadSimple size={16} /> Export JSON
          </button>
          <div className="flex bg-[var(--bg-primary)] p-1 rounded-lg border border-[var(--border-subtle)]">
            {(['all', '30d', '7d'] as const).map((range) => (
              <button type="button"
                key={range}
                onClick={() => setTimeRange(range)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                  timeRange === range ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]',
                )}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid Stats — all real */}
      <div className="grid grid-cols-4 gap-3">
        <StatBlock label="Sessions" value={grandTotal.sessions.toLocaleString()} />
        <StatBlock label="Messages" value={grandTotal.messages.toLocaleString()} />
        <StatBlock label="Total tokens" value={formatTokens(grandTotal.tokens)} />
        <StatBlock label="Cost" value={formatCost(grandTotal.cost)} />
        <StatBlock label="Local tokens" value={formatTokens(derived.localTokens)} />
        <StatBlock label="Cloud tokens" value={formatTokens(derived.cloudTokens)} />
        <StatBlock label="Active days" value={derived.activeDays.toString()} />
        <StatBlock label="Top model" value={derived.topModel} />
      </div>

      {/* Daily tokens — real, replaces the random heatmap */}
      <div className="bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[var(--text-tertiary)] text-sm font-medium">Daily tokens</h3>
          {derived.peakDay && (
            <span className="text-[12px] text-[var(--text-tertiary)]">
              Peak {derived.peakDay.date}: {formatTokens(derived.peakDay.total.tokens)}
            </span>
          )}
        </div>
        {derived.dailyAsc.length === 0 ? (
          <div className="text-[12px] text-[var(--text-tertiary)] py-6 text-center">No usage recorded in this range yet.</div>
        ) : (
          <div ref={dailyChartRef} className="h-[140px]">
            {dailyChartSized && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={derived.dailyAsc.map((d) => ({ date: d.date.slice(5), tokens: d.total.tokens }))} margin={{ left: -20, right: 0, top: 0, bottom: 0 }}>
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis hide />
                <Tooltip cursor={{ fill: 'var(--surface-hover)' }} contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '8px' }} formatter={(v: any) => formatTokens(Number(v))} />
                <Bar dataKey="tokens" fill="var(--accent-primary)" radius={[4, 4, 0, 0]} barSize={10} />
              </BarChart>
            </ResponsiveContainer>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Top Models — real, replaces "Top Tools" tool-distribution fabrication */}
        <div className="bg-[var(--bg-primary)] border border-[var(--border-subtle)] p-4 rounded-xl">
          <h3 className="text-[var(--text-tertiary)] text-sm font-medium mb-4">Top models by tokens</h3>
          <div ref={modelsChartRef} className="h-[150px]">
            {derived.modelRows.length === 0 ? (
              <div className="text-[12px] text-[var(--text-tertiary)] py-6 text-center">No model usage yet.</div>
            ) : !modelsChartSized ? null : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={derived.modelRows.slice(0, 6)} layout="vertical" margin={{ left: -20, right: 0, top: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-tertiary)', fontSize: 12 }} width={110} />
                  <Tooltip cursor={{ fill: 'var(--surface-hover)' }} contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '8px' }} formatter={(v: any) => formatTokens(Number(v))} />
                  <Bar dataKey="tokens" fill="var(--accent-primary)" radius={[0, 4, 4, 0]} barSize={12} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Live Kernel Console — real sync lines */}
        <div className="bg-black p-4 rounded-xl border border-[var(--border-subtle)] font-mono flex flex-col">
          <div className="flex items-center justify-between mb-3 text-[var(--text-tertiary)] text-xs">
            <span className="flex items-center gap-2"><TerminalWindow size={14} /> Live Kernel</span>
            <span className="flex gap-1.5"><span className="size-2 rounded-full bg-red-500/50" /><span className="size-2 rounded-full bg-yellow-500/50" /><span className="size-2 rounded-full bg-green-500/50" /></span>
          </div>
          <div className="flex-1 overflow-y-auto text-xs space-y-1 text-[#666]">
            {logs.length === 0 && <div className="opacity-50">waiting for first sync…</div>}
            {logs.map((log, i) => (
              <div key={`resourceusagedashboard-${i}`} className={i === 0 ? 'text-[var(--accent-primary)]' : ''}>
                <span className="opacity-30">❯</span> {log}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--bg-primary)] border border-[var(--border-subtle)] p-4 rounded-xl flex flex-col justify-center min-w-0">
      <div className="text-[var(--text-tertiary)] text-sm mb-1">{label}</div>
      <div className="text-[var(--text-primary)] text-2xl font-bold truncate" title={value}>{value}</div>
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
