'use client';

import React from 'react';
import { Circle, WifiHigh, WifiSlash } from '@phosphor-icons/react';
import { GlassSurface } from '@/design/GlassSurface';
import { cn } from '@/lib/utils';
import type { RuntimeViewModel } from './useRuntimes';

interface MachineCardProps {
  runtime: RuntimeViewModel;
  selected?: boolean;
  onClick?: () => void;
  action?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  pendingPermissions?: number;
  pendingQuestions?: number;
}

function relativeHeartbeat(ts?: number): string | null {
  if (!ts) return null;
  const delta = Date.now() - ts;
  if (delta < 0) return new Date(ts).toLocaleString();
  const mins = Math.floor(delta / 60_000);
  if (mins < 1) return 'Heartbeat just now';
  if (mins < 60) return `Heartbeat ${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Heartbeat ${hours}h ago`;
  return `Heartbeat ${Math.floor(hours / 24)}d ago`;
}

const STATUS_COLORS: Record<RuntimeViewModel['status'], string> = {
  online: 'var(--status-success)',
  busy: 'var(--status-warning)',
  offline: 'var(--ui-text-muted)',
};

export function MachineCard({
  runtime,
  selected,
  onClick,
  action,
  children,
  className,
  pendingPermissions = 0,
  pendingQuestions = 0,
}: MachineCardProps): React.ReactNode {
  const heartbeat = relativeHeartbeat(runtime.lastHeartbeatAt);
  const needsYou = pendingPermissions + pendingQuestions;
  return (
    <GlassSurface
      onClick={onClick}
      className={cn(
        'p-4 flex flex-col gap-3 transition-colors',
        selected && 'ring-1 ring-[var(--accent-primary)]',
        onClick && 'cursor-pointer',
        className
      )}
      intensity="base"
      hover={onClick ? 'lift' : undefined}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Circle
            size={10}
            weight="fill"
            color={STATUS_COLORS[runtime.status] ?? STATUS_COLORS.offline}
          />
          <span className="text-[15px] font-semibold text-[var(--text-primary)] truncate">
            {runtime.name}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {runtime.status === 'online' ? (
            <WifiHigh size={18} color="var(--status-success)" />
          ) : (
            <WifiSlash size={18} color="var(--ui-text-muted)" />
          )}
          {action}
        </div>
      </div>

      <div className="text-[13px] text-[var(--text-secondary)]">{runtime.host}</div>

      {heartbeat && (
        <div className="text-[12px] text-[var(--text-tertiary)]">{heartbeat}</div>
      )}

      {runtime.capabilities.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1">
          {runtime.capabilities.map((cap) => (
            <span
              key={cap}
              className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-[var(--surface-hover)] text-[var(--text-secondary)]"
            >
              {cap}
            </span>
          ))}
        </div>
      )}

      {needsYou > 0 && (
        <div className="flex flex-wrap gap-2 text-[12px] font-medium text-[var(--status-warning)]">
          {pendingPermissions > 0 && <span>{pendingPermissions} permission{pendingPermissions === 1 ? '' : 's'}</span>}
          {pendingQuestions > 0 && <span>{pendingQuestions} question{pendingQuestions === 1 ? '' : 's'}</span>}
        </div>
      )}

      {children}
      {onClick && (
        <div className="text-[12px] font-semibold text-[var(--accent-primary)] mt-1">
          {runtime.status === 'offline' ? 'Open sessions' : 'Open session'}
        </div>
      )}
    </GlassSurface>
  );
}
