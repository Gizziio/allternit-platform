/**
 * Icon Component
 * 
 * The main Icon component for the A2rchitect platform.
 * Provides a unified, type-safe interface to all icons.
 * 
 * @module @allternit/platform/icons/Icon
 */

import * as React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

import type { IconProps } from './types';
import { 
  resolveIconSize, 
  getIconColorClasses,
  type IconColor,
} from './types';
import { iconMapping } from './lucide-mapping';

// ============================================================================
// Utility Functions
// ============================================================================

/** Merge tailwind classes */
function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

// ============================================================================
// Animation Styles
// ============================================================================

const animationStyles: Record<string, string> = {
  spin: 'animate-spin',
  pulse: 'animate-pulse',
  bounce: 'animate-bounce',
};

// ============================================================================
// Color Styles (CSS custom properties fallback)
// ============================================================================

const colorStyleMap: Record<IconColor, React.CSSProperties> = {
  'inherit': {},
  'current': {},
  'primary': { color: 'var(--color-primary, currentColor)' },
  'secondary': { color: 'var(--color-secondary, currentColor)' },
  'muted': { color: 'var(--color-text-muted, #888)' },
  'success': { color: 'var(--color-success, #22c55e)' },
  'warning': { color: 'var(--color-warning, #f59e0b)' },
  'danger': { color: 'var(--color-danger, #ef4444)' },
  'info': { color: 'var(--color-info, #3b82f6)' },
  'on-primary': { color: 'var(--color-on-primary, white)' },
  'on-secondary': { color: 'var(--color-on-secondary, white)' },
  'on-surface': { color: 'var(--color-on-surface, #1f2937)' },
};

// ============================================================================
// Icon Component
// ============================================================================

/**
 * Icon component - displays icons from the design system
 * 
 * @example
 * ```tsx
 * // Basic usage
 * <Icon name="home" />
 * 
 * // With size and color
 * <Icon name="settings" size="lg" color="primary" />
 * 
 * // With animation
 * <Icon name="loading" spin />
 * 
 * // Custom pixel size
 * <Icon name="star" size={42} />
 * ```
 */
