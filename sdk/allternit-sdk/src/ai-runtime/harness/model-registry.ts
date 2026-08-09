/**
 * Harness model registry.
 *
 * Maps provider/model pairs to provider-reported limits. These values feed
 * `StreamRequest.maxTokens` fallback when the caller does not supply an
 * explicit limit.
 */

export interface ModelMetadata {
  contextWindow: number;
  maxOutputTokens: number;
}

export type ProviderModelRegistry = Record<string, ModelMetadata>;

/**
 * Per-provider model metadata keyed by model id.
 *
 * Values are sourced from provider documentation and the Gizzi provider
 * catalog. Keep this in sync with `docs/public/providers/provider-registry.md`.
 */
export const MODEL_REGISTRY: Record<string, ProviderModelRegistry> = {
  anthropic: {
    'claude-3-5-sonnet-20241022': { contextWindow: 200_000, maxOutputTokens: 8_192 },
    'claude-3-5-haiku-20241022': { contextWindow: 200_000, maxOutputTokens: 8_192 },
    'claude-3-opus-20240229': { contextWindow: 200_000, maxOutputTokens: 4_096 },
    'claude-3-sonnet-20240229': { contextWindow: 200_000, maxOutputTokens: 4_096 },
    'claude-3-haiku-20240307': { contextWindow: 200_000, maxOutputTokens: 4_096 },
  },
  openai: {
    'gpt-4o': { contextWindow: 128_000, maxOutputTokens: 16_384 },
    'gpt-4o-mini': { contextWindow: 128_000, maxOutputTokens: 16_384 },
    'gpt-4-turbo': { contextWindow: 128_000, maxOutputTokens: 4_096 },
    'gpt-4': { contextWindow: 8_192, maxOutputTokens: 8_192 },
    'gpt-3.5-turbo': { contextWindow: 16_385, maxOutputTokens: 4_096 },
  },
  google: {
    'gemini-1.5-pro': { contextWindow: 2_097_152, maxOutputTokens: 8_192 },
    'gemini-1.5-flash': { contextWindow: 1_048_576, maxOutputTokens: 8_192 },
    'gemini-1.5-flash-8b': { contextWindow: 1_048_576, maxOutputTokens: 8_192 },
    'gemini-1.0-pro': { contextWindow: 32_760, maxOutputTokens: 8_192 },
  },
  kimi: {
    'kimi-latest': { contextWindow: 256_000, maxOutputTokens: 8_192 },
    'moonshot-v1-8k': { contextWindow: 8_192, maxOutputTokens: 8_192 },
    'moonshot-v1-32k': { contextWindow: 32_768, maxOutputTokens: 32_768 },
    'moonshot-v1-128k': { contextWindow: 131_072, maxOutputTokens: 131_072 },
  },
  ollama: {
    'llama3.2': { contextWindow: 128_000, maxOutputTokens: 8_192 },
    'llama3.1': { contextWindow: 128_000, maxOutputTokens: 8_192 },
    'llama3': { contextWindow: 8_192, maxOutputTokens: 8_192 },
  },
};

/**
 * Look up model metadata for a provider/model pair.
 *
 * Provider and model ids are normalized to lowercase. Returns `undefined`
 * when the pair is not in the registry.
 */
export function getModelMetadata(
  provider: string,
  model: string
): ModelMetadata | undefined {
  const providerKey = provider.toLowerCase();
  const modelKey = model.toLowerCase();
  return MODEL_REGISTRY[providerKey]?.[modelKey];
}
