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
  const explicitApiUrl = win.___ALLTERNIT_API_URL || (import.meta as any).env?.VITE_ALLTERNIT_API_URL;

  if (explicitApiUrl) {
    return ensureApiV1Suffix(String(explicitApiUrl));
  }

  return `${resolveGatewayBaseUrl()}/api/v1`;
}

// Gateway base URL without /api/v1 suffix.
export const GATEWAY_BASE_URL = resolveGatewayBaseUrl();

// Canonical API base URL.
export const API_BASE_URL = resolveApiBaseUrl();

// ============================================================================
// HTTP Helper Types and Functions
// ============================================================================

export interface ApiResponse<T> {
  data: T;
  error?: string;
}

export async function apiRequest<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const { headers, ...restOptions } = options || {};
  const response = await fetch(url, {
    ...restOptions,
    headers: {
      'Content-Type': 'application/json',
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
  const response = await fetch(url, {
    ...restOptions,
    headers: {
      'Content-Type': 'application/json',
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
