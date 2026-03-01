/**
 * Window Manager
 *
 * Manages capsule windows on canvas with focus, drag, resize, and snap support.
 * Includes throttled bounds updates for smooth Stage synchronization.
 */

console.log('[FPRINT] WindowManager module loaded');
console.log('[WINDOW_MANAGER_MOUNTED]');

import React, { createContext, useContext, useReducer, useCallback, useRef, useEffect } from 'react';
import {
  CapsuleWindow,
  CapsuleWindowId,
  WindowAction,
  WindowState,
  WindowSnap,
  DEFAULT_WINDOW,
  generateWindowId,
  clampPosition,
  getSnapBounds,
  type WindowManagerState,
  type WindowEvent,
} from './types';
import { proofRecorder } from '../../proof/ProofRecorder'; // Import proofRecorder

// ============================================================================
// Constants
// ============================================================================

const STAGE_UPDATE_THROTTLE_MS = 16; // ~60fps
const TITLE_BAR_HEIGHT = 32;
const BORDER_WIDTH = 1;
const PADDING = 0;

// ============================================================================
// Context
// ============================================================================

interface WindowManagerContextValue {
  state: WindowManagerState;
  createWindow: (config: {
    capsuleId: string;
    spaceId: string;
    title?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  }) => CapsuleWindowId;
  destroyWindow: (windowId: CapsuleWindowId) => void;
  focusWindow: (windowId: CapsuleWindowId) => void;
  moveWindow: (windowId: CapsuleWindowId, x: number, y: number, options?: { force?: boolean }) => void;
  resizeWindow: (windowId: CapsuleWindowId, width: number, height: number, options?: { force?: boolean }) => void;
  closeWindow: (windowId: CapsuleWindowId) => void;
  minimizeWindow: (windowId: CapsuleWindowId) => void;
  maximizeWindow: (windowId: CapsuleWindowId) => void;
  restoreWindow: (windowId: CapsuleWindowId, options?: { force?: boolean }) => void;
  tabWindow: (windowId: CapsuleWindowId, tabsetId: string) => void;
  snapWindow: (windowId: CapsuleWindowId, snap: WindowSnap) => void;
  unsnapWindow: (windowId: CapsuleWindowId, options?: { force?: boolean }) => void;
  getWindow: (windowId: CapsuleWindowId) => CapsuleWindow | undefined;
  getFocusedWindow: () => CapsuleWindow | undefined;
  getWindowsByCapsule: (capsuleId: string) => CapsuleWindow[];
  reopenCapsule: (capsuleId: string) => CapsuleWindowId | undefined;
  getContentBounds: (windowId: CapsuleWindowId, options?: { titleBarHeight?: number }) => { x: number; y: number; width: number; height: number } | null;
  getContentBoundsForElectron: (windowId: CapsuleWindowId, options?: { titleBarHeight?: number }) => { x: number; y: number; width: number; height: number } | null;
  subscribe: (callback: (event: WindowEvent) => void) => () => void;
  subscribeBounds: (callback: (windowId: CapsuleWindowId, bounds: { x: number; y: number; width: number; height: number }) => void) => () => void;
}

const WindowManagerContext = createContext<WindowManagerContextValue | null>(null);

export function useWindowManager(): WindowManagerContextValue {
  const context = useContext(WindowManagerContext);
  if (!context) {
    throw new Error('useWindowManager must be used within a WindowManagerProvider');
  }
  return context;
}

// ============================================================================
// Reducer
// ============================================================================

