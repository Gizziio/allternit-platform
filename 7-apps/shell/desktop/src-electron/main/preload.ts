/**
 * Preload Script
 *
 * Exposes a secure, type-safe API to the renderer process.
 * All IPC communication goes through this bridge.
 */

import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import type {
  NotificationOptions,
  NotificationSettings,
  NotificationCategory,
  PowerState,
  IdleState,
  ParsedDeepLink,
  StoreSchema,
  StoreKey,
  WindowBounds,
  UpdateInfo,
  UpdateCheckResult,
  UpdateDownloadProgress,
  SidecarStatus,
} from '../shared/types';

/**
 * Helper to create IPC invoke wrapper
 */
function createInvoke<T = unknown>(channel: string) {
  return (...args: unknown[]): Promise<T> => ipcRenderer.invoke(channel, ...args);
}

/**
 * Helper to create IPC send wrapper
 */
function createSend(channel: string) {
  return (...args: unknown[]): void => ipcRenderer.send(channel, ...args);
}

/**
 * Helper to create event listener wrapper
 */
function createOn(channel: string) {
  return (callback: (...args: unknown[]) => void): (() => void) => {
    const wrapped = (_event: IpcRendererEvent, ...args: unknown[]) => callback(...args);
    ipcRenderer.on(channel, wrapped);
    return () => ipcRenderer.removeListener(channel, wrapped);
  };
}

/**
 * Helper to create once listener wrapper
 */
function createOnce(channel: string) {
  return (callback: (...args: unknown[]) => void): void => {
    ipcRenderer.once(channel, (_event, ...args) => callback(...args));
  };
}

