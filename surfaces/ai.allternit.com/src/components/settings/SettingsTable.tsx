'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface SettingsTableProps {
  /** Muted 12px column headers. */
  columns: string[];
  /** `<tr>` rows; use `SettingsTableCell` for cells. */
  children: React.ReactNode;
  className?: string;
}

/** Table with muted column headers and hairline row dividers. */
export function SettingsTable({ columns, children, className }: SettingsTableProps): React.ReactNode {
  return (
    <table className={cn('w-full border-collapse', className)}>
      <thead>
        <tr>
          {columns.map((col) => (
            <th
              key={col}
              className="text-left text-[12px] font-medium text-[var(--text-tertiary)] py-2 px-3 first:pl-0 last:pr-0"
            >
              {col}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="[&>tr]:border-t [&>tr]:border-solid [&>tr]:border-[var(--border-subtle)]">
        {children}
      </tbody>
    </table>
  );
}

interface SettingsTableCellProps {
  children?: React.ReactNode;
  className?: string;
}

export function SettingsTableCell({ children, className }: SettingsTableCellProps): React.ReactNode {
  return (
    <td className={cn('text-[13px] text-[var(--text-primary)] py-3 px-3 first:pl-0 last:pr-0', className)}>
      {children}
    </td>
  );
}

interface SettingsTableChipProps {
  children: React.ReactNode;
  tone?: 'blue' | 'gray';
}

/** Small chip for table cells, e.g. a blue "Current" marker. */
export function SettingsTableChip({ children, tone = 'blue' }: SettingsTableChipProps): React.ReactNode {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium',
        tone === 'blue'
          ? 'bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]'
          : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
      )}
    >
      {children}
    </span>
  );
}
