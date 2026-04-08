/**
 * @fileoverview Animation Token System
 * 
 * Comprehensive animation tokens for transitions and motion.
 * Includes durations, easing functions, and keyframe definitions.
 * 
 * @module design/tokens/animation
 * @version 1.0.0
 */

/**
 * Animation durations
 * Timing values for transitions and animations
 */
export const duration = {
  /** 0ms - Instant, no animation */
  instant: '0ms',
  /** 50ms - Micro interactions */
  micro: '50ms',
  /** 100ms - Fast feedback */
  fast: '100ms',
  /** 150ms - Quick transitions */
  quick: '150ms',
  /** 200ms - Normal transitions */
  normal: '200ms',
  /** 250ms - Slower transitions */
  moderate: '250ms',
  /** 300ms - Emphasis animations */
  slow: '300ms',
  /** 400ms - Dramatic transitions */
  slower: '400ms',
  /** 500ms - Maximum standard duration */
  slowest: '500ms',
} as const;

/**
 * Duration values in milliseconds (for JS)
 */
export const durationMs = {
  instant: 0,
  micro: 50,
  fast: 100,
  quick: 150,
  normal: 200,
  moderate: 250,
  slow: 300,
  slower: 400,
  slowest: 500,
} as const;

/**
 * Easing functions
 * Cubic-bezier curves for natural motion
 */
export const easing = {
  /** Linear - constant speed */
  linear: 'linear',
  /** Ease - default browser easing */
  ease: 'ease',
  /** Ease in - accelerate from zero */
  easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
  /** Ease out - decelerate to zero */
  easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
  /** Ease in-out - accelerate then decelerate */
  easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  /** Spring - slight overshoot */
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  /** Bounce - noticeable overshoot */
  bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
} as const;

/**
 * Predefined transition combinations
 * Common transition presets
 */
export const transition = {
  /** Default transition - all properties */
  DEFAULT: `all ${duration.normal} ${easing.easeInOut}`,
  /** Fast transition - quick feedback */
  fast: `all ${duration.fast} ${easing.easeOut}`,
  /** Slow transition - emphasis */
  slow: `all ${duration.slow} ${easing.easeInOut}`,
  /** Color only transition */
  colors: `color, background-color, border-color, text-decoration-color, fill, stroke ${duration.normal} ${easing.easeInOut}`,
  /** Transform only transition */
  transform: `transform ${duration.normal} ${easing.spring}`,
  /** Opacity only transition */
  opacity: `opacity ${duration.normal} ${easing.easeInOut}`,
  /** Shadow only transition */
  shadow: `box-shadow ${duration.normal} ${easing.easeInOut}`,
  /** Common UI transition - colors + shadow */
  ui: `color, background-color, border-color, box-shadow ${duration.normal} ${easing.easeInOut}`,
} as const;

/**
 * Keyframe animation definitions
 * CSS keyframes as JavaScript objects for CSS-in-JS
 */
export const keyframes = {
  /** Fade in from transparent */
  fadeIn: {
    from: { opacity: '0' },
    to: { opacity: '1' },
  },
  /** Fade out to transparent */
  fadeOut: {
    from: { opacity: '1' },
    to: { opacity: '0' },
  },
  /** Slide in from bottom */
  slideUp: {
    from: { transform: 'translateY(10px)', opacity: '0' },
    to: { transform: 'translateY(0)', opacity: '1' },
  },
  /** Slide in from top */
  slideDown: {
    from: { transform: 'translateY(-10px)', opacity: '0' },
    to: { transform: 'translateY(0)', opacity: '1' },
  },
  /** Slide in from left */
  slideRight: {
    from: { transform: 'translateX(-10px)', opacity: '0' },
    to: { transform: 'translateX(0)', opacity: '1' },
  },
  /** Slide in from right */
  slideLeft: {
    from: { transform: 'translateX(10px)', opacity: '0' },
    to: { transform: 'translateX(0)', opacity: '1' },
  },
  /** Scale in from small */
  scaleIn: {
    from: { transform: 'scale(0.95)', opacity: '0' },
    to: { transform: 'scale(1)', opacity: '1' },
  },
  /** Scale out to small */
  scaleOut: {
    from: { transform: 'scale(1)', opacity: '1' },
    to: { transform: 'scale(0.95)', opacity: '0' },
  },
  /** Pulse animation */
  pulse: {
    '0%, 100%': { opacity: '1' },
    '50%': { opacity: '0.5' },
  },
  /** Bounce animation */
  bounce: {
    '0%, 100%': { transform: 'translateY(0)' },
    '50%': { transform: 'translateY(-25%)' },
  },
  /** Spin rotation */
  spin: {
    from: { transform: 'rotate(0deg)' },
    to: { transform: 'rotate(360deg)' },
  },
  /** Shimmer loading effect */
  shimmer: {
    '0%': { backgroundPosition: '-200% 0' },
    '100%': { backgroundPosition: '200% 0' },
  },
  /** Shake for errors */
  shake: {
    '0%, 100%': { transform: 'translateX(0)' },
    '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-4px)' },
    '20%, 40%, 60%, 80%': { transform: 'translateX(4px)' },
  },
  /** Pop attention animation */
  pop: {
    '0%': { transform: 'scale(1)' },
    '50%': { transform: 'scale(1.05)' },
    '100%': { transform: 'scale(1)' },
  },
} as const;

