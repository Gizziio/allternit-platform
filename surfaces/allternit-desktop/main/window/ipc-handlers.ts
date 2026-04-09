/**
 * Window IPC Handlers
 * 
 * Registers IPC handlers for window control from renderer processes.
 * 
 * @module window/ipc-handlers
 */

import { ipcMain, BrowserWindow } from 'electron';
import { windowManager } from './WindowManager';
import { createWindow, CreateWindowOptions } from './createWindow';

/**
 * Window state info type
 */
interface WindowStateInfo {
  id: string;
  maximized: boolean;
  minimized: boolean;
  fullscreen: boolean;
  focused: boolean;
  bounds: Electron.Rectangle;
  alwaysOnTop: boolean;
}

/**
 * Register all window-related IPC handlers
 */
export function registerWindowIPC(): void {
  // Window creation
  ipcMain.handle('window:create', async (_, options: CreateWindowOptions = {}) => {
    try {
      const window = await createWindow(options);
      const id = windowManager.getWindowId(window);
      return { success: true, id, windowId: id };
    } catch (error) {
      console.error('[IPC] Failed to create window:', error);
      return { success: false, error: String(error) };
    }
  });

  // Window closing
  ipcMain.handle('window:close', (_, windowId: string) => {
    try {
      if (windowId) {
        windowManager.closeWindow(windowId);
      } else {
        // Close the window that sent the request
        const senderWindow = BrowserWindow.fromWebContents(_.sender);
        if (senderWindow && !senderWindow.isDestroyed()) {
          senderWindow.close();
        }
      }
      return { success: true };
    } catch (error) {
      console.error('[IPC] Failed to close window:', error);
      return { success: false, error: String(error) };
    }
  });

  // Window minimization
  ipcMain.handle('window:minimize', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && !window.isDestroyed()) {
      window.minimize();
      return { success: true };
    }
    return { success: false, error: 'Window not found' };
  });

  // Window maximize/unmaximize
  ipcMain.handle('window:maximize', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && !window.isDestroyed()) {
      if (window.isMaximized()) {
        window.unmaximize();
      } else {
        window.maximize();
      }
      return { success: true, maximized: window.isMaximized() };
    }
    return { success: false, error: 'Window not found' };
  });

  // Fullscreen toggle
  ipcMain.handle('window:fullscreen', (event, enabled?: boolean) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && !window.isDestroyed()) {
      if (typeof enabled === 'boolean') {
        window.setFullScreen(enabled);
      } else {
        window.setFullScreen(!window.isFullScreen());
      }
      return { success: true, fullscreen: window.isFullScreen() };
    }
    return { success: false, error: 'Window not found' };
  });

  // Always on top toggle
  ipcMain.handle('window:set-always-on-top', (event, enabled: boolean) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && !window.isDestroyed()) {
      window.setAlwaysOnTop(enabled);
      return { success: true, alwaysOnTop: window.isAlwaysOnTop() };
    }
    return { success: false, error: 'Window not found' };
  });

  // Get window state
  ipcMain.handle('window:get-state', (event): WindowStateInfo | null => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window || window.isDestroyed()) return null;

    const id = windowManager.getWindowId(window) || `native-${window.id}`;

    return {
      id,
      maximized: window.isMaximized(),
      minimized: window.isMinimized(),
      fullscreen: window.isFullScreen(),
      focused: window.isFocused(),
      bounds: window.getBounds(),
      alwaysOnTop: window.isAlwaysOnTop(),
    };
  });

  // Get all windows
  ipcMain.handle('window:get-all', () => {
    return windowManager.getAllWindowIds().map(id => {
      const state = windowManager.getWindowStateInfo(id);
      return state ? { id, ...state } : null;
    }).filter(Boolean);
  });

  // Focus window
  ipcMain.handle('window:focus', (_, windowId: string) => {
    try {
      windowManager.focusWindow(windowId);
      return { success: true };
    } catch (error) {
      console.error('[IPC] Failed to focus window:', error);
      return { success: false, error: String(error) };
    }
  });

  // Set window bounds
  ipcMain.handle('window:set-bounds', (event, bounds: Partial<Electron.Rectangle>) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && !window.isDestroyed()) {
      const currentBounds = window.getBounds();
      window.setBounds({ ...currentBounds, ...bounds });
      return { success: true, bounds: window.getBounds() };
    }
    return { success: false, error: 'Window not found' };
  });

  // Center window
  ipcMain.handle('window:center', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && !window.isDestroyed()) {
      window.center();
      return { success: true, bounds: window.getBounds() };
    }
    return { success: false, error: 'Window not found' };
  });

  // Flash frame (for attention)
  ipcMain.handle('window:flash-frame', (event, flag: boolean) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && !window.isDestroyed()) {
      window.flashFrame(flag);
      return { success: true };
    }
    return { success: false, error: 'Window not found' };
  });

  // Set window title
  ipcMain.handle('window:set-title', (event, title: string) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && !window.isDestroyed()) {
      window.setTitle(title);
      return { success: true };
    }
    return { success: false, error: 'Window not found' };
  });

  // Get focused window ID
  ipcMain.handle('window:get-focused-id', () => {
    return windowManager.getFocusedWindowId();
  });

  // Close all windows
  ipcMain.handle('window:close-all', () => {
    windowManager.closeAllWindows();
    return { success: true };
  });

  // Get window count
  ipcMain.handle('window:get-count', () => {
    return windowManager.getWindowCount();
  });

  // Check if window exists
  ipcMain.handle('window:exists', (_, windowId: string) => {
    return windowManager.hasWindow(windowId);
  });

  // Show/hide window
  ipcMain.handle('window:hide', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && !window.isDestroyed()) {
      window.hide();
      return { success: true };
    }
    return { success: false, error: 'Window not found' };
  });

  ipcMain.handle('window:show', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && !window.isDestroyed()) {
      window.show();
      return { success: true };
    }
    return { success: false, error: 'Window not found' };
  });

  // Minimize to tray (hide, don't close)
  ipcMain.handle('window:minimize-to-tray', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && !window.isDestroyed()) {
      window.hide();
      return { success: true };
    }
    return { success: false, error: 'Window not found' };
  });

  console.log('[WindowIPC] Registered window IPC handlers');
}

/**
 * Unregister all window IPC handlers
 * Call this when the app is shutting down
 */
export function unregisterWindowIPC(): void {
  const channels = [
    'window:create',
    'window:close',
    'window:minimize',
    'window:maximize',
    'window:fullscreen',
    'window:set-always-on-top',
    'window:get-state',
    'window:get-all',
    'window:focus',
    'window:set-bounds',
    'window:center',
    'window:flash-frame',
    'window:set-title',
    'window:get-focused-id',
    'window:close-all',
    'window:get-count',
    'window:exists',
    'window:hide',
    'window:show',
    'window:minimize-to-tray',
  ];

  channels.forEach(channel => {
    ipcMain.removeHandler(channel);
  });

  console.log('[WindowIPC] Unregistered window IPC handlers');
}
