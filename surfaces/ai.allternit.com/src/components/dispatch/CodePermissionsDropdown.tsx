"use client";

import React, { useState, useMemo } from 'react';
import {
  HandPointing,
  Code,
  Scroll,
  Lightning,
  Warning,
  CaretDown,
  Check,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

export const CODE_PERMISSION_OPTIONS = [
  {
    value: 'manual',
    label: 'Manual',
    description: 'Always ask before making changes',
    icon: HandPointing,
  },
  {
    value: 'accept-edits',
    label: 'Accept edits',
    description: 'Automatically accept all file edits',
    icon: Code,
  },
  {
    value: 'plan',
    label: 'Plan',
    description: 'Create a plan before making changes',
    icon: Scroll,
  },
  {
    value: 'auto',
    label: 'Auto',
    description: 'Claude handles permission decisions',
    icon: Lightning,
  },
  {
    value: 'bypass',
    label: 'Bypass permissions',
    description: 'Accepts all permissions',
    icon: Warning,
  },
] as const;

export type CodePermissionOption = (typeof CODE_PERMISSION_OPTIONS)[number]['value'];

interface CodePermissionsDropdownProps {
  value: CodePermissionOption;
  onChange: (value: CodePermissionOption) => void;
  size?: 'sm' | 'default';
}

export function CodePermissionsDropdown({
  value,
  onChange,
  size = 'default',
}: CodePermissionsDropdownProps): React.ReactNode {
  const [open, setOpen] = useState(false);
  const selected = useMemo(
    () => CODE_PERMISSION_OPTIONS.find((o) => o.value === value) ?? CODE_PERMISSION_OPTIONS[0],
    [value]
  );
  const SelectedIcon = selected.icon;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center gap-1.5 border border-solid border-[var(--border-default)] rounded-lg bg-transparent cursor-pointer hover:bg-[var(--surface-hover)] transition-colors',
          size === 'sm' ? 'px-2 py-1' : 'px-2.5 py-1.5'
        )}
      >
        <SelectedIcon size={size === 'sm' ? 12 : 14} className="text-[var(--text-tertiary)]" />
        <span className={cn('text-[var(--text-primary)] font-medium', size === 'sm' ? 'text-[11px]' : 'text-[12px]')}>
          {selected.label}
        </span>
        <CaretDown
          size={size === 'sm' ? 10 : 12}
          className={cn('text-[var(--text-tertiary)] transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 min-w-[260px] rounded-xl border border-solid border-[var(--border-default)] bg-[var(--bg-elevated)] shadow-sm py-1">
            {CODE_PERMISSION_OPTIONS.map((option) => {
              const Icon = option.icon;
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={cn(
                    'w-full flex items-start gap-3 text-left px-3 py-2 cursor-pointer border-none bg-transparent hover:bg-[var(--surface-hover)] transition-colors',
                    isSelected ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
                  )}
                >
                  <Icon size={18} className="mt-0.5 shrink-0 text-[var(--text-tertiary)]" />
                  <div className="flex-1 min-w-0">
                    <div className={cn('text-[13px]', isSelected && 'font-semibold')}>{option.label}</div>
                    <div className="text-[11px] text-[var(--text-tertiary)] leading-snug mt-0.5">
                      {option.description}
                    </div>
                  </div>
                  {isSelected && <Check size={16} className="mt-0.5 shrink-0 text-[var(--text-primary)]" weight="bold" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
