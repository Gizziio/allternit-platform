/**
 * Infrastructure API Client - Base HTTP Client
 * 
 * Provides a robust HTTP client for communicating with the A2R infrastructure backend.
 * Features include automatic retries, error handling, request/response interceptors,
 * and proper TypeScript typing.
 */

// Configuration constants
const DEFAULT_BASE_URL = process.env.NEXT_PUBLIC_INFRASTRUCTURE_API_URL || 'http://localhost:8787/api/v1';
const DEFAULT_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

/**
 * Custom error class for API errors
 */
export class InfrastructureApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly response?: Response,
    public readonly data?: unknown
  ) {
    super(message);
    this.name = 'InfrastructureApiError';
    // Fix prototype chain for instanceof checks
    Object.setPrototypeOf(this, InfrastructureApiError.prototype);
  }

  /**
   * Check if the error is a network error
   */
  get isNetworkError(): boolean {
    return this.statusCode === undefined || this.statusCode === 0;
  }

  /**
   * Check if the error is a client error (4xx)
   */
  get isClientError(): boolean {
    return this.statusCode !== undefined && this.statusCode >= 400 && this.statusCode < 500;
  }

  /**
   * Check if the error is a server error (5xx)
   */
  get isServerError(): boolean {
    return this.statusCode !== undefined && this.statusCode >= 500;
  }

  /**
   * Check if the error is a not found error (404)
   */
  get isNotFound(): boolean {
    return this.statusCode === 404;
  }

  /**
   * Check if the error is an unauthorized error (401)
   */
  get isUnauthorized(): boolean {
    return this.statusCode === 401;
  }

  /**
   * Check if the error is a forbidden error (403)
   */
  get isForbidden(): boolean {
    return this.statusCode === 403;
  }

  /**
   * Check if the error is a validation error (422)
   */
  get isValidationError(): boolean {
    return this.statusCode === 422;
  }

  /**
   * Check if the request should be retried
   */
  get shouldRetry(): boolean {
    // Retry on network errors or 5xx server errors
    return this.isNetworkError || this.isServerError;
  }
}

/**
 * Request options interface
 */
export interface RequestOptions {
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  signal?: AbortSignal;
}

/**
 * Infrastructure API Client
 * 
 * A robust HTTP client for the A2R infrastructure backend with automatic retries,
 * error handling, and TypeScript support.
 */
export class InfrastructureApiClient {
  private baseURL: string;
  private defaultHeaders: Record<string, string>;
  private defaultTimeout: number;
  private defaultRetries: number;

  /**
   * Create a new InfrastructureApiClient instance
   * @param baseURL - The base URL for the API (defaults to env var or localhost)
   */
  constructor(baseURL: string = DEFAULT_BASE_URL) {
    this.baseURL = baseURL.replace(/\/$/, ''); // Remove trailing slash
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    this.defaultTimeout = DEFAULT_TIMEOUT;
    this.defaultRetries = MAX_RETRIES;
  }

