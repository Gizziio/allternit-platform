import {
  createComputerUseClient,
  resolveComputerUseBaseUrl,
  type AllternitComputerUseClient,
  type ComputerUseRequest,
  type ComputerUseResponse,
  type RequestOptions,
  type WatchRunOptions,
} from '@allternit/sdk/computer-use';

const ENGINE_BASE_URL_STORAGE_KEY = 'allternit.platform.computerUse.baseUrl';
const ENGINE_BASE_URL_SOURCE_STORAGE_KEY = 'allternit.platform.computerUse.baseUrlSource';

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

/** Canonical ACU gateway — all surfaces fall back to this when no override is set. */
const ACU_GATEWAY_DEFAULT = 'http://127.0.0.1:8760';

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

  return electronBaseUrl || ACU_GATEWAY_DEFAULT;
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
  AllternitComputerUseClient,
  | 'execute'
  | 'getReceipts'
  | 'watchRun'
>;

let clientFactory: (baseUrl?: string) => PlatformComputerUseClient = (baseUrl?: string) =>
  createComputerUseClient({
    baseUrl: normalizeComputerUseBaseUrl(baseUrl ?? getPlatformComputerUseBaseUrl()),
    
  });

export function getPlatformComputerUseClient(baseUrl?: string): PlatformComputerUseClient {
  return clientFactory(baseUrl);
}

export function __setPlatformComputerUseClientFactory(
  factory: ((baseUrl?: string) => PlatformComputerUseClient) | null,
): void {
  clientFactory =
    factory ??
    ((baseUrl?: string) =>
      createComputerUseClient({
        baseUrl: normalizeComputerUseBaseUrl(baseUrl ?? getPlatformComputerUseBaseUrl()),
        
      }));
}

export type { ComputerUseRequest, ComputerUseResponse, RequestOptions, WatchRunOptions };

// ── Discovery types ──────────────────────────────────────────────────────────

export interface GatewayWindowEntry {
  window_id: number;
  title: string;
  app_name: string;
  bundle_id: string;
  frame: { x: number; y: number; width: number; height: number };
  is_focused: boolean;
  is_minimized: boolean;
}

export interface GatewayAppEntry {
  pid: number;
  name: string;
  bundle_id: string;
  is_active: boolean;
}

export interface GatewayNotificationEntry {
  notification_id: string;
  title: string;
  body: string;
  app_name: string;
  timestamp: string;
  actions: string[];
}

export interface GatewayRoute {
  route_id: string;
  method: string;
  path: string;
  description: string;
  tags: string[];
}

export interface GatewayWindowState {
  window_id?: number;
  title?: string;
  app_name?: string;
  ax_tree?: object;
  screenshot_b64?: string;
  coordinate_contract?: {
    scale_factor: number;
    offset_x: number;
    offset_y: number;
    raw_width: number;
    raw_height: number;
    model_width: number;
    model_height: number;
  };
}

// ── Discovery API helpers ────────────────────────────────────────────────────

export async function fetchGatewayWindows(baseUrl?: string): Promise<GatewayWindowEntry[]> {
  const url = baseUrl ?? getPlatformComputerUseBaseUrl();
  try {
    const res = await fetch(`${url}/v1/windows`);
    if (!res.ok) return [];
    const data = await res.json() as { windows?: GatewayWindowEntry[] };
    return data.windows ?? [];
  } catch { return []; }
}

export async function fetchGatewayApps(baseUrl?: string): Promise<GatewayAppEntry[]> {
  const url = baseUrl ?? getPlatformComputerUseBaseUrl();
  try {
    const res = await fetch(`${url}/v1/apps`);
    if (!res.ok) return [];
    const data = await res.json() as { apps?: GatewayAppEntry[] };
    return data.apps ?? [];
  } catch { return []; }
}

export async function fetchGatewayRoutes(baseUrl?: string): Promise<GatewayRoute[]> {
  const url = baseUrl ?? getPlatformComputerUseBaseUrl();
  try {
    const res = await fetch(`${url}/v1/routes`);
    if (!res.ok) return [];
    const data = await res.json() as { routes?: GatewayRoute[] };
    return data.routes ?? [];
  } catch { return []; }
}

export async function fetchGatewayWindowState(windowId?: number, baseUrl?: string): Promise<GatewayWindowState | null> {
  const url = baseUrl ?? getPlatformComputerUseBaseUrl();
  try {
    const params = windowId != null ? `?window_id=${windowId}` : '';
    const res = await fetch(`${url}/v1/window-state${params}`);
    if (!res.ok) return null;
    return await res.json() as GatewayWindowState;
  } catch { return null; }
}

export async function fetchGatewayNotifications(baseUrl?: string): Promise<GatewayNotificationEntry[]> {
  const url = baseUrl ?? getPlatformComputerUseBaseUrl();
  try {
    const res = await fetch(`${url}/v1/notifications`);
    if (!res.ok) return [];
    const data = await res.json() as { notifications?: GatewayNotificationEntry[] };
    return data.notifications ?? [];
  } catch { return []; }
}

export async function executeGatewayAction(
  action: string,
  params: Record<string, unknown>,
  sessionId = 'default',
  baseUrl?: string,
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const url = baseUrl ?? getPlatformComputerUseBaseUrl();
  try {
    const res = await fetch(`${url}/v1/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, session_id: sessionId, run_id: crypto.randomUUID(), ...params }),
    });
    const data = await res.json() as { success?: boolean; error?: string };
    return { success: data.success ?? res.ok, data, error: data.error };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}
