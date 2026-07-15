import React, { useEffect } from 'react';
import { useAgentMetricsStore } from '@/lib/agents/agent-metrics.store';
import { useAgentStore } from '@/lib/agents/agent.store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Pulse,
  Clock,
  CurrencyDollar,
  Lightning,
  TrendUp,
  ChartBar,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

export function PerformanceAnalyticsView() {
  const { agents } = useAgentStore();
  const { metrics, summary, isLoading, timeRange, fetchMetrics, setTimeRange } = useAgentMetricsStore();

  useEffect(() => {
    fetchMetrics();
  }, [timeRange, fetchMetrics]);
  const timeRangeOptions: { label: string; value: typeof timeRange }[] = [
    { label: '1H', value: '1h' },
    { label: '24H', value: '24h' },
    { label: '7D', value: '7d' },
    { label: '30D', value: '30d' },
  ];

  const totalRuns = summary.reduce((acc, s) => acc + s.totalRuns, 0);
  const avgLatency = summary.length
    ? summary.reduce((acc, s) => acc + s.avgLatency, 0) / summary.length
    : 0;
  const totalTokens = summary.reduce((acc, s) => acc + s.totalTokens, 0);
  const totalCost = summary.reduce((acc, s) => acc + s.totalCost, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <ChartBar className="size-5 text-[var(--accent-primary)]" />
            Performance Analytics
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Cost, latency, and reliability metrics across all agents
          </p>
        </div>
        <div className="flex items-center gap-1 bg-[var(--surface-hover)] rounded-lg p-1">
          {timeRangeOptions.map((opt) => (
            <button type="button"
              key={opt.value}
              onClick={() => setTimeRange(opt.value)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                timeRange === opt.value
                  ? 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={<Pulse className="size-4 text-emerald-400" />}
          label="Total Runs"
          value={totalRuns.toLocaleString()}
        />
        <MetricCard
          icon={<Clock className="size-4 text-amber-400" />}
          label="Avg Latency"
          value={`${Math.round(avgLatency)}ms`}
        />
        <MetricCard
          icon={<Lightning className="size-4 text-cyan-400" />}
          label="Tokens Consumed"
          value={totalTokens.toLocaleString()}
        />
        <MetricCard
          icon={<CurrencyDollar className="size-4 text-rose-400" />}
          label="Est. Cost"
          value={`$${totalCost.toFixed(2)}`}
        />
      </div>

      {/* Agent Breakdown */}
      <Card className="bg-[var(--surface-hover)] border-[var(--border-subtle)]">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-[var(--text-secondary)] flex items-center gap-2">
            <TrendUp className="size-4 text-[var(--accent-primary)]" />
            Agent Performance Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-[var(--text-tertiary)]">Loading metrics…</div>
          ) : summary.length === 0 ? (
            <div className="text-center py-8 text-[var(--text-tertiary)]">
              No metrics available yet. Run some agents to collect data.
            </div>
          ) : (
            <div className="space-y-3">
              {summary.map((s) => {
                const agent = agents.find((a) => a.id === s.agentId);
                return (
                  <div
                    key={s.agentId}
                    className="flex items-center justify-between p-3 rounded-lg bg-[var(--surface-hover)] hover:bg-[var(--surface-panel)] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-full bg-[var(--accent-primary)]/20 flex items-center justify-center text-[var(--accent-primary)] text-xs font-bold">
                        {agent?.name?.charAt(0).toUpperCase() || 'A'}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[var(--text-primary)]">
                          {agent?.name || 'Unknown Agent'}
                        </p>
                        <p className="text-xs text-[var(--text-tertiary)]">
                          {s.totalRuns} runs · {Math.round(s.avgLatency)}ms avg
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary" className="bg-[var(--surface-panel)] text-[var(--text-secondary)]">
                        {s.totalTokens.toLocaleString()} tokens
                      </Badge>
                      <Badge
                        variant="secondary"
                        className={cn(
                          s.successRate >= 95
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : s.successRate >= 80
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-rose-500/20 text-rose-400'
                        )}
                      >
                        {s.successRate.toFixed(0)}%
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Metrics */}
      <Card className="bg-[var(--surface-hover)] border-[var(--border-subtle)]">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-[var(--text-secondary)]">Recent Events</CardTitle>
        </CardHeader>
        <CardContent>
          {metrics.length === 0 ? (
            <div className="text-center py-8 text-[var(--text-tertiary)]">No recent events</div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-auto">
              {metrics.slice(0, 20).map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between text-xs p-2 rounded bg-[var(--surface-hover)]"
                >
                  <span className="text-[var(--text-secondary)] capitalize">{m.metricType.replace('_', ' ')}</span>
                  <span className="text-[var(--text-primary)] font-mono">
                    {m.value.toFixed(m.metricType === 'latency' ? 0 : 2)} {m.unit}
                  </span>
                  <span className="text-[var(--text-tertiary)]">
                    {new Date(m.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card className="bg-[var(--surface-hover)] border-[var(--border-subtle)]">
      <CardContent className="p-4">
        <div className="flex items-center mb-2">
          <div className="p-2 rounded-lg bg-[var(--surface-panel)]">{icon}</div>
        </div>
        <p className="text-2xl font-bold text-[var(--text-primary)]">{value}</p>
        <p className="text-xs text-[var(--text-secondary)] mt-1">{label}</p>
      </CardContent>
    </Card>
  );
}
