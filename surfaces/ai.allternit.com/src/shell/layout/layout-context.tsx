"use client";

import React, { createContext, useContext, useCallback, useState, useEffect } from 'react';

// =============================================================================
// Types
// =============================================================================

export interface PanelConfig {
  id: string;
  title: string;
  icon?: string;
  content?: React.ReactNode;
  defaultSize?: number;
  minSize?: number;
  maxSize?: number;
  resizable?: boolean;
  collapsible?: boolean;
  enabled?: boolean;
}

export interface SidebarState {
  open: boolean;
  width: number;
  collapsedWidth: number;
}

export interface PanelPositionState {
  open: boolean;
  size: number;
}

export interface PanelsState {
  left: PanelPositionState;
  right: PanelPositionState;
  bottom: PanelPositionState;
}

export interface LayoutState {
  sidebar: SidebarState;
  panels: PanelsState;
  activeView: string;
  preset: LayoutPreset;
}

export type LayoutPreset = 'default' | 'focus' | 'fullscreen' | 'ide';

export interface LayoutConfig {
  sidebar?: {
    enabled: boolean;
    defaultOpen?: boolean;
    width?: number;
    collapsedWidth?: number;
    collapsible?: boolean;
  };
  topbar?: {
    enabled: boolean;
    height?: number;
  };
  bottombar?: {
    enabled: boolean;
    height?: number;
  };
  panels?: {
    left?: PanelConfig;
    right?: PanelConfig;
    bottom?: PanelConfig;
  };
  breakpoints?: {
    sidebarHide?: number;
    panelStack?: number;
  };
}

interface LayoutContextValue extends LayoutState {
  // Actions
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarWidth: (width: number) => void;
  togglePanel: (position: 'left' | 'right' | 'bottom') => void;
  setPanelOpen: (position: 'left' | 'right' | 'bottom', open: boolean) => void;
  setPanelSize: (position: 'left' | 'right' | 'bottom', size: number) => void;
  setActiveView: (view: string) => void;
  setPreset: (preset: LayoutPreset) => void;
  // Responsive
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  sidebarMode: 'drawer' | 'collapsed' | 'full';
  // Config
  config: LayoutConfig;
}

// =============================================================================
// Constants & Defaults
// =============================================================================

const STORAGE_KEY = 'allternit-layout-v1';

const defaultLayoutState: LayoutState = {
  sidebar: {
    open: true,
    width: 256,
    collapsedWidth: 64,
  },
  panels: {
    left: { open: false, size: 20 },
    right: { open: false, size: 20 },
    bottom: { open: false, size: 25 },
  },
  activeView: 'home',
  preset: 'default',
};

const defaultConfig: LayoutConfig = {
  sidebar: {
    enabled: true,
    defaultOpen: true,
    width: 256,
    collapsedWidth: 64,
    collapsible: true,
  },
  topbar: {
    enabled: true,
    height: 56,
  },
  bottombar: {
    enabled: true,
    height: 32,
  },
  breakpoints: {
    sidebarHide: 768,
    panelStack: 1024,
  },
};

// =============================================================================
// Context
// =============================================================================

const LayoutContext = createContext<LayoutContextValue | null>(null);

// =============================================================================
// Hook: useWindowSize
// =============================================================================

function useWindowSize() {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateSize = () => {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    };
    
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  return size;
}

// =============================================================================
// Provider
// =============================================================================

interface LayoutProviderProps {
  children: React.ReactNode;
  config?: LayoutConfig;
  persist?: boolean;
}

