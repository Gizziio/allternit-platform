'use client';

import GlassSurface from '@/design/GlassSurface';
import { Robot } from '@phosphor-icons/react';
import type { Agent } from '@/lib/agents/agent.types';

interface Props {
  agent: Agent;
}

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  idle:    { color: 'var(--status-success)', label: 'Idle' },
  running: { color: 'var(--status-info)', label: 'Running' },
  paused:  { color: 'var(--status-warning)', label: 'Paused' },
  error:   { color: 'var(--status-error)', label: 'Error' },
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export function CoworkAgentProfileCard({ agent }: Props): JSX.Element {
  const statusCfg = STATUS_CONFIG[agent.status] ?? STATUS_CONFIG.idle;
  const initials = getInitials(agent.name);

  return (
    <GlassSurface
      style={{
        padding: 'var(--spacing-lg)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-md)',
        borderRadius: 12,
      }}
    >
      {/* Avatar + name + status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #af52de, #3b82f6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {initials ? (
            <span style={{ color: 'var(--ui-text-inverse)', fontWeight: 700, fontSize: 16, letterSpacing: 0.5 }}>
              {initials}
            </span>
          ) : (
            <Robot size={24} color="#fff" weight="bold" />
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              color: 'var(--text-primary)',
              fontWeight: 600,
              fontSize: 15,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {agent.name}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: statusCfg.color,
                flexShrink: 0,
                boxShadow: `0 0 6px ${statusCfg.color}88`,
              }}
            />
            <span style={{ color: statusCfg.color, fontSize: 12, fontWeight: 500 }}>
              {statusCfg.label}
            </span>
          </div>
        </div>
      </div>

      {/* Description */}
      {agent.description && (
        <div style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.5 }}>
          {agent.description}
        </div>
      )}

      {/* Capabilities */}
      {agent.capabilities && agent.capabilities.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {agent.capabilities.map((cap) => (
            <span
              key={cap}
              style={{
                padding: '2px 10px',
                borderRadius: 20,
                background: 'color-mix(in srgb, var(--accent-cowork) 13%, transparent)',
                border: '1px solid #af52de55',
                color: 'var(--accent-cowork)',
                fontSize: 11,
                fontWeight: 500,
              }}
            >
              {cap}
            </span>
          ))}
        </div>
      )}

      {/* Teammate status */}
      {agent.teammateProfile && (
        <div
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            background: 'var(--status-info-bg)',
            border: '1px solid #06b6d433',
            color: 'var(--text-secondary)',
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          <span style={{ color: 'var(--status-info)', fontWeight: 600, marginRight: 6 }}>Status:</span>
          {agent.teammateProfile.status}
          {agent.teammateProfile.bio && (
            <div style={{ marginTop: 4 }}>{agent.teammateProfile.bio}</div>
          )}
        </div>
      )}
    </GlassSurface>
  );
}

export default CoworkAgentProfileCard;
