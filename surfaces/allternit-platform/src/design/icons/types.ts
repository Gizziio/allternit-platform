/**
 * Icon System - Type Definitions
 * 
 * Comprehensive type-safe icon definitions for the A2rchitect platform.
 * All icons are typed (no string fall-through) to ensure consistency.
 * 
 * @module @allternit/platform/icons/types
 */

// ============================================================================
// Icon Name Union Type - 150+ icons organized by category
// ============================================================================

/** Comprehensive icon name union type for the entire platform */
export type IconName =
  // Navigation (16 icons)
  | 'home' 
  | 'dashboard' 
  | 'settings' 
  | 'profile' 
  | 'menu' 
  | 'close' 
  | 'back' 
  | 'forward'
  | 'chevron-up' 
  | 'chevron-down' 
  | 'chevron-left' 
  | 'chevron-right'
  | 'arrow-up' 
  | 'arrow-down' 
  | 'arrow-left' 
  | 'arrow-right'
  | 'navigation'
  | 'sidebar'
  | 'fullscreen'
  | 'exit-fullscreen'
  | 'external-link'
  
  // Actions (25 icons)
  | 'add' 
  | 'remove' 
  | 'edit' 
  | 'delete' 
  | 'save' 
  | 'cancel' 
  | 'submit'
  | 'search' 
  | 'filter' 
  | 'sort' 
  | 'refresh' 
  | 'download' 
  | 'upload'
  | 'copy' 
  | 'paste' 
  | 'cut' 
  | 'undo' 
  | 'redo'
  | 'more-horizontal'
  | 'more-vertical'
  | 'drag-handle'
  | 'maximize'
  | 'minimize'
  | 'pin'
  | 'unpin'
  | 'link'
  | 'unlink'
  | 'send'
  | 'play'
  | 'pause'
  | 'stop'
  
  // Status (20 icons)
  | 'success' 
  | 'error' 
  | 'warning' 
  | 'info' 
  | 'loading' 
  | 'pending'
  | 'check' 
  | 'check-circle' 
  | 'x' 
  | 'x-circle' 
  | 'alert' 
  | 'alert-triangle'
  | 'alert-circle'
  | 'help'
  | 'help-circle'
  | 'question'
  | 'question-circle'
  | 'clock'
  | 'history'
  | 'timer'
  | 'verified'
  | 'shield'
  | 'shield-check'
  | 'lock'
  | 'unlock'
  
  // Files (18 icons)
  | 'file' 
  | 'folder' 
  | 'image' 
  | 'video' 
  | 'audio' 
  | 'code' 
  | 'document'
  | 'pdf' 
  | 'zip' 
  | 'download-file' 
  | 'upload-file'
  | 'file-text'
  | 'file-code'
  | 'file-json'
  | 'folder-open'
  | 'folder-plus'
  | 'folder-minus'
  | 'folder-tree'
  | 'archive'
  | 'trash'
  | 'trash-2'
  
  // Communication (18 icons)
  | 'chat' 
  | 'message' 
  | 'email' 
  | 'phone' 
  | 'video-call' 
  | 'share'
  | 'notification' 
  | 'bell' 
  | 'mention'
  | 'mail'
  | 'inbox'
  | 'send-message'
  | 'reply'
  | 'forward-message'
  | 'phone-call'
  | 'voicemail'
  | 'rss'
  | 'wifi'
  | 'wifi-off'
  
  // Agents/AI (20 icons)
  | 'agent' 
  | 'bot' 
  | 'ai' 
  | 'sparkles' 
  | 'magic' 
  | 'wand' 
  | 'brain'
  | 'workflow' 
  | 'pipeline' 
  | 'node' 
  | 'connection'
  | 'robot'
  | 'cpu'
  | 'chip'
  | 'network'
  | 'circuit'
  | 'zap'
  | 'lightbulb'
  | 'target'
  | 'crosshair'
  | 'scan'
  | 'scan-face'
  | 'fingerprint'
  
  // Cloud/DevOps (20 icons)
  | 'cloud' 
  | 'server' 
  | 'database' 
  | 'container' 
  | 'kubernetes'
  | 'deploy' 
  | 'build' 
  | 'test' 
  | 'monitor'
  | 'cloud-upload'
  | 'cloud-download'
  | 'cloud-off'
  | 'hard-drive'
  | 'disc'
  | 'layers'
  | 'box'
  | 'package'
  | 'terminal'
  | 'command'
  | 'git-branch'
  | 'git-commit'
  | 'git-merge'
  | 'git-pull-request'
  
  // Media/Editor (18 icons)
  | 'eye'
  | 'eye-off'
  | 'image-plus'
  | 'image-minus'
  | 'camera'
  | 'mic'
  | 'mic-off'
  | 'volume'
  | 'volume-off'
  | 'volume-low'
  | 'volume-high'
  | 'music'
  | 'headphones'
  | 'film'
  | 'palette'
  | 'pen'
  | 'pencil'
  | 'brush'
  | 'type'
  | 'bold'
  | 'italic'
  | 'underline'
  
  // Users/Organization (15 icons)
  | 'user'
  | 'users'
  | 'user-plus'
  | 'user-minus'
  | 'user-check'
  | 'user-circle'
  | 'group'
  | 'team'
  | 'organization'
  | 'building'
  | 'office'
  | 'map-pin'
  | 'map'
  | 'globe'
  | 'flag'
  | 'bookmark'
  | 'bookmark-plus'
  | 'heart'
  | 'star'
  | 'thumbs-up'
  
  // Custom A2rchitect brand icons (8 icons)
  | 'allternit-logo' 
  | 'allternit-mark' 
  | 'shell' 
  | 'capsule' 
  | 'bead'
  | 'substrate'
  | 'kernel'
  | 'archon';

