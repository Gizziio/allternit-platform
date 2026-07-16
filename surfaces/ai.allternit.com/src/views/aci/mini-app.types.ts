export type MiniAppCategory = 'runtime' | 'connector' | 'tool' | 'data' | 'communication' | 'custom';
export type MiniAppSource = 'discovered' | 'connector' | 'url' | 'builtin' | 'github' | 'local' | 'workspace';
export type MiniAppCatalogSource = 'allternit' | 'mcp' | 'github' | 'url' | 'local' | 'workspace';
type MiniAppStatus = 'available' | 'pinned' | 'running' | 'offline';

export type MiniAppPresentationMode = 'native' | 'embedded' | 'hybrid';

export interface MiniAppPresentationContract {
  /** How Allternit should present the app after it starts. */
  mode: MiniAppPresentationMode;
  /** Upstream interactive UI, when the app exposes one. */
  uiUrl?: string;
  /** Optional endpoint used to determine whether the UI is ready. */
  healthUrl?: string;
  /** Stable Electron session partition for cookies and storage isolation. */
  electronPartition?: string;
  /** Registered Allternit renderer for a purpose-built native experience. */
  nativeRenderer?: string;
  /** Safe behavior when the preferred surface cannot be rendered. */
  fallback?: 'native-tools' | 'external-browser';
}

export interface MiniAppSurfaceContract {
  kind: 'embedded-web' | 'allternit-native' | 'external-desktop';
  url?: string;
  viewType?: string;
  desktopAction?: string;
}

export interface MiniAppHarnessContract {
  transport: 'subprocess' | 'http' | 'rpc' | 'acp' | 'mcp';
  command?: string;
  baseURL?: string;
  cwd?: string;
  env?: Record<string, string>;
  model?: string;
}

export interface MiniAppLifecycleContract {
  install?: { command: string; args?: string[] };
  start?: { command: string; args?: string[] };
  stop?: { method: 'managed-process' | 'command'; command?: string; args?: string[] };
  health?: { kind: 'http' | 'command' | 'process'; url?: string; command?: string; args?: string[] };
}

export interface MiniAppPermissionsContract {
  network?: string[];
  filesystem?: string[];
  secrets?: string[];
  processes?: boolean;
}

/** OAuth provider declaration for the desktop broker. Connected account
 * tokens are resolved in the desktop main process and injected into the
 * sandboxed runtime as environment variables; they never reach the renderer
 * or embedded web content. Declaring or changing a provider invalidates the
 * runtime approval fingerprint. */
export interface MiniAppOAuthProviderContract {
  authorizationUrl: string;
  tokenUrl: string;
  revocationUrl?: string;
  clientId: string;
  scopes: string[];
  additionalAuthParams?: Record<string, string>;
}

/** Served at /.well-known/allternit-app.json by any allternit-native service */
export interface MiniAppManifest {
  id: string;
  name: string;
  description: string;
  version?: string;
  icon?: string;
  category: MiniAppCategory;
  pinnable: boolean;
  /** GitHub repo in owner/repo format for lazy download and avatar */
  repo?: string;
  /** Direct GitHub URL for the project page */
  githubUrl?: string;
  /** Whether the mini-app can be downloaded and run locally */
  downloadable?: boolean;
  presentation?: MiniAppPresentationContract;
  surface?: MiniAppSurfaceContract;
  harness?: MiniAppHarnessContract;
  lifecycle?: MiniAppLifecycleContract;
  permissions?: MiniAppPermissionsContract;
  /** OAuth providers this miniapp connects to, keyed by provider id. */
  oauth?: Record<string, MiniAppOAuthProviderContract>;
  compatibility?: { allternit?: string; platforms?: Array<'darwin' | 'win32' | 'linux'> };
  release?: { changelog?: string; publishedAt?: string; signature?: string; publisherKey?: string };
}

export interface InstalledMiniApp {
  id: string;
  name: string;
  description: string;
  version?: string;
  icon?: string;
  category: MiniAppCategory;
  source: MiniAppSource;
  /** The URL that gets iframed when opened */
  url: string;
  /** Where the manifest was discovered from */
  sourceUrl?: string;
  status: MiniAppStatus;
  pinnedAt?: string;
  lastSeenAt?: string;
  /** GitHub repo in owner/repo format */
  repo?: string;
  /** Direct GitHub URL */
  githubUrl?: string;
  /** Whether the mini-app can be downloaded and run locally */
  downloadable?: boolean;
  presentation?: MiniAppPresentationContract;
  surface?: MiniAppSurfaceContract;
  harness?: MiniAppHarnessContract;
  lifecycle?: MiniAppLifecycleContract;
  permissions?: MiniAppPermissionsContract;
  installState?: 'not-installed' | 'installing' | 'installed' | 'update-available' | 'repair-needed' | 'removing';
  runtimeState?: 'stopped' | 'starting' | 'running' | 'unhealthy' | 'unknown';
  registryName?: string;
  publisher?: string;
  capabilities?: string[];
  verified?: boolean;
  isPinned?: boolean;
  catalogSource?: MiniAppCatalogSource;
  featured?: boolean;
  /** Marketplace listing is discoverable but has not declared a safe installer yet. */
  catalogOnly?: boolean;
  /** Local commands were configured but still require desktop-side approval. */
  requiresRuntimeApproval?: boolean;
  compatibility?: MiniAppManifest['compatibility'];
  release?: MiniAppManifest['release'];
  oauth?: MiniAppManifest['oauth'];
}
