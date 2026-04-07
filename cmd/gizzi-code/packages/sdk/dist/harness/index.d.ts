/**
 * Allternit Harness - Main Entry Point
 * Unified AI interface for BYOK, Cloud, Local, and Subprocess modes
 */
import type { HarnessConfig, StreamRequest, HarnessStreamChunk, HarnessResponse, ProviderInfo, ModelInfo } from './types';
export * from './types';
export * from './modes';
/**
 * AllternitHarness - Main class for AI interactions
 * Provides a unified interface across all operation modes
 */
export declare class AllternitHarness {
    private config;
    constructor(config: HarnessConfig);
    /**
     * Validate the harness configuration
     */
    private validateConfig;
    /**
     * Main streaming interface
     * Routes to the appropriate mode handler
     */
    stream(request: StreamRequest): AsyncGenerator<HarnessStreamChunk>;
    /**
     * Non-streaming completion
     */
    complete(request: StreamRequest): Promise<HarnessResponse>;
    /**
     * List available providers for current mode
     */
    listProviders(): Promise<ProviderInfo[]>;
    /**
     * List available models for a provider
     */
    listModels(provider: string): Promise<ModelInfo[]>;
    /**
     * Get known models for BYOK providers
     */
    private getKnownModels;
    /**
     * Enrich the request with system prompts and defaults
     */
    private enrichRequest;
    /**
     * Get current mode
     */
    getMode(): HarnessConfig['mode'];
    /**
     * Update configuration
     */
    updateConfig(config: Partial<HarnessConfig>): void;
}
//# sourceMappingURL=index.d.ts.map