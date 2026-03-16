/**
 * Dock Integration (macOS only)
 *
 * Manages macOS dock interactions including bouncing, badge counts,
 * recent documents, and download progress.
 */

import { app, DownloadItem, ipcMain } from 'electron';

// Store recent documents for dock menu
interface RecentDocument {
  path: string;
  name: string;
}

let recentDocuments: RecentDocument[] = [];
const MAX_RECENT_DOCUMENTS = 10;

/**
 * Bounce the dock icon
 * @param type - 'informational' for single bounce, 'critical' for until app is activated
 * @returns bounce ID (can be used to cancel)
 */
export function bounceDock(
  type: 'informational' | 'critical' = 'informational'
): number | undefined {
  if (process.platform !== 'darwin') {
    return undefined;
  }

  return app.dock?.bounce(type);
}

/**
 * Cancel dock bounce
 * @param id - The bounce ID returned from bounceDock
 */
export function cancelBounce(id: number): void {
  if (process.platform !== 'darwin') {
    return;
  }

  app.dock?.cancelBounce(id);
}

/**
 * Set the dock badge label
 * @param label - Text to display on badge, or empty string to clear
 */
export function setDockBadge(label: string): void {
  if (process.platform !== 'darwin') {
    return;
  }

  app.dock?.setBadge(label);
}

/**
 * Get the current dock badge label
 */
export function getDockBadge(): string {
  if (process.platform !== 'darwin') {
    return '';
  }

  return app.dock?.getBadge() || '';
}

/**
 * Hide the dock icon
 */
export function hideDockIcon(): void {
  if (process.platform !== 'darwin') {
    return;
  }

  app.dock?.hide();
}

/**
 * Show the dock icon
 */
export function showDockIcon(): void {
  if (process.platform !== 'darwin') {
    return;
  }

  app.dock?.show();
}

/**
 * Set dock icon menu
 * @param menuTemplate - Menu template for dock context menu
 */
export function setDockMenu(menuTemplate: Electron.Menu): void {
  if (process.platform !== 'darwin') {
    return;
  }

  app.dock?.setMenu(menuTemplate);
}

/**
 * Add a document to recent documents
 * @param path - Full path to the document
 * @param name - Display name for the document
 */
export function addRecentDocument(path: string, name?: string): void {
  if (process.platform !== 'darwin') {
    return;
  }

  const displayName = name || path.split('/').pop() || path;

  recentDocuments = recentDocuments.filter((doc) => doc.path !== path);
  recentDocuments.unshift({ path, name: displayName });

  if (recentDocuments.length > MAX_RECENT_DOCUMENTS) {
    recentDocuments = recentDocuments.slice(0, MAX_RECENT_DOCUMENTS);
  }

  app.addRecentDocument(path);
  updateDockMenu();
}

/**
 * Clear recent documents
 */
export function clearRecentDocuments(): void {
  if (process.platform !== 'darwin') {
    return;
  }

  recentDocuments = [];
  app.clearRecentDocuments();
  updateDockMenu();
}

/**
 * Get recent documents
 */
export function getRecentDocuments(): RecentDocument[] {
  return [...recentDocuments];
}

/**
 * Update the dock menu with recent documents
 */
function updateDockMenu(): void {
  if (process.platform !== 'darwin') {
    return;
  }

  const { Menu } = require('electron');

  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'New Session',
      click: () => {
        const { getWindowManager } = require('./window-manager');
        const windowManager = getWindowManager();
        const mainWindow = windowManager?.getMainWindow();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('dock:newSession');
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Open Recent',
      submenu: [
        ...recentDocuments.map(
          (doc): Electron.MenuItemConstructorOptions => ({
            label: doc.name,
            click: () => {
              const { getWindowManager } = require('./window-manager');
              const windowManager = getWindowManager();
              const mainWindow = windowManager?.getMainWindow();
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('dock:openDocument', doc.path);
              }
            },
          })
        ),
        { type: 'separator' },
        {
          label: 'Clear Recent',
          enabled: recentDocuments.length > 0,
          click: clearRecentDocuments,
        },
      ],
    },
    { type: 'separator' },
    {
      label: 'Settings',
      click: () => {
        const { getWindowManager } = require('./window-manager');
        const windowManager = getWindowManager();
        const mainWindow = windowManager?.getMainWindow();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('dock:openSettings');
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      },
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  app.dock?.setMenu(menu);
}

/**
 * Track download progress on the dock
 * @param downloadItem - Electron DownloadItem
 */
export function trackDownloadProgress(downloadItem: DownloadItem): void {
  if (process.platform !== 'darwin') {
    return;
  }

  const totalBytes = downloadItem.getTotalBytes();
  let lastProgress = 0;

  downloadItem.on('updated', (_, state) => {
    if (state === 'progressing' && totalBytes > 0) {
      const receivedBytes = downloadItem.getReceivedBytes();
      const progress = receivedBytes / totalBytes;

      if (progress - lastProgress > 0.05) {
        app.dock?.setProgress(progress);
        lastProgress = progress;
      }
    }
  });

  downloadItem.once('done', (_, state) => {
    app.dock?.setProgress(-1);

    if (state === 'completed') {
      bounceDock('informational');

      const savePath = downloadItem.getSavePath();
      if (savePath) {
        addRecentDocument(savePath);
      }
    }
  });
}

/**
 * Set download progress manually
 * @param progress - Progress value between 0 and 1, or -1 to hide
 */
export function setDownloadProgress(progress: number): void {
  if (process.platform !== 'darwin') {
    return;
  }

  app.dock?.setProgress(progress);
}

/**
 * Initialize dock integration
 */
export function initializeDock(): void {
  if (process.platform !== 'darwin') {
    return;
  }

  updateDockMenu();

  app.on('open-file', (event, path) => {
    event.preventDefault();
    addRecentDocument(path);

    const { getWindowManager } = require('./window-manager');
    const windowManager = getWindowManager();
    const mainWindow = windowManager?.getMainWindow();

    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
      mainWindow.webContents.send('dock:openFile', path);
    }
  });

  app.on('open-url', (event, url) => {
    event.preventDefault();

    const { getWindowManager } = require('./window-manager');
    const windowManager = getWindowManager();
    const mainWindow = windowManager?.getMainWindow();

    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
      mainWindow.webContents.send('dock:openUrl', url);
    }
  });
}

/**
 * Register IPC handlers for dock
 */
export function registerDockIpcHandlers(): void {
  ipcMain.handle('dock:bounce', (_, type: 'informational' | 'critical') => {
    return bounceDock(type);
  });

  ipcMain.handle('dock:cancelBounce', (_, id: number) => {
    cancelBounce(id);
  });

  ipcMain.handle('dock:setBadge', (_, label: string) => {
    setDockBadge(label);
  });

  ipcMain.handle('dock:getBadge', () => {
    return getDockBadge();
  });

  ipcMain.handle('dock:addRecentDocument', (_, path: string, name?: string) => {
    addRecentDocument(path, name);
  });

  ipcMain.handle('dock:clearRecentDocuments', () => {
    clearRecentDocuments();
  });

  ipcMain.handle('dock:getRecentDocuments', () => {
    return getRecentDocuments();
  });

  ipcMain.handle('dock:setProgress', (_, progress: number) => {
    setDownloadProgress(progress);
  });
}
