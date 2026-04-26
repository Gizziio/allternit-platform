import { PROVIDER_REGISTRY, createProvider } from './registry';
// Default discovery options
const DEFAULT_DISCOVERY_OPTIONS = {
    timeoutMs: 10000,
    checkModels: true,
    validateApiKeys: false,
    parallel: true,
};
/**
 * Provider Discovery Service
 *
 * Provides capabilities to:
 * 1. Probe providers to check availability
 * 2. List models from each provider
 * 3. Validate API keys
 */
export class ProviderDiscoveryService {
    healthStatus = new Map();
    options;
    constructor(options = {}) {
        this.options = { ...DEFAULT_DISCOVERY_OPTIONS, ...options };
    }
    /**
     * Probe a single provider to check availability
     */
    async probeProvider(providerId, config) {
        const metadata = PROVIDER_REGISTRY.get(providerId)?.metadata;
        if (!metadata) {
            return {
                id: providerId,
                available: false,
                healthy: false,
                models: [],
                error: `Unknown provider: ${providerId}`,
            };
        }
        const startTime = Date.now();
        try {
            // Create provider instance if config is provided
            let provider;
            if (config) {
                try {
                    provider = createProvider(providerId, config);
                }
                catch (err) {
                    return {
                        id: providerId,
                        available: false,
                        healthy: false,
                        models: metadata.models || [],
                        error: `Failed to create provider: ${err instanceof Error ? err.message : String(err)}`,
                    };
                }
            }
            // Try to fetch models if provider is available and checkModels is enabled
            let models = metadata.models;
            if (provider && this.options.checkModels && typeof provider.listModels === 'function') {
                try {
                    const modelList = await this.withTimeout(provider.listModels(), this.options.timeoutMs);
                    if (Array.isArray(modelList) && modelList.length > 0) {
                        models = modelList;
                    }
                }
                catch (err) {
                    // Fall back to default models if listing fails
                    console.warn(`Failed to list models for ${providerId}:`, err);
                }
            }
            const latencyMs = Date.now() - startTime;
            // Update health status
            this.updateHealthStatus(providerId, 'healthy', latencyMs);
            return {
                id: providerId,
                available: true,
                healthy: true,
                models,
                latencyMs,
            };
        }
        catch (error) {
            const latencyMs = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);
            // Update health status
            this.updateHealthStatus(providerId, 'unavailable', latencyMs, errorMessage);
            return {
                id: providerId,
                available: false,
                healthy: false,
                models: metadata.models,
                error: errorMessage,
                latencyMs,
            };
        }
    }
    /**
     * Probe all registered providers
     */
    async probeAllProviders(configs) {
        const providerIds = Array.from(PROVIDER_REGISTRY.keys());
        if (this.options.parallel) {
            // Probe all providers in parallel
            const promises = providerIds.map(id => this.probeProvider(id, configs?.[id]));
            return Promise.all(promises);
        }
        else {
            // Probe providers sequentially
            const results = [];
            for (const id of providerIds) {
                const result = await this.probeProvider(id, configs?.[id]);
                results.push(result);
            }
            return results;
        }
    }
    /**
     * Validate an API key for a specific provider
     */
    async validateApiKey(providerId, apiKey) {
        const metadata = PROVIDER_REGISTRY.get(providerId)?.metadata;
        if (!metadata) {
            return {
                valid: false,
                provider: providerId,
                error: `Unknown provider: ${providerId}`,
            };
        }
        try {
            // Create minimal config with just the API key
            const config = this.buildConfigForAuth(metadata.requiresApiKey ? 'api_key' : 'none', apiKey);
            // Try to probe the provider
            const probeResult = await this.probeProvider(providerId, config);
            if (probeResult.available && probeResult.healthy) {
                return {
                    valid: true,
                    provider: providerId,
                    permissions: this.inferPermissions(metadata),
                };
            }
            else {
                return {
                    valid: false,
                    provider: providerId,
                    error: probeResult.error || 'Provider unavailable',
                };
            }
        }
        catch (error) {
            return {
                valid: false,
                provider: providerId,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
    /**
     * Validate multiple API keys at once
     */
    async validateMultipleApiKeys(keys) {
        const results = {};
        if (this.options.parallel) {
            const entries = Object.entries(keys);
            const promises = entries.map(async ([providerId, apiKey]) => {
                const result = await this.validateApiKey(providerId, apiKey);
                return [providerId, result];
            });
            const settled = await Promise.all(promises);
            for (const [providerId, result] of settled) {
                results[providerId] = result;
            }
        }
        else {
            for (const [providerId, apiKey] of Object.entries(keys)) {
                results[providerId] = await this.validateApiKey(providerId, apiKey);
            }
        }
        return results;
    }
    /**
     * List all available models from a provider
     */
    async listProviderModels(providerId, config) {
        const probeResult = await this.probeProvider(providerId, config);
        return probeResult.models;
    }
    /**
     * Get health status for all providers
     */
    getHealthStatus() {
        return Array.from(this.healthStatus.values());
    }
    /**
     * Get health status for a specific provider
     */
    getProviderHealth(providerId) {
        return this.healthStatus.get(providerId);
    }
    /**
     * Find available providers supporting a specific feature
     */
    async findAvailableProvidersByFeature(feature, configs) {
        const allResults = await this.probeAllProviders(configs);
        return allResults.filter(result => {
            const metadata = PROVIDER_REGISTRY.get(result.id)?.metadata;
            return result.available && metadata?.features.includes(feature);
        });
    }
    /**
     * Get providers grouped by availability
     */
    async getProvidersByAvailability(configs) {
        const allResults = await this.probeAllProviders(configs);
        return {
            available: allResults.filter(r => r.available),
            unavailable: allResults.filter(r => !r.available),
        };
    }
    // Helper methods
    async withTimeout(promise, timeoutMs) {
        if (!timeoutMs)
            return promise;
        return Promise.race([
            promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeoutMs)),
        ]);
    }
    updateHealthStatus(providerId, status, responseTimeMs, error) {
        this.healthStatus.set(providerId, {
            id: providerId,
            status,
            lastChecked: new Date(),
            responseTimeMs,
            error,
        });
    }
    buildConfigForAuth(authType, apiKey) {
        switch (authType) {
            case 'api_key':
                return { apiKey };
            case 'azure':
                return { apiKey, endpoint: process.env.AZURE_ENDPOINT };
            case 'aws':
                return {
                    accessKeyId: apiKey,
                    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                    region: process.env.AWS_REGION || 'us-east-1',
                };
            case 'oauth':
                return { accessToken: apiKey };
            default:
                return { apiKey };
        }
    }
    inferPermissions(metadata) {
        const permissions = ['inference'];
        if (metadata.features.includes('streaming'))
            permissions.push('streaming');
        if (metadata.features.includes('tools'))
            permissions.push('tools');
        if (metadata.features.includes('vision'))
            permissions.push('vision');
        if (metadata.features.includes('json-mode'))
            permissions.push('json_mode');
        return permissions;
    }
}
// Singleton instance for convenient access
export const providerDiscovery = new ProviderDiscoveryService();
// Convenience exports for common operations
export async function probeProvider(providerId, config, options) {
    const service = new ProviderDiscoveryService(options);
    return service.probeProvider(providerId, config);
}
export async function probeAllProviders(configs, options) {
    const service = new ProviderDiscoveryService(options);
    return service.probeAllProviders(configs);
}
export async function validateApiKey(providerId, apiKey, options) {
    const service = new ProviderDiscoveryService(options);
    return service.validateApiKey(providerId, apiKey);
}
export async function listProviderModels(providerId, config, options) {
    const service = new ProviderDiscoveryService(options);
    return service.listProviderModels(providerId, config);
}
