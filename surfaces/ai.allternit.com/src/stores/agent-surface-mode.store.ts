import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createBrowserJSONStorage } from '@/lib/zustand-browser-storage';

export type AgentModeSurface = 'chat' | 'cowork' | 'code' | 'browser' | 'design';
export type AgentModeId =
  // Core content modes (universal)
  | 'research' | 'data' | 'slides' | 'code' | 'assets' | 'agents' | 'flow' | 'web' | 'computer-use'
  // Cowork-specific modes
  | 'plan' | 'execute' | 'review' | 'report' | 'automate' | 'sync' | 'routines' | 'loops'
  // Collaborative modes
  | 'team'
  // Additional modes
  | 'swarms' | 'website' | 'docs' | 'image' | 'video';

// Nested sub-modes of the 'swarms' top-level mode — not top-level modes
// themselves, so they deliberately live outside the `AgentModeId` union.
export type SwarmSubModeId = 'specialist-team' | 'population-simulation';

type SurfaceAgentMap = Record<AgentModeSurface, string | null>;
type SurfaceModeMap = Record<AgentModeSurface, AgentModeId | null>;
type SurfaceSwarmSubModeMap = Record<AgentModeSurface, SwarmSubModeId>;

interface AgentSurfaceModeState {
  currentSurface: AgentModeSurface;  // Currently active surface
  selectedAgentIdBySurface: SurfaceAgentMap;
  selectedModeBySurface: SurfaceModeMap;
  swarmSubModeBySurface: SurfaceSwarmSubModeMap;
  lastActiveSurface: AgentModeSurface | null;
  setCurrentSurface: (surface: AgentModeSurface) => void;
  setSelectedAgent: (surface: AgentModeSurface, agentId: string | null) => void;
  setSelectedMode: (surface: AgentModeSurface, modeId: AgentModeId | null) => void;
  setSwarmSubMode: (surface: AgentModeSurface, subModeId: SwarmSubModeId) => void;
}

const DEFAULT_SELECTED_AGENT: SurfaceAgentMap = {
  chat: null,
  cowork: null,
  code: null,
  browser: null,
  design: null,
};

const DEFAULT_SELECTED_MODE: SurfaceModeMap = {
  chat: null,
  cowork: null,
  code: null,
  browser: null,
  design: null,
};

const DEFAULT_SWARM_SUB_MODE: SurfaceSwarmSubModeMap = {
  chat: 'specialist-team',
  cowork: 'specialist-team',
  code: 'specialist-team',
  browser: 'specialist-team',
  design: 'specialist-team',
};

export const useAgentSurfaceModeStore = create<AgentSurfaceModeState>()(
  persist(
    (set, get) => ({
      currentSurface: 'chat',  // Default surface
      selectedAgentIdBySurface: DEFAULT_SELECTED_AGENT,
      selectedModeBySurface: DEFAULT_SELECTED_MODE,
      swarmSubModeBySurface: DEFAULT_SWARM_SUB_MODE,
      lastActiveSurface: null,
      
      // Set current active surface
      setCurrentSurface: (surface) => {
        set({ currentSurface: surface, lastActiveSurface: surface });
      },
      
      // Set agent for a surface
      setSelectedAgent: (surface, agentId) => {
        const nextSelectedAgentIdBySurface = {
          ...get().selectedAgentIdBySurface,
          [surface]: agentId,
        };
        set(() => ({
          selectedAgentIdBySurface: nextSelectedAgentIdBySurface,
          lastActiveSurface: surface,
        }));
      },
      
      // Set mode for a surface
      setSelectedMode: (surface, modeId) => {
        const nextSelectedModeBySurface = {
          ...get().selectedModeBySurface,
          [surface]: modeId,
        };
        set(() => ({
          selectedModeBySurface: nextSelectedModeBySurface,
        }));
      },

      // Set the active swarms sub-mode (Specialist Team / Population Simulation) for a surface
      setSwarmSubMode: (surface, subModeId) => {
        const nextSwarmSubModeBySurface = {
          ...get().swarmSubModeBySurface,
          [surface]: subModeId,
        };
        set(() => ({
          swarmSubModeBySurface: nextSwarmSubModeBySurface,
        }));
      },
    }),
    {
      name: 'allternit-surface-mode-v1',
      storage: createBrowserJSONStorage(),
      partialize: (state) => ({
        currentSurface: state.currentSurface,
        selectedAgentIdBySurface: state.selectedAgentIdBySurface,
        selectedModeBySurface: state.selectedModeBySurface,
        swarmSubModeBySurface: state.swarmSubModeBySurface,
      }),
    },
  ),
);
