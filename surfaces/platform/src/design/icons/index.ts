/**
 * A2rchitect Icon System
 * 
 * Unified, type-safe icon system for the entire platform.
 * 
 * @example
 * ```tsx
 * // Basic usage
 * import { Icon } from '@allternit/platform/icons';
 * <Icon name="home" size="md" />
 * 
 * // Named icon exports (better tree-shaking)
 * import { HomeIcon, SettingsIcon } from '@allternit/platform/icons';
 * 
 * // Icon button
 * import { IconButton } from '@allternit/platform/icons';
 * <IconButton name="add" buttonVariant="filled" />
 * 
 * // With badge
 * import { IconWithBadge, NotificationBell } from '@allternit/platform/icons';
 * <NotificationBell count={5} />
 * 
 * // Custom brand icons
 * import { AllternitLogoIcon, ShellIconComponent } from '@allternit/platform/icons';
 * <AllternitLogoIcon size={32} />
 * ```
 * 
 * @module @allternit/platform/icons
 */

// ============================================================================
// Main Components
// ============================================================================

export { Icon } from './Icon';
export { IconButton, IconButtonGroup, IconToolbar, ToggleIconButton } from './IconButton';
export { IconWithBadge, NotificationBell, StatusIndicator, MessageBadge, AlertBadge } from './IconWithBadge';

// ============================================================================
// Named Icon Exports (Tree-shaking friendly)
// ============================================================================

export {
  // Navigation
  HomeIcon,
  DashboardIcon,
  SettingsIcon,
  MenuIcon,
  CloseIcon,
  BackIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  
  // Actions
  AddIcon,
  EditIcon,
  DeleteIcon,
  SaveIcon,
  SearchIcon,
  FilterIcon,
  RefreshIcon,
  DownloadIcon,
  UploadIcon,
  CopyIcon,
  MoreHorizontalIcon,
  MoreVerticalIcon,
  
  // Status
  SuccessIcon,
  ErrorIcon,
  WarningIcon,
  InfoIcon,
  LoadingIcon,
  CheckIcon,
  CheckCircleIcon,
  
  // Files
  FileIcon,
  FolderIcon,
  ImageIcon,
  CodeIcon,
  DocumentIcon,
  
  // Communication
  ChatIcon,
  MessageIcon,
  EmailIcon,
  BellIcon,
  ShareIcon,
  
  // Agents/AI
  AgentIcon,
  BotIcon,
  AIIcon,
  SparklesIcon,
  BrainIcon,
  WorkflowIcon,
  
  // Cloud/DevOps
  CloudIcon,
  ServerIcon,
  DatabaseIcon,
  DeployIcon,
  MonitorIcon,
  
  // Users
  UserIcon,
  UsersIcon,
  ProfileIcon,
  
  // Brand
  AllternitLogoIcon,
  AllternitMarkIcon,
  ShellIconComponent,
  CapsuleIconComponent,
  BeadIconComponent,
} from './Icon';

// ============================================================================
// Type Definitions
// ============================================================================

export type {
  IconName,
  IconSize,
  IconColor,
  IconVariant,
  IconCategory,
  IconProps,
  IconButtonProps,
  IconWithBadgeProps,
} from './types';

export {
  ICON_CATEGORIES,
  ALL_ICON_NAMES,
  ICON_SIZE_PIXELS,
  ICON_COLOR_CLASSES,
  resolveIconSize,
  getIconColorClasses,
  isValidIconName,
  getIconCategory,
  getIconsByCategory,
} from './types';

// ============================================================================
// Icon Mapping
// ============================================================================

export { iconMapping, hasIcon, getIconComponent, getAllIconNames } from './lucide-mapping';

// ============================================================================
// Custom Brand Icons
// ============================================================================

export {
  AllternitLogo,
  AllternitMark,
  ShellIcon,
  CapsuleIcon,
  BeadIcon,
  SubstrateIcon,
  KernelIcon,
  ArchonIcon,
  type CustomIconProps,
} from './custom';

// ============================================================================
// Categories (Selective Imports)
// ============================================================================

export {
  navigationIcons,
  actionIcons,
  statusIcons,
  fileIcons,
  communicationIcons,
  type NavigationIcon,
  type ActionIcon,
  type StatusIcon,
  type FileIconType,
  type CommunicationIcon,
} from './categories';
