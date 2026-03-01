import type { Part, SessionStatus } from "@a2r/sdk/v2"
import type { A2RRuntimeState } from "./theme"
import { isWebToolName } from "./runtime-mode"
import { A2RCopy } from "@/brand"

export function resolveRuntimeState(status: SessionStatus, parts: Part[], queued: boolean): A2RRuntimeState {
  if (queued && status.type === "idle") return "connecting"
  if (status.type === "idle") return "idle"
  if (status.type === "retry") return "connecting"
  if (parts.length === 0) return "connecting"
  if (parts.some((part) => part.type === "compaction")) return "compacting"
  const runningTools = parts
    .filter(
      (part): part is Extract<Part, { type: "tool" }> =>
        part.type === "tool" && (part.state.status === "pending" || part.state.status === "running"),
    )
    .map((part) => part.tool)
  if (runningTools.some((tool) => isWebToolName(tool))) return "web"
  if (runningTools.length > 0) {
    return "executing"
  }
  if (parts.some((part) => part.type === "reasoning")) return "planning"
  return "responding"
}

export type A2RFixtureState = { state: A2RRuntimeState; hint: string; tools?: string[] }

export function resolveFixtureState(
  modeRaw: string | undefined,
  startedAt: number | undefined,
  now: number,
  delayMs = 22_000,
): A2RFixtureState | undefined {
  const mode = (modeRaw ?? "").trim().toLowerCase()
  if (!mode || mode === "off") return undefined
  if (!startedAt) return undefined

  const elapsed = Math.max(0, now - startedAt)
  const finalWindow = Math.max(1_500, Math.min(4_000, Math.floor(delayMs * 0.2)))
  const executeWindowEnd = Math.max(3_000, delayMs - finalWindow)

  if (mode === "silent") {
    if (elapsed < delayMs) return { state: "connecting", hint: A2RCopy.session.hintQueued }
    return { state: "responding", hint: A2RCopy.session.hintResponding }
  }

  if (mode === "slow_response") {
    if (elapsed < 1_500) return { state: "connecting", hint: A2RCopy.session.hintConnecting }
    if (elapsed < 4_500) return { state: "planning", hint: A2RCopy.session.hintThinking }
    if (elapsed < delayMs) return { state: "responding", hint: A2RCopy.session.hintResponding }
    return { state: "responding", hint: A2RCopy.session.hintResponding }
  }

  if (mode === "slow_tools") {
    if (elapsed < 1_500) return { state: "connecting", hint: A2RCopy.session.hintConnecting }
    if (elapsed < 4_500) return { state: "planning", hint: A2RCopy.session.hintPlanning }
    if (elapsed < executeWindowEnd) {
      return {
        state: "web",
        hint: A2RCopy.session.hintWeb,
        tools: ["websearch", "context7", "grep_app"],
      }
    }
    return { state: "responding", hint: A2RCopy.session.hintResponding }
  }

  return undefined
}
