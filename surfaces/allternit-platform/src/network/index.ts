/**
 * Allternit Network Adapter
 * 
 * Single source of truth for all API communications.
 * All UI networking goes through ALLTERNIT_BASE_URL.
 * 
 * @module @allternit/network-adapter
 */

// =============================================================================
// Configuration
// =============================================================================

/**
 * Resolve the Allternit base URL from environment or window injection
 * Priority: window.__ALLTERNIT_BASE_URL__ > VITE_ALLTERNIT_BASE_URL > default
 */
const resolveBaseURL = (): string => {
  // Check for window injection (for Electron/runtime injection)
  const injectedUrl = typeof window !== 'undefined'
    ? (window as unknown as { __ALLTERNIT_BASE_URL__?: string }).__ALLTERNIT_BASE_URL__
    : undefined;

  // Check for Vite environment variable
  const envUrl = typeof import.meta !== 'undefined' && import.meta.env
    ? (import.meta.env as any).VITE_ALLTERNIT_BASE_URL
    : undefined;

  // Default fallback
  const defaultUrl = 'http://127.0.0.1:3210';

  // Return first valid URL
  const candidate = injectedUrl || envUrl || defaultUrl;
  
  // Normalize URL (remove trailing slash)
  return candidate.replace(/\/+$/, '');
};

/**
 * The single source of truth for all API requests.
 * All UI code should use this constant instead of hardcoded URLs.
 */
export const ALLTERNIT_BASE_URL = resolveBaseURL();

/**
 * API version prefix
 */
export const API_VERSION = '/v1';

console.log(`[Allternit Network] Using base URL: ${ALLTERNIT_BASE_URL}`);

// =============================================================================
// Types
// =============================================================================

export interface AllternitRequestInit extends RequestInit {
  /**
   * Skip authentication header injection
   */
  skipAuth?: boolean;
  
  /**
   * Custom timeout in milliseconds
   */
  timeout?: number;
  
  /**
   * Retry configuration
   */
  retry?: {
    maxAttempts?: number;
    delayMs?: number;
    backoff?: number;
  };
}

export interface AllternitResponse<T = unknown> {
  /**
   * HTTP status code
   */
  status: number;
  
  /**
   * Response headers
   */
  headers: Headers;
  
  /**
   * Parsed JSON data
   */
  data: T;
  
  /**
   * Raw response body
   */
  raw: string;
  
  /**
   * Request ID for tracing
   */
  requestId?: string;
}

export interface AllternitError {
  /**
   * Error code
   */
  code: string;
  
  /**
   * Human-readable message
   */
  message: string;
  
  /**
   * Additional error details
   */
  details?: Record<string, unknown>;
  
  /**
   * Trace ID for debugging
   */
  traceId?: string;
}

export interface SSEEvent<T = unknown> {
  /**
   * Event type
   */
  type: string;
  
  /**
   * Event data
   */
  data: T;
  
  /**
   * Raw event text
   */
  raw: string;
}

export interface SSEConnection {
  /**
   * Session ID
   */
  sessionId: string;
  
  /**
   * Close the connection
   */
  close: () => void;
  
  /**
   * Subscribe to events
   */
  on: <T>(eventType: string, callback: (event: SSEEvent<T>) => void) => () => void;
  
  /**
   * Subscribe to all events
   */
  onAny: (callback: (event: SSEEvent) => void) => () => void;
  
  /**
   * Check if connection is open
   */
  isOpen: () => boolean;
  
  /**
   * Get connection state
   */
  getState: () => 'connecting' | 'open' | 'closed' | 'error';
}

// =============================================================================
// HTTP Client
// =============================================================================

/**
 * Default request timeout
 */
const DEFAULT_TIMEOUT = 60000;

/**
 * Default retry configuration
 */
const DEFAULT_RETRY = {
  maxAttempts: 3,
  delayMs: 1000,
  backoff: 2,
};

/**
 * Get authentication token from storage
 */
const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  
  // Try localStorage first
  const token = localStorage.getItem('allternit_auth_token');
  if (token) return token;
  
  // Try cookie (if available)
  const match = document.cookie.match(/allternit_token=([^;]+)/);
  if (match) return match[1];
  
  return null;
};

/**
 * Make an HTTP request through the Allternit Gateway
 */
