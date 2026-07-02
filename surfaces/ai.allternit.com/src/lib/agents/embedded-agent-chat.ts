import type { ModeSessionMessage } from "./mode-session-store";
import type { ChatMessage as StreamChatMessage, UIPart } from "@/lib/ai/rust-stream-adapter";

function normalizeRole(
  role: ModeSessionMessage["role"],
): StreamChatMessage["role"] {
  if (role === "tool") {
    return "assistant";
  }

  return role;
}

function normalizeContent(message: ModeSessionMessage): StreamChatMessage["content"] {
  if (message.role === "tool") {
    return `Tool result\n${message.content}`;
  }

  if (message.role === "assistant") {
    const rawToolParts = message.metadata?.agentElementsParts as Array<Record<string, unknown>> | undefined;
    const hasThinking = Boolean(message.thinking);
    const hasTools = rawToolParts && rawToolParts.length > 0;

    if (hasThinking || hasTools) {
      const parts: UIPart[] = [];

      if (hasThinking) {
        parts.push({
          type: "reasoning",
          reasoningId: `thinking-${message.id}`,
          text: message.thinking,
        } as UIPart);
      }

      // Convert agentElementsParts (type='tool-bash') → dynamic-tool ExtendedUIParts
      if (hasTools) {
        for (const tp of rawToolParts!) {
          const rawType = String(tp.type ?? '');
          const toolName = rawType.startsWith('tool-') ? rawType.slice(5) : rawType;
          parts.push({
            type: 'dynamic-tool',
            toolName,
            toolCallId: tp.toolCallId,
            input: tp.input,
            state: tp.state ?? 'output-available',
            result: tp.result ?? tp.output,
            error: tp.error,
          } as unknown as UIPart);
        }
      }

      if (message.content) {
        parts.push({ type: "text", text: message.content } as UIPart);
      }
      return parts;
    }
  }

  return message.content;
}

export function mapNativeMessagesToStreamMessages(
  messages: ModeSessionMessage[],
): StreamChatMessage[] {
  return messages.map((message) => ({
    id: message.id,
    role: normalizeRole(message.role),
    content: normalizeContent(message),
    createdAt: new Date(message.timestamp),
  }));
}
