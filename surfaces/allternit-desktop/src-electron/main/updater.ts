/**
 * Auto Updater Module
 *
 * electron-updater integration for automatic updates from GitHub Releases,
 * S3, or custom servers. Supports silent, prompt, and forced update strategies.
 */

import { app, BrowserWindow, ipcMain } from 'electron';
import { autoUpdater, UpdateInfo, ProgressInfo } from 'electron-updater';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import type { UpdateCheckResult, UpdateDownloadProgress } from '../shared/types';

/**
 * Update channel types
 */
export type UpdateChannel = 'stable' | 'beta' | 'alpha';

/**
 * Update strategy types
 */
export type UpdateStrategy = 'silent' | 'prompt' | 'force';

/**
 * Updater configuration options
 */
export interface UpdaterConfig {
  channel: UpdateChannel;
  strategy: UpdateStrategy;
  checkIntervalMs: number;
  initialCheckDelayMs: number;
  allowPrerelease: boolean;
  allowDowngrade: boolean;
}

/**
 * Default updater configuration
 */
const DEFAULT_CONFIG: UpdaterConfig = {
  channel: 'stable',
  strategy: 'prompt',
  checkIntervalMs: 4 * 60 * 60 * 1000, // 4 hours
  initialCheckDelayMs: 30000, // 30 seconds
  allowPrerelease: false,
  allowDowngrade: false,
};

/**
 * Current updater configuration
 */
let config: UpdaterConfig = { ...DEFAULT_CONFIG };

/**
 * Current update info
 */
let currentUpdateInfo: UpdateInfo | null = null;

/**
 * Current download progress
 */
let currentDownloadProgress: UpdateDownloadProgress | null = null;

/**
 * Whether an update is currently being downloaded
 */
let isDownloading = false;

/**
 * Whether an update has been downloaded and is ready to install
 */
let updateDownloaded = false;

/**
 * Reference to the main window for broadcasting events
 */
let mainWindow: BrowserWindow | null = null;

/**
 * Interval timer for periodic update checks
 */
let checkInterval: NodeJS.Timeout | null = null;

/**
 * Initial check timeout
 */
let initialCheckTimeout: NodeJS.Timeout | null = null;

/**
 * Broadcast an update event to all renderer processes
 */
function broadcast(channel: string, data?: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

/**
 * Convert electron-updater ProgressInfo to our UpdateDownloadProgress format
 */
function convertProgressInfo(progress: ProgressInfo): UpdateDownloadProgress {
  return {
    percent: progress.percent,
    bytesPerSecond: progress.bytesPerSecond,
    total: progress.total,
    transferred: progress.transferred,
  };
}

/**
 * Convert electron-updater UpdateInfo to our format
 */
function convertUpdateInfo(info: UpdateInfo) {
  return {
    version: info.version,
    releaseDate: info.releaseDate,
    releaseNotes: info.releaseNotes as string | undefined,
  };
}

/**
 * Determine update strategy based on version metadata
 */
function determineUpdateStrategy(info: UpdateInfo): UpdateStrategy {
  const releaseNotes = (info.releaseNotes as string) || '';

  if (releaseNotes.includes('[FORCE]') || releaseNotes.includes('[CRITICAL]')) {
    return 'force';
  }

  if (config.strategy === 'silent') {
    return 'silent';
  }

  return config.strategy;
}

/**
 * Check if the current update is a downgrade
 */
function isDowngrade(currentVersion: string, newVersion: string): boolean {
  const current = currentVersion.replace(/^v/, '').split('.').map(Number);
  const next = newVersion.replace(/^v/, '').split('.').map(Number);

  for (let i = 0; i < Math.max(current.length, next.length); i++) {
    const cur = current[i] || 0;
    const nex = next[i] || 0;

    if (nex > cur) return false;
    if (nex < cur) return true;
  }

  return false;
}

/**
 * Setup auto-updater event handlers
 */
function setupEventHandlers(): void {
  autoUpdater.on('checking-for-update', () => {
    broadcast(IPC_CHANNELS.UPDATE.CHECKING);
  });

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    currentUpdateInfo = info;
    const strategy = determineUpdateInfoStrategy(info);

    broadcast(IPC_CHANNELS.UPDATE.AVAILABLE, {
      info: convertUpdateInfo(info),
      strategy,
    });

    if (strategy === 'silent' || config.strategy === 'silent') {
      downloadUpdate().catch(() => {
        // Silent download failures are not broadcast
      });
    }
  });

  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    broadcast(IPC_CHANNELS.UPDATE.NOT_AVAILABLE, convertUpdateInfo(info));
  });

  autoUpdater.on('download-progress', (progress: ProgressInfo) => {
    currentDownloadProgress = convertProgressInfo(progress);
    broadcast(IPC_CHANNELS.UPDATE.PROGRESS, currentDownloadProgress);
  });

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    updateDownloaded = true;
    isDownloading = false;
    currentUpdateInfo = info;

    broadcast(IPC_CHANNELS.UPDATE.DOWNLOADED, convertUpdateInfo(info));

    const strategy = determineUpdateInfoStrategy(info);

    if (strategy === 'force') {
      setTimeout(() => {
        quitAndInstall();
      }, 5000);
    } else if (config.strategy === 'silent') {
      setTimeout(() => {
        quitAndInstall();
      }, 10000);
    }
  });

  autoUpdater.on('error', (error: Error) => {
    isDownloading = false;
    broadcast(IPC_CHANNELS.UPDATE.ERROR, {
      message: error.message,
      stack: error.stack,
    });
  });
}

