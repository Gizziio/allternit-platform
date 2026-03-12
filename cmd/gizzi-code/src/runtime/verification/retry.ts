/**
 * Auto-Retry Logic for Visual Verification
 * 
 * Handles transient failures with exponential backoff and jitter.
 * Configurable retry policies per failure type.
 */

import { Log } from "@/shared/util/log";

const log = Log.create({ service: "verification.retry" });

// ============================================================================
// Types
// ============================================================================

export interface RetryPolicy {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  
  /** Initial delay in milliseconds */
  initialDelayMs: number;
  
  /** Maximum delay in milliseconds */
  maxDelayMs: number;
  
  /** Exponential backoff multiplier */
  backoffMultiplier: number;
  
  /** Add random jitter to prevent thundering herd */
  jitter: boolean;
  
  /** Which error types are retryable */
  retryableErrors: ErrorClassifier[];
}

export type ErrorClassifier = 
  | "timeout"
  | "network"
  | "dev-server-unavailable"
  | "browser-crash"
  | "transient";

export interface RetryAttempt {
  attempt: number;
  delayMs: number;
  error?: string;
  timestamp: number;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  attempts: RetryAttempt[];
  totalTimeMs: number;
  finalError?: string;
}

// ============================================================================
// Default Policies
// ============================================================================

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitter: true,
  retryableErrors: ["timeout", "network", "dev-server-unavailable", "transient"],
};

export const AGGRESSIVE_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 5,
  initialDelayMs: 500,
  maxDelayMs: 60000,
  backoffMultiplier: 1.5,
  jitter: true,
  retryableErrors: ["timeout", "network", "dev-server-unavailable", "browser-crash", "transient"],
};

export const NO_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 1,
  initialDelayMs: 0,
  maxDelayMs: 0,
  backoffMultiplier: 1,
  jitter: false,
  retryableErrors: [],
};

// ============================================================================
// Retry Executor
// ============================================================================

export class RetryExecutor {
  private policy: RetryPolicy;

  constructor(policy: RetryPolicy = DEFAULT_RETRY_POLICY) {
    this.policy = policy;
  }

  async execute<T>(
    operation: () => Promise<T>,
    errorClassifier?: (error: Error) => ErrorClassifier | null
  ): Promise<RetryResult<T>> {
    const attempts: RetryAttempt[] = [];
    const startTime = Date.now();
    
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.policy.maxAttempts; attempt++) {
      const attemptStart = Date.now();
      
      try {
        log.debug("[Retry] Attempting operation", { attempt, maxAttempts: this.policy.maxAttempts });
        
        const result = await operation();
        
        attempts.push({
          attempt,
          delayMs: attempt > 1 ? this.calculateDelay(attempt - 1) : 0,
          timestamp: attemptStart,
        });

        log.info("[Retry] Operation succeeded", { 
          attempt, 
          totalAttempts: attempts.length,
          totalTimeMs: Date.now() - startTime 
        });

        return {
          success: true,
          result,
          attempts,
          totalTimeMs: Date.now() - startTime,
        };

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        const errorType = errorClassifier?.(lastError) || this.classifyError(lastError);
        
        attempts.push({
          attempt,
          delayMs: attempt > 1 ? this.calculateDelay(attempt - 1) : 0,
          error: lastError.message,
          timestamp: attemptStart,
        });

        // Check if we should retry
        if (attempt >= this.policy.maxAttempts) {
          log.warn("[Retry] Max attempts reached", { 
            attempts: attempt,
            lastError: lastError.message 
          });
          break;
        }

        if (!this.isRetryable(errorType)) {
          log.info("[Retry] Non-retryable error, stopping", { 
            errorType,
            error: lastError.message 
          });
          break;
        }

        // Calculate and apply delay
        const delayMs = this.calculateDelay(attempt);
        log.debug("[Retry] Waiting before next attempt", { 
          attempt: attempt + 1,
          delayMs,
          errorType 
        });
        
        await this.sleep(delayMs);
      }
    }

    return {
      success: false,
      attempts,
      totalTimeMs: Date.now() - startTime,
      finalError: lastError?.message,
    };
  }

  private calculateDelay(attempt: number): number {
    // Exponential backoff: initialDelay * (multiplier ^ attempt)
    let delay = this.policy.initialDelayMs * Math.pow(
      this.policy.backoffMultiplier,
      attempt - 1
    );

    // Cap at max delay
    delay = Math.min(delay, this.policy.maxDelayMs);

    // Add jitter (±25%)
    if (this.policy.jitter) {
      const jitterFactor = 0.75 + Math.random() * 0.5;
      delay = Math.floor(delay * jitterFactor);
    }

    return delay;
  }

  private isRetryable(errorType: ErrorClassifier | null): boolean {
    if (!errorType) return false;
    return this.policy.retryableErrors.includes(errorType);
  }

  private classifyError(error: Error): ErrorClassifier | null {
    const message = error.message.toLowerCase();

    if (message.includes("timeout") || message.includes("timed out")) {
      return "timeout";
    }

    if (message.includes("network") || message.includes("connection") || message.includes("econnrefused")) {
      return "network";
    }

    if (message.includes("dev server") || message.includes("server not available")) {
      return "dev-server-unavailable";
    }

    if (message.includes("browser") || message.includes("playwright") || message.includes("crashed")) {
      return "browser-crash";
    }

    if (message.includes("transient") || message.includes("temporary")) {
      return "transient";
    }

    return null;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

export async function withRetry<T>(
  operation: () => Promise<T>,
  options?: {
    policy?: RetryPolicy;
    errorClassifier?: (error: Error) => ErrorClassifier | null;
    onRetry?: (attempt: number, error: Error, delayMs: number) => void;
  }
): Promise<T> {
  const executor = new RetryExecutor(options?.policy || DEFAULT_RETRY_POLICY);
  
  const result = await executor.execute(operation, options?.errorClassifier);
  
  if (!result.success) {
    throw new Error(
      `Operation failed after ${result.attempts.length} attempts: ${result.finalError}`
    );
  }
  
  return result.result!;
}

// ============================================================================
// Integration with Visual Capture
// ============================================================================

export function createVisualCaptureWithRetry(
  baseCaptureFn: () => Promise<any>,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY
): () => Promise<any> {
  return async () => {
    const executor = new RetryExecutor(policy);
    
    const result = await executor.execute(baseCaptureFn, (error) => {
      // Visual capture specific error classification
      const message = error.message.toLowerCase();
      
      if (message.includes("dev server") || message.includes("server not available")) {
        return "dev-server-unavailable";
      }
      
      if (message.includes("browser") || message.includes("playwright") || message.includes("page crashed")) {
        return "browser-crash";
      }
      
      if (message.includes("timeout") || message.includes("navigation")) {
        return "timeout";
      }
      
      return null;
    });

    if (!result.success) {
      throw new Error(`Visual capture failed: ${result.finalError}`);
    }

    return result.result;
  };
}
