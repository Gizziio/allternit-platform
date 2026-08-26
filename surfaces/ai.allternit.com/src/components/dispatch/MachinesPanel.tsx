'use client';

import React from 'react';
import { DesktopTower } from '@phosphor-icons/react';
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
        <p className="text-[14px] text-[var(--text-secondary)] m-0">{emptyMessage}</p>
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
