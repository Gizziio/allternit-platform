/**
 * Allternit Provider Registry
 *
 * Central registry for AI providers with metadata and factory functions.
 */
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
export declare const PROVIDER_REGISTRY: Record<string, ProviderMetadata>;
export declare function createProvider(id: string, config: ProviderConfig): any;
export declare function listProviders(): ProviderMetadata[];
export declare function getProvider(id: string): ProviderMetadata | undefined;
export declare function findProvidersByFeature(feature: keyof ProviderMetadata['features']): ProviderMetadata[];
export declare function hasProvider(id: string): boolean;
export declare function getDefaultModel(providerId: string): string | undefined;
export declare function isValidProvider(id: string): id is keyof typeof PROVIDER_REGISTRY;
export declare function getProvidersByAuthType(authType: ProviderMetadata['authType']): ProviderMetadata[];
//# sourceMappingURL=registry.d.ts.map