export async function allternitFetch<T = unknown>(
  path: string,
  options: AllternitRequestInit = {}
): Promise<AllternitResponse<T>> {
  const {
    skipAuth = false,
    timeout = DEFAULT_TIMEOUT,
    retry = DEFAULT_RETRY,
    headers = {},
    ...fetchOptions
  } = options;

  // Build URL
  const url = path.startsWith('http')
    ? path
    : `${ALLTERNIT_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

  // Prepare headers
  const requestHeaders: HeadersInit = {
    'Content-Type': 'application/json',
    ...headers,
  };

  // Add authentication if not skipped
  if (!skipAuth) {
    const token = getAuthToken();
    if (token) {
      (requestHeaders as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }
  }

  // Add request tracing
  const requestId = (requestHeaders as Record<string, string>)['X-Request-ID'] || `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  (requestHeaders as Record<string, string>)['X-Request-ID'] = requestId;

  // Execute request with retries
  let lastError: Error | null = null;
  let attempts = 0;
  const maxAttempts = retry.maxAttempts || DEFAULT_RETRY.maxAttempts;
  const delayMs = retry.delayMs || DEFAULT_RETRY.delayMs;
  const backoff = retry.backoff || DEFAULT_RETRY.backoff;

  while (attempts < maxAttempts) {
    attempts++;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...fetchOptions,
        headers: requestHeaders,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Parse response
      const raw = await response.text();
      let data: T;

      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        data = raw as unknown as T;
      }

      // Handle error responses
      if (!response.ok) {
        const errorData = data as { error?: AllternitError };
        throw new AllternitHttpError(
          errorData.error?.code || 'HTTP_ERROR',
          errorData.error?.message || `HTTP ${response.status}`,
          errorData.error?.details,
          response.status,
          response.headers.get('x-request-id') || undefined
        );
      }

      return {
        status: response.status,
        headers: response.headers,
        data,
        raw,
        requestId: response.headers.get('x-request-id') || undefined,
      };
    } catch (error) {
      lastError = error as Error;

      // Don't retry on certain errors
      if (error instanceof AllternitHttpError && error.status !== undefined && [400, 401, 403, 404].includes(error.status)) {
        throw error;
      }

      // Wait before retry
      if (attempts < maxAttempts) {
        const waitTime = delayMs * Math.pow(backoff, attempts - 1);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  // All retries exhausted
  throw new AllternitHttpError(
    'MAX_RETRIES_EXCEEDED',
    `Request failed after ${maxAttempts} attempts: ${lastError?.message}`,
    undefined,
    503
  );
}

/**
 * HTTP Error class
 */
export class AllternitHttpError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
    public status?: number,
    public traceId?: string
  ) {
    super(message);
    this.name = 'AllternitHttpError';
  }
}

// =============================================================================
// SSE Client
// =============================================================================

/**
 * Establish an SSE connection to the Allternit Gateway
 */
