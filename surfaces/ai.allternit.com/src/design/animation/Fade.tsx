/**
 * Fade Animation Component
 * 
 * GPU-accelerated fade in/out animation with optional directional movement.
 * Uses transform and opacity only for optimal performance.
 */

'use client';

import React from 'react';
import { motion, Variants } from 'framer-motion';
import { useReducedMotion } from './accessibility';
import { animationTiming, getDuration } from './timing';

export type FadeDirection = 'up' | 'down' | 'left' | 'right' | 'none';

export interface FadeProps {
  children: React.ReactNode;
  /** Whether the element is visible */
  in?: boolean;
  /** Animation duration in seconds */
  duration?: number;
  /** Delay before animation starts */
  delay?: number;
  /** Direction of movement during fade */
  direction?: FadeDirection;
  /** Distance to move in pixels (default: 20) */
  distance?: number;
  /** Custom CSS class */
  className?: string;
  /** Custom inline styles */
  style?: React.CSSProperties;
  /** Callback when animation completes */
  onAnimationComplete?: () => void;
  /** HTML element to render as */
  as?: keyof JSX.IntrinsicElements;
}

const getDirectionOffset = (direction: FadeDirection, distance: number) => {
  switch (direction) {
    case 'up':
      return { y: distance };
    case 'down':
      return { y: -distance };
    case 'left':
      return { x: distance };
    case 'right':
      return { x: -distance };
    case 'none':
    default:
      return {};
  }
};

/**
 * Fade component for smooth opacity transitions with optional directional movement.
 * Respects prefers-reduced-motion automatically.
 * 
 * @example
 * <Fade in={isVisible} direction="up" distance={30}>
 *   <div>Content fades in from below</div>
 * </Fade>
 */
export function Fade({
  children,
  in: isVisible = true,
  duration = animationTiming.base,
  delay = 0,
  direction = 'none',
  distance = 20,
  className,
  style,
  onAnimationComplete,
  as: Component = 'div',
}: FadeProps) {
  const prefersReducedMotion = useReducedMotion();
  const actualDuration = getDuration(duration, prefersReducedMotion);
  const offset = getDirectionOffset(direction, distance);

  const variants: Variants = {
    hidden: {
      opacity: 0,
      ...offset,
    },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: {
        duration: actualDuration,
        delay: prefersReducedMotion ? 0 : delay,
        ease: animationTiming.easing.standard,
      },
    },
    exit: {
      opacity: 0,
      ...offset,
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

/** Fade.In is an alias for the main Fade component */
Fade.In = Fade;

/** Fade.Out variant for exit-only animations */
Fade.Out = function FadeOut(props: Omit<FadeProps, 'in'> & { out?: boolean }) {
  const { out = true, ...rest } = props;
  return <Fade in={!out} {...rest} />;
};

/** Preset configurations for common fade patterns */
export const fadePresets = {
  /** Quick fade for micro-interactions */
  quick: { duration: animationTiming.fast },
  
  /** Standard fade for most UI transitions */
  standard: { duration: animationTiming.base },
  
  /** Slow fade for emphasis */
  slow: { duration: animationTiming.slow },
  
  /** Fade up for content entry */
  up: { direction: 'up' as const, distance: 20 },
  
  /** Fade down for dropdown content */
  down: { direction: 'down' as const, distance: 10 },
  
  /** Fade in from left for slide-in panels */
  left: { direction: 'left' as const, distance: 30 },
  
  /** Fade in from right for slide-in panels */
  right: { direction: 'right' as const, distance: 30 },
};