// ============================================================================
// Icon Categories for Organization
// ============================================================================

export const ICON_CATEGORIES = {
  navigation: [
    'home', 'dashboard', 'settings', 'profile', 'menu', 'close', 'back', 'forward',
    'chevron-up', 'chevron-down', 'chevron-left', 'chevron-right',
    'arrow-up', 'arrow-down', 'arrow-left', 'arrow-right', 'navigation',
    'sidebar', 'fullscreen', 'exit-fullscreen', 'external-link',
  ] as IconName[],
  
  actions: [
    'add', 'remove', 'edit', 'delete', 'save', 'cancel', 'submit',
    'search', 'filter', 'sort', 'refresh', 'download', 'upload',
    'copy', 'paste', 'cut', 'undo', 'redo', 'more-horizontal', 'more-vertical',
    'drag-handle', 'maximize', 'minimize', 'pin', 'unpin', 'link', 'unlink',
    'send', 'play', 'pause', 'stop',
  ] as IconName[],
  
  status: [
    'success', 'error', 'warning', 'info', 'loading', 'pending',
    'check', 'check-circle', 'x', 'x-circle', 'alert', 'alert-triangle', 'alert-circle',
    'help', 'help-circle', 'question', 'question-circle', 'clock', 'history', 'timer',
    'verified', 'shield', 'shield-check', 'lock', 'unlock',
  ] as IconName[],
  
  files: [
    'file', 'folder', 'image', 'video', 'audio', 'code', 'document',
    'pdf', 'zip', 'download-file', 'upload-file', 'file-text', 'file-code', 'file-json',
    'folder-open', 'folder-plus', 'folder-minus', 'folder-tree', 'archive', 'trash', 'trash-2',
  ] as IconName[],
  
  communication: [
    'chat', 'message', 'email', 'phone', 'video-call', 'share',
    'notification', 'bell', 'mention', 'mail', 'inbox', 'send-message',
    'reply', 'forward-message', 'phone-call', 'voicemail', 'rss', 'wifi', 'wifi-off',
  ] as IconName[],
  
  agents: [
    'agent', 'bot', 'ai', 'sparkles', 'magic', 'wand', 'brain',
    'workflow', 'pipeline', 'node', 'connection', 'robot', 'cpu', 'chip',
    'network', 'circuit', 'zap', 'lightbulb', 'target', 'crosshair',
    'scan', 'scan-face', 'fingerprint',
  ] as IconName[],
  
  cloud: [
    'cloud', 'server', 'database', 'container', 'kubernetes',
    'deploy', 'build', 'test', 'monitor', 'cloud-upload', 'cloud-download', 'cloud-off',
    'hard-drive', 'disc', 'layers', 'box', 'package', 'terminal', 'command',
    'git-branch', 'git-commit', 'git-merge', 'git-pull-request',
  ] as IconName[],
  
  media: [
    'eye', 'eye-off', 'image-plus', 'image-minus', 'camera', 'mic', 'mic-off',
    'volume', 'volume-off', 'volume-low', 'volume-high', 'music', 'headphones',
    'film', 'palette', 'pen', 'pencil', 'brush', 'type', 'bold', 'italic', 'underline',
  ] as IconName[],
  
  users: [
    'user', 'users', 'user-plus', 'user-minus', 'user-check', 'user-circle',
    'group', 'team', 'organization', 'building', 'office', 'map-pin', 'map',
    'globe', 'flag', 'bookmark', 'bookmark-plus', 'heart', 'star', 'thumbs-up',
  ] as IconName[],
  
  brand: [
    'allternit-logo', 'allternit-mark', 'shell', 'capsule', 'bead',
    'substrate', 'kernel', 'archon',
  ] as IconName[],
} as const;

/** Icon category names */
export type IconCategory = keyof typeof ICON_CATEGORIES;

