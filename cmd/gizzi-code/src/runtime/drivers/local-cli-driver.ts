/**
 * LocalCliDriver — executes agent tasks against a CLI installed on the same host.
 *
 * This driver owns the subprocess lifecycle:
 *   • One-shot mode for CLIs that don't support a persistent JSON stream.
 *   • Warm-process mode for CLIs that speak `--input-format stream-json`.
 *
 * It is the single place where a CLI is actually spawned; the rest of the
 * codebase (LanguageModelV2 wrapper, remote runtime proxy, etc.) delegates here.
 */

import type {
  AgentEvent,
  AgentTask,
  ExecutionLog,
  RuntimeDriver,
  TaskHandle,
} from "@/runtime/runtime-driver"
import { attachmentsToAcpContent } from "./attachments"
import { RuntimeService, RuntimeNotFoundError, type RegisteredRuntime } from "@/runtime/runtime-service"
import { ExecutionLogService } from "@/runtime/execution-log"
import { Log } from "@/shared/util/log"
import {
  ClientSideConnection,
  ndJsonStream,
  PROTOCOL_VERSION,
} from "@agentclientprotocol/sdk"
import { spawn as nodeSpawn } from "node:child_process"
import { Readable, Writable } from "node:stream"

const log = Log.create({ service: "local-cli-driver" })

const PROCESS_MAX_AGE_MS = 15 * 60 * 1000

interface ManagedProcess {
  proc: ReturnType<typeof Bun.spawn>
  ready: boolean
  readyPromise: Promise<void>
  queue: Promise<void>
  createdAt: number
  lineHandlers: Set<(line: string) => void>
  exited: boolean
}

export class LocalCliDriver implements RuntimeDriver {
  private readonly runtimeId: string
  private readonly cliName: string
  private readonly managed = new Map<string, ManagedProcess>()
  private readonly abortedTasks = new Set<string>()
  private readonly tasks = new Map<string, AgentTask>()
  private runtimeCache?: RegisteredRuntime

  constructor(runtimeId: string, cliName: string) {
    this.runtimeId = runtimeId
    this.cliName = cliName
  }

  // ---------------------------------------------------------------------------
  // RuntimeDriver implementation
  // ---------------------------------------------------------------------------

  async assign(task: AgentTask): Promise<TaskHandle> {
    const handle: TaskHandle = {
      taskId: task.taskId || generateTaskId(),
      runtimeId: this.runtimeId,
      cliName: this.cliName,
    }

    this.tasks.set(handle.taskId, task)

    await ExecutionLogService.create(handle)
    await ExecutionLogService.appendEvent(handle.taskId, {
      type: "status",
      status: "queued",
    })

    log.info("task assigned", { taskId: handle.taskId, cli: this.cliName })
    return handle
  }

  async *stream(handle: TaskHandle): AsyncIterable<AgentEvent> {
    if (this.abortedTasks.has(handle.taskId)) {
      this.abortedTasks.delete(handle.taskId)
      const ev = { type: "status", status: "cancelled" } as AgentEvent
      yield ev
      await this.logEvent(handle.taskId, ev)
      return
    }

    const runtime = await this.getRuntime()
    const cli = runtime.agentClis.find((c) => c.name === this.cliName)
    if (!cli) {
      throw new Error(`CLI ${this.cliName} not found on runtime ${this.runtimeId}`)
    }

    const task = this.tasks.get(handle.taskId)
    const message = task?.prompt ?? ""

    yield { type: "status", status: "running" }
    await this.logEvent(handle.taskId, { type: "status", status: "running" })

    const baseCmd = parseCmd(`${cli.path} ${this.specArgs()}`)
    const adapter = resolveAdapter(binaryName(baseCmd[0]))

    if (task?.attachments && task.attachments.length > 0 && !adapter.supportsAttachments) {
      throw new Error(
        `CLI "${this.cliName}" does not support task attachments in its current adapter mode (${adapter.mode}).`,
      )
    }

    let failed = false
    try {
      if (adapter.mode === "one-shot") {
        const argv = adapter.buildArgv(baseCmd, message)
        yield* this.runOneShot(handle, argv)
      } else if (adapter.mode === "stdin-prompt") {
        const argv = adapter.buildArgv(baseCmd, message)
        const input = adapter.buildStdin!(message)
        yield* this.runStdinPrompt(handle, argv, input)
      } else if (adapter.mode === "warm") {
        const argv = adapter.buildArgv(baseCmd, message)
        yield* this.runWarm(handle, argv, message, adapter.buildWarmInput!)
      } else if (adapter.mode === "acp") {
        const argv = adapter.buildArgv(baseCmd, message)
        yield* this.runAcp(handle, argv, task?.cwd)
      } else {
        throw new Error(`CLI ${this.cliName} has an unsupported local-driver mode`)
      }
    } catch (err) {
      failed = true
      const errorEv = { type: "error", error: err } as AgentEvent
      yield errorEv
      await this.logEvent(handle.taskId, errorEv)
      const failedEv = { type: "status", status: "failed" } as AgentEvent
      yield failedEv
      await this.logEvent(handle.taskId, failedEv)
    }

    if (!failed) {
      const completedEv = { type: "status", status: "completed" } as AgentEvent
      yield completedEv
      await this.logEvent(handle.taskId, completedEv)
    }
  }

