/**
 * Allternit Qwen Provider (Alibaba Cloud)
 *
 * Alibaba Cloud's Qwen API client for Allternit SDK
 * API: https://dashscope.aliyuncs.com/api/v1
 * Docs: https://help.aliyun.com/zh/dashscope/
 */
export interface AllternitQwenOptions {
    apiKey: string;
    baseURL?: string;
}
export interface QwenMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    name?: string;
}
export interface QwenTool {
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
export interface QwenChatOptions {
    model: string;
    messages: QwenMessage[];
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    stream?: boolean;
    tools?: QwenTool[];
    toolChoice?: 'auto' | 'none' | {
        type: 'function';
        function: {
            name: string;
        };
    };
    resultFormat?: 'message' | 'text';
    enableSearch?: boolean;
}
export interface QwenChatResponse {
    output: {
        choices: Array<{
            message: {
                role: string;
                content: string;
                tool_calls?: Array<{
                    id: string;
                    type: string;
                    function: {
                        name: string;
                        arguments: string;
                    };
                }>;
            };
            finish_reason: string;
        }>;
    };
    usage: {
        input_tokens: number;
        output_tokens: number;
        total_tokens: number;
    };
    request_id: string;
}
export interface QwenStreamChunk {
    output: {
        choices: Array<{
            message: {
                role: string;
                content: string;
            };
            finish_reason: string | null;
        }>;
    };
    usage?: {
        input_tokens: number;
        output_tokens: number;
        total_tokens: number;
    };
    request_id: string;
}
export declare const QWEN_MODELS: {
    readonly QWEN_MAX: "qwen-max";
    readonly QWEN_PLUS: "qwen-plus";
    readonly QWEN_TURBO: "qwen-turbo";
    readonly QWEN_72B_CHAT: "qwen-72b-chat";
    readonly QWEN_14B_CHAT: "qwen-14b-chat";
    readonly QWEN_7B_CHAT: "qwen-7b-chat";
    readonly QWEN_VL_PLUS: "qwen-vl-plus";
    readonly QWEN_VL_MAX: "qwen-vl-max";
};
export declare class AllternitQwen {
    private apiKey;
    private baseURL;
    constructor(options: AllternitQwenOptions);
    chat(options: QwenChatOptions): Promise<QwenChatResponse>;
    chatStream(options: QwenChatOptions): AsyncGenerator<QwenStreamChunk>;
    listModels(): Promise<Array<{
        id: string;
        name: string;
    }>>;
}
export default AllternitQwen;
//# sourceMappingURL=index.d.ts.map