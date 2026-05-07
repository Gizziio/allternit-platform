/**
 * Allternit Design System
 * 
 * Common patterns, themes, and components extracted from the terminal app
 * for use across the UI platform.
 */

export { type UseInterruptReturn, useInterrupt } from './useInterrupt';
export { type KeyHandler, type UseKeyboardOptions, useKeyboard } from './useKeyboard';

// Theme system
export { AllternitThemeProvider, ThemeContext, defaultTheme, getStatusColor, lightTheme, useAllternitTheme } from './theme';

// Components
export { StatusBar, statusBarStyles } from './components';

// Motion & Animation
export { motion } from './motion/motion';
export { AccessibleMotion, AnimatedGlassCard, AnimatedList, Fade, LayoutItem, MotionReduced, PageTransition, PullToRefresh, Scale, Skeleton, Slide, Stagger, animationTiming, buttonTap, focusRing, hoverLift, presets, pulseAnimation, shimmerAnimation, type AccessibleMotionProps, type AnimatedGlassCardProps, type AnimatedListProps, type DrawerPreset, type DropdownPreset, type FadeDirection, type FadeProps, type LayoutItemProps, type MicroInteraction, type ModalPreset, type PageTransitionMode, type PageTransitionProps, type PanOptions, type PullToRefreshProps, type ScaleProps, type SkeletonProps, type SkeletonVariant, type SlideDirection, type SlideProps, type StaggerDirection, type StaggerProps, type SwipeDirection, type SwipeOptions, type TimingToken, type ToastPreset, type TooltipPreset, usePan, useReducedMotion, useSwipe } from './animation';

// Tokens and styles
export { tokens } from './tokens';
export { shadows } from './shadows';
export { modeColors } from './modeColors';

// Theme store
export { type Theme, getSystemTheme, resolveTheme, useResolvedTheme, useThemeStore } from './ThemeStore';

// Icon system
export { // Actions
  AddIcon, // Agents/AI
  AgentIcon, // Brand
  AllternitLogoIcon, // Cloud/DevOps
  CloudIcon, // Communication
  ChatIcon, // Files
  FileIcon, // Navigation
  HomeIcon, // Status
  SuccessIcon, // Users
  UserIcon, AIIcon, ALL_ICON_NAMES, AlertBadge, AllternitLogo, AllternitMark, AllternitMarkIcon, ArchonIcon, BackIcon, BeadIcon, BeadIconComponent, BellIcon, BotIcon, BrainIcon, CapsuleIcon, CapsuleIconComponent, CheckCircleIcon, CheckIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, ChevronUpIcon, CloseIcon, CodeIcon, CopyIcon, DashboardIcon, DatabaseIcon, DeleteIcon, DeployIcon, DocumentIcon, DownloadIcon, EditIcon, EmailIcon, ErrorIcon, FilterIcon, FolderIcon, ICON_CATEGORIES, ICON_COLOR_CLASSES, ICON_SIZE_PIXELS, Icon, IconButton, IconButtonGroup, IconToolbar, IconWithBadge, ImageIcon, InfoIcon, KernelIcon, LoadingIcon, MenuIcon, MessageBadge, MessageIcon, MonitorIcon, MoreHorizontalIcon, MoreVerticalIcon, NotificationBell, ProfileIcon, RefreshIcon, SaveIcon, SearchIcon, ServerIcon, SettingsIcon, ShareIcon, ShellIcon, ShellIconComponent, SparklesIcon, StatusIndicator, SubstrateIcon, ToggleIconButton, UploadIcon, UsersIcon, WarningIcon, WorkflowIcon, actionIcons, communicationIcons, fileIcons, getAllIconNames, getIconCategory, getIconColorClasses, getIconComponent, getIconsByCategory, hasIcon, iconMapping, isValidIconName, navigationIcons, resolveIconSize, statusIcons, type ActionIcon, type CommunicationIcon, type CustomIconProps, type FileIconType, type NavigationIcon, type StatusIcon } from './icons';

// Glass Morphism System
export { GlassAlertDialog, GlassBottomPanel, GlassButton, GlassButtonDanger, GlassButtonGhost, GlassButtonLarge, GlassButtonPrimary, GlassButtonSmall, GlassButtonSuccess, GlassCard, GlassCardDanger, GlassCardFlat, GlassCardFloating, GlassCardInteractive, GlassCardPrimary, GlassCardSuccess, GlassCardWarning, GlassConfirmDialog, GlassContextMenu, GlassDialog, GlassDialogFull, GlassDialogLarge, GlassDialogSmall, GlassDrawer, GlassDropdown, GlassHoverCard, GlassIconButton, GlassInput, GlassInputLarge, GlassInputSmall, GlassPanel, GlassPopover, GlassSearchInput, GlassSidebar, GlassSurface, GlassSurfaceBase, GlassSurfaceElevated, GlassSurfaceThick, GlassSurfaceThin, GlassTooltip, GlassTooltipSimple, GlassTopPanel, blurValues, borderStyles, buildGlassClasses, buildGlassStyles, elevationShadows, fallbackBackgrounds, getActiveStyles, getHoverStyles, paddingValues, roundedValues, supportsBackdropFilter, transitionValues, useGlass, useGlassButton, useGlassCard, useGlassDialog, useGlassInput, useGlassPanel, useGlassTooltip, variantColors } from './glass';
export type { GlassBlur, GlassBorder, GlassButtonProps, GlassCardProps, GlassDialogProps, GlassElevation, GlassHover, GlassInputProps, GlassIntensity, GlassOpacity, GlassOptions, GlassPadding, GlassPanelProps, GlassPopoverProps, GlassRounded, GlassSurfaceProps, GlassTooltipProps, GlassTransition, GlassVariant, UseGlassOptions, UseGlassReturn } from './glass';
