import type { ChatMessage, UiToolName } from "@/lib/ai/types";

/**
 * Adds explicit tool request markers to messages based on user-selected tools.
 * This helps the model understand which tools the user explicitly wants to use.
 */
export function addExplicitToolRequestToMessages(
  messages: ChatMessage[],
  explicitlyRequestedTools: UiToolName[] | null
): void {
  if (!explicitlyRequestedTools || explicitlyRequestedTools.length === 0) {
    return;
  }

  // Get the last user message
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUserMessage) {
    return;
  }

  // Build tool request text
  const toolRequests = explicitlyRequestedTools
    .map((tool) => {
      switch (tool) {
        case "webSearch":
          return "Please search the web for relevant information.";
        case "generateImage":
          return "Please generate an image based on my request.";
        case "deepResearch":
          return "Please conduct deep research on this topic.";
        case "codeExecution":
          return "Please execute code to solve this problem.";
        default:
          return null;
      }
    })
    .filter(Boolean);

  if (toolRequests.length === 0) {
    return;
  }

  // Append tool requests to the message content
  const requestText = "\n\n[" + toolRequests.join(" ") + "]";

  if (typeof lastUserMessage.content === "string") {
    lastUserMessage.content += requestText;
  } else if (Array.isArray(lastUserMessage.content)) {
    const textPart = lastUserMessage.content.find((p) => p.type === "text");
    if (textPart && "text" in textPart) {
      textPart.text += requestText;
    } else {
      lastUserMessage.content.push({
        type: "text",
        text: requestText.trim(),
      });
    }
  }
}
