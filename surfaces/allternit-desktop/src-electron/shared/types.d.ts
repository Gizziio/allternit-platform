/**
 * Type Definitions
 *
 * Global type declarations for Electron IPC communication.
 * Extends the Window interface and defines IPC response types.
 */

import { IPC_CHANNELS } from './ipc-channels';
import { StoreSchema, StoreKey, ThemeMode } from './store-schema';

/**
 * Notification category types
 */
export type NotificationCategory =
  | 'message'
  | 'workflow'
  | 'agent-mail'
  | 'system'
  | 'update';

/**
 * Extended notification options with Allternit-specific metadata
 */
export interface NotificationOptions {
  title: string;
  body?: string;
  icon?: string;
  silent?: boolean;
  category?: NotificationCategory;
  data?: {
    sessionId?: string;
    workflowId?: string;
    messageId?: string;
    threadId?: string;
    mode?: string;
    url?: string;
  };
}

/**
 * Notification settings
 */
export interface NotificationSettings {
  enabled: boolean;
  soundEnabled: boolean;
  doNotDisturb: boolean;
  categorySettings: {
    message: boolean;
    workflow: boolean;
    'agent-mail': boolean;
    system: boolean;
    update: boolean;
  };
}

/**
 * Recent session item
 */
export interface RecentSession {
  id: string;
  name: string;
  timestamp: number;
}

/**
 * Recent document item
 */
export interface RecentDocument {
  path: string;
  name: string;
}

/**
 * Power monitor state
 */
export interface PowerState {
  isOnBattery: boolean;
  isScreenLocked: boolean;
  systemIdleTime: number;
  connectionState: 'connected' | 'paused' | 'disconnected';
  lastWakeTime: number | null;
  lastSleepTime: number | null;
}

/**
 * Idle state information
 */
export interface IdleState {
  idleTime: number;
  idleThreshold: number;
  isIdle: boolean;
}

/**
 * Parsed deep link structure
 */
export interface ParsedDeepLink {
  protocol: string;
  host: string;
  pathname: string;
  searchParams: Record<string, string>;
  hash: string;
}

/**
 * IPC request structure
 */
export interface IpcRequest<T = unknown> {
  channel: string;
  data?: T;
}

/**
 * IPC response structure
 */
export interface IpcResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Dialog options for save/open dialogs
 */
export interface DialogOptions {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  filters?: Array<{
    name: string;
    extensions: string[];
  }>;
  message?: string;
  nameFieldLabel?: string;
  showsTagField?: boolean;
  properties?: string[];
}

/**
 * Dialog result structure
 */
export interface DialogResult {
  canceled: boolean;
  filePath?: string;
  filePaths?: string[];
  bookmark?: string;
}

/**
 * Update information structure
 */
export interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseNotes?: string;
}

/**
 * Update check result
 */
export interface UpdateCheckResult {
  updateAvailable: boolean;
  info?: UpdateInfo;
}

/**
 * Update download progress
 */
export interface UpdateDownloadProgress {
  percent: number;
  bytesPerSecond: number;
  total: number;
  transferred: number;
}

/**
 * Update strategy types
 */
export type UpdateStrategy = 'silent' | 'prompt' | 'force';

/**
 * Update channel types
 */
export type UpdateChannel = 'stable' | 'beta' | 'alpha';

/**
 * Updater status information
 */
export interface UpdaterStatus {
  currentVersion: string;
  updateAvailable: boolean;
  updateInfo: UpdateInfo | null;
  downloadProgress: UpdateDownloadProgress | null;
  isDownloading: boolean;
  updateDownloaded: boolean;
  channel: UpdateChannel;
  strategy: UpdateStrategy;
}

/**
 * Sidecar API server status
 */
export type SidecarStatus = 'stopped' | 'starting' | 'running' | 'error' | 'crashed';

/**
 * VM status types
 */
export type VMStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'error';

/**
 * VM information
 */
export interface VMInfo {
  status: VMStatus;
  version?: string;
  pid?: number;
  socketPath?: string;
  error?: string;
}

/**
 * VM setup options
 */
export interface VMSetupOptions {
  force?: boolean;
  version?: string;
}

/**
 * VM execution options
 */
export interface VMExecuteOptions {
  command: string;
  args?: string[];
  workingDir?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
}

/**
 * VM execution result
 */
export interface VMExecuteResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTimeMs: number;
}

/**
 * Store operation result
 */
export interface StoreOperationResult<T = unknown> {
  success: boolean;
  value?: T;
  error?: string;
}

/**
 * Window bounds information
 */
export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Electron API exposed to the renderer process
 */
export interface ElectronAPI {
  /**
   * Send a message to the main process (fire-and-forget)
   */
  send: (channel: string, ...args: unknown[]) => void;

  /**
   * Invoke a method in the main process and wait for response
   */
  invoke: <T = unknown>(channel: string, ...args: unknown[]) => Promise<T>;

