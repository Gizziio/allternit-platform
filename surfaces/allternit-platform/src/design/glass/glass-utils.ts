/**
 * Glass Morphism Utilities
 * 
 * CSS-in-JS utilities for glass effects with backdrop-filter fallbacks
 * Supports both light and dark modes with GPU-accelerated transforms
 * 
 * @module glass-utils
 */

import { tokens } from '../tokens';

// ============================================================================
// Types
// ============================================================================

export type GlassElevation = 'base' | 'flat' | 'raised' | 'floating' | 'overlay';
export type GlassVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
export type GlassHover = boolean | 'lift' | 'glow' | 'scale';
export type GlassBorder = boolean | 'subtle' | 'glow' | 'accent';
export type GlassBlur = 'none' | 'sm' | 'md' | 'lg' | 'xl';
export type GlassOpacity = 'none' | 'low' | 'medium' | 'high';
export type GlassPadding = 'none' | 'sm' | 'md' | 'lg' | 'xl';
export type GlassRounded = 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
export type GlassTransition = 'fast' | 'normal' | 'slow';

export interface GlassOptions {
  elevation?: GlassElevation;
  variant?: GlassVariant;
  hover?: GlassHover;
  active?: boolean;
  disabled?: boolean;
  border?: GlassBorder;
  blur?: GlassBlur;
  opacity?: GlassOpacity;
  padding?: GlassPadding;
  rounded?: GlassRounded;
  animate?: boolean;
  transition?: GlassTransition;
}

// ============================================================================
// Backdrop Filter Support Detection
// ============================================================================

let backdropFilterSupport: boolean | null = null;

/**
 * Detect browser support for backdrop-filter
 * Uses cached result for performance
 */
export function supportsBackdropFilter(): boolean {
  if (backdropFilterSupport !== null) {
    return backdropFilterSupport;
  }
  
  if (typeof window === 'undefined') {
    return true; // Assume support on server
  }
  
  try {
    backdropFilterSupport = (window.CSS && window.CSS.supports && (
      CSS.supports('backdrop-filter', 'blur(10px)') ||
      CSS.supports('-webkit-backdrop-filter', 'blur(10px)')
    )) || false;
  } catch (e) {
    backdropFilterSupport = false;
  }
  
  return backdropFilterSupport;
}

/**
 * Hook-compatible version for React components
 */
export function useBackdropFilterSupport(): boolean {
  return supportsBackdropFilter();
}

// ============================================================================
// Blur Values
// ============================================================================

export const blurValues: Record<GlassBlur, string> = {
  none: '0px',
  sm: '4px',
  md: '8px',
  lg: '16px',
  xl: '24px',
};

// ============================================================================
// Opacity Values (RGBA alpha channels)
// ============================================================================

export const opacityValues: Record<GlassOpacity, number> = {
  none: 0,
  low: 0.3,
  medium: 0.6,
  high: 0.85,
};

// ============================================================================
// Padding Values
// ============================================================================

export const paddingValues: Record<GlassPadding, string> = {
  none: '0',
  sm: `${tokens?.space?.sm || '8px'}`,
  md: `${tokens?.space?.md || '16px'}`,
  lg: `${tokens?.space?.lg || '24px'}`,
  xl: `${tokens?.space?.xl || '32px'}`,
};

// ============================================================================
// Border Radius Values
// ============================================================================

export const roundedValues: Record<GlassRounded, string> = {
  none: '0',
  sm: `${tokens?.radius?.sm || '4px'}`,
  md: `${tokens?.radius?.md || '8px'}`,
  lg: `${tokens?.radius?.lg || '12px'}`,
  xl: `${tokens?.radius?.xl || '16px'}`,
  full: '9999px',
};

// ============================================================================
// Transition Values
// ============================================================================

export const transitionValues: Record<GlassTransition, string> = {
  fast: tokens?.motion?.fast || '100ms ease',
  normal: tokens?.motion?.base || '200ms ease',
  slow: tokens?.motion?.slow || '400ms ease',
};

// ============================================================================
// Elevation Shadows
// ============================================================================

export const elevationShadows: Record<GlassElevation, string> = {
  base: 'none',
  flat: 'none',
  raised: '0 4px 24px rgba(0, 0, 0, 0.12)',
  floating: '0 8px 32px rgba(0, 0, 0, 0.16)',
  overlay: '0 24px 48px rgba(0, 0, 0, 0.24)',
};

// ============================================================================
// Variant Colors (Light Mode)
// ============================================================================

