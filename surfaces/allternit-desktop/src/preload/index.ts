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
  isFirstLaunch: (): Promise<boolean> => ipcRenderer.invoke('app:is-first-launch'),
  completeOnboarding: (): Promise<boolean> => ipcRenderer.invoke('app:complete-onboarding'),
};

// ─── Auth ─────────────────────────────────────────────────────────────────────

const authAPI = {
  startLogin: async (): Promise<void> => {
    ipcRenderer.send('auth:start-login');
  },
  getSession: (): Promise<null | {
    userId: string;
    userEmail: string;
    accessToken: string;
    expiresAt: number;
  }> => ipcRenderer.invoke('auth:get-session'),
  listAccounts: (): Promise<Array<{
    userId: string;
    userEmail: string;
    clientId: string;
    lastSignedInAt: string;
    lastSeenAt: string;
    current: boolean;
    backend?: {
      mode: 'bundled' | 'remote' | 'development';
      remoteUrl?: string;
    };
  }>> => ipcRenderer.invoke('auth:list-accounts'),
  forgetAccount: (userId: string): Promise<void> =>
    ipcRenderer.invoke('auth:forget-account', userId),
  signOut: (): Promise<void> => ipcRenderer.invoke('auth:sign-out'),
  hardSignOut: (): Promise<void> => ipcRenderer.invoke('auth:sign-out'),
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

// ─── Extension Bridge ─────────────────────────────────────────────────────────
// Lets the platform renderer listen for Chrome extension messages relayed via
// the native messaging host and send responses back.

const extensionAPI = {
  getStatus: (): Promise<{ connected: boolean }> =>
    ipcRenderer.invoke('extension:get-status'),
  send: (message: unknown): Promise<boolean> =>
    ipcRenderer.invoke('extension:send', message),
  onMessage: (handler: (message: unknown) => void): (() => void) => {
    const listener = (_: IpcRendererEvent, msg: unknown) => handler(msg);
    ipcRenderer.on('extension:message', listener);
    return () => ipcRenderer.removeListener('extension:message', listener);
  },
  onStatusChange: (handler: (status: { connected: boolean }) => void): (() => void) => {
    const listener = (_: IpcRendererEvent, status: { connected: boolean }) => handler(status);
    ipcRenderer.on('extension:status', listener);
    return () => ipcRenderer.removeListener('extension:status', listener);
  },
};

// ─── Tunnel (Cloudflare Web Access) ──────────────────────────────────────────

type TunnelStatus = 'stopped' | 'starting' | 'running' | 'error';
type TunnelState = { status: TunnelStatus; url?: string; error?: string };

const tunnelAPI = {
  /** Start tunnel + open browser to /connect (full "Enable Web Access" flow). */
  enable: (): Promise<{ success: boolean; url?: string; error?: string }> =>
    ipcRenderer.invoke('tunnel:enable'),
  /** Start tunnel only — returns URL + token without opening a browser tab.
   *  Use this from within the in-app onboarding wizard. */
  start: (): Promise<{ success: boolean; url?: string; token?: string; error?: string }> =>
    ipcRenderer.invoke('tunnel:start'),
  disable: (): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('tunnel:disable'),
  getUrl: (): Promise<string | null> =>
    ipcRenderer.invoke('tunnel:get-url'),
  getState: (): Promise<TunnelState> =>
    ipcRenderer.invoke('tunnel:get-status'),
  onStateChange: (handler: (state: TunnelState) => void): (() => void) => {
    const listener = (_: IpcRendererEvent, state: TunnelState) => handler(state);
    ipcRenderer.on('tunnel:state', listener);
    return () => ipcRenderer.removeListener('tunnel:state', listener);
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

// ─── Permission Guide ─────────────────────────────────────────────────────────

type PermissionPanel = 'accessibility' | 'screen-recording';
type PermissionStatus = {
  accessibility: 'granted' | 'denied' | 'unknown' | 'not-applicable';
  screenRecording: 'granted' | 'denied' | 'unknown' | 'not-applicable';
};

const permissionGuideAPI = {
  check: (): Promise<PermissionStatus> =>
    ipcRenderer.invoke('permission-guide:check'),
  requestCheck: (): Promise<PermissionStatus> =>
    ipcRenderer.invoke('permission-guide:request-check'),
  readyForCheck: (): Promise<PermissionStatus> =>
    ipcRenderer.invoke('permission-guide:ready-for-check'),
  present: (panel: PermissionPanel): Promise<{ success: boolean; alreadyGranted?: boolean; error?: string }> =>
    ipcRenderer.invoke('permission-guide:present', panel),
  dismiss: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('permission-guide:dismiss'),
  getStatus: (): Promise<{ active: boolean }> =>
    ipcRenderer.invoke('permission-guide:get-status'),
  onStatusChanged: (handler: (status: PermissionStatus) => void): (() => void) => {
    const listener = (_: IpcRendererEvent, status: PermissionStatus) => handler(status);
    ipcRenderer.on('permission-guide:status', listener);
    return () => ipcRenderer.removeListener('permission-guide:status', listener);
  },
};

// ─── Feature Flags ────────────────────────────────────────────────────────────

const featureFlagsAPI = {
  get: (key?: string): Promise<unknown> => ipcRenderer.invoke('featureFlags:get', key),
  set: (key: string, value: unknown): Promise<boolean> => ipcRenderer.invoke('featureFlags:set', key, value),
  onChanged: (handler: (key: string, value: unknown) => void): (() => void) => {
    const listener = (_: IpcRendererEvent, data: { key: string; value: unknown }) => handler(data.key, data.value);
    ipcRenderer.on('featureFlags:changed', listener);
    return () => ipcRenderer.removeListener('featureFlags:changed', listener);
  },
};

// ─── Persisted State ──────────────────────────────────────────────────────────

const stateAPI = {
  get: (key: string): Promise<unknown> => ipcRenderer.invoke('state:get', key),
  set: (key: string, value: unknown): Promise<boolean> => ipcRenderer.invoke('state:set', key, value),
  patch: (key: string, partial: unknown): Promise<boolean> => ipcRenderer.invoke('state:patch', key, partial),
  onChanged: (handler: (key: string, value: unknown) => void): (() => void) => {
    const listener = (_: IpcRendererEvent, data: { key: string; value: unknown }) => handler(data.key, data.value);
    ipcRenderer.on('state:changed', listener);
    return () => ipcRenderer.removeListener('state:changed', listener);
  },
};

// ─── Find in Page ─────────────────────────────────────────────────────────────

type FindInPageResult = { requestId: number; activeMatchOrdinal: number; matches: number; finalUpdate: boolean };

const findInPageAPI = {
  search: (text: string, options?: { forward?: boolean; matchCase?: boolean }): Promise<void> =>
    ipcRenderer.invoke('window:find-in-page', text, options),
  next: (): Promise<void> => ipcRenderer.invoke('window:find-in-page', undefined, { findNext: true }),
  previous: (): Promise<void> => ipcRenderer.invoke('window:find-in-page', undefined, { forward: false, findNext: true }),
  stop: (keepSelection?: boolean): Promise<void> => ipcRenderer.invoke('window:find-stop', keepSelection),
  onResult: (handler: (result: FindInPageResult) => void): (() => void) => {
    const listener = (_: IpcRendererEvent, result: FindInPageResult) => handler(result);
    ipcRenderer.on('window:find-result', listener);
    return () => ipcRenderer.removeListener('window:find-result', listener);
  },
};

// ─── Locale / i18n ────────────────────────────────────────────────────────────

const localeAPI = {
  get: (): Promise<string> => ipcRenderer.invoke('locale:get'),
  set: (locale: string): Promise<boolean> => ipcRenderer.invoke('locale:set', locale),
  onChanged: (handler: (locale: string) => void): (() => void) => {
    const listener = (_: IpcRendererEvent, locale: string) => handler(locale);
    ipcRenderer.on('locale:changed', listener);
    return () => ipcRenderer.removeListener('locale:changed', listener);
  },
};

// ─── Menu Bar + Startup on Login ──────────────────────────────────────────────

const menuBarAPI = {
  getMode: (): Promise<boolean> => ipcRenderer.invoke('menuBar:getMode'),
  setMode: (enabled: boolean): Promise<boolean> => ipcRenderer.invoke('menuBar:setMode', enabled),
  onModeChanged: (handler: (enabled: boolean) => void): (() => void) => {
    const listener = (_: IpcRendererEvent, enabled: boolean) => handler(enabled);
    ipcRenderer.on('menuBar:modeChanged', listener);
    return () => ipcRenderer.removeListener('menuBar:modeChanged', listener);
  },
};

const startupAPI = {
  getOnLogin: (): Promise<boolean> => ipcRenderer.invoke('startup:getOnLogin'),
  setOnLogin: (enabled: boolean): Promise<boolean> => ipcRenderer.invoke('startup:setOnLogin', enabled),
};

// ─── MCP Host ────────────────────────────────────────────────────────────────

// ─── Research Backend ────────────────────────────────────────────────────────

const researchAPI = {
  getStatus: (): Promise<{ running: boolean; ready: boolean }> =>
    ipcRenderer.invoke('research:get-status'),
  start: (): Promise<boolean> => ipcRenderer.invoke('research:start'),
  stop: (): Promise<void> => ipcRenderer.invoke('research:stop'),
};

const mcpAPI = {
  listServers: (): Promise<unknown[]> => ipcRenderer.invoke('mcp:list-servers'),
  listTools: (serverId?: string): Promise<unknown[]> => ipcRenderer.invoke('mcp:list-tools', serverId),
  callTool: (serverId: string, toolName: string, args: unknown): Promise<{ success: boolean; result?: unknown; error?: string }> =>
    ipcRenderer.invoke('mcp:call-tool', serverId, toolName, args),
  addServer: (id: string, config: unknown): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('mcp:add-server', id, config),
  removeServer: (id: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('mcp:remove-server', id),
  onServerReady: (handler: (data: { serverId: string; tools: unknown[] }) => void): (() => void) => {
    const listener = (_: IpcRendererEvent, data: unknown) => handler(data as { serverId: string; tools: unknown[] });
    ipcRenderer.on('mcp:server-ready', listener);
    return () => ipcRenderer.removeListener('mcp:server-ready', listener);
  },
  onServerError: (handler: (data: { serverId: string; error: string }) => void): (() => void) => {
    const listener = (_: IpcRendererEvent, data: unknown) => handler(data as { serverId: string; error: string });
    ipcRenderer.on('mcp:server-error', listener);
    return () => ipcRenderer.removeListener('mcp:server-error', listener);
  },
};

// ─── Worker Bus (renderer → main → worker round-trip) ────────────────────────

const workerAPI = {
  send: (workerName: string, message: unknown): Promise<{ success: boolean; result?: unknown; error?: string }> =>
    ipcRenderer.invoke('worker:send', workerName, message),
  list: (): Promise<string[]> => ipcRenderer.invoke('worker:list'),
};

// ─── HyperFrames ─────────────────────────────────────────────────────────────

const hyperframesAPI = {
  check: (): Promise<{ available: boolean; version?: string }> =>
    ipcRenderer.invoke('hyperframes:check'),
  render: (
    html: string,
    options?: { format?: 'mp4' | 'mov' | 'webm'; fps?: number; width?: number; height?: number }
  ): Promise<{ success: boolean; savedPath?: string; error?: string }> =>
    ipcRenderer.invoke('hyperframes:render', html, options ?? {}),
  onProgress: (handler: (message: string) => void): (() => void) => {
    const listener = (_: IpcRendererEvent, msg: string) => handler(msg);
    ipcRenderer.on('hyperframes:progress', listener);
    return () => ipcRenderer.removeListener('hyperframes:progress', listener);
  },
};

// ─── Expose ───────────────────────────────────────────────────────────────────

const allternitDesktopAPI = {
  sdk: sdkAPI,
  connection: connectionAPI,
  backend: backendAPI,
  vm: vmAPI,
  window: windowAPI,
  store: storeAPI,
  state: stateAPI,
  app: appAPI,
  auth: authAPI,
  shell: shellAPI,
  theme: themeAPI,
  chrome: chromeAPI,
  extension: extensionAPI,
  tunnel: tunnelAPI,
  permissionGuide: permissionGuideAPI,
  featureFlags: featureFlagsAPI,
  findInPage: findInPageAPI,
  locale: localeAPI,
  menuBar: menuBarAPI,
  startup: startupAPI,
  mcp: mcpAPI,
  research: researchAPI,
  worker: workerAPI,
  hyperframes: hyperframesAPI,
};

contextBridge.exposeInMainWorld('allternit', allternitDesktopAPI);

// ─── allternitSidecar bridge ──────────────────────────────────────────────────
// The platform renderer calls window.allternitSidecar to detect Electron and
// discover the gizzi-code AI runtime URL + credentials. This is the well-known
// interface defined in surfaces/allternit-platform/src/lib/globals.d.ts.
contextBridge.exposeInMainWorld('allternitSidecar', {
  getStatus: (): Promise<'stopped' | 'starting' | 'running' | 'error' | 'crashed'> =>
    ipcRenderer.invoke('sidecar:get-status'),
  getApiUrl: (): Promise<string | undefined> =>
    ipcRenderer.invoke('sidecar:get-api-url'),
  getBasicAuth: (): Promise<{ username: string; password: string; header: string } | undefined> =>
    ipcRenderer.invoke('sidecar:get-basic-auth'),
  getPersistedConfig: (): Promise<{ apiUrl: string; password: string; port: number } | null> =>
    ipcRenderer.invoke('sidecar:get-persisted-config'),
  clearPersistedConfig: (): Promise<boolean> =>
    ipcRenderer.invoke('sidecar:clear-persisted-config'),
});

declare global {
  interface Window {
    allternit: typeof allternitDesktopAPI;
    allternitSidecar: {
      getStatus: () => Promise<'stopped' | 'starting' | 'running' | 'error' | 'crashed'>;
      getApiUrl: () => Promise<string | undefined>;
      getBasicAuth: () => Promise<{ username: string; password: string; header: string } | undefined>;
      getPersistedConfig: () => Promise<{ apiUrl: string; password: string; port: number } | null>;
      clearPersistedConfig: () => Promise<boolean>;
    };
  }
}

console.log('[preload] Allternit Desktop preload loaded.');
