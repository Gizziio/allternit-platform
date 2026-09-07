// Core harness
export { AllternitHarness } from './harness/index.js';
export {
  createRetryMiddleware,
  createRefusalFallbackMiddleware,
} from './harness/middleware.js';
export { AllternitEmbeddings } from './embeddings.js';
export type { EmbeddingsCreateRequest, EmbeddingsResponse, Embedding } from './embeddings.js';
export type {
  HarnessConfig,
  StreamRequest,
  Message,
  HarnessResponse,
  HarnessStreamChunk,
  HarnessMode,
  Citation,
  HarnessMiddleware,
  HarnessMiddlewareContext,
} from './harness/types.js';

// Agent runtime
export {
  AllternitAgent,
  AgentRun,
} from './agents/index.js';
export type {
  AgentProfile,
  AgentProfileCapability,
  ReplyRequest,
  ReplyOutcome,
} from './agents/types.js';

// Tools
export { ToolRegistry } from './tools/registry.js';
export { NativeToolBelt } from './tools/search.js';
export { NativeWebTools } from './tools/web.js';
export { TextEditorTool } from './tools/text-editor.js';
export { BashTool } from './tools/bash.js';
export { CodeExecutionTool } from './tools/code-execution.js';
export { MemoryTool } from './tools/memory.js';
export { PdfTool } from './tools/pdf.js';
export { attachMcpServer } from './tools/mcp.js';
export { toStrictJsonSchema, validateJsonSchema } from './tools/schema.js';
export type {
  ToolDefinition,
  JsonSchema,
} from './tools/types.js';
export type { WebSearchMode, WebSearchProvider, WebSearchResult, WebToolOptions } from './tools/web.js';
export type { TextEditorCommand, TextEditorOptions } from './tools/text-editor.js';
export type { BashToolOptions, BashRunner, BashResult } from './tools/bash.js';
export type { CodeExecutionOptions, CodeExecutionRequest, CodeExecutionResult, CodeExecutionRunner, CodeExecutionArtifact } from './tools/code-execution.js';
export type { MemoryToolOptions, MemoryStore, MemoryValue, MemoryOperation } from './tools/memory.js';
export type { PdfToolOptions, PdfSource, PdfProcessResult, PdfHeading, PdfTable } from './tools/pdf.js';
export type {
  McpServerAttachment,
  McpToolDescriptor,
  McpServerConfig,
  McpStdioConfig,
  McpHttpConfig,
  McpDirectoryOptions,
  McpDirectoryEntry,
} from './tools/mcp.js';
export { createMcpServerAttachment, loadMcpServerDirectory, defaultMcpServerDirectoryPath } from './tools/mcp.js';
export { ProgrammaticToolExecutor, parseBridgeOutput, bridgeHelperCode } from './tools/programmatic-execution.js';
export type { ProgrammaticExecutionOptions } from './tools/programmatic-execution.js';
export { executeComposition, sequence, parallel, parallelWithConcurrency, condition, loop, toolCall } from './tools/composition.js';
export type { CompositionStep, CompositionContext, CompositionExecutionResult, SequenceStep, ParallelStep, ConditionStep, LoopStep, ToolCallStep } from './tools/composition.js';
export { createAdvisorTool, readRepoContext, advisorSkillManifest } from './skills/advisor.js';
export type { AdvisorOptions } from './skills/advisor.js';

// System prompts
export { 
  ALLTERNIT_SYSTEM_PROMPT,
  injectSystemPrompt,
} from './harness/prompts.js';

// Providers
export { AllternitAI } from './providers/anthropic/index.js';
export { AllternitOpenAI } from './providers/openai/index.js';
export { AllternitGoogleAI } from './providers/google/index.js';
export { AllternitOllama } from './providers/ollama/index.js';
export { AllternitMistral } from './providers/mistral/index.js';
export { AllternitCohere } from './providers/cohere/index.js';
export { AllternitGroq } from './providers/groq/index.js';
export { AllternitTogether } from './providers/together/index.js';
export { AllternitAzureOpenAI } from './providers/azure/index.js';
export { AllternitBedrock } from './providers/bedrock/index.js';

// Provider registry
export {
  PROVIDER_REGISTRY,
  createProvider,
  listProviders,
  getProvider,
  findProvidersByFeature,
  type ProviderMetadata,
  type ProviderFeature,
  type ProviderEntry,
} from './providers/registry.js';

// ACP (Agent Capability Protocol)
export {
  acpRegistry,
  ACPRegistry,
} from './acp/registry.js';
export {
  ACPMessageSchema,
  ACPToolSchema,
  ACPSessionSchema,
  ACPRegistryEntrySchema,
  type ACPMessage,
  type ACPTool,
  type ACPSession,
  type ACPRegistryEntry,
} from './acp/schema.js';
export {
  validateMessage,
  validateTool,
  validateSession,
  validateRegistryEntry,
} from './acp/validator.js';
export {
  ACPHarnessBridge,
} from './acp/harness-bridge.js';

// Plugins / Capability SDK
export { CapabilityBuilder, defineCapability } from './plugins/index.js';
export { CapabilityRegistry } from './plugins/index.js';
export type { CapabilityRegistryConfig } from './plugins/index.js';
export type {
  CapabilityKind,
  CapabilityPricing,
  CapabilityManifest,
  CapabilityAuthor,
  CapabilityPermission,
  CapabilityRegistration,
  CapabilityLifecycle,
  CapabilityContext,
  CapabilityPublishOptions,
  CapabilityPublishResult,
  CapabilitySearchOptions,
  CapabilitySearchResult,
} from './plugins/index.js';

// Runtime
export {
  RuntimeClient,
  RuntimeApiError,
  type RuntimeStatus,
  type RuntimeTransport,
  type DiscoveredCli,
  type RegisteredRuntime,
  type AgentTask,
  type TaskHandle,
  type AgentEvent,
  type ExecutionLog,
  type RuntimeClientOptions,
} from './runtime/index.js';

// Generated platform API client (js/script/build.ts emits it into dist/gen/, so
// this resolves to dist/gen/index.js in the committed dist build)
export { AllternitClient, createAllternitClient } from './gen/index.js';

// Version
export const VERSION = '1.0.0';
