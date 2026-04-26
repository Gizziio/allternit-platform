/**
 * @allternit/sdk - Allternit AI SDK
 * 
 * Unified SDK for AI interactions with 15+ providers and harness modes.
 * Includes official ACP (Agent Capability Protocol) support.
 * 
 * @example
 * ```typescript
 * import { AllternitHarness } from '@allternit/sdk';
 * 
 * const harness = new AllternitHarness({
 *   mode: 'byok',
 *   byok: { anthropic: { apiKey: process.env.ANTHROPIC_API_KEY } }
 * });
 * 
 * for await (const chunk of harness.stream({
 *   provider: 'anthropic',
 *   model: 'claude-3-haiku',
 *   messages: [{ role: 'user', content: 'Hello!' }]
 * })) {
 *   if (chunk.type === 'text') {
 *     process.stdout.write(chunk.text);
 *   }
 * }
 * ```
 * 
 * @see https://agentclientprotocol.com/ - Official ACP Specification
 */

// ============================================================================
// Core Harness
// ============================================================================

export { AllternitHarness } from './harness/index.js';
export type {
  HarnessConfig,
  StreamRequest,
  StreamResponse,
  HarnessStreamChunk,
  HarnessMode,
} from './harness/types.js';

// System prompts
export {
  ALLTERNIT_SYSTEM_PROMPT,
  TOOL_USE_PROMPT_ADDENDUM,
  injectSystemPrompt,
} from './harness/prompts.js';

// Harness modes
export {
  streamFromBYOK,
  streamFromCloud,
  streamFromLocal,
  streamFromSubprocess,
} from './harness/modes/index.js';

// ============================================================================
// Providers (15 Total)
// ============================================================================

// Anthropic (Claude)
export { AllternitAI } from './providers/anthropic/index.js';
export type { AllternitAI as default } from './providers/anthropic/index.js';

// OpenAI (GPT)
export { AllternitOpenAI } from './providers/openai/index.js';

// Google (Gemini)
export {
  AllternitGoogleAI,
  AllternitGenerativeModel,
  ChatSession,
} from './providers/google/index.js';

// Local (Ollama)
export { AllternitOllama } from './providers/ollama/index.js';

// Mistral
export { AllternitMistral } from './providers/mistral/index.js';

// Cohere
export { AllternitCohere } from './providers/cohere/index.js';

// Groq
export { AllternitGroq } from './providers/groq/index.js';

// Together AI
export { AllternitTogether } from './providers/together/index.js';

// Azure OpenAI
export { AllternitAzureOpenAI } from './providers/azure/index.js';

// AWS Bedrock
export { AllternitBedrock } from './providers/bedrock/index.js';

// Kimi (Moonshot AI)
export { AllternitKimi } from './providers/kimi/index.js';

// Qwen (Alibaba)
export { AllternitQwen } from './providers/qwen/index.js';

// MiniMax
export { AllternitMiniMax } from './providers/minimax/index.js';

// GLM / ChatGLM (Zhipu AI)
export { AllternitGLM, AllternitGLM as AllternitChatGLM } from './providers/glm/index.js';

// GitHub Copilot
export { AllternitCopilot, AllternitCopilot as AllternitGitHubCopilot } from './providers/copilot/index.js';

// ============================================================================
// Provider Registry
// ============================================================================

export {
  PROVIDER_REGISTRY,
  createProvider,
  listProviders,
  getProvider,
  findProvidersByFeature,
  hasProvider,
  getDefaultModel,
  isValidProvider,
  getProvidersByAuthType,
  type ProviderMetadata,
  type ProviderConfig,
} from './providers/registry.js';

// ============================================================================
// ACP (Agent Capability Protocol)
// ============================================================================

// Official ACP types from @agentclientprotocol/sdk
export type {
  // Core ACP types
  AgentCapabilities,
  ClientCapabilities,
  Session,
  SessionId,
  ToolCall,
  ToolCallContent,
  ToolCallStatus,
  Content,
  TextContent,
  ImageContent,
  AudioContent,
  StopReason,
  
  // Request/Response types
  InitializeRequest,
  InitializeResponse,
  AuthenticateRequest,
  AuthenticateResponse,
  NewSessionRequest,
  NewSessionResponse,
  LoadSessionRequest,
  LoadSessionResponse,
  PromptRequest,
  PromptResponse,
  
  // Permission types
  PermissionOption,
  RequestPermissionRequest,
  RequestPermissionResponse,
  
  // File system types
  FileSystemCapability,
  ReadTextFileRequest,
  ReadTextFileResponse,
  WriteTextFileRequest,
  WriteTextFileResponse,
  
  // Terminal types
  CreateTerminalRequest,
  CreateTerminalResponse,
  TerminalOutputRequest,
  TerminalOutputResponse,
  TerminalExitStatus,
  
  // Allternit ACP extensions
  AllternitACPSession,
  ACPRegistryEntry,
} from './acp/types.js';

// ACP Registry and Bridge
export {
  ACPRegistry,
  acpRegistry,
  type RegistryQuery,
} from './acp/registry.js';

export {
  ACPHarnessBridge,
  type BridgeOptions,
  type BridgeStreamChunk,
} from './acp/harness-bridge.js';

// ACP Validators
export {
  validateACPMessage,
  validateACPSession,
  validateACPRegistryEntry,
  assertValidACPMessage,
  assertValidACPSession,
  isSessionId,
  isContent,
  isToolCall,
  type ValidationResult,
} from './acp/validator.js';

// Re-export the official ACP SDK for advanced usage
export * as ACP from '@agentclientprotocol/sdk';

// ============================================================================
// HTTP Client (generated from OpenAPI spec)
// ============================================================================

// Re-export the generated HTTP client — this is what acp.ts and other consumers
// need for session management, globalEvents, prompt(), etc.
export { createAllternitClient, AllternitClient } from '../dist/gen/allternit-client.js';
export type { Event } from '../dist/gen/entity-types.js';

// ============================================================================
// Version
// ============================================================================

export const VERSION = '1.0.0';
export const SDK_NAME = '@allternit/sdk';
export const ACP_VERSION = '0.14.1'; // Matching @agentclientprotocol/sdk version
