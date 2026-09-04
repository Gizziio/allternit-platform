import { Log } from "@/shared/util/log"
import type { HookEvent, HookResponse } from "../types"

const log = Log.create({ service: "hooks.command" })

export class CommandHookExecutor {
  static async execute(
    command: string,
    event: HookEvent,
    timeout: number = 10000,
  ): Promise<HookResponse | null> {
    try {
      const proc = Bun.spawn(["sh", "-c", command], {
        stdin: new Blob([JSON.stringify(event)]),
        stdout: "pipe",
        stderr: "pipe",
        env: {
          ...process.env,
          GIZZI_HOOK_EVENT: event.name,
          GIZZI_HOOK_SESSION_ID: event.sessionId,
        },
      })

      const timer = setTimeout(() => {
        try { proc.kill() } catch { /* process may already have exited */ }
      }, timeout)

      const exitCode = await proc.exited
      clearTimeout(timer)

      const stderr = await new Response(proc.stderr).text()
      if (exitCode === 2) {
        return { decision: "deny", reason: stderr.trim() || "Hook blocked this operation" }
      }
      if (exitCode !== 0) {
        log.warn("Command hook failed open", {
          command,
          exitCode,
          stderr: stderr.slice(0, 500),
        })
        return { decision: "allow" }
      }

      const stdout = await new Response(proc.stdout).text()
      const trimmed = stdout.trim()

      if (!trimmed) {
        // Empty stdout means allow (no opinion)
        return { decision: "allow" }
      }

      try {
        const parsed = JSON.parse(trimmed) as HookResponse & {
          hookSpecificOutput?: { permissionDecision?: string; permissionDecisionReason?: string }
        }
        if (parsed.hookSpecificOutput?.permissionDecision === "deny") {
          return { decision: "deny", reason: parsed.hookSpecificOutput.permissionDecisionReason }
        }
        return parsed.decision ? parsed : { decision: "allow", message: trimmed }
      } catch {
        return { decision: "allow", message: trimmed }
      }
    } catch (e) {
      log.error("Command hook execution failed", { command, error: e })
      return null
    }
  }
}
