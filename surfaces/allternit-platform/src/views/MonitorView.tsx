import React, { useState, useEffect } from 'react';
import { GlassCard } from '../design/GlassCard';
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
  X,
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
  active:  { color: '#34c759', label: 'Active',  dotColor: '#34c759' },
  idle:    { color: '#aeaeae', label: 'Idle',    dotColor: '#aeaeae' },
  error:   { color: '#ff3b30', label: 'Error',   dotColor: '#ff3b30' },
  paused:  { color: '#ff9f0a', label: 'Paused',  dotColor: '#ff9f0a' },
};

const LOG_LEVEL_CONFIG: Record<LogEntry['level'], { color: string; bg: string }> = {
  info:  { color: '#aeaeae', bg: 'rgba(174,174,174,0.08)' },
  warn:  { color: '#ff9f0a', bg: 'rgba(255,159,10,0.08)' },
  error: { color: '#ff3b30', bg: 'rgba(255,59,48,0.10)' },
  debug: { color: '#636366', bg: 'transparent' },
};

function StatusDot({ status }: { status: AgentMetric['status'] }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span style={{
      display: 'inline-block',
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: cfg.dotColor,
      boxShadow: status === 'active' ? `0 0 6px ${cfg.dotColor}` : 'none',
      flexShrink: 0,
    }} />
  );
}

