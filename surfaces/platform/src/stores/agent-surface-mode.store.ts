import { create } from 'zustand';

export type AgentModeSurface = 'chat' | 'cowork' | 'code' | 'browser';
export type AgentModeId = 
  // Core content modes (universal)
  | 'research' | 'data' | 'slides' | 'code' | 'assets' | 'agents' | 'flow' | 'web'
  // Cowork-specific modes
  | 'plan' | 'execute' | 'review' | 'report' | 'automate' | 'sync';

type SurfaceStateMap = Record<AgentModeSurface, boolean>;
type SurfacePulseMap = Record<AgentModeSurface, number>;
type SurfaceAgentMap = Record<AgentModeSurface, string | null>;
type SurfaceModeMap = Record<AgentModeSurface, AgentModeId | null>;

interface AgentSurfaceModeState {
  enabledBySurface: SurfaceStateMap;
  pulseBySurface: SurfacePulseMap;
  selectedAgentIdBySurface: SurfaceAgentMap;
  selectedModeBySurface: SurfaceModeMap;
  lastActiveSurface: AgentModeSurface | null;
  setEnabled: (surface: AgentModeSurface, enabled: boolean) => void;
  setSelectedAgent: (surface: AgentModeSurface, agentId: string | null) => void;
  setSelectedMode: (surface: AgentModeSurface, modeId: AgentModeId | null) => void;
  toggle: (surface: AgentModeSurface) => void;
  /**
   * Call this when switching to a new surface. If agent mode was enabled
   * on the previous surface, it will be auto-enabled on the new surface.
   */
  syncEnabledToSurface: (surface: AgentModeSurface) => void;
}

const DEFAULT_ENABLED: SurfaceStateMap = {
  chat: false,
  cowork: false,
  code: false,
  browser: false,
};

const DEFAULT_PULSE: SurfacePulseMap = {
  chat: 0,
  cowork: 0,
  code: 0,
  browser: 0,
};

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

export const useAgentSurfaceModeStore = create<AgentSurfaceModeState>((set, get) => ({
  enabledBySurface: DEFAULT_ENABLED,
  pulseBySurface: DEFAULT_PULSE,
  selectedAgentIdBySurface: DEFAULT_SELECTED_AGENT,
  selectedModeBySurface: DEFAULT_SELECTED_MODE,
  lastActiveSurface: null,
  setEnabled: (surface, enabled) =>
    set((state) => ({
      enabledBySurface: {
        ...state.enabledBySurface,
        [surface]: enabled,
      },
      pulseBySurface: {
        ...state.pulseBySurface,
        [surface]: state.pulseBySurface[surface] + 1,
      },
      lastActiveSurface: surface,
    })),
  setSelectedAgent: (surface, agentId) =>
    set((state) => ({
      selectedAgentIdBySurface: {
        ...state.selectedAgentIdBySurface,
        [surface]: agentId,
      },
    })),
  setSelectedMode: (surface, modeId) =>
    set((state) => ({
      selectedModeBySurface: {
        ...state.selectedModeBySurface,
        [surface]: modeId,
      },
    })),
  toggle: (surface) =>
    set((state) => ({
      enabledBySurface: {
        ...state.enabledBySurface,
        [surface]: !state.enabledBySurface[surface],
      },
      pulseBySurface: {
        ...state.pulseBySurface,
        [surface]: state.pulseBySurface[surface] + 1,
      },
      lastActiveSurface: surface,
    })),
  syncEnabledToSurface: (surface) => {
    const state = get();
    const lastSurface = state.lastActiveSurface;
    
    // If we have a last surface and it's different from current
    if (lastSurface && lastSurface !== surface) {
      // If agent was enabled on last surface, enable on this one too
      if (state.enabledBySurface[lastSurface] && !state.enabledBySurface[surface]) {
        set((s) => ({
          enabledBySurface: {
            ...s.enabledBySurface,
            [surface]: true,
          },
          pulseBySurface: {
            ...s.pulseBySurface,
            [surface]: s.pulseBySurface[surface] + 1,
          },
          lastActiveSurface: surface,
        }));
        return;
      }
    }
    
    // Just update last active surface
    set((s) => ({ ...s, lastActiveSurface: surface }));
  },
}));
