/**
 * @fileoverview Consolidated Design Token System
 */

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

export type Theme = typeof theme;

/**
 * Shorthand tokens export for quick access to commonly used values
 */
export const tokens = {
  colors,
  typography,
  space: spacingTokens.space,
  spacing: spacingTokens.spacing,
  shadows: {
    elevation: shadows.elevation,
    glass: shadows.glass,
    glow: shadows.glow,
  },
  radii: radiusTokens.radii,
  duration: animationTokens.duration,
  easing: animationTokens.easing,
  keyframes: animationTokens.keyframes,
  media: breakpointTokens.media,
  zIndex: zIndexTokens.zIndex,
} as const;

export type Tokens = typeof tokens;

export function getModeColor<T extends { light: string; dark: string }>(
  token: T, 
  mode: 'light' | 'dark'
): string {
  return token[mode];
}

export function getModeShadow<T extends { light?: string; dark?: string; DEFAULT: string }>(
  token: T, 
  mode: 'light' | 'dark'
): string {
  return token[mode] ?? token.DEFAULT;
}
