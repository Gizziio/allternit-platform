import { tokens } from '../tokens';
import type { CSSProperties } from 'react';

/**
 * Extended CSS Properties for Glass effects
 * Explicitly allowing standard properties to avoid TS resolution issues in some environments
 */
export interface GlassCSSProperties extends CSSProperties {
  background?: any;
  border?: any;
  borderRadius?: any;
  padding?: any;
  boxShadow?: any;
  transition?: any;
  opacity?: any;
  cursor?: any;
  pointerEvents?: any;
  transform?: any;
  backfaceVisibility?: any;
  willChange?: any;
  backdropFilter?: any;
  WebkitBackdropFilter?: any;
}

// ============================================================================
// Types
// ============================================================================

export type GlassElevation = 'base' | 'flat' | 'raised' | 'floating' | 'overlay';
export type GlassVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
export type GlassHover = boolean | 'lift' | 'glow' | 'scale';
export type GlassBorder = boolean | 'subtle' | 'glow' | 'accent';
export type GlassBlur = 'none' | 'sm' | 'md' | 'lg' | 'xl';
export type GlassOpacity = 'none' | 'low' | 'medium' | 'high' | 'solid';
export type GlassPadding = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type GlassRounded = 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
export type GlassTransition = 'none' | 'fast' | 'normal' | 'slow';

export interface GlassOptions {
  elevation?: GlassElevation;
  variant?: GlassVariant;
  border?: GlassBorder;
  blur?: GlassBlur;
  opacity?: GlassOpacity;
  padding?: GlassPadding;
  rounded?: GlassRounded;
  transition?: GlassTransition;
  disabled?: boolean;
  animate?: boolean;
  hover?: GlassHover;
}

// ============================================================================
// Constants & Mappings
// ============================================================================

export const blurValues: Record<GlassBlur, string> = {
  none: '0px',
  sm: '4px',
  md: '8px',
  lg: '16px',
  xl: '24px',
};

export const roundedValues: Record<GlassRounded, string> = {
  none: '0px',
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '24px',
  full: '9999px',
};

export const paddingValues: Record<GlassPadding, string> = {
  none: '0px',
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
};

export const transitionValues: Record<GlassTransition, string> = {
  none: '0ms',
  fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
  normal: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
  slow: '500ms cubic-bezier(0.4, 0, 0.2, 1)',
};

export const elevationShadows: Record<GlassElevation, string> = {
  base: 'none',
  flat: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  raised: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  floating: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  overlay: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
};

export const variantColors: Record<GlassVariant, { light: { bg: string }, dark: { bg: string } }> = {
  default: {
    light: { bg: 'rgba(255, 255, 255, 0.7)' },
    dark: { bg: 'rgba(30, 26, 22, 0.6)' },
  },
  primary: {
    light: { bg: 'rgba(212, 176, 140, 0.15)' },
    dark: { bg: 'rgba(212, 176, 140, 0.1)' },
  },
  success: {
    light: { bg: 'rgba(34, 197, 94, 0.1)' },
    dark: { bg: 'rgba(34, 197, 94, 0.05)' },
  },
  warning: {
    light: { bg: 'rgba(234, 179, 8, 0.1)' },
    dark: { bg: 'rgba(234, 179, 8, 0.05)' },
  },
  danger: {
    light: { bg: 'rgba(239, 68, 68, 0.1)' },
    dark: { bg: 'rgba(239, 68, 68, 0.05)' },
  },
  info: {
    light: { bg: 'rgba(59, 130, 246, 0.1)' },
    dark: { bg: 'rgba(59, 130, 246, 0.05)' },
  }
};

export const borderStyles: Record<string, { light: string, dark: string }> = {
  subtle: {
    light: '1px solid rgba(0, 0, 0, 0.08)',
    dark: '1px solid rgba(255, 255, 255, 0.1)',
  },
  glow: {
    light: '1px solid rgba(212, 176, 140, 0.3)',
    dark: '1px solid rgba(212, 176, 140, 0.2)',
  },
  accent: {
    light: '1px solid rgba(212, 176, 140, 0.5)',
    dark: '1px solid rgba(212, 176, 140, 0.4)',
  }
};

export const fallbackBackgrounds = {
  light: {
    low: 'rgba(255, 255, 255, 0.9)',
    medium: 'rgba(245, 245, 245, 0.95)',
    high: 'rgba(240, 240, 240, 1)',
    solid: '#ffffff',
  },
  dark: {
    low: 'rgba(40, 35, 30, 0.9)',
    medium: 'rgba(30, 26, 22, 0.95)',
    high: 'rgba(20, 18, 15, 1)',
    solid: '#1a1714',
  }
};

// ============================================================================
// Utilities
// ============================================================================

/**
 * Check if browser supports backdrop-filter
 */
