export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowMessage {
  sourceWindowId: string;
  targetWindowId: string;
  channel: string;
  payload: unknown;
  timestamp: number;
}

export interface WindowInfo {
  id: string;
  title: string;
  isFocused: boolean;
  isVisible: boolean;
}

export interface ElectronAPI {
  // Window controls
  minimizeWindow: () => void;
  maximizeWindow: () => void;
  closeWindow: () => void;
  isWindowMaximized: () => Promise<boolean>;
  getWindowBounds: () => Promise<WindowBounds | undefined>;

  // Window state
  setUnsavedChanges: (hasChanges: boolean, message?: string) => void;
  confirmClose: (options: {
    title?: string;
    message?: string;
    detail?: string;
  }) => Promise<number>;

  // Window events
  onWindowFocus: (callback: () => void) => void;
  onWindowBlur: (callback: () => void) => void;
  onWindowShow: (callback: () => void) => void;
  onWindowHide: (callback: () => void) => void;
  onWindowMaximize: (callback: (isMaximized: boolean) => void) => void;
  onWindowFullScreen: (callback: (isFullScreen: boolean) => void) => void;
  onWindowResize: (callback: (bounds: WindowBounds) => void) => void;
  onWindowMove: (callback: (bounds: WindowBounds) => void) => void;

  // Event listeners removal
  removeWindowFocusListener: (callback: () => void) => void;
  removeWindowBlurListener: (callback: () => void) => void;
  removeWindowShowListener: (callback: () => void) => void;
  removeWindowHideListener: (callback: () => void) => void;
  removeWindowMaximizeListener: (callback: (isMaximized: boolean) => void) => void;
  removeWindowFullScreenListener: (callback: (isFullScreen: boolean) => void) => void;
  removeWindowResizeListener: (callback: (bounds: WindowBounds) => void) => void;
  removeWindowMoveListener: (callback: (bounds: WindowBounds) => void) => void;

  // Multi-window communication
  sendWindowMessage: (
    targetWindowId: string,
    channel: string,
    payload: unknown
  ) => Promise<boolean>;
  broadcastMessage: (channel: string, payload: unknown) => Promise<void>;
  getWindows: () => Promise<WindowInfo[]>;
  focusWindow: (windowId: string) => Promise<boolean>;
  closeWindowById: (windowId: string) => Promise<boolean>;
  onWindowMessage: (callback: (message: WindowMessage) => void) => void;
  removeWindowMessageListener: (callback: (message: WindowMessage) => void) => void;

  // Theme
  getTheme: () => Promise<'light' | 'dark'>;
  setTheme: (theme: 'light' | 'dark' | 'system') => Promise<void>;
  onThemeUpdated: (callback: (isDark: boolean) => void) => void;
  removeThemeUpdatedListener: (callback: (isDark: boolean) => void) => void;

  // Store
  storeGet: <T>(key: string) => Promise<T | undefined>;
  storeSet: <T>(key: string, value: T) => Promise<void>;
  storeDelete: (key: string) => Promise<void>;
  storeClear: () => Promise<void>;
  storeHas: (key: string) => Promise<boolean>;

  // App
  getAppVersion: () => Promise<string>;
  getPlatform: () => Promise<string>;
  quitApp: () => void;
  relaunchApp: () => void;

  // Sidecar / API Server
  sidecar: {
    start: () => Promise<boolean>;
    stop: () => Promise<boolean>;
    restart: () => Promise<boolean>;
    getStatus: () => Promise<'stopped' | 'starting' | 'running' | 'error' | 'crashed'>;
    getApiUrl: () => Promise<string | undefined>;
    getAuthPassword: () => Promise<string | undefined>;
    onStatusChanged: (handler: (status: string) => void) => () => void;
  };
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
    a2rSidecar?: {
      start: () => Promise<boolean>;
      stop: () => Promise<boolean>;
      restart: () => Promise<boolean>;
      getStatus: () => Promise<'stopped' | 'starting' | 'running' | 'error' | 'crashed'>;
      getApiUrl: () => Promise<string | undefined>;
      getAuthPassword: () => Promise<string | undefined>;
      onStatusChanged: (handler: (status: string) => void) => () => void;
    };
  }
}

export {};
