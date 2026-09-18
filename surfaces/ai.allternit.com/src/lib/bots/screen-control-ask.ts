/**
 * Ask-before-foreground computer control (OpenMaus system-prompt rule).
 * Background computer stays available. Foreground pane only opens after
 * Allow once / Always allow. Deny leaves Computer Cloud running.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createVersionedPersistOptions } from '@/lib/bots/versioned-persist';

export type ScreenControlDecision = 'allow-once' | 'always' | 'deny';

interface ScreenControlState {
  alwaysAllowByBot: Record<string, boolean>;
  isAlwaysAllowed: (botId: string) => boolean;
  rememberAlways: (botId: string) => void;
  forget: (botId: string) => void;
}

export const useScreenControlStore = create<ScreenControlState>()(
  persist(
    (set, get) => ({
      alwaysAllowByBot: {},
      isAlwaysAllowed: (botId) => get().alwaysAllowByBot[botId] === true,
      rememberAlways: (botId) =>
        set((state) => ({ alwaysAllowByBot: { ...state.alwaysAllowByBot, [botId]: true } })),
      forget: (botId) =>
        set((state) => {
          const alwaysAllowByBot = { ...state.alwaysAllowByBot };
          delete alwaysAllowByBot[botId];
          return { alwaysAllowByBot };
        }),
    }),
    {
      name: 'allternit-bot-screen-control',
      ...createVersionedPersistOptions<ScreenControlState>({
        schemaVersion: 1,
        migrations: { 0: (state) => state },
        partialize: (state) => ({ alwaysAllowByBot: state.alwaysAllowByBot }),
      }),
    },
  ),
);