  async abort(handle: TaskHandle): Promise<void> {
    const mp = this.managed.get(this.poolKey())
    if (mp && this.isCurrentTask(handle.taskId)) {
      try {
        mp.proc.kill()
      } catch (err) {
        log.warn("failed to kill warm process", { error: err, taskId: handle.taskId })
      }
    }
    this.abortedTasks.add(handle.taskId)
    await ExecutionLogService.appendEvent(handle.taskId, {
      type: "status",
      status: "cancelled",
    })
  }

  async inspect(handle: TaskHandle): Promise<ExecutionLog> {
    const logEntry = await ExecutionLogService.get(handle.taskId)
    if (!logEntry) {
      throw new Error(`No execution log found for task ${handle.taskId}`)
    }
    return logEntry
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private async logEvent(taskId: string, event: AgentEvent): Promise<void> {
    try {
      await ExecutionLogService.appendEvent(taskId, event)
    } catch (err) {
      log.warn("failed to append execution log event", { error: err, taskId, eventType: event.type })
    }
  }

  private poolKey(): string {
    return `${this.runtimeId}:${this.cliName}`
  }

  private currentTaskId?: string

  private isCurrentTask(taskId: string): boolean {
    return this.currentTaskId === taskId
  }

  private async getRuntime(): Promise<RegisteredRuntime> {
    if (this.runtimeCache) return this.runtimeCache
    const runtime = await RuntimeService.get(this.runtimeId)
    if (!runtime) throw new RuntimeNotFoundError({ runtimeId: this.runtimeId })
    this.runtimeCache = runtime
    return runtime
  }

  /**
   * The provider discovery stores the full command as `binPath` plus the
   * original spec command args (e.g. `/usr/local/bin/claude -p`). Re-derive
   * those args here so one-shot/warm builders can strip/extend them.
   */
  private specArgs(): string {
    // We intentionally do not store the spec template in the registry; the
    // SubprocessLanguageModel layer already resolved the CLI to its canonical
    // provider id. The discovery spec's `cmd` tail is inferred from the CLI id
    // below. This keeps the registry schema small and transport-agnostic.
    switch (this.cliName) {
      case "claude-cli":
        return "-p"
      case "kimi-cli":
        return "-p"
      case "qwen-cli":
        return "-p"
      case "gemini-cli":
        return "-p"
      case "antigravity":
        return "-p"
      case "codex-cli":
        return ""
      case "copilot-cli":
        return "copilot suggest -t shell"
      case "llm-cli":
        return "prompt"
      case "aichat-cli":
        return ""
      case "ollama-cli":
        return "run"
      case "fabric-cli":
        return ""
      case "chatgpt-cli":
        return ""
      case "cursor-agent":
        return "acp"
      case "opencode":
        return "acp --yolo"
      case "openclaw":
        return "acp"
      case "hermes":
        return "acp"
      case "pi":
        return "-p --mode json"
      case "codebuddy":
        return ""
      case "deveco":
        return ""
      case "grok":
        return "agent --always-approve stdio"
      case "kiro-cli":
        return "acp"
      case "qodercli":
        return "--yolo --acp"
      case "qoderclicn":
        return "--yolo --acp"
      case "qwenpaw":
        return "acp"
      case "reasonix":
        return "acp"
      case "traecli":
        return "acp serve --yolo"
      case "dsh":
        return "--profile multica --stdio"
      case "omp":
        return "-p --mode json"
      default:
        return ""
    }
  }

  // ---------------------------------------------------------------------------
  // One-shot execution
  // ---------------------------------------------------------------------------

  private async *runOneShot(
    handle: TaskHandle,
    argv: string[],
  ): AsyncIterable<AgentEvent> {
    log.info("spawning one-shot subprocess", { taskId: handle.taskId, argv: argv.join(" ") })

    const proc = Bun.spawn(argv, {
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    })

    this.currentTaskId = handle.taskId

    try {
      const [stdout, stderr, exitCode] = await Promise.all([
        readText(proc.stdout),
        readText(proc.stderr),
        proc.exited,
      ])

      if (this.abortedTasks.has(handle.taskId)) {
        this.abortedTasks.delete(handle.taskId)
        const ev = { type: "status", status: "cancelled" } as AgentEvent
        yield ev
        await this.logEvent(handle.taskId, ev)
        return
      }

      if (exitCode !== 0) {
        const detail = stderr.trim() || stdout.trim() || `subprocess exited with code ${exitCode}`
        const errorEv = { type: "error", error: new Error(detail) } as AgentEvent
        yield errorEv
        await this.logEvent(handle.taskId, errorEv)
        const finishEv = { type: "finish", finishReason: "error", usage: zeroUsage() } as AgentEvent
        yield finishEv
        await this.logEvent(handle.taskId, finishEv)
        return
      }

      const text = extractOneShotOutput(stdout.trim())
      if (text) {
        const deltaEv = { type: "text_delta", delta: text } as AgentEvent
        yield deltaEv
        await this.logEvent(handle.taskId, deltaEv)
      }

      const finishEv = { type: "finish", finishReason: "stop", usage: zeroUsage() } as AgentEvent
      yield finishEv
      await this.logEvent(handle.taskId, finishEv)
    } catch (err) {
      log.error("one-shot request failed", { error: err, taskId: handle.taskId })
      const errorEv = { type: "error", error: err } as AgentEvent
      yield errorEv
      await this.logEvent(handle.taskId, errorEv)
      const finishEv = { type: "finish", finishReason: "error", usage: zeroUsage() } as AgentEvent
      yield finishEv
      await this.logEvent(handle.taskId, finishEv)
    } finally {
      this.currentTaskId = undefined
    }
  }

  // ---------------------------------------------------------------------------
  // Stdin-prompt execution (one-shot over stdin)
  // ---------------------------------------------------------------------------

  private async *runStdinPrompt(
    handle: TaskHandle,
    argv: string[],
    input: string,
  ): AsyncIterable<AgentEvent> {
    log.info("spawning stdin-prompt subprocess", { taskId: handle.taskId, argv: argv.join(" ") })

    const proc = Bun.spawn(argv, {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    })

    this.currentTaskId = handle.taskId

    const enc = new TextEncoder()
    const stdin = proc.stdin as any
    stdin.write(enc.encode(input))
    stdin.end?.()

    try {
      const [stdout, stderr, exitCode] = await Promise.all([
        readText(proc.stdout),
        readText(proc.stderr),
        proc.exited,
      ])

      if (this.abortedTasks.has(handle.taskId)) {
        this.abortedTasks.delete(handle.taskId)
        const ev = { type: "status", status: "cancelled" } as AgentEvent
        yield ev
        await this.logEvent(handle.taskId, ev)
        return
      }

      if (exitCode !== 0) {
        const detail = stderr.trim() || stdout.trim() || `subprocess exited with code ${exitCode}`
        const errorEv = { type: "error", error: new Error(detail) } as AgentEvent
        yield errorEv
        await this.logEvent(handle.taskId, errorEv)
        const finishEv = { type: "finish", finishReason: "error", usage: zeroUsage() } as AgentEvent
        yield finishEv
        await this.logEvent(handle.taskId, finishEv)
        return
      }

      const text = extractOneShotOutput(stdout.trim())
      if (text) {
        const deltaEv = { type: "text_delta", delta: text } as AgentEvent
        yield deltaEv
        await this.logEvent(handle.taskId, deltaEv)
      }

      const finishEv = { type: "finish", finishReason: "stop", usage: zeroUsage() } as AgentEvent
      yield finishEv
      await this.logEvent(handle.taskId, finishEv)
    } catch (err) {
      log.error("stdin-prompt request failed", { error: err, taskId: handle.taskId })
      const errorEv = { type: "error", error: err } as AgentEvent
      yield errorEv
      await this.logEvent(handle.taskId, errorEv)
      const finishEv = { type: "finish", finishReason: "error", usage: zeroUsage() } as AgentEvent
      yield finishEv
      await this.logEvent(handle.taskId, finishEv)
    } finally {
      this.currentTaskId = undefined
    }
  }

  // ---------------------------------------------------------------------------
  // ACP stdio execution (JSON-RPC over stdio via @agentclientprotocol/sdk)
  // ---------------------------------------------------------------------------

  private async *runAcp(
    handle: TaskHandle,
    argv: string[],
    cwd?: string,
  ): AsyncIterable<AgentEvent> {
    const task = this.tasks.get(handle.taskId)
    const taskCwd = cwd || task?.cwd || process.cwd()

    if (this.cliName === "qwenpaw") {
      argv = [...argv, "--workspace", taskCwd]
    }

    log.info("spawning acp subprocess", { taskId: handle.taskId, argv: argv.join(" "), cwd: taskCwd })

    const proc = nodeSpawn(argv[0], argv.slice(1), {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: cwd || undefined,
      env: process.env,
    })

    this.currentTaskId = handle.taskId

    const stream = ndJsonStream(
      Writable.toWeb(proc.stdin!) as WritableStream<Uint8Array>,
      Readable.toWeb(proc.stdout!) as unknown as ReadableStream<Uint8Array>,
    )

    const events: AgentEvent[] = []
    let done = false
    let notify = () => {}
    let usage = zeroUsage()

    proc.stderr?.on("data", (data: Buffer) => {
      log.warn("acp_agent_stderr", { taskId: handle.taskId, data: data.toString().slice(0, 500) })
    })

    proc.on("exit", (code) => {
      if (code !== 0 && code !== null) {
        log.warn("acp_agent_exited", { taskId: handle.taskId, code })
      }
      done = true
      notify()
    })

    const pushEvent = (event: AgentEvent) => {
      events.push(event)
      notify()
    }

    const extractTextContent = (content: any): string => {
      if (!content) return ""
      if (typeof content === "string") return content
      if (typeof content.text === "string") return content.text
      if (Array.isArray(content)) {
        return content
          .map((part: any) => {
            if (typeof part === "string") return part
            if (part?.type === "text") return String(part.text ?? "")
            if (part?.type === "diff") return `\n--- ${part.path ?? ""}\n${part.oldText ?? ""}\n+++\n${part.newText ?? ""}`
            if (part?.type === "terminal") return `[terminal ${part.terminalId ?? ""}]`
            if (part?.content) return extractTextContent(part.content)
            return ""
          })
          .join("")
      }
      if (typeof content.content === "string") return content.content
      return ""
    }

    const client = {
      sessionUpdate: async (params: unknown) => {
        if (this.abortedTasks.has(handle.taskId)) return
        const notification = params as { sessionId?: string; update?: any } | undefined
        const update = notification?.update
        if (!update || !update.sessionUpdate) return

        switch (update.sessionUpdate) {
          case "agent_message_chunk":
          case "agent_thought_chunk": {
            const text = extractTextContent(update.content)
            if (text) pushEvent({ type: "text_delta", delta: text })
            break
          }
          case "tool_call": {
            const toolCallId = String(update.toolCallId ?? "")
            if (!toolCallId) break
            pushEvent({
              type: "tool_call",
              id: toolCallId,
              name: String(update.title ?? update.kind ?? "tool"),
              arguments: update.rawInput ?? {},
            })
            break
          }
          case "tool_call_update": {
            const toolCallId = String(update.toolCallId ?? "")
            if (!toolCallId) break
            const status = String(update.status ?? "")
            if (status === "completed" || status === "failed") {
              pushEvent({
                type: "tool_result",
                id: toolCallId,
                content: extractTextContent(update.content),
                isError: status === "failed",
              })
            }
            break
          }
          case "usage_update": {
            const used = typeof update.used === "number" ? update.used : 0
            const size = typeof update.size === "number" ? update.size : 0
            usage = {
              inputTokens: Math.max(0, size - used),
              outputTokens: Math.max(0, used),
              totalTokens: Math.max(0, size),
            }
            break
          }
          default:
            // Other updates (plan, available_commands_update, etc.) are logged
            // but not surfaced as agent events yet.
            break
        }
      },
      requestPermission: async (request: any) => {
        const option =
          request.options?.find((item: any) => item.kind === "allow_always") ??
          request.options?.find((item: any) => item.kind === "allow_once") ??
          request.options?.find((item: any) => !String(item.kind).includes("reject"))
        return option
          ? { outcome: { outcome: "selected" as const, optionId: option.optionId } }
          : { outcome: { outcome: "cancelled" as const } }
      },
      readTextFile: async () => {
        throw new Error("ACP file reads require an Allternit workspace grant")
      },
      writeTextFile: async () => {
        throw new Error("ACP file writes require an Allternit workspace grant")
      },
    }

    const acp = new ClientSideConnection(() => client as any, stream)

    try {
      await acp.initialize({
        protocolVersion: PROTOCOL_VERSION,
        clientCapabilities: { fs: { readTextFile: false, writeTextFile: false } },
        clientInfo: { name: "Allternit", version: "1.0.0" },
      })

      const session = await acp.newSession({
        cwd: taskCwd,
        mcpServers: [],
      })

      const promptText = task?.prompt ?? ""
      const attachmentBlocks = task?.attachments?.length
        ? attachmentsToAcpContent(task.attachments)
        : []
      const promptPromise = acp.prompt({
        sessionId: session.sessionId,
        prompt: [{ type: "text", text: promptText }, ...attachmentBlocks],
      })

      // Yield events as they arrive while the prompt is in flight.
      while (!done || events.length > 0) {
        while (events.length > 0) {
          const event = events.shift()!
          yield event
          await this.logEvent(handle.taskId, event)
        }
        if (!done) {
          await Promise.race([
            promptPromise.then(() => {
              done = true
            }),
            new Promise<void>((r) => {
              notify = r
            }),
          ])
        }
      }

      const result = await promptPromise
      const finishEv = {
        type: "finish",
        finishReason: result.stopReason ?? "stop",
        usage,
      } as AgentEvent
      yield finishEv
      await this.logEvent(handle.taskId, finishEv)
    } catch (err) {
      log.error("acp request failed", { error: err, taskId: handle.taskId })
      const errorEv = { type: "error", error: err } as AgentEvent
      yield errorEv
      await this.logEvent(handle.taskId, errorEv)
      const finishEv = { type: "finish", finishReason: "error", usage } as AgentEvent
      yield finishEv
      await this.logEvent(handle.taskId, finishEv)
    } finally {
      this.currentTaskId = undefined
      try {
        proc.kill()
      } catch {}
    }
  }

  // ---------------------------------------------------------------------------
  // Warm process execution
  // ---------------------------------------------------------------------------

  private async *runWarm(
    handle: TaskHandle,
    argv: string[],
    message: string,
    buildInput: (message: string) => string,
  ): AsyncIterable<AgentEvent> {
    const key = this.poolKey()
    const mp = await this.getOrSpawn(key, argv)

    // Serialize concurrent warm requests through a promise chain.
    const prev = mp.queue
    let release!: () => void
    const slot = new Promise<void>((r) => {
      release = r
    })
    mp.queue = prev.then(() => slot)

    await prev

    if (this.abortedTasks.has(handle.taskId)) {
      this.abortedTasks.delete(handle.taskId)
      release()
      yield { type: "status", status: "cancelled" }
      return
    }

    this.currentTaskId = handle.taskId

    try {
      yield* this.runRequest(mp, handle.taskId, message, buildInput)
    } catch (err) {
      log.error("warm request failed", { error: err, taskId: handle.taskId })
      const errorEv = { type: "error", error: err } as AgentEvent
      yield errorEv
      await this.logEvent(handle.taskId, errorEv)
      try {
        mp.proc.kill()
      } catch {}
      this.managed.delete(key)
      const finishEv = { type: "finish", finishReason: "error", usage: zeroUsage() } as AgentEvent
      yield finishEv
      await this.logEvent(handle.taskId, finishEv)
    } finally {
      this.currentTaskId = undefined
      release()
    }
  }

  private async *runRequest(
    mp: ManagedProcess,
    taskId: string,
    message: string,
    buildInput: (message: string) => string,
  ): AsyncIterable<AgentEvent> {
    const enc = new TextEncoder()
    const blockLengths: Record<number, number> = {}
    const events: AgentEvent[] = []
    let done = false
    let notify = () => {}

    const inputMsg = buildInput(message)

    const handler = (line: string) => {
      if (!line) {
        if (!done) {
          done = true
          events.push({ type: "finish", finishReason: "error", usage: zeroUsage() })
          notify()
        }
        return
      }

      try {
        const evt = JSON.parse(line)

        if (evt.type === "assistant" && evt.message?.content) {
          evt.message.content.forEach((part: any, idx: number) => {
            if (part.type !== "text" || typeof part.text !== "string") return
            const prev = blockLengths[idx] ?? 0
            const delta = part.text.slice(prev)
            if (delta) {
              blockLengths[idx] = part.text.length
              events.push({ type: "text_delta", delta })
              notify()
            }
          })
        }

        if (evt.type === "result") {
          const usage = evt.usage ?? {}
          done = true
          events.push({
            type: "finish",
            finishReason: evt.is_error ? "error" : "stop",
            usage: {
              inputTokens: usage.input_tokens ?? 0,
              outputTokens: usage.output_tokens ?? 0,
              totalTokens: (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0),
            },
          })
          notify()
        }
      } catch {
        // malformed JSON — skip
      }
    }

    mp.lineHandlers.add(handler)

    // Write to stdin after registering the handler so we can't miss any bytes.
    const stdin = mp.proc.stdin as any
    stdin.write(enc.encode(inputMsg))
    stdin.flush?.()

    try {
      while (!done || events.length > 0) {
        while (events.length > 0) {
          const event = events.shift()!
          yield event
          await this.logEvent(taskId, event)
        }
        if (!done) {
          await new Promise<void>((r) => {
            notify = r
          })
        }
      }
    } finally {
      mp.lineHandlers.delete(handler)
    }
  }

  private async getOrSpawn(key: string, argv: string[]): Promise<ManagedProcess> {
    const existing = this.managed.get(key)
    if (existing) {
      const age = Date.now() - existing.createdAt
      if (age < PROCESS_MAX_AGE_MS && !existing.exited && existing.proc.exitCode === null) {
        await existing.readyPromise
        return existing
      }
      try {
        existing.proc.kill()
      } catch {}
      this.managed.delete(key)
    }

    log.info("spawning warm subprocess", { key, cli: this.cliName })
    const proc = Bun.spawn(argv, {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "ignore",
    })

    const mp: ManagedProcess = {
      proc,
      ready: false,
      readyPromise: Promise.resolve(),
      queue: Promise.resolve(),
      createdAt: Date.now(),
      lineHandlers: new Set(),
      exited: false,
    }

    this.startReadLoop(mp)
    mp.readyPromise = this.drainInit(mp)
    this.managed.set(key, mp)

    await mp.readyPromise
    return mp
  }

  private startReadLoop(mp: ManagedProcess): void {
    const reader = (mp.proc.stdout as ReadableStream<Uint8Array>).getReader()
    const dec = new TextDecoder()
    let buf = ""

    const loop = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buf += dec.decode(value, { stream: true })
          const lines = buf.split("\n")
          buf = lines.pop() ?? ""

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed) continue
            for (const handler of mp.lineHandlers) {
              try {
                handler(trimmed)
              } catch {}
            }
          }
        }
      } finally {
        mp.exited = true
        for (const handler of mp.lineHandlers) {
          try {
            handler("")
          } catch {}
        }
        reader.releaseLock()
      }
    }

    // Not awaited — runs for the lifetime of the process.
    loop()
  }

  private drainInit(mp: ManagedProcess): Promise<void> {
    log.info("warm subprocess ready", { cli: this.cliName })
    mp.ready = true
    return Promise.resolve()
  }
}

