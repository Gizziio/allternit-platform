'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { GlassBadge } from '@/components/aura/GlassBadge';
import { ChatMockup, CodeMockup, CoworkMockup, BrowserMockup } from './ModeMockups';

const TEMPLATES = [
  {
    id: 'chat',
    title: 'A:// Chat',
    subtitle: 'Talk to any AI model in one clean interface.',
    badges: [{ label: 'Multi-model', variant: 'default' as const }],
    Mockup: ChatMockup,
  },
  {
    id: 'code',
    title: 'A:// Code',
    subtitle: 'Write, review, and ship with AI at your side.',
    badges: [{ label: 'Execution', variant: 'success' as const }],
    Mockup: CodeMockup,
  },
  {
    id: 'cowork',
    title: 'A:// Cowork',
    subtitle: 'Build artifacts alongside an AI collaborator.',
    badges: [{ label: 'BETA', variant: 'accent' as const }],
    Mockup: CoworkMockup,
  },
  {
    id: 'browser',
    title: 'A:// Browser',
    subtitle: 'AI that navigates the web on your behalf.',
    badges: [{ label: 'Live', variant: 'info' as const }],
    Mockup: BrowserMockup,
  },
];

function TemplateCard({
  title,
  subtitle,
  badges,
  Mockup,
  href,
}: {
  title: string;
  subtitle: string;
  badges: Array<{ label: string; variant: React.ComponentProps<typeof GlassBadge>['variant'] }>;
  Mockup: React.FC;
  href: string;
}) {
  return (
    <motion.a
      href={href}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      className="group relative block overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] shadow-lg shadow-black/20 backdrop-blur-sm transition-shadow duration-300 hover:border-white/[0.14] hover:bg-white/[0.05] hover:shadow-2xl hover:shadow-black/40"
    >
      {/* Mockup area with gradient mask */}
      <div className="relative aspect-video overflow-hidden">
        <div className="h-full w-full transition-transform duration-500 group-hover:scale-[1.02]">
          <Mockup />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Badges */}
        {badges.length > 0 && (
          <div className="absolute right-3 top-3 flex flex-wrap justify-end gap-1.5">
            {badges.map((badge, i) => (
              <GlassBadge key={i} variant={badge.variant}>
                {badge.label}
              </GlassBadge>
            ))}
          </div>
        )}

        {/* Text overlay at bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 className="text-base font-semibold tracking-tight text-white/95">{title}</h3>
          <p className="mt-0.5 line-clamp-1 text-sm text-white/50">{subtitle}</p>
        </div>
      </div>
    </motion.a>
  );
}

export function TemplateGrid() {
  return (
    <section className="relative px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          className="mb-12 text-center"
        >
          <h2
            className="mb-3 text-3xl font-semibold tracking-tight text-white/95 sm:text-4xl"
            style={{ fontFamily: 'var(--font-serif), Georgia, serif', lineHeight: 1.1 }}
          >
            Every mode, one platform.
          </h2>
          <p className="mx-auto max-w-md text-base text-white/40">
            Switch between chat, code, cowork, and browser — all sharing the same context and memory.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {TEMPLATES.map((t, i) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{
                duration: 0.6,
                delay: i * 0.08,
                ease: [0.4, 0, 0.2, 1],
              }}
            >
              <TemplateCard
                title={t.title}
                subtitle={t.subtitle}
                badges={t.badges}
                Mockup={t.Mockup}
                href={`/sign-up?mode=${t.id}`}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
