import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface RailPreferencesState {
  pinnedSessionIds: string[];
  pinnedAgentIds: string[];
  togglePinnedSession: (sessionId: string) => void;
  togglePinnedAgent: (agentId: string) => void;
}

function toggleId(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((entry) => entry !== id) : [id, ...list];
}

export const useRailPreferencesStore = create<RailPreferencesState>()(
  persist(
    (set) => ({
      pinnedSessionIds: [],
      pinnedAgentIds: [],
      togglePinnedSession: (sessionId) =>
        set((state) => ({
          pinnedSessionIds: toggleId(state.pinnedSessionIds, sessionId),
        })),
      togglePinnedAgent: (agentId) =>
        set((state) => ({
          pinnedAgentIds: toggleId(state.pinnedAgentIds, agentId),
        })),
    }),
    {
      name: 'allternit-rail-preferences-v1',
      partialize: (state) => ({
        pinnedSessionIds: state.pinnedSessionIds,
        pinnedAgentIds: state.pinnedAgentIds,
      }),
    },
  ),
);
