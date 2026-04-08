/**
 * Allternit Desktop — Preload Script
 *
 * Exposes safe, structured APIs to the renderer via contextBridge.
 * The renderer (https://platform.allternit.com or local backend /platform)
 * accesses these as `window.allternit.*`.
 */

import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

// ─── SDK / Backend URL ────────────────────────────────────────────────────────

const sdkAPI = {
  /** Resolves the active backend URL so the renderer can init its API client. */
  getBackendUrl: (): Promise<string> => ipcRenderer.invoke('sdk:get-backend-url'),
};

// ─── Connection / Backend mode ────────────────────────────────────────────────

const connectionAPI = {
  test: (): Promise<{ mode: string; url: string; status: string; lastError?: string }> =>
    ipcRenderer.invoke('connection:test'),
  getBackend: (): Promise<{ mode: 'bundled' | 'remote' | 'development'; url: string }> =>
    ipcRenderer.invoke('connection:get-backend'),
  setBackend: (config: { mode: 'bundled' | 'remote'; remoteUrl?: string }): Promise<void> =>
    ipcRenderer.invoke('connection:set-backend', config),
  onStateChange: (callback: (state: unknown) => void): (() => void) => {
    const handler = (_: IpcRendererEvent, state: unknown) => callback(state);
    ipcRenderer.on('connection:state', handler);
    return () => ipcRenderer.off('connection:state', handler);
  },
};

// ─── Backend / Sidecar lifecycle ──────────────────────────────────────────────

const backendAPI = {
  getStatus: (): Promise<{ installed: boolean; running: boolean; version?: string; url: string }> =>
    ipcRenderer.invoke('backend:get-status'),
  restart: (): Promise<string> => ipcRenderer.invoke('backend:restart'),
  /** Legacy sidecar controls (API server subprocess) */
  sidecar: {
    start: (): Promise<boolean> => ipcRenderer.invoke('sidecar:start'),
    stop: (): Promise<boolean> => ipcRenderer.invoke('sidecar:stop'),
    restart: (): Promise<boolean> => ipcRenderer.invoke('sidecar:restart'),
    getStatus: (): Promise<'stopped' | 'starting' | 'running' | 'error' | 'crashed'> =>
      ipcRenderer.invoke('sidecar:get-status'),
    getApiUrl: (): Promise<string | undefined> => ipcRenderer.invoke('sidecar:get-api-url'),
    getAuthPassword: (): Promise<string | undefined> =>
      ipcRenderer.invoke('sidecar:get-auth-password'),
    onStatusChanged: (handler: (status: string) => void): (() => void) => {
      const listener = (_: IpcRendererEvent, s: string) => handler(s);
      ipcRenderer.on('sidecar:status-changed', listener);
      return () => ipcRenderer.removeListener('sidecar:status-changed', listener);
    },
  },
};

// ─── VM Setup (onboarding wizard) ─────────────────────────────────────────────

type DownloadProgress = {
  stage: 'downloading' | 'verifying' | 'extracting' | 'complete';
  fileName: string;
  bytesDownloaded: number;
  totalBytes: number;
  speed: number;
  eta: number;
};

type InitProgress = {
  stage: 'verifying' | 'booting' | 'connecting' | 'ready';
  message: string;
  progress: number;
};

const vmAPI = {
  checkConnectivity: (): Promise<{ internet: boolean; github: boolean; allternitServices: boolean }> =>
    ipcRenderer.invoke('vm-setup:check-connectivity'),

  downloadImages: (onProgress: (p: DownloadProgress) => void): Promise<boolean> => {
    const listener = (_: IpcRendererEvent, p: unknown) => onProgress(p as DownloadProgress);
    ipcRenderer.on('vm-setup:download-progress', listener);
    return ipcRenderer.invoke('vm-setup:download-images').finally(() => {
      ipcRenderer.removeListener('vm-setup:download-progress', listener);
    });
  },

  initializeVm: (onProgress: (p: InitProgress) => void): Promise<boolean> => {
    const listener = (_: IpcRendererEvent, p: unknown) => onProgress(p as InitProgress);
    ipcRenderer.on('vm-setup:init-progress', listener);
    return ipcRenderer.invoke('vm-setup:initialize-vm').finally(() => {
      ipcRenderer.removeListener('vm-setup:init-progress', listener);
    });
  },

  checkImagesExist: (): Promise<boolean> => ipcRenderer.invoke('vm-setup:check-images-exist'),
  getStatus: (): Promise<'stopped' | 'starting' | 'running' | 'error'> =>
    ipcRenderer.invoke('vm-setup:get-vm-status'),
};

