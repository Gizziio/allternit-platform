"use client";

// =============================================================================
// Shell Layout System
// =============================================================================

// Main Components
export { ShellLayout, ShellLayoutWithPreset, layoutPresets } from './ShellLayout';
export { Sidebar } from './Sidebar';
export { TopBar } from './TopBar';
export { BottomBar } from './BottomBar';
export { PanelContainer, PanelToggleButton, PanelGroup } from './PanelContainer';

// Hooks
export {
  useLayout,
  useSidebar,
  usePanels,
  useResponsiveLayout,
  useLayoutPresets,
  useLayoutContext,
} from './useLayout';

// Context
export {
  LayoutProvider,
  useLayoutState,
} from './layout-context';

// Types
export type {
  ShellLayoutProps,
  LayoutPresetKey,
} from './ShellLayout';

export type {
  SidebarProps,
  SidebarItem,
} from './Sidebar';

export type {
  TopBarProps,
  BreadcrumbItem,
  TopBarAction,
} from './TopBar';

export type {
  BottomBarProps,
  ConnectionStatus,
  SyncStatus,
  BottomBarAction,
} from './BottomBar';

export type {
  PanelContainerProps,
  PanelToggleButtonProps,
  PanelGroupProps,
} from './PanelContainer';

export type {
  LayoutState,
  LayoutConfig,
  LayoutPreset,
  PanelConfig,
  SidebarState,
  PanelsState,
  PanelPositionState,
} from './layout-context';

export type {
  UseLayoutReturn,
} from './useLayout';
