/**
 * Capsule Controller
 *
 * Headless controller for a single capsule.
 * Manages lifecycle, capabilities, presentation, and actions.
 */

import type {
  CapsuleId,
  SpaceId,
  CapsulePhase,
  CapsuleLifecycleState,
  CapsuleCapabilities,
  Presentation,
  CapsuleAction,
  ActionRegistry,
  EventBus,
} from '../core/index.js';
import {
  createLifecycleController,
  EVENT_LIFECYCLE_CHANGED,
  EVENT_CAPABILITIES_CHANGED,
  EVENT_PRESENTATION_CHANGED,
  createEvent,
  createEventBus,
  createCapabilitiesController,
  createActionRegistry,
} from '../core/index.js';

// ============================================================================
// Capsule Controller Interface
// ============================================================================

export interface CapsuleController {
  // Identity
  readonly id: CapsuleId;
  readonly spaceId: SpaceId;
  readonly type: string;

  // Lifecycle
  getLifecycle(): CapsuleLifecycleState;
  setLifecycle(next: Partial<CapsuleLifecycleState>): void;

  // Capabilities
  getCapabilities(): CapsuleCapabilities;
  setCapabilities(next: CapsuleCapabilities): void;

  // Presentation
  getPresentation(): Presentation;
  setPresentation(p: Presentation): void;

  // Actions
  actions: ActionRegistry;

  // Events
  events: EventBus;
}

// ============================================================================
// Capsule Controller Options
// ============================================================================

export interface CapsuleControllerOptions {
  id?: CapsuleId;
  spaceId: SpaceId;
  type: string;
  capabilities?: CapsuleCapabilities;
  eventBus?: EventBus;
  onLifecycleChange?: (state: CapsuleLifecycleState) => void;
  onCapabilitiesChange?: (capabilities: CapsuleCapabilities) => void;
  onPresentationChange?: (presentation: Presentation) => void;
}

// ============================================================================
// Capsule Controller Implementation
// ============================================================================

export function createCapsuleController(
  options: CapsuleControllerOptions
): CapsuleController {
  const id = options.id || `capsule_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const spaceId = options.spaceId;
  const type = options.type;
  const eventBus = options.eventBus || createEventBus(spaceId);

  // Lifecycle controller
  const lifecycle = createLifecycleController(id, spaceId, (state) => {
    options.onLifecycleChange?.(state);
    eventBus.emit(
      createEvent(EVENT_LIFECYCLE_CHANGED, state, { spaceId, capsuleId: id })
    );
  });

  // Capabilities controller
  const capabilities = createCapabilitiesController(id, options.capabilities || {}, (caps) => {
    options.onCapabilitiesChange?.(caps);
    eventBus.emit(
      createEvent(EVENT_CAPABILITIES_CHANGED, { capabilities: caps }, { spaceId, capsuleId: id })
    );
  });

  // Presentation state
  let presentation: Presentation = 'capsule';

  // Action registry
  const actions = createActionRegistry();

  // Update presentation with event
  const updatePresentation = (newPresentation: Presentation) => {
    const previous = presentation;
    presentation = newPresentation;
    options.onPresentationChange?.(presentation);
    eventBus.emit(
      createEvent(
        EVENT_PRESENTATION_CHANGED,
        { presentation, previousPresentation: previous },
        { spaceId, capsuleId: id }
      )
    );
  };

  return {
    // Identity
    get id(): CapsuleId {
      return id;
    },
    get spaceId(): SpaceId {
      return spaceId;
    },
    get type(): string {
      return type;
    },

    // Lifecycle
    getLifecycle(): CapsuleLifecycleState {
      return lifecycle.getLifecycleState();
    },

    setLifecycle(next: Partial<CapsuleLifecycleState>): void {
      if (next.phase) {
        lifecycle.setPhase(next.phase, next.statusText);
      }
      if (next.statusText) {
        lifecycle.setStatusText(next.statusText);
      }
      if (next.error) {
        lifecycle.setError(next.error);
      }
    },

    // Capabilities
    getCapabilities(): CapsuleCapabilities {
      return capabilities.getCapabilities();
    },

    setCapabilities(next: CapsuleCapabilities): void {
      capabilities.setCapabilities(next);
    },

    // Presentation
    getPresentation(): Presentation {
      return presentation;
    },

    setPresentation(p: Presentation): void {
      if (presentation !== p) {
        updatePresentation(p);
      }
    },

    // Actions
    actions,

    // Events
    events: eventBus,
  };
}

// ============================================================================
// Presentation Types
// ============================================================================

export type { Presentation } from '../core/index.js';
