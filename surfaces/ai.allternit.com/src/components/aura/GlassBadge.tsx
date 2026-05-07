'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface GlassBadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'accent';
  size?: 'sm' | 'md';
  className?: string;
}

const variantStyles = {
  default: 'bg-black/30 text-white/90 border-white/10',
  success: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  warning: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  error: 'bg-red-500/15 text-red-400 border-red-500/20',
  info: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  accent: 'bg-[#D97757]/15 text-[#D97757] border-[#D97757]/20',
};

const sizeStyles = {
  sm: 'px-1.5 py-0.5 text-[10px]',
  md: 'px-2 py-0.5 text-xs',
};

/**
 * GlassBadge — Backdrop-blur badge with subtle tinted background.
 * Aura-style minimal floating badge.
 */
export function GlassBadge({
  children,
  variant = 'default',
  size = 'sm',
  className,
}: GlassBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-medium backdrop-blur-md',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {children}
    </span>
  );
}
