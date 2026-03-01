/**
 * Scale Animation Component
 * 
 * GPU-accelerated scale animations for pop-in/out effects.
 * Uses transform: scale() for optimal performance.
 */

'use client';

import React from 'react';
import { motion, Variants } from 'framer-motion';
import { useReducedMotion } from './accessibility';
import { animationTiming, getDuration, getSpringConfig } from './timing';

export interface ScaleProps {
  children: React.ReactNode;
  /** Whether the element is visible */
  in?: boolean;
  /** Initial scale value (0-1, default: 0.8) */
  initial?: number;
  /** Final scale value (default: 1) */
  final?: number;
  /** Animation duration in seconds */
  duration?: number;
  /** Delay before animation starts */
  delay?: number;
  /** Whether to use spring physics instead of ease */
  spring?: boolean;
  /** Origin point for scaling (CSS transform-origin) */
  origin?: string;
  /** Custom CSS class */
  className?: string;
  /** Custom inline styles */
  style?: React.CSSProperties;
  /** Callback when animation completes */
  onAnimationComplete?: () => void;
}

/**
 * Scale component for zoom in/out animations.
 * Respects prefers-reduced-motion automatically.
 * 
 * @example
 * <Scale in={isOpen} initial={0.5} spring>
 *   <Modal />
 * </Scale>
 */
export function Scale({
  children,
  in: isVisible = true,
  initial = 0.8,
  final = 1,
  duration = animationTiming.base,
  delay = 0,
  spring = false,
  origin = 'center',
  className,
  style,
  onAnimationComplete,
}: ScaleProps) {
  const prefersReducedMotion = useReducedMotion();
  const actualDuration = getDuration(duration, prefersReducedMotion);
  const springConfig = getSpringConfig(
    animationTiming.spring.standard,
    prefersReducedMotion
  );

  const variants: Variants = {
    hidden: {
      scale: initial,
      opacity: 0,
    },
    visible: {
      scale: final,
      opacity: 1,
      transition: spring && !prefersReducedMotion
        ? { ...springConfig, delay }
        : {
            duration: actualDuration,
            delay: prefersReducedMotion ? 0 : delay,
            ease: animationTiming.easing.emphasized,
          },
    },
    exit: {
      scale: initial,
      opacity: 0,
      transition: {
        duration: actualDuration * 0.6,
        ease: animationTiming.easing.exit,
      },
    },
  };

  return (
    <motion.div
      initial="hidden"
      animate={isVisible ? 'visible' : 'hidden'}
      exit="exit"
      variants={variants}
      className={className}
      style={{
        transformOrigin: origin,
        ...style,
      }}
      onAnimationComplete={onAnimationComplete}
    >
      {children}
    </motion.div>
  );
}

/** Preset configurations for common scale patterns */
export const scalePresets = {
  /** Pop in for notifications */
  pop: { initial: 0.5, spring: true },
  
  /** Subtle scale for hover effects */
  subtle: { initial: 0.95, duration: animationTiming.fast },
  
  /** Modal appearance */
  modal: { initial: 0.9, spring: true },
  
  /** Dropdown menu */
  dropdown: { initial: 0.95, origin: 'top' as const },
  
  /** Tooltip appearance */
  tooltip: { initial: 0.8, duration: animationTiming.fast, origin: 'bottom' as const },
  
  /** Press effect for buttons */
  press: { initial: 0.97, duration: animationTiming.instant },
};
