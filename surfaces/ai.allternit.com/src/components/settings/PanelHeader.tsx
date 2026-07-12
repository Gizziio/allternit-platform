'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface PanelHeaderProps {
  title: string;
  /** Right-side slot: search icon, secondary buttons, "Add ▾". */
  children?: React.ReactNode;
  className?: string;
}

/** Header bar for list-style panels: title left, actions right. */
export function PanelHeader({ title, children, className }: PanelHeaderProps): React.ReactNode {
  return (
    <div className={cn('flex items-center justify-between gap-4 mb-4', className)}>
      <h2 className="text-[16px] font-semibold text-[var(--text-primary)] m-0">{title}</h2>
      {children && <div className="flex items-center gap-2 shrink-0">{children}</div>}
    </div>
  );
}
