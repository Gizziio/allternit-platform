/**
 * Snapshot types for tool execution replay
 */

/**
 * Tool execution snapshot
 */
export interface Snapshot {
  snapshot_hash: string; // content-addressed hash
  content: string; // serialized response content
  content_size_bytes: number;
  content_type: 'json' | 'xml' | 'html' | 'text' | 'binary';
  metadata: SnapshotMetadata;
}

/**
 * Snapshot metadata
 */
export interface SnapshotMetadata {
  // Identification
  snapshot_id: string;
  
  // Tool information
  tool_name: string;
  tool_version?: string;
  
  // Request details (for matching)
  request: Record<string, unknown>;
  request_hash: string;
  
  // Execution context
  session_id: string;
  dag_id?: string;
  node_id?: string;
  
  // Timing
  captured_at: string; // ISO 8601
  duration_ms: number; // original execution time
  
  // Content info
  encoding: 'utf-8' | 'base64' | 'gzip';
  
  // Original response metadata
  status_code?: number;
  headers?: Record<string, string>;
  
  // Tags for categorization
  tags?: string[];
  
  // Expiry
  expires_at?: string;
  
  // Provenance
  source?: 'live' | 'imported' | 'synthetic';
  original_url?: string; // for web fetches
  
  // Custom metadata
  [key: string]: unknown;
}

/**
 * Snapshot store configuration
 */
export interface SnapshotStoreConfig {
  storage_dir: string;
  max_snapshots: number;
  compression: boolean;
  ttl_seconds: number; // 0 = no expiry
}

/**
 * Snapshot query parameters
 */
export interface SnapshotQuery {
  tool_name?: string;
  session_id?: string;
  dag_id?: string;
  node_id?: string;
  tags?: string[];
  from_date?: string;
  to_date?: string;
  sort_by?: 'captured_at' | 'duration_ms' | 'content_size_bytes';
  sort_direction?: 'asc' | 'desc';
  limit?: number;
}

/**
 * Replay configuration
 */
export interface ReplayConfig {
  // Matching strategy
  match_strategy: 'exact' | 'fuzzy' | 'similarity';
  similarity_threshold?: number; // 0-1, for fuzzy matching
  
  // Time tolerance
  max_age_seconds?: number; // prefer snapshots within this age
  
  // Fallback behavior
  fallback_to_live: boolean;
  
  // Recording during replay
  record_on_miss: boolean;
  
  // Determinism
  deterministic_order: boolean; // sort results consistently
  
  // Transformations
  transform_response?: (content: string) => string;
}

/**
 * Replay result
 */
export interface ReplayResult {
  status: 'hit' | 'miss' | 'partial' | 'error';
  snapshot?: Snapshot;
  source: 'snapshot' | 'live' | 'fallback';
  
  // Matching info
  matched_request_hash?: string;
  similarity_score?: number;
  
  // Execution
  replayed_at: string;
  replay_duration_ms: number;
  
  // New snapshot (if recorded)
  new_snapshot?: Snapshot;
}

/**
 * Tool wrapper with snapshot capability
 */
export interface SnapshotToolWrapper {
  tool_name: string;
  original_execute: (request: unknown) => Promise<unknown>;
  replay_config: ReplayConfig;
}

/**
 * Snapshot import/export format
 */
export interface SnapshotBundle {
  version: 'v1';
  exported_at: string;
  snapshots: Snapshot[];
  metadata: {
    source_session?: string;
    description?: string;
    tags?: string[];
  };
}

/**
 * Snapshot statistics
 */
export interface SnapshotStats {
  total_snapshots: number;
  by_tool: Record<string, number>;
  by_content_type: Record<string, number>;
  total_size_bytes: number;
  hit_rate_24h: number;
  avg_replay_time_ms: number;
  oldest_snapshot_age_days: number;
}
