/**
 * LLM Module Types
 * GAP-78: LLM Integration
 * 
 * WIH: GAP-78, Owner: T3-A1
 */

import type {
  LlmProvider,
  LlmConfig,
  LlmRequest,
  LlmResponse,
  LlmStreamChunk,
  Insight,
  InsightType,
  InsightRequest,
  InsightResult,
} from '../types.js';

export type {
  LlmProvider,
  LlmConfig,
  LlmMessage,
  LlmRequest,
  LlmResponse,
  LlmStreamChunk,
  LlmTool,
  LlmToolCall,
  Insight,
  InsightType,
  InsightRequest,
  InsightResult,
} from '../types.js';

/**
 * LLM client interface
 */
export interface LlmClient {
  readonly provider: string;
  readonly config: LlmConfig;

  /**
   * Send a completion request
   */
  complete(request: LlmRequest): Promise<LlmResponse>;

  /**
   * Stream completion responses
   */
  stream(request: LlmRequest): AsyncGenerator<LlmStreamChunk>;

  /**
   * Check if client is healthy
   */
  health(): Promise<boolean>;
}

/**
 * LLM client factory options
 */
export interface LlmClientOptions {
  provider: LlmProvider;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
}

/**
 * Provider capability flags
 */
export interface ProviderCapabilities {
  streaming: boolean;
  functionCalling: boolean;
  systemMessages: boolean;
  maxContextLength: number;
}
