/**
 * GlassInput Component
 * 
 * Input field with glass morphism background
 * Features subtle blur and focus ring
 * 
 * @module GlassInput
 */

import React, { useState, useCallback, forwardRef } from 'react';
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

export interface GlassInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
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
  
  /** Input size preset */
  size?: 'sm' | 'md' | 'lg';
  
  /** Full width */
  fullWidth?: boolean;
  
  /** Left icon/element */
  leftElement?: React.ReactNode;
  
  /** Right icon/element */
  rightElement?: React.ReactNode;
  
  /** Error state */
  error?: boolean;
  
  /** Success state */
  success?: boolean;
  
  /** Helper text */
  helperText?: string;
  
  /** Label */
  label?: string;
  
  /** Force dark mode */
  darkMode?: boolean;
  
  /** Custom container class */
  containerClassName?: string;
  
  /** Custom container style */
  containerStyle?: React.CSSProperties;
}

// ============================================================================
// Size Presets
// ============================================================================

const sizePresets = {
  sm: { padding: 'sm' as const, fontSize: '14px', height: '36px' },
  md: { padding: 'md' as const, fontSize: '16px', height: '44px' },
  lg: { padding: 'lg' as const, fontSize: '18px', height: '52px' },
};

// ============================================================================
// Component
// ============================================================================

export const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(
  function GlassInput({
    variant = 'default',
    border = 'subtle',
    blur = 'sm',
    opacity = 'low',
    padding: paddingProp,
    rounded = 'md',
    size = 'md',
    fullWidth = false,
    leftElement,
    rightElement,
    error = false,
    success = false,
    helperText,
    label,
    darkMode = false,
    containerClassName,
    containerStyle,
    disabled = false,
    className,
    style,
    onFocus,
    onBlur,
    ...inputProps
  }, ref) {
    const [isFocused, setIsFocused] = useState(false);

    const hasBackdropFilter = supportsBackdropFilter();

    // Get size preset
    const sizePreset = sizePresets[size];
    const padding = paddingProp ?? sizePreset.padding;

    // Determine variant based on state
    const effectiveVariant: GlassVariant = error 
      ? 'danger' 
      : success 
        ? 'success' 
        : variant;

    // Build glass styles
    const glassStyles = buildGlassStyles(
      {
        elevation: 'flat',
        variant: effectiveVariant,
        border,
        blur,
        opacity,
        padding,
        rounded,
        transition: 'fast',
        disabled,
      },
      darkMode
    );

    // Focus styles
    const focusStyles: React.CSSProperties = isFocused ? {
      outline: 'none',
      boxShadow: `0 0 0 2px ${
        error 
          ? 'rgba(255, 59, 48, 0.5)' 
          : success 
            ? 'rgba(52, 199, 89, 0.5)' 
            : 'var(--accent-chat)'
      }, 0 0 0 4px ${
        darkMode 
          ? 'rgba(212, 176, 140, 0.1)' 
          : 'rgba(176, 141, 110, 0.1)'
      }`,
      borderColor: error 
        ? 'rgba(255, 59, 48, 0.5)' 
        : success 
          ? 'rgba(52, 199, 89, 0.5)' 
          : 'var(--accent-chat)',
    } : {};

    // Container styles
    const containerStyles: React.CSSProperties = {
      display: 'flex',
      flexDirection: 'column',
      width: fullWidth ? '100%' : 'auto',
      ...containerStyle,
    };

    // Input wrapper styles
    const wrapperStyles: React.CSSProperties = {
      display: 'flex',
      alignItems: 'center',
      position: 'relative',
      width: fullWidth ? '100%' : 'auto',
    };

    // Input styles
    const inputStyles: React.CSSProperties = {
      ...glassStyles,
      ...focusStyles,
      width: fullWidth ? '100%' : 'auto',
      minWidth: 120,
      height: sizePreset.height,
      fontSize: sizePreset.fontSize,
      color: darkMode ? 'var(--text-primary)' : 'inherit',
      background: 'transparent',
      border: 'none',
      outline: 'none',
      flex: 1,
      paddingLeft: leftElement ? 44 : undefined,
      paddingRight: rightElement ? 44 : undefined,
      ...style,
    };

    // Label styles
    const labelStyles: React.CSSProperties = {
      fontSize: '14px',
      fontWeight: 500,
      marginBottom: 6,
      color: darkMode ? 'var(--text-secondary)' : 'inherit',
    };

    // Helper text styles
    const helperStyles: React.CSSProperties = {
      fontSize: '12px',
      marginTop: 6,
      color: error 
        ? 'rgba(255, 59, 48, 0.8)' 
        : success 
          ? 'rgba(52, 199, 89, 0.8)' 
          : darkMode ? 'var(--text-tertiary)' : 'rgba(0, 0, 0, 0.5)',
    };

    // Element wrapper styles
    const elementWrapperStyles = (position: 'left' | 'right'): React.CSSProperties => ({
      position: 'absolute',
      [position]: 12,
      top: '50%',
      transform: 'translateY(-50%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: darkMode ? 'var(--text-tertiary)' : 'rgba(0, 0, 0, 0.4)',
      pointerEvents: 'none',
    });

    // Build classes
    const baseClasses = buildGlassClasses({
      elevation: 'flat',
      variant: effectiveVariant,
      blur,
    });

    const combinedClasses = [
      baseClasses,
      'glass-input',
      `glass-input-${size}`,
      isFocused && 'glass-input-focused',
      error && 'glass-input-error',
      success && 'glass-input-success',
      disabled && 'glass-input-disabled',
      className,
    ].filter(Boolean).join(' ');

    // Event handlers
    const handleFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      onFocus?.(e);
    }, [onFocus]);

    const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      onBlur?.(e);
    }, [onBlur]);

    return (
      <div 
        className={containerClassName} 
        style={containerStyles}
        data-backdrop-support={hasBackdropFilter}
      >
        {label && <label style={labelStyles}>{label}</label>}
        <div style={wrapperStyles}>
          {leftElement && (
            <span style={elementWrapperStyles('left')}>
              {leftElement}
            </span>
          )}
          <input
            ref={ref}
            className={combinedClasses}
            style={inputStyles}
            disabled={disabled}
            onFocus={handleFocus}
            onBlur={handleBlur}
            {...inputProps}
          />
          {rightElement && (
            <span style={elementWrapperStyles('right')}>
              {rightElement}
            </span>
          )}
        </div>
        {helperText && <span style={helperStyles}>{helperText}</span>}
      </div>
    );
  }
);

// ============================================================================
// Preset Variants
// ============================================================================

/**
 * Small glass input
 */
export function GlassInputSmall(props: Omit<GlassInputProps, 'size'>) {
  return <GlassInput {...props} size="sm" />;
}

/**
 * Large glass input
 */
export function GlassInputLarge(props: Omit<GlassInputProps, 'size'>) {
  return <GlassInput {...props} size="lg" />;
}

/**
 * Glass input with search icon
 */
export function GlassSearchInput(props: Omit<GlassInputProps, 'leftElement' | 'type'>) {
  return (
    <GlassInput
      {...props}
      type="search"
      leftElement={
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
      }
    />
  );
}

// ============================================================================
// Default Export
// ============================================================================

export default GlassInput;
