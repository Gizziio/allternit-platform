/**
 * Provider Registry
 * Central registry for all AI providers with metadata and capabilities
 */

import { AllternitAI } from './anthropic/index.js';
import { AllternitOpenAI } from './openai/index.js';
import { AllternitGoogleAI } from './google/index.js';
import { AllternitOllama } from './ollama/index.js';
import { AllternitMistral } from './mistral/index.js';
import { AllternitCohere } from './cohere/index.js';
import { AllternitGroq } from './groq/index.js';
import { AllternitTogether } from './together/index.js';
import { AllternitAzureOpenAI } from './azure/index.js';
import { AllternitBedrock } from './bedrock/index.js';

export interface ProviderMetadata {
  name: string;
  displayName: string;
  description: string;
  features: ProviderFeature[];
  defaultModel: string;
  models: string[];
  requiresApiKey: boolean;
  supportsStreaming: boolean;
  supportsTools: boolean;
  supportsVision: boolean;
  configSchema?: Record<string, unknown>;
}

export type ProviderFeature = 
  | 'streaming'
  | 'tools'
  | 'vision'
  | 'json-mode'
  | 'function-calling'
  | 'system-prompt'
  | 'multi-modal'
  | 'fine-tuning';

export interface ProviderEntry {
  name: string;
  class: new (...args: unknown[]) => unknown;
  metadata: ProviderMetadata;
}

/**
 * Registry of all supported providers
 */
