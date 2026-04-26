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
      app?: {
        isFirstLaunch?: () => Promise<boolean>;
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
    'allternit:switch-mode': CustomEvent<{ mode: 'chat' | 'cowork' | 'code' | 'design' }>;
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
