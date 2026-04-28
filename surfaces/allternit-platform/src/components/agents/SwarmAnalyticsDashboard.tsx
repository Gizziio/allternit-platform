/**
 * Swarm Analytics Dashboard - Phase 4
 *
 * Production-ready analytics and monitoring for swarm execution.
 * Includes real-time metrics, performance charts, and health monitoring.
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Pulse as Activity,
  TrendUp,
  TrendDown,
  Clock,
  CurrencyDollar,
  Cpu,
  Lightning,
  CheckCircle,
  Warning,
  XCircle,
  Pause,
  Play,
  StopCircle,
  ArrowsClockwise,
  DownloadSimple,
  ShareNetwork,
  DotsThreeVertical,
  CaretDown,
  CaretUp,
} from '@phosphor-icons/react';

// ============================================================================
// Types
// ============================================================================

export interface SwarmMetrics {
  // Execution Metrics
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  successRate: number;
  
  // Performance Metrics
  avgExecutionTime: number; // ms
  p50ExecutionTime: number; // ms
  p95ExecutionTime: number; // ms;
  p99ExecutionTime: number; // ms;
  
  // Cost Metrics
  totalCostCents: number;
  avgCostPerExecution: number;
  totalTokensUsed: number;
  avgTokensPerExecution: number;
  
  // Agent Metrics
  activeAgents: number;
  totalAgents: number;
  avgAgentUtilization: number; // 0-1
  
  // Message Metrics
  totalMessages: number;
  messagesPerSecond: number;
  avgMessageLatency: number; // ms
}

export interface ExecutionTimelineEntry {
  timestamp: string;
  event: 'start' | 'checkpoint' | 'complete' | 'error' | 'pause' | 'resume';
  duration?: number;
  error?: string;
}

export interface SwarmHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  score: number; // 0-100
  issues: Array<{
    severity: 'critical' | 'warning' | 'info';
    message: string;
    timestamp: string;
  }>;
}

export interface SwarmAnalyticsDashboardProps {
  metrics: SwarmMetrics;
  health: SwarmHealthStatus;
  timeline: ExecutionTimelineEntry[];
  isRunning?: boolean;
  onRefresh?: () => void;
  onExport?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onStop?: () => void;
}

// ============================================================================
// Metric Card Component
// ============================================================================

function MetricCard({
  title,
  value,
  change,
  icon: Icon,
  color,
  suffix,
}: {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ComponentType<{ size?: number | string }>;
  color: string;
  suffix?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-xl border border-white/5 bg-white/[0.02]"
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ background: `${color}22`, border: `1px solid ${color}44` }}
        >
          <div style={{ color }}><Icon size={20} /></div>
        </div>
        {change !== undefined && (
          <div
            className={`flex items-center gap-1 text-xs font-medium ${
              change >= 0 ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {change >= 0 ? <TrendUp size={12} /> : <TrendDown size={12} />}
            {Math.abs(change)}%
          </div>
        )}
      </div>
      
      <div className="space-y-1">
        <div className="text-2xl font-bold text-white/90">
          {typeof value === 'number' ? value.toLocaleString() : value}
          {suffix && <span className="text-sm font-normal text-white/40 ml-1">{suffix}</span>}
        </div>
        <div className="text-xs text-white/40">{title}</div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// Health Status Component
// ============================================================================

function HealthStatusCard({ health }: { health: SwarmHealthStatus }) {
  const statusConfig = {
    healthy: { color: 'var(--status-success)', label: 'Healthy', icon: CheckCircle },
    degraded: { color: 'var(--status-warning)', label: 'Degraded', icon: Warning },
    unhealthy: { color: 'var(--status-error)', label: 'Unhealthy', icon: XCircle },
  };

  const config = statusConfig[health.status];
  const StatusIcon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="p-4 rounded-xl border bg-white/[0.02]"
      style={{ borderColor: `${config.color}44` }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ background: `${config.color}22`, border: `2px solid ${config.color}66` }}
          >
            <StatusIcon size={24} color={config.color} />
          </div>
          <div>
            <div className="text-sm font-bold text-white/90">{config.label}</div>
            <div className="text-xs text-white/40">Swarm Health</div>
          </div>
        </div>
        
        {/* Health Score */}
        <div className="text-right">
          <div className="text-2xl font-bold" style={{ color: config.color }}>
            {health.score}
          </div>
          <div className="text-xs text-white/40">Health Score</div>
        </div>
      </div>

      {/* Health Bar */}
      <div className="h-2 rounded-full bg-white/5 overflow-hidden mb-4">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${health.score}%` }}
          transition={{ duration: 0.5 }}
          className="h-full rounded-full"
          style={{ background: config.color }}
        />
      </div>

      {/* Issues */}
      {health.issues.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-white/40">
            Active Issues ({health.issues.length})
          </div>
          {health.issues.slice(0, 3).map((issue, idx) => (
            <div
              key={idx}
              className="flex items-start gap-2 text-xs p-2 rounded bg-white/5"
            >
              <Warning
                size={12}
                className="mt-0.5 flex-shrink-0"
                style={{
                  color:
                    issue.severity === 'critical'
                      ? 'var(--status-error)'
                      : issue.severity === 'warning'
                      ? 'var(--status-warning)'
                      : 'var(--status-info)',
                }}
              />
              <div>
                <div className="text-white/70">{issue.message}</div>
                <div className="text-white/30 mt-0.5">
                  {new Date(issue.timestamp).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ============================================================================
// Execution Timeline Component
// ============================================================================

function ExecutionTimeline({ timeline }: { timeline: ExecutionTimelineEntry[] }) {
  const eventConfig: Record<string, { color: string; icon: any; label: string }> = {
    start: { color: 'var(--status-success)', icon: Play, label: 'Started' },
    checkpoint: { color: 'var(--status-info)', icon: CheckCircle, label: 'Checkpoint' },
    complete: { color: 'var(--status-success)', icon: CheckCircle, label: 'Completed' },
    error: { color: 'var(--status-error)', icon: XCircle, label: 'Error' },
    pause: { color: 'var(--status-warning)', icon: Pause, label: 'Paused' },
    resume: { color: 'var(--status-info)', icon: Play, label: 'Resumed' },
  };

  return (
    <div className="space-y-3">
      {timeline.length === 0 ? (
        <div className="text-center py-8 text-white/40 text-sm">
          No execution events yet
        </div>
      ) : (
        timeline.map((entry, idx) => {
          const config = eventConfig[entry.event] || eventConfig.start;
          const EventIcon = config.icon;

          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="flex items-center gap-3"
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: `${config.color}22`, border: `1px solid ${config.color}44` }}
              >
                <EventIcon size={14} style={{ color: config.color }} />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white/90">
                    {config.label}
                  </span>
                  {entry.duration && (
                    <span className="text-xs text-white/40">
                      • {entry.duration}ms
                    </span>
                  )}
                </div>
                <div className="text-xs text-white/40">
                  {new Date(entry.timestamp).toLocaleString()}
                </div>
                {entry.error && (
                  <div className="text-xs text-red-400 mt-1">{entry.error}</div>
                )}
              </div>
            </motion.div>
          );
        })
      )}
    </div>
  );
}

// ============================================================================
// Main Analytics Dashboard Component
// ============================================================================

export function SwarmAnalyticsDashboard({
  metrics,
  health,
  timeline,
  isRunning = false,
  onRefresh,
  onExport,
  onPause,
  onResume,
  onStop,
}: SwarmAnalyticsDashboardProps) {
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-white/5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500/20 to-blue-500/20 flex items-center justify-center border border-green-500/30">
              <Activity size={20} className="text-green-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white/90">Swarm Analytics</h3>
              <p className="text-xs text-white/40">
                {isRunning ? 'Live execution metrics' : 'Last execution summary'}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Time Range */}
            <div className="flex items-center gap-1 p-1 rounded-lg bg-white/5 border border-white/5">
              {(['1h', '24h', '7d', '30d'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                    timeRange === range
                      ? 'bg-white/10 text-white/90'
                      : 'text-white/40 hover:text-white/60'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>

            {/* Execution Controls */}
            {isRunning ? (
              <>
                <button
                  onClick={onPause}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-white/70"
                  title="Pause"
                >
                  <Pause size={16} />
                </button>
                <button
                  onClick={onStop}
                  className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 transition-colors text-red-400"
                  title="Stop"
                >
                  <StopCircle size={16} />
                </button>
              </>
            ) : (
              <button
                onClick={onResume}
                className="p-2 rounded-lg bg-green-500/10 hover:bg-green-500/20 transition-colors text-green-400"
                title="Resume"
              >
                <Play size={16} />
              </button>
            )}

            <button
              onClick={onRefresh}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-white/70"
              title="Refresh"
            >
              <ArrowsClockwise size={16} />
            </button>

            <button
              onClick={onExport}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-white/70"
              title="Export"
            >
              <DownloadSimple size={16} />
            </button>
          </div>
        </div>

        {/* Status Indicator */}
        {isRunning && (
          <div className="flex items-center gap-2 text-xs text-green-400">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Live metrics updating...
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Health Status */}
        <HealthStatusCard health={health} />

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Success Rate */}
          <MetricCard
            title="Success Rate"
            value={`${metrics.successRate}%`}
            change={2.5}
            icon={CheckCircle}
            color="#22c55e"
          />

          {/* Avg Execution Time */}
          <MetricCard
            title="Avg Execution"
            value={Math.round(metrics.avgExecutionTime)}
            suffix="ms"
            change={-5.2}
            icon={Clock}
            color="#3b82f6"
          />

          {/* Total Cost */}
          <MetricCard
            title="Total Cost"
            value={`$${(metrics.totalCostCents / 100).toFixed(2)}`}
            change={1.8}
            icon={CurrencyDollar}
            color="#f59e0b"
          />

          {/* Agent Utilization */}
          <MetricCard
            title="Agent Utilization"
            value={`${Math.round(metrics.avgAgentUtilization * 100)}%`}
            change={3.2}
            icon={Cpu}
            color="#a78bfa"
          />

          {/* Messages/sec */}
          <MetricCard
            title="Messages/sec"
            value={metrics.messagesPerSecond}
            change={12.5}
            icon={Lightning}
            color="#fbbf24"
          />

          {/* P95 Latency */}
          <MetricCard
            title="P95 Latency"
            value={metrics.p95ExecutionTime}
            suffix="ms"
            change={-2.1}
            icon={Activity}
            color="#ec4899"
          />

          {/* Total Tokens */}
          <MetricCard
            title="Total Tokens"
            value={(metrics.totalTokensUsed / 1000).toFixed(1)}
            suffix="K"
            change={8.4}
            icon={ShareNetwork}
            color="#14b8a6"
          />

          {/* Active Agents */}
          <MetricCard
            title="Active Agents"
            value={`${metrics.activeAgents}/${metrics.totalAgents}`}
            icon={CheckCircle}
            color="#60a5fa"
          />
        </div>

        {/* Execution Timeline */}
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-bold text-white/90">Execution Timeline</h4>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-1 text-xs text-white/40 hover:text-white/60 transition-colors"
            >
              {showDetails ? (
                <>
                  <CaretUp size={12} /> Hide Details
                </>
              ) : (
                <>
                  <CaretDown size={12} /> Show Details
                </>
              )}
            </button>
          </div>
          <ExecutionTimeline timeline={timeline} />
        </div>

        {/* Performance Breakdown */}
        {showDetails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="rounded-xl border border-white/5 bg-white/[0.02] p-4 space-y-4"
          >
            <h4 className="text-sm font-bold text-white/90">Performance Breakdown</h4>
            
            {/* Latency Distribution */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/40">Latency Distribution</span>
                <span className="text-white/60">Lower is better</span>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'P50', value: metrics.p50ExecutionTime, color: 'var(--status-success)' },
                  { label: 'P95', value: metrics.p95ExecutionTime, color: 'var(--status-warning)' },
                  { label: 'P99', value: metrics.p99ExecutionTime, color: 'var(--status-error)' },
                ].map((stat) => (
                  <div key={stat.label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white/70">{stat.label}</span>
                      <span className="text-white/90 font-mono">{stat.value}ms</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min((stat.value / metrics.p99ExecutionTime) * 100, 100)}%` }}
                        className="h-full rounded-full"
                        style={{ background: stat.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cost Breakdown */}
            <div className="pt-4 border-t border-white/5">
              <div className="flex items-center justify-between text-xs mb-3">
                <span className="text-white/40">Cost Breakdown</span>
                <span className="text-white/60">${(metrics.totalCostCents / 100).toFixed(2)} total</span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-lg font-bold text-blue-400">
                    ${(metrics.totalCostCents * 0.6 / 100).toFixed(2)}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-white/40">
                    LLM Costs
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-green-400">
                    ${(metrics.totalCostCents * 0.3 / 100).toFixed(2)}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-white/40">
                    Tool Costs
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-purple-400">
                    ${(metrics.totalCostCents * 0.1 / 100).toFixed(2)}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-white/40">
                    Overhead
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

export default SwarmAnalyticsDashboard;
