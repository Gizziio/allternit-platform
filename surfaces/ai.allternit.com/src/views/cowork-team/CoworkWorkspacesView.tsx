'use client';

import GlassSurface from '@/design/GlassSurface';
import { Briefcase, Trash, ArrowRight } from '@phosphor-icons/react';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { useBoardStore } from '@/stores/board.store';
import Link from 'next/link';

export function CoworkWorkspacesView(): JSX.Element {
  const { workspaces, createWorkspace, fetchWorkspaces, members } = useWorkspaceStore();
  const { items: boardItems } = useBoardStore();

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
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
          <Briefcase size={24} color="#af52de" weight="duotone" />
          <h2 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 22, margin: 0 }}>
            Workspaces
          </h2>
        </div>

        <button
          onClick={handleNewWorkspace}
          style={{
            padding: '8px 18px',
            borderRadius: 8,
            background: 'var(--accent-cowork)',
            border: 'none',
            color: '#fff',
            fontWeight: 600,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          + New Workspace
        </button>
      </div>

      {workspaces.length === 0 && (
        <div style={{ padding: 'var(--spacing-xl)', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 15 }}>
          No workspaces yet. Create your first workspace.
        </div>
      )}

      {workspaces.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 'var(--spacing-md)',
          }}
        >
          {workspaces.map((ws) => {
            const memberCount = (members[ws.id] ?? []).length;
            const itemCount = boardItems.filter((i) => i.workspaceId === ws.id).length;

            return (
              <GlassSurface
                key={ws.id}
                style={{ padding: 'var(--spacing-lg)', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}
              >
                <div>
                  <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 16 }}>{ws.name}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 2 }}>/{ws.slug}</div>
                </div>

                <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
                  <Stat label="Members" value={memberCount} />
                  <Stat label="Board Items" value={itemCount} />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 'auto' }}>
                  <Link
                    href={`/cowork-team/workspaces/${ws.id}`}
                    style={{
                      flex: 1,
                      padding: '7px 14px',
                      borderRadius: 7,
                      background: '#3b82f622',
                      border: '1px solid #3b82f655',
                      color: 'var(--status-info)',
                      fontWeight: 600,
                      fontSize: 13,
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    Open
                    <ArrowRight size={14} />
                  </Link>

                  <button
                    onClick={() => handleDelete(ws.id)}
                    style={{
                      padding: '7px 12px',
                      borderRadius: 7,
                      background: '#ef444422',
                      border: '1px solid #ef444455',
                      color: 'var(--status-error)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                    }}
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
      <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{label}</span>
    </div>
  );
}

export default CoworkWorkspacesView;
