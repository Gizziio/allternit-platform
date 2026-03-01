/**
 * Window Action Registry Hook
 *
 * Integrates window controls with Capsule SDK action registry.
 * Only renders window controls for actions that are registered.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useWindowManager } from './WindowManager';
import { WINDOW_ACTIONS, type WindowActionId } from './windowActions';

// ============================================================================
// Types
// ============================================================================

export interface WindowControlsConfig {
  capsuleId: string;
  windowId: string;
  enabledControls?: {
    close?: boolean;
    minimize?: boolean;
    maximize?: boolean;
    snap?: boolean;
  };
}

export interface WindowControlsState {
  canClose: boolean;
  canMinimize: boolean;
  canMaximize: boolean;
  canSnap: boolean;
}

// ============================================================================
// Action Registry Mock (until we integrate with actual Capsule SDK)
// ============================================================================

// In production, this would use the actual action registry from Capsule SDK
const actionRegistry: Map<string, Set<string>> = new Map();

export function registerWindowActions(capsuleId: string): void {
  const actions = new Set(Object.values(WINDOW_ACTIONS));
  actionRegistry.set(capsuleId, actions);
}

export function unregisterWindowActions(capsuleId: string): void {
  actionRegistry.delete(capsuleId);
}

export function hasWindowAction(capsuleId: string, action: WindowActionId): boolean {
  const actions = actionRegistry.get(capsuleId);
  return actions?.has(action) ?? false;
}

// ============================================================================
// Hook
// ============================================================================

export function useWindowControls(config: WindowControlsConfig): WindowControlsState {
  const { capsuleId, windowId, enabledControls } = config;
  const { getWindow } = useWindowManager();

  const window = getWindow(windowId);

  const state = useMemo<WindowControlsState>(
    () => ({
      canClose:
        enabledControls?.close ?? window?.closable ?? hasWindowAction(capsuleId, WINDOW_ACTIONS.CLOSE),
      canMinimize:
        enabledControls?.minimize ?? window?.minimizable ?? hasWindowAction(capsuleId, WINDOW_ACTIONS.MINIMIZE),
      canMaximize:
        enabledControls?.maximize ?? window?.maximizable ?? hasWindowAction(capsuleId, WINDOW_ACTIONS.MAXIMIZE),
      canSnap:
        enabledControls?.snap ??
        (hasWindowAction(capsuleId, WINDOW_ACTIONS.SNAP_LEFT) ||
          hasWindowAction(capsuleId, WINDOW_ACTIONS.SNAP_RIGHT) ||
          hasWindowAction(capsuleId, WINDOW_ACTIONS.SNAP_TOP) ||
          hasWindowAction(capsuleId, WINDOW_ACTIONS.SNAP_BOTTOM)),
    }),
    [capsuleId, window, enabledControls]
  );

  return state;
}

// ============================================================================
// Window Action Handler Hook
// ============================================================================

export function useWindowActionHandler(capsuleId: string, windowId: string) {
  const {
    closeWindow,
    minimizeWindow,
    maximizeWindow,
    restoreWindow,
    snapWindow,
    unsnapWindow,
    getWindow,
  } = useWindowManager();

  const handleAction = useCallback(
    (action: WindowActionId) => {
      const window = getWindow(windowId);
      if (!window) return;

      switch (action) {
        case WINDOW_ACTIONS.CLOSE:
          closeWindow(windowId);
          break;
        case WINDOW_ACTIONS.MINIMIZE:
          minimizeWindow(windowId);
          break;
        case WINDOW_ACTIONS.MAXIMIZE:
          if (window.state === 'maximized') {
            restoreWindow(windowId);
          } else {
            maximizeWindow(windowId);
          }
          break;
        case WINDOW_ACTIONS.SNAP_LEFT:
          snapWindow(windowId, 'left');
          break;
        case WINDOW_ACTIONS.SNAP_RIGHT:
          snapWindow(windowId, 'right');
          break;
        case WINDOW_ACTIONS.SNAP_TOP:
          snapWindow(windowId, 'top');
          break;
        case WINDOW_ACTIONS.SNAP_BOTTOM:
          snapWindow(windowId, 'bottom');
          break;
        case WINDOW_ACTIONS.UNSNAP:
          unsnapWindow(windowId);
          break;
      }
    },
    [windowId, closeWindow, minimizeWindow, maximizeWindow, restoreWindow, snapWindow, unsnapWindow, getWindow]
  );

  // Listen for window:action events from Capsule SDK
  useEffect(() => {
    const handleEvent = (e: CustomEvent<{ action: string; capsuleId: string }>) => {
      const { action: actionStr, capsuleId: cid } = e.detail;
      if (cid !== capsuleId) return;

      const action = getWindowActionId(actionStr);
      if (action) {
        handleAction(action);
      }
    };

    window.addEventListener('window:action', handleEvent as EventListener);
    return () => {
      window.removeEventListener('window:action', handleEvent as EventListener);
    };
  }, [capsuleId, handleAction]);

  return { handleAction };
}

// ============================================================================
// Snap Menu Items Generator
// ============================================================================

export function getSnapMenuItems(capsuleId: string): Array<{ id: string; label: string; action: WindowActionId }> {
  const items: Array<{ id: string; label: string; action: WindowActionId }> = [];

  if (hasWindowAction(capsuleId, WINDOW_ACTIONS.SNAP_LEFT)) {
    items.push({ id: 'snap-left', label: 'Snap Left', action: WINDOW_ACTIONS.SNAP_LEFT });
  }
  if (hasWindowAction(capsuleId, WINDOW_ACTIONS.SNAP_RIGHT)) {
    items.push({ id: 'snap-right', label: 'Snap Right', action: WINDOW_ACTIONS.SNAP_RIGHT });
  }
  if (hasWindowAction(capsuleId, WINDOW_ACTIONS.SNAP_TOP)) {
    items.push({ id: 'snap-top', label: 'Snap Top', action: WINDOW_ACTIONS.SNAP_TOP });
  }
  if (hasWindowAction(capsuleId, WINDOW_ACTIONS.SNAP_BOTTOM)) {
    items.push({ id: 'snap-bottom', label: 'Snap Bottom', action: WINDOW_ACTIONS.SNAP_BOTTOM });
  }
  if (hasWindowAction(capsuleId, WINDOW_ACTIONS.UNSNAP)) {
    items.push({ id: 'unsnap', label: 'Unsnap', action: WINDOW_ACTIONS.UNSNAP });
  }

  return items;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getWindowActionId(action: string): WindowActionId | null {
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
