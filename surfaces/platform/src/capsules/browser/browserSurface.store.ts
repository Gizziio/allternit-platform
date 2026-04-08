/**
 * Browser Surface State Management
 * 
 * Glass-inspired surface state management for browser tabs.
 * Reduces memory usage by suspending inactive tabs.
 * 
 * States:
 * - visible: Active tab, fully rendered, full resources
 * - hidden-warm: Background tab, resources kept, fast switch back
 * - suspended: Inactive tab, memory freed, screenshot kept
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export type SurfaceState = 'visible' | 'hidden-warm' | 'suspended';

export interface TabSurfaceState {
  tabId: string;
  state: SurfaceState;
  lastActiveAt: number;
  screenshot?: string; // Base64 screenshot for suspended tabs
  scrollPosition?: { x: number; y: number };
  memoryEstimate?: number; // Estimated memory usage in MB
}

interface SurfaceConfig {
  // Time in ms before moving to hidden-warm
  warmTimeout: number;
  // Time in ms before suspending
  suspendTimeout: number;
  // Max suspended tabs to keep
  maxSuspendedTabs: number;
  // Enable automatic state transitions
  autoManage: boolean;
}

interface BrowserSurfaceStore {
  // State
  tabSurfaces: Map<string, TabSurfaceState>;
  config: SurfaceConfig;
  closedTabsHistory: ClosedTabInfo[];
  
  // Actions
  setTabState: (tabId: string, state: SurfaceState) => void;
  activateTab: (tabId: string) => void;
  deactivateTab: (tabId: string) => void;
  suspendTab: (tabId: string, screenshot?: string) => void;
  removeTab: (tabId: string) => void;
  
  // Closed tabs
  addClosedTab: (tabInfo: ClosedTabInfo) => void;
  restoreClosedTab: () => ClosedTabInfo | null;
  clearClosedTabs: () => void;
  
  // Config
  updateConfig: (config: Partial<SurfaceConfig>) => void;
  
  // Getters
  getTabState: (tabId: string) => SurfaceState;
  getSuspendedTabs: () => TabSurfaceState[];
  getVisibleTab: () => string | null;
  shouldSuspend: (tabId: string) => boolean;
}

export interface ClosedTabInfo {
  id: string;
  url: string;
  title: string;
  contentType: 'web' | 'a2ui' | 'miniapp' | 'component' | 'chrome-stream';
  closedAt: number;
  // For web tabs
  history?: string[];
  historyIndex?: number;
  // Screenshot for preview
  screenshot?: string;
}

const DEFAULT_CONFIG: SurfaceConfig = {
  warmTimeout: 30_000, // 30 seconds
  suspendTimeout: 300_000, // 5 minutes
  maxSuspendedTabs: 10,
  autoManage: true,
};

export const useBrowserSurfaceStore = create<BrowserSurfaceStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      tabSurfaces: new Map(),
      config: DEFAULT_CONFIG,
      closedTabsHistory: [],

      setTabState: (tabId: string, state: SurfaceState) => {
        set((s) => {
          const newSurfaces = new Map(s.tabSurfaces);
          const existing = newSurfaces.get(tabId);
          
          newSurfaces.set(tabId, {
            tabId,
            state,
            lastActiveAt: state === 'visible' ? Date.now() : (existing?.lastActiveAt ?? Date.now()),
            screenshot: state === 'suspended' ? existing?.screenshot : undefined,
            scrollPosition: existing?.scrollPosition,
          });

          return { tabSurfaces: newSurfaces };
        });
      },

      activateTab: (tabId: string) => {
        const { tabSurfaces } = get();
        const currentState = tabSurfaces.get(tabId);

        // If tab was suspended, we need to restore it
        if (currentState?.state === 'suspended') {
          console.log(`[BrowserSurface] Restoring suspended tab: ${tabId}`);
        }

        set((s) => {
          const newSurfaces = new Map(s.tabSurfaces);
          
          // Set all tabs to hidden-warm or suspended
          newSurfaces.forEach((surface, id) => {
            if (id !== tabId) {
              // Keep current state if already suspended, otherwise warm
              if (surface.state !== 'suspended') {
                newSurfaces.set(id, { ...surface, state: 'hidden-warm' });
              }
            }
          });
          
          // Activate the selected tab
          newSurfaces.set(tabId, {
            tabId,
            state: 'visible',
            lastActiveAt: Date.now(),
            screenshot: undefined, // Clear screenshot when visible
          });

          return { tabSurfaces: newSurfaces };
        });
      },

      deactivateTab: (tabId: string) => {
        set((s) => {
          const newSurfaces = new Map(s.tabSurfaces);
          const existing = newSurfaces.get(tabId);
          
          if (existing) {
            newSurfaces.set(tabId, {
              ...existing,
              state: 'hidden-warm',
              lastActiveAt: Date.now(),
            });
          }

          return { tabSurfaces: newSurfaces };
        });

        // Schedule suspension if auto-manage is enabled
        const { config } = get();
        if (config.autoManage) {
          setTimeout(() => {
            const { tabSurfaces, suspendTab } = get();
            const surface = tabSurfaces.get(tabId);
            if (surface?.state === 'hidden-warm') {
              // Capture screenshot before suspending
              const screenshot = captureTabScreenshot(tabId);
              suspendTab(tabId, screenshot);
            }
          }, config.suspendTimeout);
        }
      },

      suspendTab: (tabId: string, screenshot?: string) => {
        set((s) => {
          const newSurfaces = new Map(s.tabSurfaces);
          const existing = newSurfaces.get(tabId);
          
          if (existing && existing.state !== 'visible') {
            // Enforce max suspended tabs limit
            const suspendedTabs = Array.from(newSurfaces.values())
              .filter(s => s.state === 'suspended')
              .sort((a, b) => a.lastActiveAt - b.lastActiveAt);
            
            // Remove oldest suspended tabs if over limit
            while (suspendedTabs.length >= s.config.maxSuspendedTabs) {
              const oldest = suspendedTabs.shift();
              if (oldest && oldest.tabId !== tabId) {
                newSurfaces.delete(oldest.tabId);
              }
            }

            newSurfaces.set(tabId, {
              ...existing,
              state: 'suspended',
              screenshot,
            });
          }

          return { tabSurfaces: newSurfaces };
        });
      },

      removeTab: (tabId: string) => {
        set((s) => {
          const newSurfaces = new Map(s.tabSurfaces);
          newSurfaces.delete(tabId);
          return { tabSurfaces: newSurfaces };
        });
      },

      addClosedTab: (tabInfo: ClosedTabInfo) => {
        set((s) => ({
          closedTabsHistory: [tabInfo, ...s.closedTabsHistory.slice(0, 19)], // Keep last 20
        }));
      },

      restoreClosedTab: () => {
        const { closedTabsHistory } = get();
        if (closedTabsHistory.length === 0) return null;
        
        const [restored, ...remaining] = closedTabsHistory;
        set({ closedTabsHistory: remaining });
        
        return restored;
      },

      clearClosedTabs: () => {
        set({ closedTabsHistory: [] });
      },

      updateConfig: (config: Partial<SurfaceConfig>) => {
        set((s) => ({
          config: { ...s.config, ...config },
        }));
      },

      getTabState: (tabId: string): SurfaceState => {
        return get().tabSurfaces.get(tabId)?.state ?? 'hidden-warm';
      },

      getSuspendedTabs: () => {
        return Array.from(get().tabSurfaces.values())
          .filter(s => s.state === 'suspended');
      },

      getVisibleTab: () => {
        for (const [id, surface] of get().tabSurfaces.entries()) {
          if (surface.state === 'visible') return id;
        }
        return null;
      },

      shouldSuspend: (tabId: string): boolean => {
        const { tabSurfaces, config } = get();
        const surface = tabSurfaces.get(tabId);
        
        if (!surface || surface.state !== 'hidden-warm') return false;
        
        const inactiveTime = Date.now() - surface.lastActiveAt;
        return inactiveTime > config.suspendTimeout;
      },
    }),
    { name: 'browser-surface-store' }
  )
);

/**
 * Capture screenshot of a tab before suspending
 * This is a placeholder - actual implementation would use html2canvas or similar
 */
function captureTabScreenshot(tabId: string): string | undefined {
  // In a real implementation, this would:
  // 1. Find the iframe/webview element
  // 2. Use html2canvas or browser API to capture
  // 3. Return base64 data URL
  
  // For now, return undefined (no screenshot)
  return undefined;
}

/**
 * Hook to manage tab surface state
 */
export function useTabSurface(tabId: string) {
  const store = useBrowserSurfaceStore();
  const state = store.tabSurfaces.get(tabId);
  
  return {
    surfaceState: state?.state ?? 'hidden-warm',
    isSuspended: state?.state === 'suspended',
    isVisible: state?.state === 'visible',
    screenshot: state?.screenshot,
    lastActive: state?.lastActiveAt,
    activate: () => store.activateTab(tabId),
    suspend: (screenshot?: string) => store.suspendTab(tabId, screenshot),
  };
}
