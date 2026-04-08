// ============================================================================
// Browser Shortcuts Store — persisted customizable shortcut widgets
// ============================================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface BrowserShortcut {
  id: string;
  label: string;
  url: string;
  icon?: string; // emoji
  favicon?: string; // fetched favicon URL (cached)
}

interface BrowserShortcutsStore {
  shortcuts: BrowserShortcut[];
  addShortcut: (s: Omit<BrowserShortcut, 'id'>) => void;
  removeShortcut: (id: string) => void;
  updateShortcut: (id: string, updates: Partial<BrowserShortcut>) => void;
  reorderShortcuts: (fromIndex: number, toIndex: number) => void;
}

const DEFAULT_SHORTCUTS: BrowserShortcut[] = [
  { id: 'default-google', label: 'Google', url: 'https://www.google.com', icon: '🔍' },
  { id: 'default-github', label: 'GitHub', url: 'https://github.com', icon: '🐙' },
  { id: 'default-hn', label: 'Hacker News', url: 'https://news.ycombinator.com', icon: '📰' },
];

/** Get favicon URL for a given site URL via Google's favicon service */
export function getFaviconUrl(siteUrl: string, size: number = 32): string {
  try {
    const domain = new URL(siteUrl).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`;
  } catch {
    return '';
  }
}

export const useBrowserShortcutsStore = create<BrowserShortcutsStore>()(
  persist(
    (set) => ({
      shortcuts: DEFAULT_SHORTCUTS,

      addShortcut: (s) =>
        set((state) => ({
          shortcuts: [
            ...state.shortcuts,
            { ...s, id: `shortcut-${Date.now()}-${Math.random().toString(36).substr(2, 6)}` },
          ],
        })),

      removeShortcut: (id) =>
        set((state) => ({
          shortcuts: state.shortcuts.filter((s) => s.id !== id),
        })),

      updateShortcut: (id, updates) =>
        set((state) => ({
          shortcuts: state.shortcuts.map((s) =>
            s.id === id ? { ...s, ...updates } : s
          ),
        })),

      reorderShortcuts: (fromIndex, toIndex) =>
        set((state) => {
          const next = [...state.shortcuts];
          const [moved] = next.splice(fromIndex, 1);
          next.splice(toIndex, 0, moved);
          return { shortcuts: next };
        }),
    }),
    { name: 'allternit.browser.shortcuts' }
  )
);
