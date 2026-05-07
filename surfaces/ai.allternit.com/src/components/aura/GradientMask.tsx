'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface GradientMaskProps {
  children: React.ReactNode;
  className?: string;
  direction?: 'to-top' | 'to-bottom' | 'to-left' | 'to-right';
  intensity?: 'light' | 'medium' | 'heavy';
}

const directionStyles = {
  'to-top': 'bg-gradient-to-t',
  'to-bottom': 'bg-gradient-to-b',
  'to-left': 'bg-gradient-to-l',
  'to-right': 'bg-gradient-to-r',
};

const intensityStops = {
  light: 'from-black/40 via-black/10 to-transparent',
  medium: 'from-black/70 via-black/20 to-transparent',
  heavy: 'from-black/90 via-black/50 to-transparent',
};

/**
 * GradientMask — Bottom gradient overlay for images.
 * Ensures text remains readable over any image.
 */
export function GradientMask({
  children,
  className,
  direction = 'to-top',
  intensity = 'medium',
}: GradientMaskProps) {
  return (
    <div className={cn('relative overflow-hidden', className)}>
      {children}
      <div
        className={cn(
          'pointer-events-none absolute inset-0',
          directionStyles[direction],
          intensityStops[intensity]
        )}
      />
    </div>
  );
}
