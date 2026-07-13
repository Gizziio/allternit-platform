'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  /** Outline-style icon, rendered muted above the caption. */
  icon: React.ReactNode;
  /** Optional heading shown above the caption. */
  title?: string;
  caption: string;
  ctaLabel?: string;
  onCtaClick?: () => void;
  className?: string;
  /** Render the CTA as a primary button instead of a quiet outline button. */
  primaryCta?: boolean;
}

/** Centered empty state: outline icon, title, muted caption, single CTA. */
export function EmptyState({
  icon,
  title,
  caption,
  ctaLabel,
  onCtaClick,
  className,
  primaryCta = false,
}: EmptyStateProps): React.ReactNode {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center py-12 px-6', className)}>
      <div className="text-[var(--text-tertiary)] mb-4">{icon}</div>
      {title && (
        <h3 className="text-[16px] font-semibold text-[var(--text-primary)] m-0 mb-1">
          {title}
        </h3>
      )}
      <p className="text-[13px] text-[var(--text-secondary)] m-0 max-w-xs leading-relaxed">
        {caption}
      </p>
      {ctaLabel && onCtaClick && (
        <button
          type="button"
          onClick={onCtaClick}
          className={cn(
            'mt-5 px-4 py-2 rounded-lg text-[13px] font-semibold cursor-pointer transition-colors',
            primaryCta
              ? 'bg-[var(--accent-primary)] text-[var(--ui-text-inverse)] hover:brightness-110'
              : 'border border-solid border-[var(--border-subtle)] bg-transparent text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
          )}
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
}
