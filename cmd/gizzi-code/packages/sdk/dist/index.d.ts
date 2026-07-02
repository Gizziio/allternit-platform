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
export { AllternitHarness } from './harness/index.js';
export type { HarnessConfig, StreamRequest, StreamResponse, HarnessStreamChunk, HarnessMode, } from './harness/types.js';
export { ALLTERNIT_SYSTEM_PROMPT, TOOL_USE_PROMPT_ADDENDUM, injectSystemPrompt, } from './harness/prompts.js';
export { streamFromBYOK, streamFromCloud, streamFromLocal, streamFromSubprocess, } from './harness/modes/index.js';
export { AllternitAI } from './providers/anthropic/index.js';
export type { AllternitAI as default } from './providers/anthropic/index.js';
export { AllternitOpenAI } from './providers/openai/index.js';
export { AllternitGoogleAI, AllternitGenerativeModel, ChatSession, } from './providers/google/index.js';
export { AllternitOllama } from './providers/ollama/index.js';
export { AllternitMistral } from './providers/mistral/index.js';
export { AllternitCohere } from './providers/cohere/index.js';
export { AllternitGroq } from './providers/groq/index.js';
export { AllternitTogether } from './providers/together/index.js';
export { AllternitAzureOpenAI } from './providers/azure/index.js';
export { AllternitBedrock } from './providers/bedrock/index.js';
export { AllternitKimi } from './providers/kimi/index.js';
export { AllternitQwen } from './providers/qwen/index.js';
export { AllternitMiniMax } from './providers/minimax/index.js';
export { AllternitGLM, AllternitGLM as AllternitChatGLM } from './providers/glm/index.js';
export { AllternitCopilot, AllternitCopilot as AllternitGitHubCopilot } from './providers/copilot/index.js';
export { PROVIDER_REGISTRY, createProvider, listProviders, getProvider, findProvidersByFeature, hasProvider, getDefaultModel, isValidProvider, getProvidersByAuthType, type ProviderMetadata, type ProviderConfig, } from './providers/registry.js';
export type { AgentCapabilities, ClientCapabilities, SessionId, ToolCall, ToolCallContent, ToolCallStatus, Content, TextContent, ImageContent, AudioContent, StopReason, InitializeRequest, InitializeResponse, AuthenticateRequest, AuthenticateResponse, NewSessionRequest, NewSessionResponse, LoadSessionRequest, LoadSessionResponse, PromptRequest, PromptResponse, PermissionOption, RequestPermissionRequest, RequestPermissionResponse, FileSystemCapability, ReadTextFileRequest, ReadTextFileResponse, WriteTextFileRequest, WriteTextFileResponse, CreateTerminalRequest, CreateTerminalResponse, TerminalOutputRequest, TerminalOutputResponse, TerminalExitStatus, AllternitACPSession, ACPRegistryEntry, } from './acp/types.js';
export { ACPRegistry, acpRegistry, type RegistryQuery, } from './acp/registry.js';
export { ACPHarnessBridge, type BridgeOptions, type BridgeStreamChunk, } from './acp/harness-bridge.js';
export { validateACPMessage, validateACPSession, validateACPRegistryEntry, assertValidACPMessage, assertValidACPSession, isSessionId, isContent, isToolCall, } from './acp/validator.js';
export type { ValidationResult } from './acp/types.js';
export * as ACP from '@agentclientprotocol/sdk';
export { createAllternitClient, AllternitClient } from '../dist/gen/allternit-client.js';
export type { Event } from '../dist/gen/entity-types.js';
export declare const VERSION = "1.0.0";
export declare const SDK_NAME = "@allternit/sdk";
export declare const ACP_VERSION = "0.14.1";
//# sourceMappingURL=index.d.ts.map