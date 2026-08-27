/**
 * Bot Roster Store
 *
 * Minimal UI state for the BotRoster sidebar: selection, search, sort, and
 * context-menu targeting. Persists only the selected bot id.
 *
 * @module bot-roster.store
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createBrowserJSONStorage } from '@/lib/zustand-browser-storage';

export type BotRosterSortBy = 'name' | 'lastActive' | 'status';

export interface BotRosterContextMenuTarget {
  botId: string;
  x: number;
  y: number;
}

export interface BotRosterState {
  selectedBotId: string | null;
  searchQuery: string;
  sortBy: BotRosterSortBy;
  contextMenuTarget: BotRosterContextMenuTarget | null;
  /** Canonical chat session id per bot id. */
  canonicalChatIds: Record<string, string>;

  selectBot: (botId: string | null) => void;
  setSearch: (query: string) => void;
  setSort: (sortBy: BotRosterSortBy) => void;
  showContextMenu: (target: BotRosterContextMenuTarget) => void;
  hideContextMenu: () => void;
  setCanonicalChatId: (botId: string, sessionId: string | null) => void;
}

export const useBotRosterStore = create<BotRosterState>()(
  persist(
    (set) => ({
      selectedBotId: null,
      searchQuery: '',
      sortBy: 'name',
      contextMenuTarget: null,
      canonicalChatIds: {},

      selectBot: (botId) => set({ selectedBotId: botId }),
      setSearch: (searchQuery) => set({ searchQuery }),
      setSort: (sortBy) => set({ sortBy }),
      showContextMenu: (contextMenuTarget) => set({ contextMenuTarget }),
      hideContextMenu: () => set({ contextMenuTarget: null }),
      setCanonicalChatId: (botId, sessionId) =>
        set((state) => ({
          canonicalChatIds: {
            ...state.canonicalChatIds,
            ...(sessionId ? { [botId]: sessionId } : {}),
          },
        })),
    }),
    {
      name: 'allternit-bot-roster',
      storage: createBrowserJSONStorage(),
      partialize: (state) => ({
        selectedBotId: state.selectedBotId,
        canonicalChatIds: state.canonicalChatIds,
      }),
    },
  ),
);
