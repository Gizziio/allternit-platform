/**
 * GlassButton Component
 * 
 * Button with glass morphism styling
 * Features interactive states with GPU-accelerated animations
 * 
 * @module GlassButton
 */

import React, { useState, useCallback, forwardRef } from 'react';
import {
  GlassVariant,
  GlassBorder,
  GlassBlur,
  GlassOpacity,
  GlassPadding,
  GlassRounded,
  GlassHover,
  buildGlassStyles,
  buildGlassClasses,
  getHoverStyles,
  getActiveStyles,
  supportsBackdropFilter,
} from './glass-utils';

// ============================================================================
// Props Interface
// ============================================================================

export interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual variant */
  variant?: GlassVariant;
  
  /** Hover effect type */
  hover?: GlassHover;
  
  /** Border styling */
  border?: GlassBorder;
  
  /** Backdrop blur intensity */
  blur?: GlassBlur;
  
  /** Background opacity */
  opacity?: GlassOpacity;
  
  /** Size constraints */
  padding?: GlassPadding;
  rounded?: GlassRounded;
  
  /** Button size preset */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  
  /** Full width */
  fullWidth?: boolean;
  
  /** Loading state */
  loading?: boolean;
  
  /** Left icon/element */
  leftIcon?: React.ReactNode;
  
  /** Right icon/element */
  rightIcon?: React.ReactNode;
  
  /** Force dark mode */
  darkMode?: boolean;
  
  /** Elevation level */
  elevation?: 'flat' | 'raised' | 'floating';
}

// ============================================================================
// Size Presets
// ============================================================================

const sizePresets = {
  xs: { padding: 'sm' as const, fontSize: '12px', height: '28px' },
  sm: { padding: 'sm' as const, fontSize: '14px', height: '36px' },
  md: { padding: 'md' as const, fontSize: '16px', height: '44px' },
  lg: { padding: 'lg' as const, fontSize: '18px', height: '52px' },
  xl: { padding: 'lg' as const, fontSize: '20px', height: '60px' },
};

// ============================================================================
// Component
// ============================================================================

