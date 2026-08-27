/**
 * Provider-agnostic retry/backoff interceptor for the harness fetch path.
 * Retries on network errors and retryable HTTP status codes using
 * exponential backoff with full jitter.
 */

export interface RetryOptions {
  /** Maximum number of retry attempts after the initial try. Default 3. */
  maxRetries?: number;
  /** Base delay in ms before the first retry. Default 500. */
  initialDelayMs?: number;
  /** Upper bound for the backoff delay in ms. Default 8000. */
  maxDelayMs?: number;
  /** Randomize the delay within [0, backoff] to avoid thundering herds. Default true. */
  jitter?: boolean;
}

export const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 500,
  maxDelayMs: 8000,
  jitter: true,
};

/** HTTP status codes worth retrying: rate limits, transient conflicts, server errors. */
export const RETRYABLE_STATUS_CODES = new Set([408, 409, 429, 500, 502, 503, 504]);

export function resolveOptions(options?: RetryOptions): Required<RetryOptions> {
  return { ...DEFAULT_RETRY_OPTIONS, ...options };
}

export function backoffDelayMs(attempt: number, options: Required<RetryOptions>): number {
  const exponential = Math.min(options.initialDelayMs * 2 ** attempt, options.maxDelayMs);
  return options.jitter ? Math.random() * exponential : exponential;
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Runs `fetch(input, init)`, retrying with exponential backoff + jitter when
 * the request throws (network error) or returns a retryable status code.
 * Non-retryable responses (including 4xx other than 408/409/429) are
 * returned as-is on the first attempt so callers keep normal error handling.
 */
export async function fetchWithRetry(
  input: string | URL,
  init: RequestInit,
  options?: RetryOptions
): Promise<Response> {
  const opts = resolveOptions(options);
  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    const isLastAttempt = attempt === opts.maxRetries;
    try {
      const response = await fetch(input, init);
      if (response.ok || !RETRYABLE_STATUS_CODES.has(response.status) || isLastAttempt) {
        return response;
      }
      lastError = new Error(`Request failed with retryable status ${response.status}`);
    } catch (error) {
      if (isLastAttempt) throw error;
      lastError = error;
    }
    await sleep(backoffDelayMs(attempt, opts));
  }

  // Unreachable: the loop always returns or throws on the last attempt.
  throw lastError;
}
