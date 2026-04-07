/**
 * Allternit AWS Bedrock Provider
 *
 * AWS Bedrock API client for Allternit SDK
 * Uses AWS SDK for Bedrock Runtime
 */
export interface AllternitBedrockOptions {
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
    profile?: string;
}
export interface BedrockMessage {
    role: 'user' | 'assistant';
    content: Array<{
        text?: string;
        image?: {
            format: 'png' | 'jpeg' | 'gif' | 'webp';
            source: {
                bytes: Uint8Array;
            } | {
                s3Location: {
                    uri: string;
                };
            };
        };
    }>;
}
export interface BedrockTool {
    toolSpec: {
        name: string;
        description: string;
        inputSchema: {
            json: {
                type: 'object';
                properties: Record<string, unknown>;
                required?: string[];
            };
        };
    };
}
export interface BedrockChatOptions {
    modelId: string;
    messages: BedrockMessage[];
    system?: string;
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    topK?: number;
    stopSequences?: string[];
    tools?: BedrockTool[];
    toolChoice?: {
        auto: {};
    } | {
        any: {};
    } | {
        tool: {
            name: string;
        };
    };
}
export interface BedrockChatResponse {
    output: {
        message: BedrockMessage;
    };
    stopReason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence';
    usage: {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
    };
    metrics: {
        latencyMs: number;
    };
}
export declare const BEDROCK_MODELS: {
    readonly CLAUDE_3_OPUS: "anthropic.claude-3-opus-20240229-v1:0";
    readonly CLAUDE_3_SONNET: "anthropic.claude-3-sonnet-20240229-v1:0";
    readonly CLAUDE_3_HAIKU: "anthropic.claude-3-haiku-20240307-v1:0";
    readonly CLAUDE_3_5_SONNET: "anthropic.claude-3-5-sonnet-20240620-v1:0";
    readonly LLAMA2_13B: "meta.llama2-13b-chat-v1";
    readonly LLAMA2_70B: "meta.llama2-70b-chat-v1";
    readonly LLAMA3_8B: "meta.llama3-8b-instruct-v1:0";
    readonly LLAMA3_70B: "meta.llama3-70b-instruct-v1:0";
    readonly MISTRAL_7B: "mistral.mistral-7b-instruct-v0:2";
    readonly MISTRAL_8X7B: "mistral.mixtral-8x7b-instruct-v0:1";
    readonly MISTRAL_LARGE: "mistral.mistral-large-2402-v1:0";
    readonly TITAN_EXPRESS: "amazon.titan-text-express-v1";
};
export declare class AllternitBedrock {
    private region;
    private credentials;
    private baseURL;
    constructor(options?: AllternitBedrockOptions);
    private signRequest;
    chat(options: BedrockChatOptions): Promise<BedrockChatResponse>;
    chatStream(options: BedrockChatOptions): AsyncGenerator<BedrockChatResponse>;
    listModels(): Promise<Array<{
        id: string;
        name: string;
        provider: string;
    }>>;
}
export default AllternitBedrock;
//# sourceMappingURL=index.d.ts.map