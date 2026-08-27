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

export type OfficeAppKey = 'docs' | 'sheets' | 'slides' | 'pdf';

export interface OfficeModelOption {
  id: string;
  /** provider/model runtime id */
  runtimeId: string;
  label: string;
  /** provider name, e.g. "Kimi" or "OpenAI" */
  provider?: string | undefined;
}

export interface OfficeToolExecution {
  output?: string | undefined;
  isError?: boolean | undefined;
  summary: string;
  mutated?: boolean | undefined;
  display?: { [key: string]: unknown } | undefined;
}

export interface OfficeAgentLoopEvents {
  onText?: ((text: string) => void) | undefined;
  onToolStart?: ((call: { name: string; input?: unknown }) => void) | undefined;
  onToolExecuted?:
    | ((payload: {
        call: { name: string; input?: unknown };
        execution: OfficeToolExecution;
      }) => void)
    | undefined;
  onDone?:
    | ((result: { text: string; cancelled: boolean; turnLimit: boolean }) => void)
    | undefined;
  onTurnEnd?: ((payload?: unknown) => void) | undefined;
  onError?: ((error: string) => void) | undefined;
}

export interface OfficeAgentLoopOptions {
  events?: OfficeAgentLoopEvents | undefined;
  skill?: unknown | undefined;
  systemSuffix?: string | (() => string) | undefined;
  transport?: unknown | undefined;
  modelId?: string | undefined;
  maxTurns?: number | undefined;
  [key: string]: unknown;
}

export interface OfficeAgentLoop {
  busy: boolean;
  run(instruction: string, images?: unknown[]): void;
  cancel(): void;
  setModelId(modelId: string | undefined): void;
  reset(): void;
  restore(messages: readonly { role: string; text: string }[]): void;
}

export interface OfficeAgentLoopConstructor {
  new (options: OfficeAgentLoopOptions): OfficeAgentLoop;
}

/**
 * AI services supplied by the host. The vendored office apps consume this
 * contract for model selection and the agent loop instead of importing
 * `@allternit/office-ai` directly.
 */
export interface OfficeAiClient {
  /** Resolve the effective runtime model id for an office app. */
  resolveModelId: (appKey: OfficeAppKey) => string | undefined;
  /** Persist a per-app model override. */
  setModelOverride: (appKey: OfficeAppKey, modelId: string | undefined) => void;
  /** Return the current model picker options. */
  getModelOptions: () => OfficeModelOption[];
  /** Refresh picker options from the host's model catalog. */
  refreshModelOptions: () => Promise<OfficeModelOption[]>;
  /** Human-readable label for a picker value. */
  getModelLabel: (value?: string) => string;
  /** Agent loop constructor used by the office apps. */
  AgentLoop: OfficeAgentLoopConstructor;

  /** Optional custom chat stream for hosts that want to own the wire protocol. */
  stream?: ((messages: OfficeMessage[], abortSignal?: AbortSignal) => AsyncIterable<string>) | undefined;
  /** Optional model catalog for custom chat streams. */
  getModels?: (() => Promise<OfficeModelInfo[]>) | undefined;
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
