/**
 * Circuit Breaker & Activity Feed Monitor
 *
 * Production monitoring for swarm health including circuit breakers,
 * quarantine status, and real-time activity feed.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lightning,
  Shield,
  Warning,
  CheckCircle,
  XCircle,
  Clock,
  ArrowsClockwise,
  Lock,
  LockOpen,
  Pulse as Activity,
  Chat,
  Users,
  TrendUp,
  Funnel,
  DownloadSimple,
} from '@phosphor-icons/react';

// ============================================================================
// Types
// ============================================================================

export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerStatus {
  agent_id: string;
  agent_name?: string;
  state: CircuitBreakerState;
  failure_count: number;
  success_count: number;
  last_failure_at?: string;
  last_state_change?: string;
  threshold: number;
  reset_timeout_secs: number;
}

export interface QuarantinedAgent {
  agent_id: string;
  agent_name?: string;
  quarantined_at: string;
  expires_at: string;
  reason: string;
  remaining_minutes: number;
  severity: 'critical' | 'warning' | 'info';
}

export interface ActivityFeedEntry {
  id: string;
  timestamp: string;
  type: 'message' | 'tool_use' | 'checkpoint' | 'error' | 'state_change' | 'human_review';
  agent?: {
    id: string;
    name: string;
    role: string;
  };
  summary: string;
  details?: string;
  metadata?: {
    duration?: number;
    tokens?: number;
    cost?: number;
  };
}

export interface SwarmMonitorProps {
  circuitBreakers: CircuitBreakerStatus[];
  quarantinedAgents: QuarantinedAgent[];
  activityFeed: ActivityFeedEntry[];
  onResetBreaker?: (agentId: string) => void;
  onReleaseQuarantine?: (agentId: string) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
}

// ============================================================================
// Circuit Breaker Card
// ============================================================================

function CircuitBreakerCard({
  breaker,
  onReset,
}: {
  breaker: CircuitBreakerStatus;
  onReset?: (agentId: string) => void;
}) {
  const stateConfig: Record<CircuitBreakerState, { color: string; label: string; icon: any }> = {
    closed: { color: '#22c55e', label: 'Closed', icon: CheckCircle },
    open: { color: '#ef4444', label: 'Open', icon: XCircle },
    'half-open': { color: '#f59e0b', label: 'Half-Open', icon: Warning },
  };

  const config = stateConfig[breaker.state];
  const StateIcon = config.icon;

  const failureRate =
    breaker.failure_count + breaker.success_count > 0
      ? (breaker.failure_count / (breaker.failure_count + breaker.success_count)) * 100
      : 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="p-4 rounded-xl border bg-white/[0.02]"
      style={{ borderColor: `${config.color}44` }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ background: `${config.color}22`, border: `1px solid ${config.color}44` }}
          >
            <Lightning size={20} style={{ color: config.color }} />
          </div>
          <div>
            <div className="text-sm font-bold text-white/90">
              {breaker.agent_name || breaker.agent_id}
            </div>
            <div className="text-xs text-white/40">Agent ID: {breaker.agent_id.slice(0, 8)}...</div>
          </div>
        </div>

        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider"
          style={{ background: `${config.color}22`, color: config.color }}
        >
          <StateIcon size={12} />
          {config.label}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-3 rounded-lg bg-white/5">
          <div className="text-xs text-white/40 mb-1">Success Rate</div>
          <div className="text-lg font-bold text-white/90">
            {Math.round(100 - failureRate)}%
          </div>
        </div>
        <div className="p-3 rounded-lg bg-white/5">
          <div className="text-xs text-white/40 mb-1">Failures</div>
          <div className="text-lg font-bold text-white/90">{breaker.failure_count}</div>
        </div>
      </div>

      {/* Failure Rate Bar */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/40">Failure Rate</span>
          <span className="text-white/60">{Math.round(failureRate)}%</span>
        </div>
        <div className="h-2 rounded-full bg-white/5 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${failureRate}%` }}
            className="h-full rounded-full"
            style={{
              background: `linear-gradient(90deg, ${config.color} 0%, ${config.color}88 100%)`,
            }}
          />
        </div>
      </div>

      {/* Actions */}
      {breaker.state === 'open' && onReset && (
        <button
          onClick={() => onReset(breaker.agent_id)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-green-500/20 hover:bg-green-500/30 transition-colors text-green-400 text-sm font-medium"
        >
          <ArrowsClockwise size={14} />
          Reset Circuit Breaker
        </button>
      )}

      {/* Last State Change */}
      {breaker.last_state_change && (
        <div className="mt-3 text-xs text-white/30 text-center">
          Last state change: {new Date(breaker.last_state_change).toLocaleString()}
        </div>
      )}
    </motion.div>
  );
}

