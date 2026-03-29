"use client";

import React, { useMemo, useState } from 'react';
import {
  ArrowsClockwise,
  Thermometer,
  Pulse as Activity,
  CheckCircle,
  Warning,
  Clock,
  Gauge,
  Fire,
} from '@phosphor-icons/react';
import { GlassSurface } from '@/design/GlassSurface';
import { usePrewarm } from '@/hooks/usePrewarm';
import { StatCard } from '../components/StatCard';
import { ProgressBar } from '../components/ProgressBar';
import { PoolHealth } from '@/types/runtime';

export function PrewarmManagerView() {
  const {
    pools,
    activities,
    stats,
    runtimeStatus,
    isLoading,
    error,
    refetch,
    setPoolSize,
    warmupPool,
    getPoolsByHealth,
    calculateHealth,
  } = usePrewarm();

  const [draftPoolSize, setDraftPoolSize] = useState<number>(runtimeStatus?.pool_size || 2);
  const [isSaving, setIsSaving] = useState(false);
  const [isWarming, setIsWarming] = useState(false);

  const healthyPools = useMemo(() => getPoolsByHealth(PoolHealth.Healthy), [getPoolsByHealth]);
  const degradedPools = useMemo(() => getPoolsByHealth(PoolHealth.Degraded), [getPoolsByHealth]);
  const emptyPools = useMemo(() => getPoolsByHealth(PoolHealth.Empty), [getPoolsByHealth]);

  React.useEffect(() => {
    if (runtimeStatus) {
      setDraftPoolSize(runtimeStatus.pool_size);
    }
  }, [runtimeStatus]);

  const handleSavePoolSize = async () => {
    setIsSaving(true);
    try {
      await setPoolSize(draftPoolSize);
    } finally {
      setIsSaving(false);
    }
  };

  const handleWarmup = async (poolName?: string) => {
    setIsWarming(true);
    try {
      await warmupPool(poolName);
    } finally {
      setIsWarming(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <ArrowsClockwise className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
        <Warning className="mb-4 h-12 w-12 text-red-500" />
        <p className="mb-4">Failed to load prewarm status</p>
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
    <div className="h-full overflow-y-auto bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.14),transparent_34%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_30%)] p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <GlassSurface intensity="thick" className="rounded-3xl p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                <Fire className="h-3.5 w-3.5 text-amber-300" />
                Launch Latency Control
              </div>
              <h2 className="text-3xl font-semibold tracking-tight text-foreground">Prewarm Pool Manager</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Tune the runtime pool size and trigger warmup for the live prewarm service. This GUI now mirrors the actual backend controls instead of exposing fake pool CRUD.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => void refetch()}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-foreground transition hover:bg-black/30"
              >
                <ArrowsClockwise size={16} />
                Refresh
              </button>
              <button
                onClick={() => void handleWarmup(pools[0]?.name)}
                disabled={isWarming}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm font-medium text-amber-100 transition hover:bg-amber-300/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isWarming ? (
                  <ArrowsClockwise className="h-4 w-4 animate-spin" />
                ) : (
                  <Thermometer size={16} />
                )}
                Trigger Warmup
              </button>
            </div>
          </div>
        </GlassSurface>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <StatCard icon={Gauge} label="Pool Size" value={runtimeStatus?.pool_size || 0} />
          <StatCard icon={CheckCircle} label="Available" value={stats.total_available} />
          <StatCard icon={Activity} label="In Use" value={stats.total_in_use} />
          <StatCard
            icon={Clock}
            label="Managed Pools"
            value={stats.total_pools}
            trend={stats.total_pools > 0 ? 'up' : 'neutral'}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr,0.9fr]">
          <GlassSurface intensity="base" className="rounded-3xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-foreground">Runtime Pool Controls</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  The backend currently manages a shared pool size and warmup action. Adjust those values here.
                </p>
              </div>
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {runtimeStatus?.enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>

            <div className="mt-6 rounded-3xl border border-white/5 bg-black/10 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-foreground">Default pool size</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Increase this when cold starts hurt throughput. Lower it to reclaim capacity.
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 px-4 py-2 text-lg font-semibold text-foreground">
                  {draftPoolSize}
                </div>
              </div>

              <input
                type="range"
                min={1}
                max={12}
                step={1}
                value={draftPoolSize}
                onChange={(e) => setDraftPoolSize(Number(e.target.value))}
                className="mt-6 w-full accent-[var(--accent)]"
              />

              <div className="mt-3 flex items-center justify-between text-xs uppercase tracking-[0.16em] text-muted-foreground">
                <span>Lean</span>
                <span>Balanced</span>
                <span>Aggressive</span>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => void handleSavePoolSize()}
                  disabled={isSaving || draftPoolSize === (runtimeStatus?.pool_size || 0)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm font-medium text-emerald-100 transition hover:bg-emerald-300/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSaving ? (
                    <ArrowsClockwise className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle size={16} />
                  )}
                  Apply Pool Size
                </button>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              <HealthChip label="Healthy" count={healthyPools.length} status="healthy" />
              <HealthChip label="Degraded" count={degradedPools.length} status="degraded" />
              <HealthChip label="Empty" count={emptyPools.length} status="empty" />
            </div>
          </GlassSurface>

          <GlassSurface intensity="base" className="rounded-3xl p-6">
            <h3 className="text-lg font-medium text-foreground">Pool Topology</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Live status from `/api/v1/runtime/prewarm/status`.
            </p>

            <div className="mt-5 space-y-4">
              {pools.map((pool) => {
                const health = calculateHealth(pool);
                const utilization = pool.pool_size === 0 ? 0 : (pool.in_use_count / pool.pool_size) * 100;

                return (
                  <div key={pool.name} className="rounded-3xl border border-white/5 bg-black/10 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-medium text-foreground">{pool.name}</div>
                        <div className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                          runtime/default
                        </div>
                      </div>
                      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs">
                        {health === PoolHealth.Healthy ? (
                          <CheckCircle className="h-3.5 w-3.5 text-green-400" />
                        ) : health === PoolHealth.Degraded ? (
                          <Warning className="h-3.5 w-3.5 text-yellow-400" />
                        ) : (
                          <Thermometer className="h-3.5 w-3.5 text-sky-400" />
                        )}
                        <span className="capitalize text-foreground">{health}</span>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
                        <span>Utilization</span>
                        <span>{pool.in_use_count} / {pool.pool_size}</span>
                      </div>
                      <ProgressBar value={utilization} size="sm" showPercentage={false} />
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-3 text-center text-xs">
                      <MetricCard label="Available" value={pool.available_count} tone="green" />
                      <MetricCard label="In Use" value={pool.in_use_count} tone="blue" />
                      <MetricCard label="Capacity" value={pool.pool_size} tone="neutral" />
                    </div>
                  </div>
                );
              })}

              {pools.length === 0 && (
                <div className="rounded-3xl border border-dashed border-white/10 p-8 text-center">
                  <Thermometer className="mx-auto h-10 w-10 text-muted-foreground/50" />
                  <h4 className="mt-4 text-sm font-medium text-foreground">No prewarm pools reported</h4>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Increase the pool size to initialize the default pool.
                  </p>
                </div>
              )}
            </div>
          </GlassSurface>
        </div>

        <GlassSurface intensity="thin" className="rounded-3xl p-6">
          <h3 className="text-lg font-medium text-foreground">Recent Activity</h3>
          <div className="mt-4 space-y-3">
            {activities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent GUI-driven prewarm activity.</p>
            ) : (
              activities.map((activity, index) => (
                <div
                  key={`${activity.timestamp}-${index}`}
                  className="flex flex-col gap-2 rounded-2xl border border-white/5 bg-black/10 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-foreground">{activity.pool_name}</span>
                    <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      {activity.activity_type}
                    </span>
                  </div>
                  <div className="flex flex-col text-muted-foreground sm:items-end">
                    <span>{activity.details}</span>
                    <span className="text-xs">{new Date(activity.timestamp).toLocaleString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </GlassSurface>
      </div>
    </div>
  );
}

function HealthChip({
  label,
  count,
  status,
}: {
  label: string;
  count: number;
  status: 'healthy' | 'degraded' | 'empty';
}) {
  const tone =
    status === 'healthy'
      ? 'border-green-400/20 bg-green-400/10 text-green-100'
      : status === 'degraded'
        ? 'border-yellow-400/20 bg-yellow-400/10 text-yellow-100'
        : 'border-sky-400/20 bg-sky-400/10 text-sky-100';

  return (
    <div className={`rounded-2xl border px-4 py-3 ${tone}`}>
      <div className="text-xs uppercase tracking-[0.18em]">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{count}</div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'green' | 'blue' | 'neutral';
}) {
  const styles =
    tone === 'green'
      ? 'bg-green-400/10 text-green-100'
      : tone === 'blue'
        ? 'bg-sky-400/10 text-sky-100'
        : 'bg-white/5 text-foreground';

  return (
    <div className={`rounded-2xl px-3 py-3 ${styles}`}>
      <div className="text-lg font-semibold">{value}</div>
      <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

export default PrewarmManagerView;
