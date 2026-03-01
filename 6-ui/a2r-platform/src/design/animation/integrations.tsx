/**
 * Integration Components
 * 
 * Pre-composed animations combining the design system with motion.
 * Glass system integration and other compound components.
 */

'use client';

import React from 'react';
import { motion, TargetAndTransition } from 'framer-motion';
import { GlassCard } from '../glass/GlassCard';
import { GlassSurface, GlassIntensity } from '../glass/GlassSurface';
import { useReducedMotion } from './accessibility';
import { animationTiming } from './timing';
import { buttonTap, hoverLift, cardInteractions, hoverGlow } from './micro-interactions';

export interface AnimatedGlassCardProps {
  children: React.ReactNode;
  /** Whether the card is interactive */
  interactive?: boolean;
  /** Whether to show hover lift effect */
  hoverable?: boolean;
  /** Animation variant */
  variant?: 'default' | 'pop' | 'slide' | 'fade';
  /** Glass intensity */
  intensity?: GlassIntensity;
  /** Delay before animation starts */
  delay?: number;
  /** Custom CSS class */
  className?: string;
  /** Custom inline styles */
  style?: React.CSSProperties;
  /** Click handler */
  onClick?: () => void;
  /** Additional motion props */
  initial?: TargetAndTransition;
  animate?: TargetAndTransition;
  exit?: TargetAndTransition;
}

/**
 * AnimatedGlassCard - GlassCard with motion animations.
 * Coordinates with Glass System (T1-A3).
 * 
 * @example
 * <AnimatedGlassCard interactive hoverable>
 *   <CardContent />
 * </AnimatedGlassCard>
 */
export function AnimatedGlassCard({
  children,
  interactive = false,
  hoverable = true,
  variant = 'default',
  intensity = 'elevated',
  delay = 0,
  className,
  style,
  onClick,
  initial,
  animate,
  exit,
}: AnimatedGlassCardProps) {
  const prefersReducedMotion = useReducedMotion();

  const getInitialAnimation = (): TargetAndTransition => {
    if (prefersReducedMotion) return { opacity: 0 };
    
    switch (variant) {
      case 'pop':
        return { opacity: 0, scale: 0.9 };
      case 'slide':
        return { opacity: 0, y: 20 };
      case 'fade':
        return { opacity: 0 };
      default:
        return { opacity: 0, y: 10 };
    }
  };

  const getAnimateAnimation = (): TargetAndTransition => {
    if (prefersReducedMotion) return { opacity: 1 };
    
    return { 
      opacity: 1, 
      scale: 1, 
      y: 0,
      x: 0,
    };
  };

  const transition = prefersReducedMotion 
    ? { duration: animationTiming.reduced.duration }
    : { 
        duration: animationTiming.base,
        delay,
        ease: animationTiming.easing.standard,
      };

  const hoverProps = hoverable && !prefersReducedMotion 
    ? { whileHover: hoverLift } 
    : {};

  const tapProps = interactive && !prefersReducedMotion 
    ? { whileTap: buttonTap } 
    : {};

  return (
    <motion.div
      initial={initial || getInitialAnimation()}
      animate={animate || getAnimateAnimation()}
      exit={exit}
      transition={transition}
      onClick={onClick}
      className={className}
      style={{
        cursor: interactive ? 'pointer' : 'default',
        ...style,
      }}
      {...hoverProps}
      {...tapProps}
    >
      <GlassSurface intensity={intensity}>
        {children}
      </GlassSurface>
    </motion.div>
  );
}

/**
 * AnimatedGlassSurface - Lower-level animated glass container.
 */
export function AnimatedGlassSurface({
  children,
  intensity = 'base',
  animate = true,
  className,
  style,
}: {
  children: React.ReactNode;
  intensity?: GlassIntensity;
  animate?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const prefersReducedMotion = useReducedMotion();
  const shouldAnimate = animate && !prefersReducedMotion;

  return (
    <motion.div
      initial={shouldAnimate ? { opacity: 0, backdropFilter: 'blur(0px)' } : undefined}
      animate={{ opacity: 1, backdropFilter: `blur(${intensity === 'thin' ? 16 : intensity === 'elevated' ? 32 : 24}px)` }}
      transition={{ duration: animationTiming.slow }}
      className={className}
      style={style}
    >
      <GlassSurface intensity={intensity}>
        {children}
      </GlassSurface>
    </motion.div>
  );
}

/**
 * HoverCard - Card with lift and shadow on hover.
 */
export function HoverCard({
  children,
  className,
  style,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      whileHover={prefersReducedMotion ? undefined : { y: -2, boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)' }}
      whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
      transition={{ duration: animationTiming.base }}
      onClick={onClick}
      className={className}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * AnimatedButton - Button with tap and hover animations.
 */
export function AnimatedButton({
  children,
  onClick,
  className,
  style,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.button
      {...(!prefersReducedMotion && !disabled && { 
        whileHover: { scale: 1.02 },
        whileTap: buttonTap,
      })}
      onClick={onClick}
      disabled={disabled}
      className={className}
      style={{
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        ...style,
      }}
    >
      {children}
    </motion.button>
  );
}

/**
 * Pressable - Generic pressable surface with tactile feedback.
 */
export function Pressable({
  children,
  onClick,
  className,
  style,
  scale = 0.97,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
  scale?: number;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      whileTap={prefersReducedMotion ? undefined : { scale }}
      onClick={onClick}
      className={className}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * FadeIn - Wrapper that fades in when mounted.
 */
export function FadeIn({
  children,
  delay = 0,
  duration = animationTiming.base,
  direction = 'none',
  distance = 20,
  className,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  distance?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const prefersReducedMotion = useReducedMotion();
  
  const getInitial = (): TargetAndTransition => {
    if (prefersReducedMotion) return { opacity: 0 };
    
    const offset: { x?: number; y?: number } = {};
    if (direction === 'up') offset.y = distance;
    if (direction === 'down') offset.y = -distance;
    if (direction === 'left') offset.x = distance;
    if (direction === 'right') offset.x = -distance;
    
    return { opacity: 0, ...offset };
  };

  return (
    <motion.div
      initial={getInitial()}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{
        duration: prefersReducedMotion ? animationTiming.reduced.duration : duration,
        delay,
        ease: animationTiming.easing.standard,
      }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
}

/**
 * StaggerContainer - Container that staggers its children.
 */
export function StaggerContainer({
  children,
  staggerDelay = animationTiming.stagger.base,
  className,
  style,
}: {
  children: React.ReactNode;
  staggerDelay?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const prefersReducedMotion = useReducedMotion();
  
  const containerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: prefersReducedMotion ? 0 : staggerDelay,
      },
    },
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
}

/**
 * StaggerChild - Child element for StaggerContainer.
 */
export function StaggerChild({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const prefersReducedMotion = useReducedMotion();

  const childVariants = {
    hidden: { opacity: 0, y: prefersReducedMotion ? 0 : 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: {
        duration: prefersReducedMotion ? animationTiming.reduced.duration : animationTiming.base,
      }
    },
  };

  return (
    <motion.div
      variants={childVariants}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
}
