// ============================================================================
// Capsule/MiniApp Browser Store
// ============================================================================
// Enhanced browser store supporting multiple content types: web, a2ui, miniapp
// ============================================================================

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  BrowserTab,
  BrowserContentType,
  WebTab,
  A2UITab,
  MiniappTab,
  ComponentTab,
  ChromeStreamTab,
  A2UIPayload,
  MiniappManifest,
  ProtocolParseResult,
} from './browser.types';

// ============================================================================
// URL Protocol Detection
// ============================================================================

/**
 * Parse a URL/input to detect the content type and normalize it
 * 
 * Supported protocols:
 * - http://, https:// -> web
 * - a2ui:// -> A2UI payload (references stored payload or inline JSON)
 * - miniapp:// -> Miniapp reference
 * - capsule:// -> Capsule reference (alias for miniapp)
 * - component:// -> Direct component reference
 */
export function parseBrowserInput(input: string): ProtocolParseResult {
  const trimmed = input.trim();

  // Check for explicit protocols
  const protocolMatch = trimmed.match(/^([a-z]+):\/\/(.+)$/i);
  if (protocolMatch) {
    const [, protocol, resource] = protocolMatch;

    switch (protocol.toLowerCase()) {
      case 'http':
      case 'https':
        return { type: 'web', resource: trimmed };
      case 'a2ui':
        return { type: 'a2ui', resource };
      case 'miniapp':
      case 'capsule':
        return { type: 'miniapp', resource };
      case 'component':
        return { type: 'component', resource };
      default:
        // Unknown protocol, treat as web search
        return { type: 'web', resource: `https://www.google.com/search?q=${encodeURIComponent(trimmed)}` };
    }
  }

  // Check if it's a URL without protocol
  if (trimmed.includes('.') && !trimmed.includes(' ')) {
    // Looks like a domain
    if (trimmed.includes('/') || trimmed.includes('?')) {
      return { type: 'web', resource: `https://${trimmed}` };
    }
    // Check for common TLDs
    const hasTLD = /\.(com|org|net|edu|gov|io|co|ai|app|dev|xyz|info|biz|us|uk|eu|de|fr|jp|cn|ru|br|in)\b/i.test(trimmed);
    if (hasTLD) {
      return { type: 'web', resource: `https://${trimmed}` };
    }
  }

  // Default: treat as web search
  return { type: 'web', resource: `https://www.google.com/search?q=${encodeURIComponent(trimmed)}` };
}

// ============================================================================
// Tab Factory Functions
// ============================================================================

export function createWebTab(url: string, title?: string): WebTab {
  const parsed = parseBrowserInput(url);
  return {
    id: `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    url: parsed.resource,
    title: title || parsed.resource,
    isActive: false,
    contentType: 'web',
  };
}

export function createA2UITab(
  payload: A2UIPayload,
  title: string = 'A2UI App',
  source?: string,
  isMockData?: boolean
): A2UITab {
  return {
    id: `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title,
    isActive: false,
    contentType: 'a2ui',
    payload,
    source,
    isMockData,
  };
}

export function createMiniappTab(
  manifest: MiniappManifest,
  capsuleId: string,
  entryPoint: string = 'default'
): MiniappTab {
  return {
    id: `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title: manifest.meta.name,
    isActive: false,
    contentType: 'miniapp',
    manifest,
    capsuleId,
    entryPoint,
  };
}

export function createComponentTab(
  componentId: string,
  title: string = 'Component',
  props?: Record<string, unknown>
): ComponentTab {
  return {
    id: `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title,
    isActive: false,
    contentType: 'component',
    componentId,
    props,
  };
}

// ============================================================================
// Store Interface
// ============================================================================

export interface RecentVisit {
  url: string;
  title: string;
  visitedAt: number;
}

const MAX_RECENT_VISITS = 12;

