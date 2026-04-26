/**
 * Together AI Provider for Allternit SDK
 * https://www.together.ai/
 * OpenAI-compatible API for open source models
 */
import { Message, Tool, HarnessResponse } from '../../harness/types';
export interface TogetherConfig {
    apiKey: string;
    baseURL?: string;
    defaultModel?: string;
}
export interface TogetherRequest {
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
    top_k?: number;
    stream?: boolean;
    tools?: Array<{
        type: 'function';
        function: {
            name: string;
            description: string;
            parameters: Record<string, unknown>;
        };
    }>;
    repetition_penalty?: number;
    stop?: string[];
}
export interface TogetherResponse {
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
        logprobs?: unknown;
    }>;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}
export interface TogetherStreamChunk {
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
        logprobs?: unknown;
    }>;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}
/**
 * Popular Together AI models
 */
export declare const TOGETHER_MODELS: {
    readonly LLAMA_2_70B: "togethercomputer/llama-2-70b-chat";
    readonly LLAMA_3_70B: "meta-llama/Llama-3-70b-chat-hf";
    readonly LLAMA_3_8B: "meta-llama/Llama-3-8b-chat-hf";
    readonly LLAMA_3_1_70B: "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo";
    readonly LLAMA_3_1_8B: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo";
    readonly LLAMA_3_1_405B: "meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo";
    readonly MIXTRAL_8X7B: "mistralai/Mixtral-8x7B-Instruct-v0.1";
    readonly MIXTRAL_8X22B: "mistralai/Mixtral-8x22B-Instruct-v0.1";
    readonly MISTRAL_7B: "mistralai/Mistral-7B-Instruct-v0.2";
    readonly QWEN_2_72B: "Qwen/Qwen2-72B-Instruct";
    readonly QWEN_2_7B: "Qwen/Qwen2-7B-Instruct";
    readonly DBRX_INSTRUCT: "databricks/dbrx-instruct";
    readonly NOUS_HERMES_2_YI_34B: "NousResearch/Nous-Hermes-2-Yi-34B";
    readonly WIZARDLM_2_8X22B: "microsoft/WizardLM-2-8x22B";
    readonly CODE_LLAMA_70B: "togethercomputer/CodeLlama-70b-Instruct";
    readonly DEEPSEEK_CODER_33B: "deepseek-ai/deepseek-coder-33b-instruct";
    readonly LLAVA_13B: "liuhaotian/llava-v1.5-13b";
};
export type TogetherModel = typeof TOGETHER_MODELS[keyof typeof TOGETHER_MODELS];
/**
 * AllternitTogether provides a client for Together AI API
 */
export declare class AllternitTogether {
    private config;
    constructor(config: TogetherConfig);
    /**
     * Transform internal messages to Together format (OpenAI-compatible)
     */
    private transformMessages;
    /**
     * Transform tools to Together format (OpenAI-compatible)
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
        topK?: number;
        tools?: Tool[];
        repetitionPenalty?: number;
        stop?: string[];
    }): Promise<HarnessResponse>;
    /**
     * Streaming chat completion
     */
    chatStream(messages: Message[], options?: {
        model?: string;
        temperature?: number;
        maxTokens?: number;
        topP?: number;
        topK?: number;
        tools?: Tool[];
        repetitionPenalty?: number;
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
     * List available models from Together AI
     */
    listModels(): Promise<Array<{
        id: string;
        name: string;
        context_length?: number;
    }>>;
}
export default AllternitTogether;
