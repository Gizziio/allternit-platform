/**
 * Window Shortcuts Module
 * 
 * Manages global and window-level keyboard shortcuts for window management.
 * 
 * @module window/window-shortcuts
 */

import { globalShortcut, BrowserWindow, app } from 'electron';

/** Shortcut action types */
export type ShortcutAction = 
  | 'new-window'
  | 'close-window'
  | 'minimize'
  | 'maximize'
  | 'toggle-fullscreen'
  | 'reload'
  | 'toggle-devtools'
  | 'toggle-always-on-top'
  | 'zoom-in'
  | 'zoom-out'
  | 'zoom-reset';

/** Shortcut configuration */
interface ShortcutConfig {
  accelerator: string;
  action: ShortcutAction;
  global?: boolean;
}

/** Default shortcuts configuration */
const DEFAULT_SHORTCUTS: ShortcutConfig[] = [
  { accelerator: 'CmdOrCtrl+N', action: 'new-window' },
  { accelerator: 'CmdOrCtrl+W', action: 'close-window' },
  { accelerator: 'CmdOrCtrl+M', action: 'minimize' },
  { accelerator: 'CmdOrCtrl+Shift+M', action: 'maximize' },
  { accelerator: 'F11', action: 'toggle-fullscreen' },
  { accelerator: 'CmdOrCtrl+R', action: 'reload' },
  { accelerator: 'CmdOrCtrl+Shift+I', action: 'toggle-devtools' },
  { accelerator: 'CmdOrCtrl+Shift+T', action: 'toggle-always-on-top' },
  { accelerator: 'CmdOrCtrl+Plus', action: 'zoom-in' },
  { accelerator: 'CmdOrCtrl+-', action: 'zoom-out' },
  { accelerator: 'CmdOrCtrl+0', action: 'zoom-reset' },
];

/** Callback function type for shortcut actions */
type ShortcutHandler = (action: ShortcutAction, window?: BrowserWindow) => void;

/** Currently registered shortcuts */
const registeredShortcuts = new Map<string, () => void>();

/** Active shortcut handler */
let activeHandler: ShortcutHandler | null = null;

/**
 * Initialize window shortcuts with a handler
 * @param handler - Function to handle shortcut actions
 */
export function initializeShortcuts(handler: ShortcutHandler): void {
  activeHandler = handler;
  registerGlobalShortcuts();
}

/**
 * Register global shortcuts
 */
function registerGlobalShortcuts(): void {
  // Clear existing shortcuts
  unregisterAllShortcuts();

  // Register global shortcuts
  DEFAULT_SHORTCUTS.forEach(config => {
    if (config.global) {
      const success = globalShortcut.register(config.accelerator, () => {
        activeHandler?.(config.action);
      });
      
      if (success) {
        registeredShortcuts.set(config.accelerator, () => {
          activeHandler?.(config.action);
        });
      } else {
        console.warn(`[WindowShortcuts] Failed to register global shortcut: ${config.accelerator}`);
      }
    }
  });
}

/**
 * Handle shortcut action on a specific window
 * @param action - Shortcut action to perform
 * @param window - Target BrowserWindow
 */
export function handleWindowShortcut(action: ShortcutAction, window: BrowserWindow | undefined): void {
  if (!window || window.isDestroyed()) return;

  switch (action) {
    case 'close-window':
      window.close();
      break;

    case 'minimize':
      window.minimize();
      break;

    case 'maximize':
      if (window.isMaximized()) {
        window.unmaximize();
      } else {
        window.maximize();
      }
      break;

    case 'toggle-fullscreen':
      window.setFullScreen(!window.isFullScreen());
      break;

    case 'reload':
      window.reload();
      break;

    case 'toggle-devtools':
      if (window.webContents.isDevToolsOpened()) {
        window.webContents.closeDevTools();
      } else {
        window.webContents.openDevTools();
      }
      break;

    case 'toggle-always-on-top':
      window.setAlwaysOnTop(!window.isAlwaysOnTop());
      break;

    case 'zoom-in':
      {
        const currentZoom = window.webContents.getZoomLevel();
        window.webContents.setZoomLevel(currentZoom + 0.5);
      }
      break;

    case 'zoom-out':
      {
        const currentZoom = window.webContents.getZoomLevel();
        window.webContents.setZoomLevel(currentZoom - 0.5);
      }
      break;

    case 'zoom-reset':
      window.webContents.setZoomLevel(0);
      break;

    default:
      // For actions that need external handling (like new-window), 
      // they should be handled by the active handler
      activeHandler?.(action, window);
      break;
  }
}

/**
 * Unregister all global shortcuts
 */
export function unregisterAllShortcuts(): void {
  registeredShortcuts.forEach((_, accelerator) => {
    globalShortcut.unregister(accelerator);
  });
  registeredShortcuts.clear();
}

/**
 * Clean up all shortcuts
 */
export function cleanupShortcuts(): void {
  unregisterAllShortcuts();
  globalShortcut.unregisterAll();
  activeHandler = null;
}

/**
 * Register app event handlers for shortcut cleanup
 */
export function registerShortcutCleanup(): void {
  app.on('will-quit', cleanupShortcuts);
}

/**
 * Get accelerator for a specific action
 * @param action - Shortcut action
 * @returns Accelerator string or undefined
 */
export function getAcceleratorForAction(action: ShortcutAction): string | undefined {
  const config = DEFAULT_SHORTCUTS.find(s => s.action === action);
  return config?.accelerator;
}

/**
 * Get all configured shortcuts
 * @returns Array of shortcut configurations
 */
export function getConfiguredShortcuts(): ReadonlyArray<ShortcutConfig> {
  return Object.freeze([...DEFAULT_SHORTCUTS]);
}
