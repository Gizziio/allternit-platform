import type { ChatMessage } from "@/lib/ai/types";

export interface GeneratedImageReference {
  url: string;
  prompt?: string;
  timestamp: number;
}

/**
 * Finds the most recently generated image in the conversation history.
 * Used for image editing/modification requests.
 */
export function getRecentGeneratedImage(
  messages: ChatMessage[]
): GeneratedImageReference | undefined {
  // Search from the most recent message backwards
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];

    // Check message content for image parts
    if (typeof message.content !== "string") {
      // Look for image parts in structured content
      for (const part of message.content) {
        if (part.type === "image") {
          return {
            url: part.url,
            timestamp: Date.now(), // Could extract from message metadata
          };
        }
      }
    }

    // Check for generated image tool results
    if (typeof message.content !== "string") {
      const toolResult = message.content.find(
        (part): part is {
          type: `tool-${string}`;
          toolCallId: string;
          toolName: string;
          state: "result";
          output: unknown;
        } =>
          part.type.startsWith("tool-") &&
          "toolName" in part &&
          part.toolName === "generateImage" &&
          "state" in part &&
          part.state === "result"
      );

      if (toolResult && typeof toolResult.output === "object") {
        const output = toolResult.output as { imageUrl?: string; prompt?: string };
        if (output.imageUrl) {
          return {
            url: output.imageUrl,
            prompt: output.prompt,
            timestamp: Date.now(),
          };
        }
      }
    }
  }

  return undefined;
}
