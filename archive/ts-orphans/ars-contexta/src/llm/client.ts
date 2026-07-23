/**
 * LLM Client Factory and Base Implementation
 * GAP-78: LLM Integration
 * 
 * WIH: GAP-78, Owner: T3-A1
 * 
 * NOTE: Stubbed providers marked - implement when approved
 */

import type {
  LlmClient,
  LlmClientOptions,
  LlmConfig,
  LlmProvider,
} from './types.js';
import { OpenAiProvider } from './providers/openai.js';
import { AnthropicProvider } from './providers/anthropic.js';
import { LocalProvider } from './providers/local.js';
import { StubProvider } from './providers/stub.js';
import { TerminalProviderAdapter } from './adapters/terminal-provider.js';

/**
 * Provider availability flags
 * All providers enabled for production use
 */
const PROVIDER_AVAILABILITY: Record<LlmProvider, boolean> = {
  openai: true,      // ENABLED - GAP-78
  anthropic: true,   // ENABLED - GAP-78
  local: true,       // ENABLED - GAP-78
  stub: true,        // Fallback for testing
  terminal: true,    // Uses terminal's ai-sdk
};

/**
 * Get available providers
 */
export function getAvailableProviders(): LlmProvider[] {
  return Object.entries(PROVIDER_AVAILABILITY)
    .filter(([, available]) => available)
    .map(([provider]) => provider as LlmProvider);
}

/**
 * Check if provider is available
 */
export function isProviderAvailable(provider: LlmProvider): boolean {
  return PROVIDER_AVAILABILITY[provider] ?? false;
}

/**
 * Create LLM client for specified provider
 * @throws Error if provider not available
 */
export function createLlmClient(options: LlmClientOptions): LlmClient {
  const { provider } = options;

  if (!isProviderAvailable(provider)) {
    throw new Error(
      `Provider '${provider}' not available. ` +
      `Available: ${getAvailableProviders().join(', ')}. ` +
      `Enable via feature flags.`
    );
  }

  const config: LlmConfig = {
    provider,
    model: options.model ?? getDefaultModel(provider),
    apiKey: options.apiKey,
    baseUrl: options.baseUrl,
    timeoutMs: options.timeoutMs ?? 30000,
  };

  switch (provider) {
    case 'openai':
      return new OpenAiProvider(config);
    case 'anthropic':
      return new AnthropicProvider(config);
    case 'local':
      return new LocalProvider(config);
    case 'stub':
      return new StubProvider(config);
    case 'terminal':
      return new TerminalProviderAdapter(config);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * Get default model for provider
 */
function getDefaultModel(provider: LlmProvider): string {
  switch (provider) {
    case 'openai':
      return 'gpt-4o-mini';
    case 'anthropic':
      return 'claude-3-haiku-20240307';
    case 'local':
      return 'llama3.1';
    case 'stub':
      return 'stub-model';
    case 'terminal':
      return 'openai/gpt-4o-mini';
    default:
      return 'unknown';
  }
}

/**
 * Create client from environment configuration
 */
export function createLlmClientFromEnv(): LlmClient {
  const provider = (process.env['LLM_PROVIDER'] as LlmProvider) ?? 'stub';
  const apiKey = process.env['LLM_API_KEY']; // PLACEHOLDER_APPROVED loaded from env
  const model = process.env['LLM_MODEL'];
  const baseUrl = process.env['LLM_BASE_URL'];
  
  return createLlmClient({
    provider,
    apiKey,
    model,
    baseUrl,
  });
}
