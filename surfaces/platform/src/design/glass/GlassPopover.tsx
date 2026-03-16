/**
 * GlassPopover Component
 * 
 * Popover/Menu with glass morphism styling
 * Features floating shadow and configurable positioning
 * 
 * @module GlassPopover
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

export interface GlassPopoverProps {
  /** Popover content */
  content: React.ReactNode;
  
  /** Element that triggers the popover */
  children: React.ReactNode;
  
  className?: string;
  contentClassName?: string;
  style?: React.CSSProperties;
  contentStyle?: React.CSSProperties;
  
  /** Popover open state (controlled) */
  open?: boolean;
  
  /** Default open state (uncontrolled) */
  defaultOpen?: boolean;
  
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
  
  /** Popover position relative to trigger */
  position?: 'top' | 'bottom' | 'left' | 'right' | 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end';
  
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
  
  /** Minimum width */
  minWidth?: string | number;
  
  /** Maximum width */
  maxWidth?: string | number;
  
  /** Close on click outside */
  closeOnClickOutside?: boolean;
  
  /** Close on escape key */
  closeOnEscape?: boolean;
  
  /** Trigger mode */
  trigger?: 'click' | 'hover' | 'context';
  
  /** Force dark mode */
  darkMode?: boolean;
  
  /** z-index */
  zIndex?: number;
  
  /** Disable popover */
  disabled?: boolean;
  
  /** Match trigger width */
  matchTriggerWidth?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function GlassPopover({
  content,
  children,
  className,
  contentClassName,
  style,
  contentStyle,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  position = 'bottom-start',
  variant = 'default',
  border = 'subtle',
  blur = 'md',
  opacity = 'high',
  padding = 'md',
  rounded = 'lg',
  minWidth,
  maxWidth = 320,
  closeOnClickOutside = true,
  closeOnEscape = true,
  trigger = 'click',
  darkMode = false,
  zIndex = 100,
  disabled = false,
  matchTriggerWidth = false,
}: GlassPopoverProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const [triggerWidth, setTriggerWidth] = useState<number>(0);
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : internalOpen;

  const hasBackdropFilter = supportsBackdropFilter();

  // Update trigger width
  useEffect(() => {
    if (triggerRef.current && matchTriggerWidth) {
      setTriggerWidth(triggerRef.current.offsetWidth);
    }
  }, [matchTriggerWidth, children]);

  // Handle open state changes
  const setOpen = useCallback((value: boolean) => {
    if (!isControlled) {
      setInternalOpen(value);
    }
    onOpenChange?.(value);
  }, [isControlled, onOpenChange]);

  // Handle click outside
  useEffect(() => {
    if (!open || !closeOnClickOutside) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, closeOnClickOutside, setOpen]);

  // Handle escape key
  useEffect(() => {
    if (!open || !closeOnEscape) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, closeOnEscape, setOpen]);

  // Trigger handlers
  const handleClick = useCallback(() => {
    if (trigger === 'click' && !disabled) {
      setOpen(!open);
    }
  }, [trigger, disabled, open, setOpen]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (trigger === 'context' && !disabled) {
      e.preventDefault();
      setOpen(!open);
    }
  }, [trigger, disabled, open, setOpen]);

  const handleMouseEnter = useCallback(() => {
    if (trigger === 'hover' && !disabled) {
      setOpen(true);
    }
  }, [trigger, disabled, setOpen]);

  const handleMouseLeave = useCallback(() => {
    if (trigger === 'hover' && !disabled) {
      setOpen(false);
    }
  }, [trigger, disabled, setOpen]);

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
      transition: 'normal',
    },
    darkMode
  );

  // Position styles
  const getPositionStyles = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: 'absolute',
      zIndex,
      minWidth: typeof minWidth === 'number' ? `${minWidth}px` : minWidth,
      maxWidth: typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth,
    };

    if (matchTriggerWidth) {
      base.width = triggerWidth;
    }

    switch (position) {
      case 'top':
        return { ...base, bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 8 };
      case 'top-start':
        return { ...base, bottom: '100%', left: 0, marginBottom: 8 };
      case 'top-end':
        return { ...base, bottom: '100%', right: 0, marginBottom: 8 };
      case 'bottom':
        return { ...base, top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 8 };
      case 'bottom-start':
        return { ...base, top: '100%', left: 0, marginTop: 8 };
      case 'bottom-end':
        return { ...base, top: '100%', right: 0, marginTop: 8 };
      case 'left':
        return { ...base, right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: 8 };
      case 'right':
        return { ...base, left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: 8 };
      default:
        return base;
    }
  };

  // Animation styles
  const animationStyles: React.CSSProperties = {
    opacity: open ? 1 : 0,
    visibility: open ? 'visible' : 'hidden',
    transform: open 
      ? getPositionStyles().transform || 'translateY(0)' 
      : `translateY(${position.startsWith('top') ? 4 : -4}px)`,
    transition: `opacity ${glassStyles.transition}, transform ${glassStyles.transition}, visibility ${glassStyles.transition}`,
  };

  // Combine styles
  const combinedStyles: React.CSSProperties = {
    ...glassStyles,
    ...getPositionStyles(),
    ...animationStyles,
    ...contentStyle,
  };

  // Build classes
  const baseClasses = buildGlassClasses({
    elevation: 'floating',
    variant,
    blur,
  });

  const combinedClasses = [
    baseClasses,
    'glass-popover',
    `glass-popover-${position}`,
    open && 'glass-popover-open',
    contentClassName,
  ].filter(Boolean).join(' ');

  return (
    <div
      ref={triggerRef}
      style={{ position: 'relative', display: 'inline-block', ...style }}
      className={className}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      <div
        ref={popoverRef}
        className={combinedClasses}
        style={combinedStyles}
        data-backdrop-support={hasBackdropFilter}
        data-state={open ? 'open' : 'closed'}
      >
        {content}
      </div>
    </div>
  );
}

// ============================================================================
// Preset Variants
// ============================================================================

/**
 * Dropdown menu popover
 */
export function GlassDropdown(props: Omit<GlassPopoverProps, 'trigger' | 'position'>) {
  return (
    <GlassPopover
      {...props}
      trigger="click"
      position="bottom-start"
      matchTriggerWidth
      padding="sm"
    />
  );
}

/**
 * Context menu popover
 */
export function GlassContextMenu(props: Omit<GlassPopoverProps, 'trigger'>) {
  return (
    <GlassPopover
      {...props}
      trigger="context"
      padding="sm"
    />
  );
}

/**
 * Hover popover for quick previews
 */
export function GlassHoverCard(props: Omit<GlassPopoverProps, 'trigger' | 'closeOnClickOutside'>) {
  return (
    <GlassPopover
      {...props}
      trigger="hover"
      closeOnClickOutside={false}
    />
  );
}

// ============================================================================
// Default Export
// ============================================================================

export default GlassPopover;
