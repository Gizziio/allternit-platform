/**
 * Settings Store - Thin Client
 * 
 * Persistent settings using zustand with localStorage
 * Mirrors A2R Platform settings for consistency
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ============================================================================
// Types
// ============================================================================

export type ThemeMode = 'light' | 'dark' | 'system';

export interface WindowPosition {
  x: number;
  y: number;
}

export interface SettingsState {
  // Theme
  theme: ThemeMode;
  
  // Model preferences
  lastSelectedProvider: string | null;
  lastSelectedModel: string | null;
  
  // Window settings
  windowPosition: WindowPosition | null;
  
  // Agent settings
  agentModeEnabled: boolean;
  
  // Computer Use settings
  computerUseEnabled: boolean;
  
  // UI preferences
  showTimestamps: boolean;
  showMetadata: boolean;
  fontSize: 'small' | 'medium' | 'large';
  
  // Connection preferences
  preferredBackend: 'cloud' | 'desktop';
}

interface SettingsActions {
  // Theme actions
  setTheme: (theme: ThemeMode) => void;
  
  // Model actions
  setLastSelectedProvider: (provider: string | null) => void;
  setLastSelectedModel: (model: string | null) => void;
  
  // Window actions
  setWindowPosition: (position: WindowPosition | null) => void;
  
  // Agent actions
  setAgentModeEnabled: (enabled: boolean) => void;
  
  // Computer Use actions
  setComputerUseEnabled: (enabled: boolean) => void;
  
  // UI actions
  setShowTimestamps: (show: boolean) => void;
  setShowMetadata: (show: boolean) => void;
  setFontSize: (size: 'small' | 'medium' | 'large') => void;
  
  // Connection actions
  setPreferredBackend: (backend: 'cloud' | 'desktop') => void;
  
  // Reset
  resetSettings: () => void;
}

export type SettingsStore = SettingsState & SettingsActions;

// ============================================================================
// Default Settings
// ============================================================================

const DEFAULT_SETTINGS: SettingsState = {
  theme: 'system',
  lastSelectedProvider: null,
  lastSelectedModel: null,
  windowPosition: null,
  agentModeEnabled: false,
  computerUseEnabled: true,
  showTimestamps: true,
  showMetadata: true,
  fontSize: 'medium',
  preferredBackend: 'desktop',
};

// ============================================================================
// Store Implementation
// ============================================================================

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,

      // Theme
      setTheme: (theme) => set({ theme }),

      // Model
      setLastSelectedProvider: (provider) => set({ lastSelectedProvider: provider }),
      setLastSelectedModel: (model) => set({ lastSelectedModel: model }),

      // Window
      setWindowPosition: (position) => set({ windowPosition: position }),

      // Agent
      setAgentModeEnabled: (enabled) => set({ agentModeEnabled: enabled }),

      // Computer Use
      setComputerUseEnabled: (enabled) => set({ computerUseEnabled: enabled }),

      // UI
      setShowTimestamps: (show) => set({ showTimestamps: show }),
      setShowMetadata: (show) => set({ showMetadata: show }),
      setFontSize: (size) => set({ fontSize: size }),

      // Connection
      setPreferredBackend: (backend) => set({ preferredBackend: backend }),

      // Reset
      resetSettings: () => set(DEFAULT_SETTINGS),
    }),
    {
      name: 'gizzi-thin-client-settings',
      version: 1,
      partialize: (state) => ({
        theme: state.theme,
        lastSelectedProvider: state.lastSelectedProvider,
        lastSelectedModel: state.lastSelectedModel,
        windowPosition: state.windowPosition,
        agentModeEnabled: state.agentModeEnabled,
        computerUseEnabled: state.computerUseEnabled,
        showTimestamps: state.showTimestamps,
        showMetadata: state.showMetadata,
        fontSize: state.fontSize,
        preferredBackend: state.preferredBackend,
      }),
    }
  )
);

// ============================================================================
// Theme Utility
// ============================================================================

/**
 * Get effective theme (resolves 'system' to actual theme)
 */
export function getEffectiveTheme(theme: ThemeMode): 'light' | 'dark' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme;
}

/**
 * Apply theme to document
 */
export function applyTheme(theme: ThemeMode): void {
  const effectiveTheme = getEffectiveTheme(theme);
  document.documentElement.setAttribute('data-theme', effectiveTheme);
  document.documentElement.classList.remove('light', 'dark');
  document.documentElement.classList.add(effectiveTheme);
}

/**
 * Listen for system theme changes
 */
export function listenToSystemTheme(callback: (theme: 'light' | 'dark') => void): () => void {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = (e: MediaQueryListEvent) => {
    callback(e.matches ? 'dark' : 'light');
  };
  
  mediaQuery.addEventListener('change', handler);
  return () => mediaQuery.removeEventListener('change', handler);
}

// Default export for convenience
export default useSettingsStore;
