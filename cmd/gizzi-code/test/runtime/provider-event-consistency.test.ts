/**
 * Provider event consistency — every provider must reach the chat as the same
 * structured stream: reasoning as reasoning (never reply text), prose split
 * into ordered blocks around tool calls, and tool calls forwarded as frames.
 */

import { describe, expect, mock, test } from "bun:test"
import type { AgentEvent } from "@/runtime/runtime-driver"

const driverEvents: AgentEvent[] = []

mock.module("@/runtime/runtime-driver-factory", () => ({
  RuntimeDriverFactory: {
    resolveCli: async () => ({
      runtime: { id: "rt-test" },
      driver: {
        assign: async () => ({ taskId: "t1" }),
        stream: async function* () {
          for (const e of driverEvents) yield e
        },
      },
    }),
  },
}))
mock.module("@/runtime/runtime-service", () => ({
  RuntimeService: { markBusy: async () => {} },
  RuntimeNotFoundError: class extends Error {},
}))

async function streamParts(events: AgentEvent[]) {
  driverEvents.splice(0, driverEvents.length, ...events)
  const { SubprocessLanguageModel } = await import("@/runtime/providers/adapters/loaders/subprocess")
  const model = new SubprocessLanguageModel("kimi-cli", "kimi-k3")
  const { stream } = await model.doStream({ prompt: [{ role: "user", content: [{ type: "text", text: "hi" }] }] })
  const parts: any[] = []
  const reader = stream.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    parts.push(value)
  }
  return parts
}

describe("SubprocessLanguageModel block ordering", () => {
  test("reasoning is emitted as reasoning parts, never text", async () => {
    const parts = await streamParts([
      { type: "reasoning_delta", delta: "Simple weather search." },
      { type: "text_delta", delta: "Today in Chicago…" },
      { type: "finish", finishReason: "stop" },
    ])
    const types = parts.map((p) => p.type)
    expect(types).toEqual([
      "stream-start",
      "reasoning-start", "reasoning-delta", "reasoning-end",
      "text-start", "text-delta", "text-end",
      "finish",
    ])
    const text = parts.filter((p) => p.type === "text-delta").map((p) => p.delta).join("")
    expect(text).toBe("Today in Chicago…")
  })

  test("a tool call closes the open text block so later prose is a new part", async () => {
    const parts = await streamParts([
      { type: "text_delta", delta: "Let me check." },
      { type: "tool_call", id: "c1", name: "web_search", arguments: { query: "x" } },
      { type: "tool_result", id: "c1", content: "ok" },
      { type: "text_delta", delta: "Here is the answer." },
      { type: "finish", finishReason: "stop" },
    ])
    const textIds = [...new Set(parts.filter((p) => p.type === "text-delta").map((p) => p.id))]
    expect(textIds).toHaveLength(2)
    const toolIdx = parts.findIndex((p) => p.type === "raw" && p.raw.__gizzi === "observed_tool_call")
    const firstEnd = parts.findIndex((p) => p.type === "text-end")
    expect(firstEnd).toBeLessThan(toolIdx)
  })
})

describe("codexReasoningText", () => {
  test("reads reasoning items, preferring summaries", async () => {
    const { codexReasoningText } = await import("@/runtime/drivers/local-cli-driver")
    expect(codexReasoningText({ item: { type: "reasoning", summary: ["Plan the search.", "Check the source."] } })).toBe(
      "Plan the search.\n\nCheck the source.",
    )
    expect(codexReasoningText({ reasoning: { text: "raw thought" } })).toBe("raw thought")
    expect(codexReasoningText({ agentMessage: { text: "hello" } })).toBe("")
  })
})

describe("toolFramesForPart (agent-chat bridge)", () => {
  test("one start and one end per call, whatever the provider", async () => {
    const { toolFramesForPart } = await import("@/runtime/server/routes/tool-frames")
    const sent = new Map<string, "start" | "end">()
    const running = { type: "tool", tool: "web_search", callID: "c1", state: { status: "running", input: { query: "x" } } }
    const done = { ...running, state: { status: "completed", input: { query: "x" }, output: "3 results" } }

    const first = toolFramesForPart(running, "m1", sent)
    expect(first).toEqual([
      { type: "content_block_start", messageId: "m1", content_block: { type: "tool_use", id: "c1", name: "web_search", input: { query: "x" } } },
    ])
    expect(toolFramesForPart(running, "m1", sent)).toEqual([])
    expect(toolFramesForPart(done, "m1", sent)).toEqual([
      { type: "tool_result", messageId: "m1", toolCallId: "c1", toolName: "web_search", result: "3 results" },
    ])
    expect(toolFramesForPart(done, "m1", sent)).toEqual([])
  })

  test("a call first seen already settled still gets its start frame, errors map to tool_error", async () => {
    const { toolFramesForPart } = await import("@/runtime/server/routes/tool-frames")
    const frames = toolFramesForPart(
      { type: "tool", tool: "bash", callID: "c2", state: { status: "error", input: {}, error: "exit 1" } },
      "m1",
      new Map(),
    )
    expect(frames.map((f) => f.type)).toEqual(["content_block_start", "tool_error"])
    expect(frames[1]).toMatchObject({ toolCallId: "c2", error: "exit 1" })
  })
})

describe("usageFromMessageInfo", () => {
  test("reports only what the provider gave", async () => {
    const { usageFromMessageInfo } = await import("@/runtime/server/routes/tool-frames")
    expect(usageFromMessageInfo({ tokens: { input: 1200, output: 80, reasoning: 40, cache: { read: 900, write: 0 } }, cost: 0.0042 })).toEqual({
      inputTokens: 1200, outputTokens: 80, cacheReadTokens: 900, reasoningTokens: 40, cost: 0.0042,
    })
    expect(usageFromMessageInfo({ tokens: { input: 0, output: 0 }, cost: 0 })).toEqual({ inputTokens: 0, outputTokens: 0 })
    expect(usageFromMessageInfo({})).toBeUndefined()
  })
})