export const Icon = React.forwardRef<SVGSVGElement, IconProps>(
  ({
    name,
    size = 'md',
    color = 'current',
    variant = 'default',
    spin = false,
    pulse = false,
    bounce = false,
    ariaLabel,
    ariaHidden,
    className,
    onClick,
    'data-testid': dataTestId,
  }, ref) => {
    // Resolve icon component from mapping
    const IconComponent = iconMapping[name];
    
    // Handle missing icon gracefully
    if (!IconComponent) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[Icon] Icon "${name}" not found in icon mapping`);
      }
      return null;
    }
    
    // Resolve pixel size
    const pixelSize = resolveIconSize(size);
    
    // Build className with animations
    const classes = cn(
      // Base styles
      'inline-flex shrink-0',
      // Animation styles
      spin && animationStyles.spin,
      pulse && animationStyles.pulse,
      bounce && animationStyles.bounce,
      // Color classes
      getIconColorClasses(color),
      // Interactive cursor
      onClick && 'cursor-pointer',
      // Custom classes
      className
    );
    
    // Get inline styles for color
    const style = colorStyleMap[color];
    
    // Accessibility props
    const accessibilityProps = {
      'aria-label': ariaLabel,
      'aria-hidden': ariaHidden ?? (ariaLabel ? undefined : true),
      role: ariaLabel ? 'img' : undefined,
    };
    
    return (
      <IconComponent
        ref={ref}
        size={pixelSize}
        className={classes}
        style={style}
        onClick={onClick}
        data-testid={dataTestId}
        data-icon={name}
        data-variant={variant}
        {...accessibilityProps}
      />
    );
  }
);

Icon.displayName = 'Icon';

// ============================================================================
// Named Exports for Common Icons (Tree-shaking friendly)
// ============================================================================

/**
 * Direct exports for commonly used icons.
 * These enable tree-shaking when importing individual icons.
 * 
 * @example
 * ```tsx
 * // Instead of:
 * <Icon name="home" />
 * 
 * // You can use (better tree-shaking):
 * import { HomeIcon } from '@allternit/platform/icons';
 * <HomeIcon />
 * ```
 */

// Navigation icons
export const HomeIcon = (props: Omit<IconProps, 'name'>) => <Icon name="home" {...props} />;
export const DashboardIcon = (props: Omit<IconProps, 'name'>) => <Icon name="dashboard" {...props} />;
export const SettingsIcon = (props: Omit<IconProps, 'name'>) => <Icon name="settings" {...props} />;
export const MenuIcon = (props: Omit<IconProps, 'name'>) => <Icon name="menu" {...props} />;
export const CloseIcon = (props: Omit<IconProps, 'name'>) => <Icon name="close" {...props} />;
export const BackIcon = (props: Omit<IconProps, 'name'>) => <Icon name="back" {...props} />;
export const ChevronDownIcon = (props: Omit<IconProps, 'name'>) => <Icon name="chevron-down" {...props} />;
export const ChevronUpIcon = (props: Omit<IconProps, 'name'>) => <Icon name="chevron-up" {...props} />;
export const ChevronLeftIcon = (props: Omit<IconProps, 'name'>) => <Icon name="chevron-left" {...props} />;
export const ChevronRightIcon = (props: Omit<IconProps, 'name'>) => <Icon name="chevron-right" {...props} />;

// Action icons
export const AddIcon = (props: Omit<IconProps, 'name'>) => <Icon name="add" {...props} />;
export const EditIcon = (props: Omit<IconProps, 'name'>) => <Icon name="edit" {...props} />;
export const DeleteIcon = (props: Omit<IconProps, 'name'>) => <Icon name="delete" {...props} />;
export const SaveIcon = (props: Omit<IconProps, 'name'>) => <Icon name="save" {...props} />;
export const SearchIcon = (props: Omit<IconProps, 'name'>) => <Icon name="search" {...props} />;
export const FilterIcon = (props: Omit<IconProps, 'name'>) => <Icon name="filter" {...props} />;
export const RefreshIcon = (props: Omit<IconProps, 'name'>) => <Icon name="refresh" {...props} />;
export const DownloadIcon = (props: Omit<IconProps, 'name'>) => <Icon name="download" {...props} />;
export const UploadIcon = (props: Omit<IconProps, 'name'>) => <Icon name="upload" {...props} />;
export const CopyIcon = (props: Omit<IconProps, 'name'>) => <Icon name="copy" {...props} />;
export const MoreHorizontalIcon = (props: Omit<IconProps, 'name'>) => <Icon name="more-horizontal" {...props} />;
export const MoreVerticalIcon = (props: Omit<IconProps, 'name'>) => <Icon name="more-vertical" {...props} />;

// Status icons
export const SuccessIcon = (props: Omit<IconProps, 'name'>) => <Icon name="success" {...props} />;
export const ErrorIcon = (props: Omit<IconProps, 'name'>) => <Icon name="error" {...props} />;
export const WarningIcon = (props: Omit<IconProps, 'name'>) => <Icon name="warning" {...props} />;
export const InfoIcon = (props: Omit<IconProps, 'name'>) => <Icon name="info" {...props} />;
export const LoadingIcon = (props: Omit<IconProps, 'name'>) => <Icon name="loading" spin {...props} />;
export const CheckIcon = (props: Omit<IconProps, 'name'>) => <Icon name="check" {...props} />;
export const CheckCircleIcon = (props: Omit<IconProps, 'name'>) => <Icon name="check-circle" {...props} />;

// File icons
export const FileIcon = (props: Omit<IconProps, 'name'>) => <Icon name="file" {...props} />;
export const FolderIcon = (props: Omit<IconProps, 'name'>) => <Icon name="folder" {...props} />;
export const ImageIcon = (props: Omit<IconProps, 'name'>) => <Icon name="image" {...props} />;
export const CodeIcon = (props: Omit<IconProps, 'name'>) => <Icon name="code" {...props} />;
export const DocumentIcon = (props: Omit<IconProps, 'name'>) => <Icon name="document" {...props} />;

// Communication icons
export const ChatIcon = (props: Omit<IconProps, 'name'>) => <Icon name="chat" {...props} />;
export const MessageIcon = (props: Omit<IconProps, 'name'>) => <Icon name="message" {...props} />;
export const EmailIcon = (props: Omit<IconProps, 'name'>) => <Icon name="email" {...props} />;
export const BellIcon = (props: Omit<IconProps, 'name'>) => <Icon name="bell" {...props} />;
export const ShareIcon = (props: Omit<IconProps, 'name'>) => <Icon name="share" {...props} />;

// Agent/AI icons
export const AgentIcon = (props: Omit<IconProps, 'name'>) => <Icon name="agent" {...props} />;
export const BotIcon = (props: Omit<IconProps, 'name'>) => <Icon name="bot" {...props} />;
export const AIIcon = (props: Omit<IconProps, 'name'>) => <Icon name="ai" {...props} />;
export const SparklesIcon = (props: Omit<IconProps, 'name'>) => <Icon name="sparkles" {...props} />;
export const BrainIcon = (props: Omit<IconProps, 'name'>) => <Icon name="brain" {...props} />;
export const WorkflowIcon = (props: Omit<IconProps, 'name'>) => <Icon name="workflow" {...props} />;

// Cloud/DevOps icons
export const CloudIcon = (props: Omit<IconProps, 'name'>) => <Icon name="cloud" {...props} />;
export const ServerIcon = (props: Omit<IconProps, 'name'>) => <Icon name="server" {...props} />;
export const DatabaseIcon = (props: Omit<IconProps, 'name'>) => <Icon name="database" {...props} />;
export const DeployIcon = (props: Omit<IconProps, 'name'>) => <Icon name="deploy" {...props} />;
export const MonitorIcon = (props: Omit<IconProps, 'name'>) => <Icon name="monitor" {...props} />;

// User icons
export const UserIcon = (props: Omit<IconProps, 'name'>) => <Icon name="user" {...props} />;
export const UsersIcon = (props: Omit<IconProps, 'name'>) => <Icon name="users" {...props} />;
export const ProfileIcon = (props: Omit<IconProps, 'name'>) => <Icon name="profile" {...props} />;

// Brand icons
export const AllternitLogoIcon = (props: Omit<IconProps, 'name'>) => <Icon name="allternit-logo" {...props} />;
export const AllternitMarkIcon = (props: Omit<IconProps, 'name'>) => <Icon name="allternit-mark" {...props} />;
export const ShellIconComponent = (props: Omit<IconProps, 'name'>) => <Icon name="shell" {...props} />;
export const CapsuleIconComponent = (props: Omit<IconProps, 'name'>) => <Icon name="capsule" {...props} />;
export const BeadIconComponent = (props: Omit<IconProps, 'name'>) => <Icon name="bead" {...props} />;
