/**
 * Deduplication Store
 * 
 * In-memory store for tracking idempotency keys and detecting duplicates.
 * Production implementation would use Redis or SQLite.
 */

import type {
  DeduplicationStore,
  DeduplicationEntry,
  DeduplicationCheckResult,
  DeduplicationStoreConfig,
} from '../types/idempotency.types.js';

/**
 * In-memory deduplication store implementation
 */
export class MemoryDeduplicationStore implements DeduplicationStore {
  private store: Map<string, DeduplicationEntry>;
  private config: DeduplicationStoreConfig;
  private cleanupInterval?: NodeJS.Timeout;
  
  constructor(config: DeduplicationStoreConfig) {
    this.store = new Map();
    this.config = config;
    
    // Start cleanup if configured
    if (config.cleanupIntervalSeconds > 0) {
      this.startCleanup();
    }
  }
  
  /**
   * Check if an idempotency key exists
   */
  async check(key: string): Promise<DeduplicationCheckResult> {
    const entry = this.store.get(key);
    
    if (!entry) {
      return {
        isDuplicate: false,
        recommendation: 'process',
        reason: 'Key not found - first occurrence',
      };
    }
    
    // Check if expired
    if (entry.expiresAt && new Date(entry.expiresAt) < new Date()) {
      return {
        isDuplicate: false,
        entry,
        recommendation: 'process',
        reason: 'Key expired - safe to process',
      };
    }
    
    // Calculate time since first seen
    const firstSeen = new Date(entry.firstSeenAt).getTime();
    const now = Date.now();
    const timeSinceFirstSeen = now - firstSeen;
    
    // Determine recommendation based on status and timing
    let recommendation: 'process' | 'skip' | 'review' = 'skip';
    let reason = `Duplicate detected - first seen ${entry.firstSeenAt}`;
    
    if (entry.status === 'pending') {
      // Still being processed - might be a retry
      if (timeSinceFirstSeen < 30000) { // Less than 30 seconds
        recommendation = 'review';
        reason = 'Potentially in-flight request - review recommended';
      } else {
        recommendation = 'skip';
        reason = 'Duplicate of pending request - skip';
      }
    } else if (entry.status === 'processed') {
      recommendation = 'skip';
      reason = `Already processed at ${entry.lastSeenAt}`;
    } else if (entry.status === 'expired') {
      recommendation = 'process';
      reason = 'Entry expired - safe to process';
    }
    
    return {
      isDuplicate: entry.status !== 'expired',
      entry,
      timeSinceFirstSeen,
      recommendation,
      reason,
    };
  }
  
  /**
   * Record a new idempotency key
   */
  async record(
    entryData: Omit<
      DeduplicationEntry,
      'firstSeenAt' | 'lastSeenAt' | 'occurrenceCount' | 'status'
    >
  ): Promise<void> {
    const now = new Date().toISOString();
    const expiresAt = new Date(
      Date.now() + this.config.defaultTtlSeconds * 1000
    ).toISOString();
    
    const entry: DeduplicationEntry = {
      ...entryData,
      firstSeenAt: now,
      lastSeenAt: now,
      occurrenceCount: 1,
      status: 'pending',
      expiresAt,
    };
    
    this.store.set(entryData.idempotencyKey, entry);
  }
  
  /**
   * Update an existing entry
   */
  async update(key: string, updates: Partial<DeduplicationEntry>): Promise<void> {
    const entry = this.store.get(key);
    
    if (!entry) {
      throw new Error(`Idempotency key not found: ${key}`);
    }
    
    const updated: DeduplicationEntry = {
      ...entry,
      ...updates,
      lastSeenAt: new Date().toISOString(),
      occurrenceCount: entry.occurrenceCount + 1,
    };
    
    this.store.set(key, updated);
  }
  
  /**
   * Mark entry as processed
   */
  async markProcessed(key: string, eventId: string): Promise<void> {
    await this.update(key, {
      status: 'processed',
      eventId,
    });
  }
  
  /**
   * Clean up expired entries
   */
  async cleanupExpired(): Promise<number> {
    const now = new Date().getTime();
    let removed = 0;
    
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt && new Date(entry.expiresAt).getTime() < now) {
        this.store.delete(key);
        removed++;
      }
    }
    
    return removed;
  }
  
  /**
   * Get entry by key
   */
  async get(key: string): Promise<DeduplicationEntry | null> {
    const entry = this.store.get(key);
    
    if (!entry) {
      return null;
    }
    
    // Check if expired
    if (entry.expiresAt && new Date(entry.expiresAt) < new Date()) {
      return { ...entry, status: 'expired' };
    }
    
    return entry;
  }
  
  /**
   * Get all entries for a source
   */
  async getBySource(
    source: string,
    limit: number = 100
  ): Promise<DeduplicationEntry[]> {
    const entries: DeduplicationEntry[] = [];
    
    for (const entry of this.store.values()) {
      if (entry.source === source) {
        entries.push(entry);
        if (entries.length >= limit) {
          break;
        }
      }
    }
    
    return entries;
  }
  
  /**
   * Clear all entries (for testing)
   */
  async clear(): Promise<void> {
    this.store.clear();
  }
  
  /**
   * Get statistics
   */
  async getStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    bySource: Record<string, number>;
  }> {
    const stats = {
      total: this.store.size,
      byStatus: {} as Record<string, number>,
      bySource: {} as Record<string, number>,
    };
    
    for (const entry of this.store.values()) {
      stats.byStatus[entry.status] = (stats.byStatus[entry.status] || 0) + 1;
      stats.bySource[entry.source] = (stats.bySource[entry.source] || 0) + 1;
    }
    
    return stats;
  }
  
  /**
   * Start cleanup interval
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired().catch(console.error);
    }, this.config.cleanupIntervalSeconds * 1000);
    
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }
  
  /**
   * Stop the store
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }
}

/**
 * Create default in-memory deduplication store
 */
export function createDefaultDeduplicationStore(): MemoryDeduplicationStore {
  return new MemoryDeduplicationStore({
    backend: 'memory',
    defaultTtlSeconds: 3600, // 1 hour
    cleanupIntervalSeconds: 300, // 5 minutes
  });
}

/**
 * Create deduplication store based on config
 */
export function createDeduplicationStore(
  config: DeduplicationStoreConfig
): DeduplicationStore {
  switch (config.backend) {
    case 'memory':
      return new MemoryDeduplicationStore(config);
    
    case 'sqlite':
    case 'redis':
      throw new Error(
        `${config.backend} backend not yet implemented. Use 'memory' for now.`
      );
    
    default:
      throw new Error(`Unknown backend: ${(config as { backend: string }).backend}`);
  }
}
