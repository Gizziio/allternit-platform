/**
 * @fileoverview Shadow Token System
 * 
 * Comprehensive shadow tokens for elevation and depth.
 * Includes standard shadows and glass-morphism specific effects.
 * 
 * @module design/tokens/shadows
 * @version 1.0.0
 */

/**
 * Standard elevation shadows
 * Material Design inspired elevation system
 */
export const elevation = {
  /** No shadow */
  none: 'none',
  /** Extra small - subtle depth */
  xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  /** Small - buttons, chips */
  sm: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  /** Default/base - cards, inputs */
  DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  /** Medium - elevated cards */
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  /** Large - modals, popovers */
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  /** Extra large - dialogs */
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  /** 2× Extra large - maximum elevation */
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  /** Inner shadow - inset effect */
  inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
} as const;

/**
 * Dark mode elevation shadows
 * Adjusted opacity for dark backgrounds
 */
export const elevationDark = {
  none: 'none',
  xs: '0 1px 2px 0 rgb(0 0 0 / 0.2)',
  sm: '0 1px 3px 0 rgb(0 0 0 / 0.3), 0 1px 2px -1px rgb(0 0 0 / 0.3)',
  DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.3), 0 1px 2px -1px rgb(0 0 0 / 0.3)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.3), 0 2px 4px -2px rgb(0 0 0 / 0.3)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.3), 0 4px 6px -4px rgb(0 0 0 / 0.3)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.3), 0 8px 10px -6px rgb(0 0 0 / 0.3)',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.5)',
  inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.15)',
} as const;

/**
 * Glass morphism shadows
 * Specialized shadows for glass-like surfaces
 */
export const glass = {
  /** Small glass shadow - subtle lift */
  sm: '0 2px 8px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
  /** Default glass shadow - standard glass effect */
  DEFAULT: '0 4px 24px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
  /** Medium glass shadow - elevated glass */
  md: '0 8px 32px rgba(0, 0, 0, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
  /** Large glass shadow - floating glass */
  lg: '0 16px 48px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.25)',
} as const;

/**
 * Dark mode glass shadows
 * Adjusted for dark backgrounds
 */
export const glassDark = {
  sm: '0 2px 8px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
  DEFAULT: '0 4px 24px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
  md: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
  lg: '0 16px 48px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
} as const;

/**
 * Glow effects
 * Colored shadow glows for emphasis
 */
export const glow = {
  /** Brand glow - primary accent */
  brand: '0 0 20px rgba(14, 165, 233, 0.3)',
  /** Success glow - positive states */
  success: '0 0 20px rgba(34, 197, 94, 0.3)',
  /** Warning glow - caution states */
  warning: '0 0 20px rgba(245, 158, 11, 0.3)',
  /** Danger glow - error states */
  danger: '0 0 20px rgba(239, 68, 68, 0.3)',
  /** Info glow - neutral emphasis */
  info: '0 0 20px rgba(59, 130, 246, 0.3)',
  /** Accent glow - secondary emphasis */
  accent: '0 0 20px rgba(249, 115, 22, 0.3)',
  /** White glow - for dark backgrounds */
  white: '0 0 20px rgba(255, 255, 255, 0.3)',
} as const;

/**
 * Colored glow effects for glass
 * Glow with inset highlight
 */
export const glassGlow = {
  brand: '0 0 20px rgba(14, 165, 233, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
  success: '0 0 20px rgba(34, 197, 94, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
  warning: '0 0 20px rgba(245, 158, 11, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
  danger: '0 0 20px rgba(239, 68, 68, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
  info: '0 0 20px rgba(59, 130, 246, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
  accent: '0 0 20px rgba(249, 115, 22, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
} as const;

/**
 * Focus ring shadows
 * Accessible focus indicators
 */
export const focus = {
  /** Standard focus ring */
  DEFAULT: '0 0 0 2px rgba(14, 165, 233, 0.4)',
  /** Focus ring with offset */
  offset: '0 0 0 2px rgba(14, 165, 233, 0.4), 0 0 0 4px rgba(14, 165, 233, 0.1)',
  /** Error focus ring */
  error: '0 0 0 2px rgba(239, 68, 68, 0.4)',
  /** Success focus ring */
  success: '0 0 0 2px rgba(34, 197, 94, 0.4)',
} as const;

/**
 * Backdrop shadows
 * For modal overlays and scrims
 */
export const backdrop = {
  /** Light backdrop */
  light: '0 4px 30px rgba(0, 0, 0, 0.1)',
  /** Medium backdrop */
  DEFAULT: '0 4px 30px rgba(0, 0, 0, 0.2)',
  /** Dark backdrop */
  dark: '0 4px 30px rgba(0, 0, 0, 0.4)',
} as const;

/**
 * Complete shadow tokens object
 */
export const shadows = {
  elevation,
  elevationDark,
  glass,
  glassDark,
  glow,
  glassGlow,
  focus,
  backdrop,
} as const;

/** Elevation shadow type */
export type Elevation = typeof elevation;
/** Dark elevation type */
export type ElevationDark = typeof elevationDark;
/** Glass shadow type */
export type GlassShadows = typeof glass;
/** Dark glass shadow type */
export type GlassDarkShadows = typeof glassDark;
/** Glow type */
export type Glow = typeof glow;
/** Glass glow type */
export type GlassGlow = typeof glassGlow;
/** Focus shadow type */
export type FocusShadows = typeof focus;
/** Backdrop type */
export type Backdrop = typeof backdrop;
/** Complete shadows type */
export type Shadows = typeof shadows;

export default shadows;
