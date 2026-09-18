/**
 * Per-bot Allow matrix for connected apps (OpenMaus PluginsPanel).
 * Connecting an app does not hand it to a bot until that bot is Allowed.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createVersionedPersistOptions } from '@/lib/bots/versioned-persist';

interface BotPluginAllowState {
  allowedByBot: Record<string, boolean>;
  isAllowed: (botId: string) => boolean;
  setAllowed: (botId: string, allowed: boolean) => void;
}

export const useBotPluginAllowStore = create<BotPluginAllowState>()(
  persist(
    (set, get) => ({
      allowedByBot: {},
      isAllowed: (botId) => get().allowedByBot[botId] === true,
      setAllowed: (botId, allowed) =>
        set((state) => ({
          allowedByBot: { ...state.allowedByBot, [botId]: allowed },
        })),
    }),
    {
      name: 'allternit-bot-plugin-allow',
      ...createVersionedPersistOptions<BotPluginAllowState>({
        schemaVersion: 1,
        migrations: { 0: (state) => state },
        partialize: (state) => ({ allowedByBot: state.allowedByBot }),
      }),
    },
  ),
);
