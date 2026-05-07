'use client';

import React from 'react';
import { HeroSection } from '@/components/marketing/HeroSection';
import { TemplateGrid } from '@/components/marketing/TemplateGrid';
import { TrustBar } from '@/components/marketing/TrustBar';
import { MatrixLogo } from '@/components/ai-elements/MatrixLogo';
import { Github, Twitter } from 'lucide-react';

export default function MarketingPage() {
  return (
    <div
      className="min-h-screen text-white"
      style={{
        background: '#0F0C0A',
        backgroundImage:
          'radial-gradient(circle at 50% 0%, rgba(212,176,140,0.06) 0%, transparent 50%)',
      }}
    >
      {/* Nav */}
      <nav className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between border-b border-white/[0.06] bg-[#0F0C0A]/80 px-6 py-4 backdrop-blur-xl">
        <a href="/" className="flex items-center gap-2.5 text-white/90">
          <MatrixLogo state="idle" size={24} />
          <span className="text-sm font-semibold tracking-tight">Allternit</span>
        </a>
        <div className="flex items-center gap-3">
          <a
            href="https://github.com/allternit"
            target="_blank"
            rel="noreferrer"
            className="rounded-lg p-2 text-white/30 transition-colors hover:text-white/60"
          >
            <Github className="h-4 w-4" />
          </a>
          <a
            href="/sign-in"
            className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-medium text-white/70 backdrop-blur-sm transition-all hover:border-white/20 hover:bg-white/[0.06] hover:text-white/90"
          >
            Sign in
          </a>
        </div>
      </nav>

      {/* Hero */}
      <HeroSection />

      {/* Stats */}
      <TrustBar />

      {/* Templates */}
      <TemplateGrid />

      {/* Footer CTA */}
      <section className="relative px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2
            className="mb-4 text-3xl font-semibold tracking-tight text-white/95 sm:text-4xl"
            style={{ fontFamily: 'var(--font-serif), Georgia, serif', lineHeight: 1.1 }}
          >
            Ready to build?
          </h2>
          <p className="mb-8 text-base text-white/40">
            Join thousands of teams using Allternit to ship faster with AI.
          </p>
          <a
            href="/sign-up"
            className="inline-flex items-center gap-2 rounded-full bg-[#D97757] px-8 py-3.5 text-sm font-semibold text-[#1A1612] transition-all hover:scale-105 hover:shadow-lg hover:shadow-[#D97757]/20 active:scale-95"
          >
            Get started free
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2 text-white/20">
            <MatrixLogo state="idle" size={16} />
            <span className="text-xs">© {new Date().getFullYear()} Allternit</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-white/25">
            <a href="/terms" className="transition-colors hover:text-white/50">Terms</a>
            <a href="/privacy" className="transition-colors hover:text-white/50">Privacy</a>
            <a
              href="https://twitter.com/allternit"
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-white/50"
            >
              <Twitter className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
