'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  /** Outline-style icon, rendered muted above the caption. */
  icon: React.ReactNode;
  caption: string;
  ctaLabel?: string;
  onCtaClick?: () => void;
  className?: string;
}

/** Centered empty state: outline icon, muted caption, single quiet CTA. */
export function EmptyState({ icon, caption, ctaLabel, onCtaClick, className }: EmptyStateProps): React.ReactNode {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center py-12 px-6', className)}>
      <div className="text-[var(--text-tertiary)] mb-3">{icon}</div>
      <p className="text-[13px] text-[var(--text-secondary)] m-0">{caption}</p>
      {ctaLabel && onCtaClick && (
        <button
          type="button"
          onClick={onCtaClick}
          className="mt-4 px-4 py-2 rounded-lg border border-solid border-[var(--border-subtle)] bg-transparent text-[13px] font-medium text-[var(--text-primary)] cursor-pointer hover:bg-[var(--bg-secondary)] transition-colors"
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
}
