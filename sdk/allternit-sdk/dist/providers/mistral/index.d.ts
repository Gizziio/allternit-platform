/**
 * Mistral AI Provider for Allternit SDK
 * https://docs.mistral.ai/
 */
import { Message, Tool, HarnessResponse } from '../../harness/types';
export interface MistralConfig {
    apiKey: string;
    baseURL?: string;
    defaultModel?: string;
}
export interface MistralRequest {
    model: string;
    messages: Array<{
        role: 'system' | 'user' | 'assistant' | 'tool';
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
    stream?: boolean;
    tools?: Array<{
        type: 'function';
        function: {
            name: string;
            description: string;
            parameters: Record<string, unknown>;
        };
    }>;
}
export interface MistralResponse {
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
}
export interface MistralStreamChunk {
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
}
/**
 * Supported Mistral models
 */
export declare const MISTRAL_MODELS: {
    readonly TINY: "mistral-tiny";
    readonly SMALL: "mistral-small";
    readonly MEDIUM: "mistral-medium";
    readonly LARGE: "mistral-large-latest";
    readonly EMBED: "mistral-embed";
};
export type MistralModel = typeof MISTRAL_MODELS[keyof typeof MISTRAL_MODELS];
/**
 * AllternitMistral provides a client for Mistral AI API
 */
export declare class AllternitMistral {
    private config;
    constructor(config: MistralConfig);
    /**
     * Transform internal messages to Mistral format
     */
    private transformMessages;
    /**
     * Transform tools to Mistral format
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
        model?: string;
        temperature?: number;
        maxTokens?: number;
        topP?: number;
        tools?: Tool[];
    }): Promise<HarnessResponse>;
    /**
     * Streaming chat completion
     */
    chatStream(messages: Message[], options?: {
        model?: string;
        temperature?: number;
        maxTokens?: number;
        topP?: number;
        tools?: Tool[];
    }): AsyncGenerator<{
        content?: string;
        toolCalls?: Array<{
            id: string;
            name: string;
            arguments: string;
        }>;
    }>;
    /**
     * List available models from Mistral
     */
    listModels(): Promise<Array<{
        id: string;
        name: string;
    }>>;
}
export default AllternitMistral;
