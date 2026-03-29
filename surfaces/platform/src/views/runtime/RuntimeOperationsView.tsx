"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Warning,
  Stack,
  Gauge,
  ClockCounterClockwise,
  CircleNotch,
  Play,
  ArrowsClockwise,
  RocketLaunch,
  Shield,
  Thermometer,
  Wallet,
  Waves,
  Lightning,
} from '@phosphor-icons/react';
import { GlassSurface } from "@/design/GlassSurface";
import {
  useBudget,
  type RuntimeBudgetAlert,
  type RuntimeBudgetMetric,
  type RuntimeBudgetQuotaUpdate,
  type RuntimeBudgetStatus,
} from "@/hooks/useBudget";
import { useReplay, type ReplayManifest } from "@/hooks/useReplay";
import {
  usePrewarm,
  type PoolActivity,
  type PoolStats,
  type PoolStatus,
  PoolHealth,
} from "@/hooks/usePrewarm";
import {
  useRuntimeExecutionMode,
  type RuntimeExecutionModeStatus,
} from "@/hooks/useRuntimeExecutionMode";
import type { RuntimeExecutionMode } from "@/lib/agents/native-agent-api";
import { ConnectedRuntimeConfigurationPanel } from "./RuntimeConfigurationPanel";
import { ProgressBar } from "../components/ProgressBar";
import { StatCard } from "../components/StatCard";
import { StatusBadge } from "../components/StatusBadge";

type RuntimeOperationsLinkTarget =
  | "native-agent"
  | "budget-dashboard"
  | "replay-manager"
  | "prewarm-manager";

interface RuntimeOperationsPanelProps {
  executionMode: RuntimeExecutionModeStatus | null;
  isLoadingExecutionMode?: boolean;
  isSavingExecutionMode?: boolean;
  executionModeError?: Error | null;
  onRefreshExecutionMode?: () => Promise<void> | void;
  onSetExecutionMode?: (mode: RuntimeExecutionMode) => Promise<unknown> | void;
  budget: RuntimeBudgetStatus | null;
  budgetMetrics: RuntimeBudgetMetric[];
  budgetAlerts: RuntimeBudgetAlert[];
  configuredCreditsPerHour: number;
  maxPressurePercent: number;
  budgetTone: "success" | "warning" | "failed";
  lastBudgetUpdatedAt: string | null;
  lastQuotaUpdate: RuntimeBudgetQuotaUpdate | null;
  isLoadingBudget?: boolean;
  isSavingBudget?: boolean;
  budgetError?: Error | null;
  onRefreshBudget?: () => Promise<void> | void;
  onSetBudgetQuota?: (creditsPerHour: number) => Promise<unknown> | void;
  replayManifests: ReplayManifest[];
  isLoadingReplay?: boolean;
  replayError?: Error | null;
  onRefreshReplay?: () => Promise<void> | void;
  onReplaySession?: (runId: string) => Promise<unknown> | void;
  pools: PoolStatus[];
  activities: PoolActivity[];
  stats: PoolStats;
  runtimeStatus: {
    enabled: boolean;
    pool_size: number;
    available_instances: number;
    in_use_instances: number;
  } | null;
  isLoadingPrewarm?: boolean;
  prewarmError?: Error | null;
  onRefreshPrewarm?: () => Promise<void> | void;
  onSetPoolSize?: (poolSize: number) => Promise<unknown> | void;
  onWarmupPool?: (name?: string) => Promise<unknown> | void;
  calculateHealth?: (pool: PoolStatus) => PoolHealth;
  onOpenView?: (viewType: RuntimeOperationsLinkTarget) => void;
  isRefreshingAll?: boolean;
  onRefreshAll?: () => Promise<void> | void;
  configurationPanel?: React.ReactNode;
}

export interface RuntimeOperationsViewProps {
  onOpenView?: (viewType: RuntimeOperationsLinkTarget) => void;
}

function formatCredits(value: number): string {
  return Number.isFinite(value) ? value.toFixed(value >= 10 ? 0 : 1) : "0.0";
}

