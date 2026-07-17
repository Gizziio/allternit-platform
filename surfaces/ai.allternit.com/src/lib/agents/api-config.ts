/**
 * API Configuration - Shared constants and utilities
 * 
 * This file exists to avoid circular dependencies between agent.service.ts and rails.service.ts
 */

const DEFAULT_GATEWAY_URL = 'http://127.0.0.1:8013';

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/g, '');
}

function stripApiV1Suffix(value: string): string {
  return value.replace(/\/api\/v1\/?$/i, '');
}

function ensureApiV1Suffix(value: string): string {
  const normalized = stripTrailingSlash(value);
  if (/\/api\/v1$/i.test(normalized)) {
    return normalized;
  }
  return `${normalized}/api/v1`;
}

function resolveGatewayBaseUrl(): string {
  const win = typeof window !== 'undefined' ? (window as any) : {};
  const configured =
    win.__ALLTERNIT_GATEWAY_URL__ ||
    win.__ALLTERNIT_GATEWAY_URL ||
    (import.meta as any).env?.VITE_ALLTERNIT_GATEWAY_URL ||
    DEFAULT_GATEWAY_URL;

  const normalized = stripTrailingSlash(stripApiV1Suffix(String(configured)));

  if (typeof window !== 'undefined') {
    try {
      const runtime = new URL(normalized, window.location.origin);
      const isShellDevPort = window.location.port === '5177';
      const isLoopback = runtime.hostname === '127.0.0.1' || runtime.hostname === 'localhost';
      const isBackendPort = runtime.port === '3000' || runtime.port === '8013';

      // When running shell-ui on dev port (5177) and backend is on a backend port,
      // use the configured backend URL, not the window location
      if (isShellDevPort && isLoopback && isBackendPort) {
        // Return the configured backend URL (normalized)
        return normalized;
      }
    } catch {
      // Keep configured value
    }
  }

  return normalized;
}

function resolveApiBaseUrl(): string {
  const win = typeof window !== 'undefined' ? (window as any) : {};
  const explicitApiUrl =
    win.___ALLTERNIT_API_URL ||
    win.__ALLTERNIT_API_URL ||
    (import.meta as any).env?.VITE_ALLTERNIT_API_URL;

  if (explicitApiUrl) {
    return ensureApiV1Suffix(String(explicitApiUrl));
  }

  return `${resolveGatewayBaseUrl()}/api/v1`;
}

// Gateway base URL without /api/v1 suffix.
export const GATEWAY_BASE_URL = resolveGatewayBaseUrl();

// Canonical API base URL.
export const API_BASE_URL = resolveApiBaseUrl();

const DEFAULT_GIZZI_URL = 'http://127.0.0.1:4096';

// Base URL for the gizzi-code runtime (brain) server. Honors the runtime-injected
// __TERMINAL_SERVER_URL__ (used by the desktop shell) and falls back to the local default.
// In the desktop shell, direct loopback calls to the gizzi daemon are blocked by
// CORS (the daemon emits no CORS headers), so route through Electron's
// allternit-gizzi broker protocol, which proxies to the daemon and adds CORS headers.
export function gizziBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const g = (window as any).__TERMINAL_SERVER_URL__ || (globalThis as any).__TERMINAL_SERVER_URL__;
    if (g) return stripTrailingSlash(String(g));
    if (Boolean((window as any).allternitSidecar)) return 'allternit-gizzi://localhost';
  }
  const env = (import.meta as any).env?.VITE_GIZZI_URL;
  return env ? stripTrailingSlash(String(env)) : DEFAULT_GIZZI_URL;
}

// ============================================================================
// HTTP Helper Types and Functions
// ============================================================================

export interface ApiResponse<T> {
  data: T;
  error?: string;
}

type DesktopSession = {
  userId: string;
  userEmail: string;
  runtimeId: string;
  organizationId?: string;
  capabilities: string[];
  expiresAt: number;
};

async function buildAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};

  if (typeof window === 'undefined') {
    return headers;
  }

  const bearerToken = window.localStorage.getItem('allternit_token');
  if (bearerToken) {
    headers.Authorization = `Bearer ${bearerToken}`;
  }

  try {
    const session = await window.allternit?.auth?.getSession?.() as DesktopSession | null | undefined;
    if (session?.userId) {
      headers['X-Allternit-User-Id'] = session.userId;
      if (session.userEmail) {
        headers['X-Allternit-User-Email'] = session.userEmail;
      }
      if (session.organizationId) {
        headers['X-Allternit-Tenant-Id'] = session.organizationId;
      }
    }
  } catch {
    // Ignore desktop auth lookup failures and fall back to any bearer token.
  }

  // Desktop runtime credentials live in Electron main and are injected only
  // while brokering loopback requests. Renderer code must never synthesize a
  // fallback identity, even during development.
  return headers;
}

export async function apiRequest<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const { headers, ...restOptions } = options || {};
  const authHeaders = await buildAuthHeaders();
  const response = await fetch(url, {
    ...restOptions,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...(headers || {}),
    },
  });
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

export async function apiRequestWithError<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const { headers, ...restOptions } = options || {};
  const authHeaders = await buildAuthHeaders();
  const response = await fetch(url, {
    ...restOptions,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...(headers || {}),
    },
  });
  
  let data: any = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  
  if (!response.ok) {
    throw new Error(data?.error || data?.message || `API error: ${response.status}`);
  }
  
  return data as T;
}
