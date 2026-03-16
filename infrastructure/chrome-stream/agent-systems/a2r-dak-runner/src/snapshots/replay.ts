/**
 * Snapshot Replay Engine
 * 
 * Handles deterministic replay of tool executions using snapshots.
 */

import { SnapshotStore } from './store';
import { Snapshot, ReplayConfig, ReplayResult, SnapshotQuery, SnapshotMetadata } from './types';

export const DEFAULT_REPLAY_CONFIG: ReplayConfig = {
  match_strategy: 'exact',
  fallback_to_live: true,
  record_on_miss: true,
  deterministic_order: true,
  max_age_seconds: 7 * 24 * 60 * 60
};

export class ReplayEngine {
  private store: SnapshotStore;
  private config: ReplayConfig;
  private stats = { hits: 0, misses: 0, errors: 0, total_replay_time: 0 };

  constructor(store: SnapshotStore, config?: Partial<ReplayConfig>) {
    this.store = store;
    this.config = { ...DEFAULT_REPLAY_CONFIG, ...config };
  }

  async execute<TRequest, TResponse>(
    toolName: string,
    request: TRequest,
    liveExecute: (req: TRequest) => Promise<TResponse>,
    context: { session_id: string; dag_id?: string; node_id?: string; }
  ): Promise<ReplayResult> {
    const startTime = Date.now();
    const requestObj = request as Record<string, unknown>;

    try {
      const match = await this.findMatch(toolName, requestObj);

      if (match) {
        this.stats.hits++;
        return {
          status: 'hit',
          snapshot: match,
          source: 'snapshot',
          matched_request_hash: match.metadata.request_hash,
          replayed_at: new Date().toISOString(),
          replay_duration_ms: Date.now() - startTime
        };
      }

      this.stats.misses++;

      if (!this.config.fallback_to_live) {
        return {
          status: 'miss',
          source: 'snapshot',
          replayed_at: new Date().toISOString(),
          replay_duration_ms: Date.now() - startTime
        };
      }

      const liveStart = Date.now();
      const response = await liveExecute(request);
      const liveDuration = Date.now() - liveStart;

      let newSnapshot: Snapshot | undefined;
      if (this.config.record_on_miss) {
        newSnapshot = await this.recordSnapshot(
          toolName, requestObj, response, liveDuration, context
        );
      }

      return {
        status: 'miss',
        source: 'live',
        replayed_at: new Date().toISOString(),
        replay_duration_ms: Date.now() - startTime,
        new_snapshot: newSnapshot
      };

    } catch (error) {
      this.stats.errors++;
      return {
        status: 'error',
        source: 'live',
        replayed_at: new Date().toISOString(),
        replay_duration_ms: Date.now() - startTime
      };
    }
  }

  private async findMatch(
    toolName: string,
    request: Record<string, unknown>
  ): Promise<Snapshot | null> {
    const query: SnapshotQuery = {
      tool_name: toolName,
      sort_by: 'captured_at',
      sort_direction: 'desc',
      limit: 10
    };

    if (this.config.max_age_seconds) {
      const cutoff = new Date(Date.now() - this.config.max_age_seconds * 1000);
      query.from_date = cutoff.toISOString();
    }

    const candidates = await this.store.query(query);

    switch (this.config.match_strategy) {
      case 'exact':
        return this.findExactMatch(request, candidates);
      case 'fuzzy':
        return this.findFuzzyMatch(request, candidates);
      case 'similarity':
        return this.findSimilarityMatch(request, candidates);
      default:
        return this.findExactMatch(request, candidates);
    }
  }

  private findExactMatch(
    request: Record<string, unknown>,
    candidates: Snapshot[]
  ): Snapshot | null {
    const normalizedRequest = this.normalizeRequest(request);
    const normalizedJson = JSON.stringify(normalizedRequest);

    for (const candidate of candidates) {
      const candidateNormalized = this.normalizeRequest(candidate.metadata.request);
      if (JSON.stringify(candidateNormalized) === normalizedJson) {
        return candidate;
      }
    }
    return null;
  }

  private findFuzzyMatch(
    request: Record<string, unknown>,
    candidates: Snapshot[]
  ): Snapshot | null {
    const normalizedRequest = this.normalizeRequest(request, true);
    const normalizedJson = JSON.stringify(normalizedRequest);

    for (const candidate of candidates) {
      const candidateNormalized = this.normalizeRequest(candidate.metadata.request, true);
      if (JSON.stringify(candidateNormalized) === normalizedJson) {
        return candidate;
      }
    }
    return null;
  }

