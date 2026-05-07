/**
 * allternit Super-Agent OS - Sidecar Store
 * 
 * Central state management for the Utility Pane with streaming support.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type {
  AllternitProgram,
  AllternitProgramType,
  AllternitProgramState,
  LaunchProgramRequest,
  ProgramEvent,
  StreamingChunk,
  ResearchDocState,
} from '../types/programs';

// ============================================================================
// Store State Interface
// ============================================================================

export interface SidecarState {
  // Program registry
  programs: Record<string, AllternitProgram>;
  
  // Currently active program ID
  activeProgramId: string | null;
  
  // Program order for tab display
  programOrder: string[];
  
  // UI state
  isExpanded: boolean;
  width: number;
  minWidth: number;
  maxWidth: number;
  
  // Global sidecar status
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  
  // Event queue for IPC
  pendingEvents: ProgramEvent[];
  
  // Streaming state
  activeStreams: Record<string, boolean>;

  // Live agent text while a program is isGenerating — keyed by sourceThreadId (sessionId)
  liveAgentTexts: Record<string, string>;
}

// ============================================================================
// Store Actions Interface
// ============================================================================

export interface SidecarActions {
  // Program lifecycle
  launchProgram: <T extends AllternitProgramState>(request: LaunchProgramRequest<T>) => string;
  terminateProgram: (id: string) => boolean;
  activateProgram: (id: string) => boolean;
  suspendProgram: (id: string) => boolean;
  resumeProgram: (id: string) => boolean;
  
  // Program state management
  updateProgramState: <T extends AllternitProgramState>(id: string, updater: (state: T) => T) => boolean;
  setProgramState: <T extends AllternitProgramState>(id: string, state: T) => boolean;
  getProgramState: <T extends AllternitProgramState>(id: string) => T | null;
  
  // Streaming support
  startStream: (programId: string) => void;
  endStream: (programId: string) => void;
  appendStreamChunk: (programId: string, chunk: StreamingChunk) => void;
  isStreaming: (programId: string) => boolean;
  
  // Batch operations
  terminateAllPrograms: () => void;
  terminateProgramsByType: (type: AllternitProgramType) => void;
  terminateProgramsByThread: (threadId: string) => void;
  
  // Tab management
  reorderPrograms: (newOrder: string[]) => void;
  closeProgram: (id: string) => boolean;
  
  // UI controls
  toggleExpanded: () => void;
  setExpanded: (expanded: boolean) => void;
  setWidth: (width: number) => void;
  resetWidth: () => void;
  
  // Event system
  emitEvent: (event: Omit<ProgramEvent, 'timestamp'>) => void;
  clearEvents: () => void;
  
  // Utilities
  getActiveProgram: () => AllternitProgram | null;
  getProgramsByType: (type: AllternitProgramType) => AllternitProgram[];
  getProgramsByThread: (threadId: string) => AllternitProgram[];
  hasProgram: (id: string) => boolean;
  
  // Live agent text (pre-launch streaming preview)
  setLiveAgentText: (sessionId: string, text: string) => void;
  clearLiveAgentText: (sessionId: string) => void;

  // Persistence helpers
  exportState: () => string;
  importState: (json: string) => boolean;
  clearAll: () => void;
}

// ============================================================================
// Utility Functions
// ============================================================================

function generateProgramId(type: AllternitProgramType): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `${type}-${timestamp}-${random}`;
}

function createDefaultProgram<T extends AllternitProgramState>(
  request: LaunchProgramRequest<T>
): AllternitProgram {
  const now = Date.now();
  return {
    id: generateProgramId(request.type),
    type: request.type,
    title: request.title,
    status: request.launchOptions?.background ? 'background' : 'active',
    state: request.initialState ?? {},
    sourceThreadId: request.sourceThreadId,
    createdAt: now,
    updatedAt: now,
    icon: request.icon ?? getDefaultIcon(request.type),
    supportsBackground: true,
    zIndex: 0,
  };
}

function getDefaultIcon(type: AllternitProgramType): string {
  const icons: Record<AllternitProgramType, string> = {
    'research-doc': '📄',
    'data-grid': '📊',
    'presentation': '🎬',
    'code-preview': '💻',
    'asset-manager': '📁',
    'image-studio': '🎨',
    'audio-studio': '🎧',
    'telephony': '📞',
    'browser': '🌐',
    'orchestrator': '🧠',
    'workflow-builder': '🌊',
    'custom': '📦',
  };
  return icons[type] ?? '📦';
}

// ============================================================================
// Store Implementation
// ============================================================================

const DEFAULT_WIDTH = 480;
const MIN_WIDTH = 320;
const MAX_WIDTH = 900;

export const useSidecarStore = create<SidecarState & SidecarActions>()(
  immer(
    persist(
      (set, get) => ({
        // Initial state
        programs: {},
        activeProgramId: null,
        programOrder: [],
        isExpanded: true,
        width: DEFAULT_WIDTH,
        minWidth: MIN_WIDTH,
        maxWidth: MAX_WIDTH,
        status: 'idle',
        error: null,
        pendingEvents: [],
        activeStreams: {},
        liveAgentTexts: {},

        // -------------------------------------------------------------------
        // Program Lifecycle
        // -------------------------------------------------------------------

        launchProgram: <T extends AllternitProgramState>(request: LaunchProgramRequest<T>): string => {
          const program = createDefaultProgram(request);
          
          set(state => {
            if (request.launchOptions?.replaceExisting) {
              const existing = Object.values(state.programs).find(p => p.type === request.type);
              if (existing) {
                delete state.programs[existing.id];
                state.programOrder = state.programOrder.filter(id => id !== existing.id);
              }
            }

            state.programs[program.id] = program;
            state.programOrder.push(program.id);

            if (!request.launchOptions?.background) {
              state.activeProgramId = program.id;
            }

            state.status = 'ready';
          });

          get().emitEvent({
            type: 'program.launched',
            programId: program.id,
            payload: { type: request.type, title: request.title },
          });

          return program.id;
        },

        terminateProgram: (id: string): boolean => {
          const program = get().programs[id];
          if (!program) return false;

          set(state => {
            delete state.programs[id];
            state.programOrder = state.programOrder.filter(pid => pid !== id);

            if (state.activeProgramId === id) {
              state.activeProgramId = state.programOrder[state.programOrder.length - 1] ?? null;
            }
          });

          get().emitEvent({
            type: 'program.terminated',
            programId: id,
            payload: { type: program.type },
          });

          return true;
        },

        activateProgram: (id: string): boolean => {
          if (!get().programs[id]) return false;

          set(state => {
            state.activeProgramId = id;
            
            if (state.programs[id].status === 'suspended' || state.programs[id].status === 'background') {
              state.programs[id].status = 'active';
            }
            state.programs[id].updatedAt = Date.now();
          });

          get().emitEvent({
            type: 'program.activated',
            programId: id,
          });

          return true;
        },

        suspendProgram: (id: string): boolean => {
          if (!get().programs[id]) return false;

          set(state => {
            state.programs[id].status = 'suspended';
            state.programs[id].updatedAt = Date.now();
          });

          get().emitEvent({
            type: 'program.suspended',
            programId: id,
          });

          return true;
        },

        resumeProgram: (id: string): boolean => {
          if (!get().programs[id]) return false;

          set(state => {
            state.programs[id].status = 'active';
            state.programs[id].updatedAt = Date.now();
            state.activeProgramId = id;
          });

          get().emitEvent({
            type: 'program.resumed',
            programId: id,
          });

          return true;
        },

        // -------------------------------------------------------------------
        // Program State Management
        // -------------------------------------------------------------------

        updateProgramState: <T extends AllternitProgramState>(
          id: string,
          updater: (state: T) => T
        ): boolean => {
          if (!get().programs[id]) return false;

          set(state => {
            const currentState = state.programs[id].state as T;
            state.programs[id].state = updater(currentState);
            state.programs[id].updatedAt = Date.now();
          });

          get().emitEvent({
            type: 'program.state-changed',
            programId: id,
          });

          return true;
        },

        setProgramState: <T extends AllternitProgramState>(id: string, newState: T): boolean => {
          if (!get().programs[id]) return false;

          set(state => {
            state.programs[id].state = newState;
            state.programs[id].updatedAt = Date.now();
          });

          get().emitEvent({
            type: 'program.state-changed',
            programId: id,
          });

          return true;
        },

        getProgramState: <T extends AllternitProgramState>(id: string): T | null => {
          return (get().programs[id]?.state as T) ?? null;
        },

        // -------------------------------------------------------------------
        // Streaming Support
        // -------------------------------------------------------------------

        startStream: (programId: string) => {
          set(state => {
            state.activeStreams[programId] = true;
          });
        },

        endStream: (programId: string) => {
          set(state => {
            delete state.activeStreams[programId];
          });
        },

        appendStreamChunk: (programId: string, chunk: StreamingChunk) => {
          const program = get().programs[programId];
          if (!program) return;

          set(state => {
            const currentState = state.programs[programId].state as ResearchDocState;
            
            // Handle streaming content for research-doc type
            if (program.type === 'research-doc' && currentState) {
              if (!currentState.streamingContent) {
                currentState.streamingContent = {
                  currentSectionId: chunk.sectionId,
                  buffer: '',
                };
              }

              // If this is a new section, flush the previous one
              if (currentState.streamingContent.currentSectionId !== chunk.sectionId) {
                const section = currentState.sections.find(s => s.id === chunk.sectionId);
                if (section) {
                  section.content += currentState.streamingContent.buffer;
                }
                currentState.streamingContent = {
                  currentSectionId: chunk.sectionId,
                  buffer: chunk.content,
                };
              } else {
                currentState.streamingContent.buffer += chunk.content;
              }

              // If chunk is complete, flush to section
              if (chunk.isComplete) {
                const section = currentState.sections.find(s => s.id === chunk.sectionId);
                if (section) {
                  section.content += currentState.streamingContent.buffer;
                }
                currentState.streamingContent = {
                  currentSectionId: null,
                  buffer: '',
                };
              }

              state.programs[programId].updatedAt = Date.now();
            }
          });
        },

        isStreaming: (programId: string): boolean => {
          return !!get().activeStreams[programId];
        },

        // -------------------------------------------------------------------
        // Batch Operations
        // -------------------------------------------------------------------

        terminateAllPrograms: () => {
          const programIds = Object.keys(get().programs);
          
          set(state => {
            state.programs = {};
            state.programOrder = [];
            state.activeProgramId = null;
            state.activeStreams = {};
          });

          programIds.forEach(id => {
            get().emitEvent({
              type: 'program.terminated',
              programId: id,
            });
          });
        },

        terminateProgramsByType: (type: AllternitProgramType) => {
          const toTerminate = Object.values(get().programs)
            .filter(p => p.type === type)
            .map(p => p.id);

          toTerminate.forEach(id => get().terminateProgram(id));
        },

        terminateProgramsByThread: (threadId: string) => {
          const toTerminate = Object.values(get().programs)
            .filter(p => p.sourceThreadId === threadId)
            .map(p => p.id);

          toTerminate.forEach(id => get().terminateProgram(id));
        },

        // -------------------------------------------------------------------
        // Tab Management
        // -------------------------------------------------------------------

        reorderPrograms: (newOrder: string[]) => {
          set(state => {
            const validOrder = newOrder.filter(id => state.programs[id]);
            state.programOrder = validOrder;
          });
        },

        closeProgram: (id: string): boolean => {
          return get().terminateProgram(id);
        },

        // -------------------------------------------------------------------
        // UI Controls
        // -------------------------------------------------------------------

        toggleExpanded: () => {
          set(state => {
            state.isExpanded = !state.isExpanded;
          });
        },

        setExpanded: (expanded: boolean) => {
          set(state => {
            state.isExpanded = expanded;
          });
        },

        setWidth: (width: number) => {
          set(state => {
            state.width = Math.max(state.minWidth, Math.min(state.maxWidth, width));
          });
        },

        resetWidth: () => {
          set(state => {
            state.width = DEFAULT_WIDTH;
          });
        },

        // -------------------------------------------------------------------
        // Event System
        // -------------------------------------------------------------------

        emitEvent: (event: Omit<ProgramEvent, 'timestamp'>) => {
          set(state => {
            state.pendingEvents.push({
              ...event,
              timestamp: Date.now(),
            });
            
            if (state.pendingEvents.length > 100) {
              state.pendingEvents = state.pendingEvents.slice(-100);
            }
          });
        },

        clearEvents: () => {
          set(state => {
            state.pendingEvents = [];
          });
        },

        // -------------------------------------------------------------------
        // Utilities
        // -------------------------------------------------------------------

        getActiveProgram: (): AllternitProgram | null => {
          const { activeProgramId, programs } = get();
          return activeProgramId ? programs[activeProgramId] ?? null : null;
        },

        getProgramsByType: (type: AllternitProgramType): AllternitProgram[] => {
          return Object.values(get().programs).filter(p => p.type === type);
        },

        getProgramsByThread: (threadId: string): AllternitProgram[] => {
          return Object.values(get().programs).filter(p => p.sourceThreadId === threadId);
        },

        hasProgram: (id: string): boolean => {
          return id in get().programs;
        },

        // -------------------------------------------------------------------
        // Live Agent Text
        // -------------------------------------------------------------------

        setLiveAgentText: (sessionId: string, text: string) => {
          set(state => {
            state.liveAgentTexts[sessionId] = text;
          });
        },

        clearLiveAgentText: (sessionId: string) => {
          set(state => {
            delete state.liveAgentTexts[sessionId];
          });
        },

        // -------------------------------------------------------------------
        // Persistence Helpers
        // -------------------------------------------------------------------

        exportState: (): string => {
          const { programs, programOrder, isExpanded, width } = get();
          return JSON.stringify({ programs, programOrder, isExpanded, width });
        },

        importState: (json: string): boolean => {
          try {
            const data = JSON.parse(json);
            set(state => {
              if (data.programs) state.programs = data.programs;
              if (data.programOrder) state.programOrder = data.programOrder;
              if (typeof data.isExpanded === 'boolean') state.isExpanded = data.isExpanded;
              if (typeof data.width === 'number') state.width = data.width;
            });
            return true;
          } catch (err) {
            set(state => {
              state.error = 'Failed to import state: ' + (err as Error).message;
            });
            return false;
          }
        },

        clearAll: () => {
          set(state => {
            state.programs = {};
            state.programOrder = [];
            state.activeProgramId = null;
            state.pendingEvents = [];
            state.activeStreams = {};
            state.liveAgentTexts = {};
            state.status = 'idle';
            state.error = null;
          });
        },
      }),
      {
        name: 'allternit-sidecar-store',
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          programs: state.programs,
          programOrder: state.programOrder,
          isExpanded: state.isExpanded,
          width: state.width,
        }),
      }
    )
  )
);

// ============================================================================
// Selectors (for performance)
// ============================================================================

export const selectActiveProgram = (state: SidecarState & SidecarActions): AllternitProgram | null => {
  return state.activeProgramId ? state.programs[state.activeProgramId] ?? null : null;
};

export const selectProgramCount = (state: SidecarState & SidecarActions): number => {
  return state.programOrder.length;
};

export const selectHasPrograms = (state: SidecarState & SidecarActions): boolean => {
  return state.programOrder.length > 0;
};

export const selectProgramsByThread = (
  state: SidecarState & SidecarActions,
  threadId: string
): AllternitProgram[] => {
  return Object.values(state.programs).filter(p => p.sourceThreadId === threadId);
};

// ============================================================================
// React Hooks
// ============================================================================

export function useActiveProgram(): AllternitProgram | null {
  return useSidecarStore(selectActiveProgram);
}

export function useProgram(programId: string): AllternitProgram | null {
  return useSidecarStore(state => state.programs[programId] ?? null);
}

export function useProgramState<T extends AllternitProgramState>(programId: string): T | null {
  return useSidecarStore(state => (state.programs[programId]?.state as T) ?? null);
}

export function useAllPrograms(): AllternitProgram[] {
  return useSidecarStore(state => 
    state.programOrder.map(id => state.programs[id]).filter(Boolean)
  );
}

export default useSidecarStore;
