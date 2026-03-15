/**
 * Rate Limiter
 * 
 * Implements rate limiting for webhook ingestion.
 * Uses sliding window algorithm for accurate rate limiting.
 */

/**
 * Rate limit entry for sliding window
 */
interface RateLimitEntry {
  /** Timestamp of request */
  timestamp: number;
}

/**
 * Rate limit state per key
 */
interface RateLimitState {
  /** Request timestamps in current window */
  requests: RateLimitEntry[];
  /** Window start time */
  windowStart: number;
}

/**
 * Rate limit check result
 */
export interface RateLimitResult {
  /** Whether request is allowed */
  allowed: boolean;
  /** Current request count in window */
  count: number;
  /** Maximum allowed requests */
  max: number;
  /** Window size in milliseconds */
  windowMs: number;
  /** Time until window resets (ms) */
  resetIn: number;
  /** Retry after seconds (if blocked) */
  retryAfter?: number;
  /** Reason if blocked */
  reason?: string;
}

/**
 * Rate limiter configuration
 */
export interface RateLimiterConfig {
  /** Maximum requests per window */
  maxRequests: number;
  /** Window size in milliseconds */
  windowMs: number;
  /** Whether to use sliding window (vs fixed window) */
  slidingWindow: boolean;
}

/**
 * In-memory rate limiter using sliding window algorithm
 */
export class RateLimiter {
  private config: RateLimiterConfig;
  private store: Map<string, RateLimitState>;
  private cleanupInterval?: NodeJS.Timeout;
  
  constructor(config: RateLimiterConfig) {
    this.config = config;
    this.store = new Map();
    
    // Start cleanup interval
    this.startCleanup();
  }
  
  /**
   * Check if request is allowed
   */
  async check(key: string): Promise<RateLimitResult> {
    const now = Date.now();
    const state = this.store.get(key);
    
    if (!state) {
      // No history, allow
      return {
        allowed: true,
        count: 0,
        max: this.config.maxRequests,
        windowMs: this.config.windowMs,
        resetIn: this.config.windowMs,
      };
    }
    
    // Calculate window boundaries
    const windowStart = now - this.config.windowMs;
    
    // Filter requests within current window
    const validRequests = state.requests.filter(req => req.timestamp > windowStart);
    const count = validRequests.length;
    
    // Calculate reset time
    const oldestRequest = validRequests[0];
    const resetIn = oldestRequest ? oldestRequest.timestamp + this.config.windowMs - now : this.config.windowMs;
    
    if (count >= this.config.maxRequests) {
      return {
        allowed: false,
        count,
        max: this.config.maxRequests,
        windowMs: this.config.windowMs,
        resetIn,
        retryAfter: Math.ceil(resetIn / 1000),
        reason: `Rate limit exceeded: ${count}/${this.config.maxRequests} requests in ${this.config.windowMs / 1000}s window`,
      };
    }
    
    return {
      allowed: true,
      count,
      max: this.config.maxRequests,
      windowMs: this.config.windowMs,
      resetIn,
    };
  }
  
  /**
   * Record a request
   */
  async record(key: string): Promise<void> {
    const now = Date.now();
    let state = this.store.get(key);
    
    if (!state) {
      state = {
        requests: [],
        windowStart: now,
      };
      this.store.set(key, state);
    }
    
    // Add new request
    state.requests.push({ timestamp: now });
    
    // Clean old requests (sliding window)
    const windowStart = now - this.config.windowMs;
    state.requests = state.requests.filter(req => req.timestamp > windowStart);
  }
  
  /**
   * Check and record in one operation (atomic)
   */
  async checkAndRecord(key: string): Promise<RateLimitResult> {
    const result = await this.check(key);
    
    if (result.allowed) {
      await this.record(key);
      result.count++;
    }
    
    return result;
  }
  
  /**
   * Get current status for a key
   */
  async getStatus(key: string): Promise<RateLimitResult> {
    return this.check(key);
  }
  
  /**
   * Reset rate limit for a key
   */
  async reset(key: string): Promise<void> {
    this.store.delete(key);
  }
  
  /**
   * Clear all rate limits
   */
  async clear(): Promise<void> {
    this.store.clear();
  }
  
  /**
   * Start cleanup interval
   */
  private startCleanup(): void {
    // Cleanup every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
    
    // Don't prevent process exit
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }
  
  /**
   * Cleanup old entries
   */
  private cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    
    for (const [key, state] of this.store.entries()) {
      // Remove old requests
      state.requests = state.requests.filter(req => req.timestamp > windowStart);
      
      // Remove empty entries
      if (state.requests.length === 0) {
        this.store.delete(key);
      }
    }
  }
  
  /**
   * Stop the rate limiter
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }
  
  /**
   * Update configuration
   */
  updateConfig(config: Partial<RateLimiterConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

/**
 * Create default rate limiter
 */
export function createDefaultRateLimiter(): RateLimiter {
  return new RateLimiter({
    maxRequests: 100,
    windowMs: 60000, // 1 minute
    slidingWindow: true,
  });
}

/**
 * Create rate limiter for webhook sources
 */
export function createWebhookRateLimiter(): RateLimiter {
  return new RateLimiter({
    maxRequests: 60, // 60 requests per minute per source
    windowMs: 60000,
    slidingWindow: true,
  });
}

/**
 * Rate limiter middleware for Fastify
 */
export function createRateLimitMiddleware(limiter: RateLimiter) {
  return async function rateLimitMiddleware(
    key: string
  ): Promise<{ allowed: boolean; headers: Record<string, string> }> {
    const result = await limiter.checkAndRecord(key);
    
    const headers: Record<string, string> = {
      'X-RateLimit-Limit': String(result.max),
      'X-RateLimit-Remaining': String(Math.max(0, result.max - result.count)),
      'X-RateLimit-Reset': String(Math.ceil((Date.now() + result.resetIn) / 1000)),
    };
    
    if (!result.allowed) {
      headers['Retry-After'] = String(result.retryAfter || 60);
    }
    
    return {
      allowed: result.allowed,
      headers,
    };
  };
}
