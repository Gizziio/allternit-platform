/**
 * Retry Logic with Exponential Backoff
 * 
 * Configurable retry strategies for transient failures.
 */

export interface RetryConfig {
  maxAttempts: number;
  backoffStrategy: 'fixed' | 'linear' | 'exponential' | 'jitter';
  baseDelayMs: number;
  maxDelayMs: number;
  retryableErrors?: string[];      // Error types to retry
  nonRetryableErrors?: string[];   // Error types to not retry
  onRetry?: (attempt: number, error: Error, delay: number) => void;
  onSuccess?: (attempt: number) => void;
  onFailure?: (attempt: number, error: Error) => void;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
  totalDurationMs: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  backoffStrategy: 'exponential',
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  retryableErrors: [],
  nonRetryableErrors: []
};

export class RetryExecutor {
  private config: RetryConfig;

  constructor(config?: Partial<RetryConfig>) {
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config };
  }

  /**
   * Execute a function with retry logic
   */
  async execute<T>(fn: () => Promise<T>): Promise<RetryResult<T>> {
    const startTime = Date.now();
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      try {
        const result = await fn();
        
        if (attempt > 1 && this.config.onSuccess) {
          this.config.onSuccess(attempt);
        }

        return {
          success: true,
          result,
          attempts: attempt,
          totalDurationMs: Date.now() - startTime
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if error is non-retryable
        if (this.isNonRetryable(lastError)) {
          break;
        }

        // Check if error is retryable (if whitelist specified)
        if (this.config.retryableErrors && this.config.retryableErrors.length > 0) {
          if (!this.isRetryable(lastError)) {
            break;
          }
        }

        // Don't retry on last attempt
        if (attempt < this.config.maxAttempts) {
          const delay = this.calculateDelay(attempt);
          
          if (this.config.onRetry) {
            this.config.onRetry(attempt, lastError, delay);
          }

          await this.sleep(delay);
        }
      }
    }

    if (this.config.onFailure && lastError) {
      this.config.onFailure(this.config.maxAttempts, lastError);
    }

    return {
      success: false,
      error: lastError,
      attempts: this.config.maxAttempts,
      totalDurationMs: Date.now() - startTime
    };
  }

  /**
   * Calculate delay for a given attempt
   */
  private calculateDelay(attempt: number): number {
    let delay: number;

    switch (this.config.backoffStrategy) {
      case 'fixed':
        delay = this.config.baseDelayMs;
        break;
      case 'linear':
        delay = this.config.baseDelayMs * attempt;
        break;
      case 'exponential':
        delay = this.config.baseDelayMs * Math.pow(2, attempt - 1);
        break;
      case 'jitter':
        const base = this.config.baseDelayMs * Math.pow(2, attempt - 1);
        delay = base + (Math.random() * base * 0.1); // 10% jitter
        break;
      default:
        delay = this.config.baseDelayMs;
    }

    return Math.min(delay, this.config.maxDelayMs);
  }

  /**
   * Check if error is in retryable list
   */
  private isRetryable(error: Error): boolean {
    if (!this.config.retryableErrors || this.config.retryableErrors.length === 0) {
      return true;
    }
    return this.config.retryableErrors.some(pattern => 
      error.name.includes(pattern) || error.message.includes(pattern)
    );
  }

  /**
   * Check if error is in non-retryable list
   */
  private isNonRetryable(error: Error): boolean {
    if (!this.config.nonRetryableErrors || this.config.nonRetryableErrors.length === 0) {
      return false;
    }
    return this.config.nonRetryableErrors.some(pattern => 
      error.name.includes(pattern) || error.message.includes(pattern)
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Retry decorator for class methods
 */
export function WithRetry(config?: Partial<RetryConfig>) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const retryExecutor = new RetryExecutor(config);

    descriptor.value = async function (...args: any[]) {
      return retryExecutor.execute(() => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}

/**
 * Common retry configurations for different scenarios
 */
export const RetryPresets = {
  // For network requests
  network: {
    maxAttempts: 5,
    backoffStrategy: 'exponential' as const,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    retryableErrors: ['ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND', 'NetworkError']
  },

  // For database operations
  database: {
    maxAttempts: 3,
    backoffStrategy: 'linear' as const,
    baseDelayMs: 100,
    maxDelayMs: 5000,
    retryableErrors: ['ConnectionError', 'Deadlock', 'TimeoutError']
  },

  // For idempotent operations
  idempotent: {
    maxAttempts: 10,
    backoffStrategy: 'jitter' as const,
    baseDelayMs: 500,
    maxDelayMs: 60000
  },

  // For non-critical operations
  bestEffort: {
    maxAttempts: 2,
    backoffStrategy: 'fixed' as const,
    baseDelayMs: 100,
    maxDelayMs: 1000
  }
};

export function withRetry<T>(
  fn: () => Promise<T>,
  config?: Partial<RetryConfig>
): Promise<RetryResult<T>> {
  const executor = new RetryExecutor(config);
  return executor.execute(fn);
}
