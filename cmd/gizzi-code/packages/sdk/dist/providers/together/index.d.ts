/**
 * Allternit Together AI Provider
 *
 * Together AI API client for Allternit SDK
 * API: https://api.together.xyz/v1 (OpenAI-compatible)
 */
export interface AllternitTogetherOptions {
    apiKey: string;
    baseURL?: string;
}
export interface TogetherMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    name?: string;
}
export interface TogetherTool {
    type: 'function';
    function: {
        name: string;
        description: string;
        parameters: {
            type: 'object';
            properties: Record<string, unknown>;
            required?: string[];
        };
    };
}
export interface TogetherChatOptions {
    model: string;
    messages: TogetherMessage[];
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    topK?: number;
    stream?: boolean;
    tools?: TogetherTool[];
    toolChoice?: 'auto' | 'none' | {
        type: 'function';
        function: {
            name: string;
        };
    };
    stop?: string | string[];
    repetitionPenalty?: number;
    presencePenalty?: number;
    frequencyPenalty?: number;
    minP?: number;
}
export interface TogetherChatResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: Array<{
        index: number;
        message: TogetherMessage;
        finish_reason: string;
        logprobs?: unknown;
    }>;
    usage: {
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
        delta: Partial<TogetherMessage>;
        finish_reason: string | null;
        logprobs?: unknown;
    }>;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}
export declare const TOGETHER_MODELS: {
    readonly LLAMA2_70B: "togethercomputer/llama-2-70b-chat";
    readonly LLAMA2_13B: "togethercomputer/llama-2-13b-chat";
    readonly LLAMA2_7B: "togethercomputer/llama-2-7b-chat";
    readonly MISTRAL_7B: "mistralai/Mistral-7B-Instruct-v0.1";
    readonly MIXTRAL_8X7B: "mistralai/Mixtral-8x7B-Instruct-v0.1";
    readonly QWEN_72B: "Qwen/Qwen1.5-72B-Chat";
    readonly DBRX: "databricks/dbrx-instruct";
};
export declare class AllternitTogether {
    private apiKey;
    private baseURL;
    constructor(options: AllternitTogetherOptions);
    chat(options: TogetherChatOptions): Promise<TogetherChatResponse>;
    chatStream(options: TogetherChatOptions): AsyncGenerator<TogetherStreamChunk>;
    listModels(): Promise<Array<{
        id: string;
        object: string;
        created: number;
        owned_by: string;
    }>>;
}
export default AllternitTogether;
//# sourceMappingURL=index.d.ts.map