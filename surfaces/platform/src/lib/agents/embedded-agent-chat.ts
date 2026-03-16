import type { NativeMessage } from "./native-agent.store";
import type { ChatMessage as StreamChatMessage } from "@/lib/ai/rust-stream-adapter";

function normalizeRole(
  role: NativeMessage["role"],
): StreamChatMessage["role"] {
  if (role === "tool") {
    return "assistant";
  }

  return role;
}

function normalizeContent(message: NativeMessage): string {
  if (message.role === "tool") {
    return `Tool result\n${message.content}`;
  }

  return message.content;
}

export function mapNativeMessagesToStreamMessages(
  messages: NativeMessage[],
): StreamChatMessage[] {
  return messages.map((message) => ({
    id: message.id,
    role: normalizeRole(message.role),
    content: normalizeContent(message),
    createdAt: new Date(message.timestamp),
  }));
}
