/**
 * Preload Script
 * 
 * Exposes safe APIs to the renderer process via contextBridge.
 * All window and system access goes through these controlled channels.
 */

import { contextBridge, ipcRenderer } from 'electron';

// ============================================================================
// Sidecar API
// ============================================================================

/**
 * API for managing the Rust sidecar/operator
 */
const sidecarAPI = {
  async start(): Promise<boolean> {
    return ipcRenderer.invoke('sidecar:start');
  },
  async stop(): Promise<boolean> {
    return ipcRenderer.invoke('sidecar:stop');
  },
  async restart(): Promise<boolean> {
    return ipcRenderer.invoke('sidecar:restart');
  },
  async getStatus(): Promise<'stopped' | 'starting' | 'running' | 'error' | 'crashed'> {
    return ipcRenderer.invoke('sidecar:get-status');
  },
  async getApiUrl(): Promise<string | undefined> {
    return ipcRenderer.invoke('sidecar:get-api-url');
  },
  async getAuthPassword(): Promise<string | undefined> {
    return ipcRenderer.invoke('sidecar:get-auth-password');
  },
  /** Get Basic Auth credentials (username, password, header) */
  async getBasicAuth(): Promise<{ username: string; password: string; header: string } | undefined> {
    return ipcRenderer.invoke('sidecar:get-basic-auth');
  },
  /** Get persisted configuration from previous session */
  async getPersistedConfig(): Promise<{ apiUrl: string; password: string; port: number } | null> {
    return ipcRenderer.invoke('sidecar:get-persisted-config');
  },
  /** Clear persisted configuration */
  async clearPersistedConfig(): Promise<boolean> {
    return ipcRenderer.invoke('sidecar:clear-persisted-config');
  },
  onStatusChanged(handler: (status: string) => void) {
    const channel = 'sidecar:status-changed';
    const listener = (_event: Electron.IpcRendererEvent, status: string) => handler(status);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
};

// ============================================================================
// Agent Runner API
// ============================================================================

/**
 * API for the agent runner window
 */
const agentRunnerAPI = {
  async setExpanded(expanded: boolean): Promise<void> {
    return ipcRenderer.invoke('agent-runner:setExpanded', expanded);
  },
  async close(): Promise<void> {
    return ipcRenderer.invoke('agent-runner:close');
  },
};

// ============================================================================
// Window Management API
// ============================================================================

/**
 * Window bounds interface
 */
interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Window state information
 */
interface WindowStateInfo {
  id: string;
  maximized: boolean;
  minimized: boolean;
  fullscreen: boolean;
  focused: boolean;
  bounds: WindowBounds;
  alwaysOnTop: boolean;
}

/**
 * Options for creating a new window
 */
interface CreateWindowOptions {
  type?: 'main' | 'settings' | 'about' | 'popout';
  url?: string;
  modal?: boolean;
}

/**
 * API for managing application windows
 */
const windowAPI = {
  /**
   * Create a new window
   * @param options - Window creation options
   * @returns Promise with window ID
   */
  async create(options?: CreateWindowOptions): Promise<{ success: boolean; id?: string; error?: string }> {
    return ipcRenderer.invoke('window:create', options);
  },

  /**
   * Close the current window or a specific window
   * @param windowId - Optional window ID to close
   */
  async close(windowId?: string): Promise<{ success: boolean; error?: string }> {
    return ipcRenderer.invoke('window:close', windowId);
  },

  /**
   * Minimize the current window
   */
  async minimize(): Promise<{ success: boolean; error?: string }> {
    return ipcRenderer.invoke('window:minimize');
  },

  /**
   * Maximize/unmaximize the current window
   * @returns New maximized state
   */
  async maximize(): Promise<{ success: boolean; maximized?: boolean; error?: string }> {
    return ipcRenderer.invoke('window:maximize');
  },

  /**
   * Toggle fullscreen mode
   * @param enabled - Optional explicit state
   * @returns New fullscreen state
   */
  async fullscreen(enabled?: boolean): Promise<{ success: boolean; fullscreen?: boolean; error?: string }> {
    return ipcRenderer.invoke('window:fullscreen', enabled);
  },

  /**
   * Set always-on-top state
   * @param enabled - Whether to enable always-on-top
   * @returns New alwaysOnTop state
   */
  async setAlwaysOnTop(enabled: boolean): Promise<{ success: boolean; alwaysOnTop?: boolean; error?: string }> {
    return ipcRenderer.invoke('window:set-always-on-top', enabled);
  },

  /**
   * Get current window state
   * @returns Window state info
   */
  async getState(): Promise<WindowStateInfo | null> {
    return ipcRenderer.invoke('window:get-state');
  },

  /**
   * Get all windows
   * @returns Array of window states
   */
  async getAll(): Promise<WindowStateInfo[]> {
    return ipcRenderer.invoke('window:get-all');
  },

  /**
   * Focus a specific window
   * @param windowId - Window ID to focus
   */
  async focus(windowId: string): Promise<{ success: boolean; error?: string }> {
    return ipcRenderer.invoke('window:focus', windowId);
  },

  /**
   * Set window bounds
   * @param bounds - Partial bounds to update
   */
  async setBounds(bounds: Partial<WindowBounds>): Promise<{ success: boolean; bounds?: WindowBounds; error?: string }> {
    return ipcRenderer.invoke('window:set-bounds', bounds);
  },

  /**
   * Center the window on screen
   */
  async center(): Promise<{ success: boolean; bounds?: WindowBounds; error?: string }> {
    return ipcRenderer.invoke('window:center');
  },

  /**
   * Flash the window frame for attention
   * @param flag - Whether to start or stop flashing
   */
  async flashFrame(flag: boolean): Promise<{ success: boolean; error?: string }> {
    return ipcRenderer.invoke('window:flash-frame', flag);
  },

  /**
   * Set the window title
   * @param title - New title
   */
  async setTitle(title: string): Promise<{ success: boolean; error?: string }> {
    return ipcRenderer.invoke('window:set-title', title);
  },

  /**
   * Get the currently focused window ID
   */
  async getFocusedId(): Promise<string | null> {
    return ipcRenderer.invoke('window:get-focused-id');
  },

  /**
   * Close all windows
   */
  async closeAll(): Promise<{ success: boolean }> {
    return ipcRenderer.invoke('window:close-all');
  },

  /**
   * Get the total window count
   */
  async getCount(): Promise<number> {
    return ipcRenderer.invoke('window:get-count');
  },

  /**
   * Check if a window exists
   * @param windowId - Window ID to check
   */
  async exists(windowId: string): Promise<boolean> {
    return ipcRenderer.invoke('window:exists', windowId);
  },

  /**
   * Hide the window
   */
  async hide(): Promise<{ success: boolean; error?: string }> {
    return ipcRenderer.invoke('window:hide');
  },

  /**
   * Show the window
   */
  async show(): Promise<{ success: boolean; error?: string }> {
    return ipcRenderer.invoke('window:show');
  },

  /**
   * Minimize to tray (hide but don't close)
   */
  async minimizeToTray(): Promise<{ success: boolean; error?: string }> {
    return ipcRenderer.invoke('window:minimize-to-tray');
  },

  /**
   * Listen for window state changes
   * @param event - Event name
   * @param handler - Event handler
   * @returns Cleanup function
   */
  onWindowEvent(event: string, handler: (payload: unknown) => void): () => void {
    const channel = `window:event:${event}`;
    const listener = (_event: Electron.IpcRendererEvent, payload: unknown) => handler(payload);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
};

// ============================================================================
// A2R Usage Host API (Legacy compatibility)
// ============================================================================

const a2rUsageHost = {
  async invoke(command: string, ...args: unknown[]) {
    return ipcRenderer.invoke('a2r-usage:invoke', command, ...args);
  },
  async setWindowSize(width: number, height: number) {
    return ipcRenderer.invoke('a2r-usage:setWindowSize', { width, height });
  },
  async getVersion() {
    return ipcRenderer.invoke('a2r-usage:getVersion');
  },
  async resolveResource(resource: string) {
    return ipcRenderer.invoke('a2r-usage:resolveResource', resource);
  },
  async setTrayIcon(data: string) {
    return ipcRenderer.invoke('a2r-usage:setTrayIcon', data);
  },
  async setTrayIconAsTemplate(value: boolean) {
    return ipcRenderer.invoke('a2r-usage:setTrayIconAsTemplate', value);
  },
  async currentMonitor() {
    return ipcRenderer.invoke('a2r-usage:currentMonitor');
  },
  listen(event: string, handler: (payload: unknown) => void) {
    const channel = `a2r-usage:event:${event}`;
    const listener = (_event: Electron.IpcRendererEvent, payload: unknown) => handler(payload);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
};

// ============================================================================
// Chrome Embed API
// ============================================================================

/**
 * API for launching and controlling an embedded real Chrome browser window
 * alongside the Electron shell.
 */
const chromeEmbedAPI = {
  /** Launch Chrome with a URL. Chrome opens as a separate window positioned beside the shell. */
  async launch(url: string): Promise<{ success: boolean; pid?: number; debugPort?: number; error?: string }> {
    return ipcRenderer.invoke('chrome:launch', url);
  },

  /** Navigate the embedded Chrome window to a new URL via CDP. */
  async navigate(url: string): Promise<{ success: boolean; error?: string }> {
    return ipcRenderer.invoke('chrome:navigate', url);
  },

  /** Close the embedded Chrome instance. */
  async close(): Promise<{ success: boolean }> {
    return ipcRenderer.invoke('chrome:close');
  },

  /**
   * Get a container handle for embedding Chrome inside a DOM element.
   * Note: Full embedding is not yet supported — Chrome runs as a side-by-side window.
   * This method returns a stub so callers can gracefully fall back.
   */
  async getContainerHandle(_opts: { elementId: string }): Promise<{ success: boolean; handle?: unknown }> {
    // Side-by-side mode — no true embedding handle available
    return { success: false };
  },

  /**
   * Embed Chrome into a container handle.
   * Note: Not yet supported — Chrome runs as a side-by-side window.
   */
  async embed(_handle: unknown): Promise<{ success: boolean }> {
    return { success: false };
  },
};

// ============================================================================
// Expose APIs to Renderer
// ============================================================================

contextBridge.exposeInMainWorld('a2AgentRunner', agentRunnerAPI);
contextBridge.exposeInMainWorld('a2rUsageHost', a2rUsageHost);
contextBridge.exposeInMainWorld('a2rSidecar', sidecarAPI);
contextBridge.exposeInMainWorld('a2rWindow', windowAPI);
contextBridge.exposeInMainWorld('chromeEmbed', chromeEmbedAPI);

// TypeScript declarations for the exposed APIs
declare global {
  interface Window {
    a2AgentRunner: typeof agentRunnerAPI;
    a2rUsageHost: typeof a2rUsageHost;
    a2rSidecar: typeof sidecarAPI;
    a2rWindow: typeof windowAPI;
    chromeEmbed: typeof chromeEmbedAPI;
  }
}

// Log that preload loaded
console.log('[PRELOAD] Loaded');
