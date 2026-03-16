/**
 * GlassDialog Component
 * 
 * Modal/Dialog with glass morphism background
 * Features overlay shadow and maximum blur for focus
 * 
 * @module GlassDialog
 */

import React, { useEffect, useCallback } from 'react';
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

export interface GlassDialogProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  
  /** Dialog open state */
  open: boolean;
  
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
  
  /** Dialog size */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full' | 'auto';
  
  /** Max width */
  maxWidth?: string | number;
  
  /** Close on backdrop click */
  closeOnBackdrop?: boolean;
  
  /** Close on escape key */
  closeOnEscape?: boolean;
  
  /** Callback when dialog closes */
  onClose: () => void;
  
  /** Dialog title (for accessibility) */
  title?: string;
  
  /** Dialog description (for accessibility) */
  description?: string;
  
  /** Force dark mode */
  darkMode?: boolean;
  
  /** z-index for dialog */
  zIndex?: number;
  
  /** Show backdrop overlay */
  showBackdrop?: boolean;
  
  /** Backdrop opacity */
  backdropOpacity?: number;
}

// ============================================================================
// Size Map
// ============================================================================

const sizeMap: Record<string, { width: string; maxWidth: string }> = {
  sm: { width: '90%', maxWidth: '400px' },
  md: { width: '90%', maxWidth: '600px' },
  lg: { width: '90%', maxWidth: '800px' },
  xl: { width: '90%', maxWidth: '1200px' },
  full: { width: '100%', maxWidth: '100%' },
  auto: { width: 'auto', maxWidth: 'none' },
};

// ============================================================================
// Component
// ============================================================================

export function GlassDialog({
  children,
  className,
  style,
  open,
  variant = 'default',
  border = 'subtle',
  blur = 'xl',
  opacity = 'high',
  padding = 'lg',
  rounded = 'xl',
  size = 'md',
  maxWidth: maxWidthProp,
  closeOnBackdrop = true,
  closeOnEscape = true,
  onClose,
  title,
  description,
  darkMode = false,
  zIndex = 100,
  showBackdrop = true,
  backdropOpacity = 0.5,
}: GlassDialogProps) {
  const hasBackdropFilter = supportsBackdropFilter();

  // Handle escape key
  useEffect(() => {
    if (!open || !closeOnEscape) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, closeOnEscape, onClose]);

  // Handle body scroll lock
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // Backdrop click handler
  const handleBackdropClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (closeOnBackdrop && e.target === e.currentTarget) {
      onClose();
    }
  }, [closeOnBackdrop, onClose]);

  if (!open) return null;

  // Size styles
  const sizeStyles = sizeMap[size];
  const maxWidth = maxWidthProp ?? sizeStyles.maxWidth;

  // Backdrop styles
  const backdropStyles: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    backgroundColor: darkMode 
      ? `rgba(0, 0, 0, ${backdropOpacity})` 
      : `rgba(0, 0, 0, ${backdropOpacity * 0.5})`,
    backdropFilter: hasBackdropFilter ? 'blur(4px)' : undefined,
    WebkitBackdropFilter: hasBackdropFilter ? 'blur(4px)' : undefined,
    zIndex: zIndex - 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
  };

  // Dialog glass styles
  const glassStyles = buildGlassStyles(
    {
      elevation: 'overlay',
      variant,
      border,
      blur,
      opacity,
      padding,
      rounded,
      transition: 'normal',
    },
    darkMode
  );

  // Dialog container styles
  const dialogStyles: React.CSSProperties = {
    ...glassStyles,
    width: sizeStyles.width,
    maxWidth: typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth,
    maxHeight: '90vh',
    overflow: 'auto',
    position: 'relative',
    ...style,
  };

  // Build classes
  const baseClasses = buildGlassClasses({
    elevation: 'overlay',
    variant,
    blur,
  });

  const combinedClasses = [
    baseClasses,
    'glass-dialog',
    `glass-dialog-${size}`,
    className,
  ].filter(Boolean).join(' ');

  const content = (
    <div
      className={combinedClasses}
      style={dialogStyles}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'glass-dialog-title' : undefined}
      aria-describedby={description ? 'glass-dialog-description' : undefined}
      data-backdrop-support={hasBackdropFilter}
    >
      {title && (
        <h2 id="glass-dialog-title" style={{ margin: 0, marginBottom: '16px' }}>
          {title}
        </h2>
      )}
      {description && (
        <p id="glass-dialog-description" style={{ margin: 0, marginBottom: '16px', opacity: 0.8 }}>
          {description}
        </p>
      )}
      {children}
    </div>
  );

  if (!showBackdrop) {
    return content;
  }

  return (
    <div
      style={backdropStyles}
      onClick={handleBackdropClick}
      className="glass-dialog-backdrop"
    >
      {content}
    </div>
  );
}

// ============================================================================
// Preset Variants
// ============================================================================

/**
 * Small dialog for confirmations
 */
export function GlassDialogSmall(props: Omit<GlassDialogProps, 'size'>) {
  return <GlassDialog {...props} size="sm" />;
}

/**
 * Large dialog for content
 */
export function GlassDialogLarge(props: Omit<GlassDialogProps, 'size'>) {
  return <GlassDialog {...props} size="lg" padding="xl" />;
}

/**
 * Full-screen dialog
 */
export function GlassDialogFull(props: Omit<GlassDialogProps, 'size'>) {
  return <GlassDialog {...props} size="full" rounded="none" padding="none" />;
}

/**
 * Alert dialog with danger styling
 */
export function GlassAlertDialog(props: Omit<GlassDialogProps, 'variant' | 'size'>) {
  return <GlassDialog {...props} variant="danger" size="sm" />;
}

/**
 * Confirmation dialog with primary styling
 */
export function GlassConfirmDialog(props: Omit<GlassDialogProps, 'variant' | 'size'>) {
  return <GlassDialog {...props} variant="primary" size="sm" />;
}

// ============================================================================
// Default Export
// ============================================================================

export default GlassDialog;
