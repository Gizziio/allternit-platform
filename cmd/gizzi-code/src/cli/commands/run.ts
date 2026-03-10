import type { Argv } from "yargs"
import path from "path"
import { pathToFileURL } from "bun"
import { UI } from "@/cli/ui"
import { cmd } from "@/cli/commands/cmd"
import { Flag } from "@/runtime/context/flag/flag"
import { bootstrap } from "@/cli/bootstrap"
import { EOL } from "os"
import { Filesystem } from "@/shared/util/filesystem"
import { createA2RClient, type Message, type GIZZIClient, type ToolPart } from "@a2r/sdk/v2"
import { Server } from "@/runtime/server/server"
import { Provider } from "@/runtime/providers/provider"
import { Agent } from "@/runtime/loop/agent"
import { AgentManager } from "@/runtime/loop/manager"
import { PermissionNext } from "@/runtime/tools/guard/permission/next"
import { Tool } from "@/runtime/tools/builtins/tool"
import { GlobTool } from "@/runtime/tools/builtins/glob"
import { GrepTool } from "@/runtime/tools/builtins/grep"
import { ListTool } from "@/runtime/tools/builtins/ls"
import { ReadTool } from "@/runtime/tools/builtins/read"
import { WebFetchTool } from "@/runtime/tools/builtins/webfetch"
import { EditTool } from "@/runtime/tools/builtins/edit"
import { WriteTool } from "@/runtime/tools/builtins/write"
import { CodeSearchTool } from "@/runtime/tools/builtins/codesearch"
import { WebSearchTool } from "@/runtime/tools/builtins/websearch"
import { TaskTool } from "@/runtime/tools/builtins/task"
import { SkillTool } from "@/runtime/tools/builtins/skill"
import { BashTool } from "@/runtime/tools/builtins/bash"
import { TodoWriteTool } from "@/runtime/tools/builtins/todo"
import { Locale } from "@/shared/util/locale"

type ToolProps<T extends Tool.Info> = {
  input: Tool.InferParameters<T>
  metadata: Tool.InferMetadata<T>
  part: ToolPart
}

function props<T extends Tool.Info>(part: ToolPart): ToolProps<T> {
  const state = part.state
  return {
    input: state.input as Tool.InferParameters<T>,
    metadata: ("metadata" in state ? state.metadata : {}) as Tool.InferMetadata<T>,
    part,
  }
}

type Inline = {
  icon: string
  title: string
  description?: string
}

function inline(info: Inline) {
  const suffix = info.description ? UI.Style.TEXT_DIM + ` ${info.description}` + UI.Style.TEXT_NORMAL : ""
  UI.println(UI.Style.TEXT_NORMAL + info.icon, UI.Style.TEXT_NORMAL + info.title + suffix)
}

function block(info: Inline, output?: string) {
  UI.empty()
  inline(info)
  if (!output?.trim()) return
  UI.println(output)
  UI.empty()
}

function fallback(part: ToolPart) {
  const state = part.state
  const input = "input" in state ? state.input : undefined
  const title =
    ("title" in state && state.title ? state.title : undefined) ||
    (input && typeof input === "object" && Object.keys(input).length > 0 ? JSON.stringify(input) : "Unknown")
  inline({
    icon: "⚙",
    title: `${part.tool} ${title}`,
  })
}

function glob(info: ToolProps<typeof GlobTool>) {
  const root = info.input.path ?? ""
  const title = `Glob "${info.input.pattern}"`
  const suffix = root ? `in ${normalizePath(root)}` : ""
  const num = info.metadata.count
  const description =
    num === undefined ? suffix : `${suffix}${suffix ? " · " : ""}${num} ${num === 1 ? "match" : "matches"}`
  inline({
    icon: "✱",
    title,
    ...(description && { description }),
  })
}

