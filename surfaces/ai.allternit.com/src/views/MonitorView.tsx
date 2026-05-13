import React, { useState, useEffect } from 'react';
import { GlassCard } from '../design/glass/GlassCard';
import { tokens } from '../design/tokens';
import {
  Robot,
  Clock,
  Warning,
  CheckCircle,
  ArrowClockwise,
  Cpu,
  HardDrive,
  ArrowUp,
  ArrowDown,
  Circle,
  Play,
  Pause,
  ChartLine,
  Gear,
  Pulse as Activity,
} from '@phosphor-icons/react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgentMetric {
  id: string;
  name: string;
  status: 'active' | 'idle' | 'error' | 'paused';
  type: string;
  model: string;
  taskCount: number;
  tokensUsed: number;
  latencyMs: number;
  uptime: string;
  lastActivity: string;
  memMb: number;
}

interface SystemMetric {
  label: string;
  value: string;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  trendValue: string;
  color: string;
}

interface LogEntry {
  id: string;
  time: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  agent: string;
  message: string;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<AgentMetric['status'], { color: string; label: string; dotColor: string }> = {
  active:  { color: 'var(--status-success)', label: 'Active',  dotColor: 'var(--status-success)' },
  idle:    { color: 'var(--ui-text-muted)', label: 'Idle',    dotColor: 'var(--ui-text-muted)' },
  error:   { color: 'var(--status-error)', label: 'Error',   dotColor: 'var(--status-error)' },
  paused:  { color: 'var(--status-warning)', label: 'Paused',  dotColor: 'var(--status-warning)' },
};

const LOG_LEVEL_CONFIG: Record<LogEntry['level'], { color: string; bg: string }> = {
  info:  { color: 'var(--ui-text-muted)', bg: 'var(--surface-hover)' },
  warn:  { color: 'var(--status-warning)', bg: 'var(--status-warning-bg)' },
  error: { color: 'var(--status-error)', bg: 'var(--status-error-bg)' },
  debug: { color: 'var(--ui-text-muted)', bg: 'transparent' },
};

function StatusDot({ status }: { status: AgentMetric['status'] }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span 
      className="inline-block size-2 rounded-full shrink-0"
      style={{
        background: cfg.dotColor,
        boxShadow: status === 'active' ? `0 0 6px ${cfg.dotColor}` : 'none',
      }} 
    />
  );
}

