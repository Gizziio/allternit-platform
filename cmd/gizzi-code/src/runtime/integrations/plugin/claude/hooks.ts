// @ts-nocheck
/**
 * Builds runtime hook functions from a .claude-plugin hooks.json configuration.
 *
 * Supported hook events:
 *   - PreToolUse      → tool.execute.before
 *   - PostToolUse     → tool.execute.after
 *   - Stop            → session.stop
 *   - UserPromptSubmit → prompt.submit
 */
import type { ClaudeHooksConfig, ClaudeHookGroup, ClaudeHookCommand } from "./types"

const EVENT_MAP: Record<string, string> = {
  PreToolUse: "tool.execute.before",
  PostToolUse: "tool.execute.after",
  Stop: "session.stop",
  UserPromptSubmit: "prompt.submit",
}

function expandVars(value: string, root: string): string {
  return value.replace(/\$\{CLAUDE_PLUGIN_ROOT\}/g, root)
}

function matchesTool(matcher: string | undefined, tool: string): boolean {
  if (!matcher) return true
  const regex = new RegExp(matcher)
  return regex.test(tool)
}

async function runCommand(
  hook: ClaudeHookCommand,
  root: string,
  input: unknown,
  output: unknown,
): Promise<{ decision?: string; reason?: string } | null> {
  const command = expandVars(hook.command, root)
  const timeout = hook.timeout ?? 30

  const env = { ...process.env, CLAUDE_PLUGIN_ROOT: root }
  const shell = process.env.SHELL || "/bin/bash"

  const stdin = JSON.stringify({ input, output })
  const proc = Bun.spawn([shell, "-c", command], {
    env,
    stdin: new TextEncoder().encode(stdin),
    stdout: "pipe",
    stderr: "pipe",
  })

  const timeoutId = setTimeout(() => proc.kill("SIGTERM"), timeout * 1000)

  try {
    const [stdoutBuf, stderrBuf] = await Promise.all([
      new Response(proc.stdout).arrayBuffer(),
      new Response(proc.stderr).arrayBuffer(),
    ])
    const stdout = new TextDecoder().decode(stdoutBuf).trim()
    if (!stdout) return null
    try {
      return JSON.parse(stdout)
    } catch {
      return null
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

function buildEventHook(
  groups: ClaudeHookGroup[] | undefined,
  root: string,
  pluginName: string,
  canBlock: boolean,
): ((input: any, output: any) => Promise<void>) | undefined {
  if (!groups || groups.length === 0) return undefined

  return async (input: any, output: any) => {
    const tool = typeof input?.tool === "string" ? input.tool : ""
    for (const group of groups) {
      if (!matchesTool(group.matcher, tool)) continue
      for (const hook of group.hooks) {
        if (hook.type !== "command") continue
        const result = await runCommand(hook, root, input, output)
        if (!result) continue
        const decision = String(result.decision || "").toLowerCase()
        if (canBlock && (decision === "deny" || decision === "block")) {
          output.__blocked = true
          output.__blockedReason = result.reason || `${pluginName} blocked this action`
          return
        }
      }
    }
  }
}

export function buildHooks(
  hooksConfig: ClaudeHooksConfig,
  root: string,
  pluginName: string,
): Record<string, (input: any, output: any) => Promise<void>> {
  const hooks: Record<string, (input: any, output: any) => Promise<void>> = {}

  for (const [eventName, groups] of Object.entries(hooksConfig.hooks)) {
    const mappedName = EVENT_MAP[eventName] || eventName
    const canBlock = eventName === "PreToolUse"
    const fn = buildEventHook(groups, root, pluginName, canBlock)
    if (fn) hooks[mappedName] = fn
  }

  return hooks
}
