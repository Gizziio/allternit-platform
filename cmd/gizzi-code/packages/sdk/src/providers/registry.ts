/**
 * Allternit Provider Registry
 * 
 * Central registry for AI providers with metadata and factory functions.
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
import { AllternitKimi } from './kimi/index.js';
import { AllternitQwen } from './qwen/index.js';
import { AllternitMiniMax } from './minimax/index.js';
import { AllternitGLM } from './glm/index.js';
import { AllternitCopilot } from './copilot/index.js';

export interface ProviderMetadata {
  id: string;
  name: string;
  description: string;
  website: string;
  authType: 'api_key' | 'oauth' | 'aws' | 'azure' | 'token' | 'none';
  features: {
    streaming: boolean;
    tools: boolean;
    vision: boolean;
    jsonMode: boolean;
    functionCalling: boolean;
  };
  defaultModels: string[];
  maxContextWindow?: number;
}

export interface ProviderConfig {
  apiKey?: string;
  token?: string;
  baseURL?: string;
  resourceName?: string;
  deploymentName?: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  groupId?: string;
  [key: string]: any;
}

// Provider metadata registry - 15 providers total
export const PROVIDER_REGISTRY: Record<string, ProviderMetadata> = {
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude AI models by Anthropic',
    website: 'https://anthropic.com',
    authType: 'api_key',
    features: {
      streaming: true,
      tools: true,
      vision: true,
      jsonMode: true,
      functionCalling: true,
    },
    defaultModels: [
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
      'claude-3-5-sonnet-20240620',
    ],
    maxContextWindow: 200000,
  },
  
  openai: {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT models by OpenAI',
    website: 'https://openai.com',
    authType: 'api_key',
    features: {
      streaming: true,
      tools: true,
      vision: true,
      jsonMode: true,
      functionCalling: true,
    },
    defaultModels: [
      'gpt-4o',
      'gpt-4-turbo',
      'gpt-4',
      'gpt-3.5-turbo',
    ],
    maxContextWindow: 128000,
  },
  
  google: {
    id: 'google',
    name: 'Google AI',
    description: 'Gemini models by Google',
    website: 'https://ai.google.dev',
    authType: 'api_key',
    features: {
      streaming: true,
      tools: true,
      vision: true,
      jsonMode: false,
      functionCalling: true,
    },
    defaultModels: [
      'gemini-1.5-pro',
      'gemini-1.5-flash',
      'gemini-1.0-pro',
    ],
    maxContextWindow: 1000000,
  },
  
  ollama: {
    id: 'ollama',
    name: 'Ollama',
    description: 'Local LLM server',
    website: 'https://ollama.com',
    authType: 'none',
    features: {
      streaming: true,
      tools: false,
      vision: false,
      jsonMode: false,
      functionCalling: false,
    },
    defaultModels: [
      'llama2',
      'codellama',
      'mistral',
      'mixtral',
    ],
    maxContextWindow: 32768,
  },
  
  mistral: {
    id: 'mistral',
    name: 'Mistral AI',
    description: 'Mistral language models',
    website: 'https://mistral.ai',
    authType: 'api_key',
    features: {
      streaming: true,
      tools: true,
      vision: false,
      jsonMode: true,
      functionCalling: true,
    },
    defaultModels: [
      'mistral-large-latest',
      'mistral-medium-latest',
      'mistral-small-latest',
      'mistral-tiny',
    ],
    maxContextWindow: 32000,
  },
  
  cohere: {
    id: 'cohere',
    name: 'Cohere',
    description: 'Command models by Cohere',
    website: 'https://cohere.com',
    authType: 'api_key',
    features: {
      streaming: true,
      tools: true,
      vision: false,
      jsonMode: false,
      functionCalling: false,
    },
    defaultModels: [
      'command',
      'command-light',
      'command-r',
      'command-r-plus',
    ],
    maxContextWindow: 128000,
  },
  
  groq: {
    id: 'groq',
    name: 'Groq',
    description: 'Fast inference for open models',
    website: 'https://groq.com',
    authType: 'api_key',
    features: {
      streaming: true,
      tools: true,
      vision: false,
      jsonMode: true,
      functionCalling: true,
    },
    defaultModels: [
      'llama-3.1-70b-versatile',
      'llama-3.1-8b-instant',
      'llama3-70b-8192',
      'mixtral-8x7b-32768',
    ],
    maxContextWindow: 32768,
  },
  
  together: {
    id: 'together',
    name: 'Together AI',
    description: 'Inference for open source models',
    website: 'https://together.xyz',
    authType: 'api_key',
    features: {
      streaming: true,
      tools: false,
      vision: false,
      jsonMode: false,
      functionCalling: false,
    },
    defaultModels: [
      'togethercomputer/llama-2-70b-chat',
      'togethercomputer/mixtral-8x7b',
      'Qwen/Qwen1.5-72B-Chat',
    ],
    maxContextWindow: 32768,
  },
  
  azure: {
    id: 'azure',
    name: 'Azure OpenAI',
    description: 'OpenAI models on Azure',
    website: 'https://azure.microsoft.com',
    authType: 'azure',
    features: {
      streaming: true,
      tools: true,
      vision: true,
      jsonMode: true,
      functionCalling: true,
    },
    defaultModels: [
      'gpt-4',
      'gpt-4-turbo',
      'gpt-35-turbo',
    ],
    maxContextWindow: 128000,
  },
  
  bedrock: {
    id: 'bedrock',
    name: 'AWS Bedrock',
    description: 'Foundation models on AWS',
    website: 'https://aws.amazon.com/bedrock',
    authType: 'aws',
    features: {
      streaming: true,
      tools: true,
      vision: false,
      jsonMode: false,
      functionCalling: true,
    },
    defaultModels: [
      'anthropic.claude-3-sonnet',
      'anthropic.claude-3-haiku',
      'meta.llama3-70b',
      'mistral.mistral-large',
    ],
    maxContextWindow: 200000,
  },

  // New Chinese/Global providers
  kimi: {
    id: 'kimi',
    name: 'Kimi (Moonshot AI)',
    description: 'Moonshot AI\'s Kimi assistant',
    website: 'https://www.moonshot.cn',
    authType: 'api_key',
    features: {
      streaming: true,
      tools: true,
      vision: false,
      jsonMode: true,
      functionCalling: true,
    },
    defaultModels: [
      'moonshot-v1-8k',
      'moonshot-v1-32k',
      'moonshot-v1-128k',
    ],
    maxContextWindow: 128000,
  },

  qwen: {
    id: 'qwen',
    name: 'Qwen (Alibaba)',
    description: 'Alibaba Cloud\'s Qwen models',
    website: 'https://qwen.aliyun.com',
    authType: 'api_key',
    features: {
      streaming: true,
      tools: true,
      vision: true,
      jsonMode: false,
      functionCalling: true,
    },
    defaultModels: [
      'qwen-max',
      'qwen-plus',
      'qwen-turbo',
      'qwen-vl-plus',
    ],
    maxContextWindow: 32000,
  },

  minimax: {
    id: 'minimax',
    name: 'MiniMax',
    description: 'MiniMax AI models',
    website: 'https://www.minimaxi.com',
    authType: 'api_key',
    features: {
      streaming: true,
      tools: false,
      vision: false,
      jsonMode: false,
      functionCalling: false,
    },
    defaultModels: [
      'abab5.5-chat',
      'abab5.5s-chat',
      'abab6-chat',
      'abab6.5-chat',
    ],
    maxContextWindow: 32000,
  },

  glm: {
    id: 'glm',
    name: 'ChatGLM (Zhipu AI)',
    description: 'Zhipu AI\'s ChatGLM models',
    website: 'https://www.zhipuai.cn',
    authType: 'api_key',
    features: {
      streaming: true,
      tools: true,
      vision: true,
      jsonMode: true,
      functionCalling: true,
    },
    defaultModels: [
      'glm-4',
      'glm-4v',
      'glm-3-turbo',
      'glm-4-air',
      'glm-4-flash',
    ],
    maxContextWindow: 128000,
  },

  copilot: {
    id: 'copilot',
    name: 'GitHub Copilot',
    description: 'GitHub\'s AI pair programmer',
    website: 'https://github.com/features/copilot',
    authType: 'token',
    features: {
      streaming: true,
      tools: false,
      vision: false,
      jsonMode: false,
      functionCalling: false,
    },
    defaultModels: [
      'copilot-chat',
      'gpt-4',
    ],
    maxContextWindow: 32000,
  },

  // Mock provider for testing
  mock: {
    id: 'mock',
    name: 'Mock (Testing)',
    description: 'Mock provider for testing without API keys',
    website: 'https://allternit.com',
    authType: 'none',
    features: {
      streaming: true,
      tools: false,
      vision: false,
      jsonMode: false,
      functionCalling: false,
    },
    defaultModels: [
      'mock-gpt',
      'mock-claude',
      'mock-local',
    ],
    maxContextWindow: 32000,
  },
};

// Provider factory
export function createProvider(id: string, config: ProviderConfig) {
  switch (id) {
    case 'anthropic':
      return new AllternitAI({ apiKey: config.apiKey!, baseURL: config.baseURL });
    case 'openai':
      return new AllternitOpenAI({ apiKey: config.apiKey!, baseURL: config.baseURL });
    case 'google':
      return new AllternitGoogleAI({ apiKey: config.apiKey! });
    case 'ollama':
      return new AllternitOllama({ baseURL: config.baseURL });
    case 'mistral':
      return new AllternitMistral({ apiKey: config.apiKey!, baseURL: config.baseURL });
    case 'cohere':
      return new AllternitCohere({ apiKey: config.apiKey!, baseURL: config.baseURL });
    case 'groq':
      return new AllternitGroq({ apiKey: config.apiKey!, baseURL: config.baseURL });
    case 'together':
      return new AllternitTogether({ apiKey: config.apiKey!, baseURL: config.baseURL });
    case 'azure':
      return new AllternitAzureOpenAI({
        apiKey: config.apiKey!,
        resourceName: config.resourceName!,
        deploymentName: config.deploymentName!,
        baseURL: config.baseURL,
      });
    case 'bedrock':
      return new AllternitBedrock({
        region: config.region,
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      });
    case 'kimi':
      return new AllternitKimi({ apiKey: config.apiKey!, baseURL: config.baseURL });
    case 'qwen':
      return new AllternitQwen({ apiKey: config.apiKey!, baseURL: config.baseURL });
    case 'minimax':
      return new AllternitMiniMax({ 
        apiKey: config.apiKey!, 
        groupId: config.groupId,
        baseURL: config.baseURL 
      });
    case 'glm':
      return new AllternitGLM({ apiKey: config.apiKey!, baseURL: config.baseURL });
    case 'copilot':
      return new AllternitCopilot({ token: config.token!, baseURL: config.baseURL });
    case 'mock':
      return new AllternitMock({ 
        responseDelay: config.responseDelay,
        shouldStream: config.shouldStream,
        mockResponse: config.mockResponse,
      });
    default:
      throw new Error(`Unknown provider: ${id}`);
  }
}

// List all providers
export function listProviders(): ProviderMetadata[] {
  return Object.values(PROVIDER_REGISTRY);
}

// Get provider by ID
export function getProvider(id: string): ProviderMetadata | undefined {
  return PROVIDER_REGISTRY[id];
}

// Find providers by feature
export function findProvidersByFeature(
  feature: keyof ProviderMetadata['features']
): ProviderMetadata[] {
  return listProviders().filter((p) => p.features[feature]);
}

// Check if provider exists
export function hasProvider(id: string): boolean {
  return id in PROVIDER_REGISTRY;
}

// Get default model for provider
export function getDefaultModel(providerId: string): string | undefined {
  const provider = PROVIDER_REGISTRY[providerId];
  return provider?.defaultModels[0];
}

// Type guard for provider ID
export function isValidProvider(id: string): id is keyof typeof PROVIDER_REGISTRY {
  return id in PROVIDER_REGISTRY;
}

// Get providers by auth type
export function getProvidersByAuthType(authType: ProviderMetadata['authType']): ProviderMetadata[] {
  return listProviders().filter((p) => p.authType === authType);
}
