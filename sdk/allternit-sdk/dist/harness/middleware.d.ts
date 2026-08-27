/**
 * Harness middleware implementations.
 *
 * Provides a hook system (beforeRequest, afterResponse, onError) plus built-in
 * middleware for retries and refusal/content-filter fallback.
 */
import type { HarnessError, HarnessMiddleware, HarnessResponse, StreamRequest } from './types.js';
import { DEFAULT_RETRY_OPTIONS, RetryOptions } from './retry.js';
/**
 * Normalizes a single middleware or array into an array.
 */
export declare function normalizeMiddleware(middleware?: HarnessMiddleware | HarnessMiddleware[]): HarnessMiddleware[];
/**
 * Creates the default retry middleware.
 *
 * Retries the entire stream on network errors and retryable HTTP status codes
 * using exponential backoff with jitter. This replaces the previous
 * fetchWithRetry call sites in provider implementations.
 */
export declare function createRetryMiddleware(options?: RetryOptions): HarnessMiddleware;
/**
 * Creates a middleware that falls back to the next configured provider/model
 * when a request is refused or content-filtered.
 */
export declare function createRefusalFallbackMiddleware(fallbackModels: Array<{
    provider: string;
    model: string;
}>): HarnessMiddleware;
/**
 * Determines whether an error is worth retrying with the same request.
 */
export declare function isRetryableError(error: HarnessError): boolean;
/**
 * Determines whether an error indicates a provider refusal or content-filter
 * response that should trigger a fallback model.
 */
export declare function isRefusalError(error: HarnessError): boolean;
/**
 * Applies afterResponse middleware in order.
 */
export declare function applyAfterResponse(middleware: HarnessMiddleware[], response: HarnessResponse): Promise<HarnessResponse>;
/**
 * Applies beforeRequest middleware in order.
 */
export declare function applyBeforeRequest(middleware: HarnessMiddleware[], request: StreamRequest): Promise<StreamRequest>;
export { DEFAULT_RETRY_OPTIONS };
