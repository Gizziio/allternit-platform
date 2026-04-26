/**
 * GlassCard Component
 * 
 * Enhanced glass morphism card with full prop support:
 * - Elevation levels (flat, raised, floating, overlay)
 * - Visual variants (default, primary, success, warning, danger)
 * - Interactive states (hover, active, disabled)
 * - Border styling (subtle, glow, accent)
 * - Backdrop blur intensity
 * - GPU-accelerated animations
 * 
 * @module GlassCard
 */

import React, { useState, useCallback } from 'react';
import {
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
// Props Interface
// ============================================================================

export interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  
  /** Elevation levels with glass-specific styling */
  elevation?: GlassElevation;
  
  /** Visual variants */
  variant?: GlassVariant;
  
  /** Interactive states */
  hover?: GlassHover;
  active?: boolean;
  disabled?: boolean;
  
  /** Border styling */
  border?: GlassBorder;
  
  /** Backdrop blur intensity */
  blur?: GlassBlur;
  
  /** Background opacity */
  opacity?: GlassOpacity;
  
  /** Size constraints */
  padding?: GlassPadding;
  rounded?: GlassRounded;
  
  /** Animation */
  animate?: boolean;
  transition?: GlassTransition;
  
  /** Click handler */
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  
  /** Mouse enter handler */
  onMouseEnter?: (e: React.MouseEvent<HTMLDivElement>) => void;
  
  /** Mouse leave handler */
  onMouseLeave?: (e: React.MouseEvent<HTMLDivElement>) => void;
  
  /** Focus handler */
  onFocus?: (e: React.FocusEvent<HTMLDivElement>) => void;
  
  /** Blur handler */
  onBlur?: (e: React.FocusEvent<HTMLDivElement>) => void;
  
  /** Tab index for focusability */
  tabIndex?: number;
  
  /** ARIA role */
  role?: string;
  
  /** ARIA label */
  'aria-label'?: string;
  
  /** ARIA described by */
  'aria-describedby'?: string;
  
  /** Force dark mode */
  darkMode?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function GlassCard({
  children,
  className,
  style,
  elevation = 'raised',
  variant = 'default',
  hover,
  active: activeProp = false,
  disabled = false,
  border = 'subtle',
  blur = 'md',
  opacity = 'medium',
  padding = 'md',
  rounded = 'lg',
  animate = true,
  transition = 'normal',
  onClick,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  tabIndex,
  role,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  darkMode = false,
}: GlassCardProps) {
  // Interactive state
  const [isHovered, setIsHovered] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // Check backdrop filter support
  const hasBackdropFilter = supportsBackdropFilter();

  // Build base styles
  const baseStyles = buildGlassStyles(
    {
      elevation,
      variant,
      border,
      blur,
      opacity,
      padding,
      rounded,
      transition,
      disabled,
    },
    darkMode
  );

  // Compute hover styles
  const hoverStyles = isHovered && hover && !disabled ? getHoverStyles(hover, darkMode) : {};

  // Compute active styles
  const activeStyles = (isActive || activeProp) && !disabled ? getActiveStyles(darkMode) : {};

  // Compute focus styles
  const focusStyles = isFocused ? {
    outline: 'none',
    boxShadow: `0 0 0 2px var(--accent-chat), 0 0 0 4px ${darkMode ? 'rgba(212, 176, 140, 0.2)' : 'rgba(176, 141, 110, 0.2)'}`,
  } : {};

  // Animation styles
  const animationStyles: any = animate ? {
    transition: baseStyles.transition,
  } : {};

  // Combine all styles
  const combinedStyles: any = {
    ...baseStyles,
    ...hoverStyles,
    ...activeStyles,
    ...focusStyles,
    ...animationStyles,
    ...style,
  };

  // Build classes
  const baseClasses = buildGlassClasses({
    elevation,
    variant,
    hover,
    disabled,
    blur,
  });

  const combinedClasses = [
    baseClasses,
    isHovered && hover && 'glass-hovered',
    (isActive || activeProp) && 'glass-active',
    isFocused && 'glass-focused',
    className,
  ].filter(Boolean).join(' ');

  // Event handlers
  const handleMouseEnter = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!disabled) {
      setIsHovered(true);
      onMouseEnter?.(e);
    }
  }, [disabled, onMouseEnter]);

  const handleMouseLeave = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!disabled) {
      setIsHovered(false);
      setIsActive(false);
      onMouseLeave?.(e);
    }
  }, [disabled, onMouseLeave]);

  const handleMouseDown = useCallback(() => {
    if (!disabled && (onClick || hover)) {
      setIsActive(true);
    }
  }, [disabled, onClick, hover]);

  const handleMouseUp = useCallback(() => {
    if (!disabled) {
      setIsActive(false);
    }
  }, [disabled]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!disabled) {
      onClick?.(e);
    }
  }, [disabled, onClick]);

  const handleFocus = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    setIsFocused(true);
    onFocus?.(e);
  }, [onFocus]);

  const handleBlur = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    setIsFocused(false);
    onBlur?.(e);
  }, [onBlur]);

  return (
    <div
      className={combinedClasses}
      style={combinedStyles}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onFocus={handleFocus}
      onBlur={handleBlur}
      tabIndex={tabIndex}
      role={role}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      aria-disabled={disabled}
      data-backdrop-support={hasBackdropFilter}
    >
      {children}
    </div>
  );
}

// ============================================================================
// Preset Variants
// ============================================================================

/**
 * Flat glass card with minimal styling
 */
export function GlassCardFlat(props: Omit<GlassCardProps, 'elevation'>) {
  return <GlassCard {...props} elevation="flat" />;
}

/**
 * Floating glass card with prominent shadow
 */
export function GlassCardFloating(props: Omit<GlassCardProps, 'elevation'>) {
  return <GlassCard {...props} elevation="floating" blur="lg" />;
}

/**
 * Glass card with primary accent styling
 */
export function GlassCardPrimary(props: Omit<GlassCardProps, 'variant'>) {
  return <GlassCard {...props} variant="primary" border="accent" />;
}

/**
 * Glass card with success styling
 */
export function GlassCardSuccess(props: Omit<GlassCardProps, 'variant'>) {
  return <GlassCard {...props} variant="success" />;
}

/**
 * Glass card with warning styling
 */
export function GlassCardWarning(props: Omit<GlassCardProps, 'variant'>) {
  return <GlassCard {...props} variant="warning" />;
}

/**
 * Glass card with danger/error styling
 */
export function GlassCardDanger(props: Omit<GlassCardProps, 'variant'>) {
  return <GlassCard {...props} variant="danger" />;
}

/**
 * Interactive glass card with lift hover effect
 */
export function GlassCardInteractive(props: GlassCardProps) {
  return (
    <GlassCard
      {...props}
      hover={props.hover ?? 'lift'}
      tabIndex={props.tabIndex ?? 0}
      role={props.role ?? 'button'}
    />
  );
}

// ============================================================================
// Default Export
// ============================================================================

export default GlassCard;
