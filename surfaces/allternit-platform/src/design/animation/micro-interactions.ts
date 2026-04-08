/**
 * Micro-Interactions
 * 
 * Predefined animation configurations for common UI interactions.
 * All use GPU-accelerated properties.
 */

import { Transition, Variants } from 'framer-motion';
import { animationTiming } from './timing';

/** Type for micro-interaction configurations */
export interface MicroInteraction {
  initial?: object;
  animate?: object;
  whileHover?: object;
  whileTap?: object;
  whileFocus?: object;
  transition?: Transition;
}

/**
 * Button tap animation - subtle scale down on press.
 * Use with whileTap prop.
 * 
 * @example
 * <motion.button whileTap={buttonTap}>Click me</motion.button>
 */
export const buttonTap = {
  scale: 0.97,
  transition: { duration: animationTiming.instant },
};

/**
 * Hover lift effect - subtle elevation on hover.
 * Use with whileHover prop.
 * 
 * @example
 * <motion.div whileHover={hoverLift}>Hover me</motion.div>
 */
export const hoverLift = {
  y: -2,
  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
  transition: { duration: animationTiming.fast },
};

/**
 * Focus ring animation - visible focus indicator.
 * Use with whileFocus prop or CSS.
 * 
 * @example
 * <motion.input whileFocus={focusRing} />
 */
export const focusRing = {
  boxShadow: '0 0 0 3px rgba(14, 165, 233, 0.3)',
  transition: { duration: animationTiming.instant },
};

/**
 * Pulse animation - subtle attention grabber.
 * Use with animate prop for continuous animation.
 * 
 * @example
 * <motion.div animate={pulseAnimation}>Notification</motion.div>
 */
export const pulseAnimation = {
  scale: [1, 1.02, 1],
  opacity: [1, 0.8, 1],
  transition: {
    duration: 1.5,
    repeat: Infinity,
    ease: 'easeInOut' as const,
  },
};

/**
 * Shimmer animation - loading state effect.
 * Use with a masked gradient overlay.
 * 
 * @example
 * <motion.div variants={shimmerAnimation} initial="initial" animate="animate" />
 */
export const shimmerAnimation: Variants = {
  initial: {
    x: '-100%',
  },
  animate: {
    x: '100%',
    transition: {
      repeat: Infinity,
      duration: 1.5,
      ease: 'linear',
    },
  },
};

/**
 * Bounce animation - playful emphasis.
 * Use with animate prop.
 */
export const bounceAnimation = {
  y: [0, -4, 0],
  transition: {
    duration: 0.4,
    ease: animationTiming.easing.spring,
  },
};

/**
 * Shake animation - error/attention state.
 * Use with animate prop.
 */
export const shakeAnimation = {
  x: [0, -4, 4, -4, 4, 0],
  transition: {
    duration: 0.4,
    ease: animationTiming.easing.standard,
  },
};

/**
 * Scale on hover - emphasis effect.
 * Use with whileHover prop.
 */
export const hoverScale = {
  scale: 1.02,
  transition: { duration: animationTiming.fast },
};

/**
 * Glow on hover - focus/attention effect.
 * Use with whileHover prop.
 */
export const hoverGlow = {
  boxShadow: '0 0 20px rgba(212, 176, 140, 0.4)',
  transition: { duration: animationTiming.fast },
};

/**
 * Press down effect - tactile feedback.
 * Use with whileTap prop.
 */
export const pressDown = {
  scale: 0.96,
  y: 1,
  transition: { duration: animationTiming.instant },
};

/**
 * Expand on hover - for cards/tiles.
 * Use with whileHover prop.
 */
export const expandOnHover = {
  scale: 1.02,
  y: -4,
  transition: {
    duration: animationTiming.base,
    ease: animationTiming.spring.gentle,
  },
};

/**
 * Icon button interactions - combined hover and tap.
 * Use spread operator on motion component.
 * 
 * @example
 * <motion.button {...iconButtonInteractions} />
 */
export const iconButtonInteractions: MicroInteraction = {
  whileHover: { scale: 1.1 },
  whileTap: buttonTap,
  transition: { duration: animationTiming.fast },
};

/**
 * Card interactions - lift and shadow on hover.
 * Use spread operator on motion component.
 * 
 * @example
 * <motion.div {...cardInteractions} />
 */
export const cardInteractions: MicroInteraction = {
  whileHover: hoverLift,
  whileTap: { scale: 0.99 },
  transition: { duration: animationTiming.base },
};

/**
 * Link hover - underline animation.
 * Use with CSS pseudo-element or motion.span.
 */
export const linkHover = {
  scaleX: [0, 1],
  originX: 0,
  transition: { duration: animationTiming.fast },
};

/**
 * Notification badge - attention pulse.
 * Use with animate prop.
 */
export const notificationPulse = {
  scale: [1, 1.2, 1],
  transition: {
    duration: 0.3,
    repeat: 2,
  },
};

/**
 * Success checkmark - completion animation.
 * Use with pathLength or scale animation.
 */
export const successPop = {
  scale: [0.8, 1.1, 1],
  opacity: [0, 1],
  transition: {
    duration: animationTiming.base,
    ease: animationTiming.spring.standard,
  },
};

/**
 * Rotate on hover - for chevrons/arrows.
 * Use with whileHover prop.
 */
export const rotateOnHover = {
  rotate: 180,
  transition: { duration: animationTiming.base },
};

/**
 * Smooth opacity - for reveals.
 * Use with initial/animate props.
 */
export const fadeIn = {
  initial: { opacity: 0 },
  animate: { 
    opacity: 1,
    transition: { duration: animationTiming.base }
  },
  exit: { 
    opacity: 0,
    transition: { duration: animationTiming.fast }
  },
};

/**
 * Slide up fade - for content entry.
 * Use with initial/animate props.
 */
export const slideUpFade = {
  initial: { opacity: 0, y: 20 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: { 
      duration: animationTiming.base,
      ease: animationTiming.easing.standard 
    }
  },
  exit: { 
    opacity: 0, 
    y: -10,
    transition: { duration: animationTiming.fast }
  },
};

/** 
 * Collection of all micro-interactions for easy import.
 */
export const microInteractions = {
  buttonTap,
  hoverLift,
  focusRing,
  pulseAnimation,
  shimmerAnimation,
  bounceAnimation,
  shakeAnimation,
  hoverScale,
  hoverGlow,
  pressDown,
  expandOnHover,
  iconButtonInteractions,
  cardInteractions,
  linkHover,
  notificationPulse,
  successPop,
  rotateOnHover,
  fadeIn,
  slideUpFade,
};
