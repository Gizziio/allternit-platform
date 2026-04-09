/**
 * @fileoverview Platform-Specific Menus
 * @module main/menu/platform-menus
 * 
 * Platform-specific menu customizations for macOS, Windows, and Linux.
 * Handles differences in menu conventions across operating systems.
 * 
 * @author T3-A2: Native Menus specialist
 * @version 1.0.0
 */

import { MenuItemConstructorOptions, app } from 'electron';
import { Shortcuts, getShortcut } from './menu-shortcuts';

/**
 * Platform type
 */
export type Platform = 'darwin' | 'win32' | 'linux';

/**
 * Current platform
 */
export const currentPlatform: Platform = process.platform as Platform;

/**
 * Checks if running on macOS
 */
export const isMac = currentPlatform === 'darwin';

/**
 * Checks if running on Windows
 */
export const isWindows = currentPlatform === 'win32';

/**
 * Checks if running on Linux
 */
export const isLinux = currentPlatform === 'linux';

/**
 * Gets the appropriate application menu label based on platform
 * @returns {string} The platform-appropriate app menu label
 */
export function getAppMenuLabel(): string {
  if (isMac) {
    return app.getName();
  }
  return 'File';
}

/**
 * Platform-specific menu structure adjustments
 */
export const PlatformMenuStructure = {
  /**
   * macOS uses the first menu item as the app menu
   * Windows/Linux typically use File as the first menu
   */
  darwin: {
    firstMenuLabel: app.getName(),
    hasAppMenu: true,
    preferencesLocation: 'app', // In app menu on macOS
    aboutLocation: 'app', // In app menu on macOS
    quitLocation: 'app', // In app menu on macOS
    windowMenu: true, // Has dedicated Window menu
  },
  win32: {
    firstMenuLabel: 'File',
    hasAppMenu: false,
    preferencesLocation: 'file', // In File menu on Windows
    aboutLocation: 'help', // In Help menu on Windows
    quitLocation: 'file', // Exit in File menu on Windows
    windowMenu: false, // Window controls in File menu
  },
  linux: {
    firstMenuLabel: 'File',
    hasAppMenu: false,
    preferencesLocation: 'edit', // In Edit menu on Linux (GNOME convention)
    aboutLocation: 'help', // In Help menu on Linux
    quitLocation: 'file', // In File menu on Linux
    windowMenu: true, // Has Window menu on Linux
  },
} as const;

/**
 * Gets platform-specific menu structure
 * @returns {typeof PlatformMenuStructure.darwin} Menu structure for current platform
 */
export function getPlatformMenuStructure() {
  return PlatformMenuStructure[currentPlatform];
}

/**
 * Creates platform-specific app menu items
 * @param handlers - Object containing click handlers
 * @returns {MenuItemConstructorOptions[]} Platform-specific menu items
 */
export function createPlatformAppMenu(
  handlers: {
    showAbout: () => void;
    openPreferences: () => void;
    checkForUpdates: () => void;
    quit: () => void;
  }
): MenuItemConstructorOptions[] {
  const structure = getPlatformMenuStructure();

  if (!structure.hasAppMenu) {
    return [];
  }

  // macOS App Menu
  return [
    {
      label: app.getName(),
      submenu: [
        {
          label: `About ${app.getName()}`,
          click: handlers.showAbout,
        },
        { type: 'separator' },
        {
          label: 'Preferences...',
          accelerator: getShortcut('app', 'preferences'),
          click: handlers.openPreferences,
        },
        { type: 'separator' },
        {
          label: 'Services',
          role: 'services',
          submenu: [],
        },
        { type: 'separator' },
        {
          label: `Hide ${app.getName()}`,
          accelerator: 'Command+H',
          role: 'hide',
        },
        {
          label: 'Hide Others',
          accelerator: 'Command+Shift+H',
          role: 'hideOthers',
        },
        {
          label: 'Show All',
          role: 'unhide',
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: getShortcut('app', 'quit'),
          click: handlers.quit,
        },
      ],
    },
  ];
}

/**
 * Creates platform-specific File menu
 * @param handlers - Object containing click handlers
 * @returns {MenuItemConstructorOptions} File menu configuration
 */
export function createPlatformFileMenu(
  handlers: {
    newChat: () => void;
    newWindow: () => void;
    openWorkflow: () => void;
    save: () => void;
    saveAs: () => void;
    closeTab: () => void;
    quit?: () => void;
  }
): MenuItemConstructorOptions {
  const structure = getPlatformMenuStructure();
  const submenu: MenuItemConstructorOptions[] = [
    {
      label: 'New Chat',
      accelerator: getShortcut('file', 'newChat'),
      click: handlers.newChat,
    },
    {
      label: 'New Window',
      accelerator: getShortcut('file', 'newWindow'),
      click: handlers.newWindow,
    },
    { type: 'separator' },
    {
      label: 'Open Workflow...',
      accelerator: getShortcut('file', 'open'),
      click: handlers.openWorkflow,
    },
    {
      label: 'Save',
      accelerator: getShortcut('file', 'save'),
      click: handlers.save,
    },
    {
      label: 'Save As...',
      accelerator: getShortcut('file', 'saveAs'),
      click: handlers.saveAs,
    },
    { type: 'separator' },
    {
      label: 'Close Tab',
      accelerator: getShortcut('file', 'closeTab'),
      click: handlers.closeTab,
    },
  ];

  // Add Exit/Quit on Windows/Linux
  if (!isMac && handlers.quit) {
    submenu.push(
      { type: 'separator' },
      {
        label: isWindows ? 'Exit' : 'Quit',
        accelerator: isWindows ? 'Alt+F4' : 'Ctrl+Q',
        click: handlers.quit,
      }
    );
  }

  return {
    label: 'File',
    submenu,
  };
}

