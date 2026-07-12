'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface SettingsRowProps {
  label: string;
  description?: string;
  /** Control slot, rendered on the right. */
  children?: React.ReactNode;
  className?: string;
}

/**
 * The core settings unit: label + muted description on the left,
 * control on the right. No card, no border — whitespace only.
 */
export function SettingsRow({ label, description, children, className }: SettingsRowProps): React.ReactNode {
  return (
    <div className={cn('flex items-center justify-between gap-6 py-4', className)}>
      <div className="min-w-0">
        <div className="text-[14px] font-medium text-[var(--text-primary)]">{label}</div>
        {description && (
          <div className="text-[13px] text-[var(--text-secondary)] mt-0.5">{description}</div>
        )}
      </div>
      {children && <div className="shrink-0 flex items-center">{children}</div>}
    </div>
  );
}
