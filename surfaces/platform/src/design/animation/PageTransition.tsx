/**
 * Page Transition Component
 * 
 * Route-level transitions with AnimatePresence.
 * Optimized for smooth page navigation.
 */

'use client';

import React from 'react';
import { motion, AnimatePresence, TargetAndTransition } from 'framer-motion';
import { useReducedMotion } from './accessibility';
import { animationTiming, getDuration } from './timing';

export type PageTransitionMode = 'fade' | 'slide' | 'scale' | 'slideUp' | 'none';

export interface PageTransitionProps {
  children: React.ReactNode;
  /** Transition animation mode */
  mode?: PageTransitionMode;
  /** Unique key for the page (usually pathname) */
  pageKey: string;
  /** Animation duration in seconds */
  duration?: number;
  /** Custom CSS class */
  className?: string;
  /** Custom inline styles */
  style?: React.CSSProperties;
  /** Whether to wait for exit animation before entering */
  wait?: boolean;
  /** Callback when transition completes */
  onExitComplete?: () => void;
}

interface PageTransitionVariants {
  initial: TargetAndTransition;
  animate: TargetAndTransition;
  exit: TargetAndTransition;
}

const createVariants = (
  mode: PageTransitionMode,
  duration: number,
  prefersReducedMotion: boolean
): PageTransitionVariants => {
  const actualDuration = getDuration(duration, prefersReducedMotion);

  // Reduced motion: just fade
  if (prefersReducedMotion) {
    return {
      initial: { opacity: 0 },
      animate: { 
        opacity: 1,
        transition: { duration: animationTiming.reduced.duration }
      },
      exit: { 
        opacity: 0,
        transition: { duration: animationTiming.reduced.duration }
      },
    };
  }

  switch (mode) {
    case 'fade':
      return {
        initial: { opacity: 0 },
        animate: { 
          opacity: 1,
          transition: { duration: actualDuration, ease: animationTiming.easing.standard }
        },
        exit: { 
          opacity: 0,
          transition: { duration: actualDuration * 0.5, ease: animationTiming.easing.exit }
        },
      };

    case 'slide':
      return {
        initial: { opacity: 0, x: 20 },
        animate: { 
          opacity: 1, 
          x: 0,
          transition: { duration: actualDuration, ease: animationTiming.easing.standard }
        },
        exit: { 
          opacity: 0, 
          x: -20,
          transition: { duration: actualDuration * 0.5, ease: animationTiming.easing.exit }
        },
      };

    case 'slideUp':
      return {
        initial: { opacity: 0, y: 20 },
        animate: { 
          opacity: 1, 
          y: 0,
          transition: { duration: actualDuration, ease: animationTiming.easing.standard }
        },
        exit: { 
          opacity: 0, 
          y: -20,
          transition: { duration: actualDuration * 0.5, ease: animationTiming.easing.exit }
        },
      };

    case 'scale':
      return {
        initial: { opacity: 0, scale: 0.95 },
        animate: { 
          opacity: 1, 
          scale: 1,
          transition: { duration: actualDuration, ease: animationTiming.easing.emphasized }
        },
        exit: { 
          opacity: 0, 
          scale: 0.95,
          transition: { duration: actualDuration * 0.5, ease: animationTiming.easing.exit }
        },
      };

    case 'none':
    default:
      return {
        initial: {},
        animate: {},
        exit: {},
      };
  }
};

/**
 * PageTransition component for route-level animations.
 * Wraps AnimatePresence for seamless page transitions.
 * Respects prefers-reduced-motion automatically.
 * 
 * @example
 * <PageTransition pageKey={pathname} mode="slideUp">
 *   {children}
 * </PageTransition>
 */
export function PageTransition({
  children,
  mode = 'fade',
  pageKey,
  duration = animationTiming.slow,
  className,
  style,
  wait = true,
  onExitComplete,
}: PageTransitionProps) {
  const prefersReducedMotion = useReducedMotion();
  const variants = createVariants(mode, duration, prefersReducedMotion);

  return (
    <AnimatePresence 
      mode={wait ? 'wait' : 'sync'}
      onExitComplete={onExitComplete}
    >
      <motion.div
        key={pageKey}
        initial={variants.initial}
        animate={variants.animate}
        exit={variants.exit}
        className={className}
        style={{
          willChange: mode === 'none' ? undefined : 'transform, opacity',
          ...style,
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/** Preset configurations for common page transition patterns */
export const pageTransitionPresets = {
  /** Subtle fade for most apps */
  subtle: { mode: 'fade' as const, duration: animationTiming.base },
  
  /** Slide for hierarchical navigation */
  hierarchical: { mode: 'slide' as const, duration: animationTiming.slow },
  
  /** Slide up for modal-like transitions */
  modal: { mode: 'slideUp' as const, duration: animationTiming.slow },
  
  /** Scale for dialogs/overlays */
  overlay: { mode: 'scale' as const, duration: animationTiming.base },
  
  /** No animation for instant navigation */
  instant: { mode: 'none' as const },
};

/** PageTransition.Wrapper for Next.js App Router integration */
PageTransition.Wrapper = function PageTransitionWrapper({
  children,
  className,
  ...props
}: Omit<PageTransitionProps, 'pageKey'> & { className?: string }) {
  // This is a placeholder for framework-specific integration
  // In Next.js, you would use usePathname() from 'next/navigation'
  return (
    <div className={className}>
      {children}
    </div>
  );
};
