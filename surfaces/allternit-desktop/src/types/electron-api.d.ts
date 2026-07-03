/**
 * TypeScript type declarations for Electron APIs exposed via contextBridge.
 *
 * This declaration matches the API surface exposed by src/preload/index.ts
 * as `window.allternit` and `window.allternitSidecar`.
 */

export interface BackendStatus {
  installed: boolean;
  running: boolean;
  version?: string;
  url: string;
}

export interface SidecarStatus {
  status: 'stopped' | 'starting' | 'running' | 'error' | 'crashed';
}

export interface ConnectionState {
  mode: 'bundled' | 'remote' | 'development';
  url: string;
  status?: string;
  lastError?: string;
}

export interface BackendConfig {
  mode: 'bundled' | 'remote';
  remoteUrl?: string;
}

export interface ConnectionAPI {
  test(): Promise<ConnectionState>;
  getBackend(): Promise<{ mode: 'bundled' | 'remote' | 'development'; url: string }>;
  setBackend(config: BackendConfig): Promise<void>;
  onStateChange(callback: (state: unknown) => void): () => void;
}

export interface SidecarAPI {
  start(): Promise<boolean>;
  stop(): Promise<boolean>;
  restart(): Promise<boolean>;
  getStatus(): Promise<SidecarStatus['status']>;
  getApiUrl(): Promise<string | undefined>;
  getAuthPassword(): Promise<string | undefined>;
  getBasicAuth(): Promise<{ username: string; password: string; header: string } | undefined>;
  getPersistedConfig(): Promise<{ apiUrl: string; password: string; port: number } | null>;
  clearPersistedConfig(): Promise<boolean>;
  onStatusChanged(handler: (status: string) => void): () => void;
}

export interface BackendAPI {
  getStatus(): Promise<BackendStatus>;
  restart(): Promise<string>;
  sidecar: SidecarAPI;
  onDownloadProgress(handler: (progress: { stage: string; percent: number }) => void): () => void;
}

export interface VmSetupAPI {
  checkConnectivity(): Promise<{
    internet: boolean;
    github: boolean;
    allternitServices: boolean;
  }>;
  downloadImages(onProgress: (progress: {
    stage: 'downloading' | 'verifying' | 'extracting' | 'complete';
    fileName: string;
    bytesDownloaded: number;
    totalBytes: number;
    speed: number;
    eta: number;
  }) => void): Promise<boolean>;
  initializeVm(onProgress: (progress: {
    stage: 'verifying' | 'booting' | 'connecting' | 'ready';
    message: string;
    progress: number;
  }) => void): Promise<boolean>;
  checkImagesExist(): Promise<boolean>;
  getStatus(): Promise<'stopped' | 'starting' | 'running' | 'error'>;
}

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowState {
  maximized: boolean;
  minimized: boolean;
  fullscreen: boolean;
  focused: boolean;
  bounds: WindowBounds;
}

export interface WindowAPI {
  minimize(): Promise<void>;
  maximize(): Promise<{ maximized: boolean }>;
  close(): Promise<void>;
  isMaximized(): Promise<boolean>;
  fullscreen(enabled?: boolean): Promise<{ fullscreen: boolean }>;
  setAlwaysOnTop(enabled: boolean): Promise<void>;
  getState(): Promise<WindowState>;
  getBounds(): Promise<WindowBounds>;
  setBounds(bounds: Partial<WindowBounds>): Promise<void>;
  center(): Promise<void>;
  hide(): Promise<void>;
  show(): Promise<void>;
  minimizeToTray(): Promise<void>;
  onEvent(event: string, handler: (payload: unknown) => void): () => void;
}

export interface StoreAPI {
  get<T>(key: string): Promise<T>;
  set<T>(key: string, value: T): Promise<void>;
}

export interface AppInfo {
  version: string;
  platform: string;
  isPackaged: boolean;
  manifest: unknown;
}

export interface AppAPI {
  getInfo(): Promise<AppInfo>;
  isFirstLaunch(): Promise<boolean>;
  completeOnboarding(): Promise<boolean>;
}

export interface AuthAccount {
  userId: string;
  userEmail: string;
  accessToken: string;
  expiresAt: number;
}

export interface AuthAPI {
  startLogin(): Promise<void>;
  getSession(): Promise<AuthAccount | null>;
  listAccounts(): Promise<Array<{
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
  }>>;
  forgetAccount(userId: string): Promise<void>;
  signOut(): Promise<void>;
  hardSignOut(): Promise<void>;
}

export interface ShellAPI {
  openExternal(url: string): Promise<void>;
  getOfficeHostStatus(): Promise<Record<'word' | 'excel' | 'powerpoint', {
    installed: boolean;
    running: boolean;
    bundlePath: string | null;
  }>>;
  showSave(options: unknown): Promise<unknown>;
  showOpen(options: unknown): Promise<unknown>;
}

export interface ThemeAPI {
  get(): Promise<'light' | 'dark'>;
  set(theme: 'light' | 'dark' | 'system'): Promise<void>;
  onChanged(handler: (dark: boolean) => void): () => void;
}

export interface ExtensionAPI {
  getStatus(): Promise<{ connected: boolean }>;
  send(message: unknown): Promise<boolean>;
  onMessage(handler: (message: unknown) => void): () => void;
  onStatusChange(handler: (status: { connected: boolean }) => void): () => void;
}

export type TunnelStatus = 'stopped' | 'starting' | 'running' | 'error';
export interface TunnelState {
  status: TunnelStatus;
  url?: string;
  error?: string;
}

