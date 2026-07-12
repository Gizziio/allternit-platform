'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface SkeletonRowProps {
  /** Number of shimmer bars. */
  lines?: number;
  className?: string;
}

/** Gray rounded shimmer bars used as a loading placeholder. */
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
