/**
 * Icon with Badge Component
 * 
 * Displays an icon with a notification badge (count or dot).
 * 
 * @module @allternit/platform/icons/IconWithBadge
 */

import * as React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

import type { IconWithBadgeProps } from './types';
import { Icon } from './Icon';
import { resolveIconSize } from './types';

// ============================================================================
// Utility Functions
// ============================================================================

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

// ============================================================================
// Badge Variants
// ============================================================================

const badgeVariants = {
  default: 'bg-[var(--color-primary)] text-[var(--color-on-primary)]',
  success: 'bg-[var(--color-success)] text-white',
  warning: 'bg-[var(--color-warning)] text-white',
  danger: 'bg-[var(--color-danger)] text-white',
  info: 'bg-[var(--color-info)] text-white',
};

const badgePositions = {
  'top-right': '-top-1 -right-1',
  'top-left': '-top-1 -left-1',
  'bottom-right': '-bottom-1 -right-1',
  'bottom-left': '-bottom-1 -left-1',
};

// ============================================================================
// Format Badge Content
// ============================================================================

function formatBadgeContent(
  badge: number | string,
  maxBadge?: number
): string {
  if (typeof badge === 'string') return badge;
  if (maxBadge && badge > maxBadge) return `${maxBadge}+`;
  return String(badge);
}

// ============================================================================
// Icon With Badge Component
// ============================================================================

/**
 * IconWithBadge component - displays an icon with a notification badge
 * 
 * @example
 * ```tsx
 * // Count badge
 * <IconWithBadge name="bell" badge={5} />
 * 
 * // With max value
 * <IconWithBadge name="message" badge={150} maxBadge={99} />
 * 
 * // Dot only
 * <IconWithBadge name="notification" badge={1} badgeDot />
 * 
 * // Different colors
 * <IconWithBadge name="alert" badge={3} badgeVariant="danger" />
 * 
 * // Hide when zero
 * <IconWithBadge name="inbox" badge={0} hideZero />
 * 
 * // Custom position
 * <IconWithBadge name="mail" badge={2} badgePosition="bottom-right" />
 * ```
 */
export const IconWithBadge = React.forwardRef<HTMLSpanElement, IconWithBadgeProps>(
  ({
    name,
    size = 'md',
    color = 'current',
    badge,
    badgeVariant = 'default',
    maxBadge = 99,
    badgePosition = 'top-right',
    badgeDot = false,
    hideZero = false,
    className,
    ...iconProps
  }, ref) => {
    // Check if badge should be hidden
    const shouldHideBadge = hideZero && 
      (typeof badge === 'number' ? badge === 0 : badge === '0' || !badge);
    
    // Compute badge classes
    const badgeClasses = cn(
      // Base styles
      'absolute',
      'flex items-center justify-center',
      'font-medium',
      'shadow-sm',
      // Position
      badgePositions[badgePosition],
      // Variant
      badgeVariants[badgeVariant],
      // Size (dot vs count)
      badgeDot 
        ? 'w-2.5 h-2.5 rounded-full' 
        : 'min-w-[18px] h-[18px] px-1 text-[10px] rounded-full',
      // Animation
      'animate-in zoom-in-75 duration-200',
    );
    
    // Get icon size for container sizing
    const iconPixelSize = resolveIconSize(size);
    
    return (
      <span
        ref={ref}
        className={cn(
          'relative inline-flex items-center justify-center',
          className
        )}
        style={{ width: iconPixelSize, height: iconPixelSize }}
      >
        <Icon
          name={name}
          size={size}
          color={color}
          {...iconProps}
        />
        
        {badge !== undefined && !shouldHideBadge && (
          <span
            className={badgeClasses}
            aria-hidden="true"
          >
            {!badgeDot && formatBadgeContent(badge, maxBadge)}
          </span>
        )}
        
        {/* Accessibility text for screen readers */}
        {badge !== undefined && !shouldHideBadge && !badgeDot && (
          <span className="sr-only">
            {typeof badge === 'number' 
              ? `${badge} notifications` 
              : `New notification: ${badge}`}
          </span>
        )}
      </span>
    );
  }
);