export function createSSEConnection(): SSEConnection {
  const sessionId = `sse-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const eventListeners = new Map<string, Set<(event: SSEEvent) => void>>();
  const anyListeners = new Set<(event: SSEEvent) => void>();
  
  let state: 'connecting' | 'open' | 'closed' | 'error' = 'connecting';
  let eventSource: EventSource | null = null;
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 10;
  const baseReconnectDelay = 1000;

  const connect = () => {
    state = 'connecting';
    
    const url = `${ALLTERNIT_BASE_URL}/v1/events-http`;
    
    try {
      eventSource = new EventSource(url);
      
      eventSource.onopen = () => {
        state = 'open';
        reconnectAttempts = 0;
        console.log('[Allternit SSE] Connection established');
      };
      
      eventSource.onmessage = (event) => {
        // Handle generic messages
        const sseEvent: SSEEvent = {
          type: 'message',
          data: JSON.parse(event.data),
          raw: event.data,
        };
        
        // Notify any listeners
        anyListeners.forEach(cb => cb(sseEvent));
        
        // Notify type-specific listeners
        const listeners = eventListeners.get(sseEvent.type);
        listeners?.forEach(cb => cb(sseEvent));
      };
      
      eventSource.onerror = (error) => {
        console.warn('[Allternit SSE] Connection error:', error);
        state = 'error';
        
        // Try to reconnect
        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          const delay = baseReconnectDelay * Math.pow(2, reconnectAttempts - 1);
          console.log(`[Allternit SSE] Reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${maxReconnectAttempts})`);
          
          reconnectTimeout = setTimeout(() => {
            eventSource?.close();
            connect();
          }, delay);
        } else {
          console.error('[Allternit SSE] Max reconnection attempts reached');
          state = 'closed';
        }
      };
      
      // Handle specific event types
      eventSource.addEventListener('connected', (event) => {
        const sseEvent: SSEEvent = {
          type: 'connected',
          data: JSON.parse(event.data),
          raw: event.data,
        };
        
        anyListeners.forEach(cb => cb(sseEvent));
        eventListeners.get('connected')?.forEach(cb => cb(sseEvent));
      });
      
      eventSource.addEventListener('message', (event) => {
        const sseEvent: SSEEvent = {
          type: 'message',
          data: JSON.parse(event.data),
          raw: event.data,
        };
        
        anyListeners.forEach(cb => cb(sseEvent));
        eventListeners.get('message')?.forEach(cb => cb(sseEvent));
      });
      
      eventSource.addEventListener('progress', (event) => {
        const sseEvent: SSEEvent = {
          type: 'progress',
          data: JSON.parse(event.data),
          raw: event.data,
        };
        
        anyListeners.forEach(cb => cb(sseEvent));
        eventListeners.get('progress')?.forEach(cb => cb(sseEvent));
      });
      
      eventSource.addEventListener('done', (event) => {
        const sseEvent: SSEEvent = {
          type: 'done',
          data: JSON.parse(event.data),
          raw: event.data,
        };
        
        anyListeners.forEach(cb => cb(sseEvent));
        eventListeners.get('done')?.forEach(cb => cb(sseEvent));
      });
      
      eventSource.addEventListener('error', (event) => {
        const messageEvent = event as MessageEvent;
        const sseEvent: SSEEvent = {
          type: 'error',
          data: JSON.parse(messageEvent.data),
          raw: messageEvent.data,
        };
        
        anyListeners.forEach(cb => cb(sseEvent));
        eventListeners.get('error')?.forEach(cb => cb(sseEvent));
      });
      
      eventSource.addEventListener('heartbeat', (event) => {
        const sseEvent: SSEEvent = {
          type: 'heartbeat',
          data: JSON.parse(event.data),
          raw: event.data,
        };
        
        anyListeners.forEach(cb => cb(sseEvent));
        // Don't notify heartbeat to 'message' listeners
      });
      
    } catch (error) {
      console.error('[Allternit SSE] Failed to create connection:', error);
      state = 'error';
    }
  };

  // Initial connection
  connect();

  return {
    sessionId,
    
    close: () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      state = 'closed';
      eventListeners.clear();
      anyListeners.clear();
    },
    
    on: <T>(eventType: string, callback: (event: SSEEvent<T>) => void) => {
      if (!eventListeners.has(eventType)) {
        eventListeners.set(eventType, new Set());
      }
      eventListeners.get(eventType)!.add(callback as (event: SSEEvent) => void);
      
      return () => {
        eventListeners.get(eventType)?.delete(callback as (event: SSEEvent) => void);
      };
    },
    
    onAny: (callback: (event: SSEEvent) => void) => {
      anyListeners.add(callback);
      return () => {
        anyListeners.delete(callback);
      };
    },
    
    isOpen: () => state === 'open',
    
    getState: () => state,
  };
}

// =============================================================================
// Convenience Methods
// =============================================================================

/**
 * GET request
 */
export async function get<T = unknown>(
  path: string,
  options?: Omit<AllternitRequestInit, 'method'>
): Promise<AllternitResponse<T>> {
  return allternitFetch<T>(path, { ...options, method: 'GET' });
}

/**
 * POST request
 */
export async function post<T = unknown>(
  path: string,
  body?: unknown,
  options?: Omit<AllternitRequestInit, 'method' | 'body'>
): Promise<AllternitResponse<T>> {
  return allternitFetch<T>(path, {
    ...options,
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * PUT request
 */
export async function put<T = unknown>(
  path: string,
  body?: unknown,
  options?: Omit<AllternitRequestInit, 'method' | 'body'>
): Promise<AllternitResponse<T>> {
  return allternitFetch<T>(path, {
    ...options,
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * PATCH request
 */
export async function patch<T = unknown>(
  path: string,
  body?: unknown,
  options?: Omit<AllternitRequestInit, 'method' | 'body'>
): Promise<AllternitResponse<T>> {
  return allternitFetch<T>(path, {
    ...options,
    method: 'PATCH',
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * DELETE request
 */
export async function del<T = unknown>(
  path: string,
  options?: Omit<AllternitRequestInit, 'method'>
): Promise<AllternitResponse<T>> {
  return allternitFetch<T>(path, { ...options, method: 'DELETE' });
}

// =============================================================================
// Health & Discovery
// =============================================================================

/**
 * Check gateway health
 */
export async function checkHealth(): Promise<{
  status: string;
  service: string;
  version: string;
  timestamp: number;
  backends: Record<string, string>;
}> {
  const response = await get('/health', { skipAuth: true, retry: { maxAttempts: 1 } });
  return response.data as never;
}

/**
 * Get service discovery information
 */
export async function getDiscovery(): Promise<{
  gateway: {
    version: string;
    baseUrl: string;
  };
  services: Array<{
    name: string;
    status: string;
    baseUrl: string;
  }>;
}> {
  const response = await get('/v1/discovery', { skipAuth: true });
  return response.data as never;
}

// =============================================================================
// Exports
// =============================================================================

export default {
  ALLTERNIT_BASE_URL,
  API_VERSION,
  fetch: allternitFetch,
  get,
  post,
  put,
  patch,
  delete: del,
  createSSEConnection,
  checkHealth,
  getDiscovery,
  AllternitHttpError,
};

// Tambo client for UI generation with determinism modes
export { TamboClient, tamboClient } from './tambo-client.js';
export type {
  UISpec,
  ComponentSpec,
  DataBinding,
  LayoutSpec,
  StyleSpec,
  GeneratedUI,
  StreamChunk,
  GenerationConfig,
} from './tambo-client.js';
