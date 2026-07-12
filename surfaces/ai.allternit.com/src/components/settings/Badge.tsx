'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  className?: string;
}

/** Small gray pill badge, e.g. "Beta" next to a feature name. */
export function Badge({ children, className }: BadgeProps): React.ReactNode {
  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 rounded-md bg-[var(--bg-secondary)] text-[11px] font-medium text-[var(--text-secondary)] align-middle',
        className
      )}
    >
      {children}
    </span>
  );
}
