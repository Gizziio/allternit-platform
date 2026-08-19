/**
 * AllternitMLX Provider
 * Apple MLX local inference adapter for the Allternit harness.
 * Communicates with an MLX serving process (e.g. mlx_lm.server)
 * that exposes an OpenAI-compatible HTTP API on localhost.
 */
import { Tool } from '../../harness/types';
export interface MLXConfig {
    baseURL: string;
    defaultModel?: string;
    timeout?: number;
}
export interface MLXModel {
    id: string;
    object: string;
    created?: number;
    owned_by?: string;
}
export interface MLXChatMessage {
    role: string;
    content: string;
}
export interface MLXChatRequest {
    model: string;
    messages: MLXChatMessage[];
    stream?: boolean;
    temperature?: number;
    top_p?: number;
    max_tokens?: number;
    tools?: Tool[];
    stop?: string[];
}
export interface MLXCompletionRequest {
    model: string;
    prompt: string;
    stream?: boolean;
    temperature?: number;
    top_p?: number;
    max_tokens?: number;
    stop?: string[];
}
export interface MLXChatResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: Array<{
        index: number;
        message: {
            role: string;
            content: string;
        };
        finish_reason: string | null;
    }>;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}
export interface MLXStreamDelta {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: Array<{
        index: number;
        delta: {
            role?: string;
            content?: string;
        };
        finish_reason: string | null;
    }>;
}
export declare class AllternitMLX {
    private config;
    constructor(config: MLXConfig);
    listModels(): Promise<MLXModel[]>;
    chat(request: MLXChatRequest): AsyncGenerator<string>;
    generate(request: MLXCompletionRequest): AsyncGenerator<string>;
    isAvailable(): Promise<boolean>;
    private readStream;
}
export * from '../../harness/types';
