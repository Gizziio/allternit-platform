'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface ModelCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

/**
 * Standard card used across Model Lab panels.
 * Matches the Artifact Library card style:
 * - bg-[var(--bg-elevated)]
 * - border border-[var(--border-subtle)]
 * - hover:border-[var(--border-hover)] hover:shadow-md
 * No glass/beige tint.
 */
export function ModelCard({ children, className, hover = true, onClick }: ModelCardProps): React.ReactNode {
  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] overflow-hidden',
        hover && 'transition-all duration-200 hover:border-[var(--border-hover)] hover:shadow-md',
        onClick && 'cursor-pointer',
        className
      )}
    >
      {children}
    </div>
  );
}

export default ModelCard;
