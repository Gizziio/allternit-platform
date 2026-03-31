/**
 * A2rchitect Super-Agent OS - Stores Index
 * 
 * Zustand stores for state management.
 */

export {
  useSidecarStore,
  type SidecarState,
  type SidecarActions,
} from './useSidecarStore';

// Re-export types from types module
export type {
  A2rProgram as Program,
  A2rProgramState as ProgramState,
} from '../types/programs';
