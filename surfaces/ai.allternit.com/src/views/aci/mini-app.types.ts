export type MiniAppCategory = 'runtime' | 'connector' | 'tool' | 'data' | 'communication' | 'custom';
export type MiniAppSource = 'discovered' | 'connector' | 'url' | 'builtin';
type MiniAppStatus = 'available' | 'pinned' | 'running' | 'offline';

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
}
