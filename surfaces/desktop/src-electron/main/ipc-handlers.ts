/**
 * Main Process IPC Handlers
 * 
 * Registers all IPC handlers for communication between main and renderer processes.
 * Includes security validation for all inputs.
 */

import { app, BrowserWindow, dialog, ipcMain, Notification, shell } from 'electron';
import Store from 'electron-store';
import { autoUpdater } from 'electron-updater';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import {
  isValidStoreKey,
  isValidStoreValue,
  StoreSchema,
  StoreKey,
} from '../shared/store-schema';
import type {
  DialogOptions,
  DialogResult,
  NotificationOptions,
  UpdateCheckResult,
  UpdateInfo,
  SidecarStatus,
} from '../shared/types';
import {
  startSidecar,
  stopSidecar,
  getSidecarStatus,
  getApiUrl,
  getAuthPassword,
  onSidecarStatusChanged,
} from './sidecar-integration';

import {
  getVMStatus,
  setupVM,
  startVM,
  stopVM,
  restartVM,
  executeInVM,
  checkVMImages,
  downloadVMImages,
  onVMStatusChanged,
  cleanupVM,
  VMSetupOptions,
  VMExecuteOptions,
} from './vm-integration';

// Import Node.js VM Manager bridge if available
let A2RVMManager: any = null;
try {
  const { A2RVMManager: VMManagerClass } = require('../native/vm-manager-node/dist/index');
  A2RVMManager = VMManagerClass;
} catch (e) {
  console.log('[IPC] VM Manager Node bridge not available, using fallback implementation');
}

/**
 * Electron store instance with typed schema
 */
const store = new Store<StoreSchema>({
  name: 'app-config',
  defaults: {
    'window.bounds': { x: 0, y: 0, width: 1200, height: 800 },
    'window.fullscreen': false,
    'window.maximized': false,
    'app.theme': 'system',
    'app.lastSessionId': null,
    'app.launchCount': 0,
    'notifications.enabled': true,
    'notifications.soundEnabled': true,
    'user.preferences': {},
    'updates.autoCheck': true,
    'updates.autoDownload': false,
  },
});

/**
 * Validates URL for external opening
 * Only allows http: and https: protocols
 */
function isValidExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Sanitizes file path for safe exposure to renderer
 * Returns just the filename if the path is sensitive
 */
function sanitizeFilePath(filePath: string): string {
  return filePath.split(/[/\\]/).pop() || filePath;
}

/**
 * Gets the main window instance
 * Throws if not found
 */
function getMainWindow(): BrowserWindow {
  const windows = BrowserWindow.getAllWindows();
  const mainWindow = windows.find((w) => !w.isDestroyed());
  if (!mainWindow) {
    throw new Error('Main window not found');
  }
  return mainWindow;
}

/**
 * Register all IPC handlers
 * Call this from main process initialization
 */
export function registerIpcHandlers(): void {
  // App handlers
  registerAppHandlers();

  // Window handlers
  registerWindowHandlers();

  // Store handlers
  registerStoreHandlers();

  // Dialog handlers
  registerDialogHandlers();

  // Notification handlers
  registerNotificationHandlers();

  // Update handlers
  registerUpdateHandlers();

  // External handlers
  registerExternalHandlers();

  // Sidecar handlers
  registerSidecarHandlers();

  // VM handlers
  registerVMHandlers();
}

/**
 * Unregister all IPC handlers
 * Call this before app quit for cleanup
 */
export function unregisterIpcHandlers(): void {
  Object.values(IPC_CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}

/**
 * App-related IPC handlers
 */
function registerAppHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.APP_VERSION, async (): Promise<string> => {
    return app.getVersion();
  });

  ipcMain.on(IPC_CHANNELS.APP_QUIT, (): void => {
    app.quit();
  });
}

/**
 * Window control IPC handlers
 */