function MetricCard({ metric }: { metric: SystemMetric }) {
  const TrendIcon = metric.trend === 'up' ? ArrowUp : metric.trend === 'down' ? ArrowDown : Circle;
  return (
    <GlassCard style={{ padding: '20px 24px', flex: 1, minWidth: 160 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {metric.label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 32, fontWeight: 800, color: metric.color, fontVariantNumeric: 'tabular-nums' }}>
          {metric.value}
        </span>
        <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{metric.unit}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: metric.trend === 'up' ? '#ff9f0a' : metric.trend === 'down' ? '#34c759' : 'var(--text-tertiary)' }}>
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
  const avgLatency   = Math.round(agents.filter(a => a.latencyMs > 0).reduce((s, a) => s + a.latencyMs, 0) / agents.filter(a => a.latencyMs > 0).length);

  const filteredLogs = logFilter === 'all' ? logs : logs.filter(l => l.level === logFilter);

  const TABS: { id: 'agents' | 'logs'; label: string }[] = [
    { id: 'agents', label: 'Agents' },
    { id: 'logs', label: 'System Log' },
  ];

  return (
    <div style={{ padding: 32, height: '100%', overflow: 'auto', boxSizing: 'border-box' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
            Agent Monitor
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--text-tertiary)' }}>
            Live view of all running agents and system activity
          </p>
        </div>
        <button
          onClick={handleRefresh}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 18px', borderRadius: 10,
            background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)', fontWeight: 600, fontSize: 13, cursor: 'pointer',
          }}
        >
          <ArrowClockwise size={16} weight="bold" style={{ animation: refreshing ? 'spin 0.6s linear' : 'none' }} />
          Refresh
        </button>
      </div>

      {/* ── System Metrics Row ── */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 32, flexWrap: 'wrap' }}>
        {systemMetrics.map(m => <MetricCard key={m.label} metric={m} />)}
      </div>

      {/* ── Quick Stats Chips ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
        {[
          { icon: Robot,      label: `${agents.length} total agents`,    color: 'var(--text-secondary)' },
          { icon: CheckCircle,label: `${activeCount} active`,            color: '#34c759' },
          { icon: Warning,    label: `${errorCount} with errors`,        color: '#ff3b30' },
          { icon: Cpu,        label: `Avg ${avgLatency}ms latency`,      color: 'var(--accent-chat)' },
          { icon: ChartLine,  label: `${(totalTokens/1000).toFixed(0)}K tokens today`, color: 'var(--accent-primary)' },
        ].map(({ icon: Icon, label, color }) => (
          <div key={label} style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '6px 14px', borderRadius: 20,
            background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
            fontSize: 13, fontWeight: 500, color,
          }}>
            <Icon size={14} weight="bold" />
            {label}
          </div>
        ))}
      </div>

      {/* ── Tab Bar ── */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid var(--border-subtle)' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 20px', background: 'none', border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--accent-chat)' : '2px solid transparent',
              color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-tertiary)',
              fontWeight: activeTab === tab.id ? 700 : 400,
              fontSize: 14, cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Agents Tab ── */}
      {activeTab === 'agents' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {agents.map(agent => {
            const cfg = STATUS_CONFIG[agent.status];
            const isSelected = selectedAgent === agent.id;
            return (
              <GlassCard
                key={agent.id}
                style={{
                  padding: '16px 20px',
                  cursor: 'pointer',
                  border: isSelected ? `1px solid ${cfg.color}40` : undefined,
                  transition: 'border-color 0.15s',
                }}
                onClick={() => setSelectedAgent(isSelected ? null : agent.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  {/* Status + Name */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 200 }}>
                    <StatusDot status={agent.status} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-primary)' }}>
                        {agent.name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                        {agent.type} · {agent.model}
                      </div>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <span style={{
                    padding: '3px 10px', borderRadius: 20,
                    background: `${cfg.color}18`,
                    color: cfg.color,
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}>
                    {cfg.label}
                  </span>

                  {/* Stats */}
                  <div style={{ display: 'flex', gap: 24, marginLeft: 'auto' }}>
                    {[
                      { label: 'Tasks', value: agent.taskCount.toString() },
                      { label: 'Tokens', value: agent.tokensUsed >= 1000 ? `${(agent.tokensUsed/1000).toFixed(1)}K` : agent.tokensUsed.toString() },
                      { label: 'Latency', value: agent.latencyMs > 0 ? `${agent.latencyMs}ms` : '—' },
                      { label: 'Uptime', value: agent.uptime },
                      { label: 'Last Active', value: agent.lastActivity },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 2 }}>{label}</div>
                        <div style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 6, marginLeft: 16 }}>
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
                  <div style={{
                    marginTop: 16, paddingTop: 16,
                    borderTop: '1px solid var(--border-subtle)',
                    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16,
                  }}>
                    {[
                      { icon: HardDrive, label: 'Memory', value: `${agent.memMb} MB` },
                      { icon: Cpu,       label: 'Model',   value: agent.model },
                      { icon: Clock,     label: 'Uptime',  value: agent.uptime },
                      { icon: Activity,  label: 'Status',  value: cfg.label },
                    ].map(({ icon: Icon, label, value }) => (
                      <div key={label} style={{
                        background: 'var(--bg-primary)', borderRadius: 10,
                        padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
                      }}>
                        <Icon size={20} weight="duotone" style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 2 }}>{label}</div>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>{value}</div>
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
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {(['all', 'info', 'warn', 'error'] as const).map(level => (
              <button
                key={level}
                onClick={() => setLogFilter(level)}
                style={{
                  padding: '6px 16px', borderRadius: 20,
                  background: logFilter === level ? 'var(--accent-chat)' : 'var(--bg-secondary)',
                  border: '1px solid var(--border-subtle)',
                  color: logFilter === level ? '#fff' : 'var(--text-secondary)',
                  fontWeight: 600, fontSize: 12, cursor: 'pointer',
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                }}
              >
                {level}
              </button>
            ))}
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-tertiary)', alignSelf: 'center' }}>
              {filteredLogs.length} entries
            </span>
          </div>

          {/* Log Entries */}
          <GlassCard style={{ padding: 0, overflow: 'hidden' }}>
            {filteredLogs.map((entry, idx) => {
              const cfg = LOG_LEVEL_CONFIG[entry.level];
              return (
                <div
                  key={entry.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '80px 50px 140px 1fr',
                    gap: 16,
                    padding: '10px 16px',
                    background: cfg.bg,
                    borderBottom: idx < filteredLogs.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-tertiary)' }}>
                    {entry.time}
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: cfg.color,
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                  }}>
                    {entry.level}
                  </span>
                  <span style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.agent}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>
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
      style={{
        width: 32, height: 32, borderRadius: 8, border: 'none',
        background: 'var(--bg-primary)', color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', transition: 'background 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-primary)')}
    >
      <Icon size={15} weight="bold" />
    </button>
  );
}
