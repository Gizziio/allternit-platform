import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AgentModeSurface = 'chat' | 'cowork' | 'code' | 'browser' | 'design';
export type AgentModeId =
  // Core content modes (universal)
  | 'research' | 'data' | 'slides' | 'code' | 'assets' | 'agents' | 'flow' | 'web' | 'computer-use'
  // Cowork-specific modes
  | 'plan' | 'execute' | 'review' | 'report' | 'automate' | 'sync'
  // Collaborative modes
  | 'team'
  // Additional modes
  | 'swarms' | 'website' | 'image' | 'video';

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
  design: null,
};

const DEFAULT_SELECTED_MODE: SurfaceModeMap = {
  chat: null,
  cowork: null,
  code: null,
  browser: null,
  design: null,
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
    }),
    {
      name: 'allternit-surface-mode-v1',
      partialize: (state) => ({
        currentSurface: state.currentSurface,
        selectedAgentIdBySurface: state.selectedAgentIdBySurface,
        selectedModeBySurface: state.selectedModeBySurface,
      }),
    },
  ),
);
