/**
 * AllternitHarness Types
 * Core type definitions for the harness SDK
 */
/**
 * Supported execution modes for the harness
 */
export type HarnessMode = 'byok' | 'cloud' | 'local' | 'subprocess';
/**
 * BYOK (Bring Your Own Key) provider configuration
 */
export interface BYOKProviderConfig {
    apiKey: string;
    baseURL?: string;
}
/**
 * Cloud provider configuration
 */
export interface CloudConfig {
    baseURL: string;
    accessToken: string;
    refreshToken?: string;
}
/**
 * Local model configuration (e.g., Ollama)
 */
export interface LocalConfig {
    baseURL: string;
}
/**
 * Subprocess configuration for custom model runners
 */
export interface SubprocessConfig {
    command: string;
    env?: Record<string, string>;
    cwd?: string;
}
/**
 * Main harness configuration
 */
export interface HarnessConfig {
    mode: HarnessMode;
    byok?: {
        anthropic?: BYOKProviderConfig;
        openai?: BYOKProviderConfig;
        google?: BYOKProviderConfig;
    };
    cloud?: CloudConfig;
    local?: LocalConfig;
    subprocess?: SubprocessConfig;
}
/**
 * Message role types
 */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';
/**
 * Chat message structure
 */
export interface Message {
    role: MessageRole;
    content: string;
    name?: string;
    tool_calls?: ToolCall[];
    tool_call_id?: string;
}
/**
 * Tool parameter schema
 */
export interface ToolParameter {
    type: string;
    description?: string;
    enum?: string[];
    properties?: Record<string, ToolParameter>;
    required?: string[];
    items?: ToolParameter;
}
/**
 * Tool definition
 */
export interface Tool {
    name: string;
    description: string;
    parameters: ToolParameter;
}
/**
 * Tool call from assistant
 */
export interface ToolCall {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
}
/**
 * Stream request options
 */
export interface StreamRequest {
    provider: string;
    model: string;
    messages: Message[];
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    topK?: number;
    tools?: Tool[];
    stream?: boolean;
}
/**
 * Text content chunk
 */
export interface TextChunk {
    type: 'text';
    text: string;
}
/**
 * Tool call chunk (streaming)
 */
export interface ToolCallChunk {
    type: 'tool_call';
    id: string;
    name: string;
    arguments: string;
}
/**
 * Tool call complete chunk
 */
export interface ToolCallCompleteChunk {
    type: 'tool_call_complete';
    id: string;
    name: string;
    arguments: Record<string, unknown>;
}
/**
 * Tool result chunk
 */
export interface ToolResultChunk {
    type: 'tool_result';
    toolCallId: string;
    content: string;
}
/**
 * Error chunk
 */
export interface ErrorChunk {
    type: 'error';
    error: Error;
    code?: string;
}
/**
 * Stream complete chunk
 */
export interface DoneChunk {
    type: 'done';
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}
/**
 * All possible harness stream chunk types
 */
export type HarnessStreamChunk = TextChunk | ToolCallChunk | ToolCallCompleteChunk | ToolResultChunk | ErrorChunk | DoneChunk;
/**
 * Harness response (non-streaming)
 */
export interface HarnessResponse {
    content: string;
    toolCalls?: ToolCall[];
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}
/**
 * Provider-specific request transformation
 */
export interface ProviderRequestTransform {
    (request: StreamRequest): unknown;
}
/**
 * Provider-specific response transformation
 */
export interface ProviderResponseTransform {
    (response: unknown): HarnessStreamChunk;
}
/**
 * Error codes for harness operations
 */
export declare enum HarnessErrorCode {
    CONFIG_INVALID = "CONFIG_INVALID",
    MODE_UNSUPPORTED = "MODE_UNSUPPORTED",
    PROVIDER_NOT_FOUND = "PROVIDER_NOT_FOUND",
    API_ERROR = "API_ERROR",
    RATE_LIMITED = "RATE_LIMITED",
    TIMEOUT = "TIMEOUT",
    STREAM_ERROR = "STREAM_ERROR",
    AUTHENTICATION_ERROR = "AUTHENTICATION_ERROR",
    NETWORK_ERROR = "NETWORK_ERROR",
    UNKNOWN_ERROR = "UNKNOWN_ERROR"
}
/**
 * Harness-specific error class
 */
export declare class HarnessError extends Error {
    readonly code: HarnessErrorCode;
    readonly cause?: unknown;
    constructor(code: HarnessErrorCode, message: string, cause?: unknown);
}
