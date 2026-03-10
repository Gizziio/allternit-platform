/**
 * Verification Store
 * 
 * Persistent storage for verification certificates and results.
 * Supports querying, statistics, and ground truth tracking.
 */

import { Log } from "@/shared/util/log";
import { Global } from "@/runtime/context/global";
import * as path from "path";
import * as fs from "fs/promises";
import { randomUUID } from "crypto";

import type {
  StoredVerification,
  VerificationQuery,
  VerificationStatistics,
  OrchestratedVerificationResult,
  VerificationCertificate,
  VerificationConfidence,
} from "../types";

// ============================================================================
// Storage Configuration
// ============================================================================

export interface StoreConfig {
  /** Base path for storage */
  basePath: string;
  
  /** Whether to compress stored data */
  compress: boolean;
  
  /** Maximum age for stored verifications (days) */
  retentionDays: number;
  
  /** Whether to enable query caching */
  enableCache: boolean;
  
  /** Cache TTL (ms) */
  cacheTtlMs: number;
}

// ============================================================================
// Main Store Class
// ============================================================================

export class VerificationStore {
  private static instance: VerificationStore;
  private config: StoreConfig;
  private cache: Map<string, { data: unknown; expires: number }> = new Map();
  private log = Log.create({ service: "verification.store" });
  private initialized = false;
  
  constructor(config?: Partial<StoreConfig>) {
    this.config = {
      basePath: config?.basePath || path.join(Global.Path.data, "verifications"),
      compress: config?.compress ?? false,
      retentionDays: config?.retentionDays || 90,
      enableCache: config?.enableCache ?? true,
      cacheTtlMs: config?.cacheTtlMs || 60000,
    };
  }
  
  static getInstance(config?: Partial<StoreConfig>): VerificationStore {
    if (!VerificationStore.instance) {
      VerificationStore.instance = new VerificationStore(config);
    }
    return VerificationStore.instance;
  }
  
  /**
   * Initialize storage
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      await fs.mkdir(this.config.basePath, { recursive: true });
      await fs.mkdir(path.join(this.config.basePath, "certificates"), { recursive: true });
      await fs.mkdir(path.join(this.config.basePath, "by-session"), { recursive: true });
      await fs.mkdir(path.join(this.config.basePath, "by-type"), { recursive: true });
      await fs.mkdir(path.join(this.config.basePath, "by-date"), { recursive: true });
      
      this.initialized = true;
      this.log.info("Verification store initialized", { path: this.config.basePath });
    } catch (error) {
      this.log.error("Failed to initialize store", { error });
      throw error;
    }
  }
  
  /**
   * Store a verification result
   */
  async store(verification: Omit<StoredVerification, "id">): Promise<string> {
    await this.initialize();
    
    const id = `vrf_${Date.now()}_${randomUUID().slice(0, 8)}`;
    const stored: StoredVerification = { ...verification, id };
    
    try {
      // Store main record
      const recordPath = path.join(
        this.config.basePath,
        "certificates",
        `${id}.json`
      );
      
      const data = JSON.stringify(stored, null, 2);
      await fs.writeFile(recordPath, data, "utf-8");
      
      // Create indexes
      await this.indexBySession(stored);
      await this.indexByType(stored);
      await this.indexByDate(stored);
      
      // Invalidate cache
      this.invalidateCache();
      
      this.log.debug("Stored verification", {
        id,
        sessionId: stored.sessionId,
        type: stored.type,
        passed: stored.result.passed,
      });
      
      return id;
    } catch (error) {
      this.log.error("Failed to store verification", { error, id });
      throw error;
    }
  }
  
