import { existsSync, readFileSync, statSync } from "fs"
import { homedir } from "os"
import path from "path"
import { Log } from "@/shared/util/log"

/**
 * Bridge: Claude-Code-style settings.json hooks (`hooks: { PreToolUse: [...] }`)
 * on the headless/runtime tool-dispatch path.
 *
 * The TUI executors (src/cli/ui/ink-app/utils/hooks.ts) cannot be imported
 * here — their module graph (bootstrap state, analytics, React-adjacent
 * settings modules) hangs outside the ink app. This module reimplements only
 * the small contained part the runtime needs:
 *
 * - settings file resolution, mirroring the ink-app settings module:
 *   user = <GIZZI_CONFIG_DIR ?? ~/.gizzi>/settings.json;
 *   project = <cwd>/.gizzi/settings.json with <cwd>/.claude/settings.json
 *   fallback; local = same for settings.local.json. Managed/policy settings
 *   are NOT read here (deferred — see report).
 * - matcher filtering with the TUI's matchesPattern semantics, minus the
 *   legacy tool-name alias table; runtime tool ids are lowercase canonical
 *   ("bash"), so simple-name matching is case-insensitive to accept
 *   Claude-style matchers ("Bash", "Write|Edit").
 * - `type: "command"` hook execution with the Claude Code stdin/stdout
 *   contract: stdin gets {session_id, cwd, hook_event_name, tool_name,
 *   tool_input, tool_response?/error?}; exit 2 denies with stderr as the
 *   reason; any other non-zero exit fails open; exit-0 stdout may be JSON
 *   with {decision: "block"} or hookSpecificOutput.permissionDecision.
 *
 * Deferred (TUI-only for now): prompt/agent/http settings hook types,
 * managed/policy settings hooks, `if` conditions, async/once flags, and
 * hookSpecificOutput.updatedInput arg rewriting.
 */
export namespace SettingsHooksBridge {
  const log = Log.create({ service: "hooks.settings" })

  export type ToolHookEventName = "PreToolUse" | "PostToolUse" | "PostToolUseFailure"

  interface HookCommand {
    type?: string
    command?: string
    timeout?: number
  }

  interface HookMatcher {
    matcher?: string
    hooks?: HookCommand[]
  }

  type HooksConfig = Record<string, HookMatcher[]>

  export interface ToolHookInput {
    sessionId: string
    cwd: string
    toolName: string
    toolInput: unknown
    toolResponse?: unknown
    error?: unknown
  }

  export interface Decision {
    decision: "allow" | "deny"
    reason?: string
  }

  const ALLOW: Decision = { decision: "allow" }
  const DEFAULT_TIMEOUT_MS = 60_000

  function configHome(): string {
    return process.env.GIZZI_CONFIG_DIR ?? path.join(homedir(), ".gizzi")
  }

  /**
   * Settings files in merge order (user, then project, then local). Mirrors
   * getRelativeSettingsFilePathForSource in the ink-app settings module:
   * gizzi-first per file with a .claude fallback — the .claude file is only
   * read when the .gizzi sibling does not exist.
   */
  function settingsFiles(cwd: string): string[] {
    const files = [path.join(configHome(), "settings.json")]
    for (const name of ["settings.json", "settings.local.json"]) {
      const gizzi = path.join(cwd, ".gizzi", name)
      const claude = path.join(cwd, ".claude", name)
      if (existsSync(gizzi)) files.push(gizzi)
      else if (existsSync(claude)) files.push(claude)
    }
    return files
  }

  // Parsed-hooks cache keyed on the (path, mtime, size) signature of every
  // candidate file, so external settings edits are picked up on the next
  // tool call without re-reading unchanged files on each dispatch.
  let cacheSignature = ""
  let cacheValue: HooksConfig = {}

  function loadHooks(cwd: string): HooksConfig {
    const files = settingsFiles(cwd)
    let signature = ""
    for (const file of files) {
      try {
        const stat = statSync(file)
        signature += `${file}:${stat.mtimeMs}:${stat.size};`
      } catch {
        signature += `${file}:missing;`
      }
    }
    if (signature === cacheSignature) return cacheValue

    let disabled = false
    const merged: HooksConfig = {}
    for (const file of files) {
      let parsed: any
      try {
        parsed = JSON.parse(readFileSync(file, "utf8"))
      } catch {
        continue
      }
      if (parsed?.disableAllHooks === true) disabled = true
      const hooks = parsed?.hooks
      if (!hooks || typeof hooks !== "object") continue
      for (const [event, matchers] of Object.entries(hooks)) {
        if (!Array.isArray(matchers)) continue
        const list = (merged[event] ??= [])
        for (const matcher of matchers as HookMatcher[]) {
          if (matcher && typeof matcher === "object" && Array.isArray(matcher.hooks)) {
            list.push(matcher)
          }
        }
      }
    }

    cacheSignature = signature
    cacheValue = disabled ? {} : merged
    return cacheValue
  }

