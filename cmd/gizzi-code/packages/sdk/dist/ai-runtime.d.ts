export { AllternitHarness } from './harness/index.js';
export type {
  HarnessConfig,
  StreamRequest,
  StreamResponse,
  HarnessStreamChunk,
  HarnessMode,
  Message,
} from './harness/types.js';
export {
  ALLTERNIT_SYSTEM_PROMPT,
  TOOL_USE_PROMPT_ADDENDUM,
  injectSystemPrompt,
} from './harness/prompts.js';
export { AllternitAgent, AgentRun } from './agent/index.js';
export { AgentStorage } from './agent/persistence/index.js';
export type {
  AgentProfile,
  AgentProfileCapability,
  AgentModelConfig,
  AgentToolPolicy,
  AgentArtifactPolicy,
  ReplyRequest,
  ReplyOutcome,
  AgentRunStatus,
  AgentOptions,
} from './agent/types.js';
export { ToolRegistry } from './ai-runtime/tools/registry.js';
export { NativeToolBelt } from './ai-runtime/tools/search.js';
export type {
  ToolDefinition,
  ToolRegistrySnapshot,
} from './ai-runtime/tools/types.js';
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
export {
  PROVIDER_REGISTRY,
  createProvider,
  listProviders,
  getProvider,
  findProvidersByFeature,
  type ProviderMetadata,
  type ProviderConfig,
} from './providers/registry.js';
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
  type ACPToolCall,
  type ACPToolResult,
  type ACPSessionStatus,
  type ACPSession,
  type ACPRegistryEntry,
} from './acp/schema.js';
export {
  validateACPMessage,
  validateACPSession,
  validateACPRegistryEntry,
} from './acp/validator.js';
export {
  ACPHarnessBridge,
} from './acp/harness-bridge.js';

export declare const VERSION: string;
