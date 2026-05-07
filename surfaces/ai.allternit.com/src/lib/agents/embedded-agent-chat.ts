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

  if (message.role === "assistant" && message.thinking) {
    const parts: UIPart[] = [
      {
        type: "reasoning",
        reasoningId: `thinking-${message.id}`,
        text: message.thinking,
      } as UIPart,
    ];
    if (message.content) {
      parts.push({ type: "text", text: message.content } as UIPart);
    }
    return parts;
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