  private findSimilarityMatch(
    request: Record<string, unknown>,
    candidates: Snapshot[]
  ): Snapshot | null {
    const threshold = this.config.similarity_threshold || 0.95;
    let bestMatch: Snapshot | null = null;
    let bestScore = 0;

    for (const candidate of candidates) {
      const score = this.calculateSimilarity(request, candidate.metadata.request);
      if (score > bestScore && score >= threshold) {
        bestScore = score;
        bestMatch = candidate;
      }
    }
    return bestMatch;
  }

  private calculateSimilarity(
    a: Record<string, unknown>,
    b: Record<string, unknown>
  ): number {
    const keysA = Object.keys(a).sort();
    const keysB = Object.keys(b).sort();
    const intersection = keysA.filter(k => keysB.includes(k));
    const union = [...new Set([...keysA, ...keysB])];
    const keySimilarity = intersection.length / union.length;

    let valueMatches = 0;
    let valueTotal = 0;

    for (const key of intersection) {
      valueTotal++;
      if (JSON.stringify(a[key]) === JSON.stringify(b[key])) {
        valueMatches++;
      }
    }

    const valueSimilarity = valueTotal > 0 ? valueMatches / valueTotal : 0;
    return (keySimilarity * 0.3) + (valueSimilarity * 0.7);
  }

  private async recordSnapshot(
    toolName: string,
    request: Record<string, unknown>,
    response: unknown,
    durationMs: number,
    context: { session_id: string; dag_id?: string; node_id?: string; }
  ): Promise<Snapshot> {
    let content: string;
    let contentType: Snapshot['content_type'] = 'json';

    if (typeof response === 'string') {
      content = response;
      contentType = this.detectContentType(response);
    } else {
      content = JSON.stringify(response);
      contentType = 'json';
    }

    const metadata: SnapshotMetadata = {
      snapshot_id: `snap-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      tool_name: toolName,
      request,
      request_hash: '',
      session_id: context.session_id,
      dag_id: context.dag_id,
      node_id: context.node_id,
      captured_at: new Date().toISOString(),
      duration_ms: durationMs,
      encoding: 'utf-8',
      source: 'live'
    };

    return this.store.store({ content, content_size_bytes: Buffer.byteLength(content, 'utf-8'), content_type: contentType, metadata });
  }

  private normalizeRequest(
    request: Record<string, unknown>,
    fuzzy = false
  ): Record<string, unknown> {
    const normalized: Record<string, unknown> = {};
    const alwaysExclude = ['timestamp', 'nonce', 'request_id', 'correlation_id'];
    const fuzzyExclude = ['cache_control', 'retry_count', 'timeout_ms'];
    const exclude = fuzzy ? [...alwaysExclude, ...fuzzyExclude] : alwaysExclude;

    const sortedKeys = Object.keys(request).sort();
    
    for (const key of sortedKeys) {
      if (exclude.includes(key)) continue;
      const value = request[key];
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        normalized[key] = this.normalizeRequest(value as Record<string, unknown>, fuzzy);
      } else {
        normalized[key] = value;
      }
    }
    return normalized;
  }

  private detectContentType(content: string): Snapshot['content_type'] {
    const trimmed = content.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try { JSON.parse(trimmed); return 'json'; } catch { /* not json */ }
    }
    if (trimmed.startsWith('<?xml') || trimmed.startsWith('<')) return 'xml';
    if (trimmed.startsWith('<!DOCTYPE html') || trimmed.includes('<html')) return 'html';
    return 'text';
  }

  getStats() {
    const total = this.stats.hits + this.stats.misses + this.stats.errors;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      errors: this.stats.errors,
      hit_rate: total > 0 ? this.stats.hits / total : 0,
      total_replay_time: this.stats.total_replay_time,
      avg_replay_time: total > 0 ? this.stats.total_replay_time / total : 0
    };
  }
}

export function withSnapshots<TRequest, TResponse>(
  toolName: string,
  liveExecute: (req: TRequest) => Promise<TResponse>,
  store: SnapshotStore,
  config?: Partial<ReplayConfig>
): (req: TRequest, context: { session_id: string; dag_id?: string; node_id?: string; }) => Promise<TResponse> {
  const engine = new ReplayEngine(store, config);
  return async (request, context) => {
    const result = await engine.execute(toolName, request, liveExecute, context);
    if (result.snapshot) {
      if (result.snapshot.content_type === 'json') {
        return JSON.parse(result.snapshot.content) as TResponse;
      }
      return result.snapshot.content as unknown as TResponse;
    }
    throw new Error('No snapshot found and fallback disabled');
  };
}
