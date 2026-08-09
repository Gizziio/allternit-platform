/**
 * AllternitHarness Types
 * Core type definitions for the harness SDK
 */

import type { RetryOptions } from './retry.js';

/**
 * Supported execution modes for the harness
 */
export type HarnessMode = 'byok' | 'cloud' | 'local' | 'subprocess';

/**
 * BYOK (Bring Your Own Key) provider configuration
 */
export interface BYOKProviderConfig {
  apiKey: string;
  baseURL?: string;
}

/**
 * Cloud provider configuration
 */
export interface CloudConfig {
  baseURL: string;
  accessToken: string;
  refreshToken?: string;
}

/**
 * Local model configuration (e.g., Ollama)
 */
export interface LocalConfig {
  baseURL: string; // e.g., http://localhost:11434
}

/**
 * Subprocess configuration for custom model runners
 */
export interface SubprocessConfig {
  command: string;
  env?: Record<string, string>;
  cwd?: string;
}

/**
 * Main harness configuration
 */
export interface HarnessConfig {
  mode: HarnessMode;
  byok?: {
    anthropic?: BYOKProviderConfig;
    openai?: BYOKProviderConfig;
    google?: BYOKProviderConfig;
    kimi?: BYOKProviderConfig;
  };
  cloud?: CloudConfig;
  local?: LocalConfig;
  subprocess?: SubprocessConfig;
  /** Retry/backoff behavior for provider fetch calls. Omit to use defaults. */
  retry?: RetryOptions;
  /** Middleware hooks applied to every request/response. */
  middleware?: HarnessMiddleware | HarnessMiddleware[];
  /** Fallback models to try when a provider refuses or content-filters a request. */
  fallbackModels?: Array<{ provider: string; model: string }>;
}

/**
 * Message role types
 */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * Text content block
 */
export interface TextContentBlock {
  type: 'text';
  text: string;
}

/**
 * Search-result content block.
 */
export interface SearchResultBlock {
  type: 'search_result';
  title: string;
  url: string;
  content: string;
  score?: number;
}

/**
 * Vision content block — image input for vision-capable models
 */
export interface VisionContentBlock {
  type: 'vision';
  source:
    | { type: 'base64'; media_type: string; data: string }
    | { type: 'url'; url: string };
}

/**
 * Vision coordinates content block — model-returned pointing coordinates
 */
export interface VisionCoordinatesContentBlock {
  type: 'vision_coordinates';
  x: number;
  y: number;
}

/**
 * Union of content blocks that can appear in a message
 */
export type ContentBlock =
  | TextContentBlock
  | SearchResultBlock
  | VisionContentBlock
  | VisionCoordinatesContentBlock;

/**
 * Chat message structure
 */
export interface Message {
  role: MessageRole;
  content: string | ContentBlock[];
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  cache?: boolean;
  cache_control?: CacheControl;
}

export interface CacheControl {
  type: 'ephemeral';
  ttl?: '5m' | '1h';
}

export type ReasoningEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';

/** Normalized reason a model turn ended. */
export type HarnessStopReason =
  | 'end_turn'
  | 'max_tokens'
  | 'stop_sequence'
  | 'tool_use'
  | 'pause_turn'
  | 'refusal';

export interface ThinkingConfig {
  enabled?: boolean;
  budgetTokens?: number;
  effort?: ReasoningEffort;
}

export interface JsonSchemaResponseFormat {
  type: 'json_schema';
  schema: Record<string, unknown>;
  name?: string;
  description?: string;
  strict?: boolean;
}

/**
 * Tool parameter schema
 */
export interface ToolParameter {
  type: 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean' | 'null' | 'image' | string;
  description?: string;
  enum?: string[];
  properties?: Record<string, ToolParameter>;
  required?: string[];
  items?: ToolParameter;
}

/**
 * Tool definition
 */
export interface Tool {
  name: string;
  description: string;
  parameters: ToolParameter;
  strict?: boolean;
  cache?: boolean;
  cache_control?: CacheControl;
}

/**
 * Legacy OpenAI function-calling definition.
 */
export interface FunctionDefinition {
  name: string;
  description: string;
  parameters: ToolParameter;
}

/**
 * Tool call from assistant
 */
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * Stream request options
 */
export interface StreamRequest {
  provider: string;
  model: string;
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  tools?: Tool[];
  toolChoice?: 'auto' | 'none' | 'required' | { name: string };
  /** Legacy OpenAI function-calling format. When set, overrides `tools`. */
  functions?: FunctionDefinition[];
  parallelToolCalls?: boolean;
  reasoning?: ThinkingConfig;
  responseFormat?: JsonSchemaResponseFormat;
  systemCacheControl?: CacheControl;
  /** Ask providers that support source citations to include them. */
  citations?: boolean;
  stream?: boolean;
}

