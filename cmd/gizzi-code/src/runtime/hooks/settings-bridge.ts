import { existsSync, readFileSync, statSync } from "fs"
import { homedir } from "os"
import path from "path"
import { Log } from "@/shared/util/log"
import { Wildcard } from "@/shared/util/wildcard"

/**
 * Bridge: Claude-Code-style settings.json hooks (`hooks: { PreToolUse: [...] }`)
 * on the headless/runtime tool-dispatch path.
 *
 * The TUI executors (src/cli/ui/ink-app/utils/hooks.ts) cannot be imported
 * here — their module graph (bootstrap state, analytics, React-adjacent
 * settings modules) hangs outside the ink app. This module reimplements the
 * contained part the runtime needs, mirroring the TUI contracts:
 *
 * - settings file resolution, mirroring the ink-app settings module:
 *   user = <GIZZI_CONFIG_DIR ?? ~/.gizzi>/settings.json;
 *   project = <cwd>/.gizzi/settings.json with <cwd>/.claude/settings.json
 *   fallback; local = same for settings.local.json. Managed/policy settings
 *   are NOT read here (deferred — see below).
 * - matcher filtering with the TUI's matchesPattern semantics, minus the
 *   legacy tool-name alias table; runtime tool ids are lowercase canonical
 *   ("bash"), so simple-name matching is case-insensitive to accept
 *   Claude-style matchers ("Bash", "Write|Edit").
 * - `type: "command"` and `type: "http"` hooks with the Claude Code contract:
 *   command hooks get {session_id, cwd, hook_event_name, tool_name,
 *   tool_input, tool_response?/error?} on stdin; http hooks get the same JSON
 *   POSTed with Content-Type: application/json. Exit 2 (command) or a JSON
 *   body with {decision: "block"} / hookSpecificOutput.permissionDecision
 *   gates the call; other failures fail open with a warning. HTTP header
 *   values interpolate $VAR/${VAR} only for names in the hook's
 *   allowedEnvVars (CR/LF/NUL stripped), and the `allowedHttpHookUrls`
 *   settings allowlist is enforced (concatenated across settings sources,
 *   same as the TUI's allowedMcpServers precedent). The TUI's SSRF guard,
 *   sandbox-proxy routing, and 10-minute outer default timeout are NOT
 *   ported — the bridge uses a uniform 60s default (hook.timeout overrides).
 * - `if` conditions: permission rule syntax "Tool(content)" parsed exactly
 *   like the TUI's permissionRuleValueFromString (escaped parens, "Bash()"/
 *   "Bash(*)" collapse to tool-wide). Content matching is Wildcard.match
 *   against the top-level string values of tool_input — an approximation of
 *   the TUI's per-tool permission matchers (which need the tool registry and
 *   tree-sitter for Bash); documented approximation, not a stub.
 * - `async`/`asyncRewake`: fire-and-forget — never gates, never blocks
 *   dispatch. The asyncRewake model-rewake has no dispatch-level equivalent
 *   and degrades to plain async. `once`: runs at most once per session
 *   (keyed on sessionId + event + command/url).
 * - PreToolUse exit-0 JSON may carry hookSpecificOutput.updatedInput (plain
 *   object) — applied by the dispatcher as a REPLACEMENT of the tool args
 *   (same semantics as the ink-app: structuredIO.ts `decision.updatedInput ||
 *   input`, toolExecution.ts `processedInput = result.updatedInput`).
 * - permissionDecision "ask" (PreToolUse): aggregated with the TUI
 *   precedence deny > ask > allow; the dispatcher routes it through
 *   ctx.ask (the normal PermissionNext prompt flow) before execution.
 *
 * Remaining deferral (single): prompt/agent hook types. They need an LLM
 * round-trip through the session's configured provider, which the dispatch
 * layer has no handle to — they stay TUI-only and are skipped here. Managed/
 * policy settings hooks are also not read by this bridge.
 */
export namespace SettingsHooksBridge {
  const log = Log.create({ service: "hooks.settings" })

  export type ToolHookEventName = "PreToolUse" | "PostToolUse" | "PostToolUseFailure"

  interface HookEntry {
    type?: string
    command?: string
    url?: string
    headers?: Record<string, string>
    allowedEnvVars?: string[]
    timeout?: number
    if?: string
    async?: boolean
    asyncRewake?: boolean
    once?: boolean
  }

  interface HookMatcher {
    matcher?: string
    hooks?: HookEntry[]
  }

  type HooksConfig = Record<string, HookMatcher[]>

  interface SettingsData {
    hooks: HooksConfig
    // Concatenated `allowedHttpHookUrls` across settings sources; undefined
    // when no source defines the key (= no restriction), [] blocks all.
    httpHookUrlAllowlist: string[] | undefined
  }

