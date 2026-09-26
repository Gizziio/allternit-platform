/** Tool-part → chat SSE frame mapping shared by the agent-chat bridge. */

/**
 * SSE frames for a session tool part — the same wire the web client already
 * parses (Anthropic-style content_block_start tool_use, then tool_result or
 * tool_error). Applies to every provider: SDK-executed tools and CLI-observed
 * tools both land as `tool` parts on the bus. `sent` de-duplicates repeated
 * part updates so each call yields exactly one start and one end.
 */
export function toolFramesForPart(
  part: any,
  messageId: string,
  sent: Map<string, "start" | "end">,
): Array<Record<string, unknown>> {
  const callID = typeof part?.callID === "string" ? part.callID : ""
  if (!callID || sent.get(callID) === "end") return []
  const status = part?.state?.status
  const toolName = typeof part?.tool === "string" ? part.tool : "tool"
  const frames: Array<Record<string, unknown>> = []
  const settled = status === "completed" || status === "error"
  if (!sent.has(callID) && (settled || status === "pending" || status === "running")) {
    frames.push({
      type: "content_block_start",
      messageId,
      content_block: { type: "tool_use", id: callID, name: toolName, input: part?.state?.input ?? {} },
    })
    sent.set(callID, "start")
  }
  if (settled) {
    frames.push(
      status === "completed"
        ? { type: "tool_result", messageId, toolCallId: callID, toolName, result: part?.state?.output ?? "" }
        : { type: "tool_error", messageId, toolCallId: callID, toolName, error: String(part?.state?.error ?? "Tool execution failed") },
    )
    sent.set(callID, "end")
  }
  return frames
}