function registerWindowHandlers(): void {
  ipcMain.on(IPC_CHANNELS.WINDOW_MINIMIZE, (): void => {
    const window = getMainWindow();
    window.minimize();
  });

  ipcMain.on(IPC_CHANNELS.WINDOW_MAXIMIZE, (): void => {
    const window = getMainWindow();
    if (window.isMaximized()) {
      window.unmaximize();
    } else {
      window.maximize();
    }
  });

  ipcMain.on(IPC_CHANNELS.WINDOW_CLOSE, (): void => {
    const window = getMainWindow();
    window.close();
  });

  ipcMain.on(IPC_CHANNELS.WINDOW_SET_FULLSCREEN, (_, fullscreen: boolean): void => {
    const window = getMainWindow();
    window.setFullScreen(Boolean(fullscreen));
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_GET_BOUNDS, async () => {
    const window = getMainWindow();
    return window.getBounds();
  });

  ipcMain.on(IPC_CHANNELS.WINDOW_SET_BOUNDS, (_, bounds): void => {
    if (
      !bounds ||
      typeof bounds !== 'object' ||
      typeof bounds.x !== 'number' ||
      typeof bounds.y !== 'number' ||
      typeof bounds.width !== 'number' ||
      typeof bounds.height !== 'number'
    ) {
      throw new Error('Invalid bounds object');
    }
    const window = getMainWindow();
    window.setBounds(bounds);
  });
}

/**
 * Store operations IPC handlers with validation
 */
function registerStoreHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.STORE_GET,
    async <K extends StoreKey>(_, key: K): Promise<StoreSchema[K] | undefined> => {
      if (!isValidStoreKey(key)) {
        throw new Error(`Invalid store key: ${key}`);
      }
      return store.get(key);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.STORE_SET,
    async <K extends StoreKey>(_, key: K, value: StoreSchema[K]): Promise<boolean> => {
      if (!isValidStoreKey(key)) {
        throw new Error(`Invalid store key: ${key}`);
      }
      if (!isValidStoreValue(key, value)) {
        throw new Error(`Invalid value type for key: ${key}`);
      }
      store.set(key, value);
      return true;
    }
  );

  ipcMain.handle(IPC_CHANNELS.STORE_DELETE, async (_, key: StoreKey): Promise<boolean> => {
    if (!isValidStoreKey(key)) {
      throw new Error(`Invalid store key: ${key}`);
    }
    store.delete(key);
    return true;
  });
}

/**
 * Dialog IPC handlers
 */
function registerDialogHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.SHOW_SAVE_DIALOG,
    async (_, options?: DialogOptions): Promise<DialogResult> => {
      const window = getMainWindow();
      const result = await dialog.showSaveDialog(window, {
        title: options?.title,
        defaultPath: options?.defaultPath,
        buttonLabel: options?.buttonLabel,
        filters: options?.filters,
        message: options?.message,
        nameFieldLabel: options?.nameFieldLabel,
        showsTagField: options?.showsTagField,
      });

      return {
        canceled: result.canceled,
        filePath: result.filePath,
        bookmark: result.bookmark,
      };
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.SHOW_OPEN_DIALOG,
    async (_, options?: DialogOptions): Promise<DialogResult> => {
      const window = getMainWindow();
      const properties = options?.properties || ['openFile'];
      const result = await dialog.showOpenDialog(window, {
        title: options?.title,
        defaultPath: options?.defaultPath,
        buttonLabel: options?.buttonLabel,
        filters: options?.filters,
        message: options?.message,
        properties: properties as Array<
          | 'openFile'
          | 'openDirectory'
          | 'multiSelections'
          | 'showHiddenFiles'
          | 'createDirectory'
          | 'promptToCreate'
          | 'noResolveAliases'
          | 'treatPackageAsDirectory'
          | 'dontAddToRecent'
        >,
      });

      return {
        canceled: result.canceled,
        filePaths: result.filePaths,
        bookmark: result.bookmarks?.[0],
      };
    }
  );
}

/**
 * Notification IPC handlers
 */
function registerNotificationHandlers(): void {
  ipcMain.on(IPC_CHANNELS.SHOW_NOTIFICATION, (_, options: NotificationOptions): void => {
    if (!options || typeof options !== 'object') {
      throw new Error('Invalid notification options');
    }
    if (!options.title || typeof options.title !== 'string') {
      throw new Error('Notification title is required');
    }

    const notification = new Notification({
      title: options.title,
      body: options.body,
      icon: options.icon,
      silent: options.silent,
      timeoutType: options.timeoutType,
    });

    notification.show();
  });
}

