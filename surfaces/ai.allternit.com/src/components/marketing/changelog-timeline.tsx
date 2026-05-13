'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export type ChangelogType = 'feature' | 'fix' | 'improvement';

export interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  description: string;
  type: ChangelogType;
}

export interface ChangelogTimelineProps {
  entries: ChangelogEntry[];
  className?: string;
}

const typeStyles: Record<
  ChangelogType,
  { label: string; bg: string; fg: string; dot: string }
> = {
  feature: {
    label: 'Feature',
    bg: 'color-mix(in srgb, var(--accent-chat) 14%, transparent)',
    fg: 'var(--accent-chat)',
    dot: 'var(--accent-chat)',
  },
  fix: {
    label: 'Fix',
    bg: 'color-mix(in srgb, var(--status-warning) 14%, transparent)',
    fg: 'var(--status-warning)',
    dot: 'var(--status-warning)',
  },
  improvement: {
    label: 'Improvement',
    bg: 'color-mix(in srgb, var(--status-success) 14%, transparent)',
    fg: 'var(--status-success)',
    dot: 'var(--status-success)',
  },
};

export function ChangelogTimeline({
  entries,
  className,
}: ChangelogTimelineProps) {
  return (
    <section className={cn('relative px-6 py-24', className)}>
      <div className="mx-auto max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          className="mb-16 text-center"
        >
          <h2
            className="mb-3 text-3xl font-semibold tracking-tight text-[var(--ui-text-primary)] sm:text-4xl"
            style={{ fontFamily: 'var(--font-serif), Georgia, serif', lineHeight: 1.1 }}
          >
            Changelog
          </h2>
          <p className="mx-auto max-w-md text-base text-[var(--ui-text-muted)]">
            Track our journey. See what we have shipped, fixed, and improved.
          </p>
        </motion.div>

        <div className="relative">
          {/* Center connector line - desktop only */}
          <div
            className="absolute left-1/2 top-0 hidden h-full w-px -tranzinc-x-1/2 md:block"
            style={{
              background:
                'linear-gradient(to bottom, transparent, var(--ui-border-muted) 10%, var(--ui-border-muted) 90%, transparent)',
            }}
          />

          {/* Mobile connector line */}
          <div
            className="absolute left-4 top-0 h-full w-px md:hidden"
            style={{
              background:
                'linear-gradient(to bottom, transparent, var(--ui-border-muted) 10%, var(--ui-border-muted) 90%, transparent)',
            }}
          />

          <div className="flex flex-col gap-12">
            {entries.map((entry, index) => {
              const isLeft = index % 2 === 0;
              const typeStyle = typeStyles[entry.type];

              return (
                <motion.div
                  key={entry.version}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{
                    duration: 0.6,
                    delay: index * 0.08,
                    ease: [0.4, 0, 0.2, 1],
                  }}
                  className={cn(
                    'relative flex items-start md:items-center',
                    isLeft ? 'md:flex-row' : 'md:flex-row-reverse'
                  )}
                >
                  {/* Content card */}
                  <div
                    className={cn(
                      'ml-10 flex-1 md:ml-0',
                      isLeft ? 'md:pr-12 md:text-right' : 'md:pl-12 md:text-left'
                    )}
                  >
                    <div
                      className="group relative inline-block rounded-2xl border p-5 transition-all duration-300 hover:-tranzinc-y-0.5 hover:border-[var(--accent-primary)]/30 hover:shadow-lg"
                      style={{
                        background: 'var(--surface-panel)',
                        borderColor: 'var(--ui-border-muted)',
                        boxShadow: 'var(--shadow-sm)',
                      }}
                    >
                      <div
                        className={cn(
                          'mb-3 flex flex-wrap items-center gap-2',
                          isLeft ? 'md:justify-end' : 'md:justify-start'
                        )}
                      >
                        <span
                          className="text-xs font-bold tracking-wide uppercase"
                          style={{ color: 'var(--accent-primary)' }}
                        >
                          v{entry.version}
                        </span>
                        <span
                          className="text-xs"
                          style={{ color: 'var(--ui-text-muted)' }}
                        >
                          {entry.date}
                        </span>
                        <span
                          className="rounded-full px-2 py-0.5 text-[12px] font-medium"
                          style={{
                            background: typeStyle.bg,
                            color: typeStyle.fg,
                          }}
                        >
                          {typeStyle.label}
                        </span>
                      </div>

                      <h3
                        className="mb-1 text-base font-semibold"
                        style={{ color: 'var(--ui-text-primary)' }}
                      >
                        {entry.title}
                      </h3>

                      <p
                        className="text-sm leading-relaxed"
                        style={{ color: 'var(--ui-text-muted)' }}
                      >
                        {entry.description}
                      </p>
                    </div>
                  </div>

                  {/* Center dot */}
                  <div className="absolute left-4 top-5 z-10 md:left-1/2 md:top-1/2 md:-tranzinc-x-1/2 md:-tranzinc-y-1/2">
                    <div
                      className="size-4  rounded-full border-2"
                      style={{
                        background: 'var(--surface-canvas)',
                        borderColor: typeStyle.dot,
                        boxShadow: `0 0 0 4px color-mix(in srgb, ${typeStyle.dot} 15%, transparent)`,
                      }}
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
