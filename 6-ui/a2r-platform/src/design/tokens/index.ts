/**
 * @fileoverview Design Token System - Main Export
 * 
 * Comprehensive design token system for the A2rchitect platform.
 * Provides type-safe, semantic tokens for colors, typography, spacing,
 * shadows, animations, breakpoints, and z-index.
 * 
 * @module design/tokens
 * @version 1.0.0
 * 
 * @example
 * ```typescript
 * import { tokens, theme, colors, typography } from '@/design/tokens';
 * 
 * // Use individual tokens
 * const primaryColor = colors.brand.DEFAULT;
 * const fontStack = typography.fontFamily.sans;
 * 
 * // Use combined theme
 * const buttonStyle = {
 *   backgroundColor: theme.colors.brand.DEFAULT,
 *   padding: theme.spacing.space.md,
 *   borderRadius: theme.radii.radius.default,
 * };
 * ```
 */

// ============================================================================
// Color Tokens
// ============================================================================

export {
  colors,
  brand,
  secondary,
  accent,
  semantic,
  success,
  warning,
  danger,
  info,
  neutral,
  surface,
  text,
  border,
  glass as glassColors,
  mode,
  chat,
  cowork,
  code,
} from './colors';

export type {
  Colors,
  BrandColors,
  SecondaryColors,
  AccentColors,
  SemanticColors,
  SuccessColors,
  WarningColors,
  DangerColors,
  InfoColors,
  NeutralColors,
  SurfaceColors,
  TextColors,
  BorderColors,
  GlassColors,
  ModeColors,
} from './colors';

// ============================================================================
// Typography Tokens
// ============================================================================

export {
  typography,
  fontFamily,
  fontSize,
  fontSizePx,
  fontWeight,
  lineHeight,
  letterSpacing,
  textPreset,
} from './typography';

export type {
  Typography,
  FontFamily,
  FontSize,
  FontSizePx,
  FontWeight,
  LineHeight,
  LetterSpacing,
  TextPreset,
} from './typography';

// ============================================================================
// Spacing Tokens
// ============================================================================

export {
  spacingTokens,
  baseUnit,
  spacing,
  spacingPx,
  space,
  container,
  containerPx,
} from './spacing';

export type {
  SpacingTokens,
  Spacing,
  SpacingPx,
  Space,
  Container,
} from './spacing';

// ============================================================================
// Shadow Tokens
// ============================================================================

export {
  shadows,
  elevation,
  elevationDark,
  glass,
  glassDark,
  glow,
  glassGlow,
  focus,
  backdrop,
} from './shadows';

export type {
  Shadows,
  Elevation,
  ElevationDark,
  GlassShadows,
  GlassDarkShadows,
  Glow,
  GlassGlow,
  FocusShadows,
  Backdrop,
} from './shadows';

// ============================================================================
// Radius Tokens
// ============================================================================

export {
  radiusTokens,
  radii,
  radiiPx,
  radius,
  componentRadii,
} from './radii';

export type {
  RadiusTokens,
  Radii,
  RadiiPx,
  Radius,
  ComponentRadii,
} from './radii';

// ============================================================================
// Animation Tokens
// ============================================================================

export {
  animationTokens,
  duration,
  durationMs,
  easing,
  transition,
  keyframes,
  animation,
  stagger,
  fillMode,
  reducedMotion,
} from './animation';

export type {
  AnimationTokens,
  Duration,
  DurationMs,
  Easing,
  Transition,
  Keyframes,
  Animation,
  Stagger,
  FillMode,
  ReducedMotion,
} from './animation';

// ============================================================================
// Breakpoint Tokens
// ============================================================================

export {
  breakpointTokens,
  breakpoints,
  breakpointsPx,
  media,
  mediaMax,
  mediaRange,
  orientation,
  features,
  containerBreakpoints,
  containerSizes,
} from './breakpoints';

export type {
  BreakpointTokens,
  Breakpoints,
  BreakpointsPx,
  Media,
  MediaMax,
  MediaRange,
  Orientation,
  Features,
  ContainerBreakpoints,
  ContainerSizes,
} from './breakpoints';

// ============================================================================
// Z-Index Tokens
// ============================================================================

export {
  zIndexTokens,
  zIndex,
  zIndexNum,
  componentZIndex,
  zOffset,
  createZIndex,
} from './z-index';

export type {
  ZIndexTokens,
  ZIndex,
  ZIndexNum,
  ComponentZIndex,
  ZOffset,
} from './z-index';

// ============================================================================
// Combined Theme Object
// ============================================================================

import { colors } from './colors';
import { typography } from './typography';
import { spacingTokens } from './spacing';
import { shadows } from './shadows';
import { radiusTokens } from './radii';
import { animationTokens } from './animation';
import { breakpointTokens } from './breakpoints';
import { zIndexTokens } from './z-index';

/**
 * Combined theme object containing all design tokens.
 * Use this for comprehensive theme access.
 */
export const theme = {
  colors,
  typography,
  spacing: spacingTokens,
  shadows,
  radii: radiusTokens,
  animation: animationTokens,
  breakpoints: breakpointTokens,
  zIndex: zIndexTokens,
} as const;

/**
 * Type definition for the complete theme
 */
export type Theme = typeof theme;

// ============================================================================
// Convenience Exports
// ============================================================================

/**
 * Shorthand tokens export for quick access to commonly used values
 */
export const tokens = {
  /** Color tokens */
  colors,
  /** Typography tokens */
  typography,
  /** Spacing values (semantic aliases) */
  space: spacingTokens.space,
  /** Spacing scale */
  spacing: spacingTokens.spacing,
  /** Shadow tokens */
  shadows: {
    elevation: shadows.elevation,
    glass: shadows.glass,
    glow: shadows.glow,
  },
  /** Border radius values */
  radii: radiusTokens.radii,
  /** Animation durations */
  duration: animationTokens.duration,
  /** Animation easings */
  easing: animationTokens.easing,
  /** Animation keyframes */
  keyframes: animationTokens.keyframes,
  /** Breakpoint media queries */
  media: breakpointTokens.media,
  /** Z-index values */
  zIndex: zIndexTokens.zIndex,
} as const;

/**
 * Type definition for convenience tokens
 */
export type Tokens = typeof tokens;

// ============================================================================
// Light/Dark Mode Helpers
// ============================================================================

/**
 * Get the appropriate color value based on theme mode
 * @param token - Color token with light/dark variants
 * @param mode - Current theme mode
 * @returns Color value for the specified mode
 */
export function getModeColor<
  T extends { light: string; dark: string }
>(token: T, mode: 'light' | 'dark'): string {
  return token[mode];
}

/**
 * Get the appropriate shadow value based on theme mode
 * @param token - Shadow token with light/dark variants
 * @param mode - Current theme mode
 * @returns Shadow value for the specified mode
 */
export function getModeShadow<
  T extends { light?: string; dark?: string; DEFAULT: string }
>(token: T, mode: 'light' | 'dark'): string {
  return token[mode] ?? token.DEFAULT;
}

// ============================================================================
// Default Export
// ============================================================================

export default theme;
