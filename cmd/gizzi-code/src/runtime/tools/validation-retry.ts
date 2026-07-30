import type z from "zod/v4"

interface ValidationErrorEntry {
  tool: string
  message: string
}

interface SessionState {
  streaks: Map<string, number>
  errors: ValidationErrorEntry[]
  touchedAt: number
}

const sessions = new Map<string, SessionState>()
const MAX_SESSION_STATES = 256
const ERROR_WINDOW = 3

function state(sessionID: string): SessionState {
  const existing = sessions.get(sessionID)
  if (existing) {
    existing.touchedAt = Date.now()
    return existing
  }
  if (sessions.size >= MAX_SESSION_STATES) {
    const oldest = [...sessions.entries()].sort((a, b) => a[1].touchedAt - b[1].touchedAt)[0]
    if (oldest) sessions.delete(oldest[0])
  }
  const created: SessionState = { streaks: new Map(), errors: [], touchedAt: Date.now() }
  sessions.set(sessionID, created)
  return created
}

// In-memory, per-session retry cap for tool-call argument validation failures. Mirrors ToolDedupe's tracking (dedupe.ts).
export namespace ToolValidationRetry {
  export const MAX_CONSECUTIVE_FAILURES = 3

  // Compact "path: message" summary, one line per zod issue — same style as batch.ts's formatValidationError.
  export function summarize(error: z.ZodError): string {
    return error.issues
      .map((issue) => `${issue.path.length > 0 ? issue.path.join(".") : "root"}: ${issue.message}`)
      .join("; ")
  }

  // Returns the new consecutive-failure count for `tool` in `sessionID` (reset by recordSuccess).
  export function recordFailure(sessionID: string, tool: string, message: string): number {
    const s = state(sessionID)
    const count = (s.streaks.get(tool) ?? 0) + 1
    s.streaks.set(tool, count)
    s.errors.push({ tool, message })
    if (s.errors.length > ERROR_WINDOW) s.errors.shift()
    return count
  }

  export function recordSuccess(sessionID: string, tool: string) {
    sessions.get(sessionID)?.streaks.delete(tool)
  }

  // One-line-per-error reminder for the system/reminder context; undefined when there's nothing to report.
  export function reminder(sessionID: string): string | undefined {
    const s = sessions.get(sessionID)
    if (!s || s.errors.length === 0) return undefined
    return [
      "<tool-validation-errors>",
      "Recent tool calls failed argument validation. Fix the arguments before retrying:",
      ...s.errors.map((e) => `- ${e.tool}: ${e.message}`),
      "</tool-validation-errors>",
    ].join("\n")
  }

  // Called at the start of a new user turn so an unrelated earlier failure doesn't cap a fresh attempt.
  export function resetSession(sessionID: string) {
    sessions.delete(sessionID)
  }

  /** @internal test/reset hook, mirrors ToolDedupe.reset. */
  export function reset() {
    sessions.clear()
  }
}
