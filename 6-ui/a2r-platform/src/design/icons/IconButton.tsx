/**
 * Icon Button Component
 * 
 * Button component that wraps icons with consistent styling and behavior.
 * 
 * @module @a2r/platform/icons/IconButton
 */

import * as React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Slot } from '@radix-ui/react-slot';

import type { IconButtonProps } from './types';
import { Icon } from './Icon';
import { resolveIconSize } from './types';

// ============================================================================
// Utility Functions
// ============================================================================

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

// ============================================================================
// Button Variants
// ============================================================================

const buttonVariants = {
  default: [
    'bg-transparent',
    'text-[var(--color-text)]',
    'hover:bg-[var(--color-surface-hover)]',
    'hover:text-[var(--color-text-primary)]',
  ],
  ghost: [
    'bg-transparent',
    'text-[var(--color-text)]',
    'hover:bg-[var(--color-surface-hover)]',
  ],
  filled: [
    'bg-[var(--color-primary)]',
    'text-[var(--color-on-primary)]',
    'hover:bg-[var(--color-primary-hover)]',
  ],
  outline: [
    'bg-transparent',
    'border',
    'border-[var(--color-border)]',
    'text-[var(--color-text)]',
    'hover:bg-[var(--color-surface-hover)]',
    'hover:border-[var(--color-border-hover)]',
  ],
  subtle: [
    'bg-[var(--color-surface)]',
    'text-[var(--color-text)]',
    'hover:bg-[var(--color-surface-hover)]',
  ],
};

const shapeVariants = {
  square: 'rounded-md',
  circle: 'rounded-full',
};

const sizeVariants = {
  xs: 'p-1',
  sm: 'p-1.5',
  md: 'p-2',
  lg: 'p-2.5',
  xl: 'p-3',
};

// ============================================================================
// Icon Button Component
// ============================================================================

/**
 * IconButton component - interactive button with icon
 * 
 * @example
 * ```tsx
 * // Basic usage
 * <IconButton name="settings" onClick={handleClick} />
 * 
 * // With variant and shape
 * <IconButton name="add" buttonVariant="filled" shape="circle" />
 * 
 * // Loading state
 * <IconButton name="save" loading />
 * 
 * // Disabled
 * <IconButton name="delete" disabled />
 * 
 * // As child (e.g., for Link)
 * <IconButton name="arrow-right" asChild>
 *   <Link href="/next">Next</Link>
 * </IconButton>
 * ```
 */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps & { asChild?: boolean }>(
  ({
    name,
    size = 'md',
    color = 'current',
    buttonVariant = 'default',
    shape = 'square',
    disabled = false,
    loading = false,
    active = false,
    tooltip,
    tabIndex,
    type = 'button',
    className,
    onClick,
    asChild = false,
    ...iconProps
  }, ref) => {
    // Compute button classes
    const buttonClasses = cn(
      // Base styles
      'inline-flex items-center justify-center',
      'transition-all duration-200',
      'focus-visible:outline-none',
      'focus-visible:ring-2',
      'focus-visible:ring-[var(--color-primary)]',
      'focus-visible:ring-offset-2',
      'focus-visible:ring-offset-[var(--color-background)]',
      'disabled:opacity-50',
      'disabled:cursor-not-allowed',
      'disabled:pointer-events-none',
      // Variant styles
      buttonVariants[buttonVariant],
      // Shape
      shapeVariants[shape],
      // Size (based on icon size)
      typeof size === 'number' ? 'p-2' : sizeVariants[size as keyof typeof sizeVariants],
      // Active state
      active && 'bg-[var(--color-surface-active)]',
      // Custom classes
      className
    );
    
    // Resolve icon size for button sizing
    const iconPixelSize = typeof size === 'number' 
      ? size 
      : { xs: 12, sm: 14, md: 16, lg: 20, xl: 24 }[size];
    
    // Determine which icon to show
    const iconName = loading ? 'loading' : name;
    const iconSpin = loading ? true : iconProps.spin;
    
    // Render content
    const content = (
      <Icon
        name={iconName}
        size={iconPixelSize}
        color={buttonVariant === 'filled' ? 'on-primary' : color}
        spin={iconSpin}
        {...iconProps}
      />
    );
    
    // Use Slot for asChild pattern
    const Comp = asChild ? Slot : 'button';
    
    return (
      <Comp
        ref={ref as React.Ref<HTMLButtonElement>}
        type={asChild ? undefined : type}
        className={buttonClasses}
        disabled={disabled || loading}
        tabIndex={tabIndex}
        onClick={onClick}
        title={tooltip}
        data-state={active ? 'active' : undefined}
        data-loading={loading || undefined}
      >
        {content}
      </Comp>
    );
  }
);

