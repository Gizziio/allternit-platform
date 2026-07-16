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
    };
    allternit?: {
      auth?: {
        startLogin: () => Promise<void>;
        getSession: () => Promise<null | {
          userId: string;
          userEmail: string;
          expiresAt: number;
          runtimeId: string;
          organizationId?: string;
          organizationRole?: string;
          capabilities: string[];
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
        openDesign: () => Promise<void>;
        openSession: (options: { sessionId: string; workspaceId?: string; title?: string }) => Promise<void>;
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
        getApproval: (id: string, registration?: { id: string; name: string; version?: string; installCommand?: string; startCommand?: string; stopCommand?: string; healthUrl?: string; permissions?: { network?: string[]; filesystem?: string[]; secrets?: string[]; processes?: boolean } }) => Promise<{ approved: boolean; fingerprint?: string; approvedAt?: string }>;
        reviewAndApprove: (registration: { id: string; name: string; version?: string; installCommand?: string; startCommand?: string; stopCommand?: string; healthUrl?: string; permissions?: { network?: string[]; filesystem?: string[]; secrets?: string[]; processes?: boolean } }) => Promise<{ success: boolean; approved: boolean; fingerprint?: string; error?: string }>;
        revokeApproval: (id: string) => Promise<{ success: boolean }>;
        setSecret: (id: string, name: string, value: string) => Promise<{ success: boolean; error?: string }>;
        listSecrets: (id: string) => Promise<string[]>;
        deleteSecret: (id: string, name: string) => Promise<{ success: boolean }>;
        removeRuntime: (id: string) => Promise<{ success: boolean; error?: string }>;
        rollbackRuntime: (id: string) => Promise<{ success: boolean; error?: string }>;
        onProgress: (handler: (p: { id: string; line: string; type: 'stdout' | 'stderr' | 'info' }) => void) => () => void;
        oauthStart?: (appId: string, providerId: string, provider: { authorizationUrl: string; tokenUrl: string; revocationUrl?: string; clientId: string; scopes: string[]; additionalAuthParams?: Record<string, string> }) => Promise<{ flowId?: string; error?: string }>;
        oauthCancel?: (flowId: string) => Promise<{ success: boolean }>;
        oauthAccounts?: (appId: string) => Promise<Array<{ appId: string; providerId: string; accountId: string; scopes: string[]; expiresAt?: string; createdAt: string; lastRefreshedAt?: string; needsReauth: boolean }>>;
        oauthDisconnect?: (appId: string, providerId: string, accountId: string) => Promise<{ success: boolean; error?: string }>;
        onOAuthComplete?: (handler: (result: { flowId: string; success: boolean; error?: string; scopes?: string[]; expiresAt?: string; appId: string; providerId: string; accountId: string }) => void) => () => void;
      };
      findInPage?: {
        search: (text: string, options?: { forward?: boolean; matchCase?: boolean }) => Promise<void>;
        next: () => Promise<void>;
        previous: () => Promise<void>;
        stop: (keepSelection?: boolean) => Promise<void>;
        onResult: (handler: (result: { requestId: number; activeMatchOrdinal: number; matches: number; finalUpdate: boolean }) => void) => () => void;
      };
      bonsai?: {
        getStatus: () => Promise<{
          installed: boolean;
          running: boolean;
          installing: boolean;
          url: string;
          revisions?: { source?: string; model?: string; mlxWheel?: string };
          installDir: string;
          error?: string;
        }>;
        install: () => Promise<void>;
        cancelInstall: () => Promise<boolean>;
        start: () => Promise<void>;
        stop: () => Promise<boolean>;
        remove: () => Promise<void>;
        onProgress: (handler: (progress: { stage: string; message: string }) => void) => () => void;
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
