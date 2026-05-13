'use client';

import React, { useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { Icon } from '@tabler/icons-react';
import { cn } from '@/lib/utils';

export interface Feature {
  title: string;
  description: string;
  icon: Icon;
  gradient?: string;
}

export interface FeatureGridProps {
  features: Feature[];
  className?: string;
  columns?: 2 | 3 | 4;
}

function TiltCard({
  feature,
  index,
}: {
  feature: Feature;
  index: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const x = useMotionValue(0.5);
  const y = useMotionValue(0.5);

  const rotateX = useSpring(useTransform(y, [0, 1], [8, -8]), {
    stiffness: 300,
    damping: 30,
  });
  const rotateY = useSpring(useTransform(x, [0, 1], [-8, 8]), {
    stiffness: 300,
    damping: 30,
  });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    x.set(px);
    y.set(py);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    x.set(0.5);
    y.set(0.5);
  };

  const IconComponent = feature.icon;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{
        duration: 0.6,
        delay: index * 0.1,
        ease: [0.4, 0, 0.2, 1],
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      style={{
        perspective: 1000,
        rotateX: isHovered ? rotateX : 0,
        rotateY: isHovered ? rotateY : 0,
        transformStyle: 'preserve-3d',
      }}
      className="group relative"
    >
      <div
        className={cn(
          'relative overflow-hidden rounded-2xl border p-6 transition-all duration-300',
          'border-[var(--ui-border-muted)] bg-[var(--surface-panel)]',
          'hover:border-[var(--accent-primary)]/30 hover:shadow-lg'
        )}
        style={{
          boxShadow: isHovered
            ? '0 20px 40px rgba(0,0,0,0.3), 0 0 0 1px rgba(212,176,140,0.1)'
            : 'var(--shadow-sm)',
        }}
      >
        {/* Gradient background */}
        {feature.gradient && (
          <div
            className="pointer-events-none absolute -right-8 -top-8 size-32  rounded-full opacity-20 blur-3xl transition-opacity duration-500 group-hover:opacity-40"
            style={{ background: feature.gradient }}
          />
        )}

        {/* Icon */}
        <div
          className="relative mb-4 inline-flex size-12  items-center justify-center rounded-xl"
          style={{
            background:
              'color-mix(in srgb, var(--accent-primary) 10%, var(--surface-panel-muted))',
            color: 'var(--accent-primary)',
          }}
        >
          <IconComponent className="size-6 " />
        </div>

        {/* Title */}
        <h3
          className="relative mb-2 text-lg font-semibold tracking-tight"
          style={{
            color: 'var(--ui-text-primary)',
            fontFamily: 'var(--font-serif), Georgia, serif',
          }}
        >
          {feature.title}
        </h3>

        {/* Description */}
        <p
          className="relative text-sm leading-relaxed"
          style={{ color: 'var(--ui-text-muted)' }}
        >
          {feature.description}
        </p>

        {/* Shine effect on hover */}
        <div
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{
            background:
              'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.03) 45%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 55%, transparent 60%)',
          }}
        />
      </div>
    </motion.div>
  );
}

export function FeatureGrid({
  features,
  className,
  columns = 3,
}: FeatureGridProps) {
  const colClass =
    columns === 2
      ? 'sm:grid-cols-2'
      : columns === 4
        ? 'sm:grid-cols-2 lg:grid-cols-4'
        : 'sm:grid-cols-2 lg:grid-cols-3';

  return (
    <section className={cn('relative px-6 py-24', className)}>
      <div className={cn('mx-auto max-w-6xl grid grid-cols-1 gap-5', colClass)}>
        {features.map((feature, index) => (
          <TiltCard key={index} feature={feature} index={index} />
        ))}
      </div>
    </section>
  );
}
