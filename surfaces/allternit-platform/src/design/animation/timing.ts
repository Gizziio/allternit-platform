/**
 * Animation Timing Tokens
 * 
 * Coordinated with T1-A1 design tokens for consistent motion across the platform.
 * All durations are in seconds.
 */

export const animationTiming = {
  /** Ultra-fast transitions (micro-interactions) */
  instant: 0.05,
  
  /** Fast transitions (hover states, small UI changes) */
  fast: 0.14,
  
  /** Base transitions (standard UI animations) */
  base: 0.2,
  
  /** Slow transitions (emphasis, page transitions) */
  slow: 0.3,
  
  /** Deliberate transitions (complex animations) */
  deliberate: 0.5,
  
  /** Spring physics configuration for natural motion */
  spring: {
    gentle: { type: 'spring' as const, stiffness: 120, damping: 14 },
    standard: { type: 'spring' as const, stiffness: 400, damping: 30 },
    bouncy: { type: 'spring' as const, stiffness: 500, damping: 15 },
    stiff: { type: 'spring' as const, stiffness: 600, damping: 40 },
  },
  
  /** Easing curves for custom transitions */
  easing: {
    /** Standard ease curve */
    standard: [0.4, 0, 0.2, 1] as const,
    
    /** Enter curve - elements appearing */
    enter: [0, 0, 0.2, 1] as const,
    
    /** Exit curve - elements leaving */
    exit: [0.4, 0, 1, 1] as const,
    
    /** Emphasized curve - attention-grabbing */
    emphasized: [0.2, 0, 0, 1] as const,
    
    /** Spring-like easing */
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  
  /** Stagger delays for child animations */
  stagger: {
    fast: 0.03,
    base: 0.05,
    slow: 0.08,
  },
  
  /** Reduced motion alternatives */
  reduced: {
    duration: 0.01,
    stagger: 0,
  },
} as const;

/** Type for animation timing tokens */
export type TimingToken = typeof animationTiming;

/** Helper to get duration respecting reduced motion */
export function getDuration(
  baseDuration: number,
  prefersReducedMotion: boolean
): number {
  if (prefersReducedMotion) {
    return animationTiming.reduced.duration;
  }
  return baseDuration;
}

/** Helper to get stagger delay respecting reduced motion */
export function getStaggerDelay(
  baseDelay: number,
  prefersReducedMotion: boolean
): number {
  if (prefersReducedMotion) {
    return animationTiming.reduced.stagger;
  }
  return baseDelay;
}

/** Helper to get spring config respecting reduced motion */
export function getSpringConfig(
  config: typeof animationTiming.spring.standard,
  prefersReducedMotion: boolean
): typeof animationTiming.spring.standard | { duration: number } {
  if (prefersReducedMotion) {
    return { duration: animationTiming.reduced.duration };
  }
  return config;
}