function MetricCard({ metric }: { metric: SystemMetric }) {
  const TrendIcon = metric.trend === 'up' ? ArrowUp : metric.trend === 'down' ? ArrowDown : Circle;
  return (
    <GlassCard className="p-5 px-6 flex-1 min-w-[160px]">
      <div className="text-[12px] font-semibold text-[var(--text-tertiary)] mb-2 uppercase tracking-[0.06em]">
        {metric.label}
      </div>
      <div className="flex items-baseline gap-1.5 mb-1">
        <span 
          className="text-[32px] font-extrabold tabular-nums"
          style={{ color: metric.color }}
        >
          {metric.value}
        </span>
        <span className="text-[13px] text-[var(--text-tertiary)]">{metric.unit}</span>
      </div>
      <div className={`flex items-center gap-1 text-[12px] ${
        metric.trend === 'up' ? 'text-[var(--status-warning)]' : 
        metric.trend === 'down' ? 'text-[var(--status-success)]' : 
        'text-[var(--text-tertiary)]'
      }`}>
        <TrendIcon size={12} weight="bold" />
        {metric.trendValue} vs yesterday
      </div>
    </GlassCard>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function MonitorView() {
  const [agents, setAgents] = useState<AgentMetric[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetric[]>([]);
  const [activeTab, setActiveTab] = useState<'agents' | 'logs'>('agents');
  const [logFilter, setLogFilter] = useState<'all' | 'info' | 'warn' | 'error'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  const loadData = () => {
    fetch('/api/v1/monitor/agents').then(r => r.json()).then(setAgents).catch(() => {});
    fetch('/api/v1/monitor/logs').then(r => r.json()).then(setLogs).catch(() => {});
    fetch('/api/v1/monitor/system').then(r => r.json()).then(setSystemMetrics).catch(() => {});
  };

  useEffect(() => { loadData(); }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
    setTimeout(() => setRefreshing(false), 600);
  };

  const activeCount  = agents.filter(a => a.status === 'active').length;
  const errorCount   = agents.filter(a => a.status === 'error').length;
  const totalTokens  = agents.reduce((s, a) => s + a.tokensUsed, 0);
  const avgLatency   = agents.length > 0 ? Math.round(agents.filter(a => a.latencyMs > 0).reduce((s, a) => s + a.latencyMs, 0) / (agents.filter(a => a.latencyMs > 0).length || 1)) : 0;

  const filteredLogs = logFilter === 'all' ? logs : logs.filter(l => l.level === logFilter);

  const TABS: { id: 'agents' | 'logs'; label: string }[] = [
    { id: 'agents', label: 'Agents' },
    { id: 'logs', label: 'System Log' },
  ];

  return (
    <div className="p-8 h-full overflow-auto box-border">

      {/* ── Header ── */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-extrabold m-0 tracking-tight">
            Agent Monitor
          </h1>
          <p className="m-0 mt-1.5 text-sm text-[var(--text-tertiary)]">
            Live view of all running agents and system activity
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-2 p-2.5 px-[18px] rounded-[10px] bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-semibold text-[13px] cursor-pointer transition-all hover:bg-[var(--surface-hover)] active:scale-95"
        >
          <ArrowClockwise 
            size={16} 
            weight="bold" 
            className={refreshing ? 'animate-spin' : ''} 
          />
          Refresh
        </button>
      </div>

      {/* ── System Metrics Row ── */}
      <div className="flex gap-4 mb-8 flex-wrap">
        {systemMetrics.map(m => <MetricCard key={m.label} metric={m} />)}
      </div>

      {/* ── Quick Stats Chips ── */}
      <div className="flex gap-3 mb-7 flex-wrap">
        {[
          { icon: Robot,      label: `${agents.length} total agents`,    color: 'var(--text-secondary)' },
          { icon: CheckCircle,label: `${activeCount} active`,            color: 'var(--status-success)' },
          { icon: Warning,    label: `${errorCount} with errors`,        color: 'var(--status-error)' },
          { icon: Cpu,        label: `Avg ${avgLatency}ms latency`,      color: 'var(--accent-chat)' },
          { icon: ChartLine,  label: `${(totalTokens/1000).toFixed(0)}K tokens today`, color: 'var(--accent-primary)' },
        ].map(({ icon: Icon, label, color }) => (
          <div key={label} className="flex items-center gap-1.5 p-1.5 px-3.5 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[13px] font-medium" style={{ color }}>
            <Icon size={14} weight="bold" />
            {label}
          </div>
        ))}
      </div>

      {/* ── Tab Bar ── */}
      <div className="flex gap-0 mb-5 border-b border-[var(--border-subtle)]">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`p-2.5 px-5 bg-transparent border-none cursor-pointer transition-all text-sm ${
              activeTab === tab.id 
                ? 'border-b-2 border-solid border-[var(--accent-chat)] text-[var(--text-primary)] font-bold' 
                : 'border-b-2 border-solid border-transparent text-[var(--text-tertiary)] font-normal hover:text-[var(--text-secondary)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Agents Tab ── */}
      {activeTab === 'agents' && (
        <div className="flex flex-col gap-2.5">
          {agents.map(agent => {
            const cfg = STATUS_CONFIG[agent.status];
            const isSelected = selectedAgent === agent.id;
            return (
              <GlassCard
                key={agent.id}
                className={`p-4 px-5 cursor-pointer transition-[border-color] duration-150 ${
                  isSelected ? 'border-solid' : ''
                }`}
                style={{
                  borderColor: isSelected ? `${cfg.color}40` : undefined,
                }}
                onClick={() => setSelectedAgent(isSelected ? null : agent.id)}
              >
                <div className="flex items-center gap-4">
                  {/* Status + Name */}
                  <div className="flex items-center gap-2.5 min-w-[200px]">
                    <StatusDot status={agent.status} />
                    <div>
                      <div className="font-bold text-sm font-mono text-[var(--text-primary)]">
                        {agent.name}
                      </div>
                      <div className="text-[12px] text-[var(--text-tertiary)] mt-0.5">
                        {agent.type} · {agent.model}
                      </div>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <span className="p-1 px-2.5 rounded-full text-[12px] font-bold tracking-wider uppercase" style={{ background: `${cfg.color}18`, color: cfg.color }}>
                    {cfg.label}
                  </span>

                  {/* Stats */}
                  <div className="flex gap-6 ml-auto">
                    {[
                      { label: 'Tasks', value: agent.taskCount.toString() },
                      { label: 'Tokens', value: agent.tokensUsed >= 1000 ? `${(agent.tokensUsed/1000).toFixed(1)}K` : agent.tokensUsed.toString() },
                      { label: 'Latency', value: agent.latencyMs > 0 ? `${agent.latencyMs}ms` : '—' },
                      { label: 'Uptime', value: agent.uptime },
                      { label: 'Last Active', value: agent.lastActivity },
                    ].map(({ label, value }) => (
                      <div key={label} className="text-right">
                        <div className="text-[12px] text-[var(--text-tertiary)] mb-0.5">{label}</div>
                        <div className="text-[13px] font-semibold tabular-nums">{value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1.5 ml-4">
                    {agent.status === 'active' && (
                      <ActionBtn icon={Pause} title="Pause" onClick={e => { e.stopPropagation(); }} />
                    )}
                    {agent.status === 'paused' && (
                      <ActionBtn icon={Play} title="Resume" onClick={e => { e.stopPropagation(); }} />
                    )}
                    {agent.status === 'error' && (
                      <ActionBtn icon={ArrowClockwise} title="Restart" onClick={e => { e.stopPropagation(); }} color="#ff9f0a" />
                    )}
                    <ActionBtn icon={Gear} title="Configure" onClick={e => { e.stopPropagation(); }} />
                  </div>
                </div>

                {/* Expanded Detail Row */}
                {isSelected && (
                  <div className="mt-4 pt-4 border-t border-[var(--border-subtle)] grid grid-cols-4 gap-4">
                    {[
                      { icon: HardDrive, label: 'Memory', value: `${agent.memMb} MB` },
                      { icon: Cpu,       label: 'Model',   value: agent.model },
                      { icon: Clock,     label: 'Uptime',  value: agent.uptime },
                      { icon: Activity,  label: 'Status',  value: cfg.label },
                    ].map(({ icon: Icon, label, value }) => (
                      <div key={label} className="bg-[var(--bg-primary)] rounded-[10px] p-3 px-4 flex items-center gap-3">
                        <Icon size={20} weight="duotone" className="text-[var(--accent-primary)] shrink-0" />
                        <div>
                          <div className="text-[12px] text-[var(--text-tertiary)] mb-0.5">{label}</div>
                          <div className="text-[13px] font-bold">{value}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>
            );
          })}
        </div>
      )}

      {/* ── Logs Tab ── */}
      {activeTab === 'logs' && (
        <div>
          {/* Log Level Filter */}
          <div className="flex gap-2 mb-4">
            {(['all', 'info', 'warn', 'error'] as const).map(level => (
              <button
                key={level}
                onClick={() => setLogFilter(level)}
                className={`p-1.5 px-4 rounded-full border border-solid text-[12px] font-semibold cursor-pointer uppercase tracking-wider transition-all ${
                  logFilter === level 
                    ? 'bg-[var(--accent-chat)] border-transparent text-[var(--ui-text-inverse)]' 
                    : 'bg-[var(--bg-secondary)] border-[var(--border-subtle)] text-[var(--ui-text-secondary)] hover:bg-[var(--surface-hover)]'
                }`}
              >
                {level}
              </button>
            ))}
            <span className="ml-auto text-[12px] text-[var(--text-tertiary)] self-center">
              {filteredLogs.length} entries
            </span>
          </div>

          {/* Log Entries */}
          <GlassCard className="p-0 overflow-hidden">
            {filteredLogs.map((entry, idx) => {
              const cfg = LOG_LEVEL_CONFIG[entry.level];
              return (
                <div
                  key={entry.id}
                  className={`grid grid-cols-[80px_50px_140px_1fr] gap-4 p-2.5 px-4 items-center ${
                    idx < filteredLogs.length - 1 ? 'border-b border-solid border-[var(--border-subtle)]' : ''
                  }`}
                  style={{ background: cfg.bg }}
                >
                  <span className="text-[12px] font-mono text-[var(--text-tertiary)]">
                    {entry.time}
                  </span>
                  <span className="text-[12px] font-bold uppercase tracking-widest" style={{ color: cfg.color }}>
                    {entry.level}
                  </span>
                  <span className="text-[12px] font-mono text-[var(--text-secondary)] truncate">
                    {entry.agent}
                  </span>
                  <span className="text-[13px] text-[var(--text-primary)]">
                    {entry.message}
                  </span>
                </div>
              );
            })}
          </GlassCard>
        </div>
      )}
    </div>
  );
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function ActionBtn({
  icon: Icon,
  title,
  onClick,
  color = 'var(--text-tertiary)',
}: {
  icon: React.ElementType;
  title: string;
  onClick: (e: React.MouseEvent) => void;
  color?: string;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="size-8 rounded-lg border-none bg-[var(--bg-primary)] flex items-center justify-center cursor-pointer transition-colors duration-150 hover:bg-[var(--bg-secondary)]"
      style={{ color }}
    >
      <Icon size={15} weight="bold" />
    </button>
  );
}
