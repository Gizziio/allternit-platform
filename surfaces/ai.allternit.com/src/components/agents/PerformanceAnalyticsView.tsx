import { useEffect } from 'react';
import { useAgentMetricsStore } from '@/lib/agents/agent-metrics.store';
import { useAgentStore } from '@/lib/agents/agent.store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Clock, DollarSign, Zap, TrendingUp, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function PerformanceAnalyticsView() {
  const { agents } = useAgentStore();
  const { metrics, summary, isLoading, timeRange, fetchMetrics, setTimeRange } = useAgentMetricsStore();

  useEffect(() => {
    fetchMetrics();
  }, [timeRange]);

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
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-cyan-400" />
            Performance Analytics
          </h2>
          <p className="text-sm text-white/50 mt-1">
            Cost, latency, and reliability metrics across all agents
          </p>
        </div>
        <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
          {timeRangeOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTimeRange(opt.value)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                timeRange === opt.value
                  ? 'bg-cyan-500/20 text-cyan-400'
                  : 'text-white/50 hover:text-white/80'
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
          icon={<Activity className="h-4 w-4 text-emerald-400" />}
          label="Total Runs"
          value={totalRuns.toLocaleString()}
          trend="+12%"
        />
        <MetricCard
          icon={<Clock className="h-4 w-4 text-amber-400" />}
          label="Avg Latency"
          value={`${Math.round(avgLatency)}ms`}
          trend="-8%"
        />
        <MetricCard
          icon={<Zap className="h-4 w-4 text-cyan-400" />}
          label="Tokens Consumed"
          value={totalTokens.toLocaleString()}
          trend="+23%"
        />
        <MetricCard
          icon={<DollarSign className="h-4 w-4 text-rose-400" />}
          label="Est. Cost"
          value={`$${totalCost.toFixed(2)}`}
          trend="-3%"
        />
      </div>

      {/* Agent Breakdown */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-white/80 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-cyan-400" />
            Agent Performance Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-white/40">Loading metrics...</div>
          ) : summary.length === 0 ? (
            <div className="text-center py-8 text-white/40">
              No metrics available yet. Run some agents to collect data.
            </div>
          ) : (
            <div className="space-y-3">
              {summary.map((s) => {
                const agent = agents.find((a) => a.id === s.agentId);
                return (
                  <div
                    key={s.agentId}
                    className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 text-xs font-bold">
                        {agent?.name?.charAt(0).toUpperCase() || 'A'}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">
                          {agent?.name || 'Unknown Agent'}
                        </p>
                        <p className="text-xs text-white/40">
                          {s.totalRuns} runs · {Math.round(s.avgLatency)}ms avg
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary" className="bg-white/5 text-white/60">
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
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-white/80">Recent Events</CardTitle>
        </CardHeader>
        <CardContent>
          {metrics.length === 0 ? (
            <div className="text-center py-8 text-white/40">No recent events</div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-auto">
              {metrics.slice(0, 20).map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between text-xs p-2 rounded bg-white/5"
                >
                  <span className="text-white/60 capitalize">{m.metricType.replace('_', ' ')}</span>
                  <span className="text-white font-mono">
                    {m.value.toFixed(m.metricType === 'latency' ? 0 : 2)} {m.unit}
                  </span>
                  <span className="text-white/30">
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
  trend,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  trend: string;
}) {
  const isPositive = trend.startsWith('+');
  return (
    <Card className="bg-white/5 border-white/10">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="p-2 rounded-lg bg-white/5">{icon}</div>
          <span
            className={cn(
              'text-xs font-medium',
              isPositive ? 'text-emerald-400' : 'text-rose-400'
            )}
          >
            {trend}
          </span>
        </div>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-xs text-white/50 mt-1">{label}</p>
      </CardContent>
    </Card>
  );
}
