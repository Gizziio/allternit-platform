// @ts-nocheck
/**
 * Role-alternation normalizer for local chat completions.
 *
 * Some local chat templates (notably Gemma3 via mlx_lm.server) reject the
 * OpenAI-style `system` and `tool` roles and consecutive same-role messages
 * with "Conversation roles must alternate user/assistant/user/assistant/...".
 * Local providers run agent transcripts with a system prompt and tool turns,
 * so the message list must be rewritten:
 *
 * - `system` is folded into the first `user` message (or becomes one if the
 *   transcript starts with an assistant turn).
 * - `tool` results become `user` messages with a tool-result prefix — this is
 *   the standard fallback for templates without native tool support and is
 *   accepted by servers that do have it.
 * - consecutive same-role messages are merged.
 *
 * Assistant messages keep their `tool_calls`; the resulting sequence is
 * strictly alternating user/assistant.
 */

export type ChatMessage = {
  role: string
  content?: string | null
  tool_call_id?: string
  tool_calls?: unknown[]
}

export function normalizeRoleAlternation(messages: ChatMessage[]): ChatMessage[] {
  const out: ChatMessage[] = []
  let pendingSystem: string | undefined

  const flushSystemInto = (content: string): string => {
    if (pendingSystem === undefined) return content
    const merged = content ? pendingSystem + "\n\n" + content : pendingSystem
    pendingSystem = undefined
    return merged
  }

  for (const m of messages) {
    if (m.role === "system") {
      pendingSystem =
        pendingSystem === undefined ? (m.content ?? "") : pendingSystem + "\n\n" + (m.content ?? "")
      continue
    }

    if (m.role === "tool") {
      const prefix = `[tool result${m.tool_call_id ? ` ${m.tool_call_id}` : ""}]`
      const body = m.content ?? ""
      const content = flushSystemInto(prefix + "\n" + body)
      const last = out[out.length - 1]
      if (last && last.role === "user" && !last.tool_calls) {
        last.content = (last.content ?? "") + "\n\n" + content
      } else {
        out.push({ role: "user", content })
      }
      continue
    }

    if (m.role === "user") {
      const content = flushSystemInto(m.content ?? "")
      const last = out[out.length - 1]
      if (last && last.role === "user" && !last.tool_calls) {
        last.content = (last.content ?? "") + "\n\n" + content
      } else {
        out.push({ role: "user", content })
      }
      continue
    }

    if (m.role === "assistant") {
      out.push({ role: "assistant", content: m.content ?? "", ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}) })
      continue
    }

    out.push({ ...m })
  }

  if (pendingSystem !== undefined) {
    out.unshift({ role: "user", content: pendingSystem })
  }

  return out
}
