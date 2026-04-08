/**
 * LoadingSpinner Component
 * 
 * Consistent loading indicator with multiple variants and sizes.
 * Follows the Sand Nude design system.
 * 
 * @example
 * <LoadingSpinner size="sm" />
 * <LoadingSpinner size="md" variant="sand" />
 * <LoadingSpinner size="lg" variant="dots" />
 * <LoadingSpinner.FullScreen message="Loading..." />
 * <LoadingSpinner.Overlay />
 */

'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import {
  CircleNotch,
} from '@phosphor-icons/react';

export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type SpinnerVariant = 'default' | 'sand' | 'primary' | 'muted';

export interface LoadingSpinnerProps {
  /** Size of the spinner */
  size?: SpinnerSize;
  /** Color variant */
  variant?: SpinnerVariant;
  /** Custom CSS class */
  className?: string;
  /** Accessible label */
  label?: string;
  /** Whether to center the spinner */
  centered?: boolean;
}

const sizeMap = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
  xl: 'w-12 h-12',
};

const variantMap = {
  default: 'text-[var(--text-primary)]',
  sand: 'text-[var(--accent-chat)]',
  primary: 'text-[var(--accent-primary)]',
  muted: 'text-[var(--text-tertiary)]',
};

/**
 * LoadingSpinner - Consistent loading indicator
 */
export function LoadingSpinner({
  size = 'md',
  variant = 'default',
  className,
  label = 'Loading...',
  centered = false,
}: LoadingSpinnerProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center justify-center',
        centered && 'absolute inset-0',
        className
      )}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <CircleNotch
        className={cn(
          'animate-spin',
          sizeMap[size],
          variantMap[variant]
        )}
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}

// ============================================================================
// Dots Loading Animation
// ============================================================================

/**
 * LoadingDots - Animated dots for inline loading states
 */
LoadingSpinner.Dots = function LoadingDots({
  size = 'sm',
  variant = 'default',
  className,
  label = 'Loading...',
}: LoadingSpinnerProps) {
  const dotSize = {
    xs: 'w-1 h-1',
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-2.5 h-2.5',
    xl: 'w-3 h-3',
  }[size];

  const colorClass = variantMap[variant];

  return (
    <span
      className={cn('inline-flex items-center gap-1', className)}
      role="status"
      aria-label={label}
    >
      <span className="sr-only">{label}</span>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn(
            'rounded-full animate-bounce',
            dotSize,
            colorClass
          )}
          style={{
            animationDelay: `${i * 150}ms`,
            animationDuration: '1.4s',
          }}
        />
      ))}
    </span>
  );
};

// ============================================================================
// Pulse Loading Animation
// ============================================================================

/**
 * LoadingPulse - Pulsing circle for loading states
 */
LoadingSpinner.Pulse = function LoadingPulse({
  size = 'md',
  variant = 'default',
  className,
  label = 'Loading...',
}: LoadingSpinnerProps) {
  const sizeClass = {
    xs: 'w-4 h-4',
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  }[size];

  const colorClass = variantMap[variant];

  return (
    <span
      className={cn('inline-flex', className)}
      role="status"
      aria-label={label}
    >
      <span className="sr-only">{label}</span>
      <span
        className={cn(
          'rounded-full animate-pulse',
          sizeClass,
          colorClass,
          'opacity-75'
        )}
      />
    </span>
  );
};

// ============================================================================
// Full Screen Loading
// ============================================================================

interface FullScreenProps extends LoadingSpinnerProps {
  /** Message to display below spinner */
  message?: string;
  /** Whether to show a backdrop */
  backdrop?: boolean;
  /** Blur amount for backdrop */
  blur?: 'none' | 'sm' | 'md' | 'lg';
}

/**
 * LoadingSpinner.FullScreen - Full screen loading overlay
 */
LoadingSpinner.FullScreen = function FullScreenLoading({
  size = 'xl',
  variant = 'sand',
  message,
  backdrop = true,
  blur = 'md',
  className,
  label = 'Loading...',
}: FullScreenProps) {
  const blurClass = {
    none: '',
    sm: 'backdrop-blur-sm',
    md: 'backdrop-blur-md',
    lg: 'backdrop-blur-lg',
  }[blur];

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex flex-col items-center justify-center',
        backdrop && 'bg-[var(--bg-primary)]/80',
        blurClass,
        className
      )}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <LoadingSpinner size={size} variant={variant} label={label} />
      {message && (
        <p className="mt-4 text-[var(--text-secondary)] text-sm font-medium">
          {message}
        </p>
      )}
    </div>
  );
};

// ============================================================================
// Overlay Loading
// ============================================================================

/**
 * LoadingSpinner.Overlay - Loading overlay for containers
 */
LoadingSpinner.Overlay = function LoadingOverlay({
  size = 'lg',
  variant = 'sand',
  className,
  label = 'Loading...',
}: LoadingSpinnerProps) {
  return (
    <div
      className={cn(
        'absolute inset-0 z-40 flex items-center justify-center',
        'bg-[var(--bg-primary)]/60 backdrop-blur-sm',
        'rounded-[inherit]',
        className
      )}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <LoadingSpinner size={size} variant={variant} label={label} />
    </div>
  );
};

// ============================================================================
// Inline Loading with Text
// ============================================================================

interface InlineProps extends LoadingSpinnerProps {
  /** Text to display next to spinner */
  children: React.ReactNode;
  /** Position of spinner relative to text */
  position?: 'left' | 'right';
}

// Note: This check is intentionally here for Button component below
// The Inline component only supports 'left' | 'right'

/**
 * LoadingSpinner.Inline - Inline loading with text
 */
LoadingSpinner.Inline = function InlineLoading({
  children,
  size = 'sm',
  variant = 'default',
  position = 'left',
  className,
}: InlineProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2',
        className
      )}
    >
      {position === 'left' && (
        <LoadingSpinner size={size} variant={variant} />
      )}
      <span className="text-[var(--text-secondary)] text-sm">{children}</span>
      {position === 'right' && (
        <LoadingSpinner size={size} variant={variant} />
      )}
    </span>
  );
};

// ============================================================================
// Button Loading State
// ============================================================================

interface ButtonLoadingProps extends LoadingSpinnerProps {
  /** Whether the button is loading */
  loading: boolean;
  /** Button content to show when not loading */
  children: React.ReactNode;
  /** Position of spinner */
  position?: 'left' | 'right' | 'center';
}

/**
 * LoadingSpinner.Button - Button loading state wrapper
 */
LoadingSpinner.Button = function ButtonLoading({
  loading,
  children,
  size = 'sm',
  variant = 'default',
  position = 'left',
  className,
}: ButtonLoadingProps) {
  if (!loading) {
    return <>{children}</>;
  }

  if (position === 'center') {
    return (
      <span className={cn('inline-flex items-center justify-center', className)}>
        <LoadingSpinner size={size} variant={variant} />
      </span>
    );
  }

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      {position === 'left' && <LoadingSpinner size={size} variant={variant} />}
      <span>{children}</span>
      {position === 'right' && <LoadingSpinner size={size} variant={variant} />}
    </span>
  );
};

export default LoadingSpinner;
