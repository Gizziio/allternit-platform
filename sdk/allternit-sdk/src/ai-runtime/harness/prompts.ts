/**
 * AllternitHarness Prompts
 * System prompt injection and prompt management
 */

import { Message, MessageRole } from './types.js';

/**
 * Core Allternit system prompt
 * Injected into all conversations to establish identity and behavior
 */
export const ALLTERNIT_SYSTEM_PROMPT = `You are Allternit, an AI assistant built by PrimeArc.

Your purpose is to help users accomplish their goals through intelligent automation,
workflow orchestration, and seamless integration with various services and tools.

Key characteristics:
- You are helpful, accurate, and concise in your responses
- You excel at breaking down complex tasks into manageable steps
- You can leverage tools and workflows when appropriate
- You maintain context across conversations for continuity
- You prioritize user privacy and data security

When using tools:
- Only call tools when they genuinely help accomplish the user's goal
- Explain your reasoning before making tool calls when appropriate
- Handle errors gracefully and provide actionable feedback

You are running within the Allternit harness, which provides:
- Unified access to multiple AI providers
- Tool calling capabilities
- Streaming responses
- Workflow integration`;

/**
 * Tool-use specific system prompt augmentation
 * Added when tools are available in the request
 */
export const TOOL_USE_PROMPT_ADDENDUM = `

You have access to tools that can help accomplish tasks. When using tools:
- Analyze the available tools before responding
- Call tools when they provide clear value
- Chain multiple tool calls when a sequence is needed
- Wait for tool results before making additional tool calls`;

/**
 * Provider-specific prompt adjustments
 */
export const PROVIDER_PROMPTS: Record<string, string> = {
  anthropic: '',
  openai: '',
  google: '',
  // Provider-specific adjustments can be added here
};

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
export function injectSystemPrompt(
  messages: Message[],
  hasTools: boolean = false
): Message[] {
  if (!Array.isArray(messages)) {
    throw new Error('Messages must be an array');
  }

  // Build the full system prompt
  let fullSystemPrompt = ALLTERNIT_SYSTEM_PROMPT;
  
  if (hasTools) {
    fullSystemPrompt += TOOL_USE_PROMPT_ADDENDUM;
  }

  // Find existing system message index
  const systemIndex = messages.findIndex((m) => m.role === 'system');

  if (systemIndex === -1) {
    // No system message exists - add ours at the beginning
    const systemMessage: Message = {
      role: 'system' as MessageRole,
      content: fullSystemPrompt,
    };
    return [systemMessage, ...messages];
  }

  // System message exists - prepend Allternit prompt
  const existingContent = messages[systemIndex].content;
  const mergedContent = `${fullSystemPrompt}\n\n---\n\n${existingContent}`;

  const newMessages = [...messages];
  newMessages[systemIndex] = {
    ...messages[systemIndex],
    content: mergedContent,
  };

  return newMessages;
}

/**
 * Injects provider-specific prompt adjustments
 * 
 * @param messages - Message array (already with system prompt)
 * @param provider - Provider name
 * @returns Modified message array with provider adjustments
 */
export function injectProviderPrompt(
  messages: Message[],
  provider: string
): Message[] {
  const providerAddendum = PROVIDER_PROMPTS[provider.toLowerCase()];
  
  if (!providerAddendum) {
    return messages;
  }

  const systemIndex = messages.findIndex((m) => m.role === 'system');
  
  if (systemIndex === -1) {
    return messages;
  }

  const newMessages = [...messages];
  newMessages[systemIndex] = {
    ...messages[systemIndex],
    content: `${messages[systemIndex].content}\n\n${providerAddendum}`,
  };

  return newMessages;
}

/**
 * Validates that messages are properly formatted
 * 
 * @param messages - Message array to validate
 * @returns True if valid, throws otherwise
 */
export function validateMessages(messages: Message[]): boolean {
  if (!Array.isArray(messages)) {
    throw new Error('Messages must be an array');
  }

  if (messages.length === 0) {
    throw new Error('Messages array cannot be empty');
  }

  for (const [index, message] of messages.entries()) {
    if (!message.role || !message.content) {
      throw new Error(`Message at index ${index} missing required fields (role, content)`);
    }

    const validRoles: MessageRole[] = ['system', 'user', 'assistant', 'tool'];
    if (!validRoles.includes(message.role)) {
      throw new Error(
        `Message at index ${index} has invalid role: ${message.role}`
      );
    }

    if (typeof message.content !== 'string') {
      throw new Error(`Message at index ${index} content must be a string`);
    }
  }

  return true;
}

/**
 * Creates a fresh message array with only the system prompt
 * Useful for resetting conversation context
 * 
 * @param hasTools - Whether to include tool guidance
 * @returns Message array with just system prompt
 */
export function createSystemOnlyMessages(hasTools: boolean = false): Message[] {
  let content = ALLTERNIT_SYSTEM_PROMPT;
  
  if (hasTools) {
    content += TOOL_USE_PROMPT_ADDENDUM;
  }

  return [
    {
      role: 'system' as MessageRole,
      content,
    },
  ];
}
