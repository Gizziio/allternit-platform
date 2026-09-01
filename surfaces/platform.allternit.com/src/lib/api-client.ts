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
  private tokenProvider: (() => Promise<string | null>) | null = null;
  private authPromise: Promise<string | null> | null = null;
  private authResolve: ((token: string | null) => void) | null = null;

  constructor() {
    this.resetAuthPromise();
  }

  private resetAuthPromise(): void {
    this.authPromise = new Promise((resolve) => {
      this.authResolve = resolve;
    });
  }

  private flushAuth(token: string | null): void {
    if (this.authResolve) {
      this.authResolve(token);
      this.authResolve = null;
    }
  }

  setToken(token: string): void {
    this.token = token;
    this.flushAuth(token);
  }

  clearToken(): void {
    this.token = null;
    this.resetAuthPromise();
  }

  setTokenProvider(provider: () => Promise<string | null>): void {
    this.tokenProvider = provider;
    void provider().then((token) => {
      if (token) this.token = token;
      this.flushAuth(token);
    });
  }

  clearTokenProvider(): void {
    this.tokenProvider = null;
    this.flushAuth(null);
    this.resetAuthPromise();
  }

  isAuthenticated(): boolean {
    return !!this.token;
  }

  private gatewayBase(): string {
    const configured = import.meta.env.VITE_ALLTERNIT_GATEWAY_URL || 'https://api.allternit.com';
    return String(configured).replace(/\/+$/, '');
  }

  private async resolveToken(): Promise<string | null> {
    if (this.token) return this.token;
    if (this.tokenProvider) return this.tokenProvider();
    // The auth provider may not have mounted yet. Wait briefly for a token
    // or provider to be registered before sending an unauthenticated request.
    if (this.authPromise) {
      const timeoutMs = Number(import.meta.env.VITE_ALLTERNIT_AUTH_TIMEOUT_MS || 3000);
      const timeout = new Promise<string | null>((resolve) =>
        window.setTimeout(() => resolve(null), timeoutMs)
      );
      return Promise.race([this.authPromise, timeout]);
    }
    return null;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options: RequestInit = {}
  ): Promise<T> {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const token = await this.resolveToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

  put<T>(path: string, body?: unknown, options?: RequestInit): Promise<T> {
    return this.request<T>('PUT', path, body, options);
  }

  delete<T>(path: string, options?: RequestInit): Promise<T> {
    return this.request<T>('DELETE', path, undefined, options);
  }
}

export const api = new AllternitApiClient();
