/**
 * GlassTooltip Component
 * 
 * Tooltip with glass morphism styling
 * Features floating shadow and subtle blur
 * 
 * @module GlassTooltip
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  GlassVariant,
  GlassBorder,
  GlassBlur,
  GlassOpacity,
  GlassPadding,
  GlassRounded,
  buildGlassStyles,
  buildGlassClasses,
  supportsBackdropFilter,
} from './glass-utils';

// ============================================================================
// Props Interface
// ============================================================================

export interface GlassTooltipProps {
  /** Tooltip content */
  content: React.ReactNode;
  
  /** Element that triggers the tooltip */
  children: React.ReactNode;
  
  className?: string;
  style?: React.CSSProperties;
  
  /** Tooltip position */
  position?: 'top' | 'bottom' | 'left' | 'right';
  
  /** Visual variant */
  variant?: GlassVariant;
  
  /** Border styling */
  border?: GlassBorder;
  
  /** Backdrop blur intensity */
  blur?: GlassBlur;
  
  /** Background opacity */
  opacity?: GlassOpacity;
  
  /** Size constraints */
  padding?: GlassPadding;
  rounded?: GlassRounded;
  
  /** Delay before showing (ms) */
  delay?: number;
  
  /** Delay before hiding (ms) */
  hideDelay?: number;
  
  /** Force tooltip visibility */
  visible?: boolean;
  
  /** Max width */
  maxWidth?: string | number;
  
  /** Force dark mode */
  darkMode?: boolean;
  
  /** z-index */
  zIndex?: number;
  
  /** Disable tooltip */
  disabled?: boolean;
  
  /** Arrow visibility */
  arrow?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function GlassTooltip({
  content,
  children,
  className,
  style,
  position = 'top',
  variant = 'default',
  border = 'subtle',
  blur = 'md',
  opacity = 'high',
  padding = 'sm',
  rounded = 'md',
  delay = 200,
  hideDelay = 100,
  visible: visibleProp,
  maxWidth = 250,
  darkMode = false,
  zIndex = 168,
  disabled = false,
  arrow = true,
}: GlassTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const hasBackdropFilter = supportsBackdropFilter();
  const isControlled = visibleProp !== undefined;
  const show = isControlled ? visibleProp : isVisible;

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Handle mount animation
  useEffect(() => {
    if (show) {
      setIsMounted(true);
    } else {
      const timer = setTimeout(() => setIsMounted(false), 200);
      return () => clearTimeout(timer);
    }
  }, [show]);

  const showTooltip = useCallback(() => {
    if (disabled) return;
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  }, [delay, disabled]);

  const hideTooltip = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setIsVisible(false);
    }, hideDelay);
  }, [hideDelay]);

  // Glass styles
  const glassStyles = buildGlassStyles(
    {
      elevation: 'floating',
      variant,
      border,
      blur,
      opacity,
      padding,
      rounded,
      transition: 'fast',
    },
    darkMode
  );

  // Position styles
  const positionStyles: React.CSSProperties = {
    position: 'absolute',
    zIndex,
    maxWidth: typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth,
    pointerEvents: 'none',
    ...(position === 'top' && {
      bottom: '100%',
      left: '50%',
      transform: `translateX(-50%) translateY(${show ? '-8px' : '-4px'})`,
      marginBottom: '8px',
    }),
    ...(position === 'bottom' && {
      top: '100%',
      left: '50%',
      transform: `translateX(-50%) translateY(${show ? '8px' : '4px'})`,
      marginTop: '8px',
    }),
    ...(position === 'left' && {
      right: '100%',
      top: '50%',
      transform: `translateY(-50%) translateX(${show ? '-8px' : '-4px'})`,
      marginRight: '8px',
    }),
    ...(position === 'right' && {
      left: '100%',
      top: '50%',
      transform: `translateY(-50%) translateX(${show ? '8px' : '4px'})`,
      marginLeft: '8px',
    }),
  };

  // Animation styles
  const animationStyles: React.CSSProperties = {
    opacity: show ? 1 : 0,
    transition: `opacity ${glassStyles.transition}, transform ${glassStyles.transition}`,
  };

  // Combine styles
  const combinedStyles: React.CSSProperties = {
    ...glassStyles,
    ...positionStyles,
    ...animationStyles,
    ...style,
  };

  // Build classes
  const baseClasses = buildGlassClasses({
    elevation: 'floating',
    variant,
    blur,
  });

  const combinedClasses = [
    baseClasses,
    'glass-tooltip',
    `glass-tooltip-${position}`,
    className,
  ].filter(Boolean).join(' ');

  // Arrow styles
  const arrowStyles: React.CSSProperties = {
    position: 'absolute',
    width: 0,
    height: 0,
    borderStyle: 'solid',
    ...(position === 'top' && {
      bottom: -6,
      left: '50%',
      transform: 'translateX(-50%)',
      borderWidth: '6px 6px 0',
      borderColor: `${darkMode ? 'rgba(42, 33, 26, 0.9)' : 'rgba(255, 255, 255, 0.9)'} transparent transparent`,
    }),
    ...(position === 'bottom' && {
      top: -6,
      left: '50%',
      transform: 'translateX(-50%)',
      borderWidth: '0 6px 6px',
      borderColor: `transparent transparent ${darkMode ? 'rgba(42, 33, 26, 0.9)' : 'rgba(255, 255, 255, 0.9)'}`,
    }),
    ...(position === 'left' && {
      right: -6,
      top: '50%',
      transform: 'translateY(-50%)',
      borderWidth: '6px 0 6px 6px',
      borderColor: `transparent transparent transparent ${darkMode ? 'rgba(42, 33, 26, 0.9)' : 'rgba(255, 255, 255, 0.9)'}`,
    }),
    ...(position === 'right' && {
      left: -6,
      top: '50%',
      transform: 'translateY(-50%)',
      borderWidth: '6px 6px 6px 0',
      borderColor: `transparent ${darkMode ? 'rgba(42, 33, 26, 0.9)' : 'rgba(255, 255, 255, 0.9)'} transparent transparent`,
    }),
  };

  return (
    <div
      ref={triggerRef}
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
      className="glass-tooltip-wrapper"
    >
      {children}
      {isMounted && (
        <div
          className={combinedClasses}
          style={combinedStyles}
          role="tooltip"
          data-backdrop-support={hasBackdropFilter}
        >
          {content}
          {arrow && <div style={arrowStyles} className="glass-tooltip-arrow" />}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Simple Tooltip Variants
// ============================================================================

/**
 * Quick tooltip with default settings
 */
export function GlassTooltipSimple({
  content,
  children,
}: {
  content: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <GlassTooltip content={content}>
      {children}
    </GlassTooltip>
  );
}

// ============================================================================
// Default Export
// ============================================================================

export default GlassTooltip;
