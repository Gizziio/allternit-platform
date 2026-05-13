'use client';

import React from 'react';
import GlassSurface from '@/design/GlassSurface';
import { ArrowRight, Briefcase, Trash } from '@phosphor-icons/react';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { useBoardStore } from '@/stores/board.store';
import { fetchArtifactStatsByWorkspace } from '@/services/artifacts-api';
import type { DesignTeamView } from './DesignTeamHub';

interface Props {
  onNavigate: (view: DesignTeamView) => void;
  onSelectWorkspace: (id: string) => void;
}

export function DesignWorkspacesView({ onSelectWorkspace }: Props): JSX.Element {
  const { workspaces, createWorkspace, fetchWorkspaces, members } = useWorkspaceStore();
  const { items: boardItems } = useBoardStore();
  const [artifactStats, setArtifactStats] = React.useState<Record<string, { total: number; drafts: number; final: number }>>({});

  React.useEffect(() => {
    let cancelled = false;
    const loadStats = async () => {
      try {
        const stats = await fetchArtifactStatsByWorkspace();
        if (cancelled) return;
        setArtifactStats(Object.fromEntries(stats.map((entry) => [entry.workspaceId, { total: entry.total, drafts: entry.drafts, final: entry.final }])));
      } catch {
        if (!cancelled) setArtifactStats({});
      }
    };
    void loadStats();
    return () => { cancelled = true; };
  }, []);

  async function handleNewWorkspace() {
    const name = window.prompt('Workspace name:');
    if (!name?.trim()) return;
    const slug = name.trim().toLowerCase().replace(/\s+/g, '-');
    await createWorkspace(name.trim(), slug);
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this workspace?')) return;
    await fetch(`/api/v1/cowork-team/workspaces/${id}`, { method: 'DELETE' });
    await fetchWorkspaces();
  }

  return (
    <div style={{ padding: 'var(--spacing-xl)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
          <Briefcase size={24} color="var(--accent-primary)" weight="duotone" />
          <h2 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 22, margin: 0 }}>Workspaces</h2>
        </div>
        <button
          onClick={handleNewWorkspace}
          style={{ padding: '8px 18px', borderRadius: 8, background: 'var(--accent-primary)', border: 'none', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
        >
          + New Workspace
        </button>
      </div>

      {workspaces.length === 0 ? (
        <div style={{ padding: 'var(--spacing-xl)', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 15 }}>
          No workspaces yet. Create your first workspace.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--spacing-md)' }}>
          {workspaces.map((ws) => {
            const memberCount = (members[ws.id] ?? []).length;
            const itemCount = boardItems.filter((item) => item.workspaceId === ws.id).length;
            const stats = artifactStats[ws.id] || { total: 0, drafts: 0, final: 0 };

            return (
              <GlassSurface key={ws.id} style={{ padding: 'var(--spacing-lg)', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                <div>
                  <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 16 }}>{ws.name}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 2 }}>/{ws.slug}</div>
                </div>

                <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
                  <Stat label="Members" value={memberCount} />
                  <Stat label="Board Items" value={itemCount} />
                </div>

                <div style={{ borderRadius: 10, background: 'var(--bg-secondary)', padding: '10px 12px', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                  <MiniStat label="Artifacts" value={stats.total} />
                  <MiniStat label="Drafts" value={stats.drafts} />
                  <MiniStat label="Final" value={stats.final} />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 'auto' }}>
                  <button
                    onClick={() => onSelectWorkspace(ws.id)}
                    style={{ flex: 1, padding: '7px 14px', borderRadius: 7, background: '#3b82f622', border: '1px solid #3b82f655', color: 'var(--status-info)', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  >
                    Open <ArrowRight size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(ws.id)}
                    style={{ padding: '7px 12px', borderRadius: 7, background: '#ef444422', border: '1px solid #ef444455', color: 'var(--status-error)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    title="Delete workspace"
                  >
                    <Trash size={15} />
                  </button>
                </div>
              </GlassSurface>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }): JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 18 }}>{value}</span>
      <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{label}</span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }): JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 16 }}>{value}</span>
      <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{label}</span>
    </div>
  );
}

export default DesignWorkspacesView;