function reducer(state: WindowManagerState, action: WindowAction): WindowManagerState {
  switch (action.type) {
    case 'create': {
      const id = action.window.id || generateWindowId();
      const window: CapsuleWindow = {
        ...DEFAULT_WINDOW,
        ...action.window,
        id,
        z: state.nextZIndex,
        state: 'normal',
        snap: null,
      };

      const clamped = clampPosition(
        window.x,
        window.y,
        window.width,
        window.height,
        state.canvasBounds
      );
      window.x = clamped.x;
      window.y = clamped.y;

      const windows = new Map(state.windows);
      windows.set(id, window);

      return {
        ...state,
        windows,
        nextZIndex: state.nextZIndex + 1,
        focusedWindowId: id,
      };
    }

    case 'destroy': {
      const windows = new Map(state.windows);
      windows.delete(action.windowId);

      let focusedWindowId = state.focusedWindowId;
      if (focusedWindowId === action.windowId) {
        let maxZ = -1;
        for (const window of windows.values()) {
          if (window.z > maxZ) {
            maxZ = window.z;
            focusedWindowId = window.id;
          }
        }
        if (maxZ === -1) {
          focusedWindowId = null;
        }
      }

      return {
        ...state,
        windows,
        focusedWindowId,
      };
    }

    case 'focus': {
      const window = state.windows.get(action.windowId);
      if (!window) return state;

      const windows = new Map(state.windows);
      windows.set(action.windowId, { ...window, z: state.nextZIndex });

      return {
        ...state,
        windows,
        focusedWindowId: action.windowId,
        nextZIndex: state.nextZIndex + 1,
      };
    }

    case 'move': {
      const window = state.windows.get(action.windowId);
      if (!window || !window.draggable) return state;
      if (window.state !== 'normal') return state;

      const clamped = clampPosition(
        action.x,
        action.y,
        window.width,
        window.height,
        state.canvasBounds
      );

      const windows = new Map(state.windows);
      windows.set(action.windowId, { ...window, x: clamped.x, y: clamped.y });

      return {
        ...state,
        windows,
      };
    }

    case 'resize': {
      const window = state.windows.get(action.windowId);
      if (!window || !window.resizable) return state;
      if (window.state !== 'normal') return state;

      const width = Math.max(window.minWidth, Math.min(action.width, window.maxWidth || Infinity));
      const height = Math.max(window.minHeight, Math.min(action.height, window.maxHeight || Infinity));

      const windows = new Map(state.windows);
      windows.set(action.windowId, { ...window, width, height });

      return {
        ...state,
        windows,
      };
    }

    case 'close': {
      const window = state.windows.get(action.windowId);
      if (!window || !window.closable) return state;

      const windows = new Map(state.windows);
      windows.set(action.windowId, { ...window, state: 'closed' });

      return {
        ...state,
        windows,
        focusedWindowId: state.focusedWindowId === action.windowId ? null : state.focusedWindowId,
      };
    }

    case 'minimize': {
      const window = state.windows.get(action.windowId);
      if (!window || !window.minimizable) return state;
      if (window.state === 'minimized') return state;

      const windows = new Map(state.windows);
      windows.set(action.windowId, { ...window, state: 'minimized' });
      proofRecorder.mark('WINDOW_MINIMIZED', { windowId: action.windowId, capsuleId: window.capsuleId });
      console.log('[PROOF] WINDOW_MINIMIZED', { windowId: action.windowId, capsuleId: window.capsuleId });

      return {
        ...state,
        windows,
      };
    }

    case 'maximize': {
      const window = state.windows.get(action.windowId);
      if (!window || !window.maximizable) return state;
      if (window.state === 'maximized') return state;

      const windows = new Map(state.windows);
      windows.set(action.windowId, {
        ...window,
        state: 'maximized',
        snap: null,
        x: state.canvasBounds.x,
        y: state.canvasBounds.y,
        width: state.canvasBounds.width,
        height: state.canvasBounds.height,
      });

      return {
        ...state,
        windows,
      };
    }

    case 'restore': {
      const window = state.windows.get(action.windowId);
      if (!window || (window.state === 'normal' && window.snap === null)) return state;

      const windows = new Map(state.windows);
      windows.set(action.windowId, { ...window, state: 'normal' });
      proofRecorder.mark('WINDOW_RESTORED', { windowId: action.windowId, capsuleId: window.capsuleId });
      console.log('[PROOF] WINDOW_RESTORED', { windowId: action.windowId, capsuleId: window.capsuleId });

      return {
        ...state,
        windows,
      };
    }

    case 'tab': {
      const window = state.windows.get(action.windowId);
      if (!window || window.state === 'tabbed') return state;

      const windows = new Map(state.windows);
      windows.set(action.windowId, { ...window, state: 'tabbed' });
      proofRecorder.mark('WINDOW_TABBED', { windowId: action.windowId, capsuleId: window.capsuleId, tabsetId: action.tabsetId });
      console.log('[PROOF] WINDOW_TABBED', { windowId: action.windowId, capsuleId: window.capsuleId, tabsetId: action.tabsetId });

      return {
        ...state,
        windows,
        focusedWindowId: state.focusedWindowId === action.windowId ? null : state.focusedWindowId,
      };
    }

    case 'snap': {
      const window = state.windows.get(action.windowId);
      if (!window || window.state !== 'normal') return state;

      const snapBounds = getSnapBounds(window, state.canvasBounds);
      if (!snapBounds) return state;

      const windows = new Map(state.windows);
      windows.set(action.windowId, {
        ...window,
        x: snapBounds.x,
        y: snapBounds.y,
        width: snapBounds.width,
        height: snapBounds.height,
        snap: action.snap,
      });

      return {
        ...state,
        windows,
      };
    }

    case 'unsnap': {
      const window = state.windows.get(action.windowId);
      if (!window || !window.snap) return state;

      const windows = new Map(state.windows);
      windows.set(action.windowId, { ...window, snap: null });

      return {
        ...state,
        windows,
      };
    }

    default:
      return state;
  }
}

