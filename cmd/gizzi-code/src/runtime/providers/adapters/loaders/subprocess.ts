/**
 * SubprocessLanguageModel — wraps a CLI subprocess (e.g. `claude`) as an AI SDK LanguageModelV2.
 *
 * Uses a persistent warm process: one subprocess is kept alive using
 * --input-format stream-json. The process is spawned once and kept warm;
 * init events (system, rate_limit_info) are drained at startup. Subsequent
 * messages are written to stdin, responses read from stdout.
 *
 * Warm startup: ~18s first time, ~2-4s per subsequent request.
 *
 * Line dispatcher: a single continuous read loop decodes stdout and broadcasts
 * every complete line to all registered handlers. This eliminates the race
 * condition where drainInit() could consume bytes that runRequest() needs.
 */

import type { LanguageModelV2, LanguageModelV2StreamPart } from "@ai-sdk/provider"
import { Log } from "@/shared/util/log"

const log = Log.create({ service: "subprocess-lm" })
const TEXT_ID = "text-1"

// ---------------------------------------------------------------------------
// Persistent process manager
// ---------------------------------------------------------------------------

interface ManagedProcess {
  proc: ReturnType<typeof Bun.spawn>
  ready: boolean
  readyPromise: Promise<void>
  queue: Promise<void>
  createdAt: number
  lineHandlers: Set<(line: string) => void>
  exited: boolean
}

const managed = new Map<string, ManagedProcess>()
const PROCESS_MAX_AGE_MS = 15 * 60 * 1000

function buildStreamArgs(baseCmd: string[]): string[] {
  const stripped = baseCmd.filter(a => a !== "-p" && a !== "--print")
  return [
    ...stripped,
    "--print",
    "--input-format", "stream-json",
    "--output-format", "stream-json",
    "--verbose",
  ]
}

/**
 * Continuous read loop — reads stdout forever and dispatches every complete
 * line to all currently registered handlers. Started at spawn and never
 * awaited; it runs until the process exits.
 */
async function startReadLoop(mp: ManagedProcess): Promise<void> {
  const reader = (mp.proc.stdout as ReadableStream<Uint8Array>).getReader()
  const dec = new TextDecoder()
  let buf = ""

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
          try { handler(trimmed) } catch {}
        }
      }
    }
  } finally {
    mp.exited = true
    // Notify all waiting handlers that the process is done
    for (const handler of mp.lineHandlers) {
      try { handler("") } catch {}
    }
    reader.releaseLock()
  }
}

/**
 * Mark the process ready immediately — the system event only arrives after
 * the first stdin write, so we can't wait for it before returning. The line
 * dispatcher already routes all events to whoever is listening, so the
 * system/rate_limit_info events are harmlessly ignored by runRequest.
 */
function drainInit(mp: ManagedProcess): Promise<void> {
  log.info("subprocess ready")
  mp.ready = true
  return Promise.resolve()
}

async function getOrSpawn(key: string, baseCmd: string[]): Promise<ManagedProcess> {
  const existing = managed.get(key)
  if (existing) {
    const age = Date.now() - existing.createdAt
    if (age < PROCESS_MAX_AGE_MS && !existing.exited && existing.proc.exitCode === null) {
      await existing.readyPromise
      return existing
    }
    try { existing.proc.kill() } catch {}
    managed.delete(key)
  }

  log.info("spawning warm subprocess", { key })
  const args = buildStreamArgs(baseCmd)
  const proc = Bun.spawn(args, {
    stdin: "pipe",
    stdout: "pipe",
    stderr: "ignore",
  })

  const mp: ManagedProcess = {
    proc,
    ready: false,
    readyPromise: Promise.resolve(), // replaced below
    queue: Promise.resolve(),
    createdAt: Date.now(),
    lineHandlers: new Set(),
    exited: false,
  }

  // Start the continuous read loop (not awaited — runs for lifetime of process)
  startReadLoop(mp)

  mp.readyPromise = drainInit(mp)
  managed.set(key, mp)

  await mp.readyPromise
  return mp
}

// ---------------------------------------------------------------------------
// Per-request: send message to stdin, collect stdout lines until "result"
// ---------------------------------------------------------------------------

