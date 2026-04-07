/**
 * Allternit Groq Provider
 *
 * Groq API client for Allternit SDK
 * API: https://api.groq.com/openai/v1 (OpenAI-compatible)
 */
export interface AllternitGroqOptions {
    apiKey: string;
    baseURL?: string;
}
export interface GroqMessage {
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
}
export interface GroqTool {
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
export interface GroqChatOptions {
    model: string;
    messages: GroqMessage[];
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    stream?: boolean;
    tools?: GroqTool[];
    toolChoice?: 'auto' | 'none' | {
        type: 'function';
        function: {
            name: string;
        };
    };
    seed?: number;
    stop?: string | string[];
}
export interface GroqChatResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: Array<{
        index: number;
        message: GroqMessage;
        finish_reason: string;
    }>;
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
    system_fingerprint?: string;
}
export interface GroqStreamChunk {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: Array<{
        index: number;
        delta: Partial<GroqMessage>;
        finish_reason: string | null;
    }>;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
    system_fingerprint?: string;
    x_groq?: {
        usage?: {
            prompt_tokens: number;
            prompt_tokens_details?: {
                cached_tokens: number;
            };
            completion_tokens: number;
            completion_tokens_details?: {
                reasoning_tokens: number;
            };
            total_tokens: number;
        };
    };
}
export declare const GROQ_MODELS: {
    readonly LLAMA3_8B: "llama3-8b-8192";
    readonly LLAMA3_70B: "llama3-70b-8192";
    readonly LLAMA2_70B: "llama2-70b-4096";
    readonly MIXTRAL_8X7B: "mixtral-8x7b-32768";
    readonly GEMMA_7B: "gemma-7b-it";
    readonly GEMMA2_9B: "gemma2-9b-it";
    readonly LLAMA3_1_70B: "llama-3.1-70b-versatile";
    readonly LLAMA3_1_8B: "llama-3.1-8b-instant";
};
export declare class AllternitGroq {
    private apiKey;
    private baseURL;
    constructor(options: AllternitGroqOptions);
    chat(options: GroqChatOptions): Promise<GroqChatResponse>;
    chatStream(options: GroqChatOptions): AsyncGenerator<GroqStreamChunk>;
    listModels(): Promise<Array<{
        id: string;
        object: string;
        created: number;
        owned_by: string;
    }>>;
}
export default AllternitGroq;
//# sourceMappingURL=index.d.ts.map