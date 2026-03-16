/**
 * Memory Agent Types
 * 
 * Core type definitions for the always-on memory agent system
 */

/**
 * Memory importance levels
 */
export type MemoryImportance = 'low' | 'medium' | 'high' | 'critical';

/**
 * Memory status in the consolidation pipeline
 */
export type MemoryStatus = 'raw' | 'processed' | 'consolidated' | 'archived';

/**
 * Supported file types for ingestion
 */
export type FileType = 
  | 'text'
  | 'image'
  | 'audio'
  | 'video'
  | 'pdf'
  | 'code'
  | 'document';

/**
 * File extension to file type mapping
 */
export const FILE_TYPE_MAP: Record<string, FileType> = {
  // Text files
  '.txt': 'text',
  '.md': 'text',
  '.json': 'text',
  '.csv': 'text',
  '.log': 'text',
  '.xml': 'text',
  '.yaml': 'text',
  '.yml': 'text',
  '.toml': 'text',
  '.ini': 'text',
  
  // Code files
  '.ts': 'code',
  '.tsx': 'code',
  '.js': 'code',
  '.jsx': 'code',
  '.py': 'code',
  '.go': 'code',
  '.rs': 'code',
  '.java': 'code',
  '.cpp': 'code',
  '.c': 'code',
  '.h': 'code',
  '.hpp': 'code',
  '.swift': 'code',
  '.kt': 'code',
  '.rb': 'code',
  '.php': 'code',
  '.sql': 'code',
  '.sh': 'code',
  '.bash': 'code',
  '.zsh': 'code',
  '.fish': 'code',
  
  // Images
  '.png': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.gif': 'image',
  '.webp': 'image',
  '.bmp': 'image',
  '.svg': 'image',
  '.ico': 'image',
  '.heic': 'image',
  '.heif': 'image',
  
  // Audio
  '.mp3': 'audio',
  '.wav': 'audio',
  '.ogg': 'audio',
  '.flac': 'audio',
  '.m4a': 'audio',
  '.aac': 'audio',
  '.opus': 'audio',
  
  // Video
  '.mp4': 'video',
  '.webm': 'video',
  '.mov': 'video',
  '.avi': 'video',
  '.mkv': 'video',
  '.wmv': 'video',
  
  // Documents
  '.pdf': 'pdf',
  '.doc': 'document',
  '.docx': 'document',
  '.xls': 'document',
  '.xlsx': 'document',
  '.ppt': 'document',
  '.pptx': 'document',
  '.rtf': 'document',
};

/**
 * A single memory unit stored in the system
 */
export interface Memory {
  id: string;
  content: string;
  summary: string;
  entities: string[];
  topics: string[];
  importance: MemoryImportance;
  status: MemoryStatus;
  source: string;
  sourceType: FileType;
  createdAt: string; // ISO-8601
  updatedAt: string; // ISO-8601
  consolidatedAt?: string; // ISO-8601
  metadata: Record<string, unknown>;
}

/**
 * Memory connection between two or more memories
 */
export interface MemoryConnection {
  id: string;
  memoryIds: string[];
  relationship: string;
  strength: number; // 0.0 - 1.0
  createdAt: string; // ISO-8601
}

/**
 * Consolidated insight derived from multiple memories
 */
export interface Insight {
  id: string;
  title: string;
  content: string;
  memoryIds: string[];
  topics: string[];
  confidence: number; // 0.0 - 1.0
  createdAt: string; // ISO-8601
  updatedAt: string; // ISO-8601
}

/**
 * Query result with synthesized answer
 */
export interface QueryResult {
  query: string;
  answer: string;
  memories: Memory[];
  insights: Insight[];
  sources: string[];
  confidence: number; // 0.0 - 1.0
  executionTimeMs: number;
}

/**
 * Ingestion request
 */
export interface IngestRequest {
  content?: string;
  filePath?: string;
  source?: string;
  metadata?: Record<string, unknown>;
  tenant_id?: string;
  session_id?: string;
}

/**
 * Query request
 */
export interface QueryRequest {
  question: string;
  max_results?: number;
  tenant_id?: string;
  session_id?: string;
}

/**
 * Ingestion result
 */
export interface IngestResult {
  success: boolean;
  memoryId?: string;
  error?: string;
}

/**
 * Consolidation configuration
 */
export interface ConsolidationConfig {
  intervalMinutes: number;
  minMemoriesForConsolidation: number;
  model: string;
}

/**
 * Agent configuration
 */
export interface MemoryAgentConfig {
  watchDirectory: string;
  databasePath: string;
  ollamaHost: string;
  ollamaPort: number;
  ingestModel: string;
  consolidateModel: string;
  queryModel: string;
  consolidationIntervalMinutes: number;
  httpPort?: number;
  enableHttpApi: boolean;
}

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: MemoryAgentConfig = {
  watchDirectory: './inbox',
  databasePath: './memory.db',
  ollamaHost: process.env.OLLAMA_HOST || 'localhost',  // Supports VPS via env var
  ollamaPort: parseInt(process.env.OLLAMA_PORT || '11434', 10),
  ingestModel: process.env.OLLAMA_INGEST_MODEL || 'qwen3.5:2b',      // Qwen 3.5 2B (fast, efficient)
  consolidateModel: process.env.OLLAMA_CONSOLIDATE_MODEL || 'qwen3.5:4b',  // Qwen 3.5 4B (better reasoning)
  queryModel: process.env.OLLAMA_QUERY_MODEL || 'qwen3.5:2b',        // Qwen 3.5 2B (balanced)
  consolidationIntervalMinutes: 30,
  enableHttpApi: false,
};

/**
 * File watch event
 */
export interface FileWatchEvent {
  type: 'add' | 'change' | 'unlink';
  path: string;
  timestamp: string;
}

/**
 * Agent health status
 */
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  ollamaConnected: boolean;
  databaseConnected: boolean;
  watcherActive: boolean;
  lastConsolidation?: string;
  memoryCount: number;
  insightCount: number;
  connectionCount: number;
}
