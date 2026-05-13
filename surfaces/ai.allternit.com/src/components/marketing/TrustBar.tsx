'use client';

import React from 'react';
import { motion } from 'framer-motion';

const STATS = [
  { value: '150K+', label: 'Users worldwide' },
  { value: '4', label: 'Agent modes' },
  { value: '∞', label: 'Models supported' },
  { value: '0', label: 'Vendor lock-in' },
];

export function TrustBar(): JSX.Element {
  return (
    <section className="relative border-t border-white/[0.06] px-6 py-16">
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          className="grid grid-cols-2 gap-8 md:grid-cols-4"
        >
          {STATS.map((stat) => (
            <div key={stat.label} className="text-center">
              <div
                className="mb-1 text-3xl font-semibold tracking-tight text-white/90 sm:text-4xl"
                style={{ fontFamily: 'var(--font-serif), Georgia, serif' }}
              >
                {stat.value}
              </div>
              <div className="text-sm text-white/30">{stat.label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
