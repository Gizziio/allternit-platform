/**
 * NLP Module
 * GAP-79: NLP Entity Extraction
 * 
 * WIH: GAP-79, Owner: T3-A1
 * 
 * Provides Natural Language Processing capabilities:
 * - Named Entity Recognition (NER) for people, orgs, locations, concepts
 * - Entity relation extraction
 * - Sentiment analysis
 * - Key phrase extraction
 * 
 * Backends (all stubbed, enable via feature flags):
 * - rust-bert: Ready-to-use transformer models
 * - candle: Lightweight ML framework  
 * - remote: Hugging Face API or custom endpoint
 * - stub: Pattern-based extraction for testing
 * 
 * Coordinate with T3-A3 for claims graph entity format alignment.
 */

// Types
export type {
  Entity,
  EntityExtractor,
  EntityRelation,
  EntitySpan,
  EntityType,
  ExtractionResult,
  ExtractOptions,
  NerModelConfig,
  NlpConfig,
  NlpRequest,
  RemoteNlpConfig,
  RustBridgeConfig,
  BatchExtractionRequest,
  BatchExtractionResult,
} from './types.js';

// Entity extractor
export {
  createEntityExtractor,
} from './extractor.js';

// Rust bridge
export {
  RustBridge,
  createRustBridgeFromEnv,
  getGlobalBridge,
  spansToEntities,
  type BridgeStatus,
} from './rust_bridge.js';
