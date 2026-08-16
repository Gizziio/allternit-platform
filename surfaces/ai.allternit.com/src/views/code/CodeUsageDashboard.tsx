"use client";

import React, { useMemo, useState } from "react";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import {
  X,
  TerminalWindow,
  Hash,
  CurrencyDollar,
  Clock,
  Calendar,
  Fire,
  Lightning,
  Brain,
  Sun,
  Robot,
  ChartBar,
  CaretDown,
  CaretUp,
} from "@phosphor-icons/react";
import { useCodeSessionStore } from "./CodeSessionStore";

type RangeKey = "all" | "30d" | "7d";

interface HeatmapCell {
  date: string;
  count: number;
}

function estimateTokens(text: string): number {
  return Math.max(0, Math.ceil(text.length / 3.7));
}

function formatCompact(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toString();
}

function formatCurrency(value: number): string {
  if (value === 0) return "$0.00";
  if (value < 0.01) return `<$0.01`;
  return `$${value.toFixed(2)}`;
}

function formatDuration(minutes: number): string {
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${Math.floor(hours / 24)}d ${Math.round(hours % 24)}h`;
}

function toDateKey(input: string): string {
  return new Date(input).toISOString().slice(0, 10);
}

function buildDateSeries(totalDays: number): string[] {
  const result: string[] = [];
  const today = new Date();
  for (let index = totalDays - 1; index >= 0; index -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - index);
    result.push(date.toISOString().slice(0, 10));
  }
  return result;
}

function getStreaks(activeDates: string[]): { current: number; longest: number } {
  if (activeDates.length === 0) {
    return { current: 0, longest: 0 };
  }
  const sorted = [...new Set(activeDates)].sort();
  let longest = 1;
  let currentRun = 1;
  for (let index = 1; index < sorted.length; index += 1) {
    const prev = new Date(sorted[index - 1]);
    const next = new Date(sorted[index]);
    const diffDays = Math.round((next.getTime() - prev.getTime()) / 86_400_000);
    if (diffDays === 1) {
      currentRun += 1;
      longest = Math.max(longest, currentRun);
    } else {
      currentRun = 1;
    }
  }
  const today = new Date();
  let current = 0;
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    const date = new Date(sorted[index]);
    const expected = new Date(today);
    expected.setDate(today.getDate() - current);
    if (date.toISOString().slice(0, 10) === expected.toISOString().slice(0, 10)) {
      current += 1;
    } else {
      break;
    }
  }
  return { current, longest };
}

function getRangeStart(range: RangeKey): Date | null {
  const today = new Date();
  if (range === "7d") {
    today.setDate(today.getDate() - 6);
    return today;
  }
  if (range === "30d") {
    today.setDate(today.getDate() - 29);
    return today;
  }
  return null;
}

const TOKEN_BUDGET = 500_000;
const COST_PER_1K_TOKENS = 0.003;
const MINUTES_PER_MESSAGE = 0.75;

export function CodeUsageDashboard({ onClose }: { onClose?: () => void }) {
  const sessions = useCodeSessionStore((state) => state.sessions);
  const [range, setRange] = useState<RangeKey>("all");
  const [expanded, setExpanded] = useState(false);

  const filteredSessions = useMemo(() => {
    const start = getRangeStart(range);
    if (!start) return sessions;
    return sessions.filter((session) => new Date(session.updatedAt) >= start);
  }, [range, sessions]);

  const metrics = useMemo(() => {
    const activeDates: string[] = [];
    const dateCount = new Map<string, number>();
    const modelCount = new Map<string, number>();
    const hourCount = new Map<number, number>();
    let messageTotal = 0;
    let tokenTotal = 0;
    let assistantMessages = 0;

    for (const session of filteredSessions) {
      const metadata = session.metadata as typeof session.metadata & { runtimeModel?: string };
      const dateKey = toDateKey(session.updatedAt || session.createdAt);
      activeDates.push(dateKey);
      dateCount.set(dateKey, (dateCount.get(dateKey) ?? 0) + Math.max(session.messageCount, 1));

      const runtimeModel =
        typeof metadata.runtimeModel === "string" && metadata.runtimeModel.length > 0
          ? metadata.runtimeModel
          : metadata.agentName ?? null;
      if (runtimeModel) {
        modelCount.set(runtimeModel, (modelCount.get(runtimeModel) ?? 0) + 1);
      }

      const hour = new Date(session.updatedAt || session.createdAt).getHours();
      hourCount.set(hour, (hourCount.get(hour) ?? 0) + Math.max(session.messageCount, 1));

      messageTotal += session.messages.length > 0 ? session.messages.length : session.messageCount;
      tokenTotal += session.messages.reduce(
        (sum, message) => sum + estimateTokens(message.content) + estimateTokens(message.thinking ?? ""),
        0,
      );
      assistantMessages += session.messages.filter((m) => m.role === "assistant").length;
      if (session.messages.length === 0) {
        tokenTotal += estimateTokens(session.name) * Math.max(session.messageCount, 1);
      }
    }

    const heatmap: HeatmapCell[] = buildDateSeries(30).map((date) => ({
      date,
      count: dateCount.get(date) ?? 0,
    }));
    const streaks = getStreaks(activeDates);
    const favoriteModel = [...modelCount.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
    const peakHour = filteredSessions.length > 0
      ? [...hourCount.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null
      : null;
    const estimatedCost = tokenTotal * (COST_PER_1K_TOKENS / 1000);
    const activeMinutes = messageTotal * MINUTES_PER_MESSAGE;
    const budgetUsed = Math.min(100, Math.round((tokenTotal / TOKEN_BUDGET) * 100));

    return {
      sessions: filteredSessions.length,
      messages: messageTotal,
      tokens: tokenTotal,
      assistantMessages,
      activeDays: new Set(activeDates).size,
      streaks,
      favoriteModel,
      peakHour,
      heatmap,
      modelRows: [...modelCount.entries()].sort((left, right) => right[1] - left[1]).slice(0, 5),
      estimatedCost,
      activeMinutes,
      budgetUsed,
      avgTokensPerMessage: messageTotal > 0 ? Math.round(tokenTotal / messageTotal) : 0,
    };
  }, [filteredSessions]);

  const maxHeat = Math.max(1, ...metrics.heatmap.map((cell) => cell.count));

  return (
    <div
      data-testid="code-usage-dashboard"
      className="w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] shadow-lg overflow-hidden"
      style={{ boxShadow: "var(--shadow-lg)" }}
    >
      {/* Compact horizontal usage bar */}
      <div className="flex items-center gap-3 p-2.5">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--accent-code)]/10 text-[var(--accent-code)]">
          <ChartBar size={20} weight="duotone" />
        </div>
        <div className="min-w-0 hidden sm:block">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Code usage</h2>
          <p className="text-[11px] text-[var(--text-tertiary)] truncate">
            {range === "all" ? "All-time activity" : `Last ${range}`}
          </p>
        </div>

        <div className="ml-auto flex items-center gap-2 min-w-0">
          <div className="hidden md:flex items-center gap-2">
            <MiniStat value={metrics.sessions.toLocaleString()} label="Sessions" />
            <MiniStat value={formatCompact(metrics.tokens)} label="Tokens" />
            <MiniStat value={formatCurrency(metrics.estimatedCost)} label="Cost" />
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <div className="flex bg-[var(--bg-primary)] p-0.5 rounded-lg border border-[var(--border-subtle)]">
              {(["all", "30d", "7d"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setRange(item)}
                  className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                    range === item
                      ? "bg-[var(--bg-tertiary)] text-[var(--text-primary)]"
                      : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {item === "all" ? "All" : item}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-label={expanded ? "Show less" : "Show more"}
              title={expanded ? "Show less" : "Show more"}
              className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
            >
              {expanded ? <CaretUp size={14} /> : <CaretDown size={14} />}
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close usage"
                title="Close usage"
                className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3">
          {/* Progress strip */}
          <div className="mb-3">
            <div className="flex items-center justify-between gap-3 text-[11px] text-[var(--text-tertiary)] mb-1.5">
              <span>
                {formatCompact(metrics.tokens)} of {formatCompact(TOKEN_BUDGET)} tokens
              </span>
              <span className="text-[var(--text-primary)] font-semibold">{metrics.budgetUsed}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${metrics.budgetUsed}%`,
                  backgroundColor: metrics.budgetUsed >= 90 ? "var(--status-error)" : "var(--accent-code)",
                }}
              />
            </div>
          </div>

          {/* Stat grid */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            <StatCard label="Sessions" value={metrics.sessions.toLocaleString()} icon={TerminalWindow} tone="code" />
            <StatCard label="Messages" value={metrics.messages.toLocaleString()} icon={Hash} tone="code" />
            <StatCard label="Total tokens" value={formatCompact(metrics.tokens)} icon={Hash} tone="code" />
            <StatCard label="Est. cost" value={formatCurrency(metrics.estimatedCost)} icon={CurrencyDollar} tone="code" />
            <StatCard label="Active time" value={formatDuration(metrics.activeMinutes)} icon={Clock} tone="code" />
            <StatCard label="Active days" value={metrics.activeDays.toString()} icon={Calendar} tone="code" />
            <StatCard label="Current streak" value={`${metrics.streaks.current}d`} icon={Fire} tone="warning" />
            <StatCard label="Longest streak" value={`${metrics.streaks.longest}d`} icon={Lightning} tone="warning" />
          </div>

          {/* Heatmap */}
          <div className="mt-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--text-primary)]">Last 30 days</span>
              <span className="text-[11px] text-[var(--text-tertiary)]">
                {metrics.tokens >= 576_000 ? (
                  <>
                    ~{Math.round(metrics.tokens / 576_000)}× <em>Lord of the Rings</em>
                  </>
                ) : metrics.tokens > 0 ? (
                  <>
                    {formatCompact(metrics.tokens)} tokens across {metrics.sessions} session{metrics.sessions === 1 ? "" : "s"}
                  </>
                ) : (
                  "Send a message to start tracking usage"
                )}
              </span>
            </div>

            <div className="grid grid-cols-[repeat(30,minmax(0,1fr))] gap-1">
              {metrics.heatmap.map((cell) => {
                const ratio = cell.count / maxHeat;
                const background =
                  ratio === 0
                    ? "var(--bg-tertiary)"
                    : ratio < 0.34
                      ? `color-mix(in srgb, var(--accent-code) 35%, var(--bg-tertiary))`
                      : ratio < 0.67
                        ? `color-mix(in srgb, var(--accent-code) 65%, var(--bg-tertiary))`
                        : "var(--accent-code)";
                return (
                  <div
                    key={cell.date}
                    title={`${cell.date}: ${cell.count} messages`}
                    className="w-full rounded-sm transition-transform hover:scale-110"
                    style={{ aspectRatio: "1 / 2", background }}
                  />
                );
              })}
            </div>

            <div className="mt-2 flex items-center justify-end gap-2 text-[11px] text-[var(--text-tertiary)]">
              <span>Less</span>
              {[0.15, 0.4, 0.65, 1].map((r) => (
                <div
                  key={r}
                  className="h-2 w-2 rounded-sm"
                  style={{
                    background:
                      r === 0.15
                        ? "var(--bg-tertiary)"
                        : `color-mix(in srgb, var(--accent-code) ${Math.round(r * 100)}%, var(--bg-tertiary))`,
                  }}
                />
              ))}
              <span>More</span>
            </div>
          </div>

          {/* Secondary insights */}
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <InsightCard label="Favorite model" value={metrics.favoriteModel ?? "—"} icon={Brain} />
            <InsightCard
              label="Peak hour"
              value={metrics.peakHour === null ? "—" : `${metrics.peakHour % 12 || 12} ${metrics.peakHour >= 12 ? "PM" : "AM"}`}
              icon={Sun}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-start px-2 py-1 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)]">
      <span className="text-xs font-bold text-[var(--text-primary)]">{value}</span>
      <span className="text-[9px] uppercase tracking-wider text-[var(--text-tertiary)]">{label}</span>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone = "code",
}: {
  label: string;
  value: string;
  icon?: PhosphorIcon;
  tone?: "code" | "warning" | "neutral";
}) {
  const accentVar = tone === "code" ? "var(--accent-code)" : tone === "warning" ? "var(--status-warning)" : "var(--accent-primary)";
  return (
    <div className="group relative overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2.5 transition-colors hover:border-[var(--border-hover)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-medium text-[var(--text-tertiary)]">{label}</div>
          <div className="mt-0.5 text-base font-bold text-[var(--text-primary)] truncate" title={value}>
            {value}
          </div>
        </div>
        {Icon ? (
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={{ background: `${accentVar}14`, color: accentVar }}>
            <Icon size={14} weight="duotone" />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function InsightCard({ label, value, icon: Icon }: { label: string; value: string; icon?: PhosphorIcon }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2">
      {Icon ? (
        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
          <Icon size={14} weight="duotone" />
        </div>
      ) : null}
      <div className="min-w-0">
        <div className="text-[11px] text-[var(--text-tertiary)]">{label}</div>
        <div className="truncate text-xs font-semibold text-[var(--text-primary)]" title={value}>
          {value}
        </div>
      </div>
    </div>
  );
}
