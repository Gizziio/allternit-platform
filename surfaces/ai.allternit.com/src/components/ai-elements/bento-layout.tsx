"use client";

import React from 'react';
import { cn } from '@/lib/utils';

export interface BentoItem {
  id: string;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  size?: '1x1' | '1x2' | '2x1' | '2x2';
  accent?: string;
  children?: React.ReactNode;
}

export interface BentoLayoutProps {
  items: BentoItem[];
  title?: string;
  columns?: 2 | 3 | 4;
  className?: string;
}

const sizeClass: Record<NonNullable<BentoItem['size']>, string> = {
  '1x1': 'col-span-1 row-span-1',
  '1x2': 'col-span-1 row-span-2',
  '2x1': 'col-span-2 row-span-1',
  '2x2': 'col-span-2 row-span-2',
};

const colClass: Record<2 | 3 | 4, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
};

export function BentoLayout({ items, title, columns = 3, className }: BentoLayoutProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {title && (
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      )}
      <div className={cn("grid auto-rows-[160px] gap-3", colClass[columns])}>
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              "relative rounded-2xl border border-border bg-card p-5 overflow-hidden transition-all hover:border-primary/30 hover:bg-muted/30",
              sizeClass[item.size ?? '1x1']
            )}
            style={item.accent ? { borderColor: `${item.accent}33` } : undefined}
          >
            {/* Icon */}
            {item.icon && (
              <div
                className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl"
                style={item.accent ? { background: `${item.accent}18` } : undefined}
              >
                {item.icon}
              </div>
            )}

            {/* Content */}
            <h4 className="text-sm font-semibold text-foreground leading-tight">{item.title}</h4>
            {item.description && (
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed line-clamp-3">
                {item.description}
              </p>
            )}

            {/* Custom slot */}
            {item.children && (
              <div className="mt-3">{item.children}</div>
            )}

            {/* Accent glow */}
            {item.accent && (
              <div
                className="pointer-events-none absolute -bottom-8 -right-8 h-24 w-24 rounded-full opacity-20 blur-xl"
                style={{ background: item.accent }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
