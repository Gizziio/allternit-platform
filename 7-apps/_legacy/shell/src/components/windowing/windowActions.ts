/**
 * Window Actions for Shell Integration
 *
 * Defines window-related actions that capsules can register.
 * Window controls are only shown if corresponding actions exist.
 */

// ============================================================================
// Types
// ============================================================================

type ActionId = string;

interface WindowAction {
  id: ActionId;
  label?: string;
  icon?: string;
  enabled: boolean;
  run: () => void | Promise<void>;
}

// ============================================================================
// Window Action IDs
// ============================================================================

export const WINDOW_ACTIONS = {
  CLOSE: 'window.close',
  MINIMIZE: 'window.minimize',
  MAXIMIZE: 'window.maximize',
  RESTORE: 'window.restore',
  SNAP_LEFT: 'window.snap.left',
  SNAP_RIGHT: 'window.snap.right',
  SNAP_TOP: 'window.snap.top',
  SNAP_BOTTOM: 'window.snap.bottom',
  UNSNAP: 'window.unsnap',
  FOCUS: 'window.focus',
  MOVE: 'window.move',
  RESIZE: 'window.resize',
} as const;

export type WindowActionId = (typeof WINDOW_ACTIONS)[keyof typeof WINDOW_ACTIONS];

// ============================================================================
// Window Action Creators
// ============================================================================

export function createWindowCloseAction(capsuleId: string): WindowAction {
  return {
    id: WINDOW_ACTIONS.CLOSE,
    label: 'Close',
    icon: '×',
    enabled: true,
    run: () => {
      window.dispatchEvent(new CustomEvent('window:action', {
        detail: { action: WINDOW_ACTIONS.CLOSE, capsuleId }
      }));
    },
  };
}

export function createWindowMinimizeAction(capsuleId: string): WindowAction {
  return {
    id: WINDOW_ACTIONS.MINIMIZE,
    label: 'Minimize',
    icon: '−',
    enabled: true,
    run: () => {
      window.dispatchEvent(new CustomEvent('window:action', {
        detail: { action: WINDOW_ACTIONS.MINIMIZE, capsuleId }
      }));
    },
  };
}

export function createWindowMaximizeAction(capsuleId: string): WindowAction {
  return {
    id: WINDOW_ACTIONS.MAXIMIZE,
    label: 'Maximize',
    icon: '□',
    enabled: true,
    run: () => {
      window.dispatchEvent(new CustomEvent('window:action', {
        detail: { action: WINDOW_ACTIONS.MAXIMIZE, capsuleId }
      }));
    },
  };
}

export function createWindowRestoreAction(capsuleId: string): WindowAction {
  return {
    id: WINDOW_ACTIONS.RESTORE,
    label: 'Restore',
    icon: '⤢',
    enabled: true,
    run: () => {
      window.dispatchEvent(new CustomEvent('window:action', {
        detail: { action: WINDOW_ACTIONS.RESTORE, capsuleId }
      }));
    },
  };
}

export function createWindowSnapLeftAction(capsuleId: string): WindowAction {
  return {
    id: WINDOW_ACTIONS.SNAP_LEFT,
    label: 'Snap Left',
    enabled: true,
    run: () => {
      window.dispatchEvent(new CustomEvent('window:action', {
        detail: { action: WINDOW_ACTIONS.SNAP_LEFT, capsuleId }
      }));
    },
  };
}

export function createWindowSnapRightAction(capsuleId: string): WindowAction {
  return {
    id: WINDOW_ACTIONS.SNAP_RIGHT,
    label: 'Snap Right',
    enabled: true,
    run: () => {
      window.dispatchEvent(new CustomEvent('window:action', {
        detail: { action: WINDOW_ACTIONS.SNAP_RIGHT, capsuleId }
      }));
    },
  };
}

export function createWindowSnapTopAction(capsuleId: string): WindowAction {
  return {
    id: WINDOW_ACTIONS.SNAP_TOP,
    label: 'Snap Top',
    enabled: true,
    run: () => {
      window.dispatchEvent(new CustomEvent('window:action', {
        detail: { action: WINDOW_ACTIONS.SNAP_TOP, capsuleId }
      }));
    },
  };
}

export function createWindowSnapBottomAction(capsuleId: string): WindowAction {
  return {
    id: WINDOW_ACTIONS.SNAP_BOTTOM,
    label: 'Snap Bottom',
    enabled: true,
    run: () => {
      window.dispatchEvent(new CustomEvent('window:action', {
        detail: { action: WINDOW_ACTIONS.SNAP_BOTTOM, capsuleId }
      }));
    },
  };
}

export function createWindowUnsnapAction(capsuleId: string): WindowAction {
  return {
    id: WINDOW_ACTIONS.UNSNAP,
    label: 'Unsnap',
    enabled: true,
    run: () => {
      window.dispatchEvent(new CustomEvent('window:action', {
        detail: { action: WINDOW_ACTIONS.UNSNAP, capsuleId }
      }));
    },
  };
}

// ============================================================================
// Register All Window Actions for a Capsule
// ============================================================================

export function registerWindowActions(capsuleId: string): WindowAction[] {
  return [
    createWindowCloseAction(capsuleId),
    createWindowMinimizeAction(capsuleId),
    createWindowMaximizeAction(capsuleId),
    createWindowRestoreAction(capsuleId),
    createWindowSnapLeftAction(capsuleId),
    createWindowSnapRightAction(capsuleId),
    createWindowSnapTopAction(capsuleId),
    createWindowSnapBottomAction(capsuleId),
    createWindowUnsnapAction(capsuleId),
  ];
}

// ============================================================================
// Check if Window Action Exists
// ============================================================================

export function isWindowAction(actionId: string): actionId is WindowActionId {
  return Object.values(WINDOW_ACTIONS).includes(actionId as WindowActionId);
}

export function getWindowActionId(action: string): WindowActionId | null {
  if (action === WINDOW_ACTIONS.CLOSE) return WINDOW_ACTIONS.CLOSE;
  if (action === WINDOW_ACTIONS.MINIMIZE) return WINDOW_ACTIONS.MINIMIZE;
  if (action === WINDOW_ACTIONS.MAXIMIZE) return WINDOW_ACTIONS.MAXIMIZE;
  if (action === WINDOW_ACTIONS.RESTORE) return WINDOW_ACTIONS.RESTORE;
  if (action === WINDOW_ACTIONS.SNAP_LEFT) return WINDOW_ACTIONS.SNAP_LEFT;
  if (action === WINDOW_ACTIONS.SNAP_RIGHT) return WINDOW_ACTIONS.SNAP_RIGHT;
  if (action === WINDOW_ACTIONS.SNAP_TOP) return WINDOW_ACTIONS.SNAP_TOP;
  if (action === WINDOW_ACTIONS.SNAP_BOTTOM) return WINDOW_ACTIONS.SNAP_BOTTOM;
  if (action === WINDOW_ACTIONS.UNSNAP) return WINDOW_ACTIONS.UNSNAP;
  return null;
}
