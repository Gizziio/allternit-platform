/**
 * Allternit GLM Provider (Zhipu AI / ChatGLM)
 *
 * Zhipu AI's ChatGLM API client for Allternit SDK
 * API: https://open.bigmodel.cn/api/paas/v4
 * Docs: https://open.bigmodel.cn/dev/howuse/model
 */
export interface AllternitGLMOptions {
    apiKey: string;
    baseURL?: string;
}
export interface GLMMessage {
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
export interface GLMTool {
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
export interface GLMChatOptions {
    model: string;
    messages: GLMMessage[];
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    stream?: boolean;
    tools?: GLMTool[];
    toolChoice?: 'auto' | 'none' | {
        type: 'function';
        function: {
            name: string;
        };
    };
    doSample?: boolean;
}
export interface GLMChatResponse {
    id: string;
    created: number;
    model: string;
    choices: Array<{
        index: number;
        message: GLMMessage;
        finish_reason: string;
    }>;
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}
export interface GLMStreamChunk {
    id: string;
    created: number;
    model: string;
    choices: Array<{
        index: number;
        delta: Partial<GLMMessage>;
        finish_reason: string | null;
    }>;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}
export declare const GLM_MODELS: {
    readonly GLM_4: "glm-4";
    readonly GLM_4V: "glm-4v";
    readonly GLM_3_TURBO: "glm-3-turbo";
    readonly GLM_4_0520: "glm-4-0520";
    readonly GLM_4_AIR: "glm-4-air";
    readonly GLM_4_AIRX: "glm-4-airx";
    readonly GLM_4_FLASH: "glm-4-flash";
};
export declare class AllternitGLM {
    private apiKey;
    private baseURL;
    constructor(options: AllternitGLMOptions);
    chat(options: GLMChatOptions): Promise<GLMChatResponse>;
    chatStream(options: GLMChatOptions): AsyncGenerator<GLMStreamChunk>;
    listModels(): Promise<Array<{
        id: string;
        name: string;
    }>>;
}
export { AllternitGLM as AllternitChatGLM };
export default AllternitGLM;
//# sourceMappingURL=index.d.ts.map