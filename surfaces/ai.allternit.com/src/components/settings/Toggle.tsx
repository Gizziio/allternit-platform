'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface ToggleProps {
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  'aria-label'?: string;
}

/** iOS-style toggle, ~40×24, accent-colored when on. */
export function Toggle({ value, onChange, disabled, ...rest }: ToggleProps): React.ReactNode {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={rest['aria-label']}
      disabled={disabled}
      onClick={() => onChange(!value)}
      className={cn(
        'w-10 h-6 rounded-full border-none relative transition-colors duration-200 cursor-pointer p-0 shrink-0',
        value ? 'bg-[var(--accent-primary)]' : 'bg-[var(--border-subtle)]',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <span
        className={cn(
          'block size-5 rounded-full bg-white absolute top-0.5 transition-transform duration-200 shadow-sm',
          value ? 'translate-x-[18px]' : 'translate-x-0.5'
        )}
      />
    </button>
  );
}
