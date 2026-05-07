/**
 * Error Rate Limiter
 * 
 * Prevents spamming users with repeated error notifications.
 * Tracks error frequency and suppresses duplicates within a time window.
 */

export interface RateLimitConfig {
  maxAttempts?: number;
  windowMs?: number;
  cooldownMs?: number;
}

interface ErrorEntry {
  count: number;
  firstSeen: number;
  lastSeen: number;
  suppressed: boolean;
}

const DEFAULT_CONFIG: Required<RateLimitConfig> = {
  maxAttempts: 3,
  windowMs: 60000, // 1 minute
  cooldownMs: 300000, // 5 minutes
};

class ErrorRateLimiter {
  private errors = new Map<string, ErrorEntry>();
  private config: Required<RateLimitConfig>;

  constructor(config: RateLimitConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if an error should be shown to the user
   */
  shouldShow(errorKey: string): boolean {
    const now = Date.now();
    const entry = this.errors.get(errorKey);

    // Clean up old entries periodically
    this.cleanup(now);

    if (!entry) {
      // First occurrence
      this.errors.set(errorKey, {
        count: 1,
        firstSeen: now,
        lastSeen: now,
        suppressed: false,
      });
      return true;
    }

    // Check if we're in cooldown period
    if (entry.suppressed) {
      const cooldownElapsed = now - entry.lastSeen;
      if (cooldownElapsed < this.config.cooldownMs) {
        // Still in cooldown, update last seen but don't show
        entry.lastSeen = now;
        return false;
      }
      // Cooldown expired, reset
      entry.suppressed = false;
      entry.count = 1;
      entry.firstSeen = now;
      entry.lastSeen = now;
      return true;
    }

    // Check if within time window
    const windowElapsed = now - entry.firstSeen;
    if (windowElapsed > this.config.windowMs) {
      // Window expired, reset
      entry.count = 1;
      entry.firstSeen = now;
      entry.lastSeen = now;
      entry.suppressed = false;
      return true;
    }

    // Within window, increment count
    entry.count++;
    entry.lastSeen = now;

    // Check if we've hit the limit
    if (entry.count > this.config.maxAttempts) {
      entry.suppressed = true;
      return false;
    }

    return true;
  }

  /**
   * Get the current status of an error key
   */
  getStatus(errorKey: string): {
    count: number;
    suppressed: boolean;
    timeUntilReset: number;
  } | null {
    const entry = this.errors.get(errorKey);
    if (!entry) return null;

    const now = Date.now();
    let timeUntilReset: number;

    if (entry.suppressed) {
      timeUntilReset = Math.max(0, this.config.cooldownMs - (now - entry.lastSeen));
    } else {
      timeUntilReset = Math.max(0, this.config.windowMs - (now - entry.firstSeen));
    }

    return {
      count: entry.count,
      suppressed: entry.suppressed,
      timeUntilReset,
    };
  }

  /**
   * Reset a specific error key
   */
  reset(errorKey: string): void {
    this.errors.delete(errorKey);
  }

  /**
   * Reset all tracked errors
   */
  resetAll(): void {
    this.errors.clear();
  }

  /**
   * Clean up expired entries
   */
  private cleanup(now: number): void {
    for (const [key, entry] of Array.from(this.errors.entries())) {
      const maxAge = entry.suppressed 
        ? this.config.cooldownMs * 2 
        : this.config.windowMs * 2;
      
      if (now - entry.lastSeen > maxAge) {
        this.errors.delete(key);
      }
    }
  }

  /**
   * Get summary of current error state
   */
  getSummary(): {
    totalErrors: number;
    suppressedErrors: number;
    activeErrors: number;
  } {
    let suppressed = 0;
    let active = 0;

    for (const entry of Array.from(this.errors.values())) {
      if (entry.suppressed) {
        suppressed++;
      } else {
        active++;
      }
    }

    return {
      totalErrors: this.errors.size,
      suppressedErrors: suppressed,
      activeErrors: active,
    };
  }
}

// Global instance for app-wide error rate limiting
export const globalErrorLimiter = new ErrorRateLimiter();

// Per-feature limiters with different configs
export const networkErrorLimiter = new ErrorRateLimiter({
  maxAttempts: 3,
  windowMs: 30000, // 30 seconds
  cooldownMs: 120000, // 2 minutes
});

export const sessionErrorLimiter = new ErrorRateLimiter({
  maxAttempts: 2,
  windowMs: 60000,
  cooldownMs: 300000,
});

export const gcErrorLimiter = new ErrorRateLimiter({
  maxAttempts: 2,
  windowMs: 60000,
  cooldownMs: 180000, // 3 minutes
});

/**
 * Helper to check if an error should be shown using the global limiter
 */
export function shouldShowError(errorKey: string): boolean {
  return globalErrorLimiter.shouldShow(errorKey);
}

/**
 * Create a toast-compatible error handler with rate limiting
 */
export function createRateLimitedErrorHandler(
  limiter: ErrorRateLimiter,
  errorKey: string,
  toastFn: (opts: { title: string; description: string; type: 'error' | 'warning' | 'success' }) => void
) {
  return (title: string, description: string) => {
    if (limiter.shouldShow(errorKey)) {
      toastFn({ title, description, type: 'error' });
    }
  };
}