// ---------------------------------------------------------------------------
// CLI adapters
// ---------------------------------------------------------------------------
//
// Each discovered CLI maps to an explicit adapter. There are no generic
// fallbacks: if a CLI is not listed here, the driver refuses to launch it
// rather than guessing argv. Modes:
//
//   one-shot     - spawn, pass the prompt as argv, wait for exit, parse stdout
//   stdin-prompt - spawn, write the prompt to stdin, wait for exit, parse stdout
//   warm         - spawn a persistent process and speak its line-delimited
//                  protocol over stdio (currently the Claude stream-json
//                  dialect only)
//
// Providers using protocols this driver does not yet implement (ACP stdio,
// DSH frames, Copilot JSONL, OpenCode/DevEco JSON streams, etc.) are rejected
// with a clear error instead of a placeholder adapter.

type AdapterMode = "one-shot" | "stdin-prompt" | "warm" | "acp"

interface CliAdapter {
  mode: AdapterMode
  /** Whether this adapter can forward task attachments to the CLI. */
  supportsAttachments?: boolean
  /** Build the final argv. The message is provided so one-shot adapters can
   *  append it positionally; stdin-prompt, warm, and acp adapters should ignore it. */
  buildArgv(baseCmd: string[], message: string): string[]
  /** Required for stdin-prompt adapters. */
  buildStdin?(message: string): string
  /** Required for warm adapters. */
  buildWarmInput?(message: string): string
}

