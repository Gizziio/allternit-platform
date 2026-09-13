import React from 'react';
import { cn } from '@/lib/utils';

interface SkeletonRowProps {
  lines?: number;
  className?: string;
}

export function SkeletonRow({ lines = 1, className }: SkeletonRowProps): React.ReactNode {
  return (
    <div className={cn('flex flex-col gap-2 py-3', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-3.5 rounded-full bg-[var(--bg-secondary)] animate-pulse"
          style={{ width: `${Math.max(30, 100 - i * 20)}%` }}
        />
      ))}
    </div>
  );
}

interface SkeletonCardProps {
  className?: string;
  /** Number of skeleton text rows inside the card. */
  rows?: number;
}

export function SkeletonCard({ className, rows = 3 }: SkeletonCardProps): React.ReactNode {
  return (
    <div
      className={cn(
        'rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4',
        className
      )}
    >
      <div className="mb-3 h-4 w-1/3 rounded-full bg-[var(--bg-primary)] animate-pulse" />
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="mb-2 h-3 rounded-full bg-[var(--bg-primary)] animate-pulse"
          style={{ width: `${Math.max(35, 100 - i * 18)}%` }}
        />
      ))}
    </div>
  );
}
