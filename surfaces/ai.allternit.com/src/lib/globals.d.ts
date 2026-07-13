import type { ChromeEmbedAPI } from "../chrome-embed";

export {};

declare global {
  type AppPermissionStatus = {
    accessibility: 'granted' | 'denied' | 'unknown' | 'not-applicable';
    screenRecording: 'granted' | 'denied' | 'unknown' | 'not-applicable';
  };

  type PermissionPanel = 'accessibility' | 'screen-recording';

  type PermissionGuideAPI = {
    check: () => Promise<AppPermissionStatus>;
    requestCheck: () => Promise<AppPermissionStatus>;
    readyForCheck: () => Promise<AppPermissionStatus>;
    present: (panel: PermissionPanel) => Promise<{ success: boolean; alreadyGranted?: boolean; error?: string }>;
    dismiss: () => Promise<{ success: boolean; error?: string }>;
    getStatus: () => Promise<{ active: boolean }>;
    onStatusChanged: (handler: (status: AppPermissionStatus) => void) => () => void;
  };

  interface Window {
    allternitSidecar?: {
      getStatus?: () => Promise<'stopped' | 'starting' | 'running' | 'error' | 'crashed'>;
      getApiUrl?: () => Promise<string | undefined>;
      getBasicAuth?: () => Promise<{ username: string; password: string; header: string } | undefined>;
      getPersistedConfig?: () => Promise<{ apiUrl: string; password: string; port: number } | null>;
      clearPersistedConfig?: () => Promise<boolean>;
    };
    allternit?: {
      auth?: {
        startLogin: () => Promise<void>;
        getSession: () => Promise<null | {
          userId: string;
          userEmail: string;
          accessToken: string;
          expiresAt: number;
        }>;
        listAccounts: () => Promise<Array<{
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
        forgetAccount: (userId: string) => Promise<void>;
        signOut: () => Promise<void>;
        hardSignOut: () => Promise<void>;
      };
      connection?: {
        getBackend: () => Promise<{ mode: 'bundled' | 'remote' | 'development'; url: string }>;
      };
      permissionGuide?: PermissionGuideAPI;
      vm?: any;
      backend?: {
        restart: () => Promise<void>;
      };
      tunnel?: {
        getState: () => Promise<{ status: 'stopped' | 'starting' | 'running' | 'error'; url?: string; error?: string }>;
        onStateChange: (handler: (state: { status: 'stopped' | 'starting' | 'running' | 'error'; url?: string; error?: string }) => void) => () => void;
        enable: () => Promise<{ success: boolean; error?: string }>;
        disable: () => Promise<void>;
      };
      shell?: {
        openExternal: (url: string) => Promise<void>;
        getOfficeHostStatus: () => Promise<Record<'word' | 'excel' | 'powerpoint', {
          installed: boolean;
          running: boolean;
          bundlePath: string | null;
        }>>;
      };
      officeAddins?: {
        getStatus: () => Promise<Record<'word' | 'excel' | 'powerpoint', {
          product: 'word' | 'excel' | 'powerpoint';
          hostInstalled: boolean;
          hostRunning: boolean;
          health: 'not-installed' | 'installed' | 'update-available' | 'needs-repair' | 'unsupported';
          installedVersion: string | null;
          availableVersion: string | null;
          manifestPath: string | null;
          installMethod: 'macos-wef' | 'windows-developer' | 'web-guided' | 'unsupported';
          detail: string;
        }>>;
        install: (product: 'word' | 'excel' | 'powerpoint') => Promise<{ ok: boolean; detail: string; requiresHostRestart?: boolean; requiresUserConfirmation?: boolean; manifestPath?: string }>;
        repair: (product: 'word' | 'excel' | 'powerpoint') => Promise<{ ok: boolean; detail: string; requiresHostRestart?: boolean; requiresUserConfirmation?: boolean; manifestPath?: string }>;
        remove: (product: 'word' | 'excel' | 'powerpoint') => Promise<{ ok: boolean; detail: string; requiresHostRestart?: boolean; requiresUserConfirmation?: boolean; manifestPath?: string }>;
      };
      app?: {
        isFirstLaunch?: () => Promise<boolean>;
      };
      miniApps?: {
        install: (id: string) => Promise<{ success: boolean; error?: string }>;
        start: (id: string) => Promise<{ success: boolean; error?: string }>;
        stop: (id: string) => Promise<{ success: boolean }>;
        getStatus: (id: string) => Promise<{ managed: boolean; running: boolean; port: number | null }>;
        launchDesktop: (id: string) => Promise<{ success: boolean; error?: string }>;
        onProgress: (handler: (p: { id: string; line: string; type: 'stdout' | 'stderr' | 'info' }) => void) => () => void;
      };
      findInPage?: {
        search: (text: string, options?: { forward?: boolean; matchCase?: boolean }) => Promise<void>;
        next: () => Promise<void>;
        previous: () => Promise<void>;
        stop: (keepSelection?: boolean) => Promise<void>;
        onResult: (handler: (result: { requestId: number; activeMatchOrdinal: number; matches: number; finalUpdate: boolean }) => void) => () => void;
      };
    };
    allternitExtension?: any;
    electron?: {
      fs?: any;
      kernel?: any;
      python?: any;
      browser?: any;
      computerUse?: any;
    };
    chromeEmbed?: ChromeEmbedAPI;
  }

  interface WindowEventMap {
    'allternit:vision_action': CustomEvent<{ type: string; action: { id: string; x: number; y: number; label?: string } }>;
    'allternit:open-settings': CustomEvent<{ section?: string }>;
    'allternit:close-settings': CustomEvent;
    'allternit:open-labs': CustomEvent;
    'allternit:open-view': CustomEvent<{ viewType: string; allowNew?: boolean; context?: unknown }>;
    'allternit:switch-mode': CustomEvent<{ mode: 'chat' | 'cowork' | 'code' | 'design' | 'browser' }>;
  }
}

declare module 'react' {
  interface CSSProperties {
    WebkitAppRegion?: 'drag' | 'no-drag';
    aspectHeight?: number | string;
    fontMono?: string;
    tracking?: string | number;
    py?: number | string;
    p?: number | string;
  }
}
