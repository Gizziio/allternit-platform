/**
 * Window Manager
 * 
 * Central manager for all application windows.
 * Handles window lifecycle, state persistence, and multi-window coordination.
 * 
 * @module window/WindowManager
 */

import { app, BrowserWindow, screen } from 'electron';
import { 
  getWindowState as getStoredWindowState, 
  setWindowState as storeWindowState, 
  ensureWindowVisible, 
  getDisplayId,
  WindowState,
  getLastWindowState,
} from './window-state';

/** Configuration for creating a managed window */
export interface WindowConfig {
  /** Unique window ID (auto-generated if not provided) */
  id?: string;
  /** URL to load in the window */
  url?: string;
  /** Initial window bounds */
  bounds?: Electron.Rectangle;
  /** Whether window should be maximized */
  maximized?: boolean;
  /** Whether window should be fullscreen */
  fullscreen?: boolean;
  /** Whether window should always stay on top */
  alwaysOnTop?: boolean;
  /** Window title */
  title?: string;
  /** Whether to show window immediately (default: false, waits for ready-to-show) */
  show?: boolean;
  /** Additional BrowserWindow options */
  windowOptions?: Electron.BrowserWindowConstructorOptions;
}

/** Internal representation of a managed window */
interface ManagedWindow {
  id: string;
  window: BrowserWindow;
  config: WindowConfig;
  createdAt: number;
}

/** Debounce timer type */
type DebounceTimer = ReturnType<typeof setTimeout>;

/** Simple ID generator */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Window Manager class
 * 
 * Manages all application windows with state persistence and multi-monitor support.
 */
export class WindowManager {
  /** Map of window IDs to managed windows */
  private windows = new Map<string, ManagedWindow>();
  
  /** Currently focused window ID */
  private focusedWindowId: string | null = null;
  
  /** Debounce timers for state saving */
  private debounceTimers = new Map<string, DebounceTimer>();
  
  /** Default debounce delay for state saves (ms) */
  private readonly DEBOUNCE_DELAY = 500;

  /**
   * Create a new managed window
   * @param config - Window configuration
   * @returns Promise resolving to the created BrowserWindow
   */
  async createWindow(config: WindowConfig = {}): Promise<BrowserWindow> {
    const windowId = config.id || generateId();
    const savedState = getStoredWindowState(windowId);

    // Calculate bounds with fallback chain: config -> saved state -> default
    const bounds = this.calculateBounds(config, savedState ?? null);
    const safeBounds = ensureWindowVisible(bounds);

    // Create the BrowserWindow
    const window = new BrowserWindow({
      width: safeBounds.width,
      height: safeBounds.height,
      x: safeBounds.x,
      y: safeBounds.y,
      title: config.title || 'A2rchitect Shell',
      show: config.show ?? false, // Don't show until ready-to-show
      alwaysOnTop: config.alwaysOnTop ?? false,
      ...config.windowOptions,
    });

    // Restore state
    if (savedState?.maximized || config.maximized) {
      window.maximize();
    }
    if (config.fullscreen || savedState?.fullscreen) {
      window.setFullScreen(true);
    }

    // Show when ready
    window.once('ready-to-show', () => {
      if (!window.isDestroyed()) {
        window.show();
        window.focus();
      }
    });

    // Load URL after the ready-to-show handler is attached.
    const url = config.url || this.getDefaultUrl();
    await window.loadURL(url);

    // Track the window
    const managedWindow: ManagedWindow = {
      id: windowId,
      window,
      config,
      createdAt: Date.now(),
    };
    
    this.windows.set(windowId, managedWindow);
    this.setupWindowEvents(window, windowId);

    return window;
  }

  /**
   * Calculate window bounds from config and saved state
   */
  private calculateBounds(
    config: WindowConfig, 
    savedState: WindowState | null
  ): Electron.Rectangle {
    // Priority: config bounds -> saved bounds -> default
    const bounds = config.bounds || savedState?.bounds || { x: 100, y: 100, width: 1280, height: 800 };
    return bounds;
  }

  /**
   * Setup event handlers for a window
   */
  private setupWindowEvents(window: BrowserWindow, id: string): void {
    // Focus tracking
    window.on('focus', () => {
      this.focusedWindowId = id;
    });

    // State saving with debounce
    const saveState = () => this.debouncedSaveState(id);
    
    window.on('resize', saveState);
    window.on('move', saveState);
    window.on('maximize', saveState);
    window.on('unmaximize', saveState);
    window.on('enter-full-screen', saveState);
    window.on('leave-full-screen', saveState);

    // Cleanup on close
    window.on('closed', () => {
      this.cleanupWindow(id);
    });

    // Handle window crashes
    window.webContents.on('render-process-gone', (_, details) => {
      console.error(`[WindowManager] Window ${id} render process gone:`, details);
    });

    window.webContents.on('unresponsive', () => {
      console.warn(`[WindowManager] Window ${id} is unresponsive`);
    });
  }

