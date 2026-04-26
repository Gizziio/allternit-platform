/**
 * AllternitHarness Prompts
 * System prompt injection and prompt management
 */
import { Message } from './types.js';
/**
 * Core Allternit system prompt
 * Injected into all conversations to establish identity and behavior
 */
export declare const ALLTERNIT_SYSTEM_PROMPT = "You are Allternit, an AI assistant built by PrimeArc.\n\nYour purpose is to help users accomplish their goals through intelligent automation,\nworkflow orchestration, and seamless integration with various services and tools.\n\nKey characteristics:\n- You are helpful, accurate, and concise in your responses\n- You excel at breaking down complex tasks into manageable steps\n- You can leverage tools and workflows when appropriate\n- You maintain context across conversations for continuity\n- You prioritize user privacy and data security\n\nWhen using tools:\n- Only call tools when they genuinely help accomplish the user's goal\n- Explain your reasoning before making tool calls when appropriate\n- Handle errors gracefully and provide actionable feedback\n\nYou are running within the Allternit harness, which provides:\n- Unified access to multiple AI providers\n- Tool calling capabilities\n- Streaming responses\n- Workflow integration";
/**
 * Tool-use specific system prompt augmentation
 * Added when tools are available in the request
 */
export declare const TOOL_USE_PROMPT_ADDENDUM = "\n\nYou have access to tools that can help accomplish tasks. When using tools:\n- Analyze the available tools before responding\n- Call tools when they provide clear value\n- Chain multiple tool calls when a sequence is needed\n- Wait for tool results before making additional tool calls";
/**
 * Provider-specific prompt adjustments
 */
export declare const PROVIDER_PROMPTS: Record<string, string>;
/**
 * Injects the Allternit system prompt into the message array
 *
 * Rules:
 * - If no system message exists, adds one at the beginning
 * - If a system message exists, prepends Allternit prompt to it
 * - Preserves all other messages in order
 * - Optionally adds tool-use guidance if tools are present
 *
 * @param messages - Original message array
 * @param hasTools - Whether tools are available in the request
 * @returns Modified message array with system prompt injected
 */
export declare function injectSystemPrompt(messages: Message[], hasTools?: boolean): Message[];
/**
 * Injects provider-specific prompt adjustments
 *
 * @param messages - Message array (already with system prompt)
 * @param provider - Provider name
 * @returns Modified message array with provider adjustments
 */
export declare function injectProviderPrompt(messages: Message[], provider: string): Message[];
/**
 * Validates that messages are properly formatted
 *
 * @param messages - Message array to validate
 * @returns True if valid, throws otherwise
 */
export declare function validateMessages(messages: Message[]): boolean;
/**
 * Creates a fresh message array with only the system prompt
 * Useful for resetting conversation context
 *
 * @param hasTools - Whether to include tool guidance
 * @returns Message array with just system prompt
 */
export declare function createSystemOnlyMessages(hasTools?: boolean): Message[];
