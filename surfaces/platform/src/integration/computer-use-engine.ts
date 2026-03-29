import {
  createComputerUseClient,
  resolveComputerUseBaseUrl,
  type A2RComputerUseClient,
  type EngineEventBatch,
  type EngineEventRecord,
  type EngineExecutionRequestInput,
  type EngineReceiptsResponse,
  type EngineRunSnapshot,
  type RequestOptions,
  type WatchRunOptions,
} from '@a2r/sdk/computer-use';

const ENGINE_BASE_URL_STORAGE_KEY = 'a2r.platform.computerUse.baseUrl';
const ENGINE_BASE_URL_SOURCE_STORAGE_KEY = 'a2r.platform.computerUse.baseUrlSource';

function readElectronEngineBaseUrl(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.electron?.computerUse?.getBaseUrl?.() ?? null;
  } catch {
    return null;
  }
}

export function normalizeComputerUseBaseUrl(value?: string | null): string {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) {
    const electronBaseUrl = readElectronEngineBaseUrl();
    return resolveComputerUseBaseUrl(electronBaseUrl ?? undefined);
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/\/+$/, '');
  }

  if (/^\d{2,5}$/.test(trimmed)) {
    return `http://127.0.0.1:${trimmed}`;
  }

  if (/^[^/:?#]+:\d{2,5}$/i.test(trimmed)) {
    return `http://${trimmed}`;
  }

  return trimmed.replace(/\/+$/, '');
}

export function getPlatformComputerUseBaseUrl(): string {
  const electronBaseUrl = normalizeComputerUseBaseUrl(readElectronEngineBaseUrl());
  if (typeof window !== 'undefined') {
    try {
      const stored = window.localStorage.getItem(ENGINE_BASE_URL_STORAGE_KEY);
      const source = window.localStorage.getItem(ENGINE_BASE_URL_SOURCE_STORAGE_KEY);
      if (stored && source === 'manual') {
        return normalizeComputerUseBaseUrl(stored);
      }
      if (electronBaseUrl) {
        return electronBaseUrl;
      }
      if (stored) {
        return normalizeComputerUseBaseUrl(stored);
      }
    } catch {
      // Ignore localStorage access failures.
    }
  }

  return electronBaseUrl;
}

export function setPlatformComputerUseBaseUrl(value: string): string {
  const normalized = normalizeComputerUseBaseUrl(value);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(ENGINE_BASE_URL_STORAGE_KEY, normalized);
      window.localStorage.setItem(ENGINE_BASE_URL_SOURCE_STORAGE_KEY, 'manual');
    } catch {
      // Ignore localStorage access failures.
    }
  }
  return normalized;
}

export function getComputerUsePortLabel(baseUrl?: string): string {
  try {
    const parsed = new URL(baseUrl ?? getPlatformComputerUseBaseUrl());
    return parsed.port || (parsed.protocol === 'https:' ? '443' : '80');
  } catch {
    return '3010';
  }
}

export async function getPlatformWebviewTabId(): Promise<number | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const value = await window.electron?.computerUse?.getPlatformWebviewTabId?.();
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

export interface PlatformComputerUseRuntime {
  status: 'initializing' | 'starting' | 'running' | 'failed' | 'stopped' | 'external' | 'unknown';
  baseUrl: string;
  managed: boolean;
  source: 'managed' | 'external';
  port: number | null;
  pid: number | null;
  message: string | null;
  error: string | null;
}

export async function getPlatformComputerUseRuntime(): Promise<PlatformComputerUseRuntime | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const value = await window.electron?.computerUse?.getRuntime?.();
    if (!value || typeof value !== 'object') {
      return null;
    }
    return value as PlatformComputerUseRuntime;
  } catch {
    return null;
  }
}

export type PlatformComputerUseClient = Pick<
  A2RComputerUseClient,
  | 'health'
  | 'execute'
  | 'getRun'
  | 'getEvents'
  | 'getReceipts'
  | 'approveRun'
  | 'denyRun'
  | 'cancelRun'
  | 'pauseRun'
  | 'resumeRun'
  | 'takeoverRun'
  | 'watchRun'
>;

let clientFactory: (baseUrl?: string) => PlatformComputerUseClient = (baseUrl?: string) =>
  createComputerUseClient({
    baseUrl: normalizeComputerUseBaseUrl(baseUrl ?? getPlatformComputerUseBaseUrl()),
    timeoutMs: 15000,
  });

export function __setPlatformComputerUseClientFactory(
  factory: ((baseUrl?: string) => PlatformComputerUseClient) | null,
): void {
  clientFactory =
    factory ??
    ((baseUrl?: string) =>
      createComputerUseClient({
        baseUrl: normalizeComputerUseBaseUrl(baseUrl ?? getPlatformComputerUseBaseUrl()),
        timeoutMs: 15000,
      }));
}

export type {
  EngineEventBatch,
  EngineEventRecord,
  EngineExecutionRequestInput,
  EngineReceiptsResponse,
  EngineRunSnapshot,
  RequestOptions,
  WatchRunOptions,
};
