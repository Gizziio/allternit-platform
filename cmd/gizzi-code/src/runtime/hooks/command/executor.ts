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
        try { proc.kill() } catch {}
      }, timeout)

      const exitCode = await proc.exited
      clearTimeout(timer)

      if (exitCode !== 0) {
        const stderr = await new Response(proc.stderr).text()
        log.error("Command hook exited with non-zero status", {
          command,
          exitCode,
          stderr: stderr.slice(0, 500),
        })
        return null
      }

      const stdout = await new Response(proc.stdout).text()
      const trimmed = stdout.trim()

      if (!trimmed) {
        // Empty stdout means allow (no opinion)
        return { decision: "allow" }
      }

      try {
        return JSON.parse(trimmed) as HookResponse
      } catch {
        // Non-JSON stdout: treat non-empty as a deny reason
        log.warn("Command hook returned non-JSON output, treating as deny", { command, output: trimmed.slice(0, 200) })
        return { decision: "deny", reason: trimmed }
      }
    } catch (e) {
      log.error("Command hook execution failed", { command, error: e })
      return null
    }
  }
}