interface BrowserStore {
  // State
  tabs: BrowserTab[];
  activeTabId: string | null;
  consoleOpen: boolean;
  consoleHeight: number;
  chatPaneOpen: boolean;
  recentVisits: RecentVisit[];
  // Per-tab navigation history: tabId -> array of URLs
  tabHistory: Record<string, string[]>;
  tabHistoryIndex: Record<string, number>;
  // Per-tab loading state
  tabLoading: Record<string, boolean>;

  // Tab Management
  addTab: (input: string, title?: string) => string;
  addCustomTab: (tab: BrowserTab) => string;
  addA2UITab: (payload: A2UIPayload, title?: string, source?: string, isMockData?: boolean) => string;
  addMiniappTab: (manifest: MiniappManifest, capsuleId: string, entryPoint?: string) => string;
  addComponentTab: (componentId: string, title?: string, props?: Record<string, unknown>) => string;
  addChromeStreamTab: (sessionId: string, signalingUrl: string, iceServers?: RTCIceServer[], resolution?: string) => string;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTab: (id: string, updates: Partial<BrowserTab>) => void;

  // Navigation
  goBack: (tabId: string) => void;
  goForward: (tabId: string) => void;
  pushHistory: (tabId: string, url: string) => void;
  canGoBack: (tabId: string) => boolean;
  canGoForward: (tabId: string) => boolean;
  setTabLoading: (tabId: string, loading: boolean) => void;

  // Console
  toggleConsole: () => void;
  setConsoleHeight: (height: number) => void;

  // Chat Pane
  toggleChatPane: () => void;

  // Bulk Operations
  closeAllTabs: () => void;
  closeOtherTabs: (keepId: string) => void;
  closeTabsToRight: (id: string) => void;
  duplicateTab: (id: string) => void;

  // History
  addRecentVisit: (url: string, title: string) => void;
  clearRecentVisits: () => void;

  // Utilities
  getActiveTab: () => BrowserTab | undefined;
  getTabById: (id: string) => BrowserTab | undefined;
  getTabsByType: (type: BrowserContentType) => BrowserTab[];
}

// ============================================================================
// Store Implementation
// ============================================================================

const initialTab = createWebTab('https://www.google.com', 'Google');

