/**
 * TypeScript type declarations for Electron APIs exposed via contextBridge
 */

export interface VmSetupAPI {
  /** Check internet connectivity */
  checkConnectivity(): Promise<{
    internet: boolean;
    github: boolean;
    a2rServices: boolean;
  }>;

  /** Download VM images */
  downloadVmImages(
    onProgress: (progress: {
      stage: 'downloading' | 'verifying' | 'extracting' | 'complete';
      fileName: string;
      bytesDownloaded: number;
      totalBytes: number;
      speed: number;
      eta: number;
    }) => void
  ): Promise<boolean>;

  /** Build VM images locally (Linux only) */
  buildVmImages(
    onProgress: (progress: {
      stage: string;
      fileName: string;
      bytesDownloaded: number;
      totalBytes: number;
    }) => void
  ): Promise<boolean>;

  /** Initialize VM */
  initializeVm(
    onProgress: (progress: {
      stage: 'verifying' | 'booting' | 'connecting' | 'ready';
      message: string;
      progress: number;
    }) => void
  ): Promise<boolean>;

  /** Check if VM images exist */
  checkImagesExist(): Promise<boolean>;

  /** Get VM status */
  getVmStatus(): Promise<'stopped' | 'starting' | 'running' | 'error'>;
}

export interface SidecarAPI {
  start(): Promise<boolean>;
  stop(): Promise<boolean>;
  restart(): Promise<boolean>;
  getStatus(): Promise<'stopped' | 'starting' | 'running' | 'error' | 'crashed'>;
  getApiUrl(): Promise<string | undefined>;
  getAuthPassword(): Promise<string | undefined>;
  getBasicAuth(): Promise<{ username: string; password: string; header: string } | undefined>;
  getPersistedConfig(): Promise<{ apiUrl: string; password: string; port: number } | null>;
  clearPersistedConfig(): Promise<boolean>;
  onStatusChanged(handler: (status: string) => void): () => void;
}

export interface WindowAPI {
  create(options: {
    url?: string;
    title?: string;
    width?: number;
    height?: number;
    x?: number;
    y?: number;
    alwaysOnTop?: boolean;
    transparent?: boolean;
    fullscreen?: boolean;
    maximized?: boolean;
    hidden?: boolean;
    webPreferences?: {
      nodeIntegration?: boolean;
      contextIsolation?: boolean;
      webSecurity?: boolean;
      allowRunningInsecureContent?: boolean;
    };
  }): Promise<{ success: boolean; windowId?: string; error?: string }>;
  close(windowId?: string): Promise<{ success: boolean; error?: string }>;
  focus(windowId?: string): Promise<{ success: boolean; error?: string }>;
  maximize(windowId?: string): Promise<{ success: boolean; error?: string }>;
  minimize(windowId?: string): Promise<{ success: boolean; error?: string }>;
  unmaximize(windowId?: string): Promise<{ success: boolean; error?: string }>;
  fullscreen(windowId?: string): Promise<{ success: boolean; error?: string }>;
  setAlwaysOnTop(alwaysOnTop: boolean, windowId?: string): Promise<{ success: boolean; error?: string }>;
  setBounds(bounds: { x?: number; y?: number; width?: number; height?: number }, windowId?: string): Promise<{ success: boolean; error?: string }>;
  getBounds(windowId?: string): Promise<{ x: number; y: number; width: number; height: number }>;
  getState(windowId?: string): Promise<{
    id: string;
    maximized: boolean;
    minimized: boolean;
    fullscreen: boolean;
    focused: boolean;
    bounds: { x: number; y: number; width: number; height: number };
    alwaysOnTop: boolean;
  }>;
  center(windowId?: string): Promise<{ success: boolean; error?: string }>;
  flashFrame(flag: boolean): Promise<{ success: boolean; error?: string }>;
  setTitle(title: string): Promise<{ success: boolean; error?: string }>;
  getFocusedId(): Promise<string | null>;
  closeAll(): Promise<{ success: boolean }>;
  getCount(): Promise<number>;
  exists(windowId: string): Promise<boolean>;
  hide(): Promise<{ success: boolean; error?: string }>;
  show(): Promise<{ success: boolean; error?: string }>;
  minimizeToTray(): Promise<{ success: boolean; error?: string }>;
  onWindowEvent(event: string, handler: (payload: unknown) => void): () => void;
}

declare global {
  interface Window {
    a2rVmSetup: VmSetupAPI;
    a2rSidecar: SidecarAPI;
    a2rWindow: WindowAPI;
  }
}

export {};
