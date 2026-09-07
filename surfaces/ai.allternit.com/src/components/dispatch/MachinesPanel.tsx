'use client';

import React from 'react';
import { DesktopTower, ArrowSquareOut } from '@phosphor-icons/react';
import { MachineCard } from './MachineCard';
import type { RuntimeViewModel } from './useRuntimes';

export interface MachinesPanelProps {
  runtimes: RuntimeViewModel[];
  loading: boolean;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  action?: (runtime: RuntimeViewModel) => React.ReactNode;
  emptyMessage?: string;
  compact?: boolean;
  attention?: (runtime: RuntimeViewModel) => { permissions: number; questions: number } | undefined;
}

export function MachinesPanel({
  runtimes,
  loading,
  selectedId,
  onSelect,
  action,
  emptyMessage = 'No machines paired yet. Pair a machine from the Allternit desktop app to get started.',
  compact = false,
  attention,
}: MachinesPanelProps): React.ReactNode {
  if (loading) {
    return (
      <div className="text-[14px] text-[var(--text-secondary)] py-12 text-center">
        Loading machines…
      </div>
    );
  }

  if (runtimes.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--bg-elevated)] p-8 text-center">
        <DesktopTower size={48} className="mx-auto mb-3 opacity-40" />
        <p className="text-[14px] font-medium text-[var(--text-primary)] m-0 mb-1">No machines paired</p>
        <p className="text-[12px] text-[var(--text-tertiary)] m-0 mb-4">{emptyMessage}</p>
        {typeof window !== 'undefined' && window.allternit ? (
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('allternit:open-settings', { detail: { section: 'remote-control' } }))}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-[var(--text-primary)] text-[var(--bg-elevated)] border-none cursor-pointer hover:opacity-90 transition-opacity"
          >
            <ArrowSquareOut size={14} weight="bold" />
            Open settings
          </button>
        ) : null}
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex gap-2 min-w-0">
        {runtimes.map((rt) => (
          <button
            key={rt.id}
            type="button"
            onClick={() => onSelect?.(rt.id)}
            className="shrink-0 flex items-center gap-2 rounded-lg px-2.5 py-1 text-[12px] font-semibold cursor-pointer border-none"
            style={{
              background: selectedId === rt.id ? 'var(--shell-item-active-bg)' : 'var(--surface-hover)',
              color: selectedId === rt.id ? 'var(--shell-item-active-fg)' : 'var(--shell-item-fg)',
            }}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: rt.status === 'online' ? 'var(--status-success)' : rt.status === 'busy' ? 'var(--status-warning)' : 'var(--ui-text-muted)' }}
            />
            <span className="max-w-[180px] truncate">{rt.name}</span>
            {action?.(rt)}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {runtimes.map((rt) => (
        <MachineCard
          key={rt.id}
          runtime={rt}
          selected={selectedId === rt.id}
          onClick={() => onSelect?.(rt.id)}
          action={action?.(rt)}
          pendingPermissions={attention?.(rt)?.permissions}
          pendingQuestions={attention?.(rt)?.questions}
        />
      ))}
    </div>
  );
}
