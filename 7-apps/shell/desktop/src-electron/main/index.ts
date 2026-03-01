/**
 * Main Process Native Features
 *
 * Central export and integration point for all native Electron features:
 * - Notifications
 * - Tray
 * - Menu
 * - Dock (macOS)
 * - Power Monitor
 * - Protocol Handler
 * - Auto Updater
 */

import { app, BrowserWindow } from 'electron';

// Import all native feature modules
import {
  registerNotificationIpcHandlers,
  getNotificationSettings,
  notify,
  showNotification,
  updateBadgeCount,
  clearBadgeCount,
  type A2RNotificationOptions,
  type NotificationCategory,
} from './notifications';

import {
  createTray,
  destroyTray,
  getTray,
  updateTrayTooltip,
  updateTrayMenu,
  showTrayBubble,
  registerTrayIpcHandlers,
  setTrayQuitting,
  getWindowsAppGuid,
} from './tray';

import {
  createApplicationMenu,
  updateApplicationMenu,
  addRecentSession,
  clearRecentSessions,
  getRecentSessions,
  registerMenuIpcHandlers,
} from './menu';

import {
  initializeDock,
  registerDockIpcHandlers,
  bounceDock,
  setDockBadge,
  addRecentDocument,
  clearRecentDocuments,
  trackDownloadProgress,
} from './dock';

import {
  initializePowerMonitor,
  cleanupPowerMonitor,
  registerPowerMonitorIpcHandlers,
  getPowerState,
  isOnBatteryPower,
  onPowerEvent,
} from './power-monitor';

import {
  initializeProtocol,
  registerProtocolIpcHandlers,
  processPendingUrls,
  buildDeepLink,
  handleDeepLink,
  registerDeepLinkRoute,
} from './protocol';

import {
  initializeUpdater,
  configureUpdater,
  checkForUpdates,
  downloadUpdate,
  quitAndInstall,
  getUpdateStatus,
  cleanupUpdater,
  registerUpdaterIpcHandlers,
  type UpdaterConfig,
  type UpdateChannel,
  type UpdateStrategy,
} from './updater';

import {
  startSidecar,
  stopSidecar,
  restartSidecar,
  getSidecarStatus,
  getApiUrl,
  getAuthPassword,
  onSidecarStatusChanged,
  type SidecarStatus,
} from './sidecar-integration';

// Re-export types
export type { A2RNotificationOptions, NotificationCategory };
export type { UpdaterConfig, UpdateChannel, UpdateStrategy };
export type { SidecarStatus };

/**
 * Initialize all native features
 * Call this from main.ts when app is ready
 */
export async function initializeNativeFeatures(mainWindow?: BrowserWindow): Promise<void> {
  registerAllIpcHandlers();

  createApplicationMenu();

  createTray();
  updateTrayTooltip('Ready');

  if (process.platform === 'darwin') {
    initializeDock();
  }

  initializePowerMonitor();
  initializeProtocol();

  // Start the API sidecar
  try {
    console.log('[Main] Starting API sidecar...');
    await startSidecar();
    console.log('[Main] API sidecar started successfully');
  } catch (error) {
    console.error('[Main] Failed to start API sidecar:', error);
  }

  if (mainWindow) {
    initializeUpdater(mainWindow);
  }

  setupAppEventHandlers();
}

/**
 * Register all IPC handlers
 */
function registerAllIpcHandlers(): void {
  registerNotificationIpcHandlers();
  registerTrayIpcHandlers();
  registerMenuIpcHandlers();
  registerDockIpcHandlers();
  registerPowerMonitorIpcHandlers();
  registerProtocolIpcHandlers();
  registerUpdaterIpcHandlers();
}

/**
 * Setup app-level event handlers
 */
function setupAppEventHandlers(): void {
  app.on('before-quit', () => {
    setTrayQuitting(true);
  });

  app.on('quit', () => {
    cleanupPowerMonitor();
    destroyTray();
  });

  app.on('activate', () => {
    updateTrayMenu();

    if (process.platform === 'darwin') {
      updateApplicationMenu();
    }
  });

  app.on('browser-window-created', (_, window) => {
    window.webContents.on('did-finish-load', () => {
      processPendingUrls();
    });
  });

  app.on('open-url', (event, url) => {
    event.preventDefault();
    handleDeepLink(url);
  });
}

/**
 * Cleanup all native features
 * Call this before app quit
 */
export function cleanupNativeFeatures(): void {
  cleanupPowerMonitor();
  cleanupUpdater();
  destroyTray();
  clearBadgeCount();
}

/**
 * Native features API for use in main process
 */
export const nativeFeatures = {
  // Notifications
  notify,
  showNotification,
  getNotificationSettings,
  updateBadgeCount,
  clearBadgeCount,

  // Tray
  updateTrayTooltip,
  updateTrayMenu,
  showTrayBubble,
  getTray,

  // Menu
  updateApplicationMenu,
  addRecentSession,
  clearRecentSessions,
  getRecentSessions,

  // Dock (macOS)
  bounceDock,
  setDockBadge,
  addRecentDocument,
  clearRecentDocuments,
  trackDownloadProgress,

  // Power Monitor
  getPowerState,
  isOnBatteryPower,
  onPowerEvent,

  // Protocol
  buildDeepLink,
  handleDeepLink,
  registerDeepLinkRoute,
  processPendingUrls,

  // Updater
  configureUpdater,
  checkForUpdates,
  downloadUpdate,
  quitAndInstall,
  getUpdateStatus,

  // Sidecar
  startSidecar,
  stopSidecar,
  restartSidecar,
  getSidecarStatus,
  getApiUrl,
  getAuthPassword,
  onSidecarStatusChanged,
};

// Default export
export default nativeFeatures;
