"use client";

import { useCallback } from 'react';
import { useLayout as useLayoutContext, type LayoutPreset, type PanelConfig } from './layout-context';

// =============================================================================
// Re-export from context
// =============================================================================

export { useLayoutContext, type LayoutPreset, type PanelConfig };
export type { SidebarItem } from './Sidebar';
export type { BreadcrumbItem, TopBarAction } from './TopBar';
export type { BottomBarAction } from './BottomBar';

// =============================================================================
// Enhanced useLayout Hook
// =============================================================================

export interface UseLayoutReturn {
  // Sidebar state
  sidebarOpen: boolean;
  sidebarWidth: number;
  sidebarCollapsedWidth: number;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarWidth: (width: number) => void;
  
  // Panels state
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  bottomPanelOpen: boolean;
  leftPanelSize: number;
  rightPanelSize: number;
  bottomPanelSize: number;
  togglePanel: (position: 'left' | 'right' | 'bottom') => void;
  setPanelOpen: (position: 'left' | 'right' | 'bottom', open: boolean) => void;
  setPanelSize: (position: 'left' | 'right' | 'bottom', size: number) => void;
  
  // View state
  activeView: string;
  setActiveView: (view: string) => void;
  
  // Presets
  preset: LayoutPreset;
  setPreset: (preset: LayoutPreset) => void;
  applyDefaultPreset: () => void;
  applyFocusPreset: () => void;
  applyFullscreenPreset: () => void;
  applyIDEPreset: () => void;
  
  // Responsive
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  sidebarMode: 'drawer' | 'collapsed' | 'full';
  
  // Computed
  isSidebarCollapsed: boolean;
  anyPanelOpen: boolean;
}

export function useLayout(): UseLayoutReturn {
  const context = useLayoutContext();

  const applyDefaultPreset = useCallback(() => {
    context.setPreset('default');
  }, [context]);

  const applyFocusPreset = useCallback(() => {
    context.setPreset('focus');
  }, [context]);

  const applyFullscreenPreset = useCallback(() => {
    context.setPreset('fullscreen');
  }, [context]);

  const applyIDEPreset = useCallback(() => {
    context.setPreset('ide');
  }, [context]);

  return {
    // Sidebar
    sidebarOpen: context.sidebar.open,
    sidebarWidth: context.sidebar.width,
    sidebarCollapsedWidth: context.sidebar.collapsedWidth,
    toggleSidebar: context.toggleSidebar,
    setSidebarOpen: context.setSidebarOpen,
    setSidebarWidth: context.setSidebarWidth,
    
    // Panels
    leftPanelOpen: context.panels.left.open,
    rightPanelOpen: context.panels.right.open,
    bottomPanelOpen: context.panels.bottom.open,
    leftPanelSize: context.panels.left.size,
    rightPanelSize: context.panels.right.size,
    bottomPanelSize: context.panels.bottom.size,
    togglePanel: context.togglePanel,
    setPanelOpen: context.setPanelOpen,
    setPanelSize: context.setPanelSize,
    
    // View
    activeView: context.activeView,
    setActiveView: context.setActiveView,
    
    // Presets
    preset: context.preset,
    setPreset: context.setPreset,
    applyDefaultPreset,
    applyFocusPreset,
    applyFullscreenPreset,
    applyIDEPreset,
    
    // Responsive
    isMobile: context.isMobile,
    isTablet: context.isTablet,
    isDesktop: context.isDesktop,
    sidebarMode: context.sidebarMode,
    
    // Computed
    isSidebarCollapsed: !context.sidebar.open,
    anyPanelOpen: context.panels.left.open || context.panels.right.open || context.panels.bottom.open,
  };
}

// =============================================================================
// Specialized Hooks
// =============================================================================

export function useSidebar() {
  const layout = useLayout();
  return {
    isOpen: layout.sidebarOpen,
    width: layout.sidebarWidth,
    collapsedWidth: layout.sidebarCollapsedWidth,
    toggle: layout.toggleSidebar,
    setOpen: layout.setSidebarOpen,
    setWidth: layout.setSidebarWidth,
    isCollapsed: layout.isSidebarCollapsed,
    mode: layout.sidebarMode,
  };
}

export function usePanels() {
  const layout = useLayout();
  return {
    left: {
      isOpen: layout.leftPanelOpen,
      size: layout.leftPanelSize,
      toggle: () => layout.togglePanel('left'),
      setOpen: (open: boolean) => layout.setPanelOpen('left', open),
      setSize: (size: number) => layout.setPanelSize('left', size),
    },
    right: {
      isOpen: layout.rightPanelOpen,
      size: layout.rightPanelSize,
      toggle: () => layout.togglePanel('right'),
      setOpen: (open: boolean) => layout.setPanelOpen('right', open),
      setSize: (size: number) => layout.setPanelSize('right', size),
    },
    bottom: {
      isOpen: layout.bottomPanelOpen,
      size: layout.bottomPanelSize,
      toggle: () => layout.togglePanel('bottom'),
      setOpen: (open: boolean) => layout.setPanelOpen('bottom', open),
      setSize: (size: number) => layout.setPanelSize('bottom', size),
    },
    anyOpen: layout.anyPanelOpen,
  };
}

export function useResponsiveLayout() {
  const layout = useLayout();
  return {
    isMobile: layout.isMobile,
    isTablet: layout.isTablet,
    isDesktop: layout.isDesktop,
    sidebarMode: layout.sidebarMode,
  };
}

export function useLayoutPresets() {
  const layout = useLayout();
  return {
    current: layout.preset,
    set: layout.setPreset,
    default: layout.applyDefaultPreset,
    focus: layout.applyFocusPreset,
    fullscreen: layout.applyFullscreenPreset,
    ide: layout.applyIDEPreset,
  };
}
