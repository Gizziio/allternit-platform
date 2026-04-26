/**
 * @fileoverview Token estimation utilities for LLM interactions
 * @module runtime/services/tokenEstimation
 *
 * Provides token counting and estimation functions for various LLM models.
 * Supports both accurate encoding (when tiktoken is available) and
 * rough estimation based on character counts.
 */
import type { Message } from '../../types/message.js';
/**
 * Supported LLM models for token estimation
 * @typedef {'gpt-4' | 'gpt-4o' | 'gpt-4-turbo' | 'gpt-3.5-turbo' | 'claude-3-opus' | 'claude-3-sonnet' | 'claude-3-haiku' | 'claude-2' | 'gemini-pro' | 'gemini-ultra' | 'default'} SupportedModel
 */
export type SupportedModel = 'gpt-4' | 'gpt-4o' | 'gpt-4-turbo' | 'gpt-3.5-turbo' | 'claude-3-opus' | 'claude-3-sonnet' | 'claude-3-haiku' | 'claude-2' | 'gemini-pro' | 'gemini-ultra' | 'default';
/**
 * Token estimation configuration options
 * @interface TokenEstimationOptions
 */
export interface TokenEstimationOptions {
    /** Target model for estimation */
    readonly model?: SupportedModel;
    /** Whether to include formatting overhead in estimate */
    readonly includeFormatting?: boolean;
    /** Custom tokens per character ratio for rough estimation */
    readonly customRatio?: number;
}
/**
 * Token estimation result with metadata
 * @interface TokenEstimationResult
 */
export interface TokenEstimationResult {
    /** Estimated token count */
    readonly tokens: number;
    /** Method used for estimation */
    readonly method: 'precise' | 'rough';
    /** Model used for estimation */
    readonly model: SupportedModel;
    /** Confidence level (0-1) based on estimation method */
    readonly confidence: number;
}
/**
 * Model-specific token estimation ratios (characters per token)
 * These are approximate averages and vary by language/content
 * @constant {Readonly<Record<SupportedModel, number>>}
 */
export declare const MODEL_TOKEN_RATIOS: Readonly<Record<SupportedModel, number>>;
/**
 * Message format overhead in tokens (role markers, formatting, etc.)
 * @constant {number}
 */
export declare const MESSAGE_OVERHEAD_TOKENS = 4;
/**
 * Base overhead for a conversation (system prompts, etc.)
 * @constant {number}
 */
export declare const CONVERSATION_BASE_OVERHEAD = 3;
/**
 * Estimate tokens in a single text string
 *
 * @param {string} text - Text to estimate tokens for
 * @param {TokenEstimationOptions} options - Estimation options
 * @returns {TokenEstimationResult} Token estimation with metadata
 *
 * @example
 * ```typescript
 * const result = estimateTokens('Hello, world!', { model: 'gpt-4' });
 * console.log(result.tokens); // ~4 tokens
 * ```
 */
export declare function estimateTokens(text: string, options?: TokenEstimationOptions): TokenEstimationResult;
/**
 * Async version of estimateTokens that attempts to use tiktoken for precision
 *
 * @param {string} text - Text to estimate tokens for
 * @param {TokenEstimationOptions} options - Estimation options
 * @returns {Promise<TokenEstimationResult>} Token estimation with metadata
 *
 * @example
 * ```typescript
 * const result = await estimateTokensAsync('Hello, world!', { model: 'gpt-4' });
 * console.log(result.method); // 'precise' if tiktoken available
 * ```
 */
export declare function estimateTokensAsync(text: string, options?: TokenEstimationOptions): Promise<TokenEstimationResult>;
/**
 * Estimate tokens for an array of messages
 *
 * @param {readonly Message[]} messages - Messages to estimate tokens for
 * @param {TokenEstimationOptions} options - Estimation options
 * @returns {TokenEstimationResult} Total token estimation with metadata
 *
 * @example
 * ```typescript
 * const messages = [
 *   { role: 'system', content: 'You are a helpful assistant.' },
 *   { role: 'user', content: 'Hello!' }
 * ];
 * const result = estimateTokensForMessages(messages);
 * console.log(result.tokens); // Total estimated tokens
 * ```
 */
export declare function estimateTokensForMessages(messages: readonly Message[], options?: TokenEstimationOptions): TokenEstimationResult;
/**
 * Async version of estimateTokensForMessages with tiktoken support
 *
 * @param {readonly Message[]} messages - Messages to estimate tokens for
 * @param {TokenEstimationOptions} options - Estimation options
 * @returns {Promise<TokenEstimationResult>} Total token estimation with metadata
 */
export declare function estimateTokensForMessagesAsync(messages: readonly Message[], options?: TokenEstimationOptions): Promise<TokenEstimationResult>;
/**
 * Rough token count estimation without any dependencies
 * Uses a simple characters-per-token heuristic
 *
 * @param {string | readonly Message[]} input - Text or messages to estimate
 * @param {SupportedModel} model - Model for estimation ratios
 * @returns {number} Estimated token count
 *
 * @example
 * ```typescript
 * // Estimate text
 * const textTokens = roughTokenCountEstimation('Hello, world!');
 *
 * // Estimate messages
 * const messageTokens = roughTokenCountEstimation([
 *   { role: 'user', content: 'Hello!' }
 * ]);
 * ```
 */
export declare function roughTokenCountEstimation(input: string | readonly Message[], model?: SupportedModel): number;
/**
 * Check if text would exceed token limit
 *
 * @param {string} text - Text to check
 * @param {number} limit - Token limit
 * @param {TokenEstimationOptions} options - Estimation options
 * @returns {{ withinLimit: true } | { withinLimit: false; exceededBy: number }} Limit check result
 *
 * @example
 * ```typescript
 * const result = checkTokenLimit('Long text...', 100);
 * if (!result.withinLimit) {
 *   console.log(`Exceeded by ${result.exceededBy} tokens`);
 * }
 * ```
 */
export declare function checkTokenLimit(text: string, limit: number, options?: TokenEstimationOptions): {
    withinLimit: true;
} | {
    withinLimit: false;
    exceededBy: number;
};
/**
 * Truncate text to fit within token limit
 *
 * @param {string} text - Text to truncate
 * @param {number} maxTokens - Maximum token count
 * @param {TokenEstimationOptions} options - Estimation options
 * @returns {string} Truncated text
 *
 * @example
 * ```typescript
 * const truncated = truncateToTokenLimit(longText, 100);
 * ```
 */
export declare function truncateToTokenLimit(text: string, maxTokens: number, options?: TokenEstimationOptions): string;
/**
 * Get model-specific context window size
 *
 * @param {SupportedModel} model - Model name
 * @returns {number} Context window size in tokens
 */
export declare function getModelContextWindow(model: SupportedModel): number;
declare const _default: {
    estimateTokens: typeof estimateTokens;
    estimateTokensAsync: typeof estimateTokensAsync;
    estimateTokensForMessages: typeof estimateTokensForMessages;
    estimateTokensForMessagesAsync: typeof estimateTokensForMessagesAsync;
    roughTokenCountEstimation: typeof roughTokenCountEstimation;
    checkTokenLimit: typeof checkTokenLimit;
    truncateToTokenLimit: typeof truncateToTokenLimit;
    getModelContextWindow: typeof getModelContextWindow;
    MODEL_TOKEN_RATIOS: Readonly<Record<SupportedModel, number>>;
    MESSAGE_OVERHEAD_TOKENS: number;
    CONVERSATION_BASE_OVERHEAD: number;
};
export default _default;
