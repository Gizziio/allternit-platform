'use client';

import { useState } from 'react';
import GlassSurface from '@/design/GlassSurface';
import { ArrowLeft, UserPlus, Trash } from '@phosphor-icons/react';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { useBoardStore, type BoardItem } from '@/stores/board.store';
import Link from 'next/link';

type BoardItemStatus = BoardItem['status'];

interface Props {
  workspaceId: string;
}

const STATUS_COLORS: Record<BoardItemStatus, string> = {
  backlog:     'var(--ui-text-muted)',
  todo:        'var(--status-info)',
  in_progress: 'var(--accent-cowork)',
  in_review:   'var(--status-warning)',
  done:        'var(--status-success)',
  blocked:     'var(--status-error)',
};

const ALL_STATUSES: BoardItemStatus[] = ['backlog', 'todo', 'in_progress', 'in_review', 'done', 'blocked'];

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export function CoworkWorkspaceDetailView({ workspaceId }: Props): JSX.Element {
  const { workspaces, members, addMember, removeMember } = useWorkspaceStore();
  const { items: allBoardItems } = useBoardStore();

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'owner' | 'admin' | 'member' | 'agent'>('member');

  const workspace = workspaces.find((ws) => ws.id === workspaceId);

  if (!workspace) {
    return (
      <div style={{ padding: 'var(--spacing-xl)', color: 'var(--text-secondary)', fontSize: 15 }}>
        Workspace not found.
      </div>
    );
  }

  const wsMembers = members[workspaceId] ?? [];
  const wsItems = allBoardItems.filter((item) => item.workspaceId === workspaceId);

  const statusCounts = wsItems.reduce<Partial<Record<BoardItemStatus, number>>>(
    (acc, item) => { acc[item.status] = (acc[item.status] ?? 0) + 1; return acc; },
    {},
  );

  function handleInvite() {
    if (!inviteEmail.trim()) return;
    addMember(workspaceId, inviteEmail.trim(), inviteRole);
    setInviteEmail('');
  }

  return (
    <div style={{ padding: 'var(--spacing-xl)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      <Link
        href="/cowork-team/workspaces"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: 13, textDecoration: 'none', width: 'fit-content' }}
      >
        <ArrowLeft size={14} />
        Back to workspaces
      </Link>

      <div>
        <h2 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 24, margin: 0 }}>{workspace.name}</h2>
        <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>/{workspace.slug}</div>
      </div>

      {/* Board item status stats */}
      <GlassSurface style={{ padding: 'var(--spacing-lg)', borderRadius: 12 }}>
        <h3 style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 15, margin: '0 0 var(--spacing-md)' }}>
          Board Items
        </h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-md)' }}>
          {ALL_STATUSES.map((status) => (
            <div
              key={status}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                padding: '10px 18px',
                borderRadius: 10,
                background: `${STATUS_COLORS[status]}18`,
                border: `1px solid ${STATUS_COLORS[status]}44`,
              }}
            >
              <span style={{ color: STATUS_COLORS[status], fontWeight: 700, fontSize: 20 }}>
                {statusCounts[status] ?? 0}
              </span>
              <span style={{ color: 'var(--text-secondary)', fontSize: 11, textTransform: 'capitalize' }}>
                {status.replace('_', ' ')}
              </span>
            </div>
          ))}
        </div>
      </GlassSurface>

      {/* Members */}
      <GlassSurface style={{ padding: 'var(--spacing-lg)', borderRadius: 12 }}>
        <h3 style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 15, margin: '0 0 var(--spacing-md)' }}>
          Members ({wsMembers.length})
        </h3>

        {wsMembers.length === 0 ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>No members yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {wsMembers.map((member) => {
              const isAgent = !!member.agentId;
              return (
                <div
                  key={member.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', padding: '8px 12px', borderRadius: 8, background: 'var(--bg-secondary)' }}
                >
                  <div
                    style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #af52de)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                  >
                    <span style={{ color: 'var(--ui-text-inverse)', fontWeight: 700, fontSize: 13 }}>
                      {getInitials(member.userId ?? member.agentId ?? '?')}
                    </span>
                  </div>

                  <span style={{ color: 'var(--text-primary)', fontSize: 14, flex: 1 }}>
                    {member.userId ?? member.agentId}
                  </span>

                  <span style={{ padding: '2px 10px', borderRadius: 20, background: 'color-mix(in srgb, var(--accent-cowork) 13%, transparent)', border: '1px solid #af52de55', color: 'var(--accent-cowork)', fontSize: 11, fontWeight: 600, textTransform: 'capitalize' }}>
                    {member.role}
                  </span>

                  <span style={{ padding: '2px 10px', borderRadius: 20, background: isAgent ? 'var(--status-info-bg)' : 'var(--status-success-bg)', border: `1px solid ${isAgent ? 'color-mix(in srgb, var(--status-info) 33%, transparent)' : 'color-mix(in srgb, var(--status-success) 33%, transparent)'}`, color: isAgent ? 'var(--status-info)' : 'var(--status-success)', fontSize: 11, fontWeight: 600 }}>
                    {isAgent ? 'Agent' : 'Human'}
                  </span>

                  <button
                    onClick={() => removeMember(workspaceId, member.id)}
                    style={{ padding: '5px 8px', borderRadius: 6, background: 'var(--status-error-bg)', border: '1px solid #ef444455', color: 'var(--status-error)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    title="Remove member"
                  >
                    <Trash size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Invite form */}
        <div style={{ marginTop: 'var(--spacing-md)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="Email"
            style={{ flex: 1, minWidth: 140, padding: '7px 12px', borderRadius: 7, background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: 13, outline: 'none' }}
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as typeof inviteRole)}
            style={{ padding: '7px 12px', borderRadius: 7, background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer', outline: 'none' }}
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
            <option value="owner">Owner</option>
            <option value="agent">Agent</option>
          </select>
          <button
            onClick={handleInvite}
            disabled={!inviteEmail.trim()}
            style={{ padding: '7px 16px', borderRadius: 7, background: 'var(--status-success)', border: 'none', color: 'var(--ui-text-inverse)', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: inviteEmail.trim() ? 1 : 0.5 }}
          >
            <UserPlus size={14} />
            Add
          </button>
        </div>
      </GlassSurface>
    </div>
  );
}

export default CoworkWorkspaceDetailView;
