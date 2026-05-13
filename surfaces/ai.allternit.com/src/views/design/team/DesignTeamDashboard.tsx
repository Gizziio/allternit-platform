'use client';

import React from 'react';
import { Users, Kanban, Robot } from '@phosphor-icons/react';
import GlassSurface from '@/design/GlassSurface';
import { useBoardStore } from '@/stores/board.store';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { useAgentStore } from '@/lib/agents/agent.store';
import type { DesignTeamView } from './DesignTeamHub';

const STATUS_COLORS: Record<string, string> = {
  backlog: 'var(--ui-text-muted)',
  todo: 'var(--status-info)',
  in_progress: 'var(--accent-primary)',
  in_review: 'var(--status-warning)',
  done: 'var(--status-success)',
  blocked: 'var(--status-error)',
};

interface Props {
  onNavigate: (view: DesignTeamView) => void;
}

export const DesignTeamDashboard: React.FC<Props> = ({ onNavigate }) => {
  const { workspaces } = useWorkspaceStore();
  const { items: boardItems } = useBoardStore();
  const { agents } = useAgentStore();

  const activeAgents = agents.filter((a) => a.status === 'idle' || a.status === 'running').length;
  const totalCapabilities = agents.reduce((sum, a) => sum + (a.capabilities?.length ?? 0), 0);

  const recentItems = [...boardItems]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 5);

  return (
    <div style={{ padding: 'var(--spacing-xl)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)', color: 'var(--text-primary)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Users size={28} color="var(--accent-primary)" weight="duotone" />
        <h1 style={{ fontSize: '24px', fontWeight: 600, margin: 0 }}>Design Team</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--spacing-md)' }}>
        <SummaryCard label="Workspaces" value={workspaces.length} accent="#06b6d4" />
        <SummaryCard label="Board Items" value={boardItems.length} accent="var(--accent-primary)" />
        <SummaryCard label="Active Agents" value={activeAgents} accent="#22c55e" />
        <SummaryCard label="Capabilities" value={totalCapabilities} accent="#f59e0b" />
      </div>

      <GlassSurface style={{ borderRadius: '12px', padding: 'var(--spacing-lg)' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 var(--spacing-md) 0', color: 'var(--text-primary)' }}>
          Recent Board Items
        </h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Title', 'Workspace', 'Status', 'Assignee'].map((col) => (
                <th key={col} style={{ textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', paddingBottom: '8px', borderBottom: '1px solid var(--border-subtle)' }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recentItems.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
                  No board items yet.
                </td>
              </tr>
            ) : (
              recentItems.map((item, idx) => {
                const ws = workspaces.find((w) => w.id === item.workspaceId);
                return (
                  <tr key={item.id} style={{ borderBottom: idx < recentItems.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                    <td style={{ padding: '10px 0', fontSize: '14px', color: 'var(--text-primary)', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</td>
                    <td style={{ padding: '10px 8px', fontSize: '13px', color: 'var(--text-secondary)' }}>{ws?.name ?? '—'}</td>
                    <td style={{ padding: '10px 8px' }}><StatusBadge status={item.status} /></td>
                    <td style={{ padding: '10px 8px', fontSize: '13px', color: 'var(--text-secondary)' }}>{item.assigneeName ?? item.assigneeId ?? '—'}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </GlassSurface>

      <div style={{ display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap' }}>
        <QuickNavButton onClick={() => onNavigate('board')} icon={<Kanban size={16} />} label="Board" />
        <QuickNavButton onClick={() => onNavigate('agents')} icon={<Robot size={16} />} label="Agents" />
        <QuickNavButton onClick={() => onNavigate('workspaces')} icon={<Users size={16} />} label="Workspaces" />
      </div>
    </div>
  );
};

interface SummaryCardProps { label: string; value: number; accent: string; }
const SummaryCard: React.FC<SummaryCardProps> = ({ label, value, accent }) => (
  <GlassSurface style={{ borderRadius: '12px', padding: 'var(--spacing-md)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
    <span style={{ fontSize: '28px', fontWeight: 700, color: accent, lineHeight: 1 }}>{value}</span>
  </GlassSurface>
);

const StatusBadge: React.FC<{ status: string }> = ({ status }) => (
  <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600, background: `${STATUS_COLORS[status] ?? 'var(--ui-text-muted)'}22`, color: STATUS_COLORS[status] ?? 'var(--ui-text-muted)', textTransform: 'capitalize' }}>
    {status.replace('_', ' ')}
  </span>
);

const QuickNavButton: React.FC<{ onClick: () => void; icon: React.ReactNode; label: string }> = ({ onClick, icon, label }) => (
  <button
    onClick={onClick}
    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: '14px', fontWeight: 500, cursor: 'pointer', transition: 'opacity 0.15s' }}
    onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = '0.75')}
    onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = '1')}
  >
    {icon}
    {label}
  </button>
);

export default DesignTeamDashboard;