  /** Test hook: drop the parsed-hooks cache. */
  export function resetCache(): void {
    cacheSignature = ""
    cacheValue = {}
  }

  /**
   * Matcher semantics ported from the TUI's matchesPattern
   * (src/cli/ui/ink-app/utils/hooks.ts), minus the legacy tool-name alias
   * table. Simple names and "A|B" lists match case-insensitively so
   * Claude-style matchers ("Bash") hit lowercase runtime tool ids ("bash");
   * anything else is treated as a (case-sensitive) regex.
   */
  export function matchesPattern(matchQuery: string, matcher: string): boolean {
    if (!matcher || matcher === "*") return true
    if (/^[a-zA-Z0-9_|]+$/.test(matcher)) {
      if (matcher.includes("|")) {
        return matcher
          .split("|")
          .map((part) => part.trim())
          .filter((part) => part.length > 0)
          .some((part) => part.toLowerCase() === matchQuery.toLowerCase())
      }
      return matcher.toLowerCase() === matchQuery.toLowerCase()
    }
    try {
      return new RegExp(matcher).test(matchQuery)
    } catch {
      log.warn("Invalid regex in settings hook matcher", { matcher })
      return false
    }
  }

  function buildStdinPayload(event: ToolHookEventName, input: ToolHookInput): string {
    return JSON.stringify({
      session_id: input.sessionId,
      cwd: input.cwd,
      hook_event_name: event,
      tool_name: input.toolName,
      tool_input: input.toolInput,
      ...(event === "PostToolUse" ? { tool_response: input.toolResponse } : {}),
      ...(event === "PostToolUseFailure" ? { error: input.error } : {}),
    })
  }

  async function runCommandHook(
    command: string,
    event: ToolHookEventName,
    input: ToolHookInput,
    timeoutMs: number,
  ): Promise<Decision | null> {
    try {
      const proc = Bun.spawn(["sh", "-c", command], {
        stdin: new Blob([buildStdinPayload(event, input)]),
        stdout: "pipe",
        stderr: "pipe",
        ...(existsSync(input.cwd) ? { cwd: input.cwd } : {}),
        env: {
          ...process.env,
          GIZZI_HOOK_EVENT: event,
          GIZZI_HOOK_SESSION_ID: input.sessionId,
        },
      })

      const timer = setTimeout(() => {
        try {
          proc.kill()
        } catch {
          // process may already have exited
        }
      }, timeoutMs)

      const exitCode = await proc.exited
      clearTimeout(timer)

      const stderr = (await new Response(proc.stderr).text()).trim()
      if (exitCode === 2) {
        return { decision: "deny", reason: stderr || "Blocked by settings hook" }
      }
      if (exitCode !== 0) {
        log.warn("Settings hook failed open", { command, exitCode, stderr: stderr.slice(0, 500) })
        return ALLOW
      }

      const stdout = (await new Response(proc.stdout).text()).trim()
      if (!stdout) return ALLOW

      try {
        const parsed = JSON.parse(stdout)
        const specific = parsed?.hookSpecificOutput
        if (specific?.permissionDecision === "deny") {
          return { decision: "deny", reason: specific.permissionDecisionReason }
        }
        if (parsed?.decision === "block") {
          return {
            decision: "deny",
            reason: typeof parsed.reason === "string" ? parsed.reason : undefined,
          }
        }
        return ALLOW
      } catch {
        return ALLOW
      }
    } catch (error) {
      log.error("Settings hook failed to run", { command, error })
      return null
    }
  }

  /**
   * Run all matching settings command hooks for a tool event. Any deny wins
   * (first reason kept); hook failures and timeouts fail open.
   */
  export async function runToolEvent(event: ToolHookEventName, input: ToolHookInput): Promise<Decision> {
    if (process.env.GIZZI_SETTINGS_HOOKS === "0") return ALLOW
    const matchers = loadHooks(input.cwd)[event]
    if (!matchers || matchers.length === 0) return ALLOW

    const runs: Promise<Decision | null>[] = []
    for (const matcher of matchers) {
      if (matcher.matcher && !matchesPattern(input.toolName, matcher.matcher)) continue
      for (const hook of matcher.hooks ?? []) {
        if (hook?.type !== "command" || typeof hook.command !== "string" || !hook.command) {
          // prompt/agent/http settings hooks stay TUI-only for now
          continue
        }
        const timeoutMs =
          typeof hook.timeout === "number" && hook.timeout > 0 ? hook.timeout * 1000 : DEFAULT_TIMEOUT_MS
        runs.push(runCommandHook(hook.command, event, input, timeoutMs))
      }
    }
    if (runs.length === 0) return ALLOW

    let reason: string | undefined
    let denied = false
    for (const result of await Promise.all(runs)) {
      if (result?.decision === "deny") {
        denied = true
        reason = reason ?? result.reason
      }
    }
    return denied ? { decision: "deny", reason } : ALLOW
  }
}
