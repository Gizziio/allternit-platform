/**
 * Azure OpenAI Provider for Allternit SDK
 * https://azure.microsoft.com/en-us/services/cognitive-services/openai-service/
 */
import { Message, Tool, HarnessResponse } from '../../harness/types';
export interface AzureOpenAIConfig {
    apiKey: string;
    resourceName: string;
    deploymentName: string;
    apiVersion?: string;
    baseURL?: string;
}
export interface AzureOpenAIRequest {
    messages: Array<{
        role: 'system' | 'user' | 'assistant' | 'tool' | 'function';
        content: string;
        name?: string;
        tool_calls?: Array<{
            id: string;
            type: 'function';
            function: {
                name: string;
                arguments: string;
            };
        }>;
        tool_call_id?: string;
    }>;
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
    stream?: boolean;
    tools?: Array<{
        type: 'function';
        function: {
            name: string;
            description: string;
            parameters: Record<string, unknown>;
        };
    }>;
    stop?: string[];
}
export interface AzureOpenAIResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: Array<{
        index: number;
        message: {
            role: string;
            content: string;
            tool_calls?: Array<{
                id: string;
                type: 'function';
                function: {
                    name: string;
                    arguments: string;
                };
            }>;
        };
        finish_reason: string;
    }>;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
    system_fingerprint?: string;
}
export interface AzureOpenAIStreamChunk {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: Array<{
        index: number;
        delta: {
            role?: string;
            content?: string;
            tool_calls?: Array<{
                index: number;
                id?: string;
                type?: 'function';
                function?: {
                    name?: string;
                    arguments?: string;
                };
            }>;
        };
        finish_reason: string | null;
    }>;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
    system_fingerprint?: string;
}
/**
 * Common Azure OpenAI API versions
 */
export declare const AZURE_API_VERSIONS: {
    readonly V2024_02: "2024-02-01";
    readonly V2024_06: "2024-06-01";
    readonly V2024_08: "2024-08-01-preview";
    readonly V2024_10: "2024-10-01-preview";
    readonly V2025_01: "2025-01-01-preview";
};
/**
 * AllternitAzureOpenAI provides a client for Azure OpenAI Service
 */
export declare class AllternitAzureOpenAI {
    private config;
    constructor(config: AzureOpenAIConfig);
    /**
     * Build the full API URL with query parameters
     */
    private buildURL;
    /**
     * Transform internal messages to Azure OpenAI format
     */
    private transformMessages;
    /**
     * Transform tools to Azure OpenAI format
     */
    private transformTools;
    /**
     * Handle API errors
     */
    private handleError;
    /**
     * Non-streaming chat completion
     */
    chat(messages: Message[], options?: {
        temperature?: number;
        maxTokens?: number;
        topP?: number;
        frequencyPenalty?: number;
        presencePenalty?: number;
        tools?: Tool[];
        stop?: string[];
    }): Promise<HarnessResponse>;
    /**
     * Streaming chat completion
     */
    chatStream(messages: Message[], options?: {
        temperature?: number;
        maxTokens?: number;
        topP?: number;
        frequencyPenalty?: number;
        presencePenalty?: number;
        tools?: Tool[];
        stop?: string[];
    }): AsyncGenerator<{
        content?: string;
        toolCalls?: Array<{
            id: string;
            name: string;
            arguments: string;
        }>;
    }>;
    /**
     * Get rate limit information from headers
     */
    getRateLimits(): Promise<{
        requestsRemaining?: number;
        requestsLimit?: number;
        tokensRemaining?: number;
        tokensLimit?: number;
        resetTime?: Date;
    }>;
}
export default AllternitAzureOpenAI;