async function runRequest(
  mp: ManagedProcess,
  message: string,
  controller: ReadableStreamDefaultController<LanguageModelV2StreamPart>,
) {
  const enc = new TextEncoder()
  const blockLengths: Record<number, number> = {}
  let textStarted = false

  const inputMsg = JSON.stringify({
    type: "user",
    message: { role: "user", content: [{ type: "text", text: message }] },
  }) + "\n"

  return new Promise<void>((resolve, reject) => {
    const handler = (line: string) => {
      if (!line) {
        // process exited unexpectedly
        mp.lineHandlers.delete(handler)
        if (textStarted) controller.enqueue({ type: "text-end", id: TEXT_ID })
        controller.enqueue({ type: "finish", finishReason: "stop", usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } })
        resolve()
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
              if (!textStarted) {
                controller.enqueue({ type: "text-start", id: TEXT_ID })
                textStarted = true
              }
              controller.enqueue({ type: "text-delta", id: TEXT_ID, delta })
              blockLengths[idx] = part.text.length
            }
          })
        }

        if (evt.type === "result") {
          mp.lineHandlers.delete(handler)
          if (textStarted) controller.enqueue({ type: "text-end", id: TEXT_ID })
          const usage = evt.usage ?? {}
          controller.enqueue({
            type: "finish",
            finishReason: evt.is_error ? "error" : "stop",
            usage: {
              inputTokens: usage.input_tokens ?? 0,
              outputTokens: usage.output_tokens ?? 0,
              totalTokens: (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0),
            },
          })
          resolve()
        }
      } catch {
        // malformed JSON — skip
      }
    }

    mp.lineHandlers.add(handler)

    // Write to stdin after registering the handler so we can't miss any bytes
    mp.proc.stdin.write(enc.encode(inputMsg))
    mp.proc.stdin.flush?.()
  })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseCmd(cmd: string): string[] {
  return cmd.trim().split(/\s+/)
}

function extractLastUserText(prompt: any[]): string {
  let last = ""
  for (const msg of prompt) {
    if (msg.role !== "user") continue
    const text = Array.isArray(msg.content)
      ? msg.content.filter((p: any) => p.type === "text").map((p: any) => String(p.text ?? "")).join("")
      : String(msg.content ?? "")
    if (text) last = text
  }
  return last
}

// ---------------------------------------------------------------------------
// Language model
// ---------------------------------------------------------------------------

export class SubprocessLanguageModel implements LanguageModelV2 {
  readonly specificationVersion = "v2" as const
  readonly provider = "subprocess"
  readonly defaultObjectGenerationMode = undefined

  readonly modelId: string
  private readonly baseCmd: string[]
  private readonly poolKey: string

  constructor(subprocessCmd: string, modelId: string) {
    this.baseCmd = parseCmd(subprocessCmd)
    this.modelId = modelId
    this.poolKey = subprocessCmd
  }

  async doGenerate(options: any): Promise<any> {
    const chunks: string[] = []
    const result = await this.doStream(options)
    const reader = result.stream.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value.type === "text-delta") chunks.push((value as any).delta)
    }
    return {
      content: [{ type: "text", text: chunks.join("") }],
      finishReason: "stop" as const,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      rawCall: { rawPrompt: options.prompt, rawSettings: {} },
      rawResponse: {},
      warnings: [],
      response: { id: "subprocess", timestamp: new Date(), modelId: this.modelId },
    }
  }

  async doStream(options: any): Promise<{
    stream: ReadableStream<LanguageModelV2StreamPart>
    rawCall: { rawPrompt: unknown; rawSettings: Record<string, unknown> }
  }> {
    const message = extractLastUserText(options.prompt ?? [])
    const poolKey = this.poolKey
    const baseCmd = this.baseCmd

    if (!message) {
      return emptyStream(options.prompt)
    }

    const mp = await getOrSpawn(poolKey, baseCmd)

    const stream = new ReadableStream<LanguageModelV2StreamPart>({
      async start(controller) {
        controller.enqueue({ type: "stream-start", warnings: [] })

        // Serialize concurrent requests through a promise chain
        const prev = mp.queue
        let myRelease!: () => void
        const mySlot = new Promise<void>(r => { myRelease = r })
        mp.queue = prev.then(() => mySlot)

        await prev

        try {
          await runRequest(mp, message, controller)
        } catch (err) {
          log.error("subprocess request failed", { error: err })
          controller.enqueue({ type: "error", error: err })
          try { mp.proc.kill() } catch {}
          managed.delete(poolKey)
        } finally {
          myRelease()
          controller.close()
        }
      },
    })

    return {
      stream,
      rawCall: { rawPrompt: message, rawSettings: {} },
    }
  }
}

function emptyStream(rawPrompt: unknown) {
  return {
    stream: new ReadableStream<LanguageModelV2StreamPart>({
      start(c) {
        c.enqueue({ type: "stream-start", warnings: [] } as any)
        c.enqueue({ type: "finish", finishReason: "stop", usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } } as any)
        c.close()
      },
    }),
    rawCall: { rawPrompt, rawSettings: {} as Record<string, unknown> },
  }
}