IconButton.displayName = 'IconButton';

// ============================================================================
// Icon Button Group Component
// ============================================================================

interface IconButtonGroupProps {
  children: React.ReactNode;
  className?: string;
  attached?: boolean;
}

/**
 * Group multiple IconButtons together
 * 
 * @example
 * ```tsx
 * <IconButtonGroup>
 *   <IconButton name="align-left" />
 *   <IconButton name="align-center" />
 *   <IconButton name="align-right" />
 * </IconButtonGroup>
 * 
 * // Attached (connected buttons)
 * <IconButtonGroup attached>
 *   <IconButton name="bold" />
 *   <IconButton name="italic" />
 *   <IconButton name="underline" />
 * </IconButtonGroup>
 * ```
 */
export function IconButtonGroup({ 
  children, 
  className,
  attached = false,
}: IconButtonGroupProps) {
  return (
    <div
      className={cn(
        'inline-flex',
        attached && 'gap-0 rounded-md overflow-hidden [&>button]:rounded-none [&>button]:border-r [&>button]:border-[var(--color-border)] [&>button:last-child]:border-r-0',
        !attached && 'gap-1',
        className
      )}
      role="group"
    >
      {children}
    </div>
  );
}

// ============================================================================
// Toolbar Component
// ============================================================================

interface IconToolbarProps extends IconButtonGroupProps {
  label?: string;
}

/**
 * Toolbar for grouping related icon buttons with optional label
 * 
 * @example
 * ```tsx
 * <IconToolbar label="Text Formatting">
 *   <IconButton name="bold" />
 *   <IconButton name="italic" />
 *   <IconButton name="underline" />
 * </IconToolbar>
 * ```
 */
export function IconToolbar({ 
  children, 
  className,
  attached = true,
  label,
}: IconToolbarProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      {label && (
        <span className="text-sm text-[var(--color-text-muted)] font-medium">
          {label}
        </span>
      )}
      <IconButtonGroup attached={attached}>
        {children}
      </IconButtonGroup>
    </div>
  );
}

// ============================================================================
// Toggle Icon Button
// ============================================================================

interface ToggleIconButtonProps extends Omit<IconButtonProps, 'active'> {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
  pressedIcon?: IconButtonProps['name'];
  defaultIcon: IconButtonProps['name'];
}

/**
 * Toggle button with two icon states
 * 
 * @example
 * ```tsx
 * const [isMuted, setIsMuted] = useState(false);
 * 
 * <ToggleIconButton
 *   defaultIcon="volume"
 *   pressedIcon="volume-off"
 *   pressed={isMuted}
 *   onPressedChange={setIsMuted}
 * />
 * ```
 */
export function ToggleIconButton({
  pressed,
  onPressedChange,
  defaultIcon,
  pressedIcon,
  ...props
}: ToggleIconButtonProps) {
  const iconName = pressed && pressedIcon ? pressedIcon : defaultIcon;
  
  return (
    <IconButton
      {...props}
      name={iconName}
      active={pressed}
      onClick={() => onPressedChange(!pressed)}
      aria-pressed={pressed}
    />
  );
}
