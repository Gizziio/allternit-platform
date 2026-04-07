/**
 * Actions Module
 *
 * Action registry for dead-button prevention.
 * A2UI/AG-UI must render actions only from the registry.
 */

import { CapsuleId, ActionId } from './ids.js';

// ============================================================================
// Action Types
// ============================================================================

export interface CapsuleAction {
  id: ActionId;
  label?: string;
  icon?: string;
  enabled: boolean;
  run: () => void | Promise<void>;
}

export interface ActionRegistry {
  register: (capsuleId: CapsuleId, action: CapsuleAction) => void;
  unregister: (capsuleId: CapsuleId, actionId: ActionId) => void;
  list: (capsuleId: CapsuleId) => CapsuleAction[];
  get: (capsuleId: CapsuleId, actionId: ActionId) => CapsuleAction | undefined;
  has: (capsuleId: CapsuleId, actionId: ActionId) => boolean;
  update: (capsuleId: CapsuleId, actionId: ActionId, updates: Partial<CapsuleAction>) => void;
}

// ============================================================================
// Action Registry Implementation
// ============================================================================

export function createActionRegistry(): ActionRegistry {
  const actions = new Map<CapsuleId, Map<ActionId, CapsuleAction>>();

  const getCapsuleActions = (capsuleId: CapsuleId): Map<ActionId, CapsuleAction> => {
    if (!actions.has(capsuleId)) {
      actions.set(capsuleId, new Map());
    }
    return actions.get(capsuleId)!;
  };

  return {
    register(capsuleId: CapsuleId, action: CapsuleAction): void {
      const capsuleActions = getCapsuleActions(capsuleId);
      capsuleActions.set(action.id, action);
    },

    unregister(capsuleId: CapsuleId, actionId: ActionId): void {
      const capsuleActions = actions.get(capsuleId);
      if (capsuleActions) {
        capsuleActions.delete(actionId);
      }
    },

    list(capsuleId: CapsuleId): CapsuleAction[] {
      const capsuleActions = actions.get(capsuleId);
      if (!capsuleActions) {
        return [];
      }
      return Array.from(capsuleActions.values());
    },

    get(capsuleId: CapsuleId, actionId: ActionId): CapsuleAction | undefined {
      const capsuleActions = actions.get(capsuleId);
      if (!capsuleActions) {
        return undefined;
      }
      return capsuleActions.get(actionId);
    },

    has(capsuleId: CapsuleId, actionId: ActionId): boolean {
      const capsuleActions = actions.get(capsuleId);
      if (!capsuleActions) {
        return false;
      }
      return capsuleActions.has(actionId);
    },

    update(
      capsuleId: CapsuleId,
      actionId: ActionId,
      updates: Partial<CapsuleAction>
    ): void {
      const capsuleActions = actions.get(capsuleId);
      const existing = capsuleActions?.get(actionId);
      if (existing) {
        capsuleActions!.set(actionId, { ...existing, ...updates });
      }
    },
  };
}

// ============================================================================
// Common Action IDs (for browser capsule)
// ============================================================================

export const BROWSER_ACTIONS = {
  NAV_BACK: 'nav.back',
  NAV_FORWARD: 'nav.forward',
  NAV_RELOAD: 'nav.reload',
  MODE_INSPECT: 'mode.inspect',
  MODE_LIVE: 'mode.live',
  RENDERER_STREAM: 'renderer.stream',
  RENDERER_GPU: 'renderer.gpu',
  STAGE_ENTER: 'stage.enter',
  STAGE_EXIT: 'stage.exit',
  STAGE_PRESET_50: 'stage.preset.50',
  STAGE_PRESET_70: 'stage.preset.70',
  STAGE_PRESET_100: 'stage.preset.100',
  TAB_NEW: 'tab.new',
  TAB_CLOSE: 'tab.close',
  TAB_SWITCH: 'tab.switch',
} as const;

// ============================================================================
// Action Builder (for convenience)
// ============================================================================

export interface ActionBuilder {
  id(id: ActionId): this;
  label(label: string): this;
  icon(icon: string): this;
  enabled(enabled: boolean): this;
  run(fn: () => void | Promise<void>): this;
  build(): CapsuleAction;
}

export function createActionBuilder(): ActionBuilder {
  let id: ActionId = '' as ActionId;
  let label: string | undefined;
  let icon: string | undefined;
  let enabled = true;
  let run: (() => void | Promise<void>) = () => {};

  return {
    id(value: ActionId): ActionBuilder {
      id = value;
      return this;
    },
    label(value: string): ActionBuilder {
      label = value;
      return this;
    },
    icon(value: string): ActionBuilder {
      icon = value;
      return this;
    },
    enabled(value: boolean): ActionBuilder {
      enabled = value;
      return this;
    },
    run(fn: () => void | Promise<void>): ActionBuilder {
      run = fn;
      return this;
    },
    build(): CapsuleAction {
      if (!id) {
        throw new Error('Action ID is required');
      }
      return {
        id,
        label,
        icon,
        enabled,
        run,
      };
    },
  };
}