/** Provider-agnostic citation attached to generated text. */
export interface Citation {
  type: 'citation';
  citedText?: string;
  title?: string;
  url?: string;
  documentIndex?: number;
  startCharIndex?: number;
  endCharIndex?: number;
  providerData?: Record<string, unknown>;
}

export interface CitationChunk {
  type: 'citation';
  citation: Citation;
}

/**
 * Text content chunk
 */
export interface TextChunk {
  type: 'text';
  text: string;
}

/**
 * Anthropic thinking content delta
 */
export interface ThinkingDeltaChunk {
  type: 'thinking_delta';
  thinking: string;
}

/**
 * Anthropic signature delta for a thinking block
 */
export interface SignatureDeltaChunk {
  type: 'signature_delta';
  signature: string;
}

/**
 * Tool call chunk (streaming)
 */
export interface ToolCallChunk {
  type: 'tool_call';
  id: string;
  name: string;
  arguments: string; // Partial JSON string during streaming
}

/**
 * Tool call complete chunk
 */
export interface ToolCallCompleteChunk {
  type: 'tool_call_complete';
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * Tool result chunk
 */
export interface ToolResultChunk {
  type: 'tool_result';
  toolCallId: string;
  content: string;
}

/**
 * Error chunk
 */
export interface ErrorChunk {
  type: 'error';
  error: Error;
  code?: string;
}

/**
 * Stream complete chunk
 */
export interface DoneChunk {
  type: 'done';
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  stopReason?: HarnessStopReason;
}

/**
 * All possible harness stream chunk types
 */
export type HarnessStreamChunk =
  | TextChunk
  | ThinkingDeltaChunk
  | SignatureDeltaChunk
  | ToolCallChunk
  | ToolCallCompleteChunk
  | ToolResultChunk
  | CitationChunk
  | ErrorChunk
  | DoneChunk;

/**
 * Harness response (non-streaming)
 */
export interface HarnessResponse {
  content: string;
  toolCalls?: ToolCall[];
  citations?: Citation[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  stopReason?: HarnessStopReason;
}

/**
 * Provider-specific request transformation
 */
export interface ProviderRequestTransform {
  (request: StreamRequest): unknown;
}

/**
 * Provider-specific response transformation
 */
export interface ProviderResponseTransform {
  (response: unknown): HarnessStreamChunk;
}

/**
 * Context passed to middleware error handlers.
 */
export interface HarnessMiddlewareContext {
  /** Request as seen by the harness after beforeRequest hooks. */
  request: StreamRequest;
  /** Harness instance for middleware that needs to re-invoke streaming. */
  harness: { stream(request: StreamRequest): AsyncGenerator<HarnessStreamChunk> };
}

/**
 * Middleware hook system for the harness.
 *
 * Middleware runs on every request/response. The default harness configuration
 * always includes a retry middleware; callers may add custom middleware to
 * observe, mutate, or recover from failures.
 */
export interface HarnessMiddleware {
  /** Optional human-readable name for logging/debugging. */
  name?: string;
  /**
   * Transform the request before it is routed to the provider.
   * Called after request validation but before system/provider prompt injection.
   */
  beforeRequest?: (request: StreamRequest) => StreamRequest | Promise<StreamRequest>;
  /**
   * Transform the collected response before it is returned by run()/complete().
   * Not applied when consuming the raw stream() generator.
   */
  afterResponse?: (response: HarnessResponse) => HarnessResponse | Promise<HarnessResponse>;
  /**
   * Handle an error thrown during streaming.
   *
   * Returning/yielding an async generator substitutes a replacement stream.
   * Returning undefined passes control to the next onError hook. Throwing
   * propagates the thrown error.
   */
  onError?: (
    error: HarnessError,
    context: HarnessMiddlewareContext
  ) =>
    | AsyncGenerator<HarnessStreamChunk>
    | Promise<AsyncGenerator<HarnessStreamChunk>>
    | void
    | Promise<void>;
}

/**
 * Error codes for harness operations
 */
export enum HarnessErrorCode {
  CONFIG_INVALID = 'CONFIG_INVALID',
  MODE_UNSUPPORTED = 'MODE_UNSUPPORTED',
  PROVIDER_NOT_FOUND = 'PROVIDER_NOT_FOUND',
  API_ERROR = 'API_ERROR',
  RATE_LIMITED = 'RATE_LIMITED',
  TIMEOUT = 'TIMEOUT',
  STREAM_ERROR = 'STREAM_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Harness-specific error class
 */
export class HarnessError extends Error {
  public readonly code: HarnessErrorCode;
  public readonly cause?: unknown;

  constructor(code: HarnessErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'HarnessError';
    this.code = code;
    this.cause = cause;
  }
}
