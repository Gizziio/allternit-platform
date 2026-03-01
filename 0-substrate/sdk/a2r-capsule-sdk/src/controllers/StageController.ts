/**
 * Stage Controller
 *
 * Manages the Stage state for a space.
 * Enforces anti-sprawl: exactly one stage per space.
 */

import type { SpaceId, CapsuleId, TabId } from '../core/ids.js';
import type { StagePreset } from '../core/index.js';
import {
  createEventBus,
  EVENT_STAGE_CHANGED,
  EVENT_PRESENTATION_CHANGED,
  createEvent,
} from '../core/index.js';

// ============================================================================
// Stage State
// ============================================================================

export interface StageState {
  active: boolean;
  spaceId: SpaceId;
  capsuleId?: CapsuleId;
  tabId?: TabId;
  preset: StagePreset;
}

// ============================================================================
// Stage Controller Interface
// ============================================================================

export interface StageController {
  get(): StageState;
  enter(args: { capsuleId: CapsuleId; tabId?: TabId; preset?: StagePreset }): void;
  exit(): void;
  setPreset(preset: StagePreset): void;
}

// ============================================================================
// Valid Presets
// ============================================================================

const VALID_PRESETS: StagePreset[] = [0.5, 0.7, 1.0];

function isValidPreset(value: number): value is StagePreset {
  return VALID_PRESETS.includes(value as StagePreset);
}

// ============================================================================
// Stage Controller Implementation
// ============================================================================

export function createStageController(
  spaceId: SpaceId,
  eventBus?: ReturnType<typeof createEventBus>
): StageController {
  const bus = eventBus || createEventBus(spaceId);

  let state: StageState = {
    active: false,
    spaceId,
    capsuleId: undefined,
    tabId: undefined,
    preset: 0.7,
  };

  const emitChange = (reason?: string) => {
    bus.emit(
      createEvent(EVENT_STAGE_CHANGED, { ...state, reason }, { spaceId })
    );
  };

  const emitPresentationChanged = (presentation: 'capsule' | 'stage') => {
    bus.emit(
      createEvent(
        EVENT_PRESENTATION_CHANGED,
        { presentation },
        { spaceId, capsuleId: state.capsuleId }
      )
    );
  };

  return {
    get(): StageState {
      return { ...state };
    },

    enter(args: { capsuleId: CapsuleId; tabId?: TabId; preset?: StagePreset }): void {
      const { capsuleId, tabId, preset = 0.7 } = args;

      // Validate preset
      if (!isValidPreset(preset)) {
        console.warn(`[StageController] Invalid preset ${preset}, using 0.7`);
      }

      // If stage is already active with different capsule, exit first
      if (state.active && state.capsuleId !== capsuleId) {
        state.active = false;
        emitChange('exit-before-enter');
      }

      // Enter stage
      state = {
        active: true,
        spaceId,
        capsuleId,
        tabId,
        preset: isValidPreset(preset) ? preset : 0.7,
      };

      emitPresentationChanged('stage');
      emitChange('enter');
    },

    exit(): void {
      if (!state.active) return;

      const previousCapsuleId = state.capsuleId;
      state = {
        active: false,
        spaceId,
        capsuleId: undefined,
        tabId: undefined,
        preset: 0.7,
      };

      emitPresentationChanged('capsule');
      emitChange('exit');

      // Emit presentation changed for previous capsule with explicit capsuleId
      if (previousCapsuleId) {
        bus.emit(
          createEvent(
            EVENT_PRESENTATION_CHANGED,
            { presentation: 'capsule', previousPresentation: 'stage' },
            { spaceId, capsuleId: previousCapsuleId }
          )
        );
      }
    },

    setPreset(preset: StagePreset): void {
      if (!state.active) {
        console.warn('[StageController] Cannot set preset when stage is inactive');
        return;
      }

      if (!isValidPreset(preset)) {
        console.warn(`[StageController] Invalid preset ${preset}, ignoring`);
        return;
      }

      state.preset = preset;
      emitChange('preset-change');
    },
  };
}

// ============================================================================
// Stage Factory (per-space singleton)
// ============================================================================

const stageControllers = new Map<SpaceId, StageController>();
const eventBuses = new Map<SpaceId, ReturnType<typeof createEventBus>>();

export function getStageController(spaceId: SpaceId): StageController {
  if (!stageControllers.has(spaceId)) {
    let bus = eventBuses.get(spaceId);
    if (!bus) {
      bus = createEventBus(spaceId);
      eventBuses.set(spaceId, bus);
    }
    stageControllers.set(spaceId, createStageController(spaceId, bus));
  }
  return stageControllers.get(spaceId)!;
}

export function disposeStageController(spaceId: SpaceId): void {
  stageControllers.delete(spaceId);
  eventBuses.delete(spaceId);
}
