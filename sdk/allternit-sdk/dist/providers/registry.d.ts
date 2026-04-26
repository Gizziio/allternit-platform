/**
 * Provider Registry
 * Central registry for all AI providers with metadata and capabilities
 */
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
export type ProviderFeature = 'streaming' | 'tools' | 'vision' | 'json-mode' | 'function-calling' | 'system-prompt' | 'multi-modal' | 'fine-tuning';
export interface ProviderEntry {
    name: string;
    class: new (...args: any[]) => any;
    metadata: ProviderMetadata;
}
/**
 * Registry of all supported providers
 */
export declare const PROVIDER_REGISTRY: Map<string, ProviderEntry>;
/**
 * Create a provider instance
 * @param name - Provider name
 * @param config - Provider configuration
 * @returns Provider instance
 */
export declare function createProvider(name: string, config: unknown): unknown;
/**
 * List all available provider names
 * @returns Array of provider names
 */
export declare function listProviders(): string[];
/**
 * Get provider metadata
 * @param name - Provider name
 * @returns Provider metadata or undefined if not found
 */
export declare function getProvider(name: string): ProviderMetadata | undefined;
/**
 * Find providers that support specific features
 * @param features - Features to filter by
 * @returns Array of provider metadata matching all features
 */
export declare function findProvidersByFeature(...features: ProviderFeature[]): ProviderMetadata[];
declare const _default: {
    PROVIDER_REGISTRY: Map<string, ProviderEntry>;
    createProvider: typeof createProvider;
    listProviders: typeof listProviders;
    getProvider: typeof getProvider;
    findProvidersByFeature: typeof findProvidersByFeature;
};
export default _default;
