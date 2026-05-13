'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface DotPulseProps {
  className?: string;
  dotClassName?: string;
  count?: number;
}

/**
 * DotPulse — Minimal loading indicator.
 * Three dots with staggered bounce animation.
 * Aura-style subtle loader.
 */
export function DotPulse({ className, dotClassName, count = 3 }: DotPulseProps) {
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className={cn(
            'block size-1.5  rounded-full bg-current opacity-60',
            dotClassName
          )}
          style={{
            animation: 'dot-pulse 1.2s ease-in-out infinite',
            animationDelay: `${i * 0.15}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes dot-pulse {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.3; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
