/**
 * Capsule Windowing Contract
 *
 * Defines the data model and events for window-based capsule rendering.
 * This enables capsules to be draggable, resizable, focusable windows on the canvas.
 */

// ============================================================================
// Core Types
// ============================================================================

export type CapsuleWindowId = string;

export type WindowState = 'normal' | 'minimized' | 'maximized' | 'tabbed' | 'closed';

export type WindowSnap = 'left' | 'right' | 'top' | 'bottom' | null;

export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export interface CapsuleWindow {
  id: CapsuleWindowId;
  capsuleId: string;
  spaceId: string;
  title?: string;

  // Position and size (in canvas coordinates)
  x: number;
  y: number;
  width: number;
  height: number;

  // Z-index for stacking order
  z: number;

  // Window state
  state: WindowState;
  snap: WindowSnap;

  // Behavior flags
  resizable: boolean;
  draggable: boolean;
  closable: boolean;
  minimizable: boolean;
  maximizable: boolean;

  // Constraints
  minWidth: number;
  minHeight: number;
  maxWidth?: number;
  maxHeight?: number;
}

// ============================================================================
// Window Events (for IPC-like communication)
// ============================================================================

export type WindowEventType =
  | 'window:created'
  | 'window:destroyed'
  | 'window:focused'
  | 'window:moved'
  | 'window:resized'
  | 'window:closed'
  | 'window:minimized'
  | 'window:maximized'
  | 'window:restored'
  | 'window:tabbed'
  | 'window:reopened'
  | 'window:snapped'
  | 'window:unsnapped'
  | 'window:zChanged';

export interface WindowEvent {
  type: WindowEventType;
  windowId: CapsuleWindowId;
  timestamp: number;
  payload?: Record<string, unknown>;
}

// ============================================================================
// Window Actions (immutable updates)
// ============================================================================

export interface CreateWindowAction {
  type: 'create';
  window: Omit<CapsuleWindow, 'id' | 'z' | 'state' | 'snap'> & { id?: CapsuleWindowId };
}

export interface DestroyWindowAction {
  type: 'destroy';
  windowId: CapsuleWindowId;
}

export interface FocusWindowAction {
  type: 'focus';
  windowId: CapsuleWindowId;
}

export interface MoveWindowAction {
  type: 'move';
  windowId: CapsuleWindowId;
  x: number;
  y: number;
}

export interface ResizeWindowAction {
  type: 'resize';
  windowId: CapsuleWindowId;
  width: number;
  height: number;
  resizeHandle?: ResizeHandle;
}

export interface CloseWindowAction {
  type: 'close';
  windowId: CapsuleWindowId;
}

export interface MinimizeWindowAction {
  type: 'minimize';
  windowId: CapsuleWindowId;
}

export interface MaximizeWindowAction {
  type: 'maximize';
  windowId: CapsuleWindowId;
}

export interface RestoreWindowAction {
  type: 'restore';
  windowId: CapsuleWindowId;
}

export interface TabWindowAction {
  type: 'tab';
  windowId: CapsuleWindowId;
  tabsetId: string;
}

export interface SnapWindowAction {
  type: 'snap';
  windowId: CapsuleWindowId;
  snap: WindowSnap;
}

export interface UnsnapWindowAction {
  type: 'unsnap';
  windowId: CapsuleWindowId;
}

export type WindowAction =
  | CreateWindowAction
  | DestroyWindowAction
  | FocusWindowAction
  | MoveWindowAction
  | ResizeWindowAction
  | CloseWindowAction
  | MinimizeWindowAction
  | MaximizeWindowAction
  | RestoreWindowAction
  | TabWindowAction
  | SnapWindowAction
  | UnsnapWindowAction;

// ============================================================================
// Window Manager State
// ============================================================================

export interface WindowManagerState {
  windows: Map<CapsuleWindowId, CapsuleWindow>;
  focusedWindowId: CapsuleWindowId | null;
  nextZIndex: number;
  canvasBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// ============================================================================
// Default Values
// ============================================================================

export const DEFAULT_WINDOW: Omit<CapsuleWindow, 'id' | 'capsuleId' | 'spaceId'> = {
  title: undefined,
  x: 100,
  y: 100,
  width: 800,
  height: 600,
  z: 0,
  state: 'normal',
  snap: null,
  resizable: true,
  draggable: true,
  closable: true,
  minimizable: true,
  maximizable: true,
  minWidth: 200,
  minHeight: 150,
  maxWidth: undefined,
  maxHeight: undefined,
};

// ============================================================================
// Utility Functions
// ============================================================================

export function generateWindowId(): CapsuleWindowId {
  return `win_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function isValidPosition(
  x: number,
  y: number,
  width: number,
  height: number,
  canvasBounds: { x: number; y: number; width: number; height: number }
): boolean {
  return (
    x >= canvasBounds.x &&
    y >= canvasBounds.y &&
    x + width <= canvasBounds.x + canvasBounds.width &&
    y + height <= canvasBounds.y + canvasBounds.height
  );
}

export function clampPosition(
  x: number,
  y: number,
  width: number,
  height: number,
  canvasBounds: { x: number; y: number; width: number; height: number }
): { x: number; y: number } {
  return {
    x: Math.max(canvasBounds.x, Math.min(x, canvasBounds.x + canvasBounds.width - width)),
    y: Math.max(canvasBounds.y, Math.min(y, canvasBounds.y + canvasBounds.height - height)),
  };
}

export function getSnapBounds(
  window: CapsuleWindow,
  canvasBounds: { x: number; y: number; width: number; height: number }
): { x: number; y: number; width: number; height: number } | null {
  const SNAP_MARGIN = 10;
  const snapThreshold = 20;

  // Check for snap to left
  if (Math.abs(window.x - canvasBounds.x) < snapThreshold) {
    return {
      x: canvasBounds.x,
      y: window.y,
      width: Math.floor(canvasBounds.width / 2),
      height: window.height,
    };
  }

  // Check for snap to right
  if (Math.abs((window.x + window.width) - (canvasBounds.x + canvasBounds.width)) < snapThreshold) {
    return {
      x: canvasBounds.x + Math.ceil(canvasBounds.width / 2),
      y: window.y,
      width: Math.floor(canvasBounds.width / 2),
      height: window.height,
    };
  }

  // Check for snap to top
  if (Math.abs(window.y - canvasBounds.y) < snapThreshold) {
    return {
      x: window.x,
      y: canvasBounds.y,
      width: window.width,
      height: Math.floor(canvasBounds.height / 2),
    };
  }

  // Check for snap to bottom
  if (Math.abs((window.y + window.height) - (canvasBounds.y + canvasBounds.height)) < snapThreshold) {
    return {
      x: window.x,
      y: canvasBounds.y + Math.ceil(canvasBounds.height / 2),
      width: window.width,
      height: Math.floor(canvasBounds.height / 2),
    };
  }

  return null;
}

// ============================================================================
// Type Exports
// ============================================================================

// Types are already exported at their definitions above