/**
 * Creates platform-specific Window menu
 * @param handlers - Object containing click handlers
 * @param windowList - Dynamic window list items
 * @returns {MenuItemConstructorOptions | null} Window menu or null if not used on platform
 */
export function createPlatformWindowMenu(
  handlers: {
    newWindow: () => void;
    minimize: () => void;
    close: () => void;
    bringToFront: () => void;
  },
  windowList: MenuItemConstructorOptions[] = []
): MenuItemConstructorOptions | null {
  const structure = getPlatformMenuStructure();

  if (!structure.windowMenu && !isLinux) {
    return null;
  }

  return {
    label: 'Window',
    submenu: [
      {
        label: 'New Window',
        accelerator: getShortcut('window', 'newWindow'),
        click: handlers.newWindow,
      },
      { type: 'separator' },
      {
        label: 'Minimize',
        accelerator: getShortcut('window', 'minimize'),
        role: 'minimize',
      },
      {
        label: 'Close',
        accelerator: getShortcut('window', 'close'),
        role: 'close',
      },
      { type: 'separator' },
      {
        label: 'Bring All to Front',
        role: 'front',
        click: handlers.bringToFront,
      },
      ...windowList,
    ],
  };
}

/**
 * Creates platform-specific Help menu
 * @param handlers - Object containing click handlers
 * @returns {MenuItemConstructorOptions} Help menu configuration
 */
export function createPlatformHelpMenu(
  handlers: {
    showKeyboardShortcuts: () => void;
    openDocumentation: () => void;
    reportIssue: () => void;
    checkForUpdates: () => void;
    showAbout?: () => void;
  }
): MenuItemConstructorOptions {
  const structure = getPlatformMenuStructure();
  const submenu: MenuItemConstructorOptions[] = [
    {
      label: 'Keyboard Shortcuts',
      accelerator: getShortcut('help', 'keyboardShortcuts'),
      click: handlers.showKeyboardShortcuts,
    },
    {
      label: 'Documentation',
      click: handlers.openDocumentation,
    },
    { type: 'separator' },
    {
      label: 'Report Issue',
      click: handlers.reportIssue,
    },
    {
      label: 'Check for Updates',
      click: handlers.checkForUpdates,
    },
  ];

  // Add About on Windows/Linux (macOS has it in app menu)
  if (!isMac && handlers.showAbout) {
    submenu.push(
      { type: 'separator' },
      {
        label: `About ${app.getName()}`,
        click: handlers.showAbout,
      }
    );
  }

  return {
    label: 'Help',
    submenu,
  };
}

/**
 * Platform-specific theme handling
 */
export const PlatformThemeSupport = {
  darwin: {
    // macOS supports auto-switching based on system appearance
    supportsSystemTheme: true,
    nativeThemeIntegration: true,
  },
  win32: {
    // Windows 10/11 supports system theme
    supportsSystemTheme: true,
    nativeThemeIntegration: true,
  },
  linux: {
    // Linux support varies by desktop environment
    supportsSystemTheme: true,
    nativeThemeIntegration: false, // Requires manual detection
  },
} as const;

/**
 * Gets platform theme support capabilities
 * @returns {typeof PlatformThemeSupport.darwin} Theme support for current platform
 */
export function getPlatformThemeSupport() {
  return PlatformThemeSupport[currentPlatform];
}

/**
 * Platform-specific keyboard shortcut differences
 */
export const PlatformShortcutDifferences = {
  darwin: {
    modifierKey: 'Cmd',
    altKey: 'Option',
    deleteKey: 'Backspace',
    quitAccelerator: 'Cmd+Q',
  },
  win32: {
    modifierKey: 'Ctrl',
    altKey: 'Alt',
    deleteKey: 'Delete',
    quitAccelerator: 'Alt+F4',
  },
  linux: {
    modifierKey: 'Ctrl',
    altKey: 'Alt',
    deleteKey: 'Delete',
    quitAccelerator: 'Ctrl+Q',
  },
} as const;

/**
 * Gets platform-specific shortcut naming
 * @returns {typeof PlatformShortcutDifferences.darwin} Shortcut naming for current platform
 */
export function getPlatformShortcutNaming() {
  return PlatformShortcutDifferences[currentPlatform];
}
