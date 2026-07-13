import React from 'react';
import { cn } from '@/lib/utils';

export interface PillProps {
  children: React.ReactNode;
  icon?: React.ReactNode;
  active?: boolean;
  variant?: 'default' | 'active' | 'outline' | 'ghost';
  size?: 'sm' | 'md';
  onClick?: () => void;
  className?: string;
  'data-testid'?: string;
  title?: string;
}

export const Pill = React.forwardRef<HTMLSpanElement, PillProps>(function Pill(
  {
    children,
    icon,
    active = false,
    variant,
    size = 'md',
    onClick,
    className,
    'data-testid': dataTestId,
    title,
  },
  ref
): React.ReactNode {
  const resolvedVariant = variant ?? (active ? 'active' : 'default');
  const isClickable = Boolean(onClick);

  return (
    <span
      ref={ref}
      data-testid={dataTestId}
      title={title}
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap transition-all duration-150',
        size === 'sm' && 'px-2 py-1 text-[11px] font-semibold rounded-md',
        size === 'md' && 'px-3 py-1.5 text-[12px] font-bold rounded-lg',
        resolvedVariant === 'active' && 'border border-solid border-[var(--accent-primary)]/30 bg-[color-mix(in_srgb,var(--accent-primary)_10%,transparent)] text-[var(--accent-primary)]',
        resolvedVariant === 'default' && 'border border-solid border-[var(--border-subtle)] bg-transparent text-[var(--text-secondary)]',
        resolvedVariant === 'default' && isClickable && 'hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]',
        resolvedVariant === 'outline' && 'border border-solid border-[var(--border-subtle)] bg-transparent text-[var(--text-secondary)]',
        resolvedVariant === 'ghost' && 'border border-solid border-transparent bg-transparent text-[var(--text-secondary)]',
        resolvedVariant === 'ghost' && isClickable && 'hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]',
        isClickable && 'cursor-pointer',
        className
      )}
    >
      {icon}
      {children}
    </span>
  );
});
