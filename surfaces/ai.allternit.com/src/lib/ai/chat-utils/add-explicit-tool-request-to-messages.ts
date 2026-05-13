import type { ChatMessage, ToolName } from "@/lib/ai/types";

/**
 * Mutates the messages array in-place to append a system directive when the
 * user has explicitly requested specific tools.  The directive keeps the model
 * honest: even when its default heuristic would skip a tool, an explicit
 * request means "you MUST invoke this".
 */
export function addExplicitToolRequestToMessages(
  messages: ChatMessage[],
  explicitlyRequestedTools: ToolName[] | null
): void {
  if (!explicitlyRequestedTools || explicitlyRequestedTools.length === 0) return;

  const validTools = explicitlyRequestedTools.filter(
    (t): t is Exclude<ToolName, null> => t !== null
  );
  if (validTools.length === 0) return;

  const toolList = validTools.join(", ");

  messages.push({
    id: `explicit-tool-request-${Date.now()}`,
    role: "system",
    content: `TOOL DIRECTIVE: The user has explicitly requested the following tool(s): ${toolList}. You MUST invoke the requested tool(s) to respond to this message.`,
  });
}
