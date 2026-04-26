/**
 * AllternitOllama Provider
 * Local Ollama model integration for the Allternit harness
 */
import { Tool } from '../../harness/types';
export interface OllamaConfig {
    baseURL: string;
    defaultModel?: string;
}
export interface OllamaModel {
    name: string;
    size: number;
    digest?: string;
    modified?: string;
}
export interface OllamaGenerateRequest {
    model: string;
    prompt: string;
    system?: string;
    stream?: boolean;
    options?: Record<string, unknown>;
}
export interface OllamaChatRequest {
    model: string;
    messages: Array<{
        role: string;
        content: string;
    }>;
    stream?: boolean;
    tools?: Tool[];
    options?: Record<string, unknown>;
}
export interface OllamaResponse {
    model: string;
    created_at: string;
    response?: string;
    message?: {
        role: string;
        content: string;
    };
    done: boolean;
    context?: number[];
    total_duration?: number;
    load_duration?: number;
    prompt_eval_count?: number;
    eval_count?: number;
}
/**
 * AllternitOllama provides a client for local Ollama instances
 */
export declare class AllternitOllama {
    private config;
    constructor(config: OllamaConfig);
    /**
     * List available models from the Ollama server
     */
    listModels(): Promise<OllamaModel[]>;
    /**
     * Pull a model from Ollama
     */
    pullModel(model: string): Promise<void>;
    /**
     * Generate completion using Ollama
     */
    generate(request: OllamaGenerateRequest): AsyncGenerator<string>;
    /**
     * Chat completion using Ollama
     */
    chat(request: OllamaChatRequest): AsyncGenerator<string>;
    /**
     * Check if Ollama server is available
     */
    isAvailable(): Promise<boolean>;
}
export * from '../../harness/types';
