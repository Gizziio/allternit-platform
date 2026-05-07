/**
 * Accessibility Support for Animations
 * 
 * Respects prefers-reduced-motion and provides accessible alternatives.
 */

'use client';

import React from 'react';
import { 
  useReducedMotion as useFramerReducedMotion, 
  motion,
  HTMLMotionProps 
} from 'framer-motion';
import { animationTiming } from './timing';

/**
 * Hook to detect if user prefers reduced motion.
 * Combines Framer Motion's hook with CSS media query fallback.
 * 
 * @example
 * const shouldReduceMotion = useReducedMotion();
 * <motion.div animate={shouldReduceMotion ? {} : { scale: 1.1 }} />
 */
export function useReducedMotion(): boolean {
  return useFramerReducedMotion() ?? false;
}

export interface AccessibleMotionProps extends HTMLMotionProps<'div'> {
  /** Children to render */
  children: React.ReactNode;
  /** Fallback component when reduced motion is preferred */
  fallback?: React.ReactNode;
  /** Whether to disable animations entirely when reduced motion is on */
  disableOnReducedMotion?: boolean;
}

/**
 * AccessibleMotion - Wrapper that respects prefers-reduced-motion.
 * Automatically reduces or disables animations based on user preference.
 * 
 * @example
 * <AccessibleMotion
 *   initial={{ opacity: 0 }}
 *   animate={{ opacity: 1 }}
 *   fallback={<div>Static content</div>}
 * >
 *   <AnimatedContent />
 * </AccessibleMotion>
 */
export function AccessibleMotion({
  children,
  fallback,
  disableOnReducedMotion = true,
  ...motionProps
}: AccessibleMotionProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    if (fallback !== undefined) {
      return <>{fallback}</>;
    }

    if (disableOnReducedMotion) {
      // Render without animation props
      const { initial, animate, exit, transition, whileHover, whileTap, whileFocus, ...rest } = motionProps;
      const divProps = rest as React.HTMLAttributes<HTMLDivElement>;
      return <div {...divProps}>{children}</div>;
    }

    // Apply reduced motion variants with instant transitions
    const reducedTransition = {
      duration: animationTiming.reduced.duration,
    };

    return (
      <motion.div
        {...motionProps}
        transition={reducedTransition}
        initial={undefined}
        animate={undefined}
      >
        {children}
      </motion.div>
    );
  }

  return <motion.div {...motionProps}>{children}</motion.div>;
}

/**
 * MotionReduced - Component that only renders children when reduced motion is preferred.
 * Useful for providing alternative static content.
 * 
 * @example
 * <MotionReduced>
 *   <StaticIcon />
 * </MotionReduced>
 * <MotionEnabled>
 *   <AnimatedIcon />
 * </MotionEnabled>
 */
export function MotionReduced({
  children,
  fallback = null,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const shouldReduceMotion = useReducedMotion();
  return shouldReduceMotion ? <>{children}</> : <>{fallback}</>;
}

/**
 * MotionEnabled - Component that only renders children when motion is enabled.
 * 
 * @example
 * <MotionEnabled>
 *   <AnimatedBackground />
 * </MotionEnabled>
 */
export function MotionEnabled({
  children,
  fallback = null,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const shouldReduceMotion = useReducedMotion();
  return shouldReduceMotion ? <>{fallback}</> : <>{children}</>;
}

/**
 * AccessiblePresence - AnimatePresence that respects reduced motion.
 */
export function AccessiblePresence({
  children,
  mode = 'wait',
  ...props
}: {
  children: React.ReactNode;
  mode?: 'wait' | 'sync' | 'popLayout';
} & React.ComponentProps<typeof motion.div>) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    // Render without animation wrapper
    return <>{children}</>;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: animationTiming.fast }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/**
 * getAccessibleTransition - Helper to get transition config based on motion preference.
 * 
 * @example
 * const transition = getAccessibleTransition({ duration: 0.3 });
 * <motion.div transition={transition} />
 */
export function getAccessibleTransition(
  normalTransition: object,
  reducedTransition?: object
): object {
  const shouldReduceMotion = useReducedMotion();
  
  if (shouldReduceMotion) {
    return reducedTransition || { duration: animationTiming.reduced.duration };
  }
  
  return normalTransition;
}

/**
 * prefersReducedMotion - SSR-safe check for reduced motion preference.
 * Use only in client-side effects.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  
  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  return mediaQuery.matches;
}