/**
 * Animation presets
 * Common animation combinations
 */
export const animation = {
  /** Fade in animation */
  fadeIn: `fadeIn ${duration.normal} ${easing.easeOut}`,
  /** Fade out animation */
  fadeOut: `fadeOut ${duration.normal} ${easing.easeIn}`,
  /** Slide up animation */
  slideUp: `slideUp ${duration.normal} ${easing.spring}`,
  /** Slide down animation */
  slideDown: `slideDown ${duration.normal} ${easing.spring}`,
  /** Scale in animation */
  scaleIn: `scaleIn ${duration.normal} ${easing.spring}`,
  /** Scale out animation */
  scaleOut: `scaleOut ${duration.fast} ${easing.easeIn}`,
  /** Pulse animation - looping */
  pulse: `pulse ${duration.slow} ${easing.easeInOut} infinite`,
  /** Bounce animation - looping */
  bounce: `bounce ${duration.slow} ${easing.easeInOut} infinite`,
  /** Spin animation - looping */
  spin: `spin 1s ${easing.linear} infinite`,
  /** Shimmer loading - looping */
  shimmer: `shimmer 2s ${easing.linear} infinite`,
  /** Shake animation */
  shake: `shake ${duration.normal} ${easing.easeInOut}`,
  /** Pop attention */
  pop: `pop ${duration.fast} ${easing.spring}`,
} as const;

/**
 * Stagger animation delays
 * For orchestrating multiple elements
 */
export const stagger = {
  /** 50ms between items */
  fast: 50,
  /** 100ms between items */
  normal: 100,
  /** 150ms between items */
  slow: 150,
} as const;

/**
 * Animation fill modes
 * How animations apply styles before/after execution
 */
export const fillMode = {
  /** No styles applied before/after */
  none: 'none',
  /** Retains final keyframe styles */
  forwards: 'forwards',
  /** Applies initial keyframe styles immediately */
  backwards: 'backwards',
  /** Both forwards and backwards */
  both: 'both',
} as const;

/**
 * Reduced motion preferences
 * Accessibility considerations
 */
export const reducedMotion = {
  /** Disable all animations */
  none: 'reduce',
  /** Allow all animations */
  allow: 'no-preference',
  /** Minimal duration for required animations */
  minimalDuration: duration.micro,
  /** Instant fallback */
  instant: duration.instant,
} as const;

/**
 * Complete animation tokens object
 */
export const animationTokens = {
  duration,
  durationMs,
  easing,
  transition,
  keyframes,
  animation,
  stagger,
  fillMode,
  reducedMotion,
} as const;

/** Duration type */
export type Duration = typeof duration;
/** Duration in ms type */
export type DurationMs = typeof durationMs;
/** Easing type */
export type Easing = typeof easing;
/** Transition type */
export type Transition = typeof transition;
/** Keyframes type */
export type Keyframes = typeof keyframes;
/** Animation type */
export type Animation = typeof animation;
/** Stagger type */
export type Stagger = typeof stagger;
/** Fill mode type */
export type FillMode = typeof fillMode;
/** Reduced motion type */
export type ReducedMotion = typeof reducedMotion;
/** Complete animation tokens type */
export type AnimationTokens = typeof animationTokens;

export default animationTokens;
