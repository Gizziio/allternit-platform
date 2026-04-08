/**
 * Window Management Module
 * 
 * Central export for all window management functionality.
 * Provides multi-window support with state persistence.
 * 
 * @module window
 * 
 * @example
 * ```typescript
 * import { windowManager, createWindow, registerWindowIPC } from './window';
 * 
 * // Register IPC handlers
 * registerWindowIPC();
 * 
 * // Create a window
 * const window = await createWindow({ type: 'main' });
 * 
 * // Use the window manager
 * windowManager.closeAllWindows();
 * ```
 */

// Core window manager
export { WindowManager, windowManager } from './WindowManager';
export type { WindowConfig } from './WindowManager';

// Window creation factory
export { 
  createWindow, 
  createAgentRunnerWindow,
  getDefaultDimensions, 
  isStatePersistent,
} from './createWindow';
export type { 
  CreateWindowOptions, 
  WindowType 
} from './createWindow';

// State persistence
export { 
  getWindowState, 
  setWindowState, 
  getLastWindowState, 
  clearWindowState,
  ensureWindowVisible,
  getDisplayForWindow,
  getCenterPosition,
  getDisplayId,
  isDisplayAvailable,
} from './window-state';
export type { WindowState } from './window-state';

// IPC handlers
export { 
  registerWindowIPC, 
  unregisterWindowIPC 
} from './ipc-handlers';

// Menu builders
export { 
  buildWindowMenu, 
  buildViewMenu, 
  buildHelpMenu,
  buildApplicationMenu 
} from './window-menu';

// Shortcuts
export { 
  initializeShortcuts, 
  cleanupShortcuts, 
  registerShortcutCleanup,
  handleWindowShortcut,
  getAcceleratorForAction,
  getConfiguredShortcuts,
} from './window-shortcuts';
export type { ShortcutAction } from './window-shortcuts';