export const useBrowserStore = create<BrowserStore>()(
  devtools(
    (set, get) => ({
      // Initial State
      tabs: [initialTab],
      activeTabId: initialTab.id,
      consoleOpen: false,
      consoleHeight: 200,
      chatPaneOpen: false,
      recentVisits: [],
      tabHistory: { [initialTab.id]: ['https://www.google.com'] },
      tabHistoryIndex: { [initialTab.id]: 0 },
      tabLoading: {},

      // Tab Management
      addTab: (input: string, title?: string) => {
        const newTab = createWebTab(input, title);
        // Track visit
        get().addRecentVisit(newTab.url, title || newTab.url);
        set((state) => ({
          tabs: [...state.tabs.map((t) => ({ ...t, isActive: false })), newTab],
          activeTabId: newTab.id,
          tabHistory: { ...state.tabHistory, [newTab.id]: [newTab.url] },
          tabHistoryIndex: { ...state.tabHistoryIndex, [newTab.id]: 0 },
          tabLoading: { ...state.tabLoading, [newTab.id]: true },
        }));
        return newTab.id;
      },

      addCustomTab: (tab: BrowserTab) => {
        set((state) => ({
          tabs: [...state.tabs.map((t) => ({ ...t, isActive: false })), { ...tab, isActive: true }],
          activeTabId: tab.id,
        }));
        return tab.id;
      },

      addA2UITab: (payload: A2UIPayload, title?: string, source?: string, isMockData?: boolean) => {
        const newTab = createA2UITab(payload, title, source, isMockData);
        set((state) => ({
          tabs: [...state.tabs.map((t) => ({ ...t, isActive: false })), newTab],
          activeTabId: newTab.id,
        }));
        return newTab.id;
      },

      addMiniappTab: (manifest: MiniappManifest, capsuleId: string, entryPoint?: string) => {
        const newTab = createMiniappTab(manifest, capsuleId, entryPoint);
        set((state) => ({
          tabs: [...state.tabs.map((t) => ({ ...t, isActive: false })), newTab],
          activeTabId: newTab.id,
        }));
        return newTab.id;
      },

      addComponentTab: (componentId: string, title?: string, props?: Record<string, unknown>) => {
        const newTab = createComponentTab(componentId, title, props);
        set((state) => ({
          tabs: [...state.tabs.map((t) => ({ ...t, isActive: false })), newTab],
          activeTabId: newTab.id,
        }));
        return newTab.id;
      },

      addChromeStreamTab: (sessionId: string, signalingUrl: string, iceServers?: RTCIceServer[], resolution?: string) => {
        const id = `chrome-${sessionId}`;
        const newTab: ChromeStreamTab = {
          id,
          title: 'Chrome Session',
          isActive: false,
          contentType: 'chrome-stream',
          sessionId,
          signalingUrl,
          iceServers,
          resolution: resolution || '1920x1080',
          streamStatus: 'connecting',
        };
        set((state) => ({
          tabs: [...state.tabs.map((t) => ({ ...t, isActive: false })), newTab],
          activeTabId: id,
        }));
        return id;
      },

      closeTab: (id: string) => {
        set((state) => {
          const newTabs = state.tabs.filter((t) => t.id !== id);
          let newActiveId = state.activeTabId;

          if (state.activeTabId === id) {
            // Find the tab to the left of the closed tab
            const closedIndex = state.tabs.findIndex((t) => t.id === id);
            const newIndex = Math.max(0, closedIndex - 1);
            newActiveId = newTabs[newIndex]?.id || null;
            if (newActiveId) {
              newTabs.forEach((t) => {
                t.isActive = t.id === newActiveId;
              });
            }
          }

          return { tabs: newTabs, activeTabId: newActiveId };
        });
      },

      setActiveTab: (id: string) => {
        set((state) => ({
          tabs: state.tabs.map((t) => ({ ...t, isActive: t.id === id })),
          activeTabId: id,
        }));
      },

      updateTab: (id: string, updates: Partial<BrowserTab>) => {
        set((state) => ({
          tabs: state.tabs.map((t) => (t.id === id ? { ...t, ...updates } as BrowserTab : t)),
        }));
      },

      // Navigation
      pushHistory: (tabId: string, url: string) => {
        set((state) => {
          const history = state.tabHistory[tabId] || [];
          const index = state.tabHistoryIndex[tabId] ?? -1;
          // Truncate forward history and push new URL
          const newHistory = [...history.slice(0, index + 1), url];
          return {
            tabHistory: { ...state.tabHistory, [tabId]: newHistory },
            tabHistoryIndex: { ...state.tabHistoryIndex, [tabId]: newHistory.length - 1 },
          };
        });
      },

      goBack: (tabId: string) => {
        const state = get();
        const index = state.tabHistoryIndex[tabId] ?? 0;
        if (index <= 0) return;
        const newIndex = index - 1;
        const url = state.tabHistory[tabId]?.[newIndex];
        if (!url) return;
        set((s) => ({
          tabHistoryIndex: { ...s.tabHistoryIndex, [tabId]: newIndex },
          tabs: s.tabs.map((t) => t.id === tabId ? { ...t, url, title: url } as BrowserTab : t),
          tabLoading: { ...s.tabLoading, [tabId]: true },
        }));
      },

      goForward: (tabId: string) => {
        const state = get();
        const history = state.tabHistory[tabId] || [];
        const index = state.tabHistoryIndex[tabId] ?? 0;
        if (index >= history.length - 1) return;
        const newIndex = index + 1;
        const url = history[newIndex];
        if (!url) return;
        set((s) => ({
          tabHistoryIndex: { ...s.tabHistoryIndex, [tabId]: newIndex },
          tabs: s.tabs.map((t) => t.id === tabId ? { ...t, url, title: url } as BrowserTab : t),
          tabLoading: { ...s.tabLoading, [tabId]: true },
        }));
      },

      canGoBack: (tabId: string) => {
        return (get().tabHistoryIndex[tabId] ?? 0) > 0;
      },

      canGoForward: (tabId: string) => {
        const history = get().tabHistory[tabId] || [];
        const index = get().tabHistoryIndex[tabId] ?? 0;
        return index < history.length - 1;
      },

      setTabLoading: (tabId: string, loading: boolean) => {
        set((state) => ({
          tabLoading: { ...state.tabLoading, [tabId]: loading },
        }));
      },

      // Console
      toggleConsole: () => {
        set((state) => ({ consoleOpen: !state.consoleOpen }));
      },

      setConsoleHeight: (height: number) => {
        set({ consoleHeight: Math.max(100, Math.min(500, height)) });
      },

      // Chat Pane
      toggleChatPane: () => {
        set((state) => ({ chatPaneOpen: !state.chatPaneOpen }));
      },

      // Bulk Operations
      closeAllTabs: () => {
        set({ tabs: [], activeTabId: null });
      },

      closeOtherTabs: (keepId: string) => {
        set((state) => ({
          tabs: state.tabs.filter((t) => t.id === keepId).map((t) => ({ ...t, isActive: true })),
          activeTabId: keepId,
        }));
      },

      closeTabsToRight: (id: string) => {
        set((state) => {
          const idx = state.tabs.findIndex((t) => t.id === id);
          if (idx === -1) return state;
          const newTabs = state.tabs.slice(0, idx + 1);
          const newActiveId = newTabs.find((t) => t.id === state.activeTabId) ? state.activeTabId : id;
          return { tabs: newTabs, activeTabId: newActiveId };
        });
      },

      duplicateTab: (id: string) => {
        const tab = get().tabs.find((t) => t.id === id);
        if (!tab) return;

        let newTab: BrowserTab;
        switch (tab.contentType) {
          case 'web':
            newTab = createWebTab((tab as WebTab).url, tab.title);
            break;
          case 'a2ui':
            newTab = createA2UITab(
              (tab as A2UITab).payload,
              tab.title,
              (tab as A2UITab).source,
              (tab as A2UITab).isMockData
            );
            break;
          case 'miniapp':
            newTab = createMiniappTab(
              (tab as MiniappTab).manifest,
              (tab as MiniappTab).capsuleId,
              (tab as MiniappTab).entryPoint
            );
            break;
          case 'component':
            newTab = createComponentTab(
              (tab as ComponentTab).componentId,
              tab.title,
              (tab as ComponentTab).props
            );
            break;
          default:
            return;
        }

        set((state) => {
          const index = state.tabs.findIndex((t) => t.id === id);
          const newTabs = [...state.tabs];
          newTabs.splice(index + 1, 0, newTab);
          return { tabs: newTabs };
        });
      },

      // History
      addRecentVisit: (url: string, title: string) => {
        set((state) => {
          const filtered = state.recentVisits.filter((v) => v.url !== url);
          return {
            recentVisits: [
              { url, title, visitedAt: Date.now() },
              ...filtered,
            ].slice(0, MAX_RECENT_VISITS),
          };
        });
      },

      clearRecentVisits: () => {
        set({ recentVisits: [] });
      },

      // Utilities
      getActiveTab: () => {
        const { tabs, activeTabId } = get();
        return tabs.find((t) => t.id === activeTabId);
      },

      getTabById: (id: string) => {
        return get().tabs.find((t) => t.id === id);
      },

      getTabsByType: (type: BrowserContentType) => {
        return get().tabs.filter((t) => t.contentType === type);
      },
    }),
    { name: 'browser-store' }
  )
);

// ============================================================================
// Selector Hooks
// ============================================================================

export function useActiveTab(): BrowserTab | undefined {
  return useBrowserStore((state) => state.tabs.find((t) => t.id === state.activeTabId));
}

export function useTabCount(): number {
  return useBrowserStore((state) => state.tabs.length);
}

export function useRecentVisits(): RecentVisit[] {
  return useBrowserStore((state) => state.recentVisits);
}

export function useActiveTabType(): BrowserContentType | null {
  return useBrowserStore((state) => {
    const tab = state.tabs.find((t) => t.id === state.activeTabId);
    return tab?.contentType || null;
  });
}