export const variantColors = {
  default: {
    light: { bg: 'rgba(255, 255, 255, 0.7)', border: 'rgba(0, 0, 0, 0.08)' },
    dark: { bg: 'rgba(42, 33, 26, 0.7)', border: 'rgba(212, 191, 168, 0.12)' },
  },
  primary: {
    light: { bg: 'rgba(176, 141, 110, 0.15)', border: 'rgba(176, 141, 110, 0.3)' },
    dark: { bg: 'rgba(212, 176, 140, 0.15)', border: 'rgba(212, 176, 140, 0.3)' },
  },
  success: {
    light: { bg: 'rgba(52, 199, 89, 0.15)', border: 'rgba(52, 199, 89, 0.3)' },
    dark: { bg: 'rgba(52, 199, 89, 0.15)', border: 'rgba(52, 199, 89, 0.3)' },
  },
  warning: {
    light: { bg: 'rgba(255, 149, 0, 0.15)', border: 'rgba(255, 149, 0, 0.3)' },
    dark: { bg: 'rgba(255, 149, 0, 0.15)', border: 'rgba(255, 149, 0, 0.3)' },
  },
  danger: {
    light: { bg: 'rgba(255, 59, 48, 0.15)', border: 'rgba(255, 59, 48, 0.3)' },
    dark: { bg: 'rgba(255, 59, 48, 0.15)', border: 'rgba(255, 59, 48, 0.3)' },
  },
  info: {
    light: { bg: 'rgba(0, 122, 255, 0.15)', border: 'rgba(0, 122, 255, 0.3)' },
    dark: { bg: 'rgba(10, 132, 255, 0.15)', border: 'rgba(10, 132, 255, 0.3)' },
  },
};

// ============================================================================
// Border Styles
// ============================================================================

export const borderStyles: Record<'subtle' | 'glow' | 'accent', { light: string; dark: string }> = {
  subtle: {
    light: '1px solid rgba(0, 0, 0, 0.08)',
    dark: '1px solid rgba(255, 255, 255, 0.08)',
  },
  glow: {
    light: '1px solid rgba(255, 255, 255, 0.3)',
    dark: '1px solid rgba(255, 255, 255, 0.15)',
  },
  accent: {
    light: '1px solid rgba(176, 141, 110, 0.4)',
    dark: '1px solid rgba(212, 176, 140, 0.4)',
  },
};

// ============================================================================
// Fallback Backgrounds (for unsupported browsers)
// ============================================================================

export const fallbackBackgrounds = {
  light: {
    low: 'rgba(253, 248, 243, 0.95)',
    medium: 'rgba(253, 248, 243, 0.98)',
    high: '#FDF8F3',
  },
  dark: {
    low: 'rgba(26, 22, 18, 0.95)',
    medium: 'rgba(26, 22, 18, 0.98)',
    high: '#1A1612',
  },
};

// ============================================================================
// GPU-Accelerated Transform Utilities
// ============================================================================

/**
 * GPU-accelerated transform properties
 * Only uses transform and opacity for smooth 60fps animations
 */
export const gpuAcceleratedStyles = `
  will-change: transform;
  transform: translateZ(0);
  backface-visibility: hidden;
`;

/**
 * Hover transform styles based on hover type
 */
export const hoverTransforms: Record<Exclude<GlassHover, boolean>, string> = {
  lift: 'translateY(-4px)',
  glow: 'scale(1.02)',
  scale: 'scale(1.05)',
};

// ============================================================================
// Focus Ring Styles
// ============================================================================

export const focusRingStyles = `
  outline: none;
  box-shadow: 0 0 0 2px var(--accent-chat), 0 0 0 4px rgba(212, 176, 140, 0.2);
`;

// ============================================================================
// Main Glass Effect Builder
// ============================================================================

/**
 * Build glass effect styles based on options
 */
export function buildGlassStyles(
  options: GlassOptions,
  isDarkMode: boolean = false
): React.CSSProperties {
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
  const styles: any = {
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

// ============================================================================
// CSS Class Builder
// ============================================================================

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
  
  if (options.hover) {
    classes.push('glass-hoverable');
    if (typeof options.hover === 'string') {
      classes.push(`glass-hover-${options.hover}`);
    }
  }
  
  if (options.disabled) {
    classes.push('glass-disabled');
  }
  
  if (options.blur) {
    classes.push(`glass-blur-${options.blur}`);
  }
  
  return classes.join(' ');
}

// ============================================================================
// Hover Styles Generator
// ============================================================================

/**
 * Generate hover styles for glass components
 */
export function getHoverStyles(
  hover: GlassHover,
  isDarkMode: boolean = false
): React.CSSProperties {
  if (!hover) return {};
  
  const mode = isDarkMode ? 'dark' : 'light';
  
  const baseHover: React.CSSProperties = {
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
        transform: 'scale(1.02)',
        boxShadow: `0 0 30px rgba(212, 176, 140, 0.3), ${elevationShadows.floating}`,
      };
    case 'scale':
      return {
        ...baseHover,
        transform: 'scale(1.05)',
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
): React.CSSProperties {
  return {
    transform: 'scale(0.98) translateY(0)',
    transition: tokens?.motion?.fast ? `transform ${tokens.motion.fast}` : 'transform 100ms ease',
  };
}

// ============================================================================
// Export Combined Utilities
// ============================================================================

export const glassEffects = {
  supportsBackdropFilter,
  blurValues,
  opacityValues,
  paddingValues,
  roundedValues,
  transitionValues,
  elevationShadows,
  variantColors,
  borderStyles,
  fallbackBackgrounds,
  gpuAcceleratedStyles,
  hoverTransforms,
  focusRingStyles,
  buildGlassStyles,
  buildGlassClasses,
  getHoverStyles,
  getActiveStyles,
};

export default glassEffects;
