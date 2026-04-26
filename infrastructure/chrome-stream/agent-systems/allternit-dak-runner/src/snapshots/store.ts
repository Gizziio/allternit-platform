/**
 * Tool Snapshot Store
 * 
 * Provides content-addressed storage for tool execution snapshots,
 * enabling deterministic replay of web fetches, searches, etc.
 */

import { createHash } from 'crypto';
import { Snapshot, SnapshotMetadata, SnapshotQuery, SnapshotStoreConfig } from './types';

/**
 * Content-addressed snapshot store
 */
export class SnapshotStore {
  private config: SnapshotStoreConfig;
  private cache: Map<string, Snapshot> = new Map();
  private index: Map<string, Set<string>> = new Map(); // request_hash -> snapshot_hashes

  constructor(config: SnapshotStoreConfig) {
    this.config = {
      ...config,
      storage_dir: config.storage_dir || '.allternit/snapshots',
      max_snapshots: config.max_snapshots || 10000,
      compression: config.compression ?? true,
      ttl_seconds: config.ttl_seconds ?? 7 * 24 * 60 * 60
    };
  }

  /**
   * Initialize store
   */
  async initialize(): Promise<void> {
    const fs = await import('fs/promises');
    await fs.mkdir(this.config.storage_dir, { recursive: true });
    await this.loadIndex();
  }

  /**
   * Store a snapshot
   */
  async store(snapshot: Omit<Snapshot, 'snapshot_hash'>): Promise<Snapshot> {
    const contentHash = this.computeContentHash(snapshot.content);
    const requestHash = this.computeRequestHash(snapshot.metadata.request);
    
    const fullSnapshot: Snapshot = {
      ...snapshot,
      snapshot_hash: contentHash
    };

    if (this.cache.has(contentHash)) {
      return this.cache.get(contentHash)!;
    }

    this.cache.set(contentHash, fullSnapshot);
    
    if (!this.index.has(requestHash)) {
      this.index.set(requestHash, new Set());
    }
    this.index.get(requestHash)!.add(contentHash);

    await this.persistSnapshot(fullSnapshot);
    await this.persistIndex();
    await this.enforceRetentionPolicy();

    return fullSnapshot;
  }

  /**
   * Retrieve a snapshot by hash
   */
  async get(snapshotHash: string): Promise<Snapshot | null> {
    if (this.cache.has(snapshotHash)) {
      return this.cache.get(snapshotHash)!;
    }

    const snapshot = await this.loadSnapshotFromDisk(snapshotHash);
    if (snapshot) {
      this.cache.set(snapshotHash, snapshot);
    }
    return snapshot;
  }

  /**
   * Find snapshots by request
   */
  async findByRequest(request: Record<string, unknown>): Promise<Snapshot[]> {
    const requestHash = this.computeRequestHash(request);
    const snapshotHashes = this.index.get(requestHash);
    
    if (!snapshotHashes) {
      return [];
    }

    const snapshots: Snapshot[] = [];
    for (const hash of snapshotHashes) {
      const snapshot = await this.get(hash);
      if (snapshot) {
        snapshots.push(snapshot);
      }
    }

    return snapshots.sort((a, b) => 
      new Date(b.metadata.captured_at).getTime() - 
      new Date(a.metadata.captured_at).getTime()
    );
  }

