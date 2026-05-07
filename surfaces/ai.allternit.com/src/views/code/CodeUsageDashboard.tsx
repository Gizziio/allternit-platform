"use client";

import React, { useMemo, useState } from 'react';
import { useCodeSessionStore } from './CodeSessionStore';

type RangeKey = 'all' | '30d' | '7d';

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
    return `${(value / 1_000).toFixed(1)}k`;
  }
  return value.toString();
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
  if (range === '7d') {
    today.setDate(today.getDate() - 6);
    return today;
  }
  if (range === '30d') {
    today.setDate(today.getDate() - 29);
    return today;
  }
  return null;
}

export function CodeUsageDashboard() {
  const sessions = useCodeSessionStore((state) => state.sessions);
  const [activeTab, setActiveTab] = useState<'overview' | 'models'>('overview');
  const [range, setRange] = useState<RangeKey>('all');

  const filteredSessions = useMemo(() => {
    const start = getRangeStart(range);
    if (!start) {
      return sessions;
    }
    return sessions.filter((session) => new Date(session.updatedAt) >= start);
  }, [range, sessions]);

  const metrics = useMemo(() => {
    const activeDates: string[] = [];
    const dateCount = new Map<string, number>();
    const modelCount = new Map<string, number>();
    const hourCount = new Map<number, number>();
    let messageTotal = 0;
    let tokenTotal = 0;

    for (const session of filteredSessions) {
      const metadata = session.metadata as typeof session.metadata & { runtimeModel?: string };
      const dateKey = toDateKey(session.updatedAt || session.createdAt);
      activeDates.push(dateKey);
      dateCount.set(dateKey, (dateCount.get(dateKey) ?? 0) + Math.max(session.messageCount, 1));

      const runtimeModel =
        typeof metadata.runtimeModel === 'string'
          ? metadata.runtimeModel
          : metadata.agentName ?? 'Sonnet 4.6';
      modelCount.set(runtimeModel, (modelCount.get(runtimeModel) ?? 0) + 1);

      const hour = new Date(session.updatedAt || session.createdAt).getHours();
      hourCount.set(hour, (hourCount.get(hour) ?? 0) + Math.max(session.messageCount, 1));

      messageTotal += session.messages.length > 0 ? session.messages.length : session.messageCount;
      tokenTotal += session.messages.reduce(
        (sum, message) => sum + estimateTokens(message.content) + estimateTokens(message.thinking ?? ''),
        0,
      );
      if (session.messages.length === 0) {
        tokenTotal += estimateTokens(session.name) * Math.max(session.messageCount, 1);
      }
    }

    const heatmap: HeatmapCell[] = buildDateSeries(140).map((date) => ({
      date,
      count: dateCount.get(date) ?? 0,
    }));
    const streaks = getStreaks(activeDates);
    const favoriteModel = [...modelCount.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? 'Sonnet 4.6';
    const peakHour = [...hourCount.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? 15;

    return {
      sessions: filteredSessions.length,
      messages: messageTotal,
      tokens: tokenTotal,
      activeDays: new Set(activeDates).size,
      streaks,
      favoriteModel,
      peakHour,
      heatmap,
      modelRows: [...modelCount.entries()].sort((left, right) => right[1] - left[1]).slice(0, 5),
    };
  }, [filteredSessions]);

  const maxHeat = Math.max(1, ...metrics.heatmap.map((cell) => cell.count));

  return (
    <div
      data-testid="code-usage-dashboard"
      style={{
        minWidth: 520,
        maxWidth: 520,
        borderRadius: 14,
        border: '1px solid rgba(255,255,255,0.08)',
        background: '#1f1f1f',
        boxShadow: '0 18px 48px rgba(0,0,0,0.32)',
        padding: 12,
        color: 'var(--text-primary)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'inline-flex', gap: 6 }}>
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'models', label: 'Models' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as 'overview' | 'models')}
              style={{
                border: 'none',
                borderRadius: 6,
                padding: '6px 10px',
                background: activeTab === tab.id ? 'rgba(255,255,255,0.1)' : 'transparent',
                color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'inline-flex', gap: 6 }}>
          {(['all', '30d', '7d'] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setRange(item)}
              style={{
                border: 'none',
                borderRadius: 6,
                padding: '6px 10px',
                background: range === item ? 'rgba(255,255,255,0.1)' : 'transparent',
                color: range === item ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'overview' ? (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: 4,
              marginTop: 12,
            }}
          >
            <MetricCard label="Sessions" value={metrics.sessions.toString()} />
            <MetricCard label="Messages" value={metrics.messages.toLocaleString()} />
            <MetricCard label="Total tokens" value={formatCompact(metrics.tokens)} />
            <MetricCard label="Active days" value={metrics.activeDays.toString()} />
            <MetricCard label="Current streak" value={`${metrics.streaks.current}d`} />
            <MetricCard label="Longest streak" value={`${metrics.streaks.longest}d`} />
            <MetricCard label="Peak hour" value={`${metrics.peakHour % 12 || 12} ${metrics.peakHour >= 12 ? 'PM' : 'AM'}`} />
            <MetricCard label="Favorite model" value={metrics.favoriteModel} />
          </div>

          <div
            style={{
              marginTop: 10,
              borderRadius: 10,
              background: 'rgba(255,255,255,0.02)',
              padding: 10,
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(20, minmax(0, 1fr))',
                gap: 4,
              }}
            >
              {metrics.heatmap.map((cell) => {
                const ratio = cell.count / maxHeat;
                const background =
                  ratio === 0
                    ? 'rgba(255,255,255,0.08)'
                    : ratio < 0.34
                      ? 'rgba(137, 180, 255, 0.45)'
                      : ratio < 0.67
                        ? 'rgba(137, 180, 255, 0.72)'
                        : '#4f83ff';
                return (
                  <div
                    key={cell.date}
                    title={`${cell.date}: ${cell.count} messages`}
                    style={{
                      width: '100%',
                      aspectRatio: '1 / 1',
                      borderRadius: 2,
                      background,
                    }}
                  />
                );
              })}
            </div>
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-secondary)' }}>
              You&apos;ve used ~{Math.max(1, Math.round(metrics.tokens / 576000))}x more tokens than The Lord of the Rings.
            </div>
          </div>
        </>
      ) : (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {metrics.modelRows.map(([model, count]) => (
            <div
              key={model}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto auto',
                gap: 10,
                alignItems: 'center',
                borderRadius: 8,
                background: 'rgba(255,255,255,0.03)',
                padding: '10px 12px',
                fontSize: 13,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <span style={{ color: 'var(--text-primary)' }}>{model}</span>
              <span style={{ color: 'var(--text-secondary)' }}>{count} sessions</span>
              <span style={{ color: 'var(--text-secondary)' }}>
                {Math.round((count / Math.max(metrics.sessions, 1)) * 100)}%
              </span>
            </div>
          ))}
          {metrics.modelRows.length === 0 ? (
            <div style={{ padding: '20px 12px', color: 'var(--text-secondary)', fontSize: 13 }}>
              Start a session to populate model usage.
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        borderRadius: 8,
        background: 'rgba(255,255,255,0.06)',
        padding: '10px 8px',
        minHeight: 52,
      }}
    >
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.2 }}>{label}</div>
      <div
        style={{
          marginTop: 4,
          fontSize: 15,
          fontWeight: 700,
          color: 'var(--text-primary)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
    </div>
  );
}
