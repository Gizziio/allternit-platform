/**
 * Allternit Animation System
 * 
 * Comprehensive animation system using Framer Motion.
 * All animations respect prefers-reduced-motion and use GPU-accelerated properties.
 * 
 * @module @allternit/platform/design/animation
 */

// Core animation components
export { Fade, type FadeProps, type FadeDirection } from './Fade';
export { Slide, type SlideProps, type SlideDirection } from './Slide';
export { Scale, type ScaleProps } from './Scale';
export { Stagger, type StaggerProps, type StaggerDirection } from './Stagger';

// Page transitions
export { PageTransition, type PageTransitionProps, type PageTransitionMode } from './PageTransition';

// Layout animations
export { 
  AnimatedList, 
  LayoutItem,
  type AnimatedListProps,
  type LayoutItemProps 
} from './LayoutAnimations';

// Skeleton loading
export { Skeleton, type SkeletonProps, type SkeletonVariant } from './Skeleton';

// Gesture support
export { 
  useSwipe, 
  usePan, 
  PullToRefresh,
  type SwipeOptions,
  type SwipeDirection,
  type PanOptions,
  type PullToRefreshProps 
} from './gestures';

// Animation presets
export { 
  presets,
  type ModalPreset,
  type ToastPreset,
  type DropdownPreset,
  type TooltipPreset,
  type DrawerPreset,
} from './presets';

// Accessibility
export { 
  useReducedMotion, 
  AccessibleMotion,
  MotionReduced,
  type AccessibleMotionProps 
} from './accessibility';

// Micro-interactions
export {
  buttonTap,
  hoverLift,
  focusRing,
  pulseAnimation,
  shimmerAnimation,
  type MicroInteraction,
} from './micro-interactions';

// Timing tokens (coordinated with design system)
export { animationTiming, type TimingToken } from './timing';

// Integration components
export { 
  AnimatedGlassCard,
  type AnimatedGlassCardProps 
} from './integrations';
