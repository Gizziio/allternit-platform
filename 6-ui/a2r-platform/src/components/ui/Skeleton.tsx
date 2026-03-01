/**
 * Skeleton Loading Component
 * 
 * Animated placeholder with shimmer effect for loading states.
 * Follows the Sand Nude design system with consistent spacing.
 * 
 * @example
 * <Skeleton variant="text" lines={3} />
 * <Skeleton variant="circular" width={64} height={64} />
 * <Skeleton variant="rounded" width={300} height={200} />
 * <Skeleton.ChatMessage />
 * <Skeleton.ThreadList count={5} />
 */

'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export type SkeletonVariant = 'text' | 'circular' | 'rectangular' | 'rounded' | 'avatar';

export interface SkeletonProps {
  /** Visual variant of the skeleton */
  variant?: SkeletonVariant;
  /** Width of the skeleton (number = px, string = css value) */
  width?: string | number;
  /** Height of the skeleton (number = px, string = css value) */
  height?: string | number;
  /** Whether to animate the shimmer effect */
  animate?: boolean;
  /** Number of skeleton lines (for text variant) */
  lines?: number;
  /** Custom CSS class */
  className?: string;
  /** Custom inline styles */
  style?: React.CSSProperties;
  /** Accessible label for screen readers */
  label?: string;
}

// CSS variable-based shimmer animation
const shimmerStyles: React.CSSProperties = {
  background: 'linear-gradient(90deg, var(--skeleton-bg) 25%, var(--skeleton-shimmer) 50%, var(--skeleton-bg) 75%)',
  backgroundSize: '200% 100%',
  animation: 'skeleton-shimmer 1.5s ease-in-out infinite',
};

const getBorderRadius = (variant: SkeletonVariant): string => {
  switch (variant) {
    case 'circular':
    case 'avatar':
      return '50%';
    case 'rounded':
      return 'var(--radius-md, 12px)';
    case 'text':
      return 'var(--radius-sm, 4px)';
    case 'rectangular':
    default:
      return 'var(--radius-xs, 4px)';
  }
};

const getDefaultHeight = (variant: SkeletonVariant): string => {
  switch (variant) {
    case 'text':
      return 'var(--skeleton-text-height, 1em)';
    case 'circular':
    case 'avatar':
      return 'var(--skeleton-avatar-size, 40px)';
    case 'rectangular':
    case 'rounded':
    default:
      return 'var(--skeleton-block-height, 100px)';
  }
};

const getDefaultWidth = (variant: SkeletonVariant): string => {
  switch (variant) {
    case 'text':
      return '100%';
    case 'circular':
    case 'avatar':
      return 'var(--skeleton-avatar-size, 40px)';
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
  label = 'Loading...',
}: SkeletonProps) {
  const prefersReducedMotion = typeof window !== 'undefined' 
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches 
    : false;
  
  const shouldAnimate = animate && !prefersReducedMotion;
  
  const baseWidth = width ?? getDefaultWidth(variant);
  const baseHeight = height ?? getDefaultHeight(variant);
  const borderRadius = getBorderRadius(variant);

  // Convert numbers to pixels
  const widthValue = typeof baseWidth === 'number' ? `${baseWidth}px` : baseWidth;
  const heightValue = typeof baseHeight === 'number' ? `${baseHeight}px` : baseHeight;

  const baseStyles: React.CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: 'var(--skeleton-bg)',
    borderRadius,
    width: widthValue,
    height: heightValue,
    ...(shouldAnimate ? shimmerStyles : {}),
    ...style,
  };

  // Multiple lines for text variant
  if (variant === 'text' && lines > 1) {
    return (
      <div 
        className={cn('flex flex-col', className)} 
        style={{ gap: 'var(--space-2, 8px)' }}
        role="status"
        aria-label={label}
      >
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
      aria-label={label}
      aria-live="polite"
    />
  );
}

// ============================================================================
// Composite Skeleton Components
// ============================================================================

/**
 * Skeleton for chat message bubbles
 */
Skeleton.ChatMessage = function SkeletonChatMessage({
  isUser = false,
  className,
}: {
  isUser?: boolean;
  className?: string;
}) {
  return (
    <div 
      className={cn(
        'flex gap-3 p-4',
        isUser ? 'flex-row-reverse' : 'flex-row',
        className
      )}
      role="status"
      aria-label="Loading message..."
    >
      <Skeleton variant="avatar" width={32} height={32} />
      <div className="flex-1 max-w-[80%] space-y-2">
        <Skeleton variant="text" width="90%" />
        <Skeleton variant="text" width="70%" />
        <Skeleton variant="text" width="40%" />
      </div>
    </div>
  );
};