function formatTimestamp(value: string | null): string {
  if (!value) {
    return "Awaiting sync";
  }

  return new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function truncateRunId(runId: string): string {
  if (runId.length <= 18) {
    return runId;
  }

  return `${runId.slice(0, 10)}...${runId.slice(-6)}`;
}

function executionModeMeta(mode: RuntimeExecutionMode | null): {
  badge: "pending" | "warning" | "success";
  title: string;
  detail: string;
} {
  if (mode === "plan") {
    return {
      badge: "pending",
      title: "Plan rail",
      detail: "Generate and inspect a plan before runtime changes are allowed.",
    };
  }

  if (mode === "safe") {
    return {
      badge: "warning",
      title: "Safe rail",
      detail: "Require runtime rails and policy checks before direct execution.",
    };
  }

  if (mode === "auto") {
    return {
      badge: "success",
      title: "Auto rail",
      detail: "Execute directly when the runtime and rails permit the request.",
    };
  }

  return {
    badge: "pending",
    title: "Syncing runtime rail",
    detail: "Waiting for the runtime to report the shared execution default.",
  };
}

function metricColor(metric: RuntimeBudgetMetric): "green" | "yellow" | "red" {
  if (metric.tone === "critical") {
    return "red";
  }

  if (metric.tone === "warning") {
    return "yellow";
  }

  return "green";
}

function healthForPool(
  pool: PoolStatus,
  calculateHealth?: (pool: PoolStatus) => PoolHealth,
): PoolHealth {
  if (calculateHealth) {
    return calculateHealth(pool);
  }

  if (pool.available_count <= 0) {
    return PoolHealth.Empty;
  }

  if (pool.available_count / Math.max(pool.pool_size, 1) < 0.35) {
    return PoolHealth.Degraded;
  }

  return PoolHealth.Healthy;
}

function healthBadge(
  health: PoolHealth,
): "success" | "warning" | "pending" {
  if (health === PoolHealth.Healthy) {
    return "success";
  }

  if (health === PoolHealth.Degraded) {
    return "warning";
  }

  return "pending";
}

function LinkPill({
  label,
  description,
  onClick,
}: {
  label: string;
  description: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-left transition hover:bg-black/25 disabled:cursor-default disabled:opacity-70"
    >
      <div className="text-sm font-medium text-foreground">{label}</div>
      <div className="mt-1 text-xs text-muted-foreground">{description}</div>
    </button>
  );
}

export function RuntimeOperationsPanel({
  executionMode,
  isLoadingExecutionMode = false,
  isSavingExecutionMode = false,
  executionModeError = null,
  onRefreshExecutionMode,
  onSetExecutionMode,
  budget,
  budgetMetrics,
  budgetAlerts,
  configuredCreditsPerHour,
  maxPressurePercent,
  budgetTone,
  lastBudgetUpdatedAt,
  lastQuotaUpdate,
  isLoadingBudget = false,
  isSavingBudget = false,
  budgetError = null,
  onRefreshBudget,
  onSetBudgetQuota,
  replayManifests,
  isLoadingReplay = false,
  replayError = null,
  onRefreshReplay,
  onReplaySession,
  pools,
  activities,
  stats,
  runtimeStatus,
  isLoadingPrewarm = false,
  prewarmError = null,
  onRefreshPrewarm,
  onSetPoolSize,
  onWarmupPool,
  calculateHealth,
  onOpenView,
  isRefreshingAll = false,
  onRefreshAll,
  configurationPanel,
}: RuntimeOperationsPanelProps) {
  const [quotaDraft, setQuotaDraft] = useState("");
  const [poolSizeDraft, setPoolSizeDraft] = useState(2);
  const [isSavingPoolSize, setIsSavingPoolSize] = useState(false);
  const [isWarmingPool, setIsWarmingPool] = useState(false);
  const [replayingRunId, setReplayingRunId] = useState<string | null>(null);

  useEffect(() => {
    const nextQuota =
      lastQuotaUpdate?.credits_per_hour ?? configuredCreditsPerHour ?? 0;
    setQuotaDraft(formatCredits(nextQuota));
  }, [configuredCreditsPerHour, lastQuotaUpdate?.credits_per_hour]);

  useEffect(() => {
    if (runtimeStatus) {
      setPoolSizeDraft(runtimeStatus.pool_size);
    }
  }, [runtimeStatus]);

  const replayableCount = useMemo(
    () =>
      replayManifests.filter((manifest) => manifest.capture_level !== "none")
        .length,
    [replayManifests],
  );
  const totalOutputs = useMemo(
    () =>
      replayManifests.reduce(
        (total, manifest) => total + manifest.output_count,
        0,
      ),
    [replayManifests],
  );
  const latestActivity = activities[0] ?? null;
  const currentModeMeta = executionModeMeta(executionMode?.mode ?? null);
  const topReplayManifests = replayManifests.slice(0, 4);

  const handleQuotaApply = async () => {
    if (!onSetBudgetQuota) {
      return;
    }

    const parsed = Number.parseFloat(quotaDraft);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return;
    }

    await onSetBudgetQuota(parsed);
  };

  const handlePoolSizeApply = async () => {
    if (!onSetPoolSize) {
      return;
    }

    setIsSavingPoolSize(true);
    try {
      await onSetPoolSize(poolSizeDraft);
    } finally {
      setIsSavingPoolSize(false);
    }
  };

  const handleWarmup = async () => {
    if (!onWarmupPool) {
      return;
    }

    setIsWarmingPool(true);
    try {
      await onWarmupPool(pools[0]?.name);
    } finally {
      setIsWarmingPool(false);
    }
  };

  const handleReplay = async (runId: string) => {
    if (!onReplaySession) {
      return;
    }

    setReplayingRunId(runId);
    try {
      await onReplaySession(runId);
    } finally {
      setReplayingRunId(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.14),transparent_34%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.12),transparent_32%),linear-gradient(180deg,rgba(8,12,18,0.94),rgba(8,12,18,1))] p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <GlassSurface intensity="thick" className="rounded-3xl p-6">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                <Stack className="h-3.5 w-3.5 text-amber-300" />
                Runtime Command
              </div>
              <h2 className="text-3xl font-semibold tracking-tight text-foreground">
                Runtime Operations
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Keep the shared runtime lane coherent from one place: global
                execution posture, budget pressure, replay readiness, and
                prewarm capacity. This surface stays pinned to the runtime
                contracts the backend already exposes today.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:items-end">
              <StatusBadge
                status={currentModeMeta.badge}
                text={currentModeMeta.title}
                size="md"
              />
              <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <span>
                  Mode sync {formatTimestamp(executionMode?.updatedAt ?? null)}
                </span>
                <button
                  type="button"
                  onClick={() => void onRefreshAll?.()}
                  className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/15 px-3 py-1 text-[11px] text-foreground transition hover:bg-black/25"
                >
                  <ArrowsClockwise
                    className={`h-3.5 w-3.5 ${isRefreshingAll ? "animate-spin" : ""}`}
                  />
                  Refresh all
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-3 lg:grid-cols-4">
            <LinkPill
              label="Agent Sessions"
              description="Open the live session workspace and briefs."
              onClick={
                onOpenView ? () => onOpenView("native-agent") : undefined
              }
            />
            <LinkPill
              label="Budget Detail"
              description="Open the dedicated quota and pressure surface."
              onClick={
                onOpenView
                  ? () => onOpenView("budget-dashboard")
                  : undefined
              }
            />
            <LinkPill
              label="Replay Detail"
              description="Inspect full capture catalogs and launch replays."
              onClick={
                onOpenView ? () => onOpenView("replay-manager") : undefined
              }
            />
            <LinkPill
              label="Prewarm Detail"
              description="Tune pool controls and inspect topology."
              onClick={
                onOpenView ? () => onOpenView("prewarm-manager") : undefined
              }
            />
          </div>
        </GlassSurface>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={Shield}
            label="Agent Mode"
            value={executionMode?.mode?.toUpperCase() ?? "SYNC"}
          />
          <StatCard
            icon={Wallet}
            label="Projected Burn"
            value={formatCredits(budget?.projected_hourly_cost ?? 0)}
            unit="credits/hr"
          />
          <StatCard
            icon={RocketLaunch}
            label="Warm Capacity"
            value={runtimeStatus?.available_instances ?? 0}
            unit="instances"
          />
          <StatCard
            icon={ClockCounterClockwise}
            label="Replayable Runs"
            value={replayableCount}
            unit="sessions"
          />
        </div>

        {configurationPanel ? configurationPanel : null}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <GlassSurface intensity="base" className="rounded-3xl p-6">
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-amber-200" />
                      <h3 className="text-lg font-medium text-foreground">
                        Shared Agent Mode
                      </h3>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      The global `Plan / Safe / Auto` agent mode used by tool
                      execution when a request does not explicitly override it.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge
                      status={currentModeMeta.badge}
                      text={executionMode?.mode ?? "syncing"}
                    />
                    <button
                      type="button"
                      onClick={() => void onRefreshExecutionMode?.()}
                      className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/15 px-3 py-2 text-sm text-foreground transition hover:bg-black/25"
                    >
                      <ArrowsClockwise
                        className={`h-4 w-4 ${isLoadingExecutionMode ? "animate-spin" : ""}`}
                      />
                      Refresh
                    </button>
                  </div>
                </div>

                <div className="rounded-3xl border border-white/5 bg-black/10 p-5">
                  <div className="grid gap-3 md:grid-cols-3">
                    {(executionMode?.supportedModes ?? ["plan", "safe", "auto"]).map(
                      (mode) => {
                        const active = executionMode?.mode === mode;
                        const nextModeMeta = executionModeMeta(mode);

                        return (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => void onSetExecutionMode?.(mode)}
                            disabled={isSavingExecutionMode}
                            className={`rounded-3xl border px-4 py-4 text-left transition ${
                              active
                                ? "border-amber-300/30 bg-amber-300/10"
                                : "border-white/10 bg-black/10 hover:border-white/20 hover:bg-black/20"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-sm font-medium uppercase tracking-[0.18em] text-foreground">
                                {mode}
                              </div>
                              {active ? (
                                <StatusBadge
                                  status={nextModeMeta.badge}
                                  text="Active"
                                />
                              ) : null}
                            </div>
                            <p className="mt-2 text-sm text-muted-foreground">
                              {nextModeMeta.detail}
                            </p>
                          </button>
                        );
                      },
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    <span>
                      Last updated {formatTimestamp(executionMode?.updatedAt ?? null)}
                    </span>
                    {isSavingExecutionMode ? (
                      <span>Writing runtime default</span>
                    ) : null}
                    {executionModeError ? (
                      <span className="text-red-300">
                        {executionModeError.message}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </GlassSurface>

            <GlassSurface intensity="base" className="rounded-3xl p-6">
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Wallet className="h-5 w-5 text-emerald-200" />
                      <h3 className="text-lg font-medium text-foreground">
                        Budget Pressure
                      </h3>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Live budget posture from the runtime metering service, with
                      the shared quota control close to the pressure bars.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={budgetTone} text={budget?.status ?? "syncing"} />
                    <button
                      type="button"
                      onClick={() => void onRefreshBudget?.()}
                      className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/15 px-3 py-2 text-sm text-foreground transition hover:bg-black/25"
                    >
                      <ArrowsClockwise
                        className={`h-4 w-4 ${isLoadingBudget ? "animate-spin" : ""}`}
                      />
                      Refresh
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
                  <label className="flex flex-col gap-2 text-sm text-muted-foreground">
                    Shared credits per hour
                    <input
                      aria-label="Shared credits per hour"
                      type="number"
                      min="0"
                      step="0.5"
                      value={quotaDraft}
                      onChange={(event) => setQuotaDraft(event.target.value)}
                      className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-base text-foreground outline-none transition focus:border-emerald-300/40 focus:bg-black/30"
                    />
                  </label>

                  <div className="flex items-end gap-2">
                    {[5, 10, 20, 40].map((quota) => (
                      <button
                        key={quota}
                        type="button"
                        onClick={() => setQuotaDraft(String(quota))}
                        className="rounded-2xl border border-white/10 bg-black/15 px-3 py-3 text-sm text-foreground transition hover:bg-black/25"
                      >
                        {quota}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => void handleQuotaApply()}
                      disabled={isSavingBudget}
                      className="inline-flex items-center gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm font-medium text-emerald-100 transition hover:bg-emerald-300/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isSavingBudget ? (
                        <ArrowsClockwise className="h-4 w-4 animate-spin" />
                      ) : (
                        <Wallet size={16} />
                      )}
                      Apply quota
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {budgetMetrics.map((metric) => (
                    <div
                      key={metric.key}
                      className="rounded-3xl border border-white/5 bg-black/10 p-4"
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <div className="text-sm font-medium text-foreground">
                          {metric.label}
                        </div>
                        <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                          {metric.detail}
                        </div>
                      </div>
                      <ProgressBar
                        value={metric.percent}
                        color={metricColor(metric)}
                        size="sm"
                      />
                    </div>
                  ))}
                </div>

                <div className="grid gap-3 lg:grid-cols-[0.75fr_1.25fr]">
                  <div className="rounded-3xl border border-white/5 bg-black/10 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Gauge className="h-4 w-4 text-amber-200" />
                      Pressure ceiling
                    </div>
                    <div className="mt-3 text-3xl font-semibold text-foreground">
                      {maxPressurePercent.toFixed(1)}%
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Last budget sync {formatTimestamp(lastBudgetUpdatedAt)}
                    </p>
                  </div>

                  <div className="rounded-3xl border border-white/5 bg-black/10 p-4">
                    <div className="text-sm font-medium text-foreground">
                      Current posture
                    </div>
                    <div className="mt-3 space-y-3">
                      {budgetAlerts.slice(0, 2).map((alert) => (
                        <div
                          key={alert.title}
                          className="rounded-2xl border border-white/5 bg-black/10 px-4 py-3"
                        >
                          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                            <Warning className="h-4 w-4 text-amber-200" />
                            {alert.title}
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {alert.message}
                          </p>
                        </div>
                      ))}

                      {budgetError ? (
                        <div className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">
                          {budgetError.message}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </GlassSurface>
          </div>

          <div className="space-y-6">
            <GlassSurface intensity="base" className="rounded-3xl p-6">
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Thermometer className="h-5 w-5 text-amber-200" />
                      <h3 className="text-lg font-medium text-foreground">
                        Prewarm Capacity
                      </h3>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Manage the live prewarm pool so hot capacity stays ahead of
                      the runtime queue.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge
                      status={runtimeStatus?.enabled ? "success" : "pending"}
                      text={runtimeStatus?.enabled ? "Enabled" : "Disabled"}
                    />
                    <button
                      type="button"
                      onClick={() => void onRefreshPrewarm?.()}
                      className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/15 px-3 py-2 text-sm text-foreground transition hover:bg-black/25"
                    >
                      <ArrowsClockwise
                        className={`h-4 w-4 ${isLoadingPrewarm ? "animate-spin" : ""}`}
                      />
                      Refresh
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-2xl border border-white/5 bg-black/10 px-4 py-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      Pool size
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-foreground">
                      {runtimeStatus?.pool_size ?? 0}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/5 bg-black/10 px-4 py-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      Available
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-foreground">
                      {stats.total_available}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/5 bg-black/10 px-4 py-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      In use
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-foreground">
                      {stats.total_in_use}
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-white/5 bg-black/10 p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-medium text-foreground">
                        Shared pool size
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Adjust the shared pool target, then push a warmup if the
                        lane needs faster startup.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 px-4 py-2 text-lg font-semibold text-foreground">
                      {poolSizeDraft}
                    </div>
                  </div>

                  <input
                    aria-label="Shared pool size"
                    type="range"
                    min={1}
                    max={12}
                    step={1}
                    value={poolSizeDraft}
                    onChange={(event) =>
                      setPoolSizeDraft(Number(event.target.value))
                    }
                    className="mt-6 w-full accent-[var(--accent)]"
                  />

                  <div className="mt-6 flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => void handleWarmup()}
                      disabled={isWarmingPool}
                      className="inline-flex items-center gap-2 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm font-medium text-amber-100 transition hover:bg-amber-300/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isWarmingPool ? (
                        <ArrowsClockwise className="h-4 w-4 animate-spin" />
                      ) : (
                        <Waves size={16} />
                      )}
                      Trigger warmup
                    </button>
                    <button
                      type="button"
                      onClick={() => void handlePoolSizeApply()}
                      disabled={
                        isSavingPoolSize ||
                        poolSizeDraft === (runtimeStatus?.pool_size ?? poolSizeDraft)
                      }
                      className="inline-flex items-center gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm font-medium text-emerald-100 transition hover:bg-emerald-300/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isSavingPoolSize ? (
                        <ArrowsClockwise className="h-4 w-4 animate-spin" />
                      ) : (
                        <RocketLaunch size={16} />
                      )}
                      Apply pool size
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {pools.slice(0, 3).map((pool) => {
                    const utilization =
                      pool.pool_size === 0
                        ? 0
                        : (pool.in_use_count / pool.pool_size) * 100;
                    const health = healthForPool(pool, calculateHealth);

                    return (
                      <div
                        key={pool.name}
                        className="rounded-3xl border border-white/5 bg-black/10 p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-medium text-foreground">
                              {pool.name}
                            </div>
                            <div className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                              runtime/default
                            </div>
                          </div>
                          <StatusBadge
                            status={healthBadge(health)}
                            text={health}
                          />
                        </div>
                        <div className="mt-4">
                          <ProgressBar
                            value={utilization}
                            size="sm"
                            showPercentage={false}
                            used={`${pool.in_use_count}`}
                            limit={`${pool.pool_size}`}
                          />
                        </div>
                      </div>
                    );
                  })}

                  {prewarmError ? (
                    <div className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">
                      {prewarmError.message}
                    </div>
                  ) : null}

                  {!prewarmError && pools.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-muted-foreground">
                      No runtime pools are visible yet. Trigger warmup once the
                      prewarm service is online.
                    </div>
                  ) : null}
                </div>
              </div>
            </GlassSurface>

            <GlassSurface intensity="base" className="rounded-3xl p-6">
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <ClockCounterClockwise className="h-5 w-5 text-sky-200" />
                      <h3 className="text-lg font-medium text-foreground">
                        Replay Readiness
                      </h3>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Use captured runs to verify the same execution substrate the
                      TUI can replay today.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge
                      status={replayableCount > 0 ? "success" : "pending"}
                      text={`${replayableCount} replayable`}
                    />
                    <button
                      type="button"
                      onClick={() => void onRefreshReplay?.()}
                      className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/15 px-3 py-2 text-sm text-foreground transition hover:bg-black/25"
                    >
                      <ArrowsClockwise
                        className={`h-4 w-4 ${isLoadingReplay ? "animate-spin" : ""}`}
                      />
                      Refresh
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-2xl border border-white/5 bg-black/10 px-4 py-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      Captures
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-foreground">
                      {replayManifests.length}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/5 bg-black/10 px-4 py-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      Full capture
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-foreground">
                      {
                        replayManifests.filter(
                          (manifest) => manifest.capture_level === "full",
                        ).length
                      }
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/5 bg-black/10 px-4 py-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      Outputs
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-foreground">
                      {totalOutputs}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {topReplayManifests.map((manifest) => (
                    <div
                      key={manifest.run_id}
                      className="rounded-3xl border border-white/5 bg-black/10 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-mono text-sm text-foreground">
                            {truncateRunId(manifest.run_id)}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                            <span>{manifest.capture_level} capture</span>
                            <span>{manifest.output_count} outputs</span>
                            <span>{manifest.timestamp_count} timestamps</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => void handleReplay(manifest.run_id)}
                          disabled={replayingRunId === manifest.run_id}
                          className="inline-flex items-center gap-2 rounded-2xl border border-sky-300/20 bg-sky-300/10 px-3 py-2 text-sm font-medium text-sky-100 transition hover:bg-sky-300/20 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {replayingRunId === manifest.run_id ? (
                            <ArrowsClockwise className="h-4 w-4 animate-spin" />
                          ) : (
                            <Play size={16} />
                          )}
                          Replay
                        </button>
                      </div>
                    </div>
                  ))}

                  {replayError ? (
                    <div className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">
                      {replayError.message}
                    </div>
                  ) : null}

                  {!replayError && replayManifests.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-muted-foreground">
                      No replay captures are available yet. Run workflows or tool
                      executions with replay enabled to populate this lane.
                    </div>
                  ) : null}
                </div>
              </div>
            </GlassSurface>
          </div>
        </div>

        <GlassSurface intensity="thin" className="rounded-3xl p-4 text-sm text-muted-foreground">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              Runtime deck last synced across budget, replay, and prewarm
              controls at {formatTimestamp(lastBudgetUpdatedAt)}.
            </div>
            <div className="flex items-center gap-2">
              <Lightning className="h-4 w-4 text-amber-200" />
              {latestActivity
                ? latestActivity.details
                : "No recent pool activity recorded."}
            </div>
          </div>
        </GlassSurface>
      </div>
    </div>
  );
}

export function RuntimeOperationsView({
  onOpenView,
}: RuntimeOperationsViewProps) {
  const {
    executionMode,
    isLoading: isLoadingExecutionMode,
    isSaving: isSavingExecutionMode,
    error: executionModeError,
    refetch: refetchExecutionMode,
    setMode,
  } = useRuntimeExecutionMode();
  const {
    budget,
    metrics,
    alerts,
    configuredCreditsPerHour,
    maxPressurePercent,
    statusTone,
    lastUpdatedAt,
    lastQuotaUpdate,
    isLoading: isLoadingBudget,
    isSaving: isSavingBudget,
    error: budgetError,
    refetch: refetchBudget,
    setQuota,
  } = useBudget();
  const {
    manifests,
    isLoading: isLoadingReplay,
    error: replayError,
    refetch: refetchReplay,
    replayExecution,
  } = useReplay();
  const {
    pools,
    activities,
    stats,
    runtimeStatus,
    isLoading: isLoadingPrewarm,
    error: prewarmError,
    refetch: refetchPrewarm,
    setPoolSize,
    warmupPool,
    calculateHealth,
  } = usePrewarm();
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);

  const handleRefreshAll = async () => {
    setIsRefreshingAll(true);
    try {
      await Promise.all([
        refetchExecutionMode(),
        refetchBudget(),
        refetchReplay(),
        refetchPrewarm(),
      ]);
    } finally {
      setIsRefreshingAll(false);
    }
  };

  if (
    isLoadingExecutionMode &&
    isLoadingBudget &&
    isLoadingReplay &&
    isLoadingPrewarm &&
    !executionMode &&
    !budget &&
    manifests.length === 0 &&
    pools.length === 0
  ) {
    return (
      <div className="flex h-full items-center justify-center">
        <CircleNotch className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <RuntimeOperationsPanel
      configurationPanel={
        <GlassSurface intensity="base" className="rounded-3xl p-6">
          <ConnectedRuntimeConfigurationPanel />
        </GlassSurface>
      }
      executionMode={executionMode}
      isLoadingExecutionMode={isLoadingExecutionMode}
      isSavingExecutionMode={isSavingExecutionMode}
      executionModeError={executionModeError}
      onRefreshExecutionMode={refetchExecutionMode}
      onSetExecutionMode={setMode}
      budget={budget}
      budgetMetrics={metrics}
      budgetAlerts={alerts}
      configuredCreditsPerHour={configuredCreditsPerHour}
      maxPressurePercent={maxPressurePercent}
      budgetTone={statusTone}
      lastBudgetUpdatedAt={lastUpdatedAt}
      lastQuotaUpdate={lastQuotaUpdate}
      isLoadingBudget={isLoadingBudget}
      isSavingBudget={isSavingBudget}
      budgetError={budgetError}
      onRefreshBudget={refetchBudget}
      onSetBudgetQuota={setQuota}
      replayManifests={manifests}
      isLoadingReplay={isLoadingReplay}
      replayError={replayError}
      onRefreshReplay={refetchReplay}
      onReplaySession={replayExecution}
      pools={pools}
      activities={activities}
      stats={stats}
      runtimeStatus={runtimeStatus}
      isLoadingPrewarm={isLoadingPrewarm}
      prewarmError={prewarmError}
      onRefreshPrewarm={refetchPrewarm}
      onSetPoolSize={setPoolSize}
      onWarmupPool={warmupPool}
      calculateHealth={calculateHealth}
      onOpenView={onOpenView}
      isRefreshingAll={isRefreshingAll}
      onRefreshAll={handleRefreshAll}
    />
  );
}

export default RuntimeOperationsView;