export const PROVIDER_REGISTRY: Map<string, ProviderEntry> = new Map([
  ['anthropic', {
    name: 'anthropic',
    class: AllternitAI,
    metadata: {
      name: 'anthropic',
      displayName: 'Anthropic Claude',
      description: 'Anthropic\'s Claude models with industry-leading context windows',
      features: ['streaming', 'tools', 'vision', 'json-mode', 'system-prompt', 'multi-modal'],
      defaultModel: 'claude-3-5-sonnet-20241022',
      models: [
        'claude-3-5-sonnet-20241022',
        'claude-3-5-haiku-20241022',
        'claude-3-opus-20240229',
        'claude-3-sonnet-20240229',
        'claude-3-haiku-20240307',
      ],
      requiresApiKey: true,
      supportsStreaming: true,
      supportsTools: true,
      supportsVision: true,
    },
  }],
  ['openai', {
    name: 'openai',
    class: AllternitOpenAI,
    metadata: {
      name: 'openai',
      displayName: 'OpenAI',
      description: 'OpenAI GPT models including GPT-4 and GPT-3.5',
      features: ['streaming', 'tools', 'vision', 'json-mode', 'function-calling', 'system-prompt', 'fine-tuning'],
      defaultModel: 'gpt-4o',
      models: [
        'gpt-4o',
        'gpt-4o-mini',
        'gpt-4-turbo',
        'gpt-4',
        'gpt-3.5-turbo',
      ],
      requiresApiKey: true,
      supportsStreaming: true,
      supportsTools: true,
      supportsVision: true,
    },
  }],
  ['google', {
    name: 'google',
    class: AllternitGoogleAI,
    metadata: {
      name: 'google',
      displayName: 'Google AI',
      description: 'Google Gemini models with native multi-modal capabilities',
      features: ['streaming', 'tools', 'vision', 'json-mode', 'function-calling', 'system-prompt', 'multi-modal'],
      defaultModel: 'gemini-1.5-pro',
      models: [
        'gemini-1.5-pro',
        'gemini-1.5-flash',
        'gemini-1.5-flash-8b',
        'gemini-1.0-pro',
      ],
      requiresApiKey: true,
      supportsStreaming: true,
      supportsTools: true,
      supportsVision: true,
    },
  }],
  ['ollama', {
    name: 'ollama',
    class: AllternitOllama,
    metadata: {
      name: 'ollama',
      displayName: 'Ollama',
      description: 'Local open-source models via Ollama',
      features: ['streaming', 'tools', 'system-prompt'],
      defaultModel: 'llama3.2',
      models: [
        'llama3.2',
        'llama3.1',
        'llama3',
        'mistral',
        'mixtral',
        'codellama',
        'phi4',
        'qwen2.5',
      ],
      requiresApiKey: false,
      supportsStreaming: true,
      supportsTools: true,
      supportsVision: false,
    },
  }],
  ['mistral', {
    name: 'mistral',
    class: AllternitMistral,
    metadata: {
      name: 'mistral',
      displayName: 'Mistral AI',
      description: 'Mistral AI models with high performance and efficiency',
      features: ['streaming', 'tools', 'json-mode', 'function-calling', 'system-prompt'],
      defaultModel: 'mistral-large-latest',
      models: [
        'mistral-large-latest',
        'mistral-small-latest',
        'codestral-latest',
        'pixtral-large-latest',
        'ministral-3b-latest',
        'ministral-8b-latest',
      ],
      requiresApiKey: true,
      supportsStreaming: true,
      supportsTools: true,
      supportsVision: false,
    },
  }],
  ['cohere', {
    name: 'cohere',
    class: AllternitCohere,
    metadata: {
      name: 'cohere',
      displayName: 'Cohere',
      description: 'Cohere Command models with enterprise capabilities',
      features: ['streaming', 'tools', 'json-mode', 'system-prompt'],
      defaultModel: 'command-r-plus',
      models: [
        'command-r-plus',
        'command-r',
        'command',
        'command-light',
      ],
      requiresApiKey: true,
      supportsStreaming: true,
      supportsTools: true,
      supportsVision: false,
    },
  }],
  ['groq', {
    name: 'groq',
    class: AllternitGroq,
    metadata: {
      name: 'groq',
      displayName: 'Groq',
      description: 'Ultra-fast inference with Groq LPU',
      features: ['streaming', 'tools', 'json-mode', 'function-calling', 'system-prompt'],
      defaultModel: 'llama-3.3-70b-versatile',
      models: [
        'llama-3.3-70b-versatile',
        'llama-3.1-8b-instant',
        'mixtral-8x7b-32768',
        'gemma2-9b-it',
      ],
      requiresApiKey: true,
      supportsStreaming: true,
      supportsTools: true,
      supportsVision: false,
    },
  }],
  ['together', {
    name: 'together',
    class: AllternitTogether,
    metadata: {
      name: 'together',
      displayName: 'Together AI',
      description: 'Open-source models hosted on Together AI',
      features: ['streaming', 'tools', 'json-mode', 'function-calling', 'system-prompt'],
      defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
      models: [
        'meta-llama/Llama-3.3-70B-Instruct-Turbo',
        'meta-llama/Llama-3.2-3B-Instruct-Turbo',
        'mistralai/Mixtral-8x7B-Instruct-v0.1',
        'Qwen/Qwen2.5-72B-Instruct-Turbo',
      ],
      requiresApiKey: true,
      supportsStreaming: true,
      supportsTools: true,
      supportsVision: false,
    },
  }],
  ['azure', {
    name: 'azure',
    class: AllternitAzureOpenAI,
    metadata: {
      name: 'azure',
      displayName: 'Azure OpenAI',
      description: 'Microsoft Azure OpenAI Service',
      features: ['streaming', 'tools', 'vision', 'json-mode', 'function-calling', 'system-prompt'],
      defaultModel: 'gpt-4o',
      models: [
        'gpt-4o',
        'gpt-4o-mini',
        'gpt-4-turbo',
        'gpt-4',
        'gpt-35-turbo',
      ],
      requiresApiKey: true,
      supportsStreaming: true,
      supportsTools: true,
      supportsVision: true,
    },
  }],
  ['bedrock', {
    name: 'bedrock',
    class: AllternitBedrock,
    metadata: {
      name: 'bedrock',
      displayName: 'AWS Bedrock',
      description: 'Amazon Bedrock managed foundation models',
      features: ['streaming', 'tools', 'vision', 'json-mode', 'function-calling', 'system-prompt'],
      defaultModel: 'claude-3-5-sonnet',
      models: [
        'claude-3-5-sonnet',
        'claude-3-haiku',
        'claude-3-opus',
        'claude-3-sonnet',
      ],
      requiresApiKey: true,
      supportsStreaming: true,
      supportsTools: true,
      supportsVision: true,
    },
  }],
]);

/**
 * Create a provider instance
 * @param name - Provider name
 * @param config - Provider configuration
 * @returns Provider instance
 */
export function createProvider(name: string, config: unknown): unknown {
  const entry = PROVIDER_REGISTRY.get(name.toLowerCase());
  if (!entry) {
    throw new Error(`Provider "${name}" not found. Available: ${listProviders().join(', ')}`);
  }
  return new entry.class(config);
}

/**
 * List all available provider names
 * @returns Array of provider names
 */
export function listProviders(): string[] {
  return Array.from(PROVIDER_REGISTRY.keys());
}

/**
 * Get provider metadata
 * @param name - Provider name
 * @returns Provider metadata or undefined if not found
 */
export function getProvider(name: string): ProviderMetadata | undefined {
  return PROVIDER_REGISTRY.get(name.toLowerCase())?.metadata;
}

/**
 * Find providers that support specific features
 * @param features - Features to filter by
 * @returns Array of provider metadata matching all features
 */
export function findProvidersByFeature(...features: ProviderFeature[]): ProviderMetadata[] {
  return Array.from(PROVIDER_REGISTRY.values())
    .filter(entry => features.every(f => entry.metadata.features.includes(f)))
    .map(entry => entry.metadata);
}

export default {
  PROVIDER_REGISTRY,
  createProvider,
  listProviders,
  getProvider,
  findProvidersByFeature,
};