export function supportsBackdropFilter(): boolean {
  if (typeof window === 'undefined') return true;
  return window.CSS?.supports?.('backdrop-filter', 'blur(1px)') || 
         window.CSS?.supports?.('-webkit-backdrop-filter', 'blur(1px)');
}

// ============================================================================
// Main Glass Effect Builder
// ============================================================================

/**
 * Build glass effect styles based on options
 */
export function buildGlassStyles(
  options: GlassOptions,
  isDarkMode: boolean = false
): GlassCSSProperties {
  const {
    elevation = 'base',
    variant = 'default',
    border = 'subtle',
    blur = 'md',
    opacity = 'medium',
    padding = 'md',
    rounded = 'lg',
    transition = 'normal',
    disabled = false,
  } = options;

  const hasBackdropFilter = supportsBackdropFilter();
  const mode = isDarkMode ? 'dark' : 'light';
  
  // Safe variant color access
  const variantData = variantColors[variant] || variantColors.default;
  const variantColor = variantData[mode] || variantData.light;
  
  // Base background
  let background = variantColor.bg;
  
  // Fallback for unsupported browsers
  if (!hasBackdropFilter) {
    const fallbackGroup = fallbackBackgrounds[mode] || fallbackBackgrounds.light;
    const fallback = fallbackGroup[opacity as keyof typeof fallbackGroup] || fallbackGroup.medium;
    background = fallback;
  }

  // Border style
  let borderStyle: string | undefined;
  if (border === true) {
    borderStyle = borderStyles.subtle[mode];
  } else if (border === false) {
    borderStyle = undefined;
  } else {
    const borderData = borderStyles[border] || borderStyles.subtle;
    borderStyle = borderData[mode] || borderData.light;
  }

  // Build styles
  const styles: GlassCSSProperties = {
    background,
    borderRadius: roundedValues[rounded] || roundedValues.md,
    padding: paddingValues[padding] || paddingValues.md,
    boxShadow: elevationShadows[elevation] || elevationShadows.base,
    transition: `all ${transitionValues[transition] || '200ms ease'}`,
    opacity: disabled ? 0.5 : 1,
    cursor: disabled ? 'not-allowed' : undefined,
    pointerEvents: disabled ? 'none' : undefined,
    // GPU acceleration
    transform: 'translateZ(0)',
    backfaceVisibility: 'hidden',
    willChange: 'transform',
  };

  // Add border if specified
  if (borderStyle) {
    styles.border = borderStyle;
  }

  // Add backdrop filter if supported
  if (hasBackdropFilter && blur !== 'none') {
    const blurVal = blurValues[blur] || blurValues.md;
    styles.backdropFilter = `blur(${blurVal})`;
    styles.WebkitBackdropFilter = `blur(${blurVal})`;
  }

  return styles;
}

/**
 * Build glass CSS class string based on options
 */
export function buildGlassClasses(options: GlassOptions): string {
  const classes: string[] = ['glass'];

  if (options.elevation) {
    classes.push(`glass-${options.elevation}`);
  }

  if (options.variant && options.variant !== 'default') {
    classes.push(`glass-${options.variant}`);
  }

  if (options.disabled) {
    classes.push('glass-disabled');
  }

  if (options.blur) {
    classes.push(`glass-blur-${options.blur}`);
  }

  return classes.join(' ');
}

/**
 * Generate hover styles for glass components
 */
export function getHoverStyles(
  hover: GlassHover,
  isDarkMode: boolean = false
): GlassCSSProperties {
  if (!hover) return {};

  const mode = isDarkMode ? 'dark' : 'light';

  const baseHover: GlassCSSProperties = {
    background: mode === 'dark'
      ? 'rgba(64, 51, 41, 0.85)'
      : 'rgba(245, 237, 227, 0.9)',
  };

  if (typeof hover === 'boolean') {
    return {
      ...baseHover,
      transform: 'translateY(-2px)',
    };
  }

  switch (hover) {
    case 'lift':
      return {
        ...baseHover,
        transform: 'translateY(-4px)',
        boxShadow: elevationShadows.floating,
      };
    case 'glow':
      return {
        ...baseHover,
        border: borderStyles.glow[mode],
        boxShadow: `0 0 20px rgba(212, 176, 140, ${mode === 'dark' ? '0.15' : '0.2'})`,
      };
    case 'scale':
      return {
        ...baseHover,
        transform: 'scale(1.02)',
      };
    default:
      return baseHover;
  }
}

/**
 * Generate active/pressed styles
 */
export function getActiveStyles(
  isDarkMode: boolean = false
): GlassCSSProperties {
  return {
    transform: 'scale(0.98) translateY(0)',
    transition: tokens?.motion?.fast ? `transform ${tokens.motion.fast}` : 'transform 100ms ease',
  };
}