/**
 * Determine update strategy from update info
 */
function determineUpdateInfoStrategy(info: UpdateInfo): UpdateStrategy {
  const releaseNotes = (info.releaseNotes as string) || '';

  if (releaseNotes.includes('[FORCE]') || releaseNotes.includes('[CRITICAL]')) {
    return 'force';
  }

  return config.strategy;
}

/**
 * Configure the auto-updater
 */
export function configureUpdater(userConfig: Partial<UpdaterConfig>): void {
  config = { ...config, ...userConfig };

  autoUpdater.channel = config.channel;
  autoUpdater.allowPrerelease = config.allowPrerelease;
  autoUpdater.allowDowngrade = config.allowDowngrade;
}

/**
 * Initialize the auto-updater
 */
export function initializeUpdater(window: BrowserWindow): void {
  mainWindow = window;

  if (process.env.NODE_ENV === 'development') {
    autoUpdater.logger = console;
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = config.strategy === 'silent';

  setupEventHandlers();
  setupIpcHandlers();
  scheduleUpdateChecks();
}

/**
 * Setup IPC handlers for update commands
 */
function setupIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.UPDATE.CHECK, async (): Promise<UpdateCheckResult> => {
    try {
      const result = await autoUpdater.checkForUpdates();

      if (!result) {
        return { updateAvailable: false };
      }

      const updateInfo = result.updateInfo;
      const currentVersion = app.getVersion();

      if (isDowngrade(currentVersion, updateInfo.version) && !config.allowDowngrade) {
        return { updateAvailable: false };
      }

      return {
        updateAvailable: true,
        info: convertUpdateInfo(updateInfo),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Update check failed';
      throw new Error(errorMessage);
    }
  });

  ipcMain.handle(IPC_CHANNELS.UPDATE.DOWNLOAD, async (): Promise<boolean> => {
    if (isDownloading || updateDownloaded) {
      return updateDownloaded;
    }

    try {
      isDownloading = true;
      await autoUpdater.downloadUpdate();
      return true;
    } catch (error) {
      isDownloading = false;
      const errorMessage = error instanceof Error ? error.message : 'Download failed';
      throw new Error(errorMessage);
    }
  });

  ipcMain.handle(IPC_CHANNELS.UPDATE.INSTALL, (): void => {
    quitAndInstall();
  });

  ipcMain.handle(IPC_CHANNELS.UPDATE.GET_INFO, () => ({
    currentVersion: app.getVersion(),
    updateAvailable: !!currentUpdateInfo,
    updateInfo: currentUpdateInfo ? convertUpdateInfo(currentUpdateInfo) : null,
    downloadProgress: currentDownloadProgress,
    isDownloading,
    updateDownloaded,
    channel: config.channel,
    strategy: config.strategy,
  }));

  ipcMain.handle(IPC_CHANNELS.UPDATE.SET_CHANNEL, (_, channel: UpdateChannel) => {
    config.channel = channel;
    autoUpdater.channel = channel;
  });

  ipcMain.handle(IPC_CHANNELS.UPDATE.GET_CHANNEL, () => config.channel);
}

/**
 * Schedule automatic update checks
 */
function scheduleUpdateChecks(): void {
  if (initialCheckTimeout) {
    clearTimeout(initialCheckTimeout);
  }

  if (checkInterval) {
    clearInterval(checkInterval);
  }

  initialCheckTimeout = setTimeout(() => {
    checkForUpdates().catch(() => {
      // Silent failure for scheduled checks
    });
  }, config.initialCheckDelayMs);

  checkInterval = setInterval(() => {
    checkForUpdates().catch(() => {
      // Silent failure for scheduled checks
    });
  }, config.checkIntervalMs);
}

/**
 * Check for updates manually
 */
export async function checkForUpdates(): Promise<UpdateCheckResult> {
  const result = await autoUpdater.checkForUpdates();

  if (!result) {
    return { updateAvailable: false };
  }

  return {
    updateAvailable: true,
    info: convertUpdateInfo(result.updateInfo),
  };
}

/**
 * Download the available update
 */
export async function downloadUpdate(): Promise<boolean> {
  if (isDownloading || updateDownloaded) {
    return updateDownloaded;
  }

  isDownloading = true;
  await autoUpdater.downloadUpdate();
  return true;
}

/**
 * Quit the app and install the update
 */
export function quitAndInstall(): void {
  autoUpdater.quitAndInstall(false, true);
}

/**
 * Get current update status
 */
export function getUpdateStatus() {
  return {
    currentVersion: app.getVersion(),
    updateAvailable: !!currentUpdateInfo,
    updateInfo: currentUpdateInfo ? convertUpdateInfo(currentUpdateInfo) : null,
    downloadProgress: currentDownloadProgress,
    isDownloading,
    updateDownloaded,
    channel: config.channel,
    strategy: config.strategy,
  };
}

/**
 * Cleanup updater resources
 */
export function cleanupUpdater(): void {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }

  if (initialCheckTimeout) {
    clearTimeout(initialCheckTimeout);
    initialCheckTimeout = null;
  }

  mainWindow = null;
}

/**
 * Register updater IPC handlers (for use in native features index)
 */
export function registerUpdaterIpcHandlers(): void {
  setupIpcHandlers();
}
