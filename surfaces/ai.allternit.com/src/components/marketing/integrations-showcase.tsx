'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@tabler/icons-react';
import { cn } from '@/lib/utils';

export interface Integration {
  name: string;
  icon: Icon;
  status: 'connected' | 'disconnected';
  description?: string;
}

export interface IntegrationsShowcaseProps {
  integrations: Integration[];
  hubLabel?: string;
  className?: string;
}

export function IntegrationsShowcase({
  integrations,
  hubLabel = 'Allternit',
  className,
}: IntegrationsShowcaseProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const connected = useMemo(
    () => integrations.filter((i) => i.status === 'connected'),
    [integrations]
  );
  const disconnected = useMemo(
    () => integrations.filter((i) => i.status === 'disconnected'),
    [integrations]
  );

  const all = [...connected, ...disconnected];

  const radius = 220;
  const center = { x: 250, y: 250 };

  const positions = useMemo(() => {
    const count = all.length;
    if (count === 0) return [];
    const angleStep = (2 * Math.PI) / count;
    return all.map((_, i) => {
      const angle = i * angleStep - Math.PI / 2;
      return {
        x: center.x + radius * Math.cos(angle),
        y: center.y + radius * Math.sin(angle),
      };
    });
  }, [all.length]);

  return (
    <section className={cn('relative px-6 py-24', className)}>
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          className="mb-12 text-center"
        >
          <h2
            className="mb-3 text-3xl font-semibold tracking-tight text-[var(--ui-text-primary)] sm:text-4xl"
            style={{ fontFamily: 'var(--font-serif), Georgia, serif', lineHeight: 1.1 }}
          >
            Integrations
          </h2>
          <p className="mx-auto max-w-md text-base text-[var(--ui-text-muted)]">
            Connect your favorite tools and services. One hub, every integration.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
          className="relative mx-auto flex aspect-square max-w-[500px] items-center justify-center"
        >
          {/* SVG connections */}
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox="0 0 500 500"
            fill="none"
          >
            {positions.map((pos, i) => {
              const isHovered = hoveredIndex === i;
              const isConnected = all[i].status === 'connected';
              return (
                <line
                  key={i}
                  x1={center.x}
                  y1={center.y}
                  x2={pos.x}
                  y2={pos.y}
                  strokeWidth={isHovered ? 2 : 1}
                  stroke={
                    isConnected
                      ? 'var(--accent-primary)'
                      : 'var(--ui-border-muted)'
                  }
                  opacity={isHovered ? 0.6 : isConnected ? 0.35 : 0.2}
                  strokeDasharray={isConnected ? '0' : '4 4'}
                  className="transition-all duration-300"
                />
              );
            })}
          </svg>

          {/* Hub node */}
          <div
            className="relative z-10 flex size-24  items-center justify-center rounded-full border-2 text-lg font-bold"
            style={{
              background: 'var(--surface-panel)',
              borderColor: 'var(--accent-primary)',
              color: 'var(--accent-primary)',
              boxShadow: '0 0 40px rgba(212,176,140,0.15)',
            }}
          >
            {hubLabel}
            {/* Pulse ring for hub */}
            <div
              className="absolute inset-0 rounded-full animate-ping"
              style={{
                background: 'var(--accent-primary)',
                opacity: 0.08,
                animationDuration: '3s',
              }}
            />
          </div>

          {/* Integration nodes */}
          {positions.map((pos, i) => {
            const integration = all[i];
            const IconComponent = integration.icon;
            const isHovered = hoveredIndex === i;
            const isConnected = integration.status === 'connected';

            return (
              <motion.div
                key={integration.name}
                className="absolute"
                style={{
                  left: pos.x,
                  top: pos.y,
                  transform: 'translate(-50%, -50%)',
                }}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <div
                  className={cn(
                    'relative flex size-14  cursor-pointer items-center justify-center rounded-2xl border transition-all duration-300',
                    isHovered
                      ? 'scale-110 border-[var(--accent-primary)]/50 shadow-xl'
                      : 'border-[var(--ui-border-muted)] shadow-md',
                    isConnected && !isHovered && 'animate-pulse'
                  )}
                  style={{
                    background: 'var(--surface-panel)',
                    boxShadow: isHovered
                      ? '0 8px 32px rgba(0,0,0,0.3), 0 0 0 1px rgba(212,176,140,0.15)'
                      : 'var(--shadow-sm)',
                    animationDuration: isConnected ? '2.5s' : undefined,
                  }}
                >
                  <IconComponent
                    className="size-6 "
                    style={{
                      color: isConnected
                        ? 'var(--accent-primary)'
                        : 'var(--ui-text-muted)',
                    }}
                  />

                  {/* Connected status dot */}
                  {isConnected && (
                    <div
                      className="absolute -right-1 -top-1 size-3  rounded-full border-2"
                      style={{
                        background: 'var(--status-success)',
                        borderColor: 'var(--surface-panel)',
                      }}
                    />
                  )}
                </div>

                {/* Hover tooltip */}
                <AnimatePresence>
                  {isHovered && (
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className="absolute left-1/2 top-full z-20 mt-3 w-48 -tranzinc-x-1/2 rounded-xl border p-3"
                      style={{
                        background: 'var(--surface-floating)',
                        borderColor: 'var(--ui-border-muted)',
                        boxShadow: 'var(--shadow-lg)',
                      }}
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span
                          className="text-sm font-semibold"
                          style={{ color: 'var(--ui-text-primary)' }}
                        >
                          {integration.name}
                        </span>
                        <span
                          className="rounded-full px-1.5 py-0.5 text-xs font-medium uppercase"
                          style={{
                            background:
                              integration.status === 'connected'
                                ? 'color-mix(in srgb, var(--status-success) 16%, transparent)'
                                : 'color-mix(in srgb, var(--ui-text-muted) 16%, transparent)',
                            color:
                              integration.status === 'connected'
                                ? 'var(--status-success)'
                                : 'var(--ui-text-muted)',
                          }}
                        >
                          {integration.status}
                        </span>
                      </div>
                      {integration.description && (
                        <p
                          className="text-xs leading-relaxed"
                          style={{ color: 'var(--ui-text-muted)' }}
                        >
                          {integration.description}
                        </p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Legend */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-6">
          <div className="flex items-center gap-2">
            <div
              className="size-2  rounded-full"
              style={{ background: 'var(--status-success)' }}
            />
            <span className="text-xs text-[var(--ui-text-muted)]">
              Connected ({connected.length})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="size-2  rounded-full"
              style={{ background: 'var(--ui-text-muted)', opacity: 0.4 }}
            />
            <span className="text-xs text-[var(--ui-text-muted)]">
              Disconnected ({disconnected.length})
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
