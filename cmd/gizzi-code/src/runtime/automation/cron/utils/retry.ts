/**
 * Retry Utility with Exponential Backoff
 * 
 * Production-ready retry logic with configurable backoff strategies.
 */

import { createLogger } from "./logger";

const log = createLogger("cron-retry");

export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Initial delay in milliseconds */
  initialDelayMs: number;
  /** Maximum delay in milliseconds */
  maxDelayMs: number;
  /** Backoff multiplier (default: 2 for exponential) */
  backoffMultiplier: number;
  /** Whether to use exponential backoff (true) or linear (false) */
  exponential: boolean;
  /** Optional function to determine if error is retryable */
  isRetryable?: (error: Error) => boolean;
  /** Optional callback on retry */
  onRetry?: (attempt: number, delay: number, error: Error) => void;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 60000,
  backoffMultiplier: 2,
  exponential: true,
  isRetryable: () => true,
};

/**
 * Calculate delay for a given attempt using exponential or linear backoff
 */
export function calculateDelay(attempt: number, config: RetryConfig): number {
  let delay: number;
  
  if (config.exponential) {
    // Exponential backoff: initialDelay * multiplier^attempt
    delay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);
  } else {
    // Linear backoff: initialDelay * attempt
    delay = config.initialDelayMs * attempt;
  }
  
  // Add jitter (±25%) to prevent thundering herd
  const jitter = delay * 0.25 * (Math.random() * 2 - 1);
  delay += jitter;
  
  // Clamp to max delay
  return Math.min(delay, config.maxDelayMs);
}

/**
 * Execute a function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const fullConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error | undefined;
  
  for (let attempt = 1; attempt <= fullConfig.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Check if we should retry this error
      if (fullConfig.isRetryable && !fullConfig.isRetryable(lastError)) {
        log.info("Non-retryable error, aborting", { error: lastError.message });
        throw lastError;
      }
      
      // Don't retry on last attempt
      if (attempt === fullConfig.maxAttempts) {
        log.info("Max retry attempts reached", { 
          attempts: fullConfig.maxAttempts,
          lastError: lastError.message 
        });
        break;
      }
      
      // Calculate delay for next attempt
      const delay = calculateDelay(attempt, fullConfig);
      
      log.info("Retrying after error", {
        attempt,
        nextAttempt: attempt + 1,
        maxAttempts: fullConfig.maxAttempts,
        delay,
        error: lastError.message,
      });
      
      // Call retry callback if provided
      fullConfig.onRetry?.(attempt, delay, lastError);
      
      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  
  throw lastError ?? new Error("Retry failed with unknown error");
}

/**
 * Retryable error checker for common scenarios
 */
export const RetryableErrors = {
  /** Network errors are typically retryable */
  isNetworkError(error: Error): boolean {
    const networkErrorPatterns = [
      /ECONNRESET/i,
      /ETIMEDOUT/i,
      /ECONNREFUSED/i,
      /ENOTFOUND/i,
      /EAI_AGAIN/i,
      /socket hang up/i,
      /network error/i,
      /timeout/i,
      /fetch failed/i,
    ];
    return networkErrorPatterns.some((pattern) => pattern.test(error.message));
  },
  
  /** HTTP 5xx errors are retryable */
  isServerError(error: Error): boolean {
    const serverErrorPatterns = [
      /5\d{2}/,
      /Service Unavailable/i,
      /Internal Server Error/i,
      /Bad Gateway/i,
      /Gateway Timeout/i,
    ];
    return serverErrorPatterns.some((pattern) => pattern.test(error.message));
  },
  
  /** Rate limit errors should be retried with backoff */
  isRateLimitError(error: Error): boolean {
    const rateLimitPatterns = [
      /429/,
      /rate limit/i,
      /too many requests/i,
      /quota exceeded/i,
    ];
    return rateLimitPatterns.some((pattern) => pattern.test(error.message));
  },
  
  /** Client errors (4xx) are typically not retryable */
  isClientError(error: Error): boolean {
    const clientErrorPatterns = [
      /4\d{2}/,
      /Unauthorized/i,
      /Forbidden/i,
      /Not Found/i,
      /Bad Request/i,
    ];
    return clientErrorPatterns.some((pattern) => pattern.test(error.message));
  },
  
  /** Combine multiple checkers */
  any(...checkers: Array<(error: Error) => boolean>): (error: Error) => boolean {
    return (error) => checkers.some((checker) => checker(error));
  },
  
  /** Standard retryable check - network, server, and rate limit errors */
  standard(error: Error): boolean {
    // Don't retry client errors
    if (this.isClientError(error)) return false;
    // Retry network, server, and rate limit errors
    return this.isNetworkError(error) || this.isServerError(error) || this.isRateLimitError(error);
  },
};

/**
 * Decorator for retrying async methods
 */
export function Retryable(config: Partial<RetryConfig> = {}) {
  return function (
    _target: unknown,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: unknown[]) {
      return withRetry(() => originalMethod.apply(this, args), config);
    };
    
    return descriptor;
  };
}
