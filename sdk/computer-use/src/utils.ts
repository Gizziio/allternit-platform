/**
 * Allternit Computer Use Engine - TypeScript SDK Utilities
 * 
 * Helper functions for the SDK.
 */

import { ErrorResponse } from './types';

/**
 * Normalize an endpoint URL.
 * 
 * - Removes trailing slash
 * - Adds /v1 prefix if not present
 * - Ensures proper protocol
 * 
 * @param endpoint - The raw endpoint URL
 * @returns Normalized endpoint URL
 */
export function normalizeEndpoint(endpoint: string): string {
  let url = endpoint.trim();

  // Ensure protocol
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `http://${url}`;
  }

  // Remove trailing slash
  url = url.replace(/\/$/, '');

  // Add /v1 prefix if not present
  if (!url.endsWith('/v1')) {
    url = `${url}/v1`;
  }

  return url;
}

/**
 * Build request headers with optional API key.
 * 
 * @param customHeaders - Custom headers to include
 * @param apiKey - Optional API key for authentication
 * @param includeContentType - Whether to include Content-Type header
 * @returns Headers object
 */
export function buildRequestHeaders(
  customHeaders: Record<string, string> = {},
  apiKey?: string,
  includeContentType: boolean = true
): Record<string, string> {
  const headers: Record<string, string> = {
    ...customHeaders,
  };

  if (includeContentType) {
    headers['Content-Type'] = 'application/json';
  }

  headers['Accept'] = 'application/json';

  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  return headers;
}

/**
 * API error class for typed error handling.
 */
export class AllternitComputerUseError extends Error {
  /** HTTP status code */
  status: number;
  /** Error code from API */
  code?: string;
  /** Additional error details */
  details?: Record<string, unknown>;

  constructor(
    message: string,
    status: number,
    code?: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AllternitComputerUseError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * Handle API error response.
 * 
 * @param response - The fetch response
 * @throws AllternitComputerUseError
 */
export async function handleApiError(response: Response): Promise<never> {
  let errorData: ErrorResponse | undefined;
  
  try {
    errorData = await response.json() as ErrorResponse;
  } catch {
    // Response body is not JSON
  }

  const message = errorData?.detail ?? errorData?.error ?? `HTTP ${response.status}: ${response.statusText}`;
  const code = errorData?.code;

  throw new AllternitComputerUseError(
    message,
    response.status,
    code,
    errorData as Record<string, unknown> | undefined
  );
}

/**
 * Delay for a specified duration.
 * 
 * @param ms - Milliseconds to delay
 * @returns Promise that resolves after the delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff.
 * 
 * @param fn - Function to retry
 * @param maxRetries - Maximum number of retries
 * @param baseDelay - Base delay in milliseconds
 * @returns Promise resolving to the function result
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        break;
      }

      // Exponential backoff
      const waitTime = baseDelay * Math.pow(2, attempt);
      await delay(waitTime);
    }
  }

  throw lastError;
}

/**
 * Check if a value is a plain object.
 * 
 * @param value - Value to check
 * @returns True if the value is a plain object
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.prototype.toString.call(value) === '[object Object]'
  );
}

/**
 * Deep merge objects.
 * 
 * @param target - Target object
 * @param sources - Source objects to merge
 * @returns Merged object
 */
export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  ...sources: Array<Partial<T>>
): T {
  const result: Record<string, unknown> = { ...target };

  for (const source of sources) {
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        const sourceValue = source[key];
        const targetValue = result[key];

        if (
          isPlainObject(targetValue) &&
          isPlainObject(sourceValue)
        ) {
          result[key] = deepMerge(
            targetValue,
            sourceValue as Record<string, unknown>
          );
        } else if (sourceValue !== undefined) {
          result[key] = sourceValue;
        }
      }
    }
  }

  return result as T;
}

/**
 * Generate a UUID v4.
 * 
 * @returns UUID string
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Validate a run ID format.
 * 
 * @param runId - Run ID to validate
 * @returns True if valid
 */
export function isValidRunId(runId: string): boolean {
  return typeof runId === 'string' && runId.length > 0;
}

/**
 * Validate a session ID format.
 * 
 * @param sessionId - Session ID to validate
 * @returns True if valid
 */
export function isValidSessionId(sessionId: string): boolean {
  return typeof sessionId === 'string' && sessionId.length > 0;
}

/**
 * Format a duration in milliseconds to a human-readable string.
 * 
 * @param ms - Duration in milliseconds
 * @returns Formatted string
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}m ${seconds}s`;
}

/**
 * Safely parse JSON with fallback.
 * 
 * @param json - JSON string to parse
 * @param fallback - Fallback value if parsing fails
 * @returns Parsed value or fallback
 */
export function safeJSONParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/**
 * Safely stringify JSON with fallback.
 * 
 * @param value - Value to stringify
 * @param fallback - Fallback value if stringification fails
 * @returns JSON string or fallback
 */
export function safeJSONStringify(value: unknown, fallback: string = '{}'): string {
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}
