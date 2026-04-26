/**
 * AllternitHarness
 * Core SDK implementation for unified AI provider access
 */
import { HarnessConfig, StreamRequest, HarnessStreamChunk } from './types.js';
/**
 * AllternitHarness provides a unified interface for streaming
 * AI completions across multiple providers and deployment modes.
 */
export declare class AllternitHarness {
    private config;
    /**
     * Creates a new AllternitHarness instance
     *
     * @param config - Harness configuration including mode and credentials
     * @throws HarnessError if configuration is invalid
     */
    constructor(config: HarnessConfig);
    /**
     * Validates the harness configuration
     *
     * @param config - Configuration to validate
     * @throws HarnessError if invalid
     */
    private validateConfig;
    /**
     * Main streaming interface for AI completions
     *
     * Routes to the appropriate mode implementation based on configuration.
     * Always injects system prompts regardless of mode.
     *
     * @param request - Stream request with messages, model, and options
     * @yields HarnessStreamChunk - Text, tool calls, errors, or done events
     * @throws HarnessError for configuration or routing errors
     */
    stream(request: StreamRequest): AsyncGenerator<HarnessStreamChunk>;
    /**
     * Complete a request and return the full response text
     * Collects all stream chunks into a single string
     *
     * @param request - Stream request with messages, model, and options
     * @returns Full response text
     * @throws HarnessError for configuration or routing errors
     */
    complete(request: StreamRequest): Promise<string>;
    /**
     * Stream from Allternit Cloud service
     *
     * @param request - Modified stream request with injected prompts
     * @yields HarnessStreamChunk
     */
    private streamFromCloud;
    /**
     * Stream from BYOK (Bring Your Own Key) providers
     *
     * Routes to Anthropic, OpenAI, or Google based on request.provider
     *
     * @param request - Modified stream request with injected prompts
     * @yields HarnessStreamChunk
     */
    private streamFromBYOK;
    /**
     * Stream from Anthropic API
     *
     * @param request - Stream request configured for Anthropic
     * @yields HarnessStreamChunk
     */
    private streamFromAnthropic;
    /**
     * Stream from OpenAI API
     *
     * @param request - Stream request configured for OpenAI
     * @yields HarnessStreamChunk
     */
    private streamFromOpenAI;
    /**
     * Stream from Google (Gemini) API
     *
     * @param request - Stream request configured for Google
     * @yields HarnessStreamChunk
     */
    private streamFromGoogle;
    /**
     * Stream from local model (e.g., Ollama)
     *
     * @param request - Modified stream request with injected prompts
     * @yields HarnessStreamChunk
     */
    private streamFromLocal;
    /**
     * Stream from custom subprocess
     *
     * @param request - Modified stream request with injected prompts
     * @yields HarnessStreamChunk
     */
    private streamFromSubprocess;
    /**
     * Gets the current harness configuration (sanitized)
     *
     * @returns Copy of config with sensitive data redacted
     */
    getConfig(): Omit<HarnessConfig, 'byok' | 'cloud' | 'local' | 'subprocess'> & {
        byok?: {
            configured: boolean;
        };
        cloud?: {
            baseURL: string;
            authenticated: boolean;
        };
        local?: {
            baseURL: string;
        };
        subprocess?: {
            command: string;
        };
    };
    /**
     * Creates a new harness instance with the same configuration
     *
     * @returns New AllternitHarness instance
     */
    clone(): AllternitHarness;
}
export * from './types.js';
export * from './prompts.js';
export default AllternitHarness;