// ============================================================================
// Quarantined Agent Card
// ============================================================================

function QuarantineCard({
  agent,
  onRelease,
}: {
  agent: QuarantinedAgent;
  onRelease?: (agentId: string) => void;
}) {
  const severityConfig = {
    critical: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
    warning: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
    info: { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },
  };

  const config = severityConfig[agent.severity];

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="p-4 rounded-xl border bg-white/[0.02]"
      style={{ borderColor: `${config.color}44` }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ background: config.bg, border: `1px solid ${config.color}44` }}
          >
            <Lock size={20} style={{ color: config.color }} />
          </div>
          <div>
            <div className="text-sm font-bold text-white/90">
              {agent.agent_name || agent.agent_id}
            </div>
            <div className="text-xs text-white/40">
              Quarantined {new Date(agent.quarantined_at).toLocaleDateString()}
            </div>
          </div>
        </div>

        <div
          className="px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider"
          style={{ background: config.bg, color: config.color }}
        >
          {agent.severity}
        </div>
      </div>

      {/* Reason */}
      <div className="p-3 rounded-lg bg-white/5 mb-4">
        <div className="text-xs text-white/40 mb-1">Reason</div>
        <div className="text-sm text-white/80">{agent.reason}</div>
      </div>

      {/* Time Remaining */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-xs text-white/40">
          <Clock size={12} />
          <span>Time Remaining</span>
        </div>
        <div className="text-sm font-bold" style={{ color: config.color }}>
          {agent.remaining_minutes} minutes
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-2 rounded-full bg-white/5 overflow-hidden mb-4">
        <motion.div
          initial={{ width: '100%' }}
          animate={{ width: `${(agent.remaining_minutes / 15) * 100}%` }}
          className="h-full rounded-full"
          style={{ background: config.color }}
        />
      </div>

      {/* Release Button */}
      {onRelease && (
        <button
          onClick={() => onRelease(agent.agent_id)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 transition-colors text-blue-400 text-sm font-medium"
        >
          <LockOpen size={14} />
          Release from Quarantine
        </button>
      )}
    </motion.div>
  );
}

// ============================================================================
// Activity Feed Entry
// ============================================================================

