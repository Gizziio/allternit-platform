/**
 * Stagger Animation Component
 * 
 * Animate children with staggered delays for visual polish.
 * GPU-accelerated with transform and opacity only.
 */

'use client';

import React from 'react';
import { motion, Variants } from 'framer-motion';
import { useReducedMotion } from './accessibility';
import { animationTiming, getStaggerDelay } from './timing';

export type StaggerDirection = 'up' | 'down' | 'left' | 'right';

export interface StaggerProps {
  /** Child elements to animate */
  children: React.ReactNode[];
  /** Delay between each child animation */
  staggerDelay?: number;
  /** Direction of stagger animation */
  direction?: StaggerDirection;
  /** Distance to move in pixels */
  distance?: number;
  /** Animation duration for each child */
  duration?: number;
  /** Initial delay before first child animates */
  delay?: number;
  /** Custom CSS class for container */
  className?: string;
  /** Custom CSS class for each child wrapper */
  childClassName?: string;
  /** Custom inline styles for container */
  style?: React.CSSProperties;
  /** Whether animation is active */
  active?: boolean;
  /** Render children without wrapper divs (for lists) */
  asList?: boolean;
}

const getDirectionOffset = (direction: StaggerDirection, distance: number) => {
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
 * Stagger component for animating children sequentially.
 * Respects prefers-reduced-motion automatically.
 * 
 * @example
 * <Stagger staggerDelay={0.05} direction="up">
 *   {items.map(item => <Card key={item.id} {...item} />)}
 * </Stagger>
 */
export function Stagger({
  children,
  staggerDelay = animationTiming.stagger.base,
  direction = 'up',
  distance = 20,
  duration = animationTiming.base,
  delay = 0,
  className,
  childClassName,
  style,
  active = true,
  asList = false,
}: StaggerProps) {
  const prefersReducedMotion = useReducedMotion();
  const actualStagger = getStaggerDelay(staggerDelay, prefersReducedMotion);
  const actualDuration = prefersReducedMotion 
    ? animationTiming.reduced.duration 
    : duration;
  const offset = getDirectionOffset(direction, distance);

  const containerVariants: Variants = {
    hidden: { opacity: 1 },
    visible: {
      opacity: 1,
      transition: {
        delayChildren: prefersReducedMotion ? 0 : delay,
        staggerChildren: actualStagger,
      },
    },
  };

  const itemVariants: Variants = {
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
        ease: animationTiming.easing.standard,
      },
    },
  };

  const Wrapper = asList ? React.Fragment : 'div';
  const wrapperProps = asList ? {} : { className, style };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate={active ? 'visible' : 'hidden'}
      className={className}
      style={style}
    >
      {React.Children.map(children, (child, index) => (
        <motion.div
          key={index}
          variants={itemVariants}
          className={childClassName}
          style={asList ? undefined : { display: 'contents' }}
        >
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}

/** Stagger.Container for advanced use cases */
Stagger.Container = function StaggerContainer({
  children,
  className,
  style,
  staggerDelay = animationTiming.stagger.base,
  delay = 0,
  active = true,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  staggerDelay?: number;
  delay?: number;
  active?: boolean;
}) {
  const prefersReducedMotion = useReducedMotion();
  const actualStagger = getStaggerDelay(staggerDelay, prefersReducedMotion);

  const containerVariants: Variants = {
    hidden: { opacity: 1 },
    visible: {
      opacity: 1,
      transition: {
        delayChildren: prefersReducedMotion ? 0 : delay,
        staggerChildren: actualStagger,
      },
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate={active ? 'visible' : 'hidden'}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
};

/** Stagger.Item for use within Stagger.Container */
Stagger.Item = function StaggerItem({
  children,
  className,
  style,
  direction = 'up',
  distance = 20,
  duration = animationTiming.base,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  direction?: StaggerDirection;
  distance?: number;
  duration?: number;
}) {
  const prefersReducedMotion = useReducedMotion();
  const actualDuration = prefersReducedMotion 
    ? animationTiming.reduced.duration 
    : duration;
  const offset = getDirectionOffset(direction, distance);

  const itemVariants: Variants = {
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
        ease: animationTiming.easing.standard,
      },
    },
  };

  return (
    <motion.div variants={itemVariants} className={className} style={style}>
      {children}
    </motion.div>
  );
};

/** Preset configurations for common stagger patterns */
export const staggerPresets = {
  /** Quick stagger for lists */
  quick: { staggerDelay: animationTiming.stagger.fast },
  
  /** Standard stagger for menus */
  standard: { staggerDelay: animationTiming.stagger.base },
  
  /** Slow stagger for emphasis */
  slow: { staggerDelay: animationTiming.stagger.slow },
  
  /** Cascade from top */
  cascadeDown: { direction: 'down' as const, distance: 15 },
  
  /** Cascade from bottom */
  cascadeUp: { direction: 'up' as const, distance: 15 },
  
  /** Horizontal reveal */
  horizontal: { direction: 'left' as const, distance: 30 },
};
