'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { PromptBar } from '@/components/aura/PromptBar';
import { ArrowRight, Sparkles } from 'lucide-react';

export function HeroSection() {
  return (
    <section className="relative flex min-h-[90vh] flex-col items-center justify-center px-6 pb-20 pt-32">
      {/* Animated grid background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(212,176,140,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(212,176,140,0.04) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          maskImage: 'radial-gradient(ellipse 60% 50% at 50% 40%, black 40%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 60% 50% at 50% 40%, black 40%, transparent 100%)',
        }}
      />

      {/* Subtle radial glow */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/3 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-20"
        style={{
          background: 'radial-gradient(circle, rgba(212,176,140,0.15) 0%, transparent 70%)',
        }}
      />

      <div className="relative z-10 mx-auto max-w-4xl text-center">
        {/* Kicker */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 text-xs font-medium text-[#D97757] backdrop-blur-sm"
        >
          <Sparkles className="h-3.5 w-3.5" />
          AI-native platform for builders
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.08, ease: [0.4, 0, 0.2, 1] }}
          className="mb-6 font-serif text-5xl font-semibold tracking-tight text-white/95 sm:text-6xl md:text-7xl"
          style={{ fontFamily: 'var(--font-serif), Georgia, serif', lineHeight: 1.05 }}
        >
          Build with
          <br />
          <span className="text-[#D97757]">agents.</span>
        </motion.h1>

        {/* Subhead */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.16, ease: [0.4, 0, 0.2, 1] }}
          className="mx-auto mb-10 max-w-xl text-base text-white/40 sm:text-lg"
          style={{ lineHeight: 1.65 }}
        >
          One platform for every AI model, agent, and tool — running on
          infrastructure you own. No silos. No vendor lock-in.
        </motion.p>

        {/* Prompt bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.24, ease: [0.4, 0, 0.2, 1] }}
          className="mx-auto mb-12 max-w-xl"
        >
          <PromptBar
            placeholder="Describe what you want to build..."
            icon={<Sparkles className="h-4 w-4" />}
            actionIcon={<ArrowRight className="h-4 w-4" />}
            onSubmit={(value) => {
              if (typeof window !== 'undefined') {
                window.location.href = `/sign-up?prompt=${encodeURIComponent(value)}`;
              }
            }}
          />
        </motion.div>

        {/* CTA row */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.32, ease: [0.4, 0, 0.2, 1] }}
          className="flex flex-wrap items-center justify-center gap-4"
        >
          <a
            href="/sign-up"
            className="inline-flex items-center gap-2 rounded-full bg-[#D97757] px-6 py-3 text-sm font-semibold text-[#1A1612] transition-all hover:scale-105 hover:shadow-lg hover:shadow-[#D97757]/20 active:scale-95"
          >
            Get started free
            <ArrowRight className="h-4 w-4" />
          </a>
          <a
            href="/sign-in"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-6 py-3 text-sm font-medium text-white/70 backdrop-blur-sm transition-all hover:border-white/20 hover:bg-white/[0.06] hover:text-white/90"
          >
            Sign in
          </a>
        </motion.div>
      </div>
    </section>
  );
}
