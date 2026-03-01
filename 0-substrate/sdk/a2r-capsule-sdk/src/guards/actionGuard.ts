/**
 * Action Guard
 *
 * Dead-button prevention: ensures UI only renders registered actions.
 */

import type { CapsuleId, ActionId } from '../core/ids.js';
import type { CapsuleAction, ActionRegistry } from '../core/actions.js';
import { EVENT_ACTION_MISSING, createEvent } from '../core/events.js';

// ============================================================================
// Action Guard Interface
// ============================================================================

export interface ActionGuard {
  check(actionId: ActionId, attemptedBy: 'ui' | 'agent'): void;
  validateAll(actionIds: ActionId[], attemptedBy: 'ui' | 'agent'): ActionId[];
}

// ============================================================================
// Action Guard Implementation
// ============================================================================

export function createActionGuard(
  capsuleId: CapsuleId,
  actionRegistry: ActionRegistry,
  emitEvent: (event: ReturnType<typeof createEvent>) => void
): ActionGuard {
  const missingActions = new Set<ActionId>();

  return {
    check(actionId: ActionId, attemptedBy: 'ui' | 'agent'): void {
      if (!actionRegistry.has(capsuleId, actionId)) {
        // Emit warning event
        emitEvent(
          createEvent(
            EVENT_ACTION_MISSING,
            { actionId, attemptedBy, capsuleId },
            { capsuleId }
          )
        );

        // Track for potential auto-removal
        missingActions.add(actionId);

        // Log warning
        console.warn(
          `[ActionGuard] Action "${actionId}" attempted by ${attemptedBy} but not registered in capsule ${capsuleId}`
        );
      }
    },

    validateAll(actionIds: ActionId[], attemptedBy: 'ui' | 'agent'): ActionId[] {
      const missing: ActionId[] = [];

      for (const actionId of actionIds) {
        if (!actionRegistry.has(capsuleId, actionId)) {
          missing.push(actionId);
          emitEvent(
            createEvent(
              EVENT_ACTION_MISSING,
              { actionId, attemptedBy, capsuleId },
              { capsuleId }
            )
          );
        }
      }

      return missing;
    },
  };
}

// ============================================================================
// UI Helper: Filter actions through guard
// ============================================================================

export function filterRegisteredActions(
  capsuleId: CapsuleId,
  actionRegistry: ActionRegistry,
  actionIds: ActionId[]
): ActionId[] {
  return actionIds.filter((id) => actionRegistry.has(capsuleId, id));
}

// ============================================================================
// Get Action by ID (safe)
// ============================================================================

export function getRegisteredAction(
  capsuleId: CapsuleId,
  actionRegistry: ActionRegistry,
  actionId: ActionId
): CapsuleAction | undefined {
  return actionRegistry.get(capsuleId, actionId);
}
