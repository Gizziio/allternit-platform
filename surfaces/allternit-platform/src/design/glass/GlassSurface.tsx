"use client";

/**
 * GlassSurface Component
 * 
 * Base glass surface component with intensity levels
 * Enhanced with all glass effect props
 * 
 * @module GlassSurface
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
  supportsBackdropFilter,
} from './glass-utils';

// Legacy intensity type for backwards compatibility
export type GlassIntensity = 'thin' | 'base' | 'elevated' | 'thick';

// ============================================================================
// Props Interface
// ============================================================================

export interface GlassSurfaceProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  
  /** Legacy intensity prop (maps to elevation + blur) */
  intensity?: GlassIntensity;
  
  /** New elevation system */
  elevation?: GlassElevation;
  
  /** Visual variant */
  variant?: GlassVariant;
  
  /** Interactive states */
  hover?: GlassHover;
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
  
  /** Event handlers */
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseEnter?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseLeave?: (e: React.MouseEvent<HTMLDivElement>) => void;
  
  /** Force dark mode */
  darkMode?: boolean;
}

// ============================================================================
// Intensity to Elevation/Blur Mapping
// ============================================================================

const intensityMap: Record<GlassIntensity, { elevation: GlassElevation; blur: GlassBlur }> = {
  thin: { elevation: 'flat', blur: 'sm' },
  base: { elevation: 'raised', blur: 'md' },
  elevated: { elevation: 'floating', blur: 'lg' },
  thick: { elevation: 'overlay', blur: 'xl' },
};

// ============================================================================
// Component
// ============================================================================

export function GlassSurface({
  children,
  className,
  style,
  intensity,
  elevation: elevationProp,
  variant = 'default',
  hover,
  disabled = false,
  border = 'subtle',
  blur: blurProp,
  opacity = 'medium',
  padding = 'md',
  rounded = 'md',
  animate = true,
  transition = 'normal',
  onClick,
  onMouseEnter,
  onMouseLeave,
  darkMode = false,
}: GlassSurfaceProps) {
  // Interactive state
  const [isHovered, setIsHovered] = useState(false);

  // Map intensity to new props if provided
  const mappedProps = intensity ? intensityMap[intensity] : null;
  const elevation = elevationProp ?? mappedProps?.elevation ?? 'raised';
  const blur = blurProp ?? mappedProps?.blur ?? 'md';

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

  // Animation styles
  const animationStyles = animate ? {
    transition: baseStyles.transition,
  } : {};

  // Combine all styles
  const combinedStyles: React.CSSProperties = {
    ...baseStyles,
    ...hoverStyles,
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
      onMouseLeave?.(e);
    }
  }, [disabled, onMouseLeave]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!disabled) {
      onClick?.(e);
    }
  }, [disabled, onClick]);

  return (
    <div
      className={combinedClasses}
      style={combinedStyles}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
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
 * Thin glass surface with minimal blur
 */
export function GlassSurfaceThin(props: Omit<GlassSurfaceProps, 'intensity' | 'elevation' | 'blur'>) {
  return <GlassSurface {...props} intensity="thin" />;
}

/**
 * Base glass surface with standard blur
 */
export function GlassSurfaceBase(props: Omit<GlassSurfaceProps, 'intensity' | 'elevation' | 'blur'>) {
  return <GlassSurface {...props} intensity="base" />;
}

/**
 * Elevated glass surface with prominent blur
 */
export function GlassSurfaceElevated(props: Omit<GlassSurfaceProps, 'intensity' | 'elevation' | 'blur'>) {
  return <GlassSurface {...props} intensity="elevated" />;
}

/**
 * Thick glass surface with maximum blur
 */
export function GlassSurfaceThick(props: Omit<GlassSurfaceProps, 'intensity' | 'elevation' | 'blur'>) {
  return <GlassSurface {...props} intensity="thick" />;
}

// ============================================================================
// Default Export
// ============================================================================

export default GlassSurface;