IconWithBadge.displayName = 'IconWithBadge';

// ============================================================================
// Notification Bell Component
// ============================================================================

interface NotificationBellProps extends Omit<IconWithBadgeProps, 'name'> {
  count?: number;
  showZero?: boolean;
}

/**
 * Specialized notification bell component
 * 
 * @example
 * ```tsx
 * <NotificationBell count={5} />
 * <NotificationBell count={150} maxBadge={99} />
 * <NotificationBell count={0} showZero />
 * ```
 */
export function NotificationBell({
  count = 0,
  showZero = false,
  badgeVariant = count > 10 ? 'danger' : count > 0 ? 'default' : 'default',
  ...props
}: NotificationBellProps) {
  return (
    <IconWithBadge
      name="bell"
      badge={count}
      hideZero={!showZero}
      badgeVariant={badgeVariant}
      {...props}
    />
  );
}

// ============================================================================
// Status Indicator Component
// ============================================================================

interface StatusIndicatorProps extends Omit<IconWithBadgeProps, 'badge' | 'badgeVariant' | 'badgeDot'> {
  status: 'online' | 'offline' | 'away' | 'busy' | 'dnd';
}

const statusColors = {
  online: 'success',
  offline: 'default',
  away: 'warning',
  busy: 'danger',
  dnd: 'danger',
} as const;

/**
 * Status indicator with colored dot badge
 * 
 * @example
 * ```tsx
 * <StatusIndicator name="user" status="online" />
 * <StatusIndicator name="user-circle" status="away" />
 * ```
 */
export function StatusIndicator({
  status,
  badgePosition = 'bottom-right',
  ...props
}: StatusIndicatorProps) {
  return (
    <IconWithBadge
      badge={1}
      badgeDot
      badgeVariant={statusColors[status]}
      badgePosition={badgePosition}
      aria-label={`Status: ${status}`}
      {...props}
    />
  );
}

// ============================================================================
// Message Badge Component
// ============================================================================

interface MessageBadgeProps extends Omit<IconWithBadgeProps, 'name'> {
  unreadCount?: number;
}

/**
 * Message icon with unread count badge
 * 
 * @example
 * ```tsx
 * <MessageBadge unreadCount={3} />
 * <MessageBadge unreadCount={150} maxBadge={99} />
 * ```
 */
export function MessageBadge({
  unreadCount = 0,
  badgeVariant = unreadCount > 0 ? 'info' : 'default',
  ...props
}: MessageBadgeProps) {
  return (
    <IconWithBadge
      name="message"
      badge={unreadCount}
      hideZero
      badgeVariant={badgeVariant}
      {...props}
    />
  );
}

// ============================================================================
// Alert Badge Component
// ============================================================================

interface AlertBadgeProps extends Omit<IconWithBadgeProps, 'name'> {
  alertCount?: number;
  severity?: 'warning' | 'error' | 'info';
}

const severityIcons = {
  warning: 'alert-triangle',
  error: 'alert-circle',
  info: 'info',
} as const;

const severityVariants = {
  warning: 'warning',
  error: 'danger',
  info: 'info',
} as const;

/**
 * Alert icon with count badge
 * 
 * @example
 * ```tsx
 * <AlertBadge alertCount={2} severity="error" />
 * <AlertBadge alertCount={5} severity="warning" />
 * ```
 */
export function AlertBadge({
  alertCount = 0,
  severity = 'info',
  badgeVariant = severityVariants[severity],
  ...props
}: AlertBadgeProps) {
  return (
    <IconWithBadge
      name={severityIcons[severity]}
      badge={alertCount}
      hideZero
      badgeVariant={badgeVariant}
      {...props}
    />
  );
}
