import { ProviderFeature } from './registry';
export interface ProviderDiscoveryResult {
    id: string;
    available: boolean;
    healthy: boolean;
    models: string[];
    error?: string;
    latencyMs?: number;
}
export interface ApiKeyValidationResult {
    valid: boolean;
    provider: string;
    error?: string;
    permissions?: string[];
}
export interface ProviderHealthStatus {
    id: string;
    status: 'healthy' | 'degraded' | 'unavailable' | 'unknown';
    lastChecked: Date;
    responseTimeMs?: number;
    error?: string;
}
export interface DiscoveryOptions {
    timeoutMs?: number;
    checkModels?: boolean;
    validateApiKeys?: boolean;
    parallel?: boolean;
}
/**
 * Provider Discovery Service
 *
 * Provides capabilities to:
 * 1. Probe providers to check availability
 * 2. List models from each provider
 * 3. Validate API keys
 */
export declare class ProviderDiscoveryService {
    private healthStatus;
    private options;
    constructor(options?: DiscoveryOptions);
    /**
     * Probe a single provider to check availability
     */
    probeProvider(providerId: string, config?: any): Promise<ProviderDiscoveryResult>;
    /**
     * Probe all registered providers
     */
    probeAllProviders(configs?: Record<string, any>): Promise<ProviderDiscoveryResult[]>;
    /**
     * Validate an API key for a specific provider
     */
    validateApiKey(providerId: string, apiKey: string): Promise<ApiKeyValidationResult>;
    /**
     * Validate multiple API keys at once
     */
    validateMultipleApiKeys(keys: Record<string, string>): Promise<Record<string, ApiKeyValidationResult>>;
    /**
     * List all available models from a provider
     */
    listProviderModels(providerId: string, config?: any): Promise<string[]>;
    /**
     * Get health status for all providers
     */
    getHealthStatus(): ProviderHealthStatus[];
    /**
     * Get health status for a specific provider
     */
    getProviderHealth(providerId: string): ProviderHealthStatus | undefined;
    /**
     * Find available providers supporting a specific feature
     */
    findAvailableProvidersByFeature(feature: ProviderFeature, configs?: Record<string, any>): Promise<ProviderDiscoveryResult[]>;
    /**
     * Get providers grouped by availability
     */
    getProvidersByAvailability(configs?: Record<string, any>): Promise<{
        available: ProviderDiscoveryResult[];
        unavailable: ProviderDiscoveryResult[];
    }>;
    private withTimeout;
    private updateHealthStatus;
    private buildConfigForAuth;
    private inferPermissions;
}
export declare const providerDiscovery: ProviderDiscoveryService;
export declare function probeProvider(providerId: string, config?: any, options?: DiscoveryOptions): Promise<ProviderDiscoveryResult>;
export declare function probeAllProviders(configs?: Record<string, any>, options?: DiscoveryOptions): Promise<ProviderDiscoveryResult[]>;
export declare function validateApiKey(providerId: string, apiKey: string, options?: DiscoveryOptions): Promise<ApiKeyValidationResult>;
export declare function listProviderModels(providerId: string, config?: any, options?: DiscoveryOptions): Promise<string[]>;
