/**
 * Allternit MiniMax Provider
 *
 * MiniMax AI API client for Allternit SDK
 * API: https://api.minimax.chat/v1
 * Docs: https://platform.minimaxi.com/document/ChatCompletion
 */
export interface AllternitMiniMaxOptions {
    apiKey: string;
    groupId?: string;
    baseURL?: string;
}
export interface MiniMaxMessage {
    role: 'system' | 'user' | 'assistant' | 'function';
    content: string;
    name?: string;
}
export interface MiniMaxFunction {
    name: string;
    description: string;
    parameters: {
        type: 'object';
        properties: Record<string, unknown>;
        required?: string[];
    };
}
export interface MiniMaxChatOptions {
    model: string;
    messages: MiniMaxMessage[];
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    stream?: boolean;
    functions?: MiniMaxFunction[];
    functionCall?: 'auto' | 'none' | {
        name: string;
    };
}
export interface MiniMaxChatResponse {
    id: string;
    created: number;
    model: string;
    choices: Array<{
        index: number;
        message: MiniMaxMessage;
        finish_reason: string;
    }>;
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
    base_resp?: {
        status_code: number;
        status_msg: string;
    };
}
export interface MiniMaxStreamChunk {
    id: string;
    created: number;
    model: string;
    choices: Array<{
        index: number;
        delta: Partial<MiniMaxMessage>;
        finish_reason: string | null;
    }>;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}
export declare const MINIMAX_MODELS: {
    readonly ABA5_5: "abab5.5-chat";
    readonly ABA5_5S: "abab5.5s-chat";
    readonly ABA6: "abab6-chat";
    readonly ABA6_5: "abab6.5-chat";
    readonly ABA6_5S: "abab6.5s-chat";
};
export declare class AllternitMiniMax {
    private apiKey;
    private groupId;
    private baseURL;
    constructor(options: AllternitMiniMaxOptions);
    chat(options: MiniMaxChatOptions): Promise<MiniMaxChatResponse>;
    chatStream(options: MiniMaxChatOptions): AsyncGenerator<MiniMaxStreamChunk>;
    listModels(): Promise<Array<{
        id: string;
        name: string;
    }>>;
}
export default AllternitMiniMax;
//# sourceMappingURL=index.d.ts.map