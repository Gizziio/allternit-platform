'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface SettingsCardProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}

/**
 * Claude Desktop-style grouped card for settings surfaces.
 * Use inside a settings panel to visually group related rows.
 */
export function SettingsCard({
  title,
  description,
  children,
  className,
  action,
}: SettingsCardProps): React.ReactNode {
  return (
    <div
      className={cn(
        'rounded-2xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden',
        className
      )}
    >
      {(title || description || action) && (
        <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3">
          <div>
            {title && (
              <h3 className="text-[15px] font-semibold text-[var(--text-primary)] m-0">
                {title}
              </h3>
            )}
            {description && (
              <p className="text-[13px] text-[var(--text-secondary)] m-0 mt-1 leading-relaxed">
                {description}
              </p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className="px-5 pb-5">{children}</div>
    </div>
  );
}

interface SettingsCardRowProps {
  label: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

/**
 * A single row inside a SettingsCard. Adds a top border to separate from
 * the previous row, matching Claude Desktop card interiors.
 */
export function SettingsCardRow({
  label,
  description,
  children,
  className,
}: SettingsCardRowProps): React.ReactNode {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-6 py-4 border-t border-solid border-[var(--border-subtle)] first:border-t-0',
        className
      )}
    >
      <div className="min-w-0">
        <div className="text-[14px] font-medium text-[var(--text-primary)]">{label}</div>
        {description && (
          <div className="text-[13px] text-[var(--text-secondary)] mt-0.5 leading-relaxed">
            {description}
          </div>
        )}
      </div>
      {children && <div className="shrink-0 flex items-center">{children}</div>}
    </div>
  );
}
