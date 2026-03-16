/**
 * useGlass Hook
 * 
 * React hook for dynamic glass effects
 * Returns className and styles based on props with theme awareness
 * 
 * @module useGlass
 */

import { useMemo, useState, useCallback } from 'react';
import {
  GlassOptions,
  GlassElevation,
  GlassVariant,
  GlassHover,
  GlassBorder,
  GlassBlur,
  GlassOpacity,
  GlassPadding,
  GlassRounded,
  GlassTransition,
  buildGlassStyles,
  buildGlassClasses,
  getHoverStyles,
  getActiveStyles,
  supportsBackdropFilter,
} from './glass-utils';

// ============================================================================
// Hook Options Interface
// ============================================================================

export interface UseGlassOptions extends GlassOptions {
  /** Force dark mode override */
  darkMode?: boolean;
  /** Additional custom className */
  className?: string;
  /** Additional inline styles */
  style?: React.CSSProperties;
  /** Enable focus styles */
  focusable?: boolean;
}

export interface UseGlassReturn {
  /** Computed className string */
  className: string;
  /** Computed styles object */
  style: React.CSSProperties;
  /** Event handlers for interactive states */
  handlers: {
    onMouseEnter: () => void;
    onMouseLeave: () => void;
    onMouseDown: () => void;
    onMouseUp: () => void;
    onFocus: () => void;
    onBlur: () => void;
  };
  /** Current state flags */
  state: {
    isHovered: boolean;
    isActive: boolean;
    isFocused: boolean;
    supportsBackdropFilter: boolean;
  };
}

// ============================================================================
// Main Hook
// ============================================================================

/**
 * React hook for glass morphism effects
 * 
 * @example
 * ```tsx
 * const { className, style, handlers, state } = useGlass({
 *   elevation: 'floating',
 *   blur: 'lg',
 *   hover: 'lift',
 *   variant: 'primary',
 * });
 * 
 * return <div className={className} style={style} {...handlers}>Content</div>;
 * ```
 */
export function useGlass(options: UseGlassOptions = {}): UseGlassReturn {
  const {
    darkMode = false,
    className: customClassName,
    style: customStyle,
    focusable = false,
    hover,
    ...glassOptions
  } = options;

  // State for interactive effects
  const [isHovered, setIsHovered] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // Check backdrop filter support
  const hasBackdropFilter = useMemo(() => supportsBackdropFilter(), []);

  // Build base styles
  const baseStyles = useMemo(() => {
    return buildGlassStyles(glassOptions, darkMode);
  }, [glassOptions, darkMode]);

  // Build base classes
  const baseClasses = useMemo(() => {
    return buildGlassClasses({ ...glassOptions, hover });
  }, [glassOptions, hover]);

  // Compute hover styles
  const hoverStyles = useMemo(() => {
    if (!isHovered || !hover) return {};
    return getHoverStyles(hover, darkMode);
  }, [isHovered, hover, darkMode]);

  // Compute active styles
  const activeStyles = useMemo(() => {
    if (!isActive) return {};
    return getActiveStyles(darkMode);
  }, [isActive, darkMode]);

  // Compute focus styles
  const focusStyles = useMemo(() => {
    if (!isFocused || !focusable) return {};
    return {
      outline: 'none',
      boxShadow: `0 0 0 2px var(--accent-chat), 0 0 0 4px ${darkMode ? 'rgba(212, 176, 140, 0.2)' : 'rgba(176, 141, 110, 0.2)'}`,
    };
  }, [isFocused, focusable, darkMode]);

  // Combine all styles
  const style = useMemo(() => {
    return {
      ...baseStyles,
      ...hoverStyles,
      ...activeStyles,
      ...focusStyles,
      ...customStyle,
    };
  }, [baseStyles, hoverStyles, activeStyles, focusStyles, customStyle]);

  // Combine all classes
  const className = useMemo(() => {
    const classes = [baseClasses];
    if (customClassName) {
      classes.push(customClassName);
    }
    if (isHovered && hover) {
      classes.push('glass-hovered');
    }
    if (isActive) {
      classes.push('glass-active');
    }
    if (isFocused) {
      classes.push('glass-focused');
    }
    return classes.join(' ');
  }, [baseClasses, customClassName, isHovered, isActive, isFocused, hover]);

  // Event handlers
  const onMouseEnter = useCallback(() => setIsHovered(true), []);
  const onMouseLeave = useCallback(() => {
    setIsHovered(false);
    setIsActive(false);
  }, []);
  const onMouseDown = useCallback(() => setIsActive(true), []);
  const onMouseUp = useCallback(() => setIsActive(false), []);
  const onFocus = useCallback(() => setIsFocused(true), []);
  const onBlur = useCallback(() => setIsFocused(false), []);

  return {
    className,
    style,
    handlers: {
      onMouseEnter,
      onMouseLeave,
      onMouseDown,
      onMouseUp,
      onFocus,
      onBlur,
    },
    state: {
      isHovered,
      isActive,
      isFocused,
      supportsBackdropFilter: hasBackdropFilter,
    },
  };
}

// ============================================================================
// Simplified Hook Variants
// ============================================================================

/**
 * Simplified hook for static glass cards (no interaction)
 */
export function useGlassCard(options: Omit<UseGlassOptions, 'focusable'> = {}): {
  className: string;
  style: React.CSSProperties;
} {
  const { className, style } = useGlass(options);
  return { className, style };
}

/**
 * Hook for interactive glass buttons
 */
export function useGlassButton(options: UseGlassOptions = {}): UseGlassReturn {
  return useGlass({
    ...options,
    hover: options.hover ?? 'lift',
    focusable: true,
    rounded: options.rounded ?? 'md',
    padding: options.padding ?? 'sm',
  });
}

/**
 * Hook for glass panels (sidebars, drawers)
 */
export function useGlassPanel(options: UseGlassOptions = {}): {
  className: string;
  style: React.CSSProperties;
} {
  const { className, style } = useGlass({
    ...options,
    elevation: options.elevation ?? 'raised',
    blur: options.blur ?? 'lg',
    rounded: options.rounded ?? 'none',
  });
  return { className, style };
}

/**
 * Hook for glass dialogs/modals
 */
export function useGlassDialog(options: UseGlassOptions = {}): {
  className: string;
  style: React.CSSProperties;
} {
  const { className, style } = useGlass({
    ...options,
    elevation: options.elevation ?? 'overlay',
    blur: options.blur ?? 'xl',
    opacity: options.opacity ?? 'high',
    rounded: options.rounded ?? 'xl',
    padding: options.padding ?? 'lg',
  });
  return { className, style };
}

/**
 * Hook for glass tooltips
 */
export function useGlassTooltip(options: UseGlassOptions = {}): {
  className: string;
  style: React.CSSProperties;
} {
  const { className, style } = useGlass({
    ...options,
    elevation: options.elevation ?? 'floating',
    blur: options.blur ?? 'md',
    rounded: options.rounded ?? 'md',
    padding: options.padding ?? 'sm',
    border: options.border ?? 'subtle',
  });
  return { className, style };
}

/**
 * Hook for glass inputs
 */
export function useGlassInput(options: UseGlassOptions = {}): UseGlassReturn {
  return useGlass({
    ...options,
    elevation: options.elevation ?? 'flat',
    blur: options.blur ?? 'sm',
    border: options.border ?? 'subtle',
    rounded: options.rounded ?? 'md',
    padding: options.padding ?? 'md',
    focusable: true,
  });
}

// ============================================================================
// Default Export
// ============================================================================

export default useGlass;
