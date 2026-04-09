/**
 * Window State Persistence Module
 * 
 * Manages persistent storage of window states.
 * Provides multi-monitor support and safe bounds restoration.
 * 
 * @module window/window-state
 */

import { screen, Rectangle, app } from 'electron';
import { join } from 'path';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';

/**
 * Window state interface for persistence
 */
export interface WindowState {
  /** Window bounds (position and size) */
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Whether window is maximized */
  maximized: boolean;
  /** Whether window is in fullscreen mode */
  fullscreen: boolean;
  /** Display ID where window was located */
  displayId?: string;
}

/**
 * Schema for window state storage
 */
interface WindowStateSchema {
  /** Map of window states by window ID */
  'window-state': {
    [windowId: string]: WindowState;
  };
  /** Last known window state for new windows */
  'last-window-state': WindowState;
}

/** Default window state */
const DEFAULT_WINDOW_STATE: WindowState = {
  bounds: { x: 100, y: 100, width: 1280, height: 800 },
  maximized: false,
  fullscreen: false,
};

/** Minimum window dimensions */
const MIN_WINDOW_WIDTH = 400;
const MIN_WINDOW_HEIGHT = 300;
const MIN_VISIBLE_AREA = 200; // Minimum visible area to consider window "on screen"

/** Storage file path */
function getStoragePath(): string {
  const userDataPath = app.getPath('userData');
  return join(userDataPath, 'window-state.json');
}

/** Load storage from disk */
function loadStorage(): WindowStateSchema {
  try {
    const path = getStoragePath();
    if (existsSync(path)) {
      const data = readFileSync(path, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('[WindowState] Failed to load storage:', error);
  }
  
  return {
    'window-state': {},
    'last-window-state': DEFAULT_WINDOW_STATE,
  };
}

/** Save storage to disk */
function saveStorage(data: WindowStateSchema): void {
  try {
    const path = getStoragePath();
    const dir = join(path, '..');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(path, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('[WindowState] Failed to save storage:', error);
  }
}

/** In-memory cache */
let cache: WindowStateSchema | null = null;

/**
 * Get storage data
 */
function getData(): WindowStateSchema {
  if (!cache) {
    cache = loadStorage();
  }
  return cache;
}

/**
 * Set storage data
 */
function setData(data: WindowStateSchema): void {
  cache = data;
  saveStorage(data);
}

/**
 * Get stored state for a specific window
 * @param windowId - Unique window identifier
 * @returns Window state or undefined if not found
 */
export function getWindowState(windowId: string): WindowState | undefined {
  const data = getData();
  return data['window-state'][windowId];
}

/**
 * Save window state for a specific window
 * Also updates the last-window-state for new windows
 * @param windowId - Unique window identifier
 * @param state - Window state to save
 */
export function setWindowState(windowId: string, state: WindowState): void {
  const data = getData();
  data['window-state'][windowId] = state;
  data['last-window-state'] = state;
  setData(data);
}

/**
 * Get the last known window state (for creating new windows)
 * @returns Last window state with safe bounds
 */
export function getLastWindowState(): WindowState {
  const data = getData();
  const state = data['last-window-state'];
  return {
    ...DEFAULT_WINDOW_STATE,
    ...state,
    bounds: ensureWindowVisible(state?.bounds || DEFAULT_WINDOW_STATE.bounds),
  };
}

/**
 * Clear stored state for a specific window
 * @param windowId - Unique window identifier
 */
export function clearWindowState(windowId: string): void {
  const data = getData();
  delete data['window-state'][windowId];
  setData(data);
}

/**
 * Get the display that contains (or is nearest to) the given bounds
 * @param bounds - Window bounds
 * @returns Display object
 */
export function getDisplayForWindow(bounds: Rectangle): Electron.Display {
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  return screen.getDisplayNearestPoint({ x: centerX, y: centerY });
}

/**
 * Ensure window bounds are visible on screen
 * Handles multi-monitor setups and display changes
 * @param bounds - Window bounds
 * @returns Adjusted bounds that are guaranteed visible
 */
export function ensureWindowVisible(bounds: Rectangle): Rectangle {
  const displays = screen.getAllDisplays();
  
  if (displays.length === 0) {
    // Fallback to primary display if no displays detected
    const primary = screen.getPrimaryDisplay();
    return {
      x: primary.workArea.x + 100,
      y: primary.workArea.y + 100,
      width: Math.min(bounds.width, primary.workArea.width - 200),
      height: Math.min(bounds.height, primary.workArea.height - 200),
    };
  }

  // Check if window is at least partially visible on any display
  const isVisibleOnAnyDisplay = displays.some(display => {
    const { workArea } = display;
    // Check if at least MIN_VISIBLE_AREA of the window is visible
    const intersectX = Math.max(0, Math.min(bounds.x + bounds.width, workArea.x + workArea.width) - Math.max(bounds.x, workArea.x));
    const intersectY = Math.max(0, Math.min(bounds.y + bounds.height, workArea.y + workArea.height) - Math.max(bounds.y, workArea.y));
    return intersectX >= MIN_VISIBLE_AREA && intersectY >= MIN_VISIBLE_AREA;
  });

  if (isVisibleOnAnyDisplay) {
    // Window is visible, just ensure minimum size
    const display = getDisplayForWindow(bounds);
    return {
      x: bounds.x,
      y: bounds.y,
      width: Math.max(MIN_WINDOW_WIDTH, Math.min(bounds.width, display.workArea.width)),
      height: Math.max(MIN_WINDOW_HEIGHT, Math.min(bounds.height, display.workArea.height)),
    };
  }

  // Window is not visible on any display, move to primary display
  const primary = screen.getPrimaryDisplay();
  return {
    x: primary.workArea.x + 100,
    y: primary.workArea.y + 100,
    width: Math.min(bounds.width, primary.workArea.width - 200),
    height: Math.min(bounds.height, primary.workArea.height - 200),
  };
}

/**
 * Get center position for a window of given size on the primary display
 * @param width - Window width
 * @param height - Window height
 * @returns Position coordinates
 */
export function getCenterPosition(width: number, height: number): { x: number; y: number } {
  const primary = screen.getPrimaryDisplay();
  return {
    x: Math.round(primary.workArea.x + (primary.workArea.width - width) / 2),
    y: Math.round(primary.workArea.y + (primary.workArea.height - height) / 2),
  };
}

/**
 * Get the current display ID for a window position
 * @param bounds - Window bounds
 * @returns Display ID string
 */
export function getDisplayId(bounds: Rectangle): string {
  const display = getDisplayForWindow(bounds);
  return display.id.toString();
}

/**
 * Check if displays have changed since window state was saved
 * @param state - Window state with displayId
 * @returns True if the original display is still available
 */
export function isDisplayAvailable(state: WindowState): boolean {
  if (!state.displayId) return false;
  const displays = screen.getAllDisplays();
  return displays.some(d => d.id.toString() === state.displayId);
}
