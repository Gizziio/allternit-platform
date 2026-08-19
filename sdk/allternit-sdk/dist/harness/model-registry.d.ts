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
    /** Whether the model is deprecated by the provider. */
    deprecated?: boolean;
    /** Recommended replacement model id, if deprecated. */
    replacement?: string;
}
export type ProviderModelRegistry = Record<string, ModelMetadata>;
/**
 * Per-provider model metadata keyed by model id.
 *
 * Values are sourced from provider documentation and the Gizzi provider
 * catalog. Keep this in sync with `docs/public/providers/provider-registry.md`.
 */
export declare const MODEL_REGISTRY: Record<string, ProviderModelRegistry>;
/**
 * Look up model metadata for a provider/model pair.
 *
 * Provider and model ids are normalized to lowercase. Returns `undefined`
 * when the pair is not in the registry.
 */
export declare function getModelMetadata(provider: string, model: string): ModelMetadata | undefined;
