import React from 'react';
import { cn } from '@/lib/utils';

interface MonoChipProps {
  children: React.ReactNode;
  className?: string;
}

export function MonoChip({ children, className }: MonoChipProps): React.ReactNode {
  return (
    <code
      className={cn(
        'inline-flex items-center px-2 py-1 rounded-md bg-[var(--bg-secondary)] border border-solid border-[var(--border-subtle)] font-mono text-[12px] text-[var(--text-secondary)]',
        className
      )}
    >
      {children}
    </code>
  );
}
