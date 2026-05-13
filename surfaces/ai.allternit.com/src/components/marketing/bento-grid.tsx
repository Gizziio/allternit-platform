'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Icon } from '@tabler/icons-react';
import { cn } from '@/lib/utils';

export interface BentoItem {
  title: string;
  description: string;
  icon: Icon;
  className?: string;
  imageUrl?: string;
}

export interface BentoGridProps {
  items: BentoItem[];
  className?: string;
}

export function BentoGrid({ items, className }: BentoGridProps) {
  return (
    <section className={cn('relative px-6 py-24', className)}>
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item, index) => {
            const IconComponent = item.icon;
            const isWide = item.className?.includes('col-span');

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{
                  duration: 0.6,
                  delay: index * 0.08,
                  ease: [0.4, 0, 0.2, 1],
                }}
                className={cn(
                  'group relative overflow-hidden rounded-2xl border transition-all duration-300',
                  'border-[var(--ui-border-muted)] bg-[var(--surface-panel)]',
                  'hover:-tranzinc-y-1 hover:border-[var(--accent-primary)]/40 hover:shadow-lg',
                  isWide ? 'sm:col-span-2' : ''
                )}
                style={{
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                {/* Glow effect on hover */}
                <div
                  className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                  style={{
                    background:
                      'radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(212,176,140,0.06), transparent 40%)',
                  }}
                />

                {item.imageUrl && (
                  <div className="relative h-48 overflow-hidden">
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[var(--surface-panel)] to-transparent" />
                  </div>
                )}

                <div className={cn('relative p-6', item.imageUrl ? '-mt-12' : '')}>
                  <div
                    className="mb-4 inline-flex size-10  items-center justify-center rounded-xl"
                    style={{
                      background:
                        'color-mix(in srgb, var(--accent-primary) 12%, var(--surface-panel-muted))',
                      color: 'var(--accent-primary)',
                    }}
                  >
                    <IconComponent className="size-5 " />
                  </div>

                  <h3
                    className="mb-2 text-lg font-semibold tracking-tight"
                    style={{
                      color: 'var(--ui-text-primary)',
                      fontFamily: 'var(--font-serif), Georgia, serif',
                    }}
                  >
                    {item.title}
                  </h3>

                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: 'var(--ui-text-muted)' }}
                  >
                    {item.description}
                  </p>
                </div>

                {/* Bottom border glow */}
                <div
                  className="absolute bottom-0 left-0 right-0 h-px opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                  style={{
                    background:
                      'linear-gradient(90deg, transparent, var(--accent-primary), transparent)',
                  }}
                />
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