  export interface ToolHookInput {
    sessionId: string
    cwd: string
    toolName: string
    toolInput: unknown
    toolResponse?: unknown
    error?: unknown
  }

  export interface Decision {
    decision: "allow" | "deny" | "ask"
    reason?: string
    updatedInput?: Record<string, unknown>
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

  // Parsed-settings cache keyed on the (path, mtime, size) signature of
  // every candidate file, so external settings edits are picked up on the
  // next tool call without re-reading unchanged files on each dispatch.
  let cacheSignature = ""
  let cacheValue: SettingsData = { hooks: {}, httpHookUrlAllowlist: undefined }

  function loadSettings(cwd: string): SettingsData {
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
    const allowlist: string[] = []
    let allowlistDefined = false
    for (const file of files) {
      let parsed: any
      try {
        parsed = JSON.parse(readFileSync(file, "utf8"))
      } catch {
        continue
      }
      if (parsed?.disableAllHooks === true) disabled = true
      if (Array.isArray(parsed?.allowedHttpHookUrls)) {
        allowlistDefined = true
        for (const pattern of parsed.allowedHttpHookUrls) {
          if (typeof pattern === "string") allowlist.push(pattern)
        }
      }
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
    cacheValue = {
      hooks: disabled ? {} : merged,
      httpHookUrlAllowlist: allowlistDefined ? allowlist : undefined,
    }
    return cacheValue
  }

  /** Test hook: drop the parsed-settings cache and the once-registry. */
  export function resetCache(): void {
    cacheSignature = ""
    cacheValue = { hooks: {}, httpHookUrlAllowlist: undefined }
    onceRegistry.clear()
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

  // --- `if` condition: permission rule syntax "Tool(content)" ---
  // Parser ported from the ink-app permissionRuleParser.ts
  // (findFirst/LastUnescapedChar + permissionRuleValueFromString), minus the
  // legacy tool-name alias table.

  function findFirstUnescapedChar(str: string, char: string): number {
    for (let i = 0; i < str.length; i++) {
      if (str[i] === char) {
        let backslashCount = 0
        let j = i - 1
        while (j >= 0 && str[j] === "\\") {
          backslashCount++
          j--
        }
        if (backslashCount % 2 === 0) return i
      }
    }
    return -1
  }

  function findLastUnescapedChar(str: string, char: string): number {
    for (let i = str.length - 1; i >= 0; i--) {
      if (str[i] === char) {
        let backslashCount = 0
        let j = i - 1
        while (j >= 0 && str[j] === "\\") {
          backslashCount++
          j--
        }
        if (backslashCount % 2 === 0) return i
      }
    }
    return -1
  }

  function unescapeRuleContent(content: string): string {
    return content.replace(/\\\(/g, "(").replace(/\\\)/g, ")").replace(/\\\\/g, "\\")
  }

  function parsePermissionRule(ruleString: string): { toolName: string; ruleContent?: string } {
    const openParenIndex = findFirstUnescapedChar(ruleString, "(")
    if (openParenIndex === -1) return { toolName: ruleString }
    const closeParenIndex = findLastUnescapedChar(ruleString, ")")
    if (closeParenIndex === -1 || closeParenIndex <= openParenIndex) return { toolName: ruleString }
    if (closeParenIndex !== ruleString.length - 1) return { toolName: ruleString }
    const toolName = ruleString.substring(0, openParenIndex)
    const rawContent = ruleString.substring(openParenIndex + 1, closeParenIndex)
    if (!toolName) return { toolName: ruleString }
    if (rawContent === "" || rawContent === "*") return { toolName }
    return { toolName, ruleContent: unescapeRuleContent(rawContent) }
  }

  function topLevelStringValues(input: unknown): string[] {
    if (!input || typeof input !== "object" || Array.isArray(input)) return []
    const values: string[] = []
    for (const value of Object.values(input as Record<string, unknown>)) {
      if (typeof value === "string") values.push(value)
    }
    return values
  }

  /**
   * Evaluate a hook `if` condition against a tool call. Tool name matches
   * case-insensitively (runtime ids are lowercase). Content matching uses
   * Wildcard.match against the top-level string values of tool_input (e.g.
   * `Bash(git *)` hits tool_input.command) — an approximation of the TUI's
   * per-tool permission matchers, which require the tool registry and
   * tree-sitter for Bash prefixes.
   */
  export function matchesIfCondition(ifCondition: string, input: ToolHookInput): boolean {
    const parsed = parsePermissionRule(ifCondition)
    if (parsed.toolName.toLowerCase() !== input.toolName.toLowerCase()) return false
    if (!parsed.ruleContent) return true
    return topLevelStringValues(input.toolInput).some((value) => Wildcard.match(value, parsed.ruleContent!))
  }

  function buildPayload(event: ToolHookEventName, input: ToolHookInput): string {
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

  function isPlainObject(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value)
  }

  /**
   * Interpret an exit-0 / 2xx JSON hook output. Mirrors the TUI's
   * processHookJSONOutput for the fields the runtime path supports:
   * decision approve/block, hookSpecificOutput.permissionDecision
   * allow/deny/ask (+ reason), updatedInput (PreToolUse, plain objects only).
   * A hookSpecificOutput addressed at a different event is ignored.
   */
  function interpretJsonOutput(parsed: any, event: ToolHookEventName): Decision {
    if (!isPlainObject(parsed)) return ALLOW
    const specific = isPlainObject(parsed.hookSpecificOutput) ? parsed.hookSpecificOutput : undefined
    const relevant = specific && (!specific.hookEventName || specific.hookEventName === event) ? specific : undefined

    let updatedInput: Record<string, unknown> | undefined
    if (event === "PreToolUse" && isPlainObject(relevant?.updatedInput)) {
      updatedInput = relevant!.updatedInput as Record<string, unknown>
    }

    const permission = relevant?.permissionDecision
    if (permission === "deny") {
      return {
        decision: "deny",
        reason:
          (typeof relevant?.permissionDecisionReason === "string" && relevant.permissionDecisionReason) ||
          (typeof parsed.reason === "string" && parsed.reason) ||
          undefined,
        // A deny never carries updatedInput forward (TUI precedence).
      }
    }
    if (permission === "ask") {
      return {
        decision: event === "PreToolUse" ? "ask" : "allow",
        reason: typeof relevant?.permissionDecisionReason === "string" ? relevant.permissionDecisionReason : undefined,
        updatedInput,
      }
    }
    if (permission === "allow") {
      return { decision: "allow", updatedInput }
    }
    if (parsed.decision === "block") {
      return {
        decision: "deny",
        reason: (typeof parsed.reason === "string" && parsed.reason) || undefined,
      }
    }
    // "approve" or no decision: allow, still carrying updatedInput.
    return { decision: "allow", updatedInput }
  }

  async function runCommandHook(
    hook: HookEntry,
    event: ToolHookEventName,
    input: ToolHookInput,
  ): Promise<Decision | null> {
    const command = hook.command!
    const timeoutMs = typeof hook.timeout === "number" && hook.timeout > 0 ? hook.timeout * 1000 : DEFAULT_TIMEOUT_MS
    try {
      const proc = Bun.spawn(["sh", "-c", command], {
        stdin: new Blob([buildPayload(event, input)]),
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
      if (!stdout || !stdout.startsWith("{")) return ALLOW

      try {
        return interpretJsonOutput(JSON.parse(stdout), event)
      } catch {
        return ALLOW
      }
    } catch (error) {
      log.error("Settings hook failed to run", { command, error })
      return null
    }
  }

  function sanitizeHeaderValue(value: string): string {
    // Strip CR/LF/NUL to prevent header injection via env values.
    return value.replace(/[\r\n\x00]/g, "")
  }

  function interpolateEnvVars(value: string, allowedEnvVars: ReadonlySet<string>): string {
    const interpolated = value.replace(/\$\{([A-Z_][A-Z0-9_]*)\}|\$([A-Z_][A-Z0-9_]*)/g, (_, braced, unbraced) => {
      const varName = braced ?? unbraced
      if (!allowedEnvVars.has(varName)) return ""
      return process.env[varName] ?? ""
    })
    return sanitizeHeaderValue(interpolated)
  }

  async function runHttpHook(
    hook: HookEntry,
    event: ToolHookEventName,
    input: ToolHookInput,
    urlAllowlist: string[] | undefined,
  ): Promise<Decision | null> {
    const url = hook.url!
    if (urlAllowlist !== undefined && !urlAllowlist.some((pattern) => Wildcard.match(url, pattern))) {
      log.warn("Settings HTTP hook blocked by allowedHttpHookUrls", { url })
      return ALLOW
    }
    const timeoutMs = typeof hook.timeout === "number" && hook.timeout > 0 ? hook.timeout * 1000 : DEFAULT_TIMEOUT_MS

    const headers: Record<string, string> = { "Content-Type": "application/json" }
    if (hook.headers && typeof hook.headers === "object") {
      const allowedEnvVars = new Set(hook.allowedEnvVars ?? [])
      for (const [name, value] of Object.entries(hook.headers)) {
        if (typeof value === "string") headers[name] = interpolateEnvVars(value, allowedEnvVars)
      }
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: buildPayload(event, input),
        signal: AbortSignal.timeout(timeoutMs),
        redirect: "manual",
      })
      if (response.status < 200 || response.status >= 300) {
        log.warn("Settings HTTP hook failed open", { url, status: response.status })
        return ALLOW
      }
      const body = (await response.text()).trim()
      // Empty body = no opinion (the TUI treats it as an empty JSON object).
      if (!body) return ALLOW
      if (!body.startsWith("{")) {
        log.warn("Settings HTTP hook returned non-JSON body, failing open", { url })
        return ALLOW
      }
      try {
        return interpretJsonOutput(JSON.parse(body), event)
      } catch {
        log.warn("Settings HTTP hook returned invalid JSON, failing open", { url })
        return ALLOW
      }
    } catch (error) {
      log.warn("Settings HTTP hook failed open", {
        url,
        error: error instanceof Error ? error.message : String(error),
      })
      return null
    }
  }

  // `once` registry: JSON-tuple key of [sessionId, event, command-or-url] —
  // recorded before the run so parallel dispatches cannot double-fire the
  // same once-hook.
  const onceRegistry = new Set<string>()

  function onceKey(hook: HookEntry, event: ToolHookEventName, sessionId: string): string {
    return JSON.stringify([sessionId, event, hook.command ?? hook.url ?? ""])
  }

  /**
   * Run all matching settings hooks for a tool event. Sync hooks are awaited
   * and aggregated with the TUI precedence (deny > ask > allow; updatedInput
   * from non-denying hooks, last one wins); async hooks are fire-and-forget.
   * Hook failures and timeouts fail open.
   */
  export async function runToolEvent(event: ToolHookEventName, input: ToolHookInput): Promise<Decision> {
    if (process.env.GIZZI_SETTINGS_HOOKS === "0") return ALLOW
    const settings = loadSettings(input.cwd)
    const matchers = settings.hooks[event]
    if (!matchers || matchers.length === 0) return ALLOW

    const pending: Promise<Decision | null>[] = []
    for (const matcher of matchers) {
      if (matcher.matcher && !matchesPattern(input.toolName, matcher.matcher)) continue
      for (const hook of matcher.hooks ?? []) {
        if (!hook || typeof hook !== "object") continue
        const isCommand = hook.type === "command" && typeof hook.command === "string" && !!hook.command
        const isHttp = hook.type === "http" && typeof hook.url === "string" && !!hook.url
        // prompt/agent hooks need an LLM round-trip — TUI-only, skipped.
        if (!isCommand && !isHttp) continue
        if (hook.if && !matchesIfCondition(hook.if, input)) continue
        if (hook.once) {
          const key = onceKey(hook, event, input.sessionId)
          if (onceRegistry.has(key)) continue
          onceRegistry.add(key)
        }
        const run = () =>
          isCommand
            ? runCommandHook(hook, event, input)
            : runHttpHook(hook, event, input, settings.httpHookUrlAllowlist)
        if (hook.async === true || hook.asyncRewake === true) {
          // Fire-and-forget: never gates, never blocks dispatch. Failures are
          // logged inside the runners; the void catch is belt-and-braces.
          void run().catch(() => {})
          continue
        }
        pending.push(run())
      }
    }
    if (pending.length === 0) return ALLOW

    let reason: string | undefined
    let denied = false
    let ask = false
    let updatedInput: Record<string, unknown> | undefined
    for (const result of await Promise.all(pending)) {
      if (!result) continue
      if (result.decision === "deny") {
        denied = true
        reason = reason ?? result.reason
      } else if (result.decision === "ask") {
        ask = true
        reason = reason ?? result.reason
        // updatedInput rides along with allow/ask behaviors (TUI precedence).
        if (result.updatedInput) updatedInput = result.updatedInput
      } else if (result.updatedInput) {
        updatedInput = result.updatedInput
      }
    }
    if (denied) return { decision: "deny", reason }
    if (ask) return { decision: "ask", reason, updatedInput }
    return updatedInput ? { decision: "allow", updatedInput } : ALLOW
  }

  const ASK_PATTERN_KEYS = ["command", "file_path", "filePath", "path", "pattern", "url"]

  /**
   * Derive permission-check patterns for a hook-forced `ask`. Well-known
   * primary fields first (bash: command, file tools: path), then any other
   * top-level string value, so the PermissionNext ruleset and the prompt UI
   * see a meaningful subject. Falls back to "*".
   */
  export function deriveAskPatterns(toolInput: unknown): string[] {
    if (!isPlainObject(toolInput)) return ["*"]
    const patterns: string[] = []
    for (const key of ASK_PATTERN_KEYS) {
      const value = toolInput[key]
      if (typeof value === "string" && value && !patterns.includes(value)) patterns.push(value)
    }
    for (const value of topLevelStringValues(toolInput)) {
      if (value && !patterns.includes(value)) patterns.push(value)
    }
    return patterns.length > 0 ? patterns : ["*"]
  }
}