/** Get all icon names as an array */
export const ALL_ICON_NAMES: IconName[] = Object.values(ICON_CATEGORIES).flat() as IconName[];

// ============================================================================
// Icon Props Interface
// ============================================================================

/** Size variants for icons */
export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;

/** Color variants for icons - integrates with design system */
export type IconColor = 
  | 'inherit' 
  | 'current' 
  | 'primary' 
  | 'secondary' 
  | 'muted' 
  | 'success' 
  | 'warning' 
  | 'danger'
  | 'info'
  | 'on-primary'
  | 'on-secondary'
  | 'on-surface';

/** Visual variants for icons */
export type IconVariant = 'default' | 'filled' | 'outlined' | 'duotone';

/** Base props for all icon components */
export interface IconProps {
  /** Icon name from the design system */
  name: IconName;
  
  /** Size variant or pixel value */
  size?: IconSize;
  
  /** Color variant */
  color?: IconColor;
  
  /** Visual style variant */
  variant?: IconVariant;
  
  /** Spin animation (for loading states) */
  spin?: boolean;
  
  /** Pulse animation */
  pulse?: boolean;
  
  /** Bounce animation */
  bounce?: boolean;
  
  /** Accessibility label */
  ariaLabel?: string;
  
  /** Hide from screen readers */
  ariaHidden?: boolean;
  
  /** Additional CSS classes */
  className?: string;
  
  /** Click handler */
  onClick?: () => void;
  
  /** Data attribute for testing */
  'data-testid'?: string;
}

/** Props for icon button component */
export interface IconButtonProps extends Omit<IconProps, 'name'> {
  /** Icon name */
  name: IconName;
  
  /** Button variant */
  buttonVariant?: 'default' | 'ghost' | 'filled' | 'outline' | 'subtle';
  
  /** Button shape */
  shape?: 'square' | 'circle';
  
  /** Disabled state */
  disabled?: boolean;
  
  /** Loading state (shows spinner) */
  loading?: boolean;
  
  /** Active/pressed state */
  active?: boolean;
  
  /** Tooltip text */
  tooltip?: string;
  
  /** Tab index */
  tabIndex?: number;
  
  /** Type attribute for button element */
  type?: 'button' | 'submit' | 'reset';
}

/** Props for icon with badge */
export interface IconWithBadgeProps extends IconProps {
  /** Badge content - number or string */
  badge?: number | string;
  
  /** Badge color variant */
  badgeVariant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  
  /** Maximum number to display (e.g., 99+) */
  maxBadge?: number;
  
  /** Badge position */
  badgePosition?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  
  /** Show badge as dot only */
  badgeDot?: boolean;
  
  /** Hide badge when zero */
  hideZero?: boolean;
}

// ============================================================================
// Icon Size Constants
// ============================================================================

/** Pixel sizes for icon size variants */
export const ICON_SIZE_PIXELS = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
} as const;

/** Resolve size to pixel value */
export function resolveIconSize(size: IconSize): number {
  if (typeof size === 'number') return size;
  return ICON_SIZE_PIXELS[size];
}

// ============================================================================
// Icon Color Styles (Tailwind classes)
// ============================================================================

/** Tailwind classes for icon colors */
export const ICON_COLOR_CLASSES: Record<IconColor, string> = {
  'inherit': 'text-inherit',
  'current': 'text-current',
  'primary': 'text-[var(--color-primary)]',
  'secondary': 'text-[var(--color-secondary)]',
  'muted': 'text-[var(--color-text-muted)]',
  'success': 'text-[var(--color-success)]',
  'warning': 'text-[var(--color-warning)]',
  'danger': 'text-[var(--color-danger)]',
  'info': 'text-[var(--color-info)]',
  'on-primary': 'text-[var(--color-on-primary)]',
  'on-secondary': 'text-[var(--color-on-secondary)]',
  'on-surface': 'text-[var(--color-on-surface)]',
};

/** Get Tailwind classes for icon color */
export function getIconColorClasses(color: IconColor): string {
  return ICON_COLOR_CLASSES[color] || ICON_COLOR_CLASSES.current;
}

// ============================================================================
// Utility Types
// ============================================================================

/** Type guard to check if a string is a valid IconName */
export function isValidIconName(name: string): name is IconName {
  return ALL_ICON_NAMES.includes(name as IconName);
}

/** Get category for an icon name */
export function getIconCategory(name: IconName): IconCategory | null {
  for (const [category, icons] of Object.entries(ICON_CATEGORIES)) {
    if (icons.includes(name)) {
      return category as IconCategory;
    }
  }
  return null;
}

/** Get all icons in a category */
export function getIconsByCategory(category: IconCategory): readonly IconName[] {
  return ICON_CATEGORIES[category];
}