function claudeStreamJsonInput(message: string): string {
  return (
    JSON.stringify({
      type: "user",
      message: { role: "user", content: [{ type: "text", text: message }] },
    }) + "\n"
  )
}

const CLI_ADAPTERS: Record<string, CliAdapter> = {
  // Anthropic Claude Code — persistent stream-json loop.
  claude: {
    mode: "warm",
    buildArgv: ([command, ...args]) => {
      const stripped = stripFlags(args, ["-p", "--print", "--output-format", "--input-format"])
      return [
        command,
        ...stripped,
        "-p",
        "--output-format", "stream-json",
        "--input-format", "stream-json",
        "--verbose",
        "--permission-mode", "bypassPermissions",
        "--disallowedTools", "AskUserQuestion",
      ]
    },
    buildWarmInput: claudeStreamJsonInput,
  },

  // CodeBuddy — same stream-json dialect as Claude.
  codebuddy: {
    mode: "warm",
    buildArgv: ([command, ...args]) => {
      const stripped = stripFlags(args, ["-p", "--print", "--output-format", "--input-format"])
      return [
        command,
        ...stripped,
        "-p",
        "--output-format", "stream-json",
        "--input-format", "stream-json",
        "--verbose",
        "--permission-mode", "bypassPermissions",
        "--disallowedTools", "AskUserQuestion",
        "--disallowedTools", "EnterPlanMode",
        "--disallowedTools", "ExitPlanMode",
      ]
    },
    buildWarmInput: claudeStreamJsonInput,
  },

  // Moonshot Kimi — one-shot print mode.
  kimi: {
    mode: "one-shot",
    buildArgv: ([command, ...args], message) => {
      const stripped = stripFlags(args, ["-p", "--prompt", "--print", "--output-format", "--input-format"])
      return [command, ...stripped, "--print", "--output-format", "text", "--final-message-only", "-p", message]
    },
  },

  // OpenAI Codex — one-shot exec mode.
  codex: {
    mode: "one-shot",
    buildArgv: ([command, ...args], message) => {
      const stripped = stripFlags(args, ["-m", "--model"])
      return [command, "exec", "--skip-git-repo-check", ...stripped, message]
    },
  },

  // Alibaba Qwen Code — one-shot text mode.
  qwen: {
    mode: "one-shot",
    buildArgv: ([command, ...args], message) => {
      const stripped = stripFlags(args, ["-m", "--model", "-o", "--output-format", "-p", "--prompt"])
      return [command, ...stripped, "--output-format", "text", message]
    },
  },

  // Antigravity (agy) — one-shot print mode.
  agy: {
    mode: "one-shot",
    buildArgv: ([command, ...args], message) => {
      const stripped = stripFlags(args, ["-p", "--print", "--prompt", "-m", "--model", "--print-timeout"])
      return [command, ...stripped, "--print", message]
    },
  },

  // Pi / Oh-My-Pi — one-shot JSON mode; stdout is parsed for a text field.
  pi: {
    mode: "one-shot",
    buildArgv: ([command, ...args], message) => {
      const stripped = stripFlags(args, ["-p", "--prompt", "--mode"])
      return [command, ...stripped, "-p", "--mode", "json", message]
    },
  },
  omp: {
    mode: "one-shot",
    buildArgv: ([command, ...args], message) => {
      const stripped = stripFlags(args, ["-p", "--prompt", "--mode"])
      return [command, ...stripped, "-p", "--mode", "json", message]
    },
  },

  // Cursor Agent — ACP stdio.
  "cursor-agent": {
    mode: "acp",
    supportsAttachments: true,
    buildArgv: ([command, ...args]) => [command, ...args],
  },

  // OpenCode — ACP stdio.
  opencode: {
    mode: "acp",
    supportsAttachments: true,
    buildArgv: ([command, ...args]) => [command, ...args],
  },

  // OpenClaw — ACP stdio.
  openclaw: {
    mode: "acp",
    supportsAttachments: true,
    buildArgv: ([command, ...args]) => [command, ...args],
  },

  // Hermes — ACP stdio.
  hermes: {
    mode: "acp",
    supportsAttachments: true,
    buildArgv: ([command, ...args]) => [command, ...args],
  },

  // DevEco Code — ACP stdio (`deveco acp`).
  deveco: {
    mode: "acp",
    supportsAttachments: true,
    buildArgv: ([command, ...args]) => [command, "acp", ...args],
  },

  // Grok Build — ACP stdio.
  grok: {
    mode: "acp",
    supportsAttachments: true,
    buildArgv: ([command, ...args]) => [command, ...args],
  },

  // Kiro CLI — ACP stdio.
  "kiro-cli": {
    mode: "acp",
    supportsAttachments: true,
    buildArgv: ([command, ...args]) => [command, ...args],
  },

  // Qoder CLI — ACP stdio.
  qodercli: {
    mode: "acp",
    supportsAttachments: true,
    buildArgv: ([command, ...args]) => [command, ...args],
  },

  // Qoder CN CLI — ACP stdio.
  qoderclicn: {
    mode: "acp",
    supportsAttachments: true,
    buildArgv: ([command, ...args]) => [command, ...args],
  },

  // QwenPaw — ACP stdio.
  qwenpaw: {
    mode: "acp",
    supportsAttachments: true,
    buildArgv: ([command, ...args]) => [command, ...args],
  },

  // Reasonix — ACP stdio.
  reasonix: {
    mode: "acp",
    supportsAttachments: true,
    buildArgv: ([command, ...args]) => [command, ...args],
  },

  // Trae CLI — ACP stdio.
  traecli: {
    mode: "acp",
    supportsAttachments: true,
    buildArgv: ([command, ...args]) => [command, ...args],
  },
}

