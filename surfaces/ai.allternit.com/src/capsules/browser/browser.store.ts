// ============================================================================
// Capsule/MiniApp Browser Store
// ============================================================================
// Enhanced browser store supporting multiple content types: web, a2ui, miniapp
// ============================================================================

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { createBrowserJSONStorage } from '@/lib/zustand-browser-storage';
import type {
  BrowserTab,
  BrowserContentType,
  WebTab,
  A2UITab,
  MiniappTab,
  ComponentTab,
  A2UIPayload,
  MiniappManifest,
  ProtocolParseResult,
  BrowserWorkspace,
  BrowserSplitView,
  BrowserSplitLayout,
  BrowserGlanceView,
} from './browser.types';

export const DEFAULT_BROWSER_WORKSPACE_ID = 'browser-workspace-default';
const DEFAULT_BROWSER_WORKSPACE: BrowserWorkspace = {
  id: DEFAULT_BROWSER_WORKSPACE_ID, name: 'Focus', icon: '◎', color: '#7c6df2', createdAt: 0,
};

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

  // Preserve about:blank and other about: URLs
  if (trimmed.toLowerCase().startsWith('about:')) {
    return { type: 'web', resource: trimmed };
  }

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
  source?: string
): A2UITab {
  return {
    id: `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title,
    isActive: false,
    contentType: 'a2ui',
    payload,
    source,
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

interface RecentVisit {
  url: string;
  title: string;
  visitedAt: number;
}

const MAX_RECENT_VISITS = 12;
export const BROWSER_CHAT_PANE_MIN_WIDTH = 320;
const BROWSER_CHAT_PANE_MAX_WIDTH = 520;
const BROWSER_CHAT_PANE_DEFAULT_WIDTH = 392;

function clampChatPaneWidth(width: number) {
  return Math.max(BROWSER_CHAT_PANE_MIN_WIDTH, Math.min(BROWSER_CHAT_PANE_MAX_WIDTH, Math.round(width)));
}

interface BrowserStore {
  // State
  tabs: BrowserTab[];
  activeTabId: string | null;
  consoleOpen: boolean;
  consoleHeight: number;
  chatPaneOpen: boolean;
  chatPaneWidth: number;
  recentVisits: RecentVisit[];
  workspaces: BrowserWorkspace[];
  activeWorkspaceId: string;
  compactMode: boolean;
  verticalTabs: boolean;
  tabSidebarCollapsed: boolean;
  splitViews: Record<string, BrowserSplitView>;
  glanceViews: Record<string, BrowserGlanceView>;
  // Per-tab navigation history: tabId -> array of URLs
  tabHistory: Record<string, string[]>;
  tabHistoryIndex: Record<string, number>;
  // Per-tab loading state
  tabLoading: Record<string, boolean>;

  // Tab Management
  addTab: (input: string, title?: string) => string;
  addCustomTab: (tab: BrowserTab) => string;
  addA2UITab: (payload: A2UIPayload, title?: string, source?: string) => string;
  addMiniappTab: (manifest: MiniappManifest, capsuleId: string, entryPoint?: string) => string;
  addComponentTab: (componentId: string, title?: string, props?: Record<string, unknown>) => string;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTab: (id: string, updates: Partial<BrowserTab>) => void;
  addWorkspace: (name?: string) => string;
  updateWorkspace: (id: string, updates: Partial<Pick<BrowserWorkspace, 'name' | 'icon' | 'color' | 'agentId' | 'skillIds' | 'miniappIds' | 'extensionIds' | 'defaultUrl'>>) => void;
  duplicateWorkspace: (id: string) => string | null;
  reorderWorkspace: (id: string, direction: -1 | 1) => void;
  removeWorkspace: (id: string) => void;
  setActiveWorkspace: (id: string) => void;
  moveTabToWorkspace: (tabId: string, workspaceId: string) => void;
  toggleEssential: (tabId: string) => void;
  toggleCompactMode: () => void;
  toggleVerticalTabs: () => void;
  toggleTabSidebar: () => void;
  addTabToSplit: (tabId: string) => void;
  removeTabFromSplit: (tabId: string) => void;
  setSplitLayout: (layout: BrowserSplitLayout) => void;
  closeSplitView: () => void;
  openGlance: (url: string, title?: string, sourceTabId?: string) => void;
  closeGlance: () => void;
  expandGlance: () => string | null;
  splitGlance: () => string | null;

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
  setChatPaneWidth: (width: number) => void;

  // Bulk Operations
  closeAllTabs: () => void;
  closeOtherTabs: (keepId: string) => void;
  closeTabsToRight: (id: string) => void;
  duplicateTab: (id: string) => void;

  // Pin & Reorder
  pinTab: (id: string) => void;
  unpinTab: (id: string) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;

  // Tab Groups
  setTabGroup: (id: string, group: string | undefined, groupColor?: string) => void;
  removeTabFromGroup: (id: string) => void;

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

export const useBrowserStore = create<BrowserStore>()(
  devtools(persist(
    (set, get) => ({
      // Initial State
      tabs: [],
      activeTabId: null,
      consoleOpen: false,
      consoleHeight: 200,
      chatPaneOpen: true,
      chatPaneWidth: BROWSER_CHAT_PANE_DEFAULT_WIDTH,
      recentVisits: [],
      workspaces: [DEFAULT_BROWSER_WORKSPACE],
      activeWorkspaceId: DEFAULT_BROWSER_WORKSPACE_ID,
      compactMode: false,
      verticalTabs: true,
      tabSidebarCollapsed: false,
      splitViews: {},
      glanceViews: {},
      tabHistory: {},
      tabHistoryIndex: {},
      tabLoading: {},

      // Tab Management
      addTab: (input: string, title?: string) => {
        const newTab = { ...createWebTab(input, title), workspaceId: get().activeWorkspaceId };
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
        tab = { ...tab, workspaceId: tab.workspaceId || get().activeWorkspaceId };
        set((state) => ({
          tabs: [...state.tabs.map((t) => ({ ...t, isActive: false })), { ...tab, isActive: true }],
          activeTabId: tab.id,
        }));
        return tab.id;
      },

      addA2UITab: (payload: A2UIPayload, title?: string, source?: string) => {
        const newTab = { ...createA2UITab(payload, title, source), workspaceId: get().activeWorkspaceId };
        set((state) => ({
          tabs: [...state.tabs.map((t) => ({ ...t, isActive: false })), newTab],
          activeTabId: newTab.id,
        }));
        return newTab.id;
      },

      addMiniappTab: (manifest: MiniappManifest, capsuleId: string, entryPoint?: string) => {
        const newTab = { ...createMiniappTab(manifest, capsuleId, entryPoint), workspaceId: get().activeWorkspaceId };
        set((state) => ({
          tabs: [...state.tabs.map((t) => ({ ...t, isActive: false })), newTab],
          activeTabId: newTab.id,
        }));
        return newTab.id;
      },

      addComponentTab: (componentId: string, title?: string, props?: Record<string, unknown>) => {
        const newTab = { ...createComponentTab(componentId, title, props), workspaceId: get().activeWorkspaceId };
        set((state) => ({
          tabs: [...state.tabs.map((t) => ({ ...t, isActive: false })), newTab],
          activeTabId: newTab.id,
        }));
        return newTab.id;
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

          const splitViews = Object.fromEntries(Object.entries(state.splitViews).map(([workspaceId, split]) => [workspaceId, { ...split, tabIds: split.tabIds.filter((tabId) => tabId !== id) }]).filter(([, split]) => (split as BrowserSplitView).tabIds.length > 1));
          return { tabs: newTabs, activeTabId: newActiveId, splitViews };
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

      addWorkspace: (name = 'Workspace') => {
        const id = `browser-workspace-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const workspace: BrowserWorkspace = { id, name, icon: '◇', color: '#4f9cf9', createdAt: Date.now() };
        set((state) => ({ workspaces: [...state.workspaces, workspace], activeWorkspaceId: id, tabs: state.tabs.map((tab) => ({ ...tab, isActive: false })), activeTabId: null }));
        return id;
      },
      updateWorkspace: (id, updates) => set((state) => ({ workspaces: state.workspaces.map((workspace) => workspace.id === id ? { ...workspace, ...updates } : workspace) })),
      duplicateWorkspace: (id) => {
        const source = get().workspaces.find((workspace) => workspace.id === id);
        if (!source) return null;
        const duplicateId = `browser-workspace-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const duplicate: BrowserWorkspace = { ...source, id: duplicateId, name: `${source.name} Copy`, createdAt: Date.now() };
        set((state) => ({ workspaces: [...state.workspaces, duplicate], activeWorkspaceId: duplicateId, activeTabId: null, tabs: state.tabs.map((tab) => ({ ...tab, isActive: false })) }));
        return duplicateId;
      },
      reorderWorkspace: (id, direction) => set((state) => {
        const index = state.workspaces.findIndex((workspace) => workspace.id === id);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= state.workspaces.length) return state;
        const workspaces = [...state.workspaces];
        [workspaces[index], workspaces[target]] = [workspaces[target], workspaces[index]];
        return { workspaces };
      }),
      removeWorkspace: (id) => set((state) => {
        if (state.workspaces.length === 1) return state;
        const workspaces = state.workspaces.filter((workspace) => workspace.id !== id);
        const activeWorkspaceId = state.activeWorkspaceId === id ? workspaces[0].id : state.activeWorkspaceId;
        const tabs = state.tabs.map((tab) => tab.workspaceId === id ? { ...tab, workspaceId: activeWorkspaceId, isActive: false } : tab);
        return { workspaces, activeWorkspaceId, tabs, activeTabId: null };
      }),
      setActiveWorkspace: (id) => set((state) => {
        const workspace = state.workspaces.find((item) => item.id === id);
        if (!workspace) return state;
        let candidate = state.tabs.find((tab) => tab.workspaceId === id || tab.essential);
        let tabs = state.tabs;
        if (!candidate && workspace.defaultUrl) {
          candidate = { ...createWebTab(workspace.defaultUrl), workspaceId: id, isActive: true };
          tabs = [...tabs, candidate];
        }
        return { activeWorkspaceId: id, activeTabId: candidate?.id ?? null, tabs: tabs.map((tab) => ({ ...tab, isActive: tab.id === candidate?.id })) };
      }),
      moveTabToWorkspace: (tabId, workspaceId) => set((state) => ({ tabs: state.tabs.map((tab) => tab.id === tabId ? { ...tab, workspaceId, essential: false } : tab) })),
      toggleEssential: (tabId) => set((state) => ({ tabs: state.tabs.map((tab) => tab.id === tabId ? { ...tab, essential: !tab.essential } : tab) })),
      toggleCompactMode: () => set((state) => ({ compactMode: !state.compactMode })),
      toggleVerticalTabs: () => set((state) => ({ verticalTabs: !state.verticalTabs })),
      toggleTabSidebar: () => set((state) => ({ tabSidebarCollapsed: !state.tabSidebarCollapsed })),
      addTabToSplit: (tabId) => set((state) => {
        const tab = state.tabs.find((item) => item.id === tabId);
        if (!tab || (!tab.essential && tab.workspaceId !== state.activeWorkspaceId)) return state;
        const existing = state.splitViews[state.activeWorkspaceId];
        const seed = existing?.tabIds.length ? existing.tabIds : (state.activeTabId ? [state.activeTabId] : []);
        const tabIds = Array.from(new Set([...seed, tabId])).slice(0, 4);
        if (tabIds.length < 2) return state;
        return { splitViews: { ...state.splitViews, [state.activeWorkspaceId]: { workspaceId: state.activeWorkspaceId, tabIds, layout: existing?.layout || 'horizontal' } } };
      }),
      removeTabFromSplit: (tabId) => set((state) => {
        const existing = state.splitViews[state.activeWorkspaceId];
        if (!existing) return state;
        const tabIds = existing.tabIds.filter((id) => id !== tabId);
        const splitViews = { ...state.splitViews };
        if (tabIds.length < 2) delete splitViews[state.activeWorkspaceId];
        else splitViews[state.activeWorkspaceId] = { ...existing, tabIds };
        return { splitViews };
      }),
      setSplitLayout: (layout) => set((state) => {
        const existing = state.splitViews[state.activeWorkspaceId];
        return existing ? { splitViews: { ...state.splitViews, [state.activeWorkspaceId]: { ...existing, layout } } } : state;
      }),
      closeSplitView: () => set((state) => {
        const splitViews = { ...state.splitViews };
        delete splitViews[state.activeWorkspaceId];
        return { splitViews };
      }),
      openGlance: (url, title = url, sourceTabId) => set((state) => ({ glanceViews: { ...state.glanceViews, [state.activeWorkspaceId]: { workspaceId: state.activeWorkspaceId, url: parseBrowserInput(url).resource, title, sourceTabId } } })),
      closeGlance: () => set((state) => {
        const glanceViews = { ...state.glanceViews };
        delete glanceViews[state.activeWorkspaceId];
        return { glanceViews };
      }),
      expandGlance: () => {
        const glance = get().glanceViews[get().activeWorkspaceId];
        if (!glance) return null;
        const tabId = get().addTab(glance.url, glance.title);
        get().closeGlance();
        return tabId;
      },
      splitGlance: () => {
        const glance = get().glanceViews[get().activeWorkspaceId];
        if (!glance) return null;
        const sourceTabId = glance.sourceTabId || get().activeTabId;
        const tabId = get().addTab(glance.url, glance.title);
        if (sourceTabId) get().setActiveTab(sourceTabId);
        get().addTabToSplit(tabId);
        get().closeGlance();
        return tabId;
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

      setChatPaneWidth: (width: number) => {
        set({ chatPaneWidth: clampChatPaneWidth(width) });
      },

      // Bulk Operations
      closeAllTabs: () => {
        set({ tabs: [], activeTabId: null, splitViews: {} });
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

      pinTab: (id: string) => {
        set((state) => ({
          tabs: state.tabs.map((t) => t.id === id ? { ...t, pinned: true } as BrowserTab : t),
        }));
      },

      unpinTab: (id: string) => {
        set((state) => ({
          tabs: state.tabs.map((t) => t.id === id ? { ...t, pinned: false } as BrowserTab : t),
        }));
      },

      reorderTabs: (fromIndex: number, toIndex: number) => {
        set((state) => {
          const newTabs = [...state.tabs];
          const [moved] = newTabs.splice(fromIndex, 1);
          newTabs.splice(toIndex, 0, moved);
          return { tabs: newTabs };
        });
      },

      setTabGroup: (id: string, group: string | undefined, groupColor?: string) => {
        set((state) => ({
          tabs: state.tabs.map((t) => t.id === id ? { ...t, group: group ?? undefined, groupColor: group ? (groupColor || t.groupColor) : undefined } as BrowserTab : t),
        }));
      },

      removeTabFromGroup: (id: string) => {
        set((state) => ({
          tabs: state.tabs.map((t) => t.id === id ? { ...t, group: undefined, groupColor: undefined } as BrowserTab : t),
        }));
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
              (tab as A2UITab).source
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
        newTab = { ...newTab, workspaceId: tab.workspaceId || get().activeWorkspaceId, essential: tab.essential };

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
    }), {
      name: 'allternit-browser-session', version: 1,
      storage: createBrowserJSONStorage(),
      partialize: (state) => ({ tabs: state.tabs, activeTabId: state.activeTabId, workspaces: state.workspaces, activeWorkspaceId: state.activeWorkspaceId, compactMode: state.compactMode, verticalTabs: state.verticalTabs, tabSidebarCollapsed: state.tabSidebarCollapsed, splitViews: state.splitViews, tabHistory: state.tabHistory, tabHistoryIndex: state.tabHistoryIndex, recentVisits: state.recentVisits, chatPaneOpen: state.chatPaneOpen, chatPaneWidth: state.chatPaneWidth }),
      merge: (persisted, current) => {
        const saved = (persisted || {}) as Partial<BrowserStore>;
        const workspaces = saved.workspaces?.length ? saved.workspaces : [DEFAULT_BROWSER_WORKSPACE];
        const activeWorkspaceId = workspaces.some((workspace) => workspace.id === saved.activeWorkspaceId) ? saved.activeWorkspaceId! : workspaces[0].id;
        const tabs = (saved.tabs || current.tabs).map((tab) => ({ ...tab, workspaceId: tab.workspaceId || activeWorkspaceId }));
        const splitViews = Object.fromEntries(Object.entries(saved.splitViews || {}).map(([id, split]) => [id, { ...split, tabIds: split.tabIds.filter((tabId) => tabs.some((tab) => tab.id === tabId)).slice(0, 4) }]).filter(([, split]) => (split as BrowserSplitView).tabIds.length > 1));
        return { ...current, ...saved, workspaces, activeWorkspaceId, tabs, splitViews };
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

function useRecentVisits(): RecentVisit[] {
  return useBrowserStore((state) => state.recentVisits);
}

export function useActiveTabType(): BrowserContentType | null {
  return useBrowserStore((state) => {
    const tab = state.tabs.find((t) => t.id === state.activeTabId);
    return tab?.contentType || null;
  });
}
