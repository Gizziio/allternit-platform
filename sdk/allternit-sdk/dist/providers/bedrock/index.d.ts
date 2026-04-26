/**
 * AWS Bedrock Provider for Allternit SDK
 * https://aws.amazon.com/bedrock/
 *
 * Note: This provider uses AWS SDK. In browser environments,
 * you need to configure AWS credentials separately.
 */
import { Message, Tool, HarnessResponse } from '../../harness/types';
export interface BedrockConfig {
    region: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
    defaultModel?: string;
}
export interface BedrockConverseRequest {
    modelId: string;
    messages: Array<{
        role: 'user' | 'assistant';
        content: Array<{
            text: string;
        } | {
            toolUse: {
                toolUseId: string;
                name: string;
                input: Record<string, unknown>;
            };
        } | {
            toolResult: {
                toolUseId: string;
                content: Array<{
                    text: string;
                }>;
            };
        }>;
    }>;
    system?: Array<{
        text: string;
    }>;
    inferenceConfig?: {
        temperature?: number;
        maxTokens?: number;
        topP?: number;
        stopSequences?: string[];
    };
    toolConfig?: {
        tools: Array<{
            toolSpec: {
                name: string;
                description: string;
                inputSchema: {
                    json: Record<string, unknown>;
                };
            };
        }>;
    };
}
export interface BedrockConverseResponse {
    output: {
        message?: {
            role: string;
            content: Array<{
                text: string;
            } | {
                toolUse: {
                    toolUseId: string;
                    name: string;
                    input: Record<string, unknown>;
                };
            }>;
        };
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
/**
 * Supported AWS Bedrock models
 */
export declare const BEDROCK_MODELS: {
    readonly CLAUDE_3_OPUS: "anthropic.claude-3-opus-20240229-v1:0";
    readonly CLAUDE_3_SONNET: "anthropic.claude-3-sonnet-20240229-v1:0";
    readonly CLAUDE_3_HAIKU: "anthropic.claude-3-haiku-20240307-v1:0";
    readonly CLAUDE_3_5_SONNET: "anthropic.claude-3-5-sonnet-20240620-v1:0";
    readonly CLAUDE_3_5_SONNET_V2: "anthropic.claude-3-5-sonnet-20241022-v2:0";
    readonly CLAUDE_3_5_HAIKU: "anthropic.claude-3-5-haiku-20241022-v1:0";
    readonly LLAMA_2_13B: "meta.llama2-13b-chat-v1";
    readonly LLAMA_2_70B: "meta.llama2-70b-chat-v1";
    readonly LLAMA_3_8B: "meta.llama3-8b-instruct-v1:0";
    readonly LLAMA_3_70B: "meta.llama3-70b-instruct-v1:0";
    readonly LLAMA_3_1_8B: "meta.llama3-1-8b-instruct-v1:0";
    readonly LLAMA_3_1_70B: "meta.llama3-1-70b-instruct-v1:0";
    readonly LLAMA_3_1_405B: "meta.llama3-1-405b-instruct-v1:0";
    readonly LLAMA_3_2_1B: "meta.llama3-2-1b-instruct-v1:0";
    readonly LLAMA_3_2_3B: "meta.llama3-2-3b-instruct-v1:0";
    readonly LLAMA_3_2_11B: "meta.llama3-2-11b-instruct-v1:0";
    readonly LLAMA_3_2_90B: "meta.llama3-2-90b-instruct-v1:0";
    readonly TITAN_TEXT_G1: "amazon.titan-text-express-v1";
    readonly TITAN_TEXT_PREMIER: "amazon.titan-text-premier-v1:0";
    readonly TITAN_EMBED_G1: "amazon.titan-embed-text-v1";
    readonly MISTRAL_7B: "mistral.mistral-7b-instruct-v0:2";
    readonly MIXTRAL_8X7B: "mistral.mixtral-8x7b-instruct-v0:1";
    readonly MISTRAL_LARGE: "mistral.mistral-large-2402-v1:0";
    readonly JURASSIC_2_MID: "ai21.j2-mid-v1";
    readonly JURASSIC_2_ULTRA: "ai21.j2-ultra-v1";
    readonly COHERE_COMMAND: "cohere.command-text-v14";
    readonly COHERE_COMMAND_LIGHT: "cohere.command-light-text-v14";
    readonly COHERE_EMBED_ENGLISH: "cohere.embed-english-v3";
    readonly STABLE_DIFFUSION_XL: "stability.stable-diffusion-xl-v1";
};
export type BedrockModel = typeof BEDROCK_MODELS[keyof typeof BEDROCK_MODELS];
/**
 * AllternitBedrock provides a client for AWS Bedrock
 */
export declare class AllternitBedrock {
    private config;
    constructor(config: BedrockConfig);
    /**
     * Get the base URL for Bedrock API
     */
    private getBaseURL;
    /**
     * Get AWS signature headers (simplified - in production use AWS SDK)
     */
    private getHeaders;
    /**
     * Transform internal messages to Bedrock Converse API format
     */
    private transformMessages;
    /**
     * Transform tools to Bedrock format
     */
    private transformTools;
    /**
     * Handle API errors
     */
    private handleError;
    /**
     * Non-streaming chat completion using Converse API
     */
    chat(messages: Message[], options?: {
        model?: string;
        temperature?: number;
        maxTokens?: number;
        topP?: number;
        stopSequences?: string[];
        tools?: Tool[];
    }): Promise<HarnessResponse>;
    /**
     * Streaming chat completion using ConverseStream API
     */
    chatStream(messages: Message[], options?: {
        model?: string;
        temperature?: number;
        maxTokens?: number;
        topP?: number;
        stopSequences?: string[];
        tools?: Tool[];
    }): AsyncGenerator<{
        content?: string;
        toolCalls?: Array<{
            id: string;
            name: string;
            arguments: string;
        }>;
    }>;
    /**
     * List available models (requires proper AWS permissions)
     * Note: This uses the Bedrock Control Plane API, not the Runtime API
     */
    listModels(): Promise<Array<{
        id: string;
        name: string;
        provider: string;
    }>>;
    /**
     * Invoke a model directly (for non-converse models)
     */
    invokeModel(modelId: string, body: Record<string, unknown>): Promise<unknown>;
}
export default AllternitBedrock;