function resolveAdapter(name: string): CliAdapter {
  const adapter = CLI_ADAPTERS[name]
  if (adapter) return adapter

  // Explicit unsupported mapping so every discovered CLI has a known status.
  const unsupportedByProtocol: Record<string, string> = {
    // DSH framed protocol — requires the private `dsh --profile multica` runtime
    // profile; the versioned JSONL wire format is not documented in any public
    // spec we can verify, so we reject rather than guess.
    dsh: "DSH multica stdio (private JSONL protocol)",
    // GitHub Copilot CLI — the discovery entry is `gh copilot suggest -t shell`,
    // a one-shot shell suggestion tool. A headless chat mode likely exists but
    // its exact argv/approval flags are not verified here.
    copilot: "Copilot suggest mode (not a verified agent chat protocol)",
  }

  const protocol = unsupportedByProtocol[name]
  if (protocol) {
    throw new Error(
      `CLI "${name}" is installed but uses ${protocol}, which this local driver does not yet implement.`,
    )
  }

  throw new Error(
    `CLI "${name}" has no local driver adapter. Add it to CLI_ADAPTERS in local-cli-driver.ts or disable the CLI.`,
  )
}

export interface CliAdapterInfo {
  supported: boolean
  mode?: AdapterMode
  supportsAttachments?: boolean
  reason?: string
}

