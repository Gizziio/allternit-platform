/**
 * allternit Super-Agent OS - Stores Index
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
  AllternitProgram as Program,
  AllternitProgramState as ProgramState,
} from '../types/programs';