export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(
  function GlassButton({
    variant = 'default',
    hover = 'lift',
    border = 'subtle',
    blur = 'sm',
    opacity = 'medium',
    padding: paddingProp,
    rounded = 'md',
    size = 'md',
    elevation = 'raised',
    fullWidth = false,
    loading = false,
    leftIcon,
    rightIcon,
    darkMode = false,
    disabled = false,
    children,
    className,
    style,
    onClick,
    onMouseEnter,
    onMouseLeave,
    onMouseDown,
    onMouseUp,
    onFocus,
    onBlur,
    ...buttonProps
  }, ref) {
    const [isHovered, setIsHovered] = useState(false);
    const [isActive, setIsActive] = useState(false);
    const [isFocused, setIsFocused] = useState(false);

    const hasBackdropFilter = supportsBackdropFilter();
    const isDisabled = disabled || loading;

    // Get size preset
    const sizePreset = sizePresets[size];
    const padding = paddingProp ?? sizePreset.padding;

    // Build glass styles
    const glassStyles = buildGlassStyles(
      {
        elevation,
        variant,
        border,
        blur,
        opacity,
        padding,
        rounded,
        transition: 'fast',
        disabled: isDisabled,
      },
      darkMode
    );

    // Hover styles
    const hoverStyles = isHovered && !isDisabled ? getHoverStyles(hover, darkMode) : {};

    // Active styles
    const activeStyles = isActive && !isDisabled ? getActiveStyles(darkMode) : {};

    // Focus styles
    const focusStyles = isFocused ? {
      outline: 'none',
      boxShadow: `0 0 0 2px var(--accent-chat), 0 0 0 4px ${darkMode ? 'rgba(212, 176, 140, 0.2)' : 'rgba(176, 141, 110, 0.2)'}`,
    } : {};

    // Combine styles
    const combinedStyles: React.CSSProperties = {
      ...glassStyles,
      ...hoverStyles,
      ...activeStyles,
      ...focusStyles,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      width: fullWidth ? '100%' : 'auto',
      height: sizePreset.height,
      fontSize: sizePreset.fontSize,
      fontWeight: 500,
      color: darkMode ? 'var(--text-primary)' : 'inherit',
      cursor: isDisabled ? 'not-allowed' : 'pointer',
      position: 'relative',
      overflow: 'hidden',
      ...style,
    };

    // Build classes
    const baseClasses = buildGlassClasses({
      elevation,
      variant,
      hover,
      disabled: isDisabled,
      blur,
    });

    const combinedClasses = [
      baseClasses,
      'glass-button',
      `glass-button-${size}`,
      isHovered && 'glass-button-hovered',
      isActive && 'glass-button-active',
      isFocused && 'glass-button-focused',
      loading && 'glass-button-loading',
      className,
    ].filter(Boolean).join(' ');

    // Event handlers
    const handleMouseEnter = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
      if (!isDisabled) {
        setIsHovered(true);
        onMouseEnter?.(e);
      }
    }, [isDisabled, onMouseEnter]);

    const handleMouseLeave = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
      if (!isDisabled) {
        setIsHovered(false);
        setIsActive(false);
        onMouseLeave?.(e);
      }
    }, [isDisabled, onMouseLeave]);

    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
      if (!isDisabled) {
        setIsActive(true);
        onMouseDown?.(e);
      }
    }, [isDisabled, onMouseDown]);

    const handleMouseUp = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
      if (!isDisabled) {
        setIsActive(false);
        onMouseUp?.(e);
      }
    }, [isDisabled, onMouseUp]);

    const handleFocus = useCallback((e: React.FocusEvent<HTMLButtonElement>) => {
      setIsFocused(true);
      onFocus?.(e);
    }, [onFocus]);

    const handleBlur = useCallback((e: React.FocusEvent<HTMLButtonElement>) => {
      setIsFocused(false);
      onBlur?.(e);
    }, [onBlur]);

    const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
      if (!isDisabled) {
        onClick?.(e);
      }
    }, [isDisabled, onClick]);

    // Loading spinner
    const renderLoadingSpinner = () => {
      if (!loading) return null;

      const spinnerStyles: React.CSSProperties = {
        width: size === 'xs' || size === 'sm' ? 14 : 18,
        height: size === 'xs' || size === 'sm' ? 14 : 18,
        border: `2px solid ${darkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'}`,
        borderTopColor: darkMode ? 'var(--text-primary)' : 'currentColor',
        borderRadius: '50%',
        animation: 'glass-spin 0.8s linear infinite',
      };

      return <span style={spinnerStyles} className="glass-button-spinner" />;
    };

    return (
      <>
        <style>{`
          @keyframes glass-spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
        <button
          ref={ref}
          type="button"
          className={combinedClasses}
          style={combinedStyles}
          disabled={isDisabled}
          onClick={handleClick}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onFocus={handleFocus}
          onBlur={handleBlur}
          data-backdrop-support={hasBackdropFilter}
          {...buttonProps}
        >
          {loading ? (
            renderLoadingSpinner()
          ) : (
            <>
              {leftIcon}
              {children}
              {rightIcon}
            </>
          )}
        </button>
      </>
    );
  }
);

// ============================================================================
// Preset Variants
// ============================================================================

/**
 * Primary glass button with accent styling
 */
export function GlassButtonPrimary(props: Omit<GlassButtonProps, 'variant'>) {
  return <GlassButton {...props} variant="primary" hover="glow" />;
}

/**
 * Success glass button
 */
export function GlassButtonSuccess(props: Omit<GlassButtonProps, 'variant'>) {
  return <GlassButton {...props} variant="success" />;
}

/**
 * Danger/Error glass button
 */
export function GlassButtonDanger(props: Omit<GlassButtonProps, 'variant'>) {
  return <GlassButton {...props} variant="danger" />;
}

/**
 * Ghost glass button (transparent background)
 */
export function GlassButtonGhost(props: Omit<GlassButtonProps, 'opacity' | 'elevation'>) {
  return <GlassButton {...props} opacity="none" elevation="flat" hover="scale" />;
}

/**
 * Icon-only glass button
 */
export function GlassIconButton({ 
  children,
  size = 'md',
  rounded = 'full',
  ...props 
}: Omit<GlassButtonProps, 'fullWidth'> & { children: React.ReactNode }) {
  const sizeMap = {
    xs: 28,
    sm: 36,
    md: 44,
    lg: 52,
    xl: 60,
  };

  const iconSize = sizeMap[size];

  return (
    <GlassButton
      {...props}
      size={size}
      rounded={rounded}
      style={{
        width: iconSize,
        height: iconSize,
        padding: 0,
        ...props.style,
      }}
    >
      {children}
    </GlassButton>
  );
}

/**
 * Small glass button
 */
export function GlassButtonSmall(props: Omit<GlassButtonProps, 'size'>) {
  return <GlassButton {...props} size="sm" />;
}

/**
 * Large glass button
 */
export function GlassButtonLarge(props: Omit<GlassButtonProps, 'size'>) {
  return <GlassButton {...props} size="lg" />;
}

// ============================================================================
// Default Export
// ============================================================================

export default GlassButton;
