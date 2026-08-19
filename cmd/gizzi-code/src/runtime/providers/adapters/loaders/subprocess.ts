/**
 * SubprocessLanguageModel — thin AI SDK LanguageModelV2 wrapper over the runtime driver system.
 *
 * The actual CLI execution lives in `runtime/drivers/local-cli-driver.ts` (and,
 * in Phase 3, remote websocket/uds drivers). This file only:
 *   1. Resolves the provider's CLI to a registered runtime.
 *   2. Creates a driver task from the last user message.
 *   3. Maps driver AgentEvents to LanguageModelV2StreamParts.
 */

import type { LanguageModelV2, LanguageModelV2StreamPart } from "@ai-sdk/provider"
import { RuntimeService } from "@/runtime/runtime-service"
import { RuntimeDriverFactory } from "@/runtime/runtime-driver-factory"
import { Log } from "@/shared/util/log"

const log = Log.create({ service: "subprocess-lm" })
const TEXT_ID = "text-1"

export class SubprocessLanguageModel implements LanguageModelV2 {
  readonly specificationVersion = "v2" as const
  readonly provider = "subprocess"
  readonly defaultObjectGenerationMode = undefined
  readonly supportedUrls: Record<string, RegExp[]> = {}

  readonly modelId: string
  private readonly providerID: string

  constructor(providerID: string, modelId: string) {
    this.providerID = providerID
    this.modelId = modelId
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
    if (!message) {
      return emptyStream(options.prompt)
    }

    const { runtime, driver } = await RuntimeDriverFactory.resolveCli(this.providerID)
    const task = await driver.assign({
      taskId: generateTaskId(),
      prompt: message,
    })

    const stream = new ReadableStream<LanguageModelV2StreamPart>({
      start: async (controller) => {
        controller.enqueue({ type: "stream-start", warnings: [] })

        let textStarted = false
        let finished = false

        const finish = (reason: string, usage?: { inputTokens: number; outputTokens: number; totalTokens: number }) => {
          if (finished) return
          finished = true
          if (textStarted) {
            controller.enqueue({ type: "text-end", id: TEXT_ID })
          }
          controller.enqueue({
            type: "finish",
            finishReason: reason as any,
            usage: usage ?? { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
          })
        }

        try {
          await RuntimeService.markBusy(runtime.id, true)

          for await (const event of driver.stream(task)) {
            if (event.type === "text_delta") {
              if (!textStarted) {
                controller.enqueue({ type: "text-start", id: TEXT_ID })
                textStarted = true
              }
              controller.enqueue({ type: "text-delta", id: TEXT_ID, delta: event.delta })
              continue
            }

            if (event.type === "error") {
              const err = event.error instanceof Error ? event.error : new Error(String(event.error))
              log.error("driver stream error", { error: err, taskId: task.taskId })
              controller.enqueue({ type: "error", error: err })
              finish("error")
              continue
            }

            if (event.type === "finish") {
              finish(event.finishReason, event.usage)
            }

            // status / tool_call / tool_result events are intentionally not
            // forwarded to the AI SDK stream.
          }

          if (!finished) {
            finish("stop")
          }
        } catch (err) {
          log.error("subprocess model stream failed", { error: err, taskId: task.taskId })
          controller.enqueue({ type: "error", error: err })
          finish("error")
        } finally {
          await RuntimeService.markBusy(runtime.id, false)
          controller.close()
        }
      },
    })

    return {
      stream,
      rawCall: { rawPrompt: message, rawSettings: { runtimeId: runtime.id, cliName: this.providerID } },
    }
  }
}

function emptyStream(rawPrompt: unknown) {
  return {
    stream: new ReadableStream<LanguageModelV2StreamPart>({
      start(c) {
        c.enqueue({ type: "stream-start", warnings: [] })
        c.enqueue({
          type: "finish",
          finishReason: "stop",
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        })
        c.close()
      },
    }),
    rawCall: { rawPrompt, rawSettings: {} as Record<string, unknown> },
  }
}

function extractLastUserText(prompt: any[]): string {
  let last = ""
  for (const msg of prompt) {
    if (msg.role !== "user") continue
    const text = Array.isArray(msg.content)
      ? msg.content
          .filter((p: any) => p.type === "text")
          .map((p: any) => String(p.text ?? ""))
          .join("")
      : String(msg.content ?? "")
    if (text) last = text
  }
  return last
}

function generateTaskId(): string {
  return `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
