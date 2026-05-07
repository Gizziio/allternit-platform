'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface PromptBarProps {
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  icon?: React.ReactNode;
  actionIcon?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}

/**
 * PromptBar — Rounded-full command bar with soft shadow and focus glow.
 * Styled after Aura's centered prompt input.
 */
export function PromptBar({
  placeholder = 'Describe what you want to build...',
  value,
  onChange,
  onSubmit,
  icon,
  actionIcon,
  className,
  disabled,
  autoFocus,
}: PromptBarProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onSubmit) {
      onSubmit(value || '');
    }
  };

  return (
    <div
      className={cn(
        'group flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-5 py-3.5 backdrop-blur-xl transition-all duration-300',
        'hover:border-white/15 hover:bg-white/[0.06] hover:shadow-lg hover:shadow-black/20',
        'focus-within:border-[#D97757]/30 focus-within:bg-white/[0.07] focus-within:shadow-xl focus-within:shadow-black/30 focus-within:ring-1 focus-within:ring-[#D97757]/20',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      {icon && (
        <span className="shrink-0 text-white/30 transition-colors group-focus-within:text-[#D97757]/60">
          {icon}
        </span>
      )}

      <input
        type="text"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        className="flex-1 bg-transparent text-sm text-white/90 placeholder:text-white/25 outline-none disabled:cursor-not-allowed"
      />

      {actionIcon && (
        <button
          type="button"
          onClick={() => onSubmit?.(value || '')}
          disabled={disabled || !value?.trim()}
          className="shrink-0 rounded-full bg-[#D97757] p-2 text-[#1A1612] opacity-90 transition-all hover:opacity-100 hover:scale-105 active:scale-95 disabled:opacity-30 disabled:hover:scale-100"
        >
          {actionIcon}
        </button>
      )}
    </div>
  );
}
