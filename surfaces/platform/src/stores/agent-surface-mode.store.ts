import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  buildAgentSessionUiMetadata,
  getAgentSessionUiDescriptor,
} from '@/lib/agents/session-metadata';
import { useNativeAgentStore } from '@/lib/agents/native-agent.store';

export type AgentModeSurface = 'chat' | 'cowork' | 'code' | 'browser';
export type AgentModeId =
  // Core content modes (universal)
  | 'research' | 'data' | 'slides' | 'code' | 'assets' | 'agents' | 'flow' | 'web' | 'computer-use'
  // Cowork-specific modes
  | 'plan' | 'execute' | 'review' | 'report' | 'automate' | 'sync';

type SurfaceAgentMap = Record<AgentModeSurface, string | null>;
type SurfaceModeMap = Record<AgentModeSurface, AgentModeId | null>;

interface AgentSurfaceModeState {
  currentSurface: AgentModeSurface;  // Currently active surface
  selectedAgentIdBySurface: SurfaceAgentMap;
  selectedModeBySurface: SurfaceModeMap;
  lastActiveSurface: AgentModeSurface | null;
  setCurrentSurface: (surface: AgentModeSurface) => void;
  setSelectedAgent: (surface: AgentModeSurface, agentId: string | null) => void;
  setSelectedMode: (surface: AgentModeSurface, modeId: AgentModeId | null) => void;
}

const DEFAULT_SELECTED_AGENT: SurfaceAgentMap = {
  chat: null,
  cowork: null,
  code: null,
  browser: null,
};

const DEFAULT_SELECTED_MODE: SurfaceModeMap = {
  chat: null,
  cowork: null,
  code: null,
  browser: null,
};

export const useAgentSurfaceModeStore = create<AgentSurfaceModeState>()(
  persist(
    (set, get) => ({
      currentSurface: 'chat',  // Default surface
      selectedAgentIdBySurface: DEFAULT_SELECTED_AGENT,
      selectedModeBySurface: DEFAULT_SELECTED_MODE,
      lastActiveSurface: null,
      
      // Set current active surface
      setCurrentSurface: (surface) => {
        const nativeStore = useNativeAgentStore.getState();
        if (nativeStore.activeSessionId) {
          nativeStore.appendOptimisticEvent(nativeStore.activeSessionId, {
            id: `evt_surface_changed_${Date.now()}`,
            sessionId: nativeStore.activeSessionId,
            actor: 'ui',
            surface,
            type: 'ui.surface.changed',
            payload: { surface },
            createdAt: new Date().toISOString(),
            seq: 0,
          });
          const session = nativeStore.sessions.find((item) => item.id === nativeStore.activeSessionId);
          void nativeStore.updateSession(nativeStore.activeSessionId, {
            metadata: buildAgentSessionUiMetadata({
              metadata: session?.metadata ?? {},
              currentSurface: surface,
              selectedAgentIdBySurface: get().selectedAgentIdBySurface,
              selectedModeBySurface: get().selectedModeBySurface,
            }),
          });
        }
        set({ currentSurface: surface, lastActiveSurface: surface });
      },
      
      // Set agent for a surface
      setSelectedAgent: (surface, agentId) => {
        const nativeStore = useNativeAgentStore.getState();
        const nextSelectedAgentIdBySurface = {
          ...get().selectedAgentIdBySurface,
          [surface]: agentId,
        };
        if (nativeStore.activeSessionId) {
          nativeStore.appendOptimisticEvent(nativeStore.activeSessionId, {
            id: `evt_agent_profile_${surface}_${Date.now()}`,
            sessionId: nativeStore.activeSessionId,
            actor: 'ui',
            surface,
            type: 'agent.profile.selected',
            payload: { agentId, scope: 'surface' },
            createdAt: new Date().toISOString(),
            seq: 0,
          });
          const session = nativeStore.sessions.find((item) => item.id === nativeStore.activeSessionId);
          void nativeStore.updateSession(nativeStore.activeSessionId, {
            metadata: buildAgentSessionUiMetadata({
              metadata: session?.metadata ?? {},
              currentSurface: get().currentSurface,
              selectedAgentIdBySurface: nextSelectedAgentIdBySurface,
              selectedModeBySurface: get().selectedModeBySurface,
            }),
          });
        }
        set(() => ({
          selectedAgentIdBySurface: nextSelectedAgentIdBySurface,
          lastActiveSurface: surface,
        }));
      },
      
      // Set mode for a surface
      setSelectedMode: (surface, modeId) => {
        const nativeStore = useNativeAgentStore.getState();
        const nextSelectedModeBySurface = {
          ...get().selectedModeBySurface,
          [surface]: modeId,
        };
        if (nativeStore.activeSessionId) {
          nativeStore.appendOptimisticEvent(nativeStore.activeSessionId, {
            id: `evt_agent_mode_profile_${surface}_${Date.now()}`,
            sessionId: nativeStore.activeSessionId,
            actor: 'ui',
            surface,
            type: 'ui.view.changed',
            payload: { modeId, scope: 'surface' },
            createdAt: new Date().toISOString(),
            seq: 0,
          });
          const session = nativeStore.sessions.find((item) => item.id === nativeStore.activeSessionId);
          void nativeStore.updateSession(nativeStore.activeSessionId, {
            metadata: buildAgentSessionUiMetadata({
              metadata: session?.metadata ?? {},
              currentSurface: get().currentSurface,
              selectedAgentIdBySurface: get().selectedAgentIdBySurface,
              selectedModeBySurface: nextSelectedModeBySurface,
            }),
          });
        }
        set(() => ({
          selectedModeBySurface: nextSelectedModeBySurface,
        }));
      },
    }),
    {
      name: 'a2r-surface-mode-v1',
      partialize: (state) => ({
        currentSurface: state.currentSurface,
      }),
    },
  ),
);

useNativeAgentStore.subscribe((state) => {
  const activeSession = state.activeSessionId
    ? state.sessions.find((session) => session.id === state.activeSessionId)
    : null;
  const uiDescriptor = getAgentSessionUiDescriptor(activeSession?.metadata);

  useAgentSurfaceModeStore.setState((current) => {
    const nextCurrentSurface = uiDescriptor.currentSurface ?? current.currentSurface;
    const nextSelectedAgentIdBySurface = activeSession
      ? {
          ...DEFAULT_SELECTED_AGENT,
          ...(uiDescriptor.selectedAgentIdBySurface ?? {}),
        }
      : current.selectedAgentIdBySurface;
    const nextSelectedModeBySurface = activeSession
      ? {
          ...DEFAULT_SELECTED_MODE,
          ...(uiDescriptor.selectedModeBySurface ?? {}),
        }
      : current.selectedModeBySurface;

    const isUnchanged =
      current.currentSurface === nextCurrentSurface &&
      JSON.stringify(current.selectedAgentIdBySurface) ===
        JSON.stringify(nextSelectedAgentIdBySurface) &&
      JSON.stringify(current.selectedModeBySurface) ===
        JSON.stringify(nextSelectedModeBySurface);

    if (isUnchanged) {
      return current;
    }

    return {
      currentSurface: nextCurrentSurface,
      selectedAgentIdBySurface: nextSelectedAgentIdBySurface,
      selectedModeBySurface: nextSelectedModeBySurface,
    };
  });
});
