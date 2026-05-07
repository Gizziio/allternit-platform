'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { GlassBadge } from './GlassBadge';

interface AuraCardProps {
  image?: string;
  imageAlt?: string;
  title: string;
  subtitle?: string;
  badges?: Array<{ label: string; variant?: React.ComponentProps<typeof GlassBadge>['variant'] }>;
  href?: string;
  onClick?: () => void;
  className?: string;
  aspectRatio?: 'video' | 'square' | 'wide';
}

const aspectStyles = {
  video: 'aspect-video',
  square: 'aspect-square',
  wide: 'aspect-[21/9]',
};

/**
 * AuraCard — Image preview card with gradient overlay, hover lift, and shadow depth.
 * Inspired by Aura.build template preview cards.
 */
export function AuraCard({
  image,
  imageAlt,
  title,
  subtitle,
  badges,
  href,
  onClick,
  className,
  aspectRatio = 'video',
}: AuraCardProps) {
  const Wrapper = href ? motion.a : motion.div;
  const wrapperProps = href
    ? { href, target: '_blank', rel: 'noopener noreferrer' }
    : { onClick };

  return (
    <Wrapper
      {...wrapperProps}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        'group relative block overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm',
        'shadow-lg shadow-black/20 transition-shadow duration-300 hover:shadow-2xl hover:shadow-black/40 hover:border-white/[0.14]',
        'cursor-pointer',
        className
      )}
    >
      {/* Image area with gradient mask */}
      <div className={cn('relative overflow-hidden', aspectStyles[aspectRatio])}>
        {image ? (
          <img
            src={image}
            alt={imageAlt || title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-white/[0.03]">
            <span className="text-4xl opacity-20">◈</span>
          </div>
        )}

        {/* Gradient overlay */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Badges */}
        {badges && badges.length > 0 && (
          <div className="absolute right-3 top-3 flex flex-wrap justify-end gap-1.5">
            {badges.map((badge, i) => (
              <GlassBadge key={i} variant={badge.variant || 'default'}>
                {badge.label}
              </GlassBadge>
            ))}
          </div>
        )}

        {/* Text overlay at bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 className="text-base font-semibold text-white/95 tracking-tight">
            {title}
          </h3>
          {subtitle && (
            <p className="mt-0.5 text-sm text-white/50 line-clamp-1">
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </Wrapper>
  );
}
