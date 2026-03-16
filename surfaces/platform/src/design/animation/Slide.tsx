/**
 * Slide Animation Component
 * 
 * GPU-accelerated slide transitions. Optimized for transform-only animation.
 */

'use client';

import React from 'react';
import { motion, Variants } from 'framer-motion';
import { useReducedMotion } from './accessibility';
import { animationTiming, getDuration } from './timing';

export type SlideDirection = 'up' | 'down' | 'left' | 'right';

export interface SlideProps {
  children: React.ReactNode;
  /** Direction of slide animation */
  direction: SlideDirection;
  /** Whether the element is visible */
  in?: boolean;
  /** Distance to slide in pixels (default: 100) */
  distance?: number;
  /** Animation duration in seconds */
  duration?: number;
  /** Delay before animation starts */
  delay?: number;
  /** Custom CSS class */
  className?: string;
  /** Custom inline styles */
  style?: React.CSSProperties;
  /** Callback when animation completes */
  onAnimationComplete?: () => void;
}

const getSlideOffset = (direction: SlideDirection, distance: number) => {
  switch (direction) {
    case 'up':
      return { y: distance };
    case 'down':
      return { y: -distance };
    case 'left':
      return { x: distance };
    case 'right':
      return { x: -distance };
    default:
      return {};
  }
};

/**
 * Slide component for directional slide animations.
 * Respects prefers-reduced-motion automatically.
 * 
 * @example
 * <Slide in={isOpen} direction="right" distance={200}>
 *   <Sidebar />
 * </Slide>
 */
export function Slide({
  children,
  direction,
  in: isVisible = true,
  distance = 100,
  duration = animationTiming.slow,
  delay = 0,
  className,
  style,
  onAnimationComplete,
}: SlideProps) {
  const prefersReducedMotion = useReducedMotion();
  const actualDuration = getDuration(duration, prefersReducedMotion);
  const offset = getSlideOffset(direction, distance);

  const variants: Variants = {
    hidden: {
      x: offset.x || 0,
      y: offset.y || 0,
      opacity: prefersReducedMotion ? 0 : 1,
    },
    visible: {
      x: 0,
      y: 0,
      opacity: 1,
      transition: {
        duration: actualDuration,
        delay: prefersReducedMotion ? 0 : delay,
        ease: animationTiming.easing.emphasized,
      },
    },
    exit: {
      x: offset.x || 0,
      y: offset.y || 0,
      opacity: prefersReducedMotion ? 0 : 1,
      transition: {
        duration: actualDuration * 0.8,
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
      style={style}
      onAnimationComplete={onAnimationComplete}
    >
      {children}
    </motion.div>
  );
}

/** Preset configurations for common slide patterns */
export const slidePresets = {
  /** Quick slide for responsive UI */
  quick: { duration: animationTiming.fast, distance: 50 },
  
  /** Standard slide for drawers/panels */
  standard: { duration: animationTiming.slow, distance: 100 },
  
  /** Drawer slide from left */
  drawerLeft: { direction: 'left' as const, distance: 300 },
  
  /** Drawer slide from right */
  drawerRight: { direction: 'right' as const, distance: 300 },
  
  /** Dropdown slide */
  dropdown: { direction: 'down' as const, distance: 10 },
  
  /** Toast notification slide */
  toast: { direction: 'right' as const, distance: 100 },
};
