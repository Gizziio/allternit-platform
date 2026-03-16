/**
 * Application Menu
 *
 * Manages the application menu bar for macOS and minimal menu for Windows/Linux.
 * Includes keyboard shortcuts, mode switchers, and recent sessions submenu.
 */

import {
  app,
  Menu,
  MenuItemConstructorOptions,
  shell,
  dialog,
  ipcMain,
  BrowserWindow,
} from 'electron';
import { getWindowManager } from './window-manager';

interface RecentSession {
  id: string;
  name: string;
  timestamp: number;
}

let recentSessions: RecentSession[] = [];
const MAX_RECENT_SESSIONS = 10;

/**
 * Add a session to recent sessions
 */
export function addRecentSession(sessionId: string, sessionName: string): void {
  recentSessions = recentSessions.filter((s) => s.id !== sessionId);

  recentSessions.unshift({
    id: sessionId,
    name: sessionName,
    timestamp: Date.now(),
  });

  if (recentSessions.length > MAX_RECENT_SESSIONS) {
    recentSessions = recentSessions.slice(0, MAX_RECENT_SESSIONS);
  }

  updateApplicationMenu();
}

/**
 * Clear recent sessions
 */
export function clearRecentSessions(): void {
  recentSessions = [];
  updateApplicationMenu();
}

/**
 * Get recent sessions
 */
export function getRecentSessions(): RecentSession[] {
  return [...recentSessions];
}

/**
 * Send mode switch command to renderer
 */
function switchMode(mode: string): void {
  const windowManager = getWindowManager();
  const mainWindow = windowManager?.getMainWindow();

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('menu:switchMode', mode);
  }
}

/**
 * Send open settings command to renderer
 */
function openSettings(): void {
  const windowManager = getWindowManager();
  const mainWindow = windowManager?.getMainWindow();

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('menu:openSettings');
  }
}

/**
 * Send new session command to renderer
 */
function newSession(): void {
  const windowManager = getWindowManager();
  const mainWindow = windowManager?.getMainWindow();

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('menu:newSession');
  }
}

/**
 * Send open session command to renderer
 */
function openSession(sessionId: string): void {
  const windowManager = getWindowManager();
  const mainWindow = windowManager?.getMainWindow();

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('menu:openSession', sessionId);
  }
}

/**
 * Build macOS application menu
 */
function buildMacOSMenu(): Menu {
  const template: MenuItemConstructorOptions[] = [
    {
      label: app.getName(),
      submenu: [
        {
          label: 'About A2R',
          click: () => {
            const windowManager = getWindowManager();
            const mainWindow = windowManager?.getMainWindow();
            dialog.showMessageBox(mainWindow || undefined, {
              type: 'info',
              title: 'About A2R',
              message: 'A2R',
              detail: `Version: ${app.getVersion()}\n\nAI-to-Reasoning interface for agent collaboration.`,
              buttons: ['OK'],
            });
          },
        },
        { type: 'separator' },
        {
          label: 'Preferences...',
          accelerator: 'CmdOrCtrl+,',
          click: openSettings,
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
          accelerator: 'Command+Q',
          click: () => {
            app.quit();
          },
        },
      ],
    },
    {
      label: 'File',
      submenu: [
        {
          label: 'New Session',
          accelerator: 'CmdOrCtrl+N',
          click: newSession,
        },
        {
          label: 'Open Recent',
          submenu: [
            ...recentSessions.map(
              (session): MenuItemConstructorOptions => ({
                label: session.name,
                click: () => openSession(session.id),
              })
            ),
            { type: 'separator' },
            {
              label: 'Clear Recent',
              enabled: recentSessions.length > 0,
              click: clearRecentSessions,
            },
          ],
        },
        { type: 'separator' },
        {
          label: 'Close Window',
          accelerator: 'CmdOrCtrl+W',
          role: 'close',
        },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'pasteAndMatchStyle' },
        { role: 'delete' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Chat',
          accelerator: 'CmdOrCtrl+1',
          click: () => switchMode('chat'),
        },
        {
          label: 'Workflows',
          accelerator: 'CmdOrCtrl+2',
          click: () => switchMode('workflows'),
        },
        {
          label: 'Agent Mail',
          accelerator: 'CmdOrCtrl+3',
          click: () => switchMode('agent-mail'),
        },
        {
          label: 'Memory & Policy',
          accelerator: 'CmdOrCtrl+4',
          click: () => switchMode('memory-policy'),
        },
        {
          label: 'Skills',
          accelerator: 'CmdOrCtrl+5',
          click: () => switchMode('skills'),
        },
        { type: 'separator' },
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          role: 'reload',
        },
        {
          label: 'Force Reload',
          accelerator: 'CmdOrCtrl+Shift+R',
          role: 'forceReload',
        },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'Alt+Command+I',
          role: 'toggleDevTools',
        },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' },
        { type: 'separator' },
        {
          label: 'Picture in Picture',
          accelerator: 'CmdOrCtrl+Shift+P',
          click: () => {
            getWindowManager()?.createPictureInPicture();
          },
        },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'A2R Help',
          click: () => {
            shell.openExternal('https://docs.a2r.dev');
          },
        },
        {
          label: 'Keyboard Shortcuts',
          accelerator: 'CmdOrCtrl+/',
          click: () => {
            const windowManager = getWindowManager();
            const mainWindow = windowManager?.getMainWindow();
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('menu:showKeyboardShortcuts');
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Report Issue',
          click: () => {
            shell.openExternal('https://github.com/a2r/issues');
          },
        },
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}