// ============================================================================
// Provider
// ============================================================================

interface WindowManagerProviderProps {
  children: React.ReactNode;
  initialCanvasBounds?: { x: number; y: number; width: number; height: number };
}

export function WindowManagerProvider({
  children,
  initialCanvasBounds = { x: 0, y: 0, width: 1920, height: 1080 },
}: WindowManagerProviderProps) {
  const subscribers = useRef<Set<(event: WindowEvent) => void>>(new Set());
  const boundsSubscribers = useRef<Set<(windowId: CapsuleWindowId, bounds: { x: number; y: number; width: number; height: number }) => void>>(new Set());
  const lastBoundsUpdate = useRef<Map<CapsuleWindowId, number>>();

  // Initialize the Map once
  if (!lastBoundsUpdate.current) {
    lastBoundsUpdate.current = new Map();
  }

  const [state, dispatch] = useReducer(reducer, {
    windows: new Map(),
    focusedWindowId: null,
    nextZIndex: 100,
    canvasBounds: initialCanvasBounds,
  });

  const emitEvent = useCallback((type: WindowEvent['type'], windowId: CapsuleWindowId, payload?: Record<string, unknown>) => {
    const event: WindowEvent = {
      type,
      windowId,
      timestamp: Date.now(),
      payload,
    };
    subscribers.current.forEach((callback) => callback(event));
  }, []);

  const emitBoundsUpdate = useCallback(
    (
      windowId: CapsuleWindowId,
      bounds: { x: number; y: number; width: number; height: number },
      options?: { force?: boolean }
    ) => {
      const now = Date.now();
      const lastUpdate = lastBoundsUpdate.current?.get(windowId) ?? 0;

      // Force emit skips throttle - used on pointerup to guarantee final state
      if (options?.force || now - lastUpdate >= STAGE_UPDATE_THROTTLE_MS) {
        boundsSubscribers.current.forEach((callback) => callback(windowId, bounds));
        lastBoundsUpdate.current?.set(windowId, now);
      }
    },
    []
  );

  const createWindow = useCallback(
    (config: {
      capsuleId: string;
      spaceId: string;
      title?: string;
      x?: number;
      y?: number;
      width?: number;
      height?: number;
    }) => {
      const id = `win_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const windowConfig = {
        id,
        capsuleId: config.capsuleId,
        spaceId: config.spaceId,
        title: config.title,
        x: config.x ?? DEFAULT_WINDOW.x,
        y: config.y ?? DEFAULT_WINDOW.y,
        width: config.width ?? DEFAULT_WINDOW.width,
        height: config.height ?? DEFAULT_WINDOW.height,
        resizable: DEFAULT_WINDOW.resizable,
        draggable: DEFAULT_WINDOW.draggable,
        closable: DEFAULT_WINDOW.closable,
        minimizable: DEFAULT_WINDOW.minimizable,
        maximizable: DEFAULT_WINDOW.maximizable,
        minWidth: DEFAULT_WINDOW.minWidth,
        minHeight: DEFAULT_WINDOW.minHeight,
        maxWidth: DEFAULT_WINDOW.maxWidth,
        maxHeight: DEFAULT_WINDOW.maxHeight,
      };
      dispatch({
        type: 'create',
        window: windowConfig,
      });
      emitEvent('window:created', id);
      return id;
    },
    [emitEvent]
  );

  const destroyWindow = useCallback(
    (windowId: CapsuleWindowId) => {
      emitEvent('window:destroyed', windowId);
      dispatch({ type: 'destroy', windowId });
    },
    [emitEvent]
  );

  const focusWindow = useCallback(
    (windowId: CapsuleWindowId) => {
      dispatch({ type: 'focus', windowId });
      emitEvent('window:focused', windowId);
    },
    [emitEvent]
  );

  const moveWindow = useCallback(
    (windowId: CapsuleWindowId, x: number, y: number, options?: { force?: boolean }) => {
      dispatch({ type: 'move', windowId, x, y });
      const window = state.windows.get(windowId);
      if (window) {
        emitBoundsUpdate(windowId, { x, y, width: window.width, height: window.height }, options);
      }
      emitEvent('window:moved', windowId, { x, y });
    },
    [state.windows, emitEvent, emitBoundsUpdate]
  );

  const resizeWindow = useCallback(
    (windowId: CapsuleWindowId, width: number, height: number, options?: { force?: boolean }) => {
      dispatch({ type: 'resize', windowId, width, height });
      const window = state.windows.get(windowId);
      if (window) {
        emitBoundsUpdate(windowId, { x: window.x, y: window.y, width, height }, options);
      }
      emitEvent('window:resized', windowId, { width, height });
    },
    [state.windows, emitEvent, emitBoundsUpdate]
  );

  const closeWindow = useCallback(
    (windowId: CapsuleWindowId) => {
      emitEvent('window:closed', windowId);
      dispatch({ type: 'close', windowId });
    },
    [emitEvent]
  );

  const minimizeWindow = useCallback(
    (windowId: CapsuleWindowId) => {
      dispatch({ type: 'minimize', windowId });
      emitEvent('window:minimized', windowId);
    },
    [emitEvent]
  );

  const maximizeWindow = useCallback(
    (windowId: CapsuleWindowId) => {
      dispatch({ type: 'maximize', windowId });
      emitEvent('window:maximized', windowId);
    },
    [emitEvent]
  );

  const restoreWindow = useCallback(
    (windowId: CapsuleWindowId, options?: { force?: boolean }) => {
      dispatch({ type: 'restore', windowId });
      const window = state.windows.get(windowId);
      if (window) {
        emitBoundsUpdate(windowId, { x: window.x, y: window.y, width: window.width, height: window.height }, options);
      }
      emitEvent('window:restored', windowId);
    },
    [state.windows, emitEvent, emitBoundsUpdate]
  );

  const tabWindow = useCallback(
    (windowId: CapsuleWindowId, tabsetId: string) => {
      dispatch({ type: 'tab', windowId, tabsetId });
      emitEvent('window:tabbed', windowId, { tabsetId });
    },
    [emitEvent]
  );

  const reopenCapsule = useCallback(
    (capsuleId: string) => {
      // Find a closed window for this capsule
      let windowId: CapsuleWindowId | undefined;
      for (const window of state.windows.values()) {
        if (window.capsuleId === capsuleId && window.state === 'closed') {
          windowId = window.id;
          break;
        }
      }

      if (windowId) {
        restoreWindow(windowId);
        emitEvent('window:reopened', windowId);
        return windowId;
      }
      return undefined;
    },
    [state.windows, restoreWindow, emitEvent]
  );

  const unsnapWindow = useCallback(
    (windowId: CapsuleWindowId, options?: { force?: boolean }) => {
      dispatch({ type: 'unsnap', windowId });
      const window = state.windows.get(windowId);
      if (window) {
        emitBoundsUpdate(windowId, { x: window.x, y: window.y, width: window.width, height: window.height }, options);
      }
      emitEvent('window:unsnapped', windowId);
    },
    [state.windows, emitEvent, emitBoundsUpdate]
  );

  const snapWindow = useCallback(
    (windowId: CapsuleWindowId, snap: WindowSnap) => {
      dispatch({ type: 'snap', windowId, snap });
      emitEvent('window:snapped', windowId, { snap });
    },
    [emitEvent]
  );

  const getWindow = useCallback(
    (windowId: CapsuleWindowId) => state.windows.get(windowId),
    [state.windows]
  );

  const getFocusedWindow = useCallback(() => {
    if (!state.focusedWindowId) return undefined;
    return state.windows.get(state.focusedWindowId);
  }, [state.focusedWindowId, state.windows]);

  const getWindowsByCapsule = useCallback(
    (capsuleId: string) => {
      const result: CapsuleWindow[] = [];
      for (const window of state.windows.values()) {
        if (window.capsuleId === capsuleId) {
          result.push(window);
        }
      }
      return result;
    },
    [state.windows]
  );

  const getContentBounds = useCallback(
    (windowId: CapsuleWindowId, options?: { titleBarHeight?: number }) => {
      const window = state.windows.get(windowId);
      if (!window) return null;

      const titleHeight = options?.titleBarHeight ?? TITLE_BAR_HEIGHT;

      return {
        x: window.x + BORDER_WIDTH + PADDING,
        y: window.y + titleHeight + BORDER_WIDTH + PADDING,
        width: window.width - (BORDER_WIDTH + PADDING) * 2,
        height: window.height - titleHeight - (BORDER_WIDTH + PADDING) * 2,
      };
    },
    [state.windows]
  );

  /**
    * Convert content bounds to Electron's coordinate space.
    * Note: BrowserView.setBounds() uses DIP coordinates, which are equivalent to CSS pixels.
    * We return bounds directly without DPR conversion.
    */
  const getContentBoundsForElectron = useCallback(
    (
      windowId: CapsuleWindowId,
      options?: { titleBarHeight?: number }
    ): { x: number; y: number; width: number; height: number } | null => {
      return getContentBounds(windowId, options);
    },
    [getContentBounds]
  );

  const subscribe = useCallback((callback: (event: WindowEvent) => void) => {
    subscribers.current.add(callback);
    return () => {
      subscribers.current.delete(callback);
    };
  }, []);

  const subscribeBounds = useCallback(
    (callback: (windowId: CapsuleWindowId, bounds: { x: number; y: number; width: number; height: number }) => void) => {
      boundsSubscribers.current.add(callback);
      return () => {
        boundsSubscribers.current.delete(callback);
      };
    },
    []
  );

  return (
    <WindowManagerContext.Provider
      value={{
        state,
        createWindow,
        destroyWindow,
        focusWindow,
        moveWindow,
        resizeWindow,
        closeWindow,
        minimizeWindow,
        maximizeWindow,
        restoreWindow,
        tabWindow,
        snapWindow,
        unsnapWindow,
        getWindow,
        getFocusedWindow,
        getWindowsByCapsule,
        reopenCapsule,
        getContentBounds,
        getContentBoundsForElectron,
        subscribe,
        subscribeBounds,
      }}
    >
      {children}
    </WindowManagerContext.Provider>
  );
}

// ============================================================================
// Hooks
// ============================================================================

export function useWindow(windowId: CapsuleWindowId): CapsuleWindow | undefined {
  return useWindowManager().getWindow(windowId);
}

export function useFocusedWindow(): CapsuleWindow | undefined {
  return useWindowManager().getFocusedWindow();
}

export function useWindowEvents(callback: (event: WindowEvent) => void): () => void {
  return useWindowManager().subscribe(callback);
}

export function useWindowBounds(windowId: CapsuleWindowId, callback: (bounds: { x: number; y: number; width: number; height: number }) => void) {
  const { getContentBounds, subscribeBounds } = useWindowManager();
  const window = useWindow(windowId);

  useEffect(() => {
    if (!window) return;

    const unsubscribe = subscribeBounds((wid, bounds) => {
      if (wid === windowId) {
        callback(bounds);
      }
    });

    // Initial bounds
    const contentBounds = getContentBounds(windowId);
    if (contentBounds) {
      callback(contentBounds);
    }

    return unsubscribe;
  }, [windowId, callback, getContentBounds, subscribeBounds]);
}

// ============================================================================
// Constants Export
// ============================================================================

export const WINDOW_CONSTANTS = {
  TITLE_BAR_HEIGHT,
  BORDER_WIDTH,
  PADDING,
  STAGE_UPDATE_THROTTLE_MS,
};