  /**
   * Listen for messages from the main process
   */
  on: (channel: string, callback: (...args: unknown[]) => void) => () => void;

  /**
   * Listen for messages from the main process once
   */
  once: (channel: string, callback: (...args: unknown[]) => void) => void;

  /**
   * Remove a specific listener
   */
  removeListener: (channel: string, callback: (...args: unknown[]) => void) => void;

  /**
   * Remove all listeners for a channel
   */
  removeAllListeners: (channel: string) => void;

  /**
   * Store operations
   */
  store: {
    get: <K extends StoreKey>(key: K) => Promise<StoreSchema[K]>;
    set: <K extends StoreKey>(key: K, value: StoreSchema[K]) => Promise<boolean>;
    delete: (key: StoreKey) => Promise<boolean>;
  };

  /**
   * Window controls
   */
  window: {
    minimize: () => void;
    maximize: () => void;
    close: () => void;
    setFullscreen: (fullscreen: boolean) => void;
    getBounds: () => Promise<WindowBounds>;
    setBounds: (bounds: WindowBounds) => void;
  };

  /**
   * App information
   */
  app: {
    getVersion: () => Promise<string>;
    quit: () => void;
  };

  /**
   * Native dialogs
   */
  dialog: {
    showSave: (options?: DialogOptions) => Promise<DialogResult>;
    showOpen: (options?: DialogOptions) => Promise<DialogResult>;
  };

  /**
   * Notifications
   */
  notification: {
    show: (options: NotificationOptions) => Promise<void>;
    getSettings: () => Promise<NotificationSettings>;
    updateSettings: (settings: Partial<NotificationSettings>) => Promise<void>;
    toggleDoNotDisturb: () => Promise<boolean>;
    setCategoryEnabled: (category: NotificationCategory, enabled: boolean) => Promise<void>;
    clearBadge: () => Promise<void>;
    getBadgeCount: () => Promise<number>;
  };

  /**
   * Power Monitor
   */
  power: {
    getState: () => Promise<PowerState>;
    isOnBattery: () => Promise<boolean>;
    getIdleTime: () => Promise<number>;
    isScreenLocked: () => Promise<boolean>;
    getIdleState: () => Promise<IdleState>;
    pauseConnections: () => Promise<void>;
    resumeConnections: () => Promise<void>;
    onSuspend: (callback: () => void) => () => void;
    onResume: (callback: () => void) => () => void;
  };

  /**
   * Protocol/Deep Links
   */
  protocol: {
    buildUrl: (path: string, params?: Record<string, string>) => Promise<string>;
    open: (url: string) => Promise<boolean>;
    isRegistered: () => Promise<boolean>;
    parse: (url: string) => Promise<ParsedDeepLink | null>;
    onOpenUrl: (callback: (url: string) => void) => () => void;
  };

  /**
   * Auto-updater
   */
  updater: {
    check: () => Promise<UpdateCheckResult>;
    download: () => Promise<boolean>;
    install: () => void;
    getInfo: () => Promise<UpdaterStatus>;
    setChannel: (channel: UpdateChannel) => Promise<void>;
    getChannel: () => Promise<UpdateChannel>;
    onUpdateAvailable: (callback: (info: { info: UpdateInfo; strategy: UpdateStrategy }) => void) => () => void;
    onDownloadProgress: (callback: (progress: UpdateDownloadProgress) => void) => () => void;
    onUpdateDownloaded: (callback: (info: UpdateInfo) => void) => () => void;
    onUpdateError: (callback: (error: { message: string; stack?: string }) => void) => () => void;
  };

  /**
   * External links
   */
  shell: {
    openExternal: (url: string) => Promise<boolean>;
  };

  /**
   * Sidecar / API Server
   */
  sidecar: {
    start: () => Promise<boolean>;
    stop: () => Promise<boolean>;
    restart: () => Promise<boolean>;
    getStatus: () => Promise<SidecarStatus>;
    getApiUrl: () => Promise<string | undefined>;
    getAuthPassword: () => Promise<string | undefined>;
    onStatusChanged: (callback: (status: SidecarStatus) => void) => () => void;
  };

  /**
   * VM Management
   */
  vm: {
    getStatus: () => Promise<VMInfo>;
    start: () => Promise<boolean>;
    stop: () => Promise<boolean>;
    restart: () => Promise<boolean>;
    execute: (options: VMExecuteOptions) => Promise<VMExecuteResult>;
    setup: (options?: VMSetupOptions) => Promise<boolean>;
    checkImages: () => Promise<boolean>;
    downloadImages: (options?: VMSetupOptions) => Promise<boolean>;
    onStatusChanged: (callback: (status: VMStatus) => void) => () => void;
  };
}

/**
 * Global Window interface extension
 */
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

/**
 * Type-only export to make this a module
 */
export {};
