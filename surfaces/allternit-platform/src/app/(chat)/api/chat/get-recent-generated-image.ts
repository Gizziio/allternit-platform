import type { ChatMessage, MessagePart } from "@/lib/ai/types";

/**
 * Scans the conversation history in reverse to locate the most recently
 * generated image.  The result is passed to generateImage so the model can
 * edit/animate the last image rather than generating from scratch.
 */
export function getRecentGeneratedImage(
  messages: ChatMessage[]
): { url: string } | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];

    // Parts array takes priority; fall back to content when it's an array
    const parts: MessagePart[] =
      msg.parts ??
      (Array.isArray(msg.content) ? (msg.content as MessagePart[]) : []);

    for (const part of parts) {
      if (!part.type.startsWith("tool-")) continue;

      const toolPart = part as Extract<MessagePart, { type: `tool-${string}` }>;
      if (
        toolPart.toolName !== "generateImage" ||
        toolPart.state !== "result" ||
        !toolPart.output
      ) {
        continue;
      }

      const output = toolPart.output as Record<string, unknown>;
      // Tool emits either `imageUrl` (direct) or `url` (normalised)
      const url =
        typeof output.imageUrl === "string"
          ? output.imageUrl
          : typeof output.url === "string"
            ? output.url
            : null;

      if (url) return { url };
    }
  }

  return null;
}