function grep(info: ToolProps<typeof GrepTool>) {
  const root = info.input.path ?? ""
  const title = `Grep "${info.input.pattern}"`
  const suffix = root ? `in ${normalizePath(root)}` : ""
  const num = info.metadata.matches
  const description =
    num === undefined ? suffix : `${suffix}${suffix ? " · " : ""}${num} ${num === 1 ? "match" : "matches"}`
  inline({
    icon: "✱",
    title,
    ...(description && { description }),
  })
}

function list(info: ToolProps<typeof ListTool>) {
  const dir = info.input.path ? normalizePath(info.input.path) : ""
  inline({
    icon: "→",
    title: dir ? `List ${dir}` : "List",
  })
}

function read(info: ToolProps<typeof ReadTool>) {
  const file = normalizePath(info.input.filePath)
  const pairs = Object.entries(info.input).filter(([key, value]) => {
    if (key === "filePath") return false
    return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
  })
  const description = pairs.length ? `[${pairs.map(([key, value]) => `${key}=${value}`).join(", ")}]` : undefined
  inline({
    icon: "→",
    title: `Read ${file}`,
    ...(description && { description }),
  })
}

function write(info: ToolProps<typeof WriteTool>) {
  block(
    {
      icon: "←",
      title: `Write ${normalizePath(info.input.filePath)}`,
    },
    info.part.state.status === "completed" ? info.part.state.output : undefined,
  )
}

function webfetch(info: ToolProps<typeof WebFetchTool>) {
  inline({
    icon: "%",
    title: `WebFetch ${info.input.url}`,
  })
}

function edit(info: ToolProps<typeof EditTool>) {
  const title = normalizePath(info.input.filePath)
  const diff = info.metadata.diff
  block(
    {
      icon: "←",
      title: `Edit ${title}`,
    },
    diff,
  )
}

function codesearch(info: ToolProps<typeof CodeSearchTool>) {
  inline({
    icon: "◇",
    title: `Exa Code Search "${info.input.query}"`,
  })
}

function websearch(info: ToolProps<typeof WebSearchTool>) {
  inline({
    icon: "◈",
    title: `Exa Web Search "${info.input.query}"`,
  })
}

function task(info: ToolProps<typeof TaskTool>) {
  const input = info.part.state.input
  const status = info.part.state.status
  const subagent =
    typeof input.subagent_type === "string" && input.subagent_type.trim().length > 0 ? input.subagent_type : "unknown"
  const agent = Locale.titlecase(subagent)
  const desc =
    typeof input.description === "string" && input.description.trim().length > 0 ? input.description : undefined
  const icon = status === "error" ? "✗" : status === "running" ? "•" : "✓"
  const name = desc ?? `${agent} Task`
  inline({
    icon,
    title: name,
    description: desc ? `${agent} Agent` : undefined,
  })
}

function skill(info: ToolProps<typeof SkillTool>) {
  inline({
    icon: "→",
    title: `Skill "${info.input.name}"`,
  })
}

function bash(info: ToolProps<typeof BashTool>) {
  const output = info.part.state.status === "completed" ? info.part.state.output?.trim() : undefined
  block(
    {
      icon: "$",
      title: `${info.input.command}`,
    },
    output,
  )
}

function todo(info: ToolProps<typeof TodoWriteTool>) {
  block(
    {
      icon: "#",
      title: "Todos",
    },
    info.input.todos.map((item) => `${item.status === "completed" ? "[x]" : "[ ]"} ${item.content}`).join("\n"),
  )
}

function normalizePath(input?: string) {
  if (!input) return ""
  if (path.isAbsolute(input)) return path.relative(process.cwd(), input) || "."
  return input
}

