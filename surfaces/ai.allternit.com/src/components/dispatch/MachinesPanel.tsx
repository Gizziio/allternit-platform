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
}

export function MachinesPanel({
  runtimes,
  loading,
  selectedId,
  onSelect,
  action,
  emptyMessage = 'No machines paired yet. Pair a machine from the Allternit desktop app to get started.',
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
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('allternit:open-settings', { detail: { section: 'remote-control' } }))}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-[var(--text-primary)] text-[var(--bg-elevated)] border-none cursor-pointer hover:opacity-90 transition-opacity"
        >
          <ArrowSquareOut size={14} weight="bold" />
          Open settings
        </button>
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
        />
      ))}
    </div>
  );
}
