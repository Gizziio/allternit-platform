import type { ModelMessage } from "ai"

export type ProjectionAnomaly =
  | { kind: "tool_result_reordered"; toolCallId: string }
  | { kind: "tool_result_synthesized"; toolCallId: string }
  | { kind: "orphan_tool_result_dropped"; toolCallId: string }
  | { kind: "duplicate_tool_call_dropped"; toolCallId: string }
  | { kind: "duplicate_tool_result_dropped"; toolCallId: string }
  | { kind: "leading_non_user_dropped"; role: string }
  | { kind: "consecutive_assistants_merged" }
  | { kind: "whitespace_text_dropped"; role: string }

export namespace ContextProjector {
  export function project(input: readonly ModelMessage[]): { messages: ModelMessage[]; anomalies: ProjectionAnomaly[] } {
    const anomalies: ProjectionAnomaly[] = []
    const cleaned = cleanAndMerge(input, anomalies)
    const resultParts = collectToolResults(cleaned, anomalies)
    const emittedResults = new Set<string>()
    const seenCalls = new Set<string>()
    const output: ModelMessage[] = []

    for (const message of cleaned) {
      if (message.role === "tool") continue
      if (message.role !== "assistant" || !Array.isArray(message.content)) {
        output.push(message)
        continue
      }
      const content = message.content.filter((part: any) => {
        if (part.type !== "tool-call") return true
        if (seenCalls.has(part.toolCallId)) {
          anomalies.push({ kind: "duplicate_tool_call_dropped", toolCallId: part.toolCallId })
          return false
        }
        seenCalls.add(part.toolCallId)
        return true
      })
      if (content.length) output.push({ ...message, content } as ModelMessage)

      const calls = content.filter((part: any) => part.type === "tool-call") as any[]
      if (!calls.length) continue
      const toolContent = calls.map((call) => {
        const found = resultParts.get(call.toolCallId)
        if (found) {
          emittedResults.add(call.toolCallId)
          if (found.index !== cleaned.indexOf(message) + 1) {
            anomalies.push({ kind: "tool_result_reordered", toolCallId: call.toolCallId })
          }
          return found.part
        }
        anomalies.push({ kind: "tool_result_synthesized", toolCallId: call.toolCallId })
        return {
          type: "tool-result",
          toolCallId: call.toolCallId,
          toolName: call.toolName,
          output: { type: "text", value: "[Tool execution was interrupted before a result was recorded]" },
        }
      })
      output.push({ role: "tool", content: toolContent } as ModelMessage)
    }

    for (const [toolCallId] of resultParts) {
      if (!emittedResults.has(toolCallId)) anomalies.push({ kind: "orphan_tool_result_dropped", toolCallId })
    }
    while (output.length && !["user", "system"].includes(output[0]!.role)) {
      anomalies.push({ kind: "leading_non_user_dropped", role: output[0]!.role })
      output.shift()
    }
    return { messages: output, anomalies }
  }

  /** Read-side recovery for provider 413 responses; durable history is unchanged. */
  export function degradeOlderMedia(input: readonly ModelMessage[], keepRecent = 2): ModelMessage[] {
    let media = input.reduce((count, message) => count +
      (Array.isArray(message.content) ? message.content.filter(isMediaPart).length : 0), 0)
    let replace = Math.max(0, media - keepRecent)
    return input.map((message) => {
      if (!Array.isArray(message.content) || replace === 0) return message
      const content = message.content.map((part: any) => {
        if (!isMediaPart(part) || replace === 0) return part
        replace--
        return { type: "text", text: mediaPlaceholder(part, "request size limit") }
      })
      return { ...message, content } as ModelMessage
    })
  }

  /** Read-side compatibility fallback after an image-format rejection. */
  export function stripMedia(input: readonly ModelMessage[]): ModelMessage[] {
    return input.map((message) => {
      if (!Array.isArray(message.content)) return message
      const content = message.content.map((part: any) =>
        isMediaPart(part) ? { type: "text", text: mediaPlaceholder(part, "provider compatibility") } : part)
      return { ...message, content } as ModelMessage
    })
  }

  function collectToolResults(messages: readonly ModelMessage[], anomalies: ProjectionAnomaly[]) {
    const results = new Map<string, { part: unknown; index: number }>()
    messages.forEach((message, index) => {
      if (message.role !== "tool" || !Array.isArray(message.content)) return
      for (const part of message.content as any[]) {
        if (part.type !== "tool-result" || typeof part.toolCallId !== "string") continue
        if (results.has(part.toolCallId)) {
          anomalies.push({ kind: "duplicate_tool_result_dropped", toolCallId: part.toolCallId })
          continue
        }
        results.set(part.toolCallId, { part, index })
      }
    })
    return results
  }

  function cleanAndMerge(input: readonly ModelMessage[], anomalies: ProjectionAnomaly[]) {
    const output: ModelMessage[] = []
    for (const original of input) {
      let message = original
      if (Array.isArray(original.content)) {
        const content = original.content.filter((part: any) => {
          const blank = part.type === "text" && typeof part.text === "string" && !part.text.trim()
          if (blank) anomalies.push({ kind: "whitespace_text_dropped", role: original.role })
          return !blank
        })
        message = { ...original, content } as ModelMessage
        if (!content.length) continue
      }
      const previous = output.at(-1)
      if (previous?.role === "assistant" && message.role === "assistant" &&
        Array.isArray(previous.content) && Array.isArray(message.content)) {
        output[output.length - 1] = { ...previous, content: [...previous.content, ...message.content] } as ModelMessage
        anomalies.push({ kind: "consecutive_assistants_merged" })
      } else {
        output.push(message)
      }
    }
    return output
  }

  function isMediaPart(part: any) {
    return part?.type === "file" && typeof part.mediaType === "string" &&
      (part.mediaType.startsWith("image/") || part.mediaType === "application/pdf" || part.mediaType.startsWith("video/") || part.mediaType.startsWith("audio/"))
  }

  function mediaPlaceholder(part: any, reason: string) {
    const kind = part.mediaType?.split("/", 1)[0] === "application" ? "PDF" : part.mediaType?.split("/", 1)[0] ?? "media"
    return `[${kind} omitted for ${reason}; re-read the source or use a region/smaller copy]`
  }
}
