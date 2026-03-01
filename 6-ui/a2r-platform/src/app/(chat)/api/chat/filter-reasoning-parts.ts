import type { ChatMessage, MessagePart } from "@/lib/ai/types";

/**
 * Filters out reasoning parts from messages before sending to LLM.
 * This prevents reasoning tokens from being passed between models
 * that may not support or expect them.
 */
export function filterPartsForLLM(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((message) => {
    // If content is a string, return as-is
    if (typeof message.content === "string") {
      return message;
    }

    // Filter out reasoning parts from structured content
    const filteredParts = message.content.filter(
      (part): part is Exclude<MessagePart, { type: "reasoning" }> =>
        part.type !== "reasoning"
    );

    return {
      ...message,
      content: filteredParts,
    };
  });
}

/**
 * Alias for backward compatibility
 */
export { filterPartsForLLM as filterPartsForLlm };
