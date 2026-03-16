/**
 * NLP Module Types
 * GAP-79: NLP Entity Extraction
 * 
 * WIH: GAP-79, Owner: T3-A1
 * 
 * Coordinate with T3-A3 for claims graph entity format alignment.
 */

export type {
  Entity,
  EntityType,
  EntityRelation,
  ExtractionResult,
  NlpRequest,
  NlpConfig,
} from '../types.js';

/**
 * Entity extractor interface
 */
export interface EntityExtractor {
  /**
   * Extract entities from text
   */
  extract(text: string, options?: ExtractOptions): Promise<ExtractionResult>;
  
  /**
   * Check if extractor is ready
   */
  isReady(): boolean;
  
  /**
   * Get supported entity types
   */
  supportedTypes(): EntityType[];
}

/**
 * Extraction options
 */
export interface ExtractOptions {
  /** Specific entity types to extract */
  entityTypes?: EntityType[];
  /** Extract relations between entities */
  extractRelations?: boolean;
  /** Extract sentiment */
  extractSentiment?: boolean;
  /** Minimum confidence threshold (0-1) */
  minConfidence?: number;
  /** Language hint (ISO 639-1) */
  language?: string;
}

/**
 * NER model configuration
 */
export interface NerModelConfig {
  /** Model name/path */
  model: string;
  /** Tokenizer path */
  tokenizer?: string;
  /** Max sequence length */
  maxLength?: number;
  /** Batch size for processing */
  batchSize?: number;
  /** Use GPU if available */
  useGpu?: boolean;
}

/**
 * Rust bridge configuration
 */
export interface RustBridgeConfig {
  /** Path to rust-bert native module */
  rustBertLib?: string;
  /** Path to candle native module */
  candleLib?: string;
  /** Model cache directory */
  modelCacheDir: string;
  /** Timeout for native calls (ms) */
  timeoutMs?: number;
}

/**
 * Remote NLP API configuration
 */
export interface RemoteNlpConfig {
  provider: 'huggingface' | 'custom';
  endpoint: string;
  apiKey?: string;
  model: string;
}

/**
 * Entity mention span
 */
export interface EntitySpan {
  text: string;
  start: number;
  end: number;
  label: string;
  score: number;
}

/**
 * Batch extraction request
 */
export interface BatchExtractionRequest {
  texts: string[];
  options?: ExtractOptions;
}

/**
 * Batch extraction result
 */
export interface BatchExtractionResult {
  results: ExtractionResult[];
  totalTimeMs: number;
  errors: Array<{ index: number; error: string }>;
}