// Expose the Electron API to the renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Generic IPC
  send: (channel: string, ...args: unknown[]) => ipcRenderer.send(channel, ...args),
  invoke: <T = unknown>(channel: string, ...args: unknown[]): Promise<T> =>
    ipcRenderer.invoke(channel, ...args),
  on: (channel: string, callback: (...args: unknown[]) => void): (() => void) => {
    const wrapped = (_event: IpcRendererEvent, ...args: unknown[]) => callback(...args);
    ipcRenderer.on(channel, wrapped);
    return () => ipcRenderer.removeListener(channel, wrapped);
  },
  once: createOnce,
  removeListener: (channel: string, callback: (...args: unknown[]) => void) =>
    ipcRenderer.removeListener(channel, callback),
  removeAllListeners: (channel: string) => ipcRenderer.removeAllListeners(channel),

  // Store
  store: {
    get: createInvoke<StoreSchema[StoreKey]>(IPC_CHANNELS.STORE.GET),
    set: createInvoke<boolean>(IPC_CHANNELS.STORE.SET),
    delete: createInvoke<boolean>(IPC_CHANNELS.STORE.DELETE),
  },

  // Window
  window: {
    minimize: createSend(IPC_CHANNELS.WINDOW.MINIMIZE),
    maximize: createSend(IPC_CHANNELS.WINDOW.MAXIMIZE),
    close: createSend(IPC_CHANNELS.WINDOW.CLOSE),
    setFullscreen: (fullscreen: boolean) =>
      createSend(IPC_CHANNELS.WINDOW.FULLSCREEN)(fullscreen),
    getBounds: createInvoke<WindowBounds>(IPC_CHANNELS.WINDOW.GET_BOUNDS),
    setBounds: (bounds: WindowBounds) =>
      createSend(IPC_CHANNELS.WINDOW.SET_BOUNDS)(bounds),
  },

  // App
  app: {
    getVersion: createInvoke<string>(IPC_CHANNELS.APP.GET_VERSION),
    quit: createSend(IPC_CHANNELS.APP.QUIT),
  },

  // Notifications
  notification: {
    show: (options: NotificationOptions) =>
      createInvoke<void>(IPC_CHANNELS.NOTIFICATION.SHOW)(options),
    getSettings: createInvoke<NotificationSettings>(IPC_CHANNELS.NOTIFICATION.GET_SETTINGS),
    updateSettings: (settings: Partial<NotificationSettings>) =>
      createInvoke<void>(IPC_CHANNELS.NOTIFICATION.UPDATE_SETTINGS)(settings),
    toggleDoNotDisturb: createInvoke<boolean>(IPC_CHANNELS.NOTIFICATION.TOGGLE_DO_NOT_DISTURB),
    setCategoryEnabled: (category: NotificationCategory, enabled: boolean) =>
      createInvoke<void>(IPC_CHANNELS.NOTIFICATION.SET_CATEGORY_ENABLED)(category, enabled),
    clearBadge: createInvoke<void>(IPC_CHANNELS.NOTIFICATION.CLEAR_BADGE),
    getBadgeCount: createInvoke<number>(IPC_CHANNELS.NOTIFICATION.GET_BADGE_COUNT),
  },

  // Power Monitor
  power: {
    getState: createInvoke<PowerState>(IPC_CHANNELS.POWER.GET_STATE),
    isOnBattery: createInvoke<boolean>(IPC_CHANNELS.POWER.IS_ON_BATTERY),
    getIdleTime: createInvoke<number>(IPC_CHANNELS.POWER.GET_IDLE_TIME),
    isScreenLocked: createInvoke<boolean>(IPC_CHANNELS.POWER.IS_SCREEN_LOCKED),
    getIdleState: createInvoke<IdleState>(IPC_CHANNELS.POWER.GET_IDLE_STATE),
    pauseConnections: createInvoke<void>(IPC_CHANNELS.POWER.PAUSE_CONNECTIONS),
    resumeConnections: createInvoke<void>(IPC_CHANNELS.POWER.RESUME_CONNECTIONS),
    onSuspend: createOn('power:suspend'),
    onResume: createOn('power:resume'),
  },

  // Protocol
  protocol: {
    buildUrl: (path: string, params?: Record<string, string>) =>
      createInvoke<string>(IPC_CHANNELS.PROTOCOL.BUILD_URL)(path, params),
    open: (url: string) => createInvoke<boolean>(IPC_CHANNELS.PROTOCOL.OPEN)(url),
    isRegistered: createInvoke<boolean>(IPC_CHANNELS.PROTOCOL.IS_REGISTERED),
    parse: (url: string) => createInvoke<ParsedDeepLink | null>(IPC_CHANNELS.PROTOCOL.PARSE)(url),
    onOpenUrl: createOn('protocol:navigate'),
  },

  // External links
  shell: {
    openExternal: (url: string) => createInvoke<boolean>('external:open')(url),
  },

  // Updater
  updater: {
    check: createInvoke<UpdateCheckResult>(IPC_CHANNELS.UPDATE.CHECK),
    download: createInvoke<boolean>(IPC_CHANNELS.UPDATE.DOWNLOAD),
    install: createSend(IPC_CHANNELS.UPDATE.INSTALL),
    getInfo: createInvoke<{
      currentVersion: string;
      updateAvailable: boolean;
      updateInfo: UpdateInfo | null;
      downloadProgress: UpdateDownloadProgress | null;
      isDownloading: boolean;
      updateDownloaded: boolean;
      channel: string;
      strategy: string;
    }>(IPC_CHANNELS.UPDATE.GET_INFO),
    setChannel: (channel: string) =>
      createInvoke<void>(IPC_CHANNELS.UPDATE.SET_CHANNEL)(channel),
    getChannel: createInvoke<string>(IPC_CHANNELS.UPDATE.GET_CHANNEL),
    onUpdateAvailable: createOn(IPC_CHANNELS.UPDATE.AVAILABLE),
    onDownloadProgress: createOn(IPC_CHANNELS.UPDATE.PROGRESS),
    onUpdateDownloaded: createOn(IPC_CHANNELS.UPDATE.DOWNLOADED),
    onUpdateError: createOn(IPC_CHANNELS.UPDATE.ERROR),
  },

  // Sidecar / API Server
  sidecar: {
    start: createInvoke<boolean>(IPC_CHANNELS.SIDECAR.START),
    stop: createInvoke<boolean>(IPC_CHANNELS.SIDECAR.STOP),
    restart: createInvoke<boolean>(IPC_CHANNELS.SIDECAR.RESTART),
    getStatus: createInvoke<SidecarStatus>(IPC_CHANNELS.SIDECAR.GET_STATUS),
    getApiUrl: createInvoke<string | undefined>(IPC_CHANNELS.SIDECAR.GET_API_URL),
    getAuthPassword: createInvoke<string | undefined>(IPC_CHANNELS.SIDECAR.GET_AUTH_PASSWORD),
    onStatusChanged: createOn(IPC_CHANNELS.SIDECAR.STATUS_CHANGED),
  },
});

// Notify main process that preload is ready
ipcRenderer.send('preload:ready');
