/**
 * @fileoverview Spacing Token System
 * 
 * Comprehensive spacing tokens based on 4px base unit.
 * Used for margins, padding, gaps, and layout spacing.
 * 
 * @module design/tokens/spacing
 * @version 1.0.0
 */

/**
 * Base spacing unit in pixels
 * All spacing values are multiples of this base
 */
export const baseUnit = 4;

/**
 * Spacing scale
 * Consistent spacing values from 0 to 96 (384px)
 * Based on 4px base unit with logical naming
 */
export const spacing = {
  /** 0px - No spacing */
  0: '0',
  /** 2px - 0.5× base */
  0.5: '0.125rem',
  /** 4px - Base unit */
  1: '0.25rem',
  /** 6px - 1.5× base */
  1.5: '0.375rem',
  /** 8px - 2× base */
  2: '0.5rem',
  /** 10px - 2.5× base */
  2.5: '0.625rem',
  /** 12px - 3× base */
  3: '0.75rem',
  /** 14px - 3.5× base */
  3.5: '0.875rem',
  /** 16px - 4× base */
  4: '1rem',
  /** 20px - 5× base */
  5: '1.25rem',
  /** 24px - 6× base */
  6: '1.5rem',
  /** 28px - 7× base */
  7: '1.75rem',
  /** 32px - 8× base */
  8: '2rem',
  /** 36px - 9× base */
  9: '2.25rem',
  /** 40px - 10× base */
  10: '2.5rem',
  /** 44px - 11× base */
  11: '2.75rem',
  /** 48px - 12× base */
  12: '3rem',
  /** 56px - 14× base */
  14: '3.5rem',
  /** 64px - 16× base */
  16: '4rem',
  /** 80px - 20× base */
  20: '5rem',
  /** 96px - 24× base */
  24: '6rem',
  /** 112px - 28× base */
  28: '7rem',
  /** 128px - 32× base */
  32: '8rem',
  /** 144px - 36× base */
  36: '9rem',
  /** 160px - 40× base */
  40: '10rem',
  /** 176px - 44× base */
  44: '11rem',
  /** 192px - 48× base */
  48: '12rem',
  /** 208px - 52× base */
  52: '13rem',
  /** 224px - 56× base */
  56: '14rem',
  /** 240px - 60× base */
  60: '15rem',
  /** 256px - 64× base */
  64: '16rem',
  /** 288px - 72× base */
  72: '18rem',
  /** 320px - 80× base */
  80: '20rem',
  /** 384px - 96× base */
  96: '24rem',
} as const;

/**
 * Spacing in pixels (for reference)
 * Direct pixel mapping of spacing values
 */
export const spacingPx = {
  0: 0,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  2.5: 10,
  3: 12,
  3.5: 14,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  9: 36,
  10: 40,
  11: 44,
  12: 48,
  14: 56,
  16: 64,
  20: 80,
  24: 96,
  28: 112,
  32: 128,
  36: 144,
  40: 160,
  44: 176,
  48: 192,
  52: 208,
  56: 224,
  60: 240,
  64: 256,
  72: 288,
  80: 320,
  96: 384,
} as const;

/**
 * Semantic spacing aliases
 * Named spacing values for common use cases
 */
export const space = {
  /** Extra small - tight spacing */
  xs: spacing[1],
  /** Small - compact spacing */
  sm: spacing[2],
  /** Medium - standard spacing */
  md: spacing[4],
  /** Large - generous spacing */
  lg: spacing[6],
  /** Extra large - spacious spacing */
  xl: spacing[8],
  /** 2× Extra large - section spacing */
  '2xl': spacing[12],
  /** 3× Extra large - major section spacing */
  '3xl': spacing[16],
  /** 4× Extra large - page spacing */
  '4xl': spacing[24],
} as const;

/**
 * Layout container widths
 * Max-width values for containers
 */
export const container = {
  /** 320px - Small mobile */
  xs: '20rem',
  /** 640px - Large mobile/small tablet */
  sm: '40rem',
  /** 768px - Tablet */
  md: '48rem',
  /** 1024px - Small desktop */
  lg: '64rem',
  /** 1280px - Desktop */
  xl: '80rem',
  /** 1536px - Large desktop */
  '2xl': '96rem',
} as const;

/**
 * Layout container widths in pixels
 */
export const containerPx = {
  xs: 320,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

/**
 * Complete spacing tokens object
 */
export const spacingTokens = {
  baseUnit,
  spacing,
  spacingPx,
  space,
  container,
  containerPx,
} as const;

/** Spacing type */
export type Spacing = typeof spacing;
/** Spacing in pixels type */
export type SpacingPx = typeof spacingPx;
/** Semantic space type */
export type Space = typeof space;
/** Container type */
export type Container = typeof container;
/** Complete spacing tokens type */
export type SpacingTokens = typeof spacingTokens;

export default spacingTokens;