/**
 * Auto-updater IPC handlers
 */
function registerUpdateHandlers(): void {
  let updateInfo: UpdateInfo | null = null;

  ipcMain.handle(IPC_CHANNELS.UPDATE_CHECK, async (): Promise<UpdateCheckResult> => {
    try {
      const result = await autoUpdater.checkForUpdates();
      if (result?.updateInfo) {
        updateInfo = {
          version: result.updateInfo.version,
          releaseDate: result.updateInfo.releaseDate,
          releaseNotes:
            typeof result.updateInfo.releaseNotes === 'string'
              ? result.updateInfo.releaseNotes
              : undefined,
        };
        return { updateAvailable: true, info: updateInfo };
      }
      return { updateAvailable: false };
    } catch (error) {
      throw new Error(`Update check failed: ${error}`);
    }
  });

  ipcMain.handle(IPC_CHANNELS.UPDATE_DOWNLOAD, async (): Promise<boolean> => {
    try {
      await autoUpdater.downloadUpdate();
      return true;
    } catch (error) {
      throw new Error(`Update download failed: ${error}`);
    }
  });

  ipcMain.on(IPC_CHANNELS.UPDATE_INSTALL, (): void => {
    autoUpdater.quitAndInstall();
  });

  // Forward update events to renderer
  autoUpdater.on('update-available', (info) => {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((window) => {
      if (!window.isDestroyed()) {
        window.webContents.send('update:available', {
          version: info.version,
          releaseDate: info.releaseDate,
          releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined,
        });
      }
    });
  });

  autoUpdater.on('download-progress', (progress) => {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((window) => {
      if (!window.isDestroyed()) {
        window.webContents.send('update:progress', {
          percent: progress.percent,
          bytesPerSecond: progress.bytesPerSecond,
          total: progress.total,
          transferred: progress.transferred,
        });
      }
    });
  });
}

/**
 * External shell IPC handlers
 */
function registerExternalHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.OPEN_EXTERNAL, async (_, url: string): Promise<boolean> => {
    if (!url || typeof url !== 'string') {
      throw new Error('URL is required');
    }
    if (!isValidExternalUrl(url)) {
      throw new Error(`Invalid URL protocol: ${url}`);
    }

    try {
      await shell.openExternal(url);
      return true;
    } catch (error) {
      throw new Error(`Failed to open external URL: ${error}`);
    }
  });
}

/**
 * Initialize auto-updater settings
 */
export function initializeAutoUpdater(): void {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  // Check for updates on startup if enabled
  const autoCheck = store.get('updates.autoCheck');
  if (autoCheck) {
    autoUpdater.checkForUpdates().catch(() => {
      // Silently fail update check on startup
    });
  }
}

/**
 * Sidecar IPC handlers for API server management
 */
function registerSidecarHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.SIDECAR_START, async (): Promise<boolean> => {
    try {
      await startSidecar();
      return true;
    } catch (error) {
      console.error('[Sidecar] Failed to start:', error);
      return false;
    }
  });

  ipcMain.handle(IPC_CHANNELS.SIDECAR_STOP, async (): Promise<boolean> => {
    try {
      await stopSidecar();
      return true;
    } catch (error) {
      console.error('[Sidecar] Failed to stop:', error);
      return false;
    }
  });

  ipcMain.handle(IPC_CHANNELS.SIDECAR_RESTART, async (): Promise<boolean> => {
    try {
      await stopSidecar();
      await startSidecar();
      return true;
    } catch (error) {
      console.error('[Sidecar] Failed to restart:', error);
      return false;
    }
  });

  ipcMain.handle(IPC_CHANNELS.SIDECAR_GET_STATUS, async (): Promise<SidecarStatus> => {
    return getSidecarStatus();
  });

  ipcMain.handle(IPC_CHANNELS.SIDECAR_GET_API_URL, async (): Promise<string | undefined> => {
    return getApiUrl();
  });

  ipcMain.handle(IPC_CHANNELS.SIDECAR_GET_AUTH_PASSWORD, async (): Promise<string | undefined> => {
    return getAuthPassword();
  });

  // Forward status changes to renderer
  onSidecarStatusChanged((status: SidecarStatus) => {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((window) => {
      if (!window.isDestroyed()) {
        window.webContents.send(IPC_CHANNELS.SIDECAR_STATUS_CHANGED, status);
      }
    });
  });
}

