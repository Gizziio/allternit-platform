'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface SectionHeadingProps {
  children: React.ReactNode;
  className?: string;
}

/** 16px semibold sentence-case section heading with generous spacing. */
export function SectionHeading({ children, className }: SectionHeadingProps): React.ReactNode {
  return (
    <h2
      className={cn(
        'text-[16px] font-semibold text-[var(--text-primary)] mt-8 mb-3 first:mt-0',
        className
      )}
    >
      {children}
    </h2>
  );
}