  /**
   * Retrieve a verification by ID
   */
  async get(id: string): Promise<StoredVerification | null> {
    await this.initialize();
    
    // Check cache
    const cached = this.getFromCache<StoredVerification>(`get:${id}`);
    if (cached) return cached;
    
    try {
      const recordPath = path.join(
        this.config.basePath,
        "certificates",
        `${id}.json`
      );
      const content = await fs.readFile(recordPath, "utf-8");
      const verification = JSON.parse(content) as StoredVerification;
      
      // Cache result
      this.setCache(`get:${id}`, verification);
      
      return verification;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }
  
  /**
   * Query stored verifications
   */
  async query(query: VerificationQuery): Promise<StoredVerification[]> {
    await this.initialize();
    
    // Build cache key from query
    const cacheKey = `query:${JSON.stringify(query)}`;
    const cached = this.getFromCache<StoredVerification[]>(cacheKey);
    if (cached) return cached;
    
    try {
      let results = await this.loadAllVerifications();
      
      // Apply filters
      if (query.sessionId) {
        results = results.filter(v => v.sessionId === query.sessionId);
      }
      
      if (query.type) {
        results = results.filter(v => v.type === query.type);
      }
      
      if (query.passed !== undefined) {
        results = results.filter(v => v.result.passed === query.passed);
      }
      
      if (query.confidence) {
        results = results.filter(v => v.result.confidence === query.confidence);
      }
      
      if (query.tags && query.tags.length > 0) {
        results = results.filter(v => 
          query.tags!.some(tag => v.tags?.includes(tag))
        );
      }
      
      if (query.confirmed !== undefined) {
        results = results.filter(v => 
          query.confirmed ? v.confirmed !== undefined : v.confirmed === undefined
        );
      }
      
      if (query.since) {
        results = results.filter(v => new Date(v.timestamp) >= query.since!);
      }
      
      if (query.until) {
        results = results.filter(v => new Date(v.timestamp) <= query.until!);
      }
      
      if (query.search) {
        const search = query.search.toLowerCase();
        results = results.filter(v => 
          v.fullResult.reason.toLowerCase().includes(search) ||
          v.certificate?.task.description.toLowerCase().includes(search) ||
          v.tags?.some(t => t.toLowerCase().includes(search))
        );
      }
      
      // Sort
      const sortBy = query.sortBy || "timestamp";
      const sortOrder = query.sortOrder || "desc";
      
      results.sort((a, b) => {
        let comparison = 0;
        
        switch (sortBy) {
          case "timestamp":
            comparison = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
            break;
          case "confidence": {
            const confidenceOrder: Record<VerificationConfidence, number> = {
              high: 3,
              medium: 2,
              low: 1,
            };
            comparison = confidenceOrder[a.result.confidence] - confidenceOrder[b.result.confidence];
            break;
          }
          case "passed":
            comparison = (a.result.passed ? 1 : 0) - (b.result.passed ? 1 : 0);
            break;
        }
        
        return sortOrder === "asc" ? comparison : -comparison;
      });
      
      // Apply pagination
      const offset = query.offset || 0;
      const limit = query.limit || 100;
      const paginated = results.slice(offset, offset + limit);
      
      // Cache results
      this.setCache(cacheKey, paginated);
      
      return paginated;
    } catch (error) {
      this.log.error("Failed to query verifications", { error });
      return [];
    }
  }
  
  /**
   * Get statistics
   */
  async getStatistics(
    since?: Date,
    until?: Date
  ): Promise<VerificationStatistics> {
    await this.initialize();
    
    const cacheKey = `stats:${since?.toISOString() || "all"}:${until?.toISOString() || "all"}`;
    const cached = this.getFromCache<VerificationStatistics>(cacheKey);
    if (cached) return cached;
    
    const all = await this.query({
      since,
      until,
      limit: 10000,
    });
    
    const stats = this.calculateStatistics(all);
    
    this.setCache(cacheKey, stats);
    
    return stats;
  }
  
  /**
   * Confirm a verification result (ground truth)
   */
  async confirm(
    id: string,
    correct: boolean,
    confirmedBy: string,
    notes?: string
  ): Promise<void> {
    const verification = await this.get(id);
    if (!verification) {
      throw new Error(`Verification ${id} not found`);
    }
    
    verification.confirmed = {
      correct,
      confirmedAt: new Date().toISOString(),
      confirmedBy,
      notes,
    };
    
    await this.store(verification);
    this.invalidateCache();
    
    this.log.info("Verification confirmed", { id, correct, confirmedBy });
  }
  
  /**
   * Delete a verification
   */
  async delete(id: string): Promise<void> {
    await this.initialize();
    
    try {
      const recordPath = path.join(
        this.config.basePath,
        "certificates",
        `${id}.json`
      );
      await fs.unlink(recordPath);
      
      this.invalidateCache();
      
      this.log.debug("Deleted verification", { id });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }
  
  /**
   * Clean up old verifications
   */
  async cleanup(): Promise<number> {
    await this.initialize();
    
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.config.retentionDays);
    
    const all = await this.loadAllVerifications();
    let deleted = 0;
    
    for (const verification of all) {
      if (new Date(verification.timestamp) < cutoff) {
        await this.delete(verification.id);
        deleted++;
      }
    }
    
    this.log.info("Cleanup completed", { deleted, retentionDays: this.config.retentionDays });
    
    return deleted;
  }
  
  // ========================================================================
  // Private Methods
  // ========================================================================
  
  private async indexBySession(verification: StoredVerification): Promise<void> {
    const sessionDir = path.join(
      this.config.basePath,
      "by-session",
      verification.sessionId
    );
    await fs.mkdir(sessionDir, { recursive: true });
    
    const indexPath = path.join(sessionDir, "index.json");
    const index = await this.loadIndex(indexPath);
    
    if (!index.includes(verification.id)) {
      index.push(verification.id);
      await fs.writeFile(indexPath, JSON.stringify(index));
    }
  }
  
  private async indexByType(verification: StoredVerification): Promise<void> {
    const typeDir = path.join(
      this.config.basePath,
      "by-type",
      verification.type
    );
    await fs.mkdir(typeDir, { recursive: true });
    
    const indexPath = path.join(typeDir, "index.json");
    const index = await this.loadIndex(indexPath);
    
    if (!index.includes(verification.id)) {
      index.push(verification.id);
      await fs.writeFile(indexPath, JSON.stringify(index));
    }
  }
  
  private async indexByDate(verification: StoredVerification): Promise<void> {
    const date = new Date(verification.timestamp);
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    
    const dateDir = path.join(this.config.basePath, "by-date", dateKey);
    await fs.mkdir(dateDir, { recursive: true });
    
    const indexPath = path.join(dateDir, "index.json");
    const index = await this.loadIndex(indexPath);
    
    if (!index.includes(verification.id)) {
      index.push(verification.id);
      await fs.writeFile(indexPath, JSON.stringify(index));
    }
  }
  
  private async loadIndex(path: string): Promise<string[]> {
    try {
      const content = await fs.readFile(path, "utf-8");
      return JSON.parse(content);
    } catch {
      return [];
    }
  }
  
  private async loadAllVerifications(): Promise<StoredVerification[]> {
    const certificatesPath = path.join(this.config.basePath, "certificates");
    
    try {
      const files = await fs.readdir(certificatesPath);
      const verifications: StoredVerification[] = [];
      
      for (const file of files) {
        if (!file.endsWith(".json")) continue;
        
        try {
          const content = await fs.readFile(
            path.join(certificatesPath, file),
            "utf-8"
          );
          verifications.push(JSON.parse(content));
        } catch (error) {
          this.log.warn("Failed to load verification", { file, error });
        }
      }
      
      return verifications;
    } catch {
      return [];
    }
  }
  
  private calculateStatistics(verifications: StoredVerification[]): VerificationStatistics {
    const total = verifications.length;
    const passed = verifications.filter(v => v.result.passed).length;
    const failed = total - passed;
    
    const byConfidence = {
      high: verifications.filter(v => v.result.confidence === "high").length,
      medium: verifications.filter(v => v.result.confidence === "medium").length,
      low: verifications.filter(v => v.result.confidence === "low").length,
    };
    
    const byMethod: Record<string, number> = {};
    for (const v of verifications) {
      for (const method of v.result.methodsUsed) {
        byMethod[method] = (byMethod[method] || 0) + 1;
      }
    }
    
    const byType: Record<string, number> = {};
    for (const v of verifications) {
      byType[v.type] = (byType[v.type] || 0) + 1;
    }
    
    const confirmedCorrect = verifications.filter(v => v.confirmed?.correct === true).length;
    const confirmedIncorrect = verifications.filter(v => v.confirmed?.correct === false).length;
    const unconfirmed = total - confirmedCorrect - confirmedIncorrect;
    
    const durations = verifications
      .map(v => v.fullResult.timing.durationMs)
      .filter(d => d > 0);
    
    const avgDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;
    
    const sortedDurations = [...durations].sort((a, b) => a - b);
    const p95Index = Math.floor(sortedDurations.length * 0.95);
    
    return {
      counts: { total, passed, failed },
      byConfidence,
      byMethod,
      byType,
      confirmation: {
        confirmedCorrect,
        confirmedIncorrect,
        unconfirmed,
        accuracy: confirmedCorrect + confirmedIncorrect > 0
          ? confirmedCorrect / (confirmedCorrect + confirmedIncorrect)
          : undefined,
      },
      performance: {
        averageDurationMs: avgDuration,
        minDurationMs: sortedDurations[0] || 0,
        maxDurationMs: sortedDurations[sortedDurations.length - 1] || 0,
        p95DurationMs: sortedDurations[p95Index] || 0,
      },
    };
  }
  
  // ========================================================================
  // Cache Methods
  // ========================================================================
  
  private getFromCache<T>(key: string): T | undefined {
    if (!this.config.enableCache) return undefined;
    
    const cached = this.cache.get(key);
    if (!cached) return undefined;
    
    if (Date.now() > cached.expires) {
      this.cache.delete(key);
      return undefined;
    }
    
    return cached.data as T;
  }
  
  private setCache(key: string, data: unknown): void {
    if (!this.config.enableCache) return;
    
    this.cache.set(key, {
      data,
      expires: Date.now() + this.config.cacheTtlMs,
    });
  }
  
  private invalidateCache(): void {
    this.cache.clear();
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

export async function storeVerification(
  result: OrchestratedVerificationResult,
  sessionId: string,
  options?: {
    type?: StoredVerification["type"];
    tags?: string[];
  }
): Promise<string> {
  const store = VerificationStore.getInstance();
  
  const stored: Omit<StoredVerification, "id"> = {
    sessionId,
    timestamp: new Date().toISOString(),
    type: options?.type || "general",
    certificate: result.certificate,
    result: {
      passed: result.passed,
      confidence: result.confidence,
      methodsUsed: result.methodsUsed,
      consensus: result.consensus,
    },
    fullResult: result,
    tags: options?.tags,
  };
  
  return store.store(stored);
}

export async function getVerification(
  id: string
): Promise<StoredVerification | null> {
  return VerificationStore.getInstance().get(id);
}

export async function queryVerifications(
  query: VerificationQuery
): Promise<StoredVerification[]> {
  return VerificationStore.getInstance().query(query);
}

export async function getVerificationStatistics(
  since?: Date,
  until?: Date
): Promise<VerificationStatistics> {
  return VerificationStore.getInstance().getStatistics(since, until);
}

export async function confirmVerification(
  id: string,
  correct: boolean,
  confirmedBy: string,
  notes?: string
): Promise<void> {
  return VerificationStore.getInstance().confirm(id, correct, confirmedBy, notes);
}
