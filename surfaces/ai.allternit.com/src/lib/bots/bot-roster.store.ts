/**
 * Bot Roster Store
 *
 * Minimal UI state for the bot roster: selection, search, sort, and
 * context-menu targeting, plus the canonical bot↔chat id map used by
 * bot session startup. The BotRoster view that consumed the UI state was
 * removed; the store is retained for the canonical-chat mapping.
 *
 * @module bot-roster.store
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createVersionedPersistOptions } from '@/lib/bots/versioned-persist';

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
  /** Pinned bot ids (user-specific roster layout preference). */
  pinnedBotIds: string[];
  /** Hidden bot ids (user-specific roster layout preference). */
  hiddenBotIds: string[];
  /** Whether the roster is rendered as a compact avatar rail. */
  isCompact: boolean;

  selectBot: (botId: string | null) => void;
  setSearch: (query: string) => void;
  setSort: (sortBy: BotRosterSortBy) => void;
  showContextMenu: (target: BotRosterContextMenuTarget) => void;
  hideContextMenu: () => void;
  setCanonicalChatId: (botId: string, sessionId: string | null) => void;
  pinBot: (botId: string) => void;
  unpinBot: (botId: string) => void;
  togglePin: (botId: string) => void;
  hideBot: (botId: string) => void;
  unhideBot: (botId: string) => void;
  toggleHide: (botId: string) => void;
  setCompact: (isCompact: boolean) => void;
  toggleCompact: () => void;
  hydrateLayout: (pinnedBotIds: string[], hiddenBotIds: string[]) => void;
}

function toggleInList(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

export const useBotRosterStore = create<BotRosterState>()(
  persist(
    (set) => ({
      selectedBotId: null,
      searchQuery: '',
      sortBy: 'name',
      contextMenuTarget: null,
      canonicalChatIds: {},
      pinnedBotIds: [],
      hiddenBotIds: [],
      isCompact: false,

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
      pinBot: (botId) =>
        set((state) => ({
          pinnedBotIds: state.pinnedBotIds.includes(botId)
            ? state.pinnedBotIds
            : [...state.pinnedBotIds, botId],
          hiddenBotIds: state.hiddenBotIds.filter((id) => id !== botId),
        })),
      unpinBot: (botId) =>
        set((state) => ({
          pinnedBotIds: state.pinnedBotIds.filter((id) => id !== botId),
        })),
      togglePin: (botId) =>
        set((state) => ({
          pinnedBotIds: toggleInList(state.pinnedBotIds, botId),
          hiddenBotIds: state.hiddenBotIds.filter((id) => id !== botId),
        })),
      hideBot: (botId) =>
        set((state) => ({
          hiddenBotIds: state.hiddenBotIds.includes(botId)
            ? state.hiddenBotIds
            : [...state.hiddenBotIds, botId],
          pinnedBotIds: state.pinnedBotIds.filter((id) => id !== botId),
        })),
      unhideBot: (botId) =>
        set((state) => ({
          hiddenBotIds: state.hiddenBotIds.filter((id) => id !== botId),
        })),
      toggleHide: (botId) =>
        set((state) => ({
          hiddenBotIds: toggleInList(state.hiddenBotIds, botId),
          pinnedBotIds: state.pinnedBotIds.filter((id) => id !== botId),
        })),
      setCompact: (isCompact) => set({ isCompact }),
      toggleCompact: () => set((state) => ({ isCompact: !state.isCompact })),
      hydrateLayout: (pinnedBotIds, hiddenBotIds) => set({ pinnedBotIds, hiddenBotIds }),
    }),
    {
      name: 'allternit-bot-roster',
      // schemaVersion 1: identity migration only (future-proofing per the
      // Hermes BotMeta v1→v2 migration discipline).
      ...createVersionedPersistOptions<BotRosterState>({
        schemaVersion: 1,
        migrations: { 0: (state) => state },
        partialize: (state) => ({
          selectedBotId: state.selectedBotId,
          canonicalChatIds: state.canonicalChatIds,
          pinnedBotIds: state.pinnedBotIds,
          hiddenBotIds: state.hiddenBotIds,
          isCompact: state.isCompact,
        }),
      }),
    },
  ),
);
