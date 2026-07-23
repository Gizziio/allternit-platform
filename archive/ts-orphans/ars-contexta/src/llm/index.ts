/**
 * LLM Module
 * GAP-78: LLM Integration
 * 
 * WIH: GAP-78, Owner: T3-A1
 * 
 * Provides LLM client abstractions for multiple providers:
 * - OpenAI (stubbed, requires ENABLE_OPENAI)
 * - Anthropic (stubbed, requires ENABLE_ANTHROPIC)
 * - Local/Ollama (stubbed, requires ENABLE_LOCAL_LLM)
 * - Stub (always available for testing)
 * 
 * All API keys use PLACEHOLDER_APPROVED pattern - actual secrets from env.
 */

// Types
export type {
  LlmClient,
  LlmClientOptions,
  LlmConfig,
  LlmMessage,
  LlmProvider,
  LlmRequest,
  LlmResponse,
  LlmStreamChunk,
  LlmTool,
  LlmToolCall,
  ProviderCapabilities,
} from './types.js';

// Client factory
export {
  createLlmClient,
  createLlmClientFromEnv,
  getAvailableProviders,
  isProviderAvailable,
} from './client.js';

// Providers
export {
  OpenAiProvider,
  AnthropicProvider,
  LocalProvider,
  StubProvider,
} from './providers/index.js';

// Prompt templates
export {
  INSIGHT_SYSTEM_PROMPT,
  generateInsightPrompt,
  generateEntityExtractionPrompt,
  generateSummarizationPrompt,
  generateVerificationPrompt,
  generateLinkSuggestionPrompt,
  PromptTemplates,
  type PromptTemplateName,
} from './templates.js';

// Streaming
export {
  StreamAccumulator,
  processStreamWithInsights,
  parseSseStream,
  createMockStream,
  type StreamConfig,
} from './stream.js';

// Terminal Adapter (integration with brain server)
export {
  TerminalProviderAdapter,
  createTerminalAdapter,
  createLlmClientWithFallback,
  initTerminalModules,
  isTerminalContext,
} from './adapters/terminal-provider.js';
