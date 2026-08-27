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
export declare const DEFAULT_RETRY_OPTIONS: Required<RetryOptions>;
/** HTTP status codes worth retrying: rate limits, transient conflicts, server errors. */
export declare const RETRYABLE_STATUS_CODES: Set<number>;
export declare function resolveOptions(options?: RetryOptions): Required<RetryOptions>;
export declare function backoffDelayMs(attempt: number, options: Required<RetryOptions>): number;
export declare function sleep(ms: number): Promise<void>;
/**
 * Runs `fetch(input, init)`, retrying with exponential backoff + jitter when
 * the request throws (network error) or returns a retryable status code.
 * Non-retryable responses (including 4xx other than 408/409/429) are
 * returned as-is on the first attempt so callers keep normal error handling.
 */
export declare function fetchWithRetry(input: string | URL, init: RequestInit, options?: RetryOptions): Promise<Response>;