  /**
   * Set an authentication token for all requests
   * @param token - The authentication token
   */
  setAuthToken(token: string): void {
    this.defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  /**
   * Clear the authentication token
   */
  clearAuthToken(): void {
    delete this.defaultHeaders['Authorization'];
  }

  /**
   * Set a custom header for all requests
   * @param key - The header name
   * @param value - The header value
   */
  setHeader(key: string, value: string): void {
    this.defaultHeaders[key] = value;
  }

  /**
   * Remove a custom header
   * @param key - The header name
   */
  removeHeader(key: string): void {
    delete this.defaultHeaders[key];
  }

  /**
   * Build the full URL for a request
   * @param path - The API path
   * @returns The full URL
   */
  private buildURL(path: string): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.baseURL}${normalizedPath}`;
  }

  /**
   * Delay execution for a specified number of milliseconds
   * @param ms - Milliseconds to delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Make an HTTP request with automatic retries
   * @param method - HTTP method
   * @param path - API path
   * @param body - Request body (optional)
   * @param options - Request options
   * @returns Promise resolving to the response data
   */
  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options: RequestOptions = {}
  ): Promise<T> {
    const url = this.buildURL(path);
    const timeout = options.timeout ?? this.defaultTimeout;
    const maxRetries = options.retries ?? this.defaultRetries;

    const headers: Record<string, string> = {
      ...this.defaultHeaders,
      ...options.headers,
    };

    let lastError: InfrastructureApiError | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        // Merge with external signal if provided
        if (options.signal) {
          const externalSignal = options.signal;
          const abortHandler = () => controller.abort();
          externalSignal.addEventListener('abort', abortHandler, { once: true });
          
          // Clean up if the request completes before external signal aborts
          if (externalSignal.aborted) {
            controller.abort();
          }
        }

        const fetchOptions: RequestInit = {
          method: method.toUpperCase(),
          headers,
          signal: controller.signal,
        };

        // Add body for non-GET requests
        if (body !== undefined && method.toUpperCase() !== 'GET') {
          fetchOptions.body = JSON.stringify(body);
        }

        const response = await fetch(url, fetchOptions);
        clearTimeout(timeoutId);

        // Handle non-OK responses
        if (!response.ok) {
          let errorData: unknown;
          try {
            errorData = await response.json();
          } catch {
            errorData = await response.text();
          }

          throw new InfrastructureApiError(
            this.extractErrorMessage(errorData, response.statusText),
            response.status,
            response,
            errorData
          );
        }

        // Handle empty responses (204 No Content)
        if (response.status === 204) {
          return undefined as T;
        }

        // Parse JSON response
        const data = await response.json();
        return data as T;

      } catch (error) {
        // Handle abort errors (timeout)
        if (error instanceof Error && error.name === 'AbortError') {
          lastError = new InfrastructureApiError(
            `Request timeout after ${timeout}ms`,
            0,
            undefined,
            { timeout }
          );
        } else if (error instanceof InfrastructureApiError) {
          lastError = error;
        } else if (error instanceof Error) {
          lastError = new InfrastructureApiError(
            error.message,
            undefined,
            undefined,
            error
          );
        } else {
          lastError = new InfrastructureApiError('Unknown error occurred');
        }

        // Don't retry if we shouldn't
        if (!lastError.shouldRetry || attempt >= maxRetries) {
          break;
        }

        // Wait before retrying with exponential backoff
        const backoffDelay = RETRY_DELAY * Math.pow(2, attempt);
        await this.delay(backoffDelay);
      }
    }

    throw lastError;
  }

  /**
   * Extract a human-readable error message from error data
   */
  private extractErrorMessage(data: unknown, fallback: string): string {
    if (typeof data === 'string') {
      return data;
    }
    if (data && typeof data === 'object') {
      if ('message' in data && typeof data.message === 'string') {
        return data.message;
      }
      if ('error' in data && typeof data.error === 'string') {
        return data.error;
      }
      if ('detail' in data && typeof data.detail === 'string') {
        return data.detail;
      }
    }
    return fallback;
  }

  /**
   * Make a GET request
   * @param path - API path
   * @param options - Request options
   * @returns Promise resolving to the response data
   */
  async get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('GET', path, undefined, options);
  }

  /**
   * Make a POST request
   * @param path - API path
   * @param body - Request body
   * @param options - Request options
   * @returns Promise resolving to the response data
   */
  async post<T>(path: string, body: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('POST', path, body, options);
  }

  /**
   * Make a PUT request
   * @param path - API path
   * @param body - Request body
   * @param options - Request options
   * @returns Promise resolving to the response data
   */
  async put<T>(path: string, body: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('PUT', path, body, options);
  }

  /**
   * Make a PATCH request
   * @param path - API path
   * @param body - Request body
   * @param options - Request options
   * @returns Promise resolving to the response data
   */
  async patch<T>(path: string, body: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('PATCH', path, body, options);
  }

  /**
   * Make a DELETE request
   * @param path - API path
   * @param options - Request options
   * @returns Promise resolving to the response data
   */
  async delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('DELETE', path, undefined, options);
  }
}

/**
 * Default singleton instance of the API client
 */
export const infrastructureClient = new InfrastructureApiClient();

export default InfrastructureApiClient;
