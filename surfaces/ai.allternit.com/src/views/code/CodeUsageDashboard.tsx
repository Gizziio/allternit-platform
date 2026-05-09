"use client";

import React, { useMemo, useState } from "react";
import { X } from "@phosphor-icons/react";
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

export function CodeUsageDashboard({ onClose }: { onClose?: () => void }) {
  const sessions = useCodeSessionStore((state) => state.sessions);
  const [activeTab, setActiveTab] = useState<"overview" | "models">("overview");
  const [range, setRange] = useState<RangeKey>("all");

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

    for (const session of filteredSessions) {
      const metadata = session.metadata as typeof session.metadata & { runtimeModel?: string };
      const dateKey = toDateKey(session.updatedAt || session.createdAt);
      activeDates.push(dateKey);
      dateCount.set(dateKey, (dateCount.get(dateKey) ?? 0) + Math.max(session.messageCount, 1));

      const runtimeModel =
        typeof metadata.runtimeModel === "string"
          ? metadata.runtimeModel
          : metadata.agentName ?? "Sonnet 4.6";
      modelCount.set(runtimeModel, (modelCount.get(runtimeModel) ?? 0) + 1);

      const hour = new Date(session.updatedAt || session.createdAt).getHours();
      hourCount.set(hour, (hourCount.get(hour) ?? 0) + Math.max(session.messageCount, 1));

      messageTotal += session.messages.length > 0 ? session.messages.length : session.messageCount;
      tokenTotal += session.messages.reduce(
        (sum, message) => sum + estimateTokens(message.content) + estimateTokens(message.thinking ?? ""),
        0,
      );
      if (session.messages.length === 0) {
        tokenTotal += estimateTokens(session.name) * Math.max(session.messageCount, 1);
      }
    }

    const heatmap: HeatmapCell[] = buildDateSeries(30).map((date) => ({
      date,
      count: dateCount.get(date) ?? 0,
    }));
    const streaks = getStreaks(activeDates);
    const favoriteModel = [...modelCount.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? "Sonnet 4.6";
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
        width: "100%",
        borderRadius: "var(--radius-lg, 16px)",
        border: "1px solid var(--ui-border-default, rgba(154, 118, 88, 0.18))",
        background: "var(--surface-floating, rgba(253, 248, 243, 0.95))",
        boxShadow: "0 12px 40px rgba(42, 31, 22, 0.12)",
        padding: "var(--space-4, 16px)",
        color: "var(--ui-text-primary, #2A1F16)",
        fontFamily: "var(--font-sans, 'Allternit Sans', Inter, sans-serif)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--space-3, 12px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2, 8px)" }}>
          <span
            style={{
              fontSize: "var(--text-md, 15px)",
              fontWeight: 600,
              color: "var(--ui-text-primary, #2A1F16)",
              letterSpacing: "-0.01em",
            }}
          >
            Usage
          </span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Close dashboard"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 24,
                height: 24,
                borderRadius: "var(--radius-sm, 8px)",
                border: "none",
                background: "transparent",
                color: "var(--ui-text-muted, #9A7658)",
                cursor: "pointer",
                padding: 0,
                transition: "background var(--transition-fast, 150ms)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--surface-hover, rgba(176, 141, 110, 0.08))";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2, 8px)" }}>
          {/* Tab switcher */}
          <div
            style={{
              display: "inline-flex",
              gap: 2,
              padding: 2,
              borderRadius: "var(--radius-md, 12px)",
              background: "var(--surface-panel-muted, #E8D9C8)",
            }}
          >
            {[
              { id: "overview", label: "Overview" },
              { id: "models", label: "Models" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as "overview" | "models")}
                style={{
                  border: "none",
                  borderRadius: "var(--radius-sm, 8px)",
                  padding: "4px 10px",
                  background: activeTab === tab.id ? "var(--surface-floating, #fff)" : "transparent",
                  color: activeTab === tab.id ? "var(--ui-text-primary, #2A1F16)" : "var(--ui-text-muted, #9A7658)",
                  fontSize: "var(--text-sm, 13px)",
                  fontWeight: activeTab === tab.id ? 500 : 400,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  boxShadow: activeTab === tab.id ? "0 1px 2px rgba(42,31,22,0.06)" : "none",
                  transition: "all var(--transition-fast, 150ms)",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Range switcher */}
          <div
            style={{
              display: "inline-flex",
              gap: 2,
              padding: 2,
              borderRadius: "var(--radius-md, 12px)",
              background: "var(--surface-panel-muted, #E8D9C8)",
            }}
          >
            {(["all", "30d", "7d"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setRange(item)}
                style={{
                  border: "none",
                  borderRadius: "var(--radius-sm, 8px)",
                  padding: "4px 10px",
                  background: range === item ? "var(--surface-floating, #fff)" : "transparent",
                  color: range === item ? "var(--ui-text-primary, #2A1F16)" : "var(--ui-text-muted, #9A7658)",
                  fontSize: "var(--text-sm, 13px)",
                  fontWeight: range === item ? 500 : 400,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  boxShadow: range === item ? "0 1px 2px rgba(42,31,22,0.06)" : "none",
                  transition: "all var(--transition-fast, 150ms)",
                }}
              >
                {item === "all" ? "All time" : item}
              </button>
            ))}
          </div>
        </div>
      </div>

      {activeTab === "overview" ? (
        <>
          {/* Metrics grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(96px, 1fr))",
              gap: "var(--space-2, 8px)",
              marginTop: "var(--space-4, 16px)",
            }}
          >
            <MetricCard label="Sessions" value={metrics.sessions.toString()} />
            <MetricCard label="Messages" value={metrics.messages.toLocaleString()} />
            <MetricCard label="Total tokens" value={formatCompact(metrics.tokens)} />
            <MetricCard label="Active days" value={metrics.activeDays.toString()} />
            <MetricCard label="Current streak" value={`${metrics.streaks.current}d`} />
            <MetricCard label="Longest streak" value={`${metrics.streaks.longest}d`} />
            <MetricCard
              label="Peak hour"
              value={`${metrics.peakHour % 12 || 12} ${metrics.peakHour >= 12 ? "PM" : "AM"}`}
            />
            <MetricCard label="Favorite model" value={metrics.favoriteModel} />
          </div>

          {/* Heatmap */}
          <div
            style={{
              marginTop: "var(--space-4, 16px)",
              borderRadius: "var(--radius-md, 12px)",
              background: "var(--surface-panel, #F5EDE3)",
              padding: "var(--space-3, 12px)",
            }}
          >
            {/* Horizontal row of 30 days */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(30, minmax(0, 1fr))",
                gap: 3,
              }}
            >
              {metrics.heatmap.map((cell) => {
                const ratio = cell.count / maxHeat;
                const background =
                  ratio === 0
                    ? "var(--surface-panel-muted, #E8D9C8)"
                    : ratio < 0.34
                      ? `color-mix(in srgb, var(--accent-primary, #B08D6E) 35%, var(--surface-panel-muted, #E8D9C8))`
                      : ratio < 0.67
                        ? `color-mix(in srgb, var(--accent-primary, #B08D6E) 65%, var(--surface-panel-muted, #E8D9C8))`
                        : "var(--accent-primary, #B08D6E)";
                return (
                  <div
                    key={cell.date}
                    title={`${cell.date}: ${cell.count} messages`}
                    style={{
                      width: "100%",
                      aspectRatio: "1 / 2",
                      borderRadius: "var(--radius-xs, 4px)",
                      background,
                      transition: "transform var(--transition-fast, 150ms)",
                      cursor: "default",
                    }}
                  />
                );
              })}
            </div>

            {/* Legend */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: "var(--space-3, 12px)",
                paddingTop: "var(--space-2, 8px)",
                borderTop: "1px solid var(--ui-border-muted, rgba(154,118,88,0.1))",
              }}
            >
              <span style={{ fontSize: 11, color: "var(--ui-text-muted, #9A7658)" }}>
                You&apos;ve used ~{Math.max(1, Math.round(metrics.tokens / 576_000))}× more tokens than{" "}
                <em>The Lord of the Rings</em>.
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 10, color: "var(--ui-text-muted, #9A7658)" }}>Less</span>
                {[0.15, 0.4, 0.65, 1].map((r) => (
                  <div
                    key={r}
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 2,
                      background:
                        r === 0.15
                          ? "var(--surface-panel-muted, #E8D9C8)"
                          : `color-mix(in srgb, var(--accent-primary, #B08D6E) ${Math.round(r * 100)}%, var(--surface-panel-muted, #E8D9C8))`,
                    }}
                  />
                ))}
                <span style={{ fontSize: 10, color: "var(--ui-text-muted, #9A7658)" }}>More</span>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div
          style={{
            marginTop: "var(--space-4, 16px)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-2, 8px)",
          }}
        >
          {metrics.modelRows.map(([model, count]) => {
            const pct = Math.round((count / Math.max(metrics.sessions, 1)) * 100);
            return (
              <div
                key={model}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto auto",
                  gap: "var(--space-3, 12px)",
                  alignItems: "center",
                  borderRadius: "var(--radius-md, 12px)",
                  background: "var(--surface-panel, #F5EDE3)",
                  padding: "10px 12px",
                  fontSize: "var(--text-sm, 13px)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                <span style={{ color: "var(--ui-text-primary, #2A1F16)", fontWeight: 500 }}>{model}</span>
                <span style={{ color: "var(--ui-text-secondary, #664E3A)" }}>{count} sessions</span>
                <span
                  style={{
                    color: "var(--ui-text-muted, #9A7658)",
                    minWidth: 36,
                    textAlign: "right",
                  }}
                >
                  {pct}%
                </span>
              </div>
            );
          })}
          {metrics.modelRows.length === 0 ? (
            <div
              style={{
                padding: "24px 12px",
                color: "var(--ui-text-muted, #9A7658)",
                fontSize: "var(--text-sm, 13px)",
                textAlign: "center",
              }}
            >
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
        borderRadius: "var(--radius-md, 12px)",
        background: "var(--surface-panel, #F5EDE3)",
        padding: "10px 10px",
        minHeight: 56,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: "var(--ui-text-muted, #9A7658)",
          lineHeight: 1.2,
          fontWeight: 500,
          letterSpacing: "0.02em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 4,
          fontSize: "var(--text-lg, 16px)",
          fontWeight: 700,
          color: "var(--ui-text-primary, #2A1F16)",
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.01em",
        }}
      >
        {value}
      </div>
    </div>
  );
}
