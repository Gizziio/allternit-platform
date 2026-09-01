/**
 * Minimal Allternit API client for the platform console.
 *
 * Uses the gateway at VITE_ALLTERNIT_GATEWAY_URL (default https://api.allternit.com).
 * Bearer tokens are set from the Clerk session sync in PlatformAuthProvider.
 */

export class AllternitApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AllternitApiError';
  }

  isAuthError(): boolean {
    return this.statusCode === 401 || this.statusCode === 403;
  }
}

export function formatApiError(err: unknown, fallback: string): string {
  if (err instanceof AllternitApiError) return err.message;
  if (err instanceof Error) {
    if (err.name === 'AbortError' || /abort/i.test(err.message)) {
      return 'Request timed out. The cloud API did not respond.';
    }
    return err.message;
  }
  return fallback;
}

class AllternitApiClient {
  private token: string | null = null;

  setToken(token: string): void {
    this.token = token;
  }

  clearToken(): void {
    this.token = null;
  }

  isAuthenticated(): boolean {
    return !!this.token;
  }

  private gatewayBase(): string {
    const configured = import.meta.env.VITE_ALLTERNIT_GATEWAY_URL || 'https://api.allternit.com';
    return String(configured).replace(/\/+$/, '');
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options: RequestInit = {}
  ): Promise<T> {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      ...(options.headers as Record<string, string> || {}),
    };

    const controller = new AbortController();
    const timeoutMs = Number(import.meta.env.VITE_ALLTERNIT_API_TIMEOUT_MS || 15000);
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(`${this.gatewayBase()}${normalizedPath}`, {
      ...options,
      method,
      headers,
      signal: controller.signal,
      ...(body && method !== 'GET' ? { body: JSON.stringify(body) } : {}),
    }).finally(() => window.clearTimeout(timeoutId));

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new AllternitApiError(
        errorData.message || `HTTP ${response.status}`,
        response.status,
        errorData.code,
        errorData.details
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  get<T>(path: string, options?: RequestInit): Promise<T> {
    return this.request<T>('GET', path, undefined, options);
  }

  post<T>(path: string, body?: unknown, options?: RequestInit): Promise<T> {
    return this.request<T>('POST', path, body, options);
  }

  patch<T>(path: string, body?: unknown, options?: RequestInit): Promise<T> {
    return this.request<T>('PATCH', path, body, options);
  }

  delete<T>(path: string, options?: RequestInit): Promise<T> {
    return this.request<T>('DELETE', path, undefined, options);
  }
}

export const api = new AllternitApiClient();
