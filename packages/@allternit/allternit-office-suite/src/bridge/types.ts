/**
 * Host contract for the Allternit Office Suite.
 *
 * The suite components are intentionally platform-agnostic. The embedding host
 * (the platform surface, a standalone web app, an Electron wrapper, etc.)
 * implements this contract and passes it via `OfficeHostProvider`.
 */

export interface RecentFile {
  id: string;
  name: string;
  path?: string;
  openedAt: number;
  size?: number;
}

export interface OpenOptions {
  accept?: Record<string, string[]>;
  multiple?: boolean;
}

export interface OpenedFile {
  id?: string;
  name: string;
  bytes: Uint8Array;
}

export interface SaveOptions {
  suggestedName?: string;
  prompt?: boolean;
}

export interface OfficeMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface OfficeModelInfo {
  id: string;
  name: string;
  provider?: string;
}

/**
 * Optional AI client supplied by the host.
 */
export interface OfficeAiClient {
  stream: (messages: OfficeMessage[], abortSignal?: AbortSignal) => AsyncIterable<string>;
  getModels: () => Promise<OfficeModelInfo[]>;
}

/**
 * Optional storage abstraction for model selection and other persisted UI state.
 */
export interface OfficeStorageProvider {
  getItem: (key: string) => string | null | Promise<string | null>;
  setItem: (key: string, value: string) => void | Promise<void>;
  removeItem: (key: string) => void | Promise<void>;
}

/**
 * Handle returned by a sheets engine session. Opaque outside the host.
 */
export interface XlsxSessionHandle {
  readonly sessionId: string;
}

/**
 * Optional engine host for full Sheets recalc/session management.
 * If omitted, the suite falls back to the simpler `office-sheets-editor`
 * path (read-only / client-side editing without server recalc).
 */
export interface XlsxEngineHost {
  openSession: (bytes: Uint8Array) => Promise<XlsxSessionHandle>;
  readRange: (session: XlsxSessionHandle, sheet: number, row: number, col: number) => Promise<unknown>;
  recalc: (session: XlsxSessionHandle) => Promise<Uint8Array>;
  save: (session: XlsxSessionHandle) => Promise<Uint8Array>;
  close: (session: XlsxSessionHandle) => Promise<void>;
}

/**
 * Single host contract consumed by all Allternit Office Suite apps.
 */
export interface OfficeHost {
  /** Read the user's current locale, e.g. 'en'. */
  getLanguage: () => string;

  /** Open one or more files from the host's file system. */
  openFile: (options?: OpenOptions) => Promise<OpenedFile | OpenedFile[] | null>;

  /** Save bytes to the host's file system. */
  saveFile: (bytes: Uint8Array, name: string, options?: SaveOptions) => Promise<void>;

  /** List recently opened files for the host surface. */
  getRecentFiles: () => Promise<RecentFile[]>;

  /** Optional: print the current document. */
  print?: () => void;

  /** Optional: pick an image from the host file system. */
  pickImage?: () => Promise<Uint8Array | null>;

  /** Optional: AI chat client. If absent, AI panels render a disabled/empty state. */
  ai?: OfficeAiClient;

  /** Optional: persisted storage for model selection, panel widths, etc. */
  storage?: OfficeStorageProvider;

  /** Optional: full Sheets engine. If absent, Sheets uses the lightweight editor path. */
  xlsxEngine?: XlsxEngineHost;
}
