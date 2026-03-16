/**
 * Ars Contexta - Shared Types
 * 
 * GAP-78, GAP-79: Shared types for LLM integration and NLP
 * Coordinate with T3-A2 (6Rs pipeline) and T3-A3 (claims graph)
 * 
 * WIH: GAP-78, Owner: T3-A1
 */

// ============================================================================
// LLM Types (GAP-78)
// ============================================================================

/**
 * Supported LLM providers
 * Feature flags control which are available at compile time
 */
export type LlmProvider = 'openai' | 'anthropic' | 'local' | 'stub' | 'terminal';

/**
 * LLM configuration with PLACEHOLDER_APPROVED for secrets
 * NOTE: Actual secrets loaded from environment/config, not committed
 */
export interface LlmConfig {
  provider: LlmProvider;
  model: string;
  apiKey?: string; // Uses PLACEHOLDER_APPROVED pattern - actual key from env
  baseUrl?: string; // For local/self-hosted models
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  // Feature flags for optional providers
  features?: {
    enableOpenAi?: boolean;
    enableAnthropic?: boolean;
    enableLocal?: boolean;
  };
}

/**
 * LLM message for chat completions
 */
export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  name?: string;
}

/**
 * LLM request payload
 */
export interface LlmRequest {
  messages: LlmMessage[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  tools?: LlmTool[];
}

/**
 * Tool definition for function calling
 */
export interface LlmTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

/**
 * LLM response
 */
export interface LlmResponse {
  id: string;
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  finishReason: 'stop' | 'length' | 'tool_calls' | null;
  toolCalls?: LlmToolCall[];
}

/**
 * Tool call in response
 */
export interface LlmToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * Streaming chunk for SSE responses
 */
export interface LlmStreamChunk {
  id: string;
  delta: string;
  finishReason: 'stop' | 'length' | null;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
  };
}

// ============================================================================
// Insight Types (Shared with 6Rs Pipeline - T3-A2)
// ============================================================================

/**
 * Insight type - aligned with 6Rs pipeline
 */
export type InsightType = 'pattern' | 'contradiction' | 'gap' | 'opportunity' | 'claim' | 'entity_relation';

/**
 * Insight from content analysis
 * Used by both LLM insight generation and 6Rs pipeline
 */
export interface Insight {
  id: string;
  type: InsightType;
  description: string;
  confidence: number;
  relatedNotes: string[];
  source: 'llm' | 'nlp' | 'pattern' | 'claim';
  timestamp: string;
  metadata?: Record<string, unknown>;
}

/**
 * Insight generation request
 */
export interface InsightRequest {
  content: string;
  context?: string[];
  focusAreas?: string[];
  maxInsights?: number;
  minConfidence?: number;
}

/**
 * Insight generation result
 */
export interface InsightResult {
  insights: Insight[];
  summary: string;
  keyThemes: string[];
  suggestedLinks: string[];
}

// ============================================================================
// NLP Types (GAP-79)
// ============================================================================

/**
 * Entity types for NER
 */
export type EntityType = 
  | 'person' 
  | 'organization' 
  | 'location' 
  | 'concept'
  | 'product'
  | 'event'
  | 'date'
  | 'technology'
  | 'domain';

/**
 * Extracted entity
 * Aligned with claims graph format (T3-A3)
 */
export interface Entity {
  id: string;
  text: string;
  type: EntityType;
  startPos: number;
  endPos: number;
  confidence: number;
  normalizedForm?: string;
  metadata?: {
    wikiLink?: string;
    aliases?: string[];
    category?: string;
  };
}

/**
 * Relationship between entities
 */
export interface EntityRelation {
  source: string; // Entity ID
  target: string; // Entity ID
  relationType: string;
  confidence: number;
  evidence?: string;
}

/**
 * NLP extraction result
 * Shared format for NER output
 */
export interface ExtractionResult {
  entities: Entity[];
  relations: EntityRelation[];
  keyPhrases: string[];
  summary: string;
  sentiment?: {
    score: number; // -1 to 1
    label: 'negative' | 'neutral' | 'positive';
  };
  language: string;
  processingTimeMs: number;
}

/**
 * NLP processing request
 */
export interface NlpRequest {
  text: string;
  extractEntities?: boolean;
  extractRelations?: boolean;
  extractSentiment?: boolean;
  entityTypes?: EntityType[];
  context?: string;
}

/**
 * NLP configuration
 */
export interface NlpConfig {
  // Feature flags for NLP capabilities
  features: {
    enableRustBert: boolean;
    enableCandle: boolean;
    enableRemoteApi: boolean;
  };
  // Model settings
  models: {
    nerModel?: string;
    sentimentModel?: string;
    embeddingModel?: string;
  };
  // Remote API config (if enabled)
  remoteApi?: {
    provider: 'huggingface' | 'custom';
    apiKey?: string; // PLACEHOLDER_APPROVED
    endpoint?: string;
  };
  // Local model paths
  localPaths?: {
    modelDir: string;
    cacheDir: string;
  };
}

// ============================================================================
// Pipeline Integration Types
// ============================================================================

/**
 * Combined processing result for content ingestion
 * Integrates LLM insights + NLP entities for 6Rs pipeline
 */
export interface EnrichmentResult {
  sourceContent: string;
  insights: Insight[];
  entities: Entity[];
  relations: EntityRelation[];
  summary: string;
  keyThemes: string[];
  suggestedTags: string[];
  confidence: number;
  processingMetadata: {
    llmProvider?: LlmProvider;
    nlpEngine: 'rust-bert' | 'candle' | 'remote' | 'stub';
    processingTimeMs: number;
  };
}

/**
 * Content ingestion kernel input
 * Entry point for GAP-78/GAP-79 integration
 */
export interface ContentIngestionRequest {
  content: string;
  source?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
  options?: {
    generateInsights?: boolean;
    extractEntities?: boolean;
    useStreaming?: boolean;
  };
}