export const RunCommand = cmd({
  command: "run [message..]",
  describe: "run gizzi with a message",
  builder: (yargs: Argv) => {
    return yargs
      .positional("message", {
        describe: "message to send",
        type: "string",
        array: true,
        default: [],
      })
      .option("command", {
        describe: "the command to run, use message for args",
        type: "string",
      })
      .option("continue", {
        alias: ["c"],
        describe: "continue the last session",
        type: "boolean",
      })
      .option("session", {
        alias: ["s"],
        describe: "session id to continue",
        type: "string",
      })
      .option("fork", {
        describe: "fork the session before continuing (requires --continue or --session)",
        type: "boolean",
      })
      .option("share", {
        type: "boolean",
        describe: "share the session",
      })
      .option("model", {
        type: "string",
        alias: ["m"],
        describe: "model to use in the format of provider/model",
      })
      .option("agent", {
        type: "string",
        describe: "agent to use",
      })
      .option("format", {
        type: "string",
        choices: ["default", "json"],
        default: "default",
        describe: "format: default (formatted) or json (raw JSON events)",
      })
      .option("file", {
        alias: ["f"],
        type: "string",
        array: true,
        describe: "file(s) to attach to message",
      })
      .option("title", {
        type: "string",
        describe: "title for the session (uses truncated prompt if no value provided)",
      })
      .option("attach", {
        type: "string",
        describe: "attach to a running gizzi server (e.g., http://localhost:4096)",
      })
      .option("dir", {
        type: "string",
        describe: "directory to run in, path on remote server if attaching",
      })
      .option("worktree", {
        type: "string",
        describe: "override the git worktree root for sandbox boundary",
      })
      .option("port", {
        type: "number",
        describe: "port for the local server (defaults to random port if no value provided)",
      })
      .option("variant", {
        type: "string",
        describe: "model variant (provider-specific reasoning effort, e.g., high, max, minimal)",
      })
      .option("thinking", {
        type: "boolean",
        describe: "show thinking blocks",
        default: false,
      })
      .option("print", {
        alias: "p",
        type: "boolean",
        describe: "print response and exit (pipe-friendly, no TUI)",
        default: false,
      })
      .option("output-format", {
        type: "string",
        describe: "output format: text, json, stream-json",
        choices: ["text", "json", "stream-json"] as const,
      })
      .option("permission-mode", {
        type: "string",
        describe: "permission mode for tool execution",
        choices: ["default", "acceptEdits", "plan", "dontAsk", "bypassPermissions"] as const,
      })
      .option("dangerously-skip-permissions", {
        type: "boolean",
        describe: "skip all permission checks (use in sandboxed environments only)",
        default: false,
      })
      .option("allowedTools", {
        type: "array",
        string: true,
        describe: "whitelist of tool name patterns (glob)",
      })
      .option("disallowedTools", {
        type: "array",
        string: true,
        describe: "blacklist of tool name patterns (glob)",
      })
      .option("system-prompt", {
        type: "string",
        describe: "override the system prompt",
      })
      .option("append-system-prompt", {
        type: "string",
        describe: "append text to the system prompt",
      })
      .option("max-budget-usd", {
        type: "number",
        describe: "maximum cost budget in USD before aborting",
      })
      .option("effort", {
        type: "string",
        describe: "reasoning effort level (alias for --variant)",
        choices: ["low", "medium", "high"] as const,
      })
      .option("fallback-model", {
        type: "string",
        describe: "fallback model when primary fails (format: provider/model)",
      })
      .option("input-format", {
        type: "string",
        describe: "input format for stdin: text (default) or stream-json (newline-delimited JSON messages)",
        choices: ["text", "stream-json"] as const,
      })
      .option("json-schema", {
        type: "string",
        describe: "JSON schema for structured output validation (inline JSON or file path)",
      })
      .option("from-pr", {
        type: "number",
        describe: "GitHub PR number to fetch context from",
      })
      .option("plugin-dir", {
        type: "string",
        describe: "directory to load additional plugins from (scoped to this session)",
      })
  },
  handler: async (args) => {
    // Set permission flags before anything else
    if (args.permissionMode) Flag.GIZZI_PERMISSION_MODE = args.permissionMode
    if (args.dangerouslySkipPermissions) Flag.GIZZI_SKIP_PERMISSIONS = true
    if (args.worktree) Flag.GIZZI_WORKTREE = path.resolve(args.worktree)
    if (args.fallbackModel) Flag.GIZZI_FALLBACK_MODEL = args.fallbackModel

    // Effort is an alias for variant
    if (args.effort && !args.variant) args.variant = args.effort

    // Plugin dir override
    if (args.pluginDir) {
      process.env.GIZZI_PLUGIN_DIR = path.resolve(args.pluginDir)
    }

    let message = [...args.message, ...(args["--"] || [])]
      .map((arg) => (arg.includes(" ") ? `"${arg.replace(/"/g, '\\"')}"` : arg))
      .join(" ")

    const directory = (() => {
      if (!args.dir) return undefined
      if (args.attach) return args.dir
      try {
        process.chdir(args.dir)
        return process.cwd()
      } catch {
        UI.error("Failed to change directory to " + args.dir)
        process.exit(1)
      }
    })()

    const files: { type: "file"; url: string; filename: string; mime: string }[] = []
    if (args.file) {
      const list = Array.isArray(args.file) ? args.file : [args.file]

      for (const filePath of list) {
        const resolvedPath = path.resolve(process.cwd(), filePath)
        if (!(await Filesystem.exists(resolvedPath))) {
          UI.error(`File not found: ${filePath}`)
          process.exit(1)
        }

        const mime = (await Filesystem.isDir(resolvedPath)) ? "application/x-directory" : "text/plain"

        files.push({
          type: "file",
          url: pathToFileURL(resolvedPath).href,
          filename: path.basename(resolvedPath),
          mime,
        })
      }
    }

    const stdinMessages: Array<{ role: string; content: string }>  = []
    if (!process.stdin.isTTY) {
      const stdinText = await Bun.stdin.text()
      if (args.inputFormat === "stream-json") {
        for (const line of stdinText.split("\n")) {
          const trimmed = line.trim()
          if (!trimmed) continue
          try {
            const parsed = JSON.parse(trimmed)
            if (parsed.content) {
              stdinMessages.push({ role: parsed.role || "user", content: parsed.content })
            }
          } catch {
            // non-JSON lines treated as plain text
            stdinMessages.push({ role: "user", content: trimmed })
          }
        }
        if (stdinMessages.length > 0 && !message.trim()) {
          // Use last message as the primary prompt, earlier ones as conversation history
          message = stdinMessages.pop()!.content
        }
      } else {
        message += "\n" + stdinText
      }
    }

    if (message.trim().length === 0 && !args.command) {
      UI.error("You must provide a message or a command")
      process.exit(1)
    }

    if (args.fork && !args.continue && !args.session) {
      UI.error("--fork requires --continue or --session")
      process.exit(1)
    }

    const rules: PermissionNext.Ruleset = [
      {
        permission: "question",
        action: "deny",
        pattern: "*",
      },
      {
        permission: "plan_enter",
        action: "deny",
        pattern: "*",
      },
      {
        permission: "plan_exit",
        action: "deny",
        pattern: "*",
      },
    ]

    // Tool filtering via --allowedTools / --disallowedTools
    if (args.allowedTools?.length) {
      // Deny everything first, then allow matching patterns
      rules.push({ permission: "*", action: "deny", pattern: "*" })
      for (const pattern of args.allowedTools) {
        rules.push({ permission: pattern, action: "allow", pattern: "*" })
      }
    }
    if (args.disallowedTools?.length) {
      for (const pattern of args.disallowedTools) {
        rules.push({ permission: pattern, action: "deny", pattern: "*" })
      }
    }

    function title() {
      if (args.title === undefined) return
      if (args.title !== "") return args.title
      return message.slice(0, 50) + (message.length > 50 ? "..." : "")
    }

    async function session(sdk: GIZZIClient) {
      const baseID = args.continue ? (await sdk.session.list()).data?.find((s) => !s.parentID)?.id : args.session

      if (baseID && args.fork) {
        const forked = await sdk.session.fork({ sessionID: baseID })
        return forked.data?.id
      }

      if (baseID) return baseID

      const name = title()
      const result = await sdk.session.create({ title: name, permission: rules })
      return result.data?.id
    }

    async function share(sdk: GIZZIClient, sessionID: string) {
      const cfg = await sdk.config.get()
      if (!cfg.data) return
      if (cfg.data.share !== "auto" && !Flag.GIZZI_AUTO_SHARE && !args.share) return
      const res = await sdk.session.share({ sessionID }).catch((error) => {
        if (error instanceof Error && error.message.includes("disabled")) {
          UI.println(UI.Style.TEXT_DANGER_BOLD + "!  " + error.message)
        }
        return { error }
      })
      if (!res.error && "data" in res && res.data?.share?.url) {
        UI.println(UI.Style.TEXT_INFO_BOLD + "~  " + res.data.share.url)
      }
    }

    async function execute(sdk: GIZZIClient) {
      function tool(part: ToolPart) {
        try {
          if (part.tool === "bash") return bash(props<typeof BashTool>(part))
          if (part.tool === "glob") return glob(props<typeof GlobTool>(part))
          if (part.tool === "grep") return grep(props<typeof GrepTool>(part))
          if (part.tool === "list") return list(props<typeof ListTool>(part))
          if (part.tool === "read") return read(props<typeof ReadTool>(part))
          if (part.tool === "write") return write(props<typeof WriteTool>(part))
          if (part.tool === "webfetch") return webfetch(props<typeof WebFetchTool>(part))
          if (part.tool === "edit") return edit(props<typeof EditTool>(part))
          if (part.tool === "codesearch") return codesearch(props<typeof CodeSearchTool>(part))
          if (part.tool === "websearch") return websearch(props<typeof WebSearchTool>(part))
          if (part.tool === "task") return task(props<typeof TaskTool>(part))
          if (part.tool === "todowrite") return todo(props<typeof TodoWriteTool>(part))
          if (part.tool === "skill") return skill(props<typeof SkillTool>(part))
          return fallback(part)
        } catch {
          return fallback(part)
        }
      }

      const printMode = args.print || args.outputFormat === "text"
      const streamJsonMode = args.outputFormat === "stream-json"
      const jsonMode = args.format === "json" || args.outputFormat === "json"
      const printBuffer: string[] = []

      function emit(type: string, data: Record<string, unknown>) {
        if (streamJsonMode) {
          process.stdout.write(JSON.stringify({ type, timestamp: Date.now(), sessionID, ...data }) + EOL)
          return true
        }
        if (jsonMode) {
          process.stdout.write(JSON.stringify({ type, timestamp: Date.now(), sessionID, ...data }) + EOL)
          return true
        }
        return false
      }

      const events = await sdk.event.subscribe()
      let error: string | undefined
      let totalCost = 0

      async function loop() {
        const toggles = new Map<string, boolean>()

        for await (const event of events.stream) {
          if (
            event.type === "message.updated" &&
            event.properties.info.role === "assistant" &&
            !jsonMode && !streamJsonMode && !printMode &&
            toggles.get("start") !== true
          ) {
            UI.empty()
            UI.println(`> ${event.properties.info.agent} · ${event.properties.info.modelID}`)
            UI.empty()
            toggles.set("start", true)
          }

          // Track cost for budget limit
          if (
            event.type === "message.updated" &&
            event.properties.info.role === "assistant" &&
            event.properties.info.time.completed
          ) {
            const msg = event.properties.info as { cost?: number }
            if (msg.cost) totalCost += msg.cost
            if (args.maxBudgetUsd && totalCost >= args.maxBudgetUsd) {
              UI.error(`Budget limit reached: $${totalCost.toFixed(4)} >= $${args.maxBudgetUsd}`)
              await sdk.session.abort?.({ sessionID }).catch(() => {})
              break
            }
          }

          if (event.type === "message.part.updated") {
            const part = event.properties.part
            if (part.sessionID !== sessionID) continue

            if (part.type === "tool" && (part.state.status === "completed" || part.state.status === "error")) {
              if (emit("tool_use", { part })) continue
              if (printMode) continue
              if (part.state.status === "completed") {
                tool(part)
                continue
              }
              inline({
                icon: "✗",
                title: `${part.tool} failed`,
              })
              UI.error(part.state.error)
            }

            if (
              part.type === "tool" &&
              part.tool === "task" &&
              part.state.status === "running" &&
              args.format !== "json"
            ) {
              if (toggles.get(part.id) === true) continue
              task(props<typeof TaskTool>(part))
              toggles.set(part.id, true)
            }

            if (part.type === "step-start") {
              if (emit("step_start", { part })) continue
            }

            if (part.type === "step-finish") {
              if (emit("step_finish", { part })) continue
            }

            if (part.type === "text" && part.time?.end) {
              if (emit("text", { part })) continue
              const text = part.text.trim()
              if (!text) continue
              if (printMode) {
                printBuffer.push(text)
                continue
              }
              if (!process.stdout.isTTY) {
                process.stdout.write(text + EOL)
                continue
              }
              UI.empty()
              UI.println(text)
              UI.empty()
            }

            if (part.type === "reasoning" && part.time?.end && args.thinking) {
              if (emit("reasoning", { part })) continue
              const text = part.text.trim()
              if (!text) continue
              const line = `Thinking: ${text}`
              if (process.stdout.isTTY) {
                UI.empty()
                UI.println(`${UI.Style.TEXT_DIM}\u001b[3m${line}\u001b[0m${UI.Style.TEXT_NORMAL}`)
                UI.empty()
                continue
              }
              process.stdout.write(line + EOL)
            }
          }

          if (event.type === "session.error") {
            const props = event.properties
            if (props.sessionID !== sessionID || !props.error) continue
            let err = String(props.error.name)
            if ("data" in props.error && props.error.data && "message" in props.error.data) {
              err = String(props.error.data.message)
            }
            error = error ? error + EOL + err : err
            if (emit("error", { error: props.error })) continue
            UI.error(err)
          }

          if (
            event.type === "session.status" &&
            event.properties.sessionID === sessionID &&
            event.properties.status.type === "idle"
          ) {
            // Flush print buffer in print mode
            if (printMode && printBuffer.length > 0) {
              process.stdout.write(printBuffer.join("\n") + EOL)
            }
            break
          }

          if (event.type === "permission.asked") {
            const permission = event.properties
            if (permission.sessionID !== sessionID) continue
            if (!printMode) {
              UI.println(
                UI.Style.TEXT_WARNING_BOLD + "!",
                UI.Style.TEXT_NORMAL +
                  `permission requested: ${permission.permission} (${permission.patterns.join(", ")}); auto-rejecting`,
              )
            }
            await sdk.permission.reply({
              requestID: permission.id,
              reply: "reject",
            })
          }
        }
      }

      // Validate agent if specified
      const agent = await (async () => {
        if (!args.agent) return undefined
        const entry = await AgentManager.get(args.agent)
        if (!entry) {
          UI.println(
            UI.Style.TEXT_WARNING_BOLD + "!",
            UI.Style.TEXT_NORMAL,
            `agent "${args.agent}" not found. Falling back to default agent`,
          )
          return undefined
        }
        if (entry.mode === "subagent") {
          UI.println(
            UI.Style.TEXT_WARNING_BOLD + "!",
            UI.Style.TEXT_NORMAL,
            `agent "${args.agent}" is a subagent, not a primary agent. Falling back to default agent`,
          )
          return undefined
        }
        return args.agent
      })()

      const sessionID = await session(sdk)
      if (!sessionID) {
        UI.error("Session not found")
        process.exit(1)
      }
      await share(sdk, sessionID)

      loop().catch((e) => {
        process.stderr.write(String(e?.stack ?? e) + "\n")
        process.exit(1)
      })

      if (args.command) {
        await sdk.session.command({
          sessionID,
          agent,
          model: args.model,
          command: args.command,
          arguments: message,
          variant: args.variant,
        })
      } else {
        const model = args.model ? Provider.parseModel(args.model) : undefined
        // If stream-json input provided earlier conversation context, prepend it
        let fullMessage = message
        if (stdinMessages.length > 0) {
          const history = stdinMessages
            .map((m) => `[${m.role}]: ${m.content}`)
            .join("\n")
          fullMessage = `<conversation_history>\n${history}\n</conversation_history>\n\n${message}`
        }
        // Fetch PR context if --from-pr is specified
        if (args.fromPr) {
          try {
            const prProc = Bun.spawn(
              ["gh", "pr", "view", String(args.fromPr), "--json", "title,body,url,headRefName,baseRefName"],
              { cwd: process.cwd(), stdout: "pipe", stderr: "pipe" },
            )
            const prJson = await new Response(prProc.stdout).text()
            const diffProc = Bun.spawn(
              ["gh", "pr", "diff", String(args.fromPr)],
              { cwd: process.cwd(), stdout: "pipe", stderr: "pipe" },
            )
            const prDiff = await new Response(diffProc.stdout).text()
            const prData = JSON.parse(prJson.trim())
            const prContext = [
              `<pr_context>`,
              `PR #${args.fromPr}: ${prData.title}`,
              `Branch: ${prData.headRefName} -> ${prData.baseRefName}`,
              `URL: ${prData.url}`,
              prData.body ? `\nDescription:\n${prData.body}` : "",
              prDiff.trim() ? `\nDiff:\n${prDiff.slice(0, 50000)}` : "",
              `</pr_context>`,
            ].join("\n")
            fullMessage = prContext + "\n\n" + fullMessage
          } catch (e) {
            UI.error(`Failed to fetch PR #${args.fromPr}: ${e instanceof Error ? e.message : String(e)}`)
          }
        }

        // Build system prompt override if specified
        // --system-prompt replaces the entire system prompt
        // --append-system-prompt appends (prefixed with + so server knows to append)
        const systemOverride = (() => {
          if (args.systemPrompt) return args.systemPrompt
          if (args.appendSystemPrompt) return "+" + args.appendSystemPrompt
          return undefined
        })()

        // Parse --json-schema if provided
        const format = await (async () => {
          if (!args.jsonSchema) return undefined
          try {
            // Try as inline JSON first
            const schema = args.jsonSchema.trim().startsWith("{")
              ? JSON.parse(args.jsonSchema)
              : JSON.parse(await Filesystem.readText(path.resolve(args.jsonSchema)))
            return { type: "json_schema" as const, schema }
          } catch (e) {
            UI.error(`Invalid --json-schema: ${e instanceof Error ? e.message : String(e)}`)
            process.exit(1)
          }
        })()

        await sdk.session.prompt({
          sessionID,
          agent,
          model,
          variant: args.variant,
          ...(systemOverride ? { system: systemOverride } : {}),
          ...(format ? { format } : {}),
          parts: [...files, { type: "text", text: fullMessage }],
        })
      }
    }

    if (args.attach) {
      const sdk = createA2RClient({ baseUrl: args.attach, directory })
      return await execute(sdk)
    }

    await bootstrap(process.cwd(), async () => {
      const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init)
        return Server.App().fetch(request)
      }) as typeof globalThis.fetch
      const sdk = createA2RClient({ baseUrl: "http://gizzi.internal", fetch: fetchFn })
      await execute(sdk)
    })
  },
})