// ─── Window controls ──────────────────────────────────────────────────────────

type WindowBounds = { x: number; y: number; width: number; height: number };
type WindowState = {
  maximized: boolean;
  minimized: boolean;
  fullscreen: boolean;
  focused: boolean;
  bounds: WindowBounds;
};

const windowAPI = {
  minimize: (): Promise<void> => ipcRenderer.invoke('window:minimize'),
  maximize: (): Promise<{ maximized: boolean }> => ipcRenderer.invoke('window:maximize'),
  close: (): Promise<void> => ipcRenderer.invoke('window:close'),
  isMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:is-maximized'),
  fullscreen: (enabled?: boolean): Promise<{ fullscreen: boolean }> =>
    ipcRenderer.invoke('window:fullscreen', enabled),
  setAlwaysOnTop: (enabled: boolean): Promise<void> =>
    ipcRenderer.invoke('window:set-always-on-top', enabled),
  getState: (): Promise<WindowState> => ipcRenderer.invoke('window:get-state'),
  getBounds: (): Promise<WindowBounds> => ipcRenderer.invoke('window:get-bounds'),
  setBounds: (bounds: Partial<WindowBounds>): Promise<void> =>
    ipcRenderer.invoke('window:set-bounds', bounds),
  center: (): Promise<void> => ipcRenderer.invoke('window:center'),
  hide: (): Promise<void> => ipcRenderer.invoke('window:hide'),
  show: (): Promise<void> => ipcRenderer.invoke('window:show'),
  minimizeToTray: (): Promise<void> => ipcRenderer.invoke('window:minimize-to-tray'),
  onEvent: (event: string, handler: (payload: unknown) => void): (() => void) => {
    const listener = (_: IpcRendererEvent, payload: unknown) => handler(payload);
    ipcRenderer.on(`window:event:${event}`, listener);
    return () => ipcRenderer.removeListener(`window:event:${event}`, listener);
  },
};

// ─── Store ────────────────────────────────────────────────────────────────────

const storeAPI = {
  get: <T>(key: string): Promise<T> => ipcRenderer.invoke('store:get', key) as Promise<T>,
  set: <T>(key: string, value: T): Promise<void> => ipcRenderer.invoke('store:set', key, value),
};

// ─── App info ─────────────────────────────────────────────────────────────────

const appAPI = {
  getInfo: (): Promise<{
    version: string;
    platform: string;
    isPackaged: boolean;
    manifest: unknown;
  }> => ipcRenderer.invoke('app:get-info'),
};

// ─── Shell ────────────────────────────────────────────────────────────────────

const shellAPI = {
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('shell:open-external', url),
  showSave: (options: unknown): Promise<unknown> => ipcRenderer.invoke('dialog:show-save', options),
  showOpen: (options: unknown): Promise<unknown> => ipcRenderer.invoke('dialog:show-open', options),
};

// ─── Theme ────────────────────────────────────────────────────────────────────

const themeAPI = {
  get: (): Promise<'light' | 'dark'> => ipcRenderer.invoke('theme:get'),
  set: (theme: 'light' | 'dark' | 'system'): Promise<void> =>
    ipcRenderer.invoke('theme:set', theme),
  onChanged: (handler: (dark: boolean) => void): (() => void) => {
    const listener = (_: IpcRendererEvent, dark: boolean) => handler(dark);
    ipcRenderer.on('theme:updated', listener);
    return () => ipcRenderer.removeListener('theme:updated', listener);
  },
};

// ─── Chrome side-by-side embed ────────────────────────────────────────────────

const chromeAPI = {
  launch: (url: string): Promise<{ success: boolean; pid?: number; debugPort?: number; error?: string }> =>
    ipcRenderer.invoke('chrome:launch', url),
  navigate: (url: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('chrome:navigate', url),
  close: (): Promise<{ success: boolean }> => ipcRenderer.invoke('chrome:close'),
};

// ─── Expose ───────────────────────────────────────────────────────────────────

const allternitDesktopAPI = {
  sdk: sdkAPI,
  connection: connectionAPI,
  backend: backendAPI,
  vm: vmAPI,
  window: windowAPI,
  store: storeAPI,
  app: appAPI,
  shell: shellAPI,
  theme: themeAPI,
  chrome: chromeAPI,
};

contextBridge.exposeInMainWorld('allternit', allternitDesktopAPI);

declare global {
  interface Window {
    allternit: typeof allternitDesktopAPI;
  }
}

console.log('[preload] Allternit Desktop preload loaded.');