  /**
   * Debounced state save to reduce I/O
   */
  private debouncedSaveState(id: string): void {
    // Clear existing timer
    const existingTimer = this.debounceTimers.get(id);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
      this.saveWindowStateImmediate(id);
      this.debounceTimers.delete(id);
    }, this.DEBOUNCE_DELAY);

    this.debounceTimers.set(id, timer);
  }

  /**
   * Immediately save window state
   */
  private saveWindowStateImmediate(id: string): void {
    const managed = this.windows.get(id);
    if (!managed || managed.window.isDestroyed()) return;

    const window = managed.window;
    const bounds = window.getBounds();
    const displayId = getDisplayId(bounds);

    const state: WindowState = {
      bounds,
      maximized: window.isMaximized(),
      fullscreen: window.isFullScreen(),
      displayId,
    };

    storeWindowState(id, state);
  }

  /**
   * Cleanup window resources
   */
  private cleanupWindow(id: string): void {
    // Clear debounce timer
    const timer = this.debounceTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(id);
    }

    // Remove from tracking
    this.windows.delete(id);

    // Update focused window if needed
    if (this.focusedWindowId === id) {
      this.focusedWindowId = null;
    }
  }

  /**
   * Get the default URL for windows
   */
  private getDefaultUrl(): string {
    if (!app.isPackaged || process.env.VITE_DEV_SERVER_URL) {
      return process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5177';
    }
    return `file://${require('path').join(__dirname, '../renderer/index.html')}`;
  }

  /**
   * Get a window by ID
   * @param id - Window ID
   * @returns BrowserWindow or undefined
   */
  getWindow(id: string): BrowserWindow | undefined {
    return this.windows.get(id)?.window;
  }

  /**
   * Get the currently focused window
   * @returns BrowserWindow or undefined
   */
  getFocusedWindow(): BrowserWindow | undefined {
    return this.focusedWindowId ? this.getWindow(this.focusedWindowId) : undefined;
  }

  /**
   * Get the ID of the currently focused window
   * @returns Window ID or null
   */
  getFocusedWindowId(): string | null {
    return this.focusedWindowId;
  }

  /**
   * Get all managed windows
   * @returns Array of BrowserWindows
   */
  getAllWindows(): BrowserWindow[] {
    return Array.from(this.windows.values())
      .map(w => w.window)
      .filter(w => !w.isDestroyed());
  }

  /**
   * Get all managed window IDs
   * @returns Array of window IDs
   */
  getAllWindowIds(): string[] {
    return Array.from(this.windows.keys());
  }

  /**
   * Get window ID for a BrowserWindow
   * @param window - BrowserWindow to look up
   * @returns Window ID or undefined
   */
  getWindowId(window: BrowserWindow): string | undefined {
    const entries = Array.from(this.windows.entries());
    for (const [id, managed] of entries) {
      if (managed.window === window) {
        return id;
      }
    }
    return undefined;
  }

  /**
   * Close a specific window
   * @param id - Window ID
   */
  closeWindow(id: string): void {
    const managed = this.windows.get(id);
    if (managed && !managed.window.isDestroyed()) {
      managed.window.close();
    }
  }

  /**
   * Close all managed windows
   */
  closeAllWindows(): void {
    this.getAllWindows().forEach(window => {
      if (!window.isDestroyed()) {
        window.close();
      }
    });
  }

  /**
   * Minimize a window
   * @param id - Window ID
   */
  minimizeWindow(id: string): void {
    const window = this.getWindow(id);
    if (window && !window.isDestroyed()) {
      window.minimize();
    }
  }

  /**
   * Maximize or unmaximize a window
   * @param id - Window ID
   */
  toggleMaximize(id: string): void {
    const window = this.getWindow(id);
    if (window && !window.isDestroyed()) {
      if (window.isMaximized()) {
        window.unmaximize();
      } else {
        window.maximize();
      }
    }
  }

  /**
   * Toggle fullscreen for a window
   * @param id - Window ID
   */
  toggleFullscreen(id: string): void {
    const window = this.getWindow(id);
    if (window && !window.isDestroyed()) {
      window.setFullScreen(!window.isFullScreen());
    }
  }

  /**
   * Set always-on-top for a window
   * @param id - Window ID
   * @param enabled - Whether to enable always-on-top
   */
  setAlwaysOnTop(id: string, enabled: boolean): void {
    const window = this.getWindow(id);
    if (window && !window.isDestroyed()) {
      window.setAlwaysOnTop(enabled);
    }
  }

  /**
   * Focus a specific window
   * @param id - Window ID
   */
  focusWindow(id: string): void {
    const window = this.getWindow(id);
    if (window && !window.isDestroyed()) {
      if (window.isMinimized()) {
        window.restore();
      }
      window.focus();
    }
  }

  /**
   * Get window state information
   * @param id - Window ID
   * @returns Window state or null
   */
  getWindowStateInfo(id: string): { 
    maximized: boolean; 
    minimized: boolean; 
    fullscreen: boolean; 
    focused: boolean; 
    bounds: Electron.Rectangle;
    alwaysOnTop: boolean;
  } | null {
    const window = this.getWindow(id);
    if (!window || window.isDestroyed()) return null;

    return {
      maximized: window.isMaximized(),
      minimized: window.isMinimized(),
      fullscreen: window.isFullScreen(),
      focused: window.isFocused(),
      bounds: window.getBounds(),
      alwaysOnTop: window.isAlwaysOnTop(),
    };
  }

  /**
   * Get count of managed windows
   * @returns Window count
   */
  getWindowCount(): number {
    return this.getAllWindows().length;
  }

  /**
   * Check if a window exists and is not destroyed
   * @param id - Window ID
   * @returns True if window exists
   */
  hasWindow(id: string): boolean {
    const managed = this.windows.get(id);
    return managed !== undefined && !managed.window.isDestroyed();
  }

  /**
   * Save all window states immediately
   * Useful before app quit
   */
  saveAllWindowStates(): void {
    this.debounceTimers.forEach((timer, id) => {
      clearTimeout(timer);
      this.saveWindowStateImmediate(id);
    });
    this.debounceTimers.clear();
  }
}

/** Singleton instance of WindowManager */
export const windowManager = new WindowManager();
