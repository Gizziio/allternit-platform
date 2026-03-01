/**
 * @fileoverview Border Radius Token System
 * 
 * Comprehensive border radius tokens for consistent rounding.
 * Used for corners, pills, and circular elements.
 * 
 * @module design/tokens/radii
 * @version 1.0.0
 */

/**
 * Border radius scale
 * Consistent corner rounding values
 */
export const radii = {
  /** 0px - No rounding, square corners */
  none: '0',
  /** 2px - Minimal rounding */
  xs: '0.125rem',
  /** 4px - Small rounding - tags, badges */
  sm: '0.25rem',
  /** 6px - Default rounding - buttons, inputs */
  DEFAULT: '0.375rem',
  /** 6px - Default rounding alias */
  md: '0.375rem',
  /** 8px - Medium rounding - cards */
  lg: '0.5rem',
  /** 12px - Large rounding - modals */
  xl: '0.75rem',
  /** 16px - Extra large rounding - large cards */
  '2xl': '1rem',
  /** 24px - 2× Extra large rounding - hero cards */
  '3xl': '1.5rem',
  /** Full rounding - pills, badges */
  full: '9999px',
} as const;

/**
 * Border radius in pixels (for reference)
 */
export const radiiPx = {
  none: 0,
  xs: 2,
  sm: 4,
  DEFAULT: 6,
  md: 6,
  lg: 8,
  xl: 12,
  '2xl': 16,
  '3xl': 24,
  full: 9999,
} as const;

/**
 * Semantic radius aliases
 * Named radius values for common components
 */
export const radius = {
  /** No radius - sharp corners */
  sharp: radii.none,
  /** Subtle radius - data tables */
  subtle: radii.xs,
  /** Small radius - tags, chips */
  small: radii.sm,
  /** Default radius - buttons, inputs */
  default: radii.DEFAULT,
  /** Medium radius - cards, panels */
  medium: radii.lg,
  /** Large radius - modals, dialogs */
  large: radii.xl,
  /** Extra large radius - hero sections */
  xlarge: radii['2xl'],
  /** Pill radius - buttons, badges */
  pill: radii.full,
  /** Circular - avatars, icon buttons */
  circle: radii.full,
} as const;

/**
 * Component-specific radius presets
 * Recommended radius for specific component types
 */
export const componentRadii = {
  /** Button radius - pill or default */
  button: radii.md,
  /** Input radius - matches buttons */
  input: radii.md,
  /** Card radius - slightly larger */
  card: radii.lg,
  /** Modal/Dialog radius */
  modal: radii.xl,
  /** Popover/Tooltip radius */
  popover: radii.lg,
  /** Badge/Tag radius - pill shape */
  badge: radii.full,
  /** Avatar radius - circular */
  avatar: radii.full,
  /** Alert/Toast radius */
  alert: radii.lg,
  /** Table/Grid radius */
  table: radii.sm,
  /** Image/Media radius */
  image: radii.lg,
  /** Container/Section radius */
  container: radii.xl,
} as const;

/**
 * Complete radius tokens object
 */
export const radiusTokens = {
  radii,
  radiiPx,
  radius,
  component: componentRadii,
} as const;

/** Radii type */
export type Radii = typeof radii;
/** Radii in pixels type */
export type RadiiPx = typeof radiiPx;
/** Semantic radius type */
export type Radius = typeof radius;
/** Component radii type */
export type ComponentRadii = typeof componentRadii;
/** Complete radius tokens type */
export type RadiusTokens = typeof radiusTokens;

export default radiusTokens;