/**
 * Skeleton for thread list items
 */
Skeleton.ThreadItem = function SkeletonThreadItem({ className }: { className?: string }) {
  return (
    <div 
      className={cn('flex items-center gap-3 px-3 py-2', className)}
      role="status"
      aria-label="Loading thread..."
    >
      <Skeleton variant="circular" width={18} height={18} />
      <Skeleton variant="text" width="70%" height={14} />
    </div>
  );
};

/**
 * Skeleton for thread list with multiple items
 */
Skeleton.ThreadList = function SkeletonThreadList({ 
  count = 5,
  className,
}: { 
  count?: number;
  className?: string;
}) {
  return (
    <div 
      className={cn('space-y-1', className)}
      role="status"
      aria-label={`Loading ${count} threads...`}
    >
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton.ThreadItem key={i} />
      ))}
    </div>
  );
};

/**
 * Skeleton for agent list items
 */
Skeleton.AgentItem = function SkeletonAgentItem({ className }: { className?: string }) {
  return (
    <div 
      className={cn('flex items-center gap-3 px-3 py-3', className)}
      role="status"
      aria-label="Loading agent..."
    >
      <Skeleton variant="avatar" width={36} height={36} />
      <div className="flex-1 space-y-1.5">
        <Skeleton variant="text" width="60%" height={14} />
        <Skeleton variant="text" width="40%" height={12} />
      </div>
    </div>
  );
};

/**
 * Skeleton for agent list with multiple items
 */
Skeleton.AgentList = function SkeletonAgentList({ 
  count = 4,
  className,
}: { 
  count?: number;
  className?: string;
}) {
  return (
    <div 
      className={cn('space-y-1', className)}
      role="status"
      aria-label={`Loading ${count} agents...`}
    >
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton.AgentItem key={i} />
      ))}
    </div>
  );
};

/**
 * Skeleton for card components
 */
Skeleton.Card = function SkeletonCard({
  width = '100%',
  height = 'auto',
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
    gap: 'var(--space-3, 12px)',
    padding: 'var(--space-4, 16px)',
    backgroundColor: 'var(--skeleton-card-bg, var(--bg-secondary))',
    borderRadius: 'var(--radius-lg, 16px)',
    border: '1px solid var(--border-subtle)',
    ...style,
  };

  return (
    <div 
      className={className}
      style={containerStyle}
      role="status"
      aria-label="Loading card..."
    >
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

/**
 * Skeleton for input bar
 */
Skeleton.InputBar = function SkeletonInputBar({ className }: { className?: string }) {
  return (
    <div 
      className={cn('flex items-center gap-3 p-3', className)}
      role="status"
      aria-label="Loading input..."
    >
      <Skeleton variant="circular" width={36} height={36} />
      <Skeleton variant="rounded" width="100%" height={44} />
      <Skeleton variant="circular" width={36} height={36} />
    </div>
  );
};

/**
 * Skeleton for empty state placeholder
 */
Skeleton.EmptyState = function SkeletonEmptyState({ className }: { className?: string }) {
  return (
    <div 
      className={cn('flex flex-col items-center justify-center gap-4 p-8', className)}
      role="status"
      aria-label="Loading content..."
    >
      <Skeleton variant="rounded" width={80} height={80} />
      <Skeleton variant="text" width="40%" height={24} />
      <Skeleton variant="text" width="60%" height={16} />
    </div>
  );
};

// ============================================================================
// Global Styles
// ============================================================================

/**
 * Add this to your global CSS or theme.css:
 * 
 * :root {
 *   --skeleton-bg: rgba(154, 118, 88, 0.08);
 *   --skeleton-shimmer: rgba(154, 118, 88, 0.15);
 *   --skeleton-card-bg: var(--bg-secondary);
 *   --skeleton-text-height: 1em;
 *   --skeleton-avatar-size: 40px;
 *   --skeleton-block-height: 100px;
 * }
 * 
 * [data-theme='dark'] {
 *   --skeleton-bg: rgba(212, 191, 168, 0.06);
 *   --skeleton-shimmer: rgba(212, 191, 168, 0.12);
 *   --skeleton-card-bg: var(--bg-secondary);
 * }
 * 
 * @keyframes skeleton-shimmer {
 *   0% { background-position: 200% 0; }
 *   100% { background-position: -200% 0; }
 * }
 */

export default Skeleton;
