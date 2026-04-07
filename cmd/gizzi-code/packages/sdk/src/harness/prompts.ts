/**
 * System prompts for Allternit SDK
 */

/**
 * Default system prompt for Allternit AI interactions
 */
export const ALLTERNIT_SYSTEM_PROMPT = `You are a helpful AI assistant powered by Allternit. You have access to various tools and capabilities through the Allternit SDK.

Follow these guidelines:
- Be concise but thorough in your responses
- Use tools when they can help answer user queries
- Always prioritize user safety and privacy
- If unsure about something, acknowledge your limitations`;

/**
 * Addendum for tool use prompts
 */
export const TOOL_USE_PROMPT_ADDENDUM = `

You have access to tools that can help you complete tasks. When using tools:
- Choose the appropriate tool for the task
- Provide clear, structured arguments
- Interpret results accurately and explain them to the user`;

/**
 * Inject system prompt into a message array
 */
export function injectSystemPrompt(
  messages: Array<{ role: string; content: string }>,
  systemPrompt: string = ALLTERNIT_SYSTEM_PROMPT
): Array<{ role: string; content: string }> {
  // Check if there's already a system message
  const hasSystem = messages.some((m) => m.role === 'system');
  
  if (hasSystem) {
    // Replace existing system message
    return messages.map((m) =>
      m.role === 'system' ? { ...m, content: systemPrompt } : m
    );
  }
  
  // Add new system message at the beginning
  return [{ role: 'system', content: systemPrompt }, ...messages];
}