export function getCliAdapterInfo(name: string): CliAdapterInfo {
  const adapter = CLI_ADAPTERS[name]
  if (adapter) return { supported: true, mode: adapter.mode, supportsAttachments: adapter.supportsAttachments ?? false }

  const unsupportedByProtocol: Record<string, string> = {
    dsh: "DSH multica stdio (private JSONL protocol)",
    copilot: "Copilot suggest mode (not a verified agent chat protocol)",
  }

  const protocol = unsupportedByProtocol[name]
  if (protocol) {
    return { supported: false, reason: `${protocol} is not implemented by the local driver yet` }
  }

  return { supported: false, reason: "No adapter registered for this CLI" }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function parseCmd(cmd: string): string[] {
  return cmd.trim().split(/\s+/)
}

function binaryName(command: string): string {
  return command.split("/").pop() ?? command
}

function stripFlags(args: string[], flags: string[]): string[] {
  const removed = new Set(flags)
  const result: string[] = []
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (!removed.has(arg)) {
      result.push(arg)
      continue
    }

    if (
      arg === "-p" ||
      arg === "--prompt" ||
      arg === "-m" ||
      arg === "--model" ||
      arg === "--output-format" ||
      arg === "--input-format"
    ) {
      i += 1
    }
  }
  return result
}

async function readText(stream?: ReadableStream<Uint8Array> | null): Promise<string> {
  if (!stream) return ""
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let text = ""
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      text += decoder.decode(value, { stream: true })
    }
    text += decoder.decode()
  } finally {
    reader.releaseLock()
  }
  return text
}

function generateTaskId(): string {
  return `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function zeroUsage() {
  return { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
}

function extractOneShotOutput(raw: string): string {
  if (!raw) return raw

  // Try to extract a text field from JSON output (pi / omp --mode json, etc.)
  if (raw.startsWith("{") || raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw)
      const candidate =
        parsed.text ??
        parsed.content ??
        parsed.response ??
        parsed.message ??
        parsed.answer ??
        parsed.output
      if (typeof candidate === "string") return candidate
      if (Array.isArray(candidate)) {
        return candidate
          .map((part: any) => (typeof part === "string" ? part : part?.text ?? ""))
          .join("")
      }
    } catch {
      // Not valid JSON — fall back to raw output.
    }
  }

  return raw
}
