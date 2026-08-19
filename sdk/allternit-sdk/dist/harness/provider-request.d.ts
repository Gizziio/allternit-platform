import type { HarnessStopReason, StreamRequest } from './types.js';
/** Map a provider-specific stop/finish reason to the normalized taxonomy. */
export declare function mapStopReason(provider: 'anthropic' | 'openai' | 'vertex', raw: string | undefined): HarnessStopReason | undefined;
export declare function hasCacheControl(request: StreamRequest): boolean;
/** Convert the normalized harness contract to an OpenAI-compatible body. */
export declare function toOpenAIRequest(request: StreamRequest): Record<string, unknown>;
/** Extract normalized usage from an OpenAI chat.completion response. */
export declare function parseOpenAIUsage(usage: Record<string, unknown>): {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cachedTokens?: number;
};
/** Convert the normalized harness contract to Anthropic Messages fields. */
export declare function toAnthropicRequest(request: StreamRequest): Record<string, unknown>;
/** Kimi's OpenAI-compatible API uses `thinking` instead of reasoning_effort. */
export declare function toKimiRequest(request: StreamRequest): Record<string, unknown>;
/** Convert the normalized harness contract to a Google Vertex AI (Gemini API) body. */
export declare function toVertexRequest(request: StreamRequest): Record<string, unknown>;
