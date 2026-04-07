/**
 * Allternit Kimi Provider (Moonshot AI)
 *
 * Moonshot AI's Kimi API client for Allternit SDK
 * API: https://api.moonshot.cn/v1
 * Docs: https://platform.moonshot.cn/docs
 */
export interface AllternitKimiOptions {
    apiKey: string;
    baseURL?: string;
}
export interface KimiMessage {
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
export interface KimiTool {
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
export interface KimiChatOptions {
    model: string;
    messages: KimiMessage[];
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    stream?: boolean;
    tools?: KimiTool[];
    toolChoice?: 'auto' | 'none' | {
        type: 'function';
        function: {
            name: string;
        };
    };
    presencePenalty?: number;
    frequencyPenalty?: number;
}
export interface KimiChatResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: Array<{
        index: number;
        message: KimiMessage;
        finish_reason: string;
    }>;
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}
export interface KimiStreamChunk {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: Array<{
        index: number;
        delta: Partial<KimiMessage>;
        finish_reason: string | null;
    }>;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}
export declare const KIMI_MODELS: {
    readonly MOONSHOT_V1_8K: "moonshot-v1-8k";
    readonly MOONSHOT_V1_32K: "moonshot-v1-32k";
    readonly MOONSHOT_V1_128K: "moonshot-v1-128k";
};
export declare class AllternitKimi {
    private apiKey;
    private baseURL;
    constructor(options: AllternitKimiOptions);
    chat(options: KimiChatOptions): Promise<KimiChatResponse>;
    chatStream(options: KimiChatOptions): AsyncGenerator<KimiStreamChunk>;
    listModels(): Promise<Array<{
        id: string;
        object: string;
        created: number;
        owned_by: string;
    }>>;
}
export default AllternitKimi;
//# sourceMappingURL=index.d.ts.map