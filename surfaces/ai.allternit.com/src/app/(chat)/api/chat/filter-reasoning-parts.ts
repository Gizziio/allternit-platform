import type { ChatMessage, MessagePart } from "@/lib/ai/types";

/**
 * Strips Anthropic extended-thinking ("reasoning") parts from messages before
 * sending to any model that doesn't support them.  Without this filter,
 * non-Anthropic models (and older Anthropic models without extended thinking
 * enabled) will reject or misinterpret the conversation history.
 */
export function filterPartsForLLM(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((msg) => {
    if (!msg.parts || msg.parts.length === 0) return msg;

    const filteredParts = msg.parts.filter(
      (part: MessagePart) => part.type !== "reasoning"
    );

    // If nothing changed, return the original message to avoid unnecessary allocations
    if (filteredParts.length === msg.parts.length) return msg;

    return { ...msg, parts: filteredParts };
  });
}
