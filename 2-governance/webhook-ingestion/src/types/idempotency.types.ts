/**
 * Idempotency Types
 * 
 * Defines types for idempotency key generation and deduplication.
 */

/**
 * Idempotency key generation options
 */
export interface IdempotencyKeyOptions {
  /** Include source in key */
  includeSource: boolean;
  /** Include event type in key */
  includeEventType: boolean;
  /** Include actor in key */
  includeActor: boolean;
  /** Include target in key */
  includeTarget: boolean;
  /** Include timestamp (rounded to interval) */
  includeTimestamp?: {
    enabled: boolean;
    intervalSeconds: number;
  };
  /** Custom fields to include */
  customFields?: string[];
}

/**
 * Idempotency key result
 */
export interface IdempotencyKeyResult {
  /** Generated key */
  key: string;
  /** Components used to generate key */
  components: string[];
  /** Hash algorithm used */
  algorithm: 'sha256' | 'sha1' | 'md5';
  /** Generated at timestamp */
  generatedAt: string;
}

/**
 * Deduplication store entry
 */
export interface DeduplicationEntry {
  /** Idempotency key */
  idempotencyKey: string;
  /** Source system */
  source: string;
  /** Event type */
  eventType: string;
  /** First seen timestamp */
  firstSeenAt: string;
  /** Last seen timestamp */
  lastSeenAt: string;
  /** Count of occurrences */
  occurrenceCount: number;
  /** Associated event ID (if processed) */
  eventId?: string;
  /** Status */
  status: 'pending' | 'processed' | 'expired';
  /** TTL expiry timestamp */
  expiresAt?: string;
}

/**
 * Deduplication check result
 */
export interface DeduplicationCheckResult {
  /** Whether this is a duplicate */
  isDuplicate: boolean;
  /** Entry if found */
  entry?: DeduplicationEntry;
  /** Time since first seen (ms) */
  timeSinceFirstSeen?: number;
  /** Recommendation */
  recommendation: 'process' | 'skip' | 'review';
  /** Reason */
  reason: string;
}

/**
 * Deduplication store interface
 */
export interface DeduplicationStore {
  /**
   * Check if an idempotency key exists
   */
  check(key: string): Promise<DeduplicationCheckResult>;
  
  /**
   * Record a new idempotency key
   */
  record(entry: Omit<DeduplicationEntry, 'firstSeenAt' | 'lastSeenAt' | 'occurrenceCount' | 'status'>): Promise<void>;
  
  /**
   * Update an existing entry
   */
  update(key: string, updates: Partial<DeduplicationEntry>): Promise<void>;
  
  /**
   * Mark entry as processed
   */
  markProcessed(key: string, eventId: string): Promise<void>;
  
  /**
   * Clean up expired entries
   */
  cleanupExpired(): Promise<number>;
  
  /**
   * Get entry by key
   */
  get(key: string): Promise<DeduplicationEntry | null>;
  
  /**
   * Get all entries for a source
   */
  getBySource(source: string, limit?: number): Promise<DeduplicationEntry[]>;
  
  /**
   * Clear all entries (for testing)
   */
  clear(): Promise<void>;
}

/**
 * Deduplication store configuration
 */
export interface DeduplicationStoreConfig {
  /** Storage backend */
  backend: 'memory' | 'sqlite' | 'redis';
  /** Connection string (for redis/sqlite) */
  connectionString?: string;
  /** Default TTL in seconds */
  defaultTtlSeconds: number;
  /** Cleanup interval in seconds */
  cleanupIntervalSeconds: number;
  /** Maximum entries to keep in memory */
  maxEntries?: number;
}

/**
 * Rate limit entry
 */
export interface RateLimitEntry {
  /** Key (e.g., source IP, webhook source) */
  key: string;
  /** Count of requests in current window */
  count: number;
  /** Window start timestamp */
  windowStart: string;
  /** Window end timestamp */
  windowEnd: string;
}

/**
 * Rate limit check result
 */
export interface RateLimitCheckResult {
  /** Whether request is allowed */
  allowed: boolean;
  /** Current count */
  count: number;
  /** Maximum allowed */
  max: number;
  /** Reset timestamp */
  resetAt: string;
  /** Retry after seconds */
  retryAfter?: number;
  /** Reason if blocked */
  reason?: string;
}

/**
 * Rate limiter interface
 */
export interface RateLimiter {
  /**
   * Check if request is allowed
   */
  check(key: string): Promise<RateLimitCheckResult>;
  
  /**
   * Record a request
   */
  record(key: string): Promise<void>;
  
  /**
   * Reset rate limit for a key
   */
  reset(key: string): Promise<void>;
  
  /**
   * Get current status for a key
   */
  getStatus(key: string): Promise<RateLimitCheckResult>;
}

/**
 * Rate limiter configuration
 */
export interface RateLimiterConfig {
  /** Maximum requests per window */
  maxRequests: number;
  /** Window size in milliseconds */
  windowMs: number;
  /** Storage backend */
  backend: 'memory' | 'redis';
  /** Connection string (for redis) */
  connectionString?: string;
}
