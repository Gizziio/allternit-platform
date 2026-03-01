/**
 * Window Menu Module
 * 
 * Builds the Window menu for the application menu bar.
 * Follows platform conventions (macOS, Windows, Linux).
 * 
 * @module window/window-menu
 */

import { MenuItemConstructorOptions, BrowserWindow, shell } from 'electron';
import { createWindow } from './createWindow';

/**
 * Build the Window menu
 * @returns Menu configuration object
 */
export function buildWindowMenu(): MenuItemConstructorOptions {
  const isMac = process.platform === 'darwin';

  return {
    label: isMac ? 'Window' : '&Window',
    submenu: [
      // New Window
      {
        label: 'New Window',
        accelerator: 'CmdOrCtrl+N',
        click: () => createWindow({ type: 'main' }),
      },
      { type: 'separator' },

      // Window state controls
      {
        label: 'Minimize',
        accelerator: 'CmdOrCtrl+M',
        role: 'minimize' as const,
      },
      {
        label: 'Zoom',
        role: 'zoom' as const,
      },
      {
        label: 'Toggle Full Screen',
        accelerator: isMac ? 'Ctrl+Cmd+F' : 'F11',
        click: (_, window) => {
          if (window) {
            window.setFullScreen(!window.isFullScreen());
          }
        },
      },
      { type: 'separator' },

      // Always on top
      {
        label: 'Always on Top',
        type: 'checkbox',
        click: (menuItem, window) => {
          if (window) {
            window.setAlwaysOnTop(menuItem.checked);
          }
        },
      },
      { type: 'separator' },

      // macOS specific window management
      ...(isMac
        ? [
            { type: 'separator' as const },
            {
              label: 'Bring All to Front',
              role: 'front' as const,
            },
          ]
        : []),

      // Special windows
      {
        label: 'Settings',
        accelerator: 'CmdOrCtrl+,',
        click: () => createWindow({ type: 'settings' }),
      },
      {
        label: 'About',
        click: () => createWindow({ type: 'about' }),
      },
      { type: 'separator' },

      // Close window
      {
        label: 'Close Window',
        accelerator: 'CmdOrCtrl+W',
        role: 'close' as const,
      },
    ],
  };
}

/**
 * Build the View menu (for zoom/development features)
 * @returns Menu configuration object
 */
export function buildViewMenu(): MenuItemConstructorOptions {
  const isMac = process.platform === 'darwin';

  return {
    label: '&View',
    submenu: [
      {
        label: 'Reload',
        accelerator: 'CmdOrCtrl+R',
        click: (_, window) => {
          if (window) {
            window.reload();
          }
        },
      },
      {
        label: 'Force Reload',
        accelerator: 'CmdOrCtrl+Shift+R',
        click: (_, window) => {
          if (window) {
            window.webContents.reloadIgnoringCache();
          }
        },
      },
      {
        label: 'Toggle Developer Tools',
        accelerator: isMac ? 'Alt+Cmd+I' : 'Ctrl+Shift+I',
        click: (_, window) => {
          if (window) {
            if (window.webContents.isDevToolsOpened()) {
              window.webContents.closeDevTools();
            } else {
              window.webContents.openDevTools();
            }
          }
        },
      },
      { type: 'separator' },
      {
        label: 'Actual Size',
        accelerator: 'CmdOrCtrl+0',
        click: (_, window) => {
          if (window) {
            window.webContents.setZoomLevel(0);
          }
        },
      },
      {
        label: 'Zoom In',
        accelerator: 'CmdOrCtrl+Plus',
        click: (_, window) => {
          if (window) {
            const currentZoom = window.webContents.getZoomLevel();
            window.webContents.setZoomLevel(currentZoom + 0.5);
          }
        },
      },
      {
        label: 'Zoom Out',
        accelerator: 'CmdOrCtrl+-',
        click: (_, window) => {
          if (window) {
            const currentZoom = window.webContents.getZoomLevel();
            window.webContents.setZoomLevel(currentZoom - 0.5);
          }
        },
      },
      { type: 'separator' },
      {
        label: 'Toggle Full Screen',
        accelerator: isMac ? 'Ctrl+Cmd+F' : 'F11',
        click: (_, window) => {
          if (window) {
            window.setFullScreen(!window.isFullScreen());
          }
        },
      },
    ],
  };
}

/**
 * Build the Help menu
 * @returns Menu configuration object
 */
export function buildHelpMenu(): MenuItemConstructorOptions {
  return {
    label: '&Help',
    submenu: [
      {
        label: 'Learn More',
        click: async () => {
          await shell.openExternal('https://a2rchitect.io');
        },
      },
      {
        label: 'Documentation',
        click: async () => {
          await shell.openExternal('https://docs.a2rchitect.io');
        },
      },
      {
        label: 'Community Discussions',
        click: async () => {
          await shell.openExternal('https://github.com/a2rchitect/community');
        },
      },
      {
        label: 'Search Issues',
        click: async () => {
          await shell.openExternal('https://github.com/a2rchitect/issues');
        },
      },
      { type: 'separator' },
      {
        label: 'About A2rchitect Shell',
        click: () => createWindow({ type: 'about' }),
      },
    ],
  };
}

/**
 * Build the complete application menu template
 * @returns Array of menu configurations
 */
export function buildApplicationMenu(): MenuItemConstructorOptions[] {
  const isMac = process.platform === 'darwin';

  const template: MenuItemConstructorOptions[] = [
    buildWindowMenu(),
    buildViewMenu(),
    buildHelpMenu(),
  ];

  // macOS app menu
  if (isMac) {
    template.unshift({
      label: 'A2rchitect Shell',
      submenu: [
        {
          label: 'About A2rchitect Shell',
          click: () => createWindow({ type: 'about' }),
        },
        { type: 'separator' },
        { role: 'services' as const },
        { type: 'separator' },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' },
        { role: 'quit' as const },
      ],
    });
  }

  return template;
}
