/**
 * Events Module
 *
 * Single canonical event format for all capsule events.
 * The SDK never interprets events - it only transports them.
 */

import { SpaceId, CapsuleId, TabId, EventId, generateEventId } from './ids.js';

// ============================================================================
// Event Format
// ============================================================================

export interface A2Event<T = unknown> {
  id: EventId;
  ts: number;
  type: string;
  spaceId?: SpaceId;
  capsuleId?: CapsuleId;
  tabId?: TabId;
  payload: T;
}

// ============================================================================
// Event Factory
// ============================================================================

export function createEvent<T>(
  type: string,
  payload: T,
  options: {
    spaceId?: SpaceId;
    capsuleId?: CapsuleId;
    tabId?: TabId;
  } = {}
): A2Event<T> {
  return {
    id: generateEventId(),
    ts: Date.now(),
    type,
    ...options,
    payload,
  };
}

// ============================================================================
// Event Bus Interface
// ============================================================================

export interface EventBus {
  emit: <T>(event: A2Event<T>) => void;
  on: (type: string, handler: (event: A2Event) => void) => () => void;
  off: (type: string, handler: (event: A2Event) => void) => void;
  once: (type: string, handler: (event: A2Event) => void) => () => void;
  emitSync: <T>(event: A2Event<T>) => void;
}

// ============================================================================
// Event Bus Implementation
// ============================================================================

export function createEventBus(initialSpaceId?: SpaceId): EventBus {
  const handlers = new Map<string, Set<(event: A2Event) => void>>();
  let currentSpaceId = initialSpaceId;

  const getHandlers = (type: string): Set<(event: A2Event) => void> => {
    if (!handlers.has(type)) {
      handlers.set(type, new Set());
    }
    return handlers.get(type)!;
  };

  const callHandlers = (event: A2Event): void => {
    // Inject spaceId if not present
    if (!event.spaceId && currentSpaceId) {
      (event as A2Event).spaceId = currentSpaceId;
    }

    const typeHandlers = handlers.get(event.type);
    if (typeHandlers) {
      for (const handler of typeHandlers) {
        try {
          handler(event);
        } catch (error) {
          console.error(`[EventBus] Handler error for ${event.type}:`, error);
        }
      }
    }
  };

  return {
    emit: <T>(event: A2Event<T>): void => {
      // Async emission to avoid blocking
      setTimeout(() => callHandlers(event as A2Event), 0);
    },

    on: (type: string, handler: (event: A2Event) => void): (() => void) => {
      const typeHandlers = getHandlers(type);
      typeHandlers.add(handler);
      return () => {
        typeHandlers.delete(handler);
      };
    },

    off: (type: string, handler: (event: A2Event) => void): void => {
      const typeHandlers = handlers.get(type);
      if (typeHandlers) {
        typeHandlers.delete(handler);
      }
    },

    once: (type: string, handler: (event: A2Event) => void): (() => void) => {
      const wrappedHandler = (event: A2Event) => {
        handler(event);
        const typeHandlers = handlers.get(type);
        if (typeHandlers) {
          typeHandlers.delete(wrappedHandler);
        }
      };
      const typeHandlers = getHandlers(type);
      typeHandlers.add(wrappedHandler);
      return () => {
        typeHandlers.delete(wrappedHandler);
      };
    },

    emitSync: <T>(event: A2Event<T>): void => {
      callHandlers(event as A2Event);
    },
  };
}

// ============================================================================
// Required Event Types (SDK-owned)
// ============================================================================

// Lifecycle events
export const EVENT_LIFECYCLE_CHANGED = 'capsule.lifecycle.changed';
export const EVENT_STATUS_CHANGED = 'capsule.status';

// Capability events
export const EVENT_CAPABILITIES_CHANGED = 'capsule.capabilities';

// Presentation events
export const EVENT_PRESENTATION_CHANGED = 'capsule.presentation.changed';

// Action events
export const EVENT_ACTION_MISSING = 'capsule.action.missing';

// Stage events
export const EVENT_STAGE_CHANGED = 'stage.changed';
export const EVENT_STAGE_REQUESTED = 'capsule.request.stage';

// Renderer events
export const EVENT_RENDERER_CHANGED = 'capsule.renderer.changed';

// Error events
export const EVENT_ERROR = 'capsule.error';

// ============================================================================
// Event Payload Types
// ============================================================================

export interface LifecycleChangedPayload {
  phase: string;
  previousPhase?: string;
  reason?: string;
}

export interface CapabilitiesPayload {
  capabilities: Record<string, boolean>;
}

export interface PresentationChangedPayload {
  presentation: 'capsule' | 'stage';
  previousPresentation?: 'capsule' | 'stage';
}

export interface ActionMissingPayload {
  actionId: string;
  attemptedBy: 'ui' | 'agent';
  capsuleId: string;
}

export interface StageChangedPayload {
  active: boolean;
  spaceId: string;
  capsuleId?: string;
  tabId?: string;
  preset: 0.5 | 0.7 | 1.0;
}

export interface RendererChangedPayload {
  tabId: string;
  mode: 'stream' | 'gpu';
  reason: 'user' | 'suggested' | 'policy';
}
