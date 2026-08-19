/**
 * Harness middleware implementations.
 *
 * Provides a hook system (beforeRequest, afterResponse, onError) plus built-in
 * middleware for retries and refusal/content-filter fallback.
 */
import { HarnessErrorCode } from './types.js';
import { backoffDelayMs, DEFAULT_RETRY_OPTIONS, resolveOptions, RETRYABLE_STATUS_CODES, sleep, } from './retry.js';
/**
 * Normalizes a single middleware or array into an array.
 */
export function normalizeMiddleware(middleware) {
    if (!middleware)
        return [];
    return Array.isArray(middleware) ? middleware : [middleware];
}
/**
 * Creates the default retry middleware.
 *
 * Retries the entire stream on network errors and retryable HTTP status codes
 * using exponential backoff with jitter. This replaces the previous
 * fetchWithRetry call sites in provider implementations.
 */
export function createRetryMiddleware(options) {
    const opts = resolveOptions(options);
    let attempt = 0;
    return {
        name: 'retry',
        onError: async function* (error, context) {
            if (!isRetryableError(error)) {
                throw error;
            }
            if (attempt >= opts.maxRetries) {
                throw error;
            }
            await sleep(backoffDelayMs(attempt, opts));
            attempt++;
            yield* context.harness.stream(context.request);
        },
    };
}
/**
 * Creates a middleware that falls back to the next configured provider/model
 * when a request is refused or content-filtered.
 */
export function createRefusalFallbackMiddleware(fallbackModels) {
    let fallbackAttempt = 0;
    return {
        name: 'refusal-fallback',
        onError: async function* (error, context) {
            if (!isRefusalError(error)) {
                throw error;
            }
            if (fallbackAttempt >= fallbackModels.length) {
                throw error;
            }
            const next = fallbackModels[fallbackAttempt++];
            yield* context.harness.stream({
                ...context.request,
                provider: next.provider,
                model: next.model,
            });
        },
    };
}
/**
 * Determines whether an error is worth retrying with the same request.
 */
export function isRetryableError(error) {
    if (error.code === HarnessErrorCode.NETWORK_ERROR ||
        error.code === HarnessErrorCode.TIMEOUT ||
        error.code === HarnessErrorCode.RATE_LIMITED) {
        return true;
    }
    if (error.code === HarnessErrorCode.API_ERROR) {
        const match = error.message.match(/retryable status (\d+)/);
        if (match) {
            return RETRYABLE_STATUS_CODES.has(Number(match[1]));
        }
    }
    return false;
}
/**
 * Determines whether an error indicates a provider refusal or content-filter
 * response that should trigger a fallback model.
 */
export function isRefusalError(error) {
    const message = error.message.toLowerCase();
    return (message.includes('refusal') ||
        message.includes('content_filter') ||
        message.includes('content filter') ||
        message.includes('policy violation') ||
        message.includes('moderation') ||
        message.includes('safety') ||
        message.includes('blocked'));
}
/**
 * Applies afterResponse middleware in order.
 */
export async function applyAfterResponse(middleware, response) {
    let current = response;
    for (const m of middleware) {
        if (m.afterResponse) {
            current = await m.afterResponse(current);
        }
    }
    return current;
}
/**
 * Applies beforeRequest middleware in order.
 */
export async function applyBeforeRequest(middleware, request) {
    let current = request;
    for (const m of middleware) {
        if (m.beforeRequest) {
            current = await m.beforeRequest(current);
        }
    }
    return current;
}
export { DEFAULT_RETRY_OPTIONS };
