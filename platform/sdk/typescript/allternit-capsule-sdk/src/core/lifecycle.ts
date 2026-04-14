/**
 * Lifecycle Module
 *
 * Universal lifecycle phases for all capsules.
 * The SDK guarantees state truth - A2UI/AG-UI decides how to render it.
 */

import { CapsuleId, SpaceId } from './ids.js';

// ============================================================================
// Phase Types
// ============================================================================

export type CapsulePhase =
  | 'init'
  | 'connecting'
  | 'ready'
  | 'busy'
  | 'error'
  | 'suspended'
  | 'disposed';

// ============================================================================
// Error Types
// ============================================================================

export interface CapsuleError {
  code: string;
  message: string;
  retryable: boolean;
}

// ============================================================================
// Lifecycle State
// ============================================================================

export interface CapsuleLifecycleState {
  phase: CapsulePhase;
  statusText?: string;
  error?: CapsuleError;
}

// ============================================================================
// Lifecycle Controller (SDK-owned)
// ============================================================================

export interface CapsuleLifecycleController {
  getPhase(): CapsulePhase;
  getLifecycleState(): CapsuleLifecycleState;
  setPhase(phase: CapsulePhase, reason?: string): void;
  setStatusText(text: string): void;
  setError(error: CapsuleError): void;
  clearError(): void;
}

// ============================================================================
// Lifecycle Events
// ============================================================================

export interface LifecycleChangeEvent {
  phase: CapsulePhase;
  previousPhase?: CapsulePhase;
  reason?: string;
  timestamp: number;
}

export interface LifecycleEventPayload {
  capsuleId: CapsuleId;
  spaceId: SpaceId;
  lifecycle: LifecycleChangeEvent;
}

// ============================================================================
// Phase Transition Map (for validation)
// ============================================================================

const VALID_TRANSITIONS: Record<CapsulePhase, CapsulePhase[]> = {
  init: ['connecting', 'ready', 'error', 'disposed'],
  connecting: ['ready', 'error', 'disposed'],
  ready: ['busy', 'error', 'suspended', 'disposed'],
  busy: ['ready', 'error', 'suspended', 'disposed'],
  error: ['connecting', 'ready', 'disposed'],
  suspended: ['ready', 'busy', 'disposed'],
  disposed: [],
};

/**
 * Check if a phase transition is valid
 */
export function isValidTransition(
  from: CapsulePhase,
  to: CapsulePhase
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Get valid next phases for a given phase
 */
export function getValidNextPhases(phase: CapsulePhase): CapsulePhase[] {
  return VALID_TRANSITIONS[phase] ?? [];
}

/**
 * Phase descriptions (for debugging/logging)
 */
export const PHASE_DESCRIPTIONS: Record<CapsulePhase, string> = {
  init: 'Capsule is initializing',
  connecting: 'Connecting to service or resource',
  ready: 'Ready for interaction',
  busy: 'Processing operation',
  error: 'Error state - requires attention',
  suspended: 'Paused - can be resumed',
  disposed: 'Cleaned up - no longer functional',
};

// ============================================================================
// Lifecycle Controller Implementation
// ============================================================================

export function createLifecycleController(
  capsuleId: CapsuleId,
  spaceId: SpaceId,
  onChange?: (state: CapsuleLifecycleState) => void
): CapsuleLifecycleController {
  let state: CapsuleLifecycleState = {
    phase: 'init',
    statusText: undefined,
    error: undefined,
  };

  const notifyChange = () => {
    onChange?.(state);
  };

  return {
    getPhase(): CapsulePhase {
      return state.phase;
    },

    getLifecycleState(): CapsuleLifecycleState {
      return { ...state };
    },

    setPhase(phase: CapsulePhase, reason?: string): void {
      const previousPhase = state.phase;

      if (previousPhase === phase) return;

      if (!isValidTransition(previousPhase, phase)) {
        console.warn(
          `[Lifecycle] Invalid transition from ${previousPhase} to ${phase} for capsule ${capsuleId}`
        );
        return;
      }

      state.phase = phase;
      state.statusText = reason;

      // Clear error when transitioning away from error
      if (phase !== 'error' && state.phase === 'error') {
        state.error = undefined;
      }

      notifyChange();
    },

    setStatusText(text: string): void {
      state.statusText = text;
      notifyChange();
    },

    setError(error: CapsuleError): void {
      state.phase = 'error';
      state.error = error;
      state.statusText = error.message;
      notifyChange();
    },

    clearError(): void {
      if (state.phase === 'error') {
        state.phase = 'ready';
        state.error = undefined;
        state.statusText = undefined;
        notifyChange();
      }
    },
  };
}
