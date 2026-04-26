import { PROVIDER_REGISTRY, ProviderMetadata, createProvider } from './registry';

// Discovery result for a provider
export interface ProviderDiscoveryResult {
  id: string;
  available: boolean;
  healthy: boolean;
  models: string[];
  error?: string;
  latencyMs?: number;
}

// API key validation result
export interface ApiKeyValidationResult {
  valid: boolean;
  provider: string;
  error?: string;
  permissions?: string[];
}

// Provider health status
export interface ProviderHealthStatus {
  id: string;
  status: 'healthy' | 'degraded' | 'unavailable' | 'unknown';
  lastChecked: Date;
  responseTimeMs?: number;
  error?: string;
}

// Discovery options
export interface DiscoveryOptions {
  timeoutMs?: number;
  checkModels?: boolean;
  validateApiKeys?: boolean;
  parallel?: boolean;
}

// Default discovery options
const DEFAULT_DISCOVERY_OPTIONS: DiscoveryOptions = {
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
  private healthStatus: Map<string, ProviderHealthStatus> = new Map();
  private options: DiscoveryOptions;

  constructor(options: DiscoveryOptions = {}) {
    this.options = { ...DEFAULT_DISCOVERY_OPTIONS, ...options };
  }

  /**
   * Probe a single provider to check availability
   */
  async probeProvider(providerId: string, config?: any): Promise<ProviderDiscoveryResult> {
    const metadata = PROVIDER_REGISTRY[providerId];
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
      let provider: any;
      if (config) {
        try {
          provider = createProvider(providerId, config);
        } catch (err) {
          return {
            id: providerId,
            available: false,
            healthy: false,
            models: metadata.defaultModels,
            error: `Failed to create provider: ${err instanceof Error ? err.message : String(err)}`,
          };
        }
      }

      // Try to fetch models if provider is available and checkModels is enabled
      let models: string[] = metadata.defaultModels;
      
      if (provider && this.options.checkModels && typeof provider.listModels === 'function') {
        try {
          const modelList = await this.withTimeout(
            provider.listModels(),
            this.options.timeoutMs
          );
          if (Array.isArray(modelList) && modelList.length > 0) {
            models = modelList;
          }
        } catch (err) {
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
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Update health status
      this.updateHealthStatus(providerId, 'unavailable', latencyMs, errorMessage);

      return {
        id: providerId,
        available: false,
        healthy: false,
        models: metadata.defaultModels,
        error: errorMessage,
        latencyMs,
      };
    }
  }

  /**
   * Probe all registered providers
   */
  async probeAllProviders(configs?: Record<string, any>): Promise<ProviderDiscoveryResult[]> {
    const providerIds = Object.keys(PROVIDER_REGISTRY);

    if (this.options.parallel) {
      // Probe all providers in parallel
      const promises = providerIds.map(id => 
        this.probeProvider(id, configs?.[id])
      );
      return Promise.all(promises);
    } else {
      // Probe providers sequentially
      const results: ProviderDiscoveryResult[] = [];
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
  async validateApiKey(providerId: string, apiKey: string): Promise<ApiKeyValidationResult> {
    const metadata = PROVIDER_REGISTRY[providerId];
    if (!metadata) {
      return {
        valid: false,
        provider: providerId,
        error: `Unknown provider: ${providerId}`,
      };
    }

    try {
      // Create minimal config with just the API key
      const config = this.buildConfigForAuth(metadata.authType, apiKey);
      
      // Try to probe the provider
      const probeResult = await this.probeProvider(providerId, config);

      if (probeResult.available && probeResult.healthy) {
        return {
          valid: true,
          provider: providerId,
          permissions: this.inferPermissions(metadata),
        };
      } else {
        return {
          valid: false,
          provider: providerId,
          error: probeResult.error || 'Provider unavailable',
        };
      }
    } catch (error) {
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
  async validateMultipleApiKeys(
    keys: Record<string, string>
  ): Promise<Record<string, ApiKeyValidationResult>> {
    const results: Record<string, ApiKeyValidationResult> = {};

    if (this.options.parallel) {
      const entries = Object.entries(keys);
      const promises = entries.map(async ([providerId, apiKey]) => {
        const result = await this.validateApiKey(providerId, apiKey);
        return [providerId, result] as const;
      });
      
      const settled = await Promise.all(promises);
      for (const [providerId, result] of settled) {
        results[providerId] = result;
      }
    } else {
      for (const [providerId, apiKey] of Object.entries(keys)) {
        results[providerId] = await this.validateApiKey(providerId, apiKey);
      }
    }

    return results;
  }

  /**
   * List all available models from a provider
   */
  async listProviderModels(providerId: string, config?: any): Promise<string[]> {
    const probeResult = await this.probeProvider(providerId, config);
    return probeResult.models;
  }

  /**
   * Get health status for all providers
   */
  getHealthStatus(): ProviderHealthStatus[] {
    return Array.from(this.healthStatus.values());
  }

  /**
   * Get health status for a specific provider
   */
  getProviderHealth(providerId: string): ProviderHealthStatus | undefined {
    return this.healthStatus.get(providerId);
  }

  /**
   * Find available providers supporting a specific feature
   */
  async findAvailableProvidersByFeature(
    feature: keyof ProviderMetadata['features'],
    configs?: Record<string, any>
  ): Promise<ProviderDiscoveryResult[]> {
    const allResults = await this.probeAllProviders(configs);
    
    return allResults.filter(result => {
      const metadata = PROVIDER_REGISTRY[result.id];
      return result.available && metadata?.features[feature];
    });
  }

  /**
   * Get providers grouped by availability
   */
  async getProvidersByAvailability(configs?: Record<string, any>): Promise<{
    available: ProviderDiscoveryResult[];
    unavailable: ProviderDiscoveryResult[];
  }> {
    const allResults = await this.probeAllProviders(configs);
    
    return {
      available: allResults.filter(r => r.available),
      unavailable: allResults.filter(r => !r.available),
    };
  }

  // Helper methods
  
  private async withTimeout<T>(promise: Promise<T>, timeoutMs?: number): Promise<T> {
    if (!timeoutMs) return promise;

    return Promise.race([
      promise,
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), timeoutMs)
      ),
    ]);
  }

  private updateHealthStatus(
    providerId: string,
    status: ProviderHealthStatus['status'],
    responseTimeMs?: number,
    error?: string
  ): void {
    this.healthStatus.set(providerId, {
      id: providerId,
      status,
      lastChecked: new Date(),
      responseTimeMs,
      error,
    });
  }

  private buildConfigForAuth(authType: ProviderMetadata['authType'], apiKey: string): any {
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

  private inferPermissions(metadata: ProviderMetadata): string[] {
    const permissions: string[] = ['inference'];
    
    if (metadata.features.streaming) permissions.push('streaming');
    if (metadata.features.tools) permissions.push('tools');
    if (metadata.features.vision) permissions.push('vision');
    if (metadata.features.jsonMode) permissions.push('json_mode');
    
    return permissions;
  }
}

// Singleton instance for convenient access
export const providerDiscovery = new ProviderDiscoveryService();

// Convenience exports for common operations
export async function probeProvider(
  providerId: string, 
  config?: any,
  options?: DiscoveryOptions
): Promise<ProviderDiscoveryResult> {
  const service = new ProviderDiscoveryService(options);
  return service.probeProvider(providerId, config);
}

export async function probeAllProviders(
  configs?: Record<string, any>,
  options?: DiscoveryOptions
): Promise<ProviderDiscoveryResult[]> {
  const service = new ProviderDiscoveryService(options);
  return service.probeAllProviders(configs);
}

export async function validateApiKey(
  providerId: string, 
  apiKey: string,
  options?: DiscoveryOptions
): Promise<ApiKeyValidationResult> {
  const service = new ProviderDiscoveryService(options);
  return service.validateApiKey(providerId, apiKey);
}

export async function listProviderModels(
  providerId: string, 
  config?: any,
  options?: DiscoveryOptions
): Promise<string[]> {
  const service = new ProviderDiscoveryService(options);
  return service.listProviderModels(providerId, config);
}
