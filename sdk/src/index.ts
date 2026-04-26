// Core harness
export { AllternitHarness } from './harness/index.js';
export type { 
  HarnessConfig, 
  StreamRequest, 
  HarnessResponse,
  HarnessStreamChunk,
  HarnessMode,
} from './harness/types.js';

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
export { AllternitAzure } from './providers/azure/index.js';
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

// Version
export const VERSION = '1.0.0';