  /**
   * Query snapshots with filters
   */
  async query(query: SnapshotQuery): Promise<Snapshot[]> {
    let results = Array.from(this.cache.values());

    if (query.tool_name) {
      results = results.filter(s => s.metadata.tool_name === query.tool_name);
    }

    if (query.session_id) {
      results = results.filter(s => s.metadata.session_id === query.session_id);
    }

    if (query.dag_id) {
      results = results.filter(s => s.metadata.dag_id === query.dag_id);
    }

    if (query.from_date) {
      const fromTime = new Date(query.from_date).getTime();
      results = results.filter(s => 
        new Date(s.metadata.captured_at).getTime() >= fromTime
      );
    }

    if (query.to_date) {
      const toTime = new Date(query.to_date).getTime();
      results = results.filter(s => 
        new Date(s.metadata.captured_at).getTime() <= toTime
      );
    }

    if (query.tags && query.tags.length > 0) {
      results = results.filter(s => 
        query.tags!.some(tag => s.metadata.tags?.includes(tag))
      );
    }

    const sortField = query.sort_by || 'captured_at';
    const sortDir = query.sort_direction || 'desc';
    
    results.sort((a, b) => {
      let aVal: unknown, bVal: unknown;
      
      if (sortField === 'captured_at') {
        aVal = new Date(a.metadata.captured_at).getTime();
        bVal = new Date(b.metadata.captured_at).getTime();
      } else {
        aVal = (a.metadata as Record<string, unknown>)[sortField];
        bVal = (b.metadata as Record<string, unknown>)[sortField];
      }

      if (sortDir === 'asc') {
        return aVal! < bVal! ? -1 : aVal! > bVal! ? 1 : 0;
      } else {
        return aVal! > bVal! ? -1 : aVal! < bVal! ? 1 : 0;
      }
    });

    if (query.limit) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  /**
   * Check if snapshot exists for request
   */
  async has(request: Record<string, unknown>): Promise<boolean> {
    const requestHash = this.computeRequestHash(request);
    return this.index.has(requestHash) && this.index.get(requestHash)!.size > 0;
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<{
    total_snapshots: number;
    total_size_bytes: number;
    unique_requests: number;
    oldest_snapshot?: string;
    newest_snapshot?: string;
  }> {
    const snapshots = Array.from(this.cache.values());
    
    let totalSize = 0;
    let oldest: Date | null = null;
    let newest: Date | null = null;

    for (const s of snapshots) {
      totalSize += s.content_size_bytes;
      const date = new Date(s.metadata.captured_at);
      
      if (!oldest || date < oldest) oldest = date;
      if (!newest || date > newest) newest = date;
    }

    return {
      total_snapshots: snapshots.length,
      total_size_bytes: totalSize,
      unique_requests: this.index.size,
      oldest_snapshot: oldest?.toISOString(),
      newest_snapshot: newest?.toISOString()
    };
  }

  private computeContentHash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  private computeRequestHash(request: Record<string, unknown>): string {
    const normalized = this.normalizeRequest(request);
    return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
  }

  private normalizeRequest(request: Record<string, unknown>): Record<string, unknown> {
    const normalized: Record<string, unknown> = {};
    const sortedKeys = Object.keys(request).sort();
    
    for (const key of sortedKeys) {
      if (['timestamp', 'nonce', 'request_id', 'correlation_id'].includes(key)) {
        continue;
      }
      
      const value = request[key];
      
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        normalized[key] = this.normalizeRequest(value as Record<string, unknown>);
      } else {
        normalized[key] = value;
      }
    }
    
    return normalized;
  }

  private async persistSnapshot(snapshot: Snapshot): Promise<void> {
    const fs = await import('fs/promises');
    const path = `${this.config.storage_dir}/${snapshot.snapshot_hash}.json`;
    await fs.writeFile(path, JSON.stringify(snapshot, null, 2));
  }

  private async loadSnapshotFromDisk(snapshotHash: string): Promise<Snapshot | null> {
    const fs = await import('fs/promises');
    const path = `${this.config.storage_dir}/${snapshotHash}.json`;
    
    try {
      const data = await fs.readFile(path, 'utf-8');
      return JSON.parse(data) as Snapshot;
    } catch {
      return null;
    }
  }

  private async persistIndex(): Promise<void> {
    const fs = await import('fs/promises');
    const path = `${this.config.storage_dir}/index.json`;
    
    const indexData: Record<string, string[]> = {};
    for (const [key, value] of this.index) {
      indexData[key] = Array.from(value);
    }
    
    await fs.writeFile(path, JSON.stringify(indexData, null, 2));
  }

  private async loadIndex(): Promise<void> {
    const fs = await import('fs/promises');
    const path = `${this.config.storage_dir}/index.json`;
    
    try {
      const data = await fs.readFile(path, 'utf-8');
      const indexData = JSON.parse(data) as Record<string, string[]>;
      
      this.index.clear();
      for (const [key, value] of Object.entries(indexData)) {
        this.index.set(key, new Set(value));
      }
    } catch {
      // Index doesn't exist yet
    }
  }

  private async enforceRetentionPolicy(): Promise<void> {
    if (this.cache.size > this.config.max_snapshots) {
      const sorted = Array.from(this.cache.entries())
        .sort((a, b) => 
          new Date(a[1].metadata.captured_at).getTime() - 
          new Date(b[1].metadata.captured_at).getTime()
        );
      
      const toDelete = sorted.slice(0, this.cache.size - this.config.max_snapshots);
      
      for (const [hash] of toDelete) {
        this.cache.delete(hash);
      }
    }
  }
}