export interface TunnelAPI {
  enable(): Promise<{ success: boolean; url?: string; error?: string }>;
  start(): Promise<{ success: boolean; url?: string; token?: string; error?: string }>;
  disable(): Promise<{ success: boolean }>;
  getUrl(): Promise<string | null>;
  getState(): Promise<TunnelState>;
  onStateChange(handler: (state: TunnelState) => void): () => void;
}

export interface ChromeAPI {
  launch(url: string): Promise<{ success: boolean; pid?: number; debugPort?: number; error?: string }>;
  navigate(url: string): Promise<{ success: boolean; error?: string }>;
  close(): Promise<{ success: boolean }>;
}

export type PermissionPanel = 'accessibility' | 'screen-recording';
export interface PermissionStatus {
  accessibility: 'granted' | 'denied' | 'unknown' | 'not-applicable';
  screenRecording: 'granted' | 'denied' | 'unknown' | 'not-applicable';
}

export interface PermissionGuideAPI {
  check(): Promise<PermissionStatus>;
  requestCheck(): Promise<PermissionStatus>;
  readyForCheck(): Promise<PermissionStatus>;
  present(panel: PermissionPanel): Promise<{ success: boolean; alreadyGranted?: boolean; error?: string }>;
  dismiss(): Promise<{ success: boolean; error?: string }>;
  getStatus(): Promise<{ active: boolean }>;
  onStatusChanged(handler: (status: PermissionStatus) => void): () => void;
}

export interface FeatureFlagsAPI {
  get(key?: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<boolean>;
  onChanged(handler: (key: string, value: unknown) => void): () => void;
}

export interface PersistedStateAPI {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<boolean>;
  patch(key: string, partial: unknown): Promise<boolean>;
  onChanged(handler: (key: string, value: unknown) => void): () => void;
}

export interface FindInPageResult {
  requestId: number;
  activeMatchOrdinal: number;
  matches: number;
  finalUpdate: boolean;
}

export interface FindInPageAPI {
  search(text: string, options?: { forward?: boolean; matchCase?: boolean }): Promise<void>;
  next(): Promise<void>;
  previous(): Promise<void>;
  stop(keepSelection?: boolean): Promise<void>;
  onResult(handler: (result: FindInPageResult) => void): () => void;
}

export interface LocaleAPI {
  get(): Promise<string>;
  set(locale: string): Promise<boolean>;
  onChanged(handler: (locale: string) => void): () => void;
}

export interface MenuBarAPI {
  getMode(): Promise<boolean>;
  setMode(enabled: boolean): Promise<boolean>;
  onModeChanged(handler: (enabled: boolean) => void): () => void;
}

export interface StartupAPI {
  getOnLogin(): Promise<boolean>;
  setOnLogin(enabled: boolean): Promise<boolean>;
}

export interface ResearchAPI {
  getStatus(): Promise<{ running: boolean; ready: boolean }>;
  start(): Promise<boolean>;
  stop(): Promise<void>;
}

export interface McpAPI {
  listServers(): Promise<unknown[]>;
  listTools(serverId?: string): Promise<unknown[]>;
  callTool(serverId: string, toolName: string, args: unknown): Promise<{ success: boolean; result?: unknown; error?: string }>;
  addServer(id: string, config: unknown): Promise<{ success: boolean; error?: string }>;
  removeServer(id: string): Promise<{ success: boolean; error?: string }>;
  onServerReady(handler: (data: { serverId: string; tools: unknown[] }) => void): () => void;
  onServerError(handler: (data: { serverId: string; error: string }) => void): () => void;
}

export interface WorkerAPI {
  send(workerName: string, message: unknown): Promise<{ success: boolean; result?: unknown; error?: string }>;
  list(): Promise<string[]>;
}

export interface HyperframesAPI {
  check(): Promise<{ available: boolean; version?: string }>;
  render(
    html: string,
    options?: { format?: 'mp4' | 'mov' | 'webm'; fps?: number; width?: number; height?: number }
  ): Promise<{ success: boolean; savedPath?: string; error?: string }>;
  onProgress(handler: (message: string) => void): () => void;
}

export interface MiniAppInstallProgress {
  id: string;
  line: string;
  type: 'stdout' | 'stderr' | 'info';
}

export interface MiniAppStatus {
  managed: boolean;
  running: boolean;
  port: number | null;
}

export interface MiniAppsAPI {
  install(id: string): Promise<{ success: boolean; error?: string }>;
  start(id: string): Promise<{ success: boolean; error?: string }>;
  stop(id: string): Promise<{ success: boolean }>;
  getStatus(id: string): Promise<MiniAppStatus>;
  onProgress(handler: (p: MiniAppInstallProgress) => void): () => void;
}

export interface AllternitDesktopAPI {
  sdk: { getBackendUrl(): Promise<string> };
  connection: ConnectionAPI;
  backend: BackendAPI;
  vm: VmSetupAPI;
  window: WindowAPI;
  store: StoreAPI;
  state: PersistedStateAPI;
  app: AppAPI;
  auth: AuthAPI;
  shell: ShellAPI;
  theme: ThemeAPI;
  chrome: ChromeAPI;
  extension: ExtensionAPI;
  tunnel: TunnelAPI;
  permissionGuide: PermissionGuideAPI;
  featureFlags: FeatureFlagsAPI;
  findInPage: FindInPageAPI;
  locale: LocaleAPI;
  menuBar: MenuBarAPI;
  startup: StartupAPI;
  mcp: McpAPI;
  research: ResearchAPI;
  worker: WorkerAPI;
  hyperframes: HyperframesAPI;
  miniApps: MiniAppsAPI;
}

declare global {
  interface Window {
    allternit: AllternitDesktopAPI;
    allternitSidecar: SidecarAPI;
  }
}

export {};