export { store };

/**
 * VM IPC handlers for VM lifecycle management
 */
function registerVMHandlers(): void {
  // VM Manager instance (created when needed)
  let vmManager: any = null;

  // Initialize VM Manager if available
  const getVMManager = () => {
    if (!vmManager && A2RVMManager) {
      vmManager = new A2RVMManager();
      
      // Forward status changes
      vmManager.on('statusChanged', (status: any) => {
        const windows = BrowserWindow.getAllWindows();
        windows.forEach((window) => {
          if (!window.isDestroyed()) {
            window.webContents.send(IPC_CHANNELS.VM.STATUS_CHANGED, status.state);
          }
        });
      });
    }
    return vmManager;
  };

  // Get VM status
  ipcMain.handle(IPC_CHANNELS.VM.GET_STATUS, async () => {
    const manager = getVMManager();
    if (manager) {
      return manager.getStatus();
    }
    return getVMStatus();
  });

  // Check if VM images exist
  ipcMain.handle(IPC_CHANNELS.VM.CHECK_IMAGES, async (): Promise<boolean> => {
    const manager = getVMManager();
    if (manager) {
      return manager.checkImages();
    }
    return checkVMImages();
  });

  // Download VM images
  ipcMain.handle(IPC_CHANNELS.VM.DOWNLOAD_IMAGES, async (_, options?: VMSetupOptions): Promise<boolean> => {
    try {
      const manager = getVMManager();
      if (manager) {
        await manager.downloadImages(options);
        return true;
      }
      return await downloadVMImages(options || {});
    } catch (error) {
      console.error('[VM] Download failed:', error);
      throw error;
    }
  });

  // Setup VM (download images if needed)
  ipcMain.handle(IPC_CHANNELS.VM.SETUP, async (_, options?: VMSetupOptions): Promise<boolean> => {
    try {
      const manager = getVMManager();
      if (manager) {
        await manager.setup(options);
        return true;
      }
      return await setupVM(options || {});
    } catch (error) {
      console.error('[VM] Setup failed:', error);
      throw error;
    }
  });

  // Start VM
  ipcMain.handle(IPC_CHANNELS.VM.START, async (): Promise<boolean> => {
    try {
      const manager = getVMManager();
      if (manager) {
        await manager.start();
        return true;
      }
      return await startVM();
    } catch (error) {
      console.error('[VM] Start failed:', error);
      throw error;
    }
  });

  // Stop VM
  ipcMain.handle(IPC_CHANNELS.VM.STOP, async (): Promise<boolean> => {
    try {
      const manager = getVMManager();
      if (manager) {
        await manager.stop();
        return true;
      }
      return stopVM();
    } catch (error) {
      console.error('[VM] Stop failed:', error);
      throw error;
    }
  });

  // Restart VM
  ipcMain.handle(IPC_CHANNELS.VM.RESTART, async (): Promise<boolean> => {
    try {
      const manager = getVMManager();
      if (manager) {
        await manager.restart();
        return true;
      }
      return await restartVM();
    } catch (error) {
      console.error('[VM] Restart failed:', error);
      throw error;
    }
  });

  // Execute command in VM
  ipcMain.handle(IPC_CHANNELS.VM.EXECUTE, async (_, options: VMExecuteOptions) => {
    try {
      const manager = getVMManager();
      if (manager) {
        return await manager.execute(
          options.command,
          options.args || [],
          {
            workingDir: options.workingDir,
            env: options.env,
            timeout: options.timeoutMs,
          }
        );
      }
      return await executeInVM(options);
    } catch (error) {
      console.error('[VM] Execute failed:', error);
      throw error;
    }
  });

  // Forward VM status changes to renderer (fallback)
  onVMStatusChanged((status) => {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((window) => {
      if (!window.isDestroyed()) {
        window.webContents.send(IPC_CHANNELS.VM.STATUS_CHANGED, status);
      }
    });
  });

  // Clean up VM on app quit
  app.on('before-quit', () => {
    if (vmManager) {
      vmManager.dispose();
    }
    cleanupVM();
  });
}
