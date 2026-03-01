/**
 * GlassPanel Component
 * 
 * Specialized glass surface for side panels, drawers, and sidebars
 * Features strong blur and elevated shadow for depth
 * 
 * @module GlassPanel
 */

import React, { useState, useCallback } from 'react';
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

export interface GlassPanelProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  
  /** Panel position */
  position?: 'left' | 'right' | 'top' | 'bottom';
  
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
  
  /** Width/height based on position */
  size?: string | number;
  
  /** Enable resize handle */
  resizable?: boolean;
  
  /** Is panel open */
  open?: boolean;
  
  /** Event handlers */
  onClose?: () => void;
  
  /** Force dark mode */
  darkMode?: boolean;
  
  /** z-index */
  zIndex?: number;
}

// ============================================================================
// Component
// ============================================================================

export function GlassPanel({
  children,
  className,
  style,
  position = 'left',
  variant = 'default',
  border = 'subtle',
  blur = 'lg',
  opacity = 'high',
  padding = 'none',
  rounded = 'none',
  size = 320,
  resizable = false,
  open = true,
  onClose,
  darkMode = false,
  zIndex = 50,
}: GlassPanelProps) {
  const [isResizing, setIsResizing] = useState(false);
  const [panelSize, setPanelSize] = useState(size);

  const hasBackdropFilter = supportsBackdropFilter();

  // Build styles based on position
  const positionStyles: React.CSSProperties = {
    position: 'fixed',
    zIndex,
    ...(position === 'left' && {
      left: 0,
      top: 0,
      bottom: 0,
      width: typeof panelSize === 'number' ? `${panelSize}px` : panelSize,
      borderRight: '1px solid',
    }),
    ...(position === 'right' && {
      right: 0,
      top: 0,
      bottom: 0,
      width: typeof panelSize === 'number' ? `${panelSize}px` : panelSize,
      borderLeft: '1px solid',
    }),
    ...(position === 'top' && {
      top: 0,
      left: 0,
      right: 0,
      height: typeof panelSize === 'number' ? `${panelSize}px` : panelSize,
      borderBottom: '1px solid',
    }),
    ...(position === 'bottom' && {
      bottom: 0,
      left: 0,
      right: 0,
      height: typeof panelSize === 'number' ? `${panelSize}px` : panelSize,
      borderTop: '1px solid',
    }),
  };

  // Build glass styles
  const glassStyles = buildGlassStyles(
    {
      elevation: 'raised',
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

  // Combine styles
  const combinedStyles: React.CSSProperties = {
    ...positionStyles,
    ...glassStyles,
    borderColor: darkMode ? 'rgba(212, 191, 168, 0.12)' : 'rgba(154, 118, 88, 0.12)',
    transform: open ? 'translateX(0) translateY(0)' : 
      position === 'left' ? 'translateX(-100%)' :
      position === 'right' ? 'translateX(100%)' :
      position === 'top' ? 'translateY(-100%)' : 'translateY(100%)',
    transition: `transform ${glassStyles.transition}, backdrop-filter ${glassStyles.transition}`,
    ...style,
  };

  // Build classes
  const baseClasses = buildGlassClasses({
    elevation: 'raised',
    variant,
    blur,
  });

  const combinedClasses = [
    baseClasses,
    'glass-panel',
    `glass-panel-${position}`,
    resizable && 'glass-panel-resizable',
    isResizing && 'glass-panel-resizing',
    className,
  ].filter(Boolean).join(' ');

  // Resize handlers
  const handleResizeStart = useCallback(() => {
    if (resizable) {
      setIsResizing(true);
    }
  }, [resizable]);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
  }, []);

  // Render resize handle for resizable panels
  const renderResizeHandle = () => {
    if (!resizable) return null;

    const handleStyles: React.CSSProperties = {
      position: 'absolute',
      background: 'transparent',
      zIndex: zIndex + 1,
      ...(position === 'left' && {
        right: -4,
        top: 0,
        bottom: 0,
        width: 8,
        cursor: 'ew-resize',
      }),
      ...(position === 'right' && {
        left: -4,
        top: 0,
        bottom: 0,
        width: 8,
        cursor: 'ew-resize',
      }),
      ...(position === 'top' && {
        bottom: -4,
        left: 0,
        right: 0,
        height: 8,
        cursor: 'ns-resize',
      }),
      ...(position === 'bottom' && {
        top: -4,
        left: 0,
        right: 0,
        height: 8,
        cursor: 'ns-resize',
      }),
    };

    return (
      <div
        style={handleStyles}
        onMouseDown={handleResizeStart}
        onMouseUp={handleResizeEnd}
        className="glass-panel-resize-handle"
      />
    );
  };

  if (!open) return null;

  return (
    <div
      className={combinedClasses}
      style={combinedStyles}
      data-backdrop-support={hasBackdropFilter}
      data-position={position}
    >
      {children}
      {renderResizeHandle()}
    </div>
  );
}

// ============================================================================
// Preset Variants
// ============================================================================

/**
 * Left sidebar panel
 */
export function GlassSidebar(props: Omit<GlassPanelProps, 'position'>) {
  return <GlassPanel {...props} position="left" rounded="none" />;
}

/**
 * Right drawer panel
 */
export function GlassDrawer(props: Omit<GlassPanelProps, 'position'>) {
  return <GlassPanel {...props} position="right" rounded="none" />;
}

/**
 * Top sheet panel
 */
export function GlassTopPanel(props: Omit<GlassPanelProps, 'position'>) {
  return <GlassPanel {...props} position="top" rounded="none" />;
}

/**
 * Bottom sheet panel
 */
export function GlassBottomPanel(props: Omit<GlassPanelProps, 'position'>) {
  return <GlassPanel {...props} position="bottom" rounded="none" />;
}

// ============================================================================
// Default Export
// ============================================================================

export default GlassPanel;
