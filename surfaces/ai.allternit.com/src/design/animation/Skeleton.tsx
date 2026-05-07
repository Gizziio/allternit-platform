/**
 * Skeleton Loading Component
 * 
 * Animated placeholder with shimmer effect using Framer Motion.
 * GPU-accelerated with transform animations.
 */

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useReducedMotion } from './accessibility';
import { shimmerAnimation } from './micro-interactions';

export type SkeletonVariant = 'text' | 'circular' | 'rectangular' | 'rounded';

export interface SkeletonProps {
  /** Visual variant of the skeleton */
  variant?: SkeletonVariant;
  /** Width of the skeleton */
  width?: string | number;
  /** Height of the skeleton */
  height?: string | number;
  /** Whether to animate the shimmer effect */
  animate?: boolean;
  /** Number of skeleton lines (for text variant) */
  lines?: number;
  /** Custom CSS class */
  className?: string;
  /** Custom inline styles */
  style?: React.CSSProperties;
}

const getBorderRadius = (variant: SkeletonVariant): string => {
  switch (variant) {
    case 'circular':
      return '50%';
    case 'rounded':
      return '8px';
    case 'text':
      return '4px';
    case 'rectangular':
    default:
      return '4px';
  }
};

const getDefaultHeight = (variant: SkeletonVariant): string => {
  switch (variant) {
    case 'text':
      return '1em';
    case 'circular':
      return '40px';
    case 'rectangular':
    case 'rounded':
    default:
      return '100px';
  }
};

const getDefaultWidth = (variant: SkeletonVariant): string => {
  switch (variant) {
    case 'text':
      return '100%';
    case 'circular':
      return '40px';
    case 'rectangular':
    case 'rounded':
    default:
      return '100%';
  }
};

/**
 * Skeleton component for loading states with shimmer animation.
 * Respects prefers-reduced-motion automatically.
 * 
 * @example
 * <Skeleton variant="text" lines={3} />
 * <Skeleton variant="circular" width={64} height={64} />
 * <Skeleton variant="rounded" width={300} height={200} />
 */
export function Skeleton({
  variant = 'text',
  width,
  height,
  animate = true,
  lines = 1,
  className,
  style,
}: SkeletonProps) {
  const prefersReducedMotion = useReducedMotion();
  const shouldAnimate = animate && !prefersReducedMotion;
  
  const baseWidth = width ?? getDefaultWidth(variant);
  const baseHeight = height ?? getDefaultHeight(variant);
  const borderRadius = getBorderRadius(variant);

  // Convert numbers to pixels
  const widthValue = typeof baseWidth === 'number' ? `${baseWidth}px` : baseWidth;
  const heightValue = typeof baseHeight === 'number' ? `${baseHeight}px` : baseHeight;

  const shimmerVariants = {
    initial: { x: '-100%' },
    animate: {
      x: '100%',
      transition: {
        repeat: Infinity,
        duration: 1.5,
        ease: 'linear' as const,
      },
    },
  };

  const baseStyles: React.CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: 'var(--skeleton-bg, rgba(255, 255, 255, 0.1))',
    borderRadius,
    width: widthValue,
    height: heightValue,
    ...style,
  };

  // Static fallback for reduced motion
  if (!shouldAnimate) {
    return (
      <div 
        className={className}
        style={baseStyles}
        role="status"
        aria-label="Loading..."
      />
    );
  }

  // Multiple lines for text variant
  if (variant === 'text' && lines > 1) {
    return (
      <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton
            key={i}
            variant="text"
            width={i === lines - 1 ? '60%' : '100%'}
            height={height}
            animate={animate}
          />
        ))}
      </div>
    );
  }

  return (
    <div 
      className={className}
      style={baseStyles}
      role="status"
      aria-label="Loading..."
    >
      {/* Shimmer overlay */}
      <motion.div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(90deg, transparent 0%, var(--ui-border-default) 50%, transparent 100%)',
        }}
        variants={shimmerVariants}
        initial="initial"
        animate="animate"
      />
    </div>
  );
}

/** Skeleton.Card for card-shaped skeletons */
Skeleton.Card = function SkeletonCard({
  width = 300,
  height = 200,
  hasImage = true,
  hasTitle = true,
  hasDescription = true,
  className,
  style,
}: {
  width?: string | number;
  height?: string | number;
  hasImage?: boolean;
  hasTitle?: boolean;
  hasDescription?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const containerStyle: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    padding: '16px',
    backgroundColor: 'var(--skeleton-bg, rgba(255, 255, 255, 0.05))',
    borderRadius: '12px',
    ...style,
  };

  return (
    <div className={className} style={containerStyle}>
      {hasImage && (
        <Skeleton variant="rounded" width="100%" height={120} />
      )}
      {hasTitle && (
        <Skeleton variant="text" width="60%" height={20} />
      )}
      {hasDescription && (
        <Skeleton variant="text" lines={2} />
      )}
    </div>
  );
};

/** Skeleton.Text for text-only skeletons */
Skeleton.Text = function SkeletonText({
  lines = 3,
  className,
  style,
}: {
  lines?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: '8px', ...style }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          width={i === lines - 1 ? '60%' : '100%'}
        />
      ))}
    </div>
  );
};

/** Skeleton.Avatar for avatar-shaped skeletons */
Skeleton.Avatar = function SkeletonAvatar({
  size = 40,
  className,
  style,
}: {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <Skeleton
      variant="circular"
      width={size}
      height={size}
      className={className}
      style={style}
    />
  );
};
