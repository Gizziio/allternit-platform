/**
 * Allternit Harness - Core Types
 * Unified AI interface for BYOK, Cloud, Local, and Subprocess modes
 */
import { AllternitError } from '../providers/anthropic/core/error';
export interface HarnessConfig {
    mode: 'byok' | 'cloud' | 'local' | 'subprocess';
    byok?: BYOKConfig;
    cloud?: CloudConfig;
    local?: LocalConfig;
    subprocess?: SubprocessConfig;
}
export interface BYOKConfig {
    /** API keys for different providers */
    keys: {
        anthropic?: string;
        openai?: string;
        google?: string;
    };
    /** Optional base URLs for custom endpoints */
    baseURLs?: {
        anthropic?: string;
        openai?: string;
        google?: string;
    };
}
export interface CloudConfig {
    /** Allternit API base URL */
    baseURL: string;
    /** OAuth access token */
    accessToken: string;
    /** Optional refresh token */
    refreshToken?: string;
    /** Token expiration timestamp */
    expiresAt?: string;
}
export interface LocalConfig {
    /** Ollama server URL (default: http://localhost:11434) */
    baseURL: string;
    /** Optional API key for authenticated Ollama instances */
    apiKey?: string;
}
export interface SubprocessConfig {
    /** Command to spawn (e.g., "claude -p" or "kimi") */
    command: string;
    /** Working directory for the subprocess */
    cwd?: string;
    /** Environment variables to pass to subprocess */
    env?: Record<string, string>;
    /** Timeout in milliseconds (default: 60000) */
    timeout?: number;
}
export interface Message {
    role: 'system' | 'user' | 'assistant';
    content: string | Array<ContentBlock>;
}
export type ContentBlock = {
    type: 'text';
    text: string;
} | {
    type: 'image';
    source: ImageSource;
} | {
    type: 'tool_use';
    id: string;
    name: string;
    input: Record<string, unknown>;
} | {
    type: 'tool_result';
    tool_use_id: string;
    content: string | Array<ContentBlock>;
    is_error?: boolean;
};
export interface ImageSource {
    type: 'base64';
    media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
    data: string;
}
export interface Tool {
    name: string;
    description: string;
    input_schema: {
        type: 'object';
        properties: Record<string, unknown>;
        required?: string[];
    };
}
export interface StreamRequest {
    /** Provider identifier: 'anthropic', 'openai', 'google', 'ollama', etc. */
    provider: string;
    /** Model identifier */
    model: string;
    /** Messages in the conversation */
    messages: Message[];
    /** Sampling temperature (0.0 - 1.0) */
    temperature?: number;
    /** Maximum tokens to generate */
    maxTokens?: number;
    /** Available tools */
    tools?: Tool[];
    /** AbortSignal for cancellation */
    signal?: AbortSignal;
}
export interface HarnessResponse {
    id: string;
    model: string;
    content: Array<ContentBlock>;
    role: 'assistant';
    stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use' | null;
    usage: {
        input_tokens: number;
        output_tokens: number;
    };
}
export type HarnessStreamChunk = {
    type: 'text';
    text: string;
} | {
    type: 'tool_call';
    name: string;
    arguments: Record<string, unknown>;
    id: string;
} | {
    type: 'tool_result';
    content: string;
    tool_use_id: string;
} | {
    type: 'thinking';
    thinking: string;
} | {
    type: 'error';
    error: AllternitError;
} | {
    type: 'usage';
    input_tokens: number;
    output_tokens: number;
} | {
    type: 'done';
};
export interface ProviderInfo {
    id: string;
    name: string;
    description: string;
    modes: Array<'byok' | 'cloud' | 'local' | 'subprocess'>;
}
export interface ModelInfo {
    id: string;
    name: string;
    provider: string;
    capabilities: string[];
    context_window: number;
    max_output_tokens?: number;
}
export type ProviderType = 'anthropic' | 'openai' | 'google' | 'ollama';
export interface SSEEvent {
    event: string | null;
    data: string;
}
export { HarnessError, HarnessErrorCode } from './errors.js';
//# sourceMappingURL=types.d.ts.map