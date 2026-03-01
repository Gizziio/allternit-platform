/**
 * @fileoverview Application Menu Builder
 * @module main/menu/app-menu
 * 
 * Builds the native application menu for macOS, Windows, and Linux.
 * Implements 7 menu sections: App, File, Edit, View, Agent, Window, Help.
 * 
 * @author T3-A2: Native Menus specialist
 * @version 1.0.0
 */

import { Menu, MenuItemConstructorOptions, app, dialog, shell, BrowserWindow } from 'electron';
import { windowManager } from '../window/WindowManager';

// Theme management
let currentTheme: 'light' | 'dark' | 'system' = 'system';

function getTheme(): 'light' | 'dark' | 'system' {
  return currentTheme;
}

function setTheme(theme: 'light' | 'dark' | 'system'): void {
  currentTheme = theme;
  // Notify all windows of theme change
  windowManager.getAllWindows().forEach(window => {
    window.webContents.send('view:theme-changed', theme);
  });
  // Refresh menu to update radio button state
  const menu = buildApplicationMenu();
  Menu.setApplicationMenu(menu);
}

// About window handler
function showAboutWindow(): void {
  const focusedWindow = windowManager.getFocusedWindow();
  if (focusedWindow) {
    focusedWindow.webContents.send('app:show-about');
  }
}

// Settings handler
function openSettings(): void {
  const focusedWindow = windowManager.getFocusedWindow();
  if (focusedWindow) {
    focusedWindow.webContents.send('app:open-settings');
  }
}