/**
 * Build Windows/Linux menu
 */
function buildWindowsLinuxMenu(): Menu {
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Session',
          accelerator: 'Ctrl+N',
          click: newSession,
        },
        {
          label: 'Open Recent',
          submenu: [
            ...recentSessions.map(
              (session): MenuItemConstructorOptions => ({
                label: session.name,
                click: () => openSession(session.id),
              })
            ),
            { type: 'separator' },
            {
              label: 'Clear Recent',
              enabled: recentSessions.length > 0,
              click: clearRecentSessions,
            },
          ],
        },
        { type: 'separator' },
        {
          label: 'Settings',
          accelerator: 'Ctrl+,',
          click: openSettings,
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'Ctrl+Q',
          click: () => app.quit(),
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Chat',
          accelerator: 'Ctrl+1',
          click: () => switchMode('chat'),
        },
        {
          label: 'Workflows',
          accelerator: 'Ctrl+2',
          click: () => switchMode('workflows'),
        },
        {
          label: 'Agent Mail',
          accelerator: 'Ctrl+3',
          click: () => switchMode('agent-mail'),
        },
        {
          label: 'Memory & Policy',
          accelerator: 'Ctrl+4',
          click: () => switchMode('memory-policy'),
        },
        {
          label: 'Skills',
          accelerator: 'Ctrl+5',
          click: () => switchMode('skills'),
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About A2R',
          click: () => {
            dialog.showMessageBox({
              type: 'info',
              title: 'About A2R',
              message: 'A2R',
              detail: `Version: ${app.getVersion()}`,
              buttons: ['OK'],
            });
          },
        },
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}

/**
 * Create and set the application menu
 */
export function createApplicationMenu(): void {
  if (process.platform === 'darwin') {
    Menu.setApplicationMenu(buildMacOSMenu());
  } else {
    Menu.setApplicationMenu(buildWindowsLinuxMenu());
  }
}

/**
 * Update the application menu (rebuild with current state)
 */
export function updateApplicationMenu(): void {
  createApplicationMenu();
}

/**
 * Get the current application menu
 */
export function getApplicationMenu(): Menu | null {
  return Menu.getApplicationMenu();
}

/**
 * Show context menu at position
 */
export function showContextMenu(
  template: MenuItemConstructorOptions[],
  browserWindow?: BrowserWindow
): void {
  const menu = Menu.buildFromTemplate(template);
  menu.popup({ window: browserWindow });
}

/**
 * Register IPC handlers for menu
 */
export function registerMenuIpcHandlers(): void {
  ipcMain.handle('menu:addRecentSession', (_, sessionId: string, sessionName: string) => {
    addRecentSession(sessionId, sessionName);
  });

  ipcMain.handle('menu:clearRecentSessions', () => {
    clearRecentSessions();
  });

  ipcMain.handle('menu:getRecentSessions', () => {
    return getRecentSessions();
  });

  ipcMain.handle('menu:update', () => {
    updateApplicationMenu();
  });
}
