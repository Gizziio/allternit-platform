/**
 * Allternit Mistral AI Provider
 *
 * Mistral AI API client for Allternit SDK
 * API: https://api.mistral.ai/v1
 */
export interface AllternitMistralOptions {
    apiKey: string;
    baseURL?: string;
}
export interface MistralMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    name?: string;
}
export interface MistralTool {
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
export interface MistralChatOptions {
    model: string;
    messages: MistralMessage[];
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    stream?: boolean;
    tools?: MistralTool[];
    toolChoice?: 'auto' | 'any' | 'none' | {
        type: 'function';
        function: {
            name: string;
        };
    };
    responseFormat?: {
        type: 'text' | 'json_object';
    };
    safeMode?: boolean;
    randomSeed?: number;
}
export interface MistralChatResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: Array<{
        index: number;
        message: MistralMessage;
        finishReason: string;
    }>;
    usage: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}
export interface MistralStreamChunk {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: Array<{
        index: number;
        delta: Partial<MistralMessage>;
        finishReason: string | null;
    }>;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}
export interface MistralModel {
    id: string;
    object: string;
    created: number;
    ownedBy: string;
}
export declare const MISTRAL_MODELS: {
    readonly LARGE: "mistral-large-latest";
    readonly MEDIUM: "mistral-medium-latest";
    readonly SMALL: "mistral-small-latest";
    readonly TINY: "mistral-tiny";
    readonly EMBED: "mistral-embed";
};
export declare class AllternitMistral {
    private apiKey;
    private baseURL;
    constructor(options: AllternitMistralOptions);
    chat(options: MistralChatOptions): Promise<MistralChatResponse>;
    chatStream(options: MistralChatOptions): AsyncGenerator<MistralStreamChunk>;
    listModels(): Promise<MistralModel[]>;
}
export default AllternitMistral;
//# sourceMappingURL=index.d.ts.map