// Workflow opener
function openWorkflow(): void {
  const focusedWindow = windowManager.getFocusedWindow();
  if (!focusedWindow) return;

  dialog.showOpenDialog(focusedWindow, {
    title: 'Open Workflow',
    filters: [
      { name: 'Workflow Files', extensions: ['json', 'yaml', 'yml', 'a2r'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile']
  }).then(result => {
    if (!result.canceled && result.filePaths.length > 0) {
      focusedWindow.webContents.send('file:open-workflow', result.filePaths[0]);
    }
  }).catch(err => {
    console.error('[Menu] Failed to open workflow:', err);
  });
}

// Check for updates
function checkForUpdates(): void {
  const focusedWindow = windowManager.getFocusedWindow();
  if (focusedWindow) {
    focusedWindow.webContents.send('app:check-updates');
  }
  // Also open the releases page
  shell.openExternal('https://github.com/a2rchitect/releases');
}

// Helper to send messages to focused window
function sendToFocusedWindow(channel: string, ...args: any[]): void {
  const window = windowManager.getFocusedWindow();
  if (window && !window.isDestroyed()) {
    window.webContents.send(channel, ...args);
  }
}

/**
 * Builds the complete application menu
 * @returns {Menu} The built application menu
 */
export function buildApplicationMenu(): Menu {
  const template: MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin' ? [buildAppMenu()] : []),
    buildFileMenu(),
    buildEditMenu(),
    buildViewMenu(),
    buildAgentMenu(),
    buildWindowMenu(),
    buildHelpMenu(),
  ];

  return Menu.buildFromTemplate(template);
}

/**
 * macOS App Menu (only shown on macOS)
 */
function buildAppMenu(): MenuItemConstructorOptions {
  return {
    label: app.getName(),
    submenu: [
      {
        label: 'About A2rchitect',
        click: () => showAboutWindow(),
      },
      { type: 'separator' },
      {
        label: 'Preferences...',
        accelerator: 'CmdOrCtrl+,',
        click: () => openSettings(),
      },
      { type: 'separator' },
      {
        label: 'Services',
        role: 'services',
        submenu: [],
      },
      { type: 'separator' },
      {
        label: 'Hide A2rchitect',
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
        accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
        click: () => app.quit(),
      },
    ],
  };
}

/**
 * File Menu
 */
function buildFileMenu(): MenuItemConstructorOptions {
  const fileMenu: MenuItemConstructorOptions = {
    label: 'File',
    submenu: [
      {
        label: 'New Chat',
        accelerator: 'CmdOrCtrl+N',
        click: () => sendToFocusedWindow('file:new-chat'),
      },
      {
        label: 'New Window',
        accelerator: 'CmdOrCtrl+Shift+N',
        click: () => windowManager.createWindow(),
      },
      { type: 'separator' },
      {
        label: 'Open Workflow...',
        accelerator: 'CmdOrCtrl+O',
        click: () => openWorkflow(),
      },
      {
        label: 'Save',
        accelerator: 'CmdOrCtrl+S',
        click: () => sendToFocusedWindow('file:save'),
      },
      {
        label: 'Save As...',
        accelerator: 'CmdOrCtrl+Shift+S',
        click: () => sendToFocusedWindow('file:save-as'),
      },
      { type: 'separator' },
      {
        label: 'Close Tab',
        accelerator: 'CmdOrCtrl+W',
        click: () => sendToFocusedWindow('file:close-tab'),
      },
    ],
  };

  // Add quit option for non-macOS platforms
  if (process.platform !== 'darwin') {
    (fileMenu.submenu as MenuItemConstructorOptions[]).push(
      { type: 'separator' },
      {
        label: 'Exit',
        accelerator: 'Ctrl+Q',
        click: () => app.quit(),
      }
    );
  }

  return fileMenu;
}

/**
 * Edit Menu
 */
function buildEditMenu(): MenuItemConstructorOptions {
  return {
    label: 'Edit',
    submenu: [
      { label: 'Undo', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
      { label: 'Redo', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
      { type: 'separator' },
      { label: 'Cut', accelerator: 'CmdOrCtrl+X', role: 'cut' },
      { label: 'Copy', accelerator: 'CmdOrCtrl+C', role: 'copy' },
      { label: 'Paste', accelerator: 'CmdOrCtrl+V', role: 'paste' },
      {
        label: 'Paste and Match Style',
        accelerator: 'CmdOrCtrl+Shift+V',
        role: 'pasteAndMatchStyle',
      },
      { label: 'Delete', role: 'delete' },
      { label: 'Select All', accelerator: 'CmdOrCtrl+A', role: 'selectAll' },
      { type: 'separator' },
      {
        label: 'Find',
        accelerator: 'CmdOrCtrl+F',
        click: () => sendToFocusedWindow('edit:find'),
      },
      {
        label: 'Find Next',
        accelerator: 'CmdOrCtrl+G',
        click: () => sendToFocusedWindow('edit:find-next'),
      },
      {
        label: 'Find Previous',
        accelerator: 'Shift+CmdOrCtrl+G',
        click: () => sendToFocusedWindow('edit:find-previous'),
      },
    ],
  };
}

/**
 * View Menu
 */
function buildViewMenu(): MenuItemConstructorOptions {
  return {
    label: 'View',
    submenu: [
      {
        label: 'Reload',
        accelerator: 'CmdOrCtrl+R',
        click: (_, window) => window?.reload(),
      },
      {
        label: 'Force Reload',
        accelerator: 'CmdOrCtrl+Shift+R',
        click: (_, window) => window?.webContents.reloadIgnoringCache(),
      },
      {
        label: 'Toggle Developer Tools',
        accelerator: process.platform === 'darwin' ? 'Alt+Cmd+I' : 'Ctrl+Shift+I',
        click: (_, window) => window?.webContents.toggleDevTools(),
      },
      { type: 'separator' },
      {
        label: 'Actual Size',
        accelerator: 'CmdOrCtrl+0',
        click: (_, window) => window?.webContents.setZoomLevel(0),
      },
      {
        label: 'Zoom In',
        accelerator: 'CmdOrCtrl+Plus',
        click: (_, window) => {
          const level = window?.webContents.getZoomLevel() || 0;
          window?.webContents.setZoomLevel(level + 0.5);
        },
      },
      {
        label: 'Zoom Out',
        accelerator: 'CmdOrCtrl+-',
        click: (_, window) => {
          const level = window?.webContents.getZoomLevel() || 0;
          window?.webContents.setZoomLevel(level - 0.5);
        },
      },
      { type: 'separator' },
      {
        label: 'Toggle Full Screen',
        accelerator: process.platform === 'darwin' ? 'Ctrl+Cmd+F' : 'F11',
        click: (_, window) => window?.setFullScreen(!window.isFullScreen()),
      },
      { type: 'separator' },
      {
        label: 'Appearance',
        submenu: [
          {
            label: 'Light',
            type: 'radio',
            checked: getTheme() === 'light',
            click: () => setTheme('light'),
          },
          {
            label: 'Dark',
            type: 'radio',
            checked: getTheme() === 'dark',
            click: () => setTheme('dark'),
          },
          {
            label: 'System',
            type: 'radio',
            checked: getTheme() === 'system',
            click: () => setTheme('system'),
          },
        ],
      },
    ],
  };
}

/**
 * Agent Menu
 */
function buildAgentMenu(): MenuItemConstructorOptions {
  return {
    label: 'Agent',
    submenu: [
      {
        label: 'New Agent Session',
        accelerator: 'CmdOrCtrl+Shift+A',
        click: () => sendToFocusedWindow('agent:new-session'),
      },
      {
        label: 'Stop Agent',
        accelerator: 'Escape',
        click: () => sendToFocusedWindow('agent:stop'),
      },
      { type: 'separator' },
      {
        label: 'Open Agent Panel',
        accelerator: 'CmdOrCtrl+Shift+P',
        click: () => sendToFocusedWindow('agent:open-panel'),
      },
      {
        label: 'View Workflows',
        accelerator: 'CmdOrCtrl+Shift+W',
        click: () => sendToFocusedWindow('agent:view-workflows'),
      },
      { type: 'separator' },
      {
        label: 'Clear Conversation',
        click: () => sendToFocusedWindow('agent:clear-conversation'),
      },
    ],
  };
}

/**
 * Window Menu
 */
function buildWindowMenu(): MenuItemConstructorOptions {
  return {
    label: 'Window',
    submenu: [
      {
        label: 'New Window',
        accelerator: 'CmdOrCtrl+Shift+N',
        click: () => windowManager.createWindow(),
      },
      { type: 'separator' },
      {
        label: 'Minimize',
        accelerator: 'CmdOrCtrl+M',
        role: 'minimize',
      },
      {
        label: 'Close',
        accelerator: 'CmdOrCtrl+W',
        role: 'close',
      },
      { type: 'separator' },
      {
        label: 'Bring All to Front',
        role: 'front',
      },
      ...buildWindowList(),
    ],
  };
}

/**
 * Help Menu
 */
function buildHelpMenu(): MenuItemConstructorOptions {
  return {
    label: 'Help',
    submenu: [
      {
        label: 'Keyboard Shortcuts',
        accelerator: 'CmdOrCtrl+/',
        click: () => sendToFocusedWindow('help:shortcuts'),
      },
      {
        label: 'Documentation',
        click: () => shell.openExternal('https://docs.a2rchitect.io'),
      },
      { type: 'separator' },
      {
        label: 'Report Issue',
        click: () => shell.openExternal('https://github.com/a2rchitect/issues'),
      },
      {
        label: 'Check for Updates',
        click: () => checkForUpdates(),
      },
      { type: 'separator' },
      {
        label: 'About A2rchitect',
        click: () => showAboutWindow(),
        visible: process.platform !== 'darwin', // Only show on non-macOS (macOS has it in App menu)
      },
    ],
  };
}

/**
 * Builds the dynamic window list for the Window menu
 * @returns {MenuItemConstructorOptions[]} Array of window menu items
 */
function buildWindowList(): MenuItemConstructorOptions[] {
  const windows = windowManager.getAllWindows();
  if (windows.length === 0) return [];

  const windowItems: MenuItemConstructorOptions[] = [
    { type: 'separator' },
  ];

  windows.forEach((window, index) => {
    const title = window.getTitle() || `Window ${index + 1}`;
    windowItems.push({
      label: title,
      accelerator: index < 9 ? `CmdOrCtrl+${index + 1}` : undefined,
      click: () => {
        if (window && !window.isDestroyed()) {
          window.focus();
        }
      },
    });
  });

  return windowItems;
}

/**
 * Updates the window list in the application menu
 * Call this whenever a window is created or destroyed
 */
export function updateWindowMenu(): void {
  const menu = buildApplicationMenu();
  Menu.setApplicationMenu(menu);
}
