"use client";

import React, { useEffect, useMemo, useState } from 'react';
import {
  Pulse as Activity,
  Warning,
  Cpu,
  CurrencyDollar,
  CircleNotch,
  ArrowsClockwise,
  Shield,
  Wallet,
  WifiHigh as Wifi,
  HardDrive as MemoryStick,
  Lightning,
} from '@phosphor-icons/react';
import { GlassSurface } from '@/design/GlassSurface';
import { useBudget } from '@/hooks/useBudget';
import { ProgressBar } from '../components/ProgressBar';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/StatusBadge';

const QUICK_QUOTAS = [5, 10, 20, 40];

function formatCredits(value: number): string {
  return Number.isFinite(value) ? value.toFixed(value >= 10 ? 0 : 1) : '0.0';
}

function formatTimestamp(value: string | null): string {
  if (!value) {
    return 'Awaiting sync';
  }

  return new Date(value).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function toBadgeStatus(statusTone: 'success' | 'warning' | 'failed') {
  if (statusTone === 'failed') {
    return 'failed' as const;
  }

  if (statusTone === 'warning') {
    return 'warning' as const;
  }

  return 'success' as const;
}

export function BudgetDashboardView() {
  const {
    budget,
    metrics,
    alerts,
    configuredCreditsPerHour,
    maxPressurePercent,
    statusTone,
    lastUpdatedAt,
    lastQuotaUpdate,
    isLoading,
    isSaving,
    error,
    refetch,
    setQuota,
  } = useBudget();

  const [quotaDraft, setQuotaDraft] = useState('');

  useEffect(() => {
    if (!budget) {
      return;
    }

    setQuotaDraft(formatCredits(configuredCreditsPerHour));
  }, [budget, configuredCreditsPerHour]);

  const pressureLabel = useMemo(() => {
    if (maxPressurePercent >= 90) {
      return 'Critical pressure';
    }

    if (maxPressurePercent >= 75) {
      return 'Warning pressure';
    }

    return 'Comfortable headroom';
  }, [maxPressurePercent]);

  const projectedOverrun =
    budget && configuredCreditsPerHour > 0
      ? Math.max(0, budget.projected_hourly_cost - configuredCreditsPerHour)
      : 0;

  const handleQuotaSubmit = async () => {
    const parsed = Number.parseFloat(quotaDraft);

    if (!Number.isFinite(parsed)) {
      return;
    }

    await setQuota(parsed);
  };

  if (isLoading && !budget) {
    return (
      <div className="flex h-full items-center justify-center">
        <CircleNotch className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  if (error && !budget) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
        <Warning className="mb-4 h-12 w-12 text-red-500" />
        <p className="mb-4">Failed to load runtime budget</p>
        <button
          onClick={() => void refetch()}
          className="flex items-center gap-2 rounded-2xl bg-accent/15 px-4 py-2 text-accent transition-colors hover:bg-accent/25"
        >
          <ArrowsClockwise size={16} />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.14),transparent_34%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_28%)] p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <GlassSurface intensity="thick" className="rounded-3xl p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                <Wallet className="h-3.5 w-3.5 text-amber-300" />
                Economic Model
              </div>
              <h2 className="text-3xl font-semibold tracking-tight text-foreground">Runtime Budget</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Manage the shared runtime quota and watch live resource pressure from the backend budget metering service. This panel now mirrors the actual runtime contract instead of a fake tenant quota system.
              </p>
            </div>

            <div className="flex flex-col items-start gap-3 sm:items-end">
              <StatusBadge
                status={toBadgeStatus(statusTone)}
                text={budget?.status ?? 'healthy'}
                size="md"
              />
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <span>Last sync {formatTimestamp(lastUpdatedAt)}</span>
                <button
                  onClick={() => void refetch()}
                  className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/15 px-3 py-1 text-[11px] text-foreground transition hover:bg-black/25"
                >
                  <ArrowsClockwise className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            </div>
          </div>
        </GlassSurface>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={CurrencyDollar}
            label="Configured Credits / Hour"
            value={formatCredits(configuredCreditsPerHour)}
            unit="credits"
          />
          <StatCard
            icon={Activity}
            label="Consumed This Hour"
            value={formatCredits(budget?.credits_consumed_this_hour ?? 0)}
            unit="credits"
          />
          <StatCard
            icon={Lightning}
            label="Projected Hourly Cost"
            value={formatCredits(budget?.projected_hourly_cost ?? 0)}
            unit="credits"
          />
          <StatCard
            icon={Shield}
            label="Max Runtime Pressure"
            value={maxPressurePercent.toFixed(1)}
            unit="%"
          />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <GlassSurface intensity="base" className="rounded-3xl p-6">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-amber-200" />
                  <h3 className="text-lg font-medium text-foreground">Shared runtime quota</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  The current backend exposes one budget setting for the default runtime tenant. Update the hourly quota here and the GUI will sync it through the live quota endpoint.
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
                <label className="flex flex-col gap-2 text-sm text-muted-foreground">
                  Credits per hour
                  <input
                    aria-label="Credits per hour"
                    type="number"
                    min="0"
                    step="0.5"
                    value={quotaDraft}
                    onChange={(event) => setQuotaDraft(event.target.value)}
                    className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-base text-foreground outline-none transition focus:border-amber-300/40 focus:bg-black/30"
                  />
                </label>

                <button
                  onClick={() => void handleQuotaSubmit()}
                  disabled={isSaving || quotaDraft.trim() === ''}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm font-medium text-amber-100 transition hover:bg-amber-300/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSaving ? (
                    <CircleNotch className="h-4 w-4 animate-spin" />
                  ) : (
                    <CurrencyDollar size={16} />
                  )}
                  Apply quota
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {QUICK_QUOTAS.map((quota) => (
                  <button
                    key={quota}
                    onClick={() => setQuotaDraft(quota.toString())}
                    className="rounded-full border border-white/10 bg-black/15 px-3 py-1.5 text-xs uppercase tracking-[0.16em] text-muted-foreground transition hover:border-amber-300/30 hover:text-foreground"
                  >
                    {quota} credits
                  </button>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/5 bg-black/10 px-4 py-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    Budget posture
                  </div>
                  <div className="mt-2 text-lg font-medium text-foreground">{pressureLabel}</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {budget?.status === 'healthy'
                      ? 'The runtime remains inside its current operating envelope.'
                      : 'The runtime is nearing or crossing its enforced thresholds.'}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/5 bg-black/10 px-4 py-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    Headroom delta
                  </div>
                  <div className="mt-2 text-lg font-medium text-foreground">
                    {projectedOverrun > 0
                      ? `${formatCredits(projectedOverrun)} credits over`
                      : `${formatCredits(Math.max(0, configuredCreditsPerHour - (budget?.projected_hourly_cost ?? 0)))} credits spare`}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Based on the projected hourly cost currently reported by the runtime.
                  </div>
                </div>
              </div>

              {lastQuotaUpdate && (
                <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-50">
                  Quota updated to {formatCredits(lastQuotaUpdate.credits_per_hour)} credits/hour for tenant `{lastQuotaUpdate.tenant_id}`.
                </div>
              )}
            </div>
          </GlassSurface>

          <GlassSurface intensity="base" className="rounded-3xl p-6">
            <div className="flex items-center gap-2">
              <Warning className="h-5 w-5 text-emerald-200" />
              <h3 className="text-lg font-medium text-foreground">Resource pressure</h3>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Live pressure values come directly from `/api/v1/runtime/budget`.
            </p>

            <div className="mt-6 space-y-5">
              {metrics.map((metric) => {
                const icon =
                  metric.key === 'cpu'
                    ? Cpu
                    : metric.key === 'memory'
                      ? MemoryStick
                      : metric.key === 'network'
                        ? Wifi
                        : Shield;

                const Icon = icon;
                const color =
                  metric.tone === 'critical'
                    ? 'red'
                    : metric.tone === 'warning'
                      ? 'yellow'
                      : 'green';

                return (
                  <div key={metric.key} className="rounded-2xl border border-white/5 bg-black/10 px-4 py-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <div className="rounded-xl bg-white/5 p-2">
                          <Icon className="h-4 w-4 text-foreground" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-foreground">{metric.label}</div>
                          <div className="text-xs text-muted-foreground">{metric.detail}</div>
                        </div>
                      </div>
                      <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                        {metric.tone}
                      </span>
                    </div>
                    <ProgressBar
                      label={metric.label}
                      value={metric.percent}
                      color={color}
                      used={metric.detail}
                      limit="100%"
                    />
                  </div>
                );
              })}
            </div>
          </GlassSurface>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <GlassSurface intensity="thin" className="rounded-3xl p-6">
            <div className="flex items-center gap-2">
              <Warning className="h-5 w-5 text-amber-200" />
              <h3 className="text-lg font-medium text-foreground">Runtime signals</h3>
            </div>
            <div className="mt-4 space-y-3">
              {alerts.map((alert) => {
                const toneClass =
                  alert.level === 'critical'
                    ? 'border-red-400/20 bg-red-400/10 text-red-50'
                    : alert.level === 'warning'
                      ? 'border-amber-300/20 bg-amber-300/10 text-amber-50'
                      : 'border-emerald-300/20 bg-emerald-300/10 text-emerald-50';

                return (
                  <div key={`${alert.level}-${alert.title}`} className={`rounded-2xl border px-4 py-3 ${toneClass}`}>
                    <div className="text-sm font-medium">{alert.title}</div>
                    <div className="mt-1 text-sm opacity-90">{alert.message}</div>
                  </div>
                );
              })}
            </div>
          </GlassSurface>

          <GlassSurface intensity="thin" className="rounded-3xl p-6">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-sky-200" />
              <h3 className="text-lg font-medium text-foreground">Current backend scope</h3>
            </div>
            <div className="mt-4 space-y-4 text-sm text-muted-foreground">
              <p>
                This GUI reflects the runtime budget endpoints that actually exist today: live status plus a single shared quota update action.
              </p>
              <p>
                The previous dashboard implied tenant-specific quota CRUD, historical measurements, and alert feeds that the backend does not expose. Those placeholders have been removed to keep the surface honest and operable.
              </p>
              {error && (
                <div className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-red-50">
                  {error.message}
                </div>
              )}
            </div>
          </GlassSurface>
        </div>
      </div>
    </div>
  );
}

export default BudgetDashboardView;
