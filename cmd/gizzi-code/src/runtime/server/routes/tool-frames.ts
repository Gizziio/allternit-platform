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

/**
 * Run usage for the finish frame from gizzi's assistant message info.
 * Input/output whenever present; cached/reasoning tokens and cost only when
 * the provider reported them, so clients can tell "not reported" from zero.
 */
export function usageFromMessageInfo(info: any): Record<string, number> | undefined {
  const tokens = info?.tokens
  if (typeof tokens?.input !== "number" && typeof tokens?.output !== "number") return undefined
  const usage: Record<string, number> = {
    inputTokens: typeof tokens.input === "number" ? tokens.input : 0,
    outputTokens: typeof tokens.output === "number" ? tokens.output : 0,
  }
  const positive = (n: unknown) => (typeof n === "number" && n > 0 ? n : undefined)
  const cacheRead = positive(tokens?.cache?.read)
  const cacheWrite = positive(tokens?.cache?.write)
  const reasoning = positive(tokens?.reasoning)
  const cost = positive(info?.cost)
  if (cacheRead) usage.cacheReadTokens = cacheRead
  if (cacheWrite) usage.cacheWriteTokens = cacheWrite
  if (reasoning) usage.reasoningTokens = reasoning
  if (cost) usage.cost = cost
  return usage
}