function ActivityFeedItem({ entry }: { entry: ActivityFeedEntry }) {
  const typeConfig: Record<string, { color: string; icon: any; label: string }> = {
    message: { color: '#3b82f6', icon: Chat, label: 'Message' },
    tool_use: { color: '#f59e0b', icon: Lightning, label: 'Tool Use' },
    checkpoint: { color: '#22c55e', icon: CheckCircle, label: 'Checkpoint' },
    error: { color: '#ef4444', icon: Warning, label: 'Error' },
    state_change: { color: '#a78bfa', icon: Activity, label: 'State Change' },
    human_review: { color: '#ec4899', icon: Users, label: 'Human Review' },
  };

  const config = typeConfig[entry.type] || typeConfig.message;
  const TypeIcon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors"
    >
      {/* Icon */}
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: `${config.color}22`, border: `1px solid ${config.color}44` }}
      >
        <TypeIcon size={16} style={{ color: config.color }} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: config.color }}>
            {config.label}
          </span>
          <span className="text-xs text-white/40">
            {new Date(entry.timestamp).toLocaleTimeString()}
          </span>
          {entry.agent && (
            <>
              <span className="text-white/30">•</span>
              <span className="text-xs text-white/60">{entry.agent.name}</span>
            </>
          )}
        </div>

        <div className="text-sm text-white/80">{entry.summary}</div>

        {entry.details && (
          <div className="mt-2 text-xs text-white/60 whitespace-pre-wrap">{entry.details}</div>
        )}

        {/* Metadata */}
        {entry.metadata && (
          <div className="flex items-center gap-3 mt-2 text-xs text-white/40">
            {entry.metadata.duration && (
              <span className="flex items-center gap-1">
                <Clock size={10} />
                {entry.metadata.duration}ms
              </span>
            )}
            {entry.metadata.tokens && (
              <span className="flex items-center gap-1">
                <Activity size={10} />
                {entry.metadata.tokens.toLocaleString()} tokens
              </span>
            )}
            {entry.metadata.cost && (
              <span className="flex items-center gap-1">
                <TrendUp size={10} />
                ${entry.metadata.cost.toFixed(2)}
              </span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ============================================================================
// Main Swarm Monitor Component
// ============================================================================

export function SwarmMonitor({
  circuitBreakers,
  quarantinedAgents,
  activityFeed,
  onResetBreaker,
  onReleaseQuarantine,
  onRefresh,
  isLoading = false,
}: SwarmMonitorProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'breakers' | 'quarantine' | 'feed'>('overview');
  const [feedFilter, setFeedFilter] = useState<string>('all');

  const openBreakers = circuitBreakers.filter((b) => b.state === 'open').length;
  const totalBreakers = circuitBreakers.length;

  const filteredFeed =
    feedFilter === 'all'
      ? activityFeed
      : activityFeed.filter((e) => e.type === feedFilter);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-white/5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-500/20 to-red-500/20 flex items-center justify-center border border-yellow-500/30">
              <Shield size={20} className="text-yellow-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white/90">Swarm Monitor</h3>
              <p className="text-xs text-white/40">
                {openBreakers > 0
                  ? `${openBreakers} circuit breakers open`
                  : 'All systems operational'}
              </p>
            </div>
          </div>

          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-white/70"
          >
            <ArrowsClockwise size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2">
          {(['overview', 'breakers', 'quarantine', 'feed'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium uppercase tracking-wider transition-colors ${
                activeTab === tab
                  ? 'bg-white/10 text-white/90'
                  : 'text-white/40 hover:text-white/60'
              }`}
            >
              {tab}
              {tab === 'breakers' && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-white/20 text-[10px]">
                  {totalBreakers}
                </span>
              )}
              {tab === 'quarantine' && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-white/20 text-[10px]">
                  {quarantinedAgents.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl border border-green-500/30 bg-green-500/10">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle size={16} className="text-green-400" />
                  <span className="text-xs text-green-300">Healthy</span>
                </div>
                <div className="text-2xl font-bold text-white/90">
                  {totalBreakers - openBreakers}
                </div>
                <div className="text-xs text-white/40">Closed Breakers</div>
              </div>

              <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10">
                <div className="flex items-center gap-2 mb-2">
                  <XCircle size={16} className="text-red-400" />
                  <span className="text-xs text-red-300">Open</span>
                </div>
                <div className="text-2xl font-bold text-white/90">{openBreakers}</div>
                <div className="text-xs text-white/40">Open Breakers</div>
              </div>

              <div className="p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10">
                <div className="flex items-center gap-2 mb-2">
                  <Lock size={16} className="text-yellow-400" />
                  <span className="text-xs text-yellow-300">Quarantined</span>
                </div>
                <div className="text-2xl font-bold text-white/90">
                  {quarantinedAgents.length}
                </div>
                <div className="text-xs text-white/40">Agents Isolated</div>
              </div>

              <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/10">
                <div className="flex items-center gap-2 mb-2">
                  <Activity size={16} className="text-blue-400" />
                  <span className="text-xs text-blue-300">Activity</span>
                </div>
                <div className="text-2xl font-bold text-white/90">
                  {activityFeed.length}
                </div>
                <div className="text-xs text-white/40">Events (24h)</div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-bold text-white/90">Recent Activity</h4>
                <button
                  onClick={() => setActiveTab('feed')}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  View All →
                </button>
              </div>
              <div className="space-y-2">
                {activityFeed.slice(0, 5).map((entry) => (
                  <ActivityFeedItem key={entry.id} entry={entry} />
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'breakers' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {circuitBreakers.map((breaker) => (
              <CircuitBreakerCard
                key={breaker.agent_id}
                breaker={breaker}
                onReset={onResetBreaker}
              />
            ))}
          </div>
        )}

        {activeTab === 'quarantine' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {quarantinedAgents.map((agent) => (
              <QuarantineCard
                key={agent.agent_id}
                agent={agent}
                onRelease={onReleaseQuarantine}
              />
            ))}
          </div>
        )}

        {activeTab === 'feed' && (
          <div className="space-y-4">
            {/* Filter */}
            <div className="flex items-center gap-2">
              <Funnel size={14} className="text-white/40" />
              <select
                value={feedFilter}
                onChange={(e) => setFeedFilter(e.target.value)}
                className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white/90 outline-none"
              >
                <option value="all">All Events</option>
                <option value="message">Messages</option>
                <option value="tool_use">Tool Use</option>
                <option value="checkpoint">Checkpoints</option>
                <option value="error">Errors</option>
                <option value="state_change">State Changes</option>
                <option value="human_review">Human Review</option>
              </select>
              <button className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-white/70">
                <DownloadSimple size={14} />
              </button>
            </div>

            {/* Feed */}
            <div className="space-y-2">
              {filteredFeed.length === 0 ? (
                <div className="text-center py-8 text-white/40 text-sm">
                  No activity events found
                </div>
              ) : (
                filteredFeed.map((entry) => (
                  <ActivityFeedItem key={entry.id} entry={entry} />
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SwarmMonitor;