export function LayoutProvider({ 
  children, 
  config: userConfig,
  persist = true,
}: LayoutProviderProps) {
  const { width } = useWindowSize();
  const config = { ...defaultConfig, ...userConfig };

  // Load persisted state
  const loadPersistedState = useCallback((): Partial<LayoutState> => {
    if (typeof window === 'undefined' || !persist) return {};
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('[Layout] Failed to load persisted state:', e);
    }
    return {};
  }, [persist]);

  const persisted = loadPersistedState();

  // Initialize state with defaults merged with persisted
  const [state, setState] = useState<LayoutState>({
    ...defaultLayoutState,
    ...persisted,
    sidebar: {
      ...defaultLayoutState.sidebar,
      ...persisted.sidebar,
      // Use config defaults if no persisted state
      open: persisted.sidebar?.open ?? config.sidebar?.defaultOpen ?? true,
      width: persisted.sidebar?.width ?? config.sidebar?.width ?? 256,
      collapsedWidth: config.sidebar?.collapsedWidth ?? 64,
    },
    panels: {
      left: { ...defaultLayoutState.panels.left, ...persisted.panels?.left },
      right: { ...defaultLayoutState.panels.right, ...persisted.panels?.right },
      bottom: { ...defaultLayoutState.panels.bottom, ...persisted.panels?.bottom },
    },
  });

  // Persist state changes
  useEffect(() => {
    if (!persist || typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('[Layout] Failed to persist state:', e);
    }
  }, [state, persist]);

  // Responsive breakpoints
  const isMobile = width > 0 && width < (config.breakpoints?.sidebarHide ?? 768);
  const isTablet = width >= (config.breakpoints?.sidebarHide ?? 768) && width < (config.breakpoints?.panelStack ?? 1024);
  const isDesktop = width >= (config.breakpoints?.panelStack ?? 1024) || width === 0;

  const sidebarMode: 'drawer' | 'collapsed' | 'full' = 
    isMobile ? 'drawer' : isTablet ? 'collapsed' : 'full';

  // Auto-collapse on tablet
  useEffect(() => {
    if (isTablet && state.sidebar.open && state.sidebar.width > 100) {
      setState(s => ({
        ...s,
        sidebar: { ...s.sidebar, open: false },
      }));
    }
  }, [isTablet]);

  // Actions
  const toggleSidebar = useCallback(() => {
    setState(s => ({
      ...s,
      sidebar: { ...s.sidebar, open: !s.sidebar.open },
    }));
  }, []);

  const setSidebarOpen = useCallback((open: boolean) => {
    setState(s => ({
      ...s,
      sidebar: { ...s.sidebar, open },
    }));
  }, []);

  const setSidebarWidth = useCallback((width: number) => {
    setState(s => ({
      ...s,
      sidebar: { ...s.sidebar, width: Math.max(s.sidebar.collapsedWidth, width) },
    }));
  }, []);

  const togglePanel = useCallback((position: 'left' | 'right' | 'bottom') => {
    setState(s => ({
      ...s,
      panels: {
        ...s.panels,
        [position]: { ...s.panels[position], open: !s.panels[position].open },
      },
    }));
  }, []);

  const setPanelOpen = useCallback((position: 'left' | 'right' | 'bottom', open: boolean) => {
    setState(s => ({
      ...s,
      panels: {
        ...s.panels,
        [position]: { ...s.panels[position], open },
      },
    }));
  }, []);

  const setPanelSize = useCallback((position: 'left' | 'right' | 'bottom', size: number) => {
    setState(s => ({
      ...s,
      panels: {
        ...s.panels,
        [position]: { ...s.panels[position], size },
      },
    }));
  }, []);

  const setActiveView = useCallback((view: string) => {
    setState(s => ({ ...s, activeView: view }));
  }, []);

  const setPreset = useCallback((preset: LayoutPreset) => {
    setState(s => {
      const newState = { ...s, preset };
      switch (preset) {
        case 'focus':
          newState.sidebar = { ...s.sidebar, open: false };
          newState.panels = {
            left: { ...s.panels.left, open: false },
            right: { ...s.panels.right, open: false },
            bottom: { ...s.panels.bottom, open: false },
          };
          break;
        case 'fullscreen':
          newState.sidebar = { ...s.sidebar, open: false };
          break;
        case 'ide':
          newState.sidebar = { ...s.sidebar, open: true };
          newState.panels = {
            left: { ...s.panels.left, open: true },
            right: { ...s.panels.right, open: true },
            bottom: { ...s.panels.bottom, open: true },
          };
          break;
        case 'default':
        default:
          newState.sidebar = { ...s.sidebar, open: true };
          break;
      }
      return newState;
    });
  }, []);

  const value: LayoutContextValue = {
    ...state,
    toggleSidebar,
    setSidebarOpen,
    setSidebarWidth,
    togglePanel,
    setPanelOpen,
    setPanelSize,
    setActiveView,
    setPreset,
    isMobile,
    isTablet,
    isDesktop,
    sidebarMode,
    config,
  };

  return (
    <LayoutContext.Provider value={value}>
      {children}
    </LayoutContext.Provider>
  );
}

// =============================================================================
// Hook: useLayout
// =============================================================================

export function useLayout() {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error('useLayout must be used within a LayoutProvider');
  }
  return context;
}

export function useLayoutState() {
  return useLayout();
